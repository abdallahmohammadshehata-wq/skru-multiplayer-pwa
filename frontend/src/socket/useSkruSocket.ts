import { useEffect, useRef, useState, useCallback } from 'react';
import { SanitizedGameState, Card, GameVariant } from '../types';
import { LocalGameSession } from '../engine/localGameEngine';
import { networkEngine } from './networkEngine';

export interface UseSkruSocketReturn {
  isConnected: boolean;
  gameState: SanitizedGameState | null;
  lobbyState: any | null;
  peekReveal: any | null;
  chatMessages: Array<{ senderName: string; text: string; timestamp: number }>;
  emojiReactions: Array<{ id: string; emoji: string; senderName: string }>;
  isJoiningRoom: boolean;
  joinError: string | null;
  send: (event: string, payload: any) => void;
  clearPeekReveal: () => void;
  leaveRoom: () => void;
  addBotToLobby: () => void;
  clearJoinError: () => void;
}

const BOT_NAMES = ['الذكي 🦊', 'المخادع 🐯', 'الصقر 🦅', 'الذئب 🐺', 'الباندا 🐼'];
const BOT_AVATARS = ['🦊', '🐯', '🦅', '🐺', '🐼'];

function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = '';
  for (let i = 0; i < 5; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function useSkruSocket(serverUrl: string = 'ws://localhost:3001'): UseSkruSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [lobbyState, setLobbyState] = useState<any | null>(null);
  const [peekReveal, setPeekReveal] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ senderName: string; text: string; timestamp: number }>>([]);
  const [emojiReactions, setEmojiReactions] = useState<Array<{ id: string; emoji: string; senderName: string }>>([]);

  const [isJoiningRoom, setIsJoiningRoom] = useState<boolean>(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Local in-browser host session refs for serverless PWA rooms
  const localSessionRef = useRef<LocalGameSession | null>(null);
  const localLobbyRef = useRef<any | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const myPlayerIdRef = useRef<string>(
    typeof window !== 'undefined'
      ? (localStorage.getItem('skru_my_player_id') || 'p_' + Math.random().toString(36).substring(2, 9))
      : 'player_1'
  );

  const reconnectTimeoutRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  // Sync in-browser LocalGameSession into SanitizedGameState
  const syncLocalGameState = useCallback(() => {
    const session = localSessionRef.current;
    const lobby = localLobbyRef.current;
    if (!session || !lobby) return;

    const myId = myPlayerIdRef.current;
    const isRoundOver = session.isRoundOver;
    const isGameOver = session.isGameOver;

    const sanitizedPlayers = session.players.map((p) => {
      return {
        id: p.id,
        name: p.name,
        avatar: p.avatar,
        team: p.team,
        connected: true,
        totalScore: p.totalScore,
        roundScores: p.roundScores,
        hasCalledSkru: p.hasCalledSkru,
        isHost: p.isHost,
        isFrozen: p.isFrozen,
        cardCount: p.hand.length,
        // Hand contains all card values for gameplay display
        hand: p.hand.map((c) => ({
          id: c.id,
          isFaceUp: c.isFaceUp || isRoundOver,
          value: c.value,
          action: c.action,
          labelAr: c.labelAr,
          labelEn: c.labelEn,
          color: c.color
        }))
      };
    });

    const currentP = session.players[session.currentTurnIndex];

    const state: SanitizedGameState = {
      roomCode: lobby.roomCode,
      status: isGameOver ? 'GAME_OVER' : (isRoundOver ? 'ROUND_OVER' : 'PLAYING'),
      variant: session.variant,
      pointsCap: session.pointsCap,
      turnTimer: 20,
      players: sanitizedPlayers,
      spectators: [],
      currentTurnPlayerId: currentP ? currentP.id : session.players[0].id,
      turnSecondsRemaining: 20,
      topDiscard: session.discardPile.length > 0 ? session.discardPile[session.discardPile.length - 1] : null,
      drawPileCount: session.drawPile.length,
      hasDrawnCard: session.drawnCard !== null,
      drawnCardForCurrentPlayer: session.drawnCard,
      skruCallerId: session.skruCallerIndex !== null ? session.players[session.skruCallerIndex].id : null,
      finalTurnsRemaining: session.finalTurnsRemaining,
      roundNumber: session.roundNumber,
      lastActionLog: session.logs.length > 0 ? session.logs[session.logs.length - 1] : null,
      yourPlayerId: myId
    };

    setGameState(state);

    // Relay to connected players across different devices/networks via WSS MQTT
    if (networkEngine.isHost) {
      networkEngine.send('GAME_STATE', state);
    }

    // Cross-tab broadcast
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'GAME_STATE', payload: state });
    }
  }, []);

  // Initialize BroadcastChannel for cross-tab multi-window sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('skru_rooms_v2');
      broadcastChannelRef.current = channel;

      channel.onmessage = (ev) => {
        const { type, payload } = ev.data || {};
        if (type === 'LOBBY_STATE') {
          localLobbyRef.current = payload;
          setLobbyState(payload);
          setIsJoiningRoom(false);
          setJoinError(null);
        } else if (type === 'GAME_STATE') {
          setGameState(payload);
        } else if (type === 'CHAT_MESSAGE') {
          setChatMessages(prev => [...prev.slice(-25), payload]);
        } else if (type === 'EMOJI_REACTION') {
          const newEmoji = { id: Math.random().toString(), ...payload };
          setEmojiReactions(prev => [...prev.slice(-15), newEmoji]);
          setTimeout(() => {
            setEmojiReactions(prev => prev.filter(e => e.id !== newEmoji.id));
          }, 2500);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, []);

  // Optional backend WebSocket connection for local dev
  const connectWs = useCallback(() => {
    let url = serverUrl;
    if (typeof window !== 'undefined') {
      const customWs = localStorage.getItem('skru_ws_server');
      if (customWs) {
        url = customWs;
      } else if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const isHttps = window.location.protocol === 'https:';
        const wsProto = isHttps ? 'wss:' : 'ws:';
        url = `${wsProto}//${window.location.host}/ws`;
      } else {
        // In GitHub Pages, do not force fail local websocket
        return;
      }
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsWsConnected(true);
        heartbeatIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ event: 'PING' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          switch (msg.event) {
            case 'GAME_STATE':
              setGameState(msg.payload);
              break;
            case 'LOBBY_STATE':
              setLobbyState(msg.payload);
              setIsJoiningRoom(false);
              setJoinError(null);
              break;
            case 'PEEK_REVEAL':
              setPeekReveal(msg.payload);
              if (msg.payload.durationMs) {
                setTimeout(() => setPeekReveal(null), msg.payload.durationMs);
              }
              break;
            case 'CHAT_BROADCAST':
              setChatMessages(prev => [...prev.slice(-25), msg.payload]);
              break;
            case 'EMOJI_BROADCAST':
              const newEmoji = { id: Math.random().toString(), ...msg.payload };
              setEmojiReactions(prev => [...prev.slice(-15), newEmoji]);
              setTimeout(() => {
                setEmojiReactions(prev => prev.filter(e => e.id !== newEmoji.id));
              }, 2500);
              break;
            default:
              break;
          }
        } catch (e) {
          console.error('Error handling WS event:', e);
        }
      };

      ws.onclose = () => {
        setIsWsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        reconnectTimeoutRef.current = setTimeout(connectWs, 5000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setIsWsConnected(false);
    }
  }, [serverUrl]);

  useEffect(() => {
    connectWs();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connectWs]);

  // Client-side host engine action dispatcher
  const handleClientSideAction = useCallback((event: string, payload: any) => {
    const myId = myPlayerIdRef.current;

    switch (event) {
      case 'CREATE_ROOM': {
        const roomCode = generateRoomCode();
        const hostPlayer = {
          id: payload.playerId || myId,
          name: payload.name || 'الفرعون',
          avatar: payload.avatar || '🦁',
          team: payload.options?.variant === 'SAHEB_SA7BO' ? 'A' : undefined,
          connected: true,
          isHost: true
        };

        const lobby = {
          roomCode,
          status: 'LOBBY',
          hostId: hostPlayer.id,
          options: {
            variant: payload.options?.variant || 'CLASSIC',
            pointsCap: payload.options?.pointsCap || 100,
            turnTimer: payload.options?.turnTimer || 20,
            maxPlayers: payload.options?.maxPlayers || 4,
            passcode: payload.options?.passcode || ''
          },
          players: [hostPlayer],
          spectators: []
        };

        localLobbyRef.current = lobby;
        setLobbyState(lobby);
        setIsJoiningRoom(false);
        setJoinError(null);

        // Host the room topic on the public WSS MQTT broker
        networkEngine.hostRoom(roomCode);

        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'LOBBY_STATE', payload: lobby });
        }
        break;
      }

      case 'JOIN_ROOM': {
        const { roomCode, playerId, name, avatar, team } = payload;
        const cleanCode = (roomCode || '').toUpperCase().trim();
        if (!cleanCode) return;

        setIsJoiningRoom(true);
        setJoinError(null);

        // Check if host is in another tab of same browser
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({
            type: 'JOIN_ROOM_REQUEST',
            payload: { roomCode: cleanCode, playerId: playerId || myId, name, avatar, team }
          });
        }

        // Join room via public WSS MQTT broker
        networkEngine.joinRoom(
          cleanCode,
          {
            playerId: playerId || myId,
            name: name || 'Player',
            avatar: avatar || '🦁',
            team
          },
          () => {
            // Host responded
            setIsJoiningRoom(false);
            setJoinError(null);
          },
          (reason) => {
            setIsJoiningRoom(false);
            setJoinError(reason);
          }
        );
        break;
      }

      case 'ADD_BOT': {
        const lobby = localLobbyRef.current;
        if (!lobby || lobby.players.length >= lobby.options.maxPlayers) return;

        const botIdx = lobby.players.length;
        const botName = BOT_NAMES[botIdx % BOT_NAMES.length];
        const botAvatar = BOT_AVATARS[botIdx % BOT_AVATARS.length];

        const botPlayer = {
          id: `bot_${Date.now()}_${botIdx}`,
          name: botName,
          avatar: botAvatar,
          team: lobby.options.variant === 'SAHEB_SA7BO' ? (botIdx % 2 === 0 ? 'A' : 'B') : undefined,
          connected: true,
          isHost: false,
          isAi: true
        };

        const updatedLobby = {
          ...lobby,
          players: [...lobby.players, botPlayer]
        };

        localLobbyRef.current = updatedLobby;
        setLobbyState(updatedLobby);

        if (networkEngine.isHost) {
          networkEngine.send('LOBBY_STATE', updatedLobby);
        }

        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'LOBBY_STATE', payload: updatedLobby });
        }
        break;
      }

      case 'START_GAME': {
        const lobby = localLobbyRef.current;
        if (!lobby) return;

        // Ensure at least 2 players by adding bots if needed
        let playersToStart = [...lobby.players];
        while (playersToStart.length < 2) {
          const idx = playersToStart.length;
          playersToStart.push({
            id: `bot_auto_${idx}`,
            name: BOT_NAMES[idx % BOT_NAMES.length],
            avatar: BOT_AVATARS[idx % BOT_AVATARS.length],
            isAi: true,
            connected: true,
            isHost: false
          });
        }

        const configs = playersToStart.map((p) => ({
          name: p.name,
          avatar: p.avatar,
          isAi: p.isAi || false
        }));

        const session = new LocalGameSession(
          configs,
          lobby.options.variant,
          lobby.options.pointsCap
        );

        // Map real player IDs into the game session
        playersToStart.forEach((p, idx) => {
          if (session.players[idx]) {
            session.players[idx].id = p.id;
          }
        });

        session.onStateChange = () => {
          syncLocalGameState();
        };

        localSessionRef.current = session;
        syncLocalGameState();
        break;
      }

      case 'DRAW_CARD': {
        const session = localSessionRef.current;
        if (!session) return;
        session.draw(payload.from);
        syncLocalGameState();
        break;
      }

      case 'SWAP_CARD': {
        const session = localSessionRef.current;
        if (!session) return;
        session.swap(payload.handIndex);
        syncLocalGameState();
        break;
      }

      case 'DISCARD_CARD': {
        const session = localSessionRef.current;
        if (!session || !session.drawnCard) return;
        const discarded = session.drawnCard;
        session.discard();

        // If card has an actionable power, trigger ACTION_PENDING
        if (discarded.action && discarded.action !== 'NONE') {
          setGameState(prev => prev ? ({
            ...prev,
            status: 'ACTION_PENDING',
            pendingActionSummary: {
              type: discarded.action,
              initiatorId: myId,
              expiresInSeconds: 15,
              stage: 'SELECT_TARGET'
            }
          }) : null);
        } else {
          syncLocalGameState();
        }
        break;
      }

      case 'EXECUTE_ACTION': {
        const session = localSessionRef.current;
        if (!session) return;
        const top = session.discardPile[session.discardPile.length - 1];
        const actionType = top ? top.action : 'NONE';

        if (actionType === 'PEEK_OWN') {
          const card = session.players[0].hand[payload.ownCardIndex];
          if (card) {
            setPeekReveal({
              peekData: { card },
              durationMs: 4000
            });
          }
        } else if (actionType === 'PEEK_OTHER') {
          const targetOpp = session.players.find(p => p.id === payload.targetPlayerId) || session.players[1];
          if (targetOpp) {
            const card = targetOpp.hand[payload.targetCardIndex];
            if (card) {
              setPeekReveal({
                peekData: { card },
                durationMs: 4000
              });
            }
          }
        } else if (actionType === 'SWAP') {
          const p0 = session.players[0];
          const opp = session.players.find(p => p.id === payload.targetPlayerId) || session.players[1];
          if (p0 && opp && p0.hand[payload.myCardIndex] && opp.hand[payload.targetCardIndex]) {
            const temp = p0.hand[payload.myCardIndex];
            p0.hand[payload.myCardIndex] = opp.hand[payload.targetCardIndex];
            opp.hand[payload.targetCardIndex] = temp;
          }
        } else if (actionType === 'PEEK_AND_SWAP') {
          const opp = session.players.find(p => p.id === payload.targetPlayerId) || session.players[1];
          if (opp) {
            const card = opp.hand[payload.targetCardIndex];
            if (card) {
              setPeekReveal({
                peekData: { card, requireSwapChoice: true },
                durationMs: 6000
              });
            }
          }
        }

        setTimeout(() => {
          syncLocalGameState();
        }, 300);
        break;
      }

      case 'CALL_SKRU': {
        const session = localSessionRef.current;
        if (!session) return;
        session.callSkru();
        syncLocalGameState();
        break;
      }

      case 'MATCH_SLAP': {
        const session = localSessionRef.current;
        if (!session) return;
        const playerIdx = session.players.findIndex(p => p.id === (payload.playerId || myId));
        session.matchSlap(playerIdx >= 0 ? playerIdx : 0, payload.handIndex);
        syncLocalGameState();
        break;
      }

      case 'START_NEXT_ROUND': {
        const session = localSessionRef.current;
        if (!session) return;
        session.roundNumber += 1;
        session.startRound();
        syncLocalGameState();
        break;
      }

      case 'CHAT_MESSAGE': {
        const chatItem = {
          senderName: localLobbyRef.current?.players?.find((p: any) => p.id === myId)?.name || 'أنت',
          text: payload.text,
          timestamp: Date.now()
        };
        setChatMessages(prev => [...prev.slice(-25), chatItem]);
        networkEngine.send('CHAT_MESSAGE', chatItem);
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'CHAT_MESSAGE', payload: chatItem });
        }
        break;
      }

      case 'EMOJI_REACTION': {
        const emojiItem = {
          id: Math.random().toString(),
          emoji: payload.emoji,
          senderName: localLobbyRef.current?.players?.find((p: any) => p.id === myId)?.name || 'أنت'
        };
        setEmojiReactions(prev => [...prev.slice(-15), emojiItem]);
        setTimeout(() => {
          setEmojiReactions(prev => prev.filter(e => e.id !== emojiItem.id));
        }, 2500);
        networkEngine.send('EMOJI_REACTION', emojiItem);
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'EMOJI_REACTION', payload: emojiItem });
        }
        break;
      }

      default:
        break;
    }
  }, [syncLocalGameState]);

  // NetworkEngine event listener for multi-device sync
  useEffect(() => {
    const unsub = networkEngine.onMessage((msg: any) => {
      const { event, payload } = msg;

      if (networkEngine.isHost) {
        // HOST RECEIVING MESSAGES FROM CLIENT PEERS
        switch (event) {
          case 'JOIN_ROOM': {
            const currentLobby = localLobbyRef.current;
            if (!currentLobby) return;

            const newPlayer = {
              id: payload.playerId || `p_${Date.now()}`,
              name: payload.name || 'Player',
              avatar: payload.avatar || '🦁',
              team: currentLobby.options.variant === 'SAHEB_SA7BO' ? (payload.team || (currentLobby.players.length % 2 === 0 ? 'A' : 'B')) : undefined,
              connected: true,
              isHost: false
            };

            const existingIdx = currentLobby.players.findIndex((p: any) => p.id === newPlayer.id);
            let updatedPlayers;
            if (existingIdx >= 0) {
              updatedPlayers = [...currentLobby.players];
              updatedPlayers[existingIdx] = newPlayer;
            } else {
              updatedPlayers = [...currentLobby.players, newPlayer];
            }

            const updatedLobby = {
              ...currentLobby,
              players: updatedPlayers
            };

            localLobbyRef.current = updatedLobby;
            setLobbyState(updatedLobby);

            // Send updated lobby state to all players
            networkEngine.send('LOBBY_STATE', updatedLobby);
            if (broadcastChannelRef.current) {
              broadcastChannelRef.current.postMessage({ type: 'LOBBY_STATE', payload: updatedLobby });
            }

            if (localSessionRef.current) {
              syncLocalGameState();
            }
            break;
          }

          case 'DRAW_CARD':
          case 'SWAP_CARD':
          case 'DISCARD_CARD':
          case 'EXECUTE_ACTION':
          case 'CALL_SKRU':
          case 'MATCH_SLAP':
          case 'START_GAME':
          case 'START_NEXT_ROUND': {
            handleClientSideAction(event, payload);
            break;
          }

          case 'CHAT_MESSAGE': {
            setChatMessages(prev => [...prev.slice(-25), payload]);
            break;
          }

          case 'EMOJI_REACTION': {
            setEmojiReactions(prev => [...prev.slice(-15), payload]);
            setTimeout(() => {
              setEmojiReactions(prev => prev.filter(e => e.id !== payload.id));
            }, 2500);
            break;
          }

          default:
            break;
        }
      } else {
        // CLIENT RECEIVING MESSAGES FROM HOST
        switch (event) {
          case 'LOBBY_STATE': {
            localLobbyRef.current = payload;
            setLobbyState(payload);
            setIsJoiningRoom(false);
            setJoinError(null);
            break;
          }
          case 'GAME_STATE': {
            setGameState(payload);
            break;
          }
          case 'PEEK_REVEAL': {
            setPeekReveal(payload);
            break;
          }
          case 'CHAT_MESSAGE': {
            setChatMessages(prev => [...prev.slice(-25), payload]);
            break;
          }
          case 'EMOJI_REACTION': {
            const newEmoji = { id: Math.random().toString(), ...payload };
            setEmojiReactions(prev => [...prev.slice(-15), newEmoji]);
            setTimeout(() => {
              setEmojiReactions(prev => prev.filter(e => e.id !== newEmoji.id));
            }, 2500);
            break;
          }
          default:
            break;
        }
      }
    });

    return () => {
      unsub();
    };
  }, [handleClientSideAction, syncLocalGameState]);

  const send = useCallback((event: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    } else if (networkEngine.isConnected && !networkEngine.isHost && event !== 'CREATE_ROOM' && event !== 'JOIN_ROOM') {
      // Client relays in-game move directly to room host over WSS MQTT
      networkEngine.send(event, { ...payload, playerId: myPlayerIdRef.current });
    } else {
      // Offline / host execution
      handleClientSideAction(event, payload);
    }
  }, [handleClientSideAction]);

  const addBotToLobby = useCallback(() => {
    send('ADD_BOT', {});
  }, [send]);

  const leaveRoom = useCallback(() => {
    networkEngine.destroy();
    localSessionRef.current = null;
    localLobbyRef.current = null;
    setLobbyState(null);
    setGameState(null);
    setIsJoiningRoom(false);
    setJoinError(null);
  }, []);

  const clearPeekReveal = () => setPeekReveal(null);
  const clearJoinError = () => setJoinError(null);

  const isConnected = isWsConnected || networkEngine.isConnected || true;

  return {
    isConnected,
    gameState,
    lobbyState,
    peekReveal,
    chatMessages,
    emojiReactions,
    isJoiningRoom,
    joinError,
    send,
    clearPeekReveal,
    leaveRoom,
    addBotToLobby,
    clearJoinError
  };
}

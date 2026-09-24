import { useEffect, useRef, useState, useCallback } from 'react';
import { SanitizedGameState, Card, GameVariant } from '../types';
import { LocalGameSession } from '../engine/localGameEngine';

export interface UseSkruSocketReturn {
  isConnected: boolean;
  gameState: SanitizedGameState | null;
  lobbyState: any | null;
  peekReveal: any | null;
  chatMessages: Array<{ senderName: string; text: string; timestamp: number }>;
  emojiReactions: Array<{ id: string; emoji: string; senderName: string }>;
  send: (event: string, payload: any) => void;
  clearPeekReveal: () => void;
  leaveRoom: () => void;
  addBotToLobby: () => void;
}

const BOT_NAMES = ['الذكي 🦊', 'المخادع 🐯', 'الصقر 🦅', 'الذئب 🐺', 'الباندا 🐼'];
const BOT_AVATARS = ['🦊', '🐯', '🦅', '🐺', '🐼'];

function generateRoomCode(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let res = 'SKRU-';
  for (let i = 0; i < 3; i++) {
    res += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return res;
}

export function useSkruSocket(serverUrl: string = 'ws://localhost:3001'): UseSkruSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [lobbyState, setLobbyState] = useState<any | null>(null);
  const [peekReveal, setPeekReveal] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ senderName: string; text: string; timestamp: number }>>([]);
  const [emojiReactions, setEmojiReactions] = useState<Array<{ id: string; emoji: string; senderName: string }>>([]);

  // Local in-browser host session refs for offline / client-side instant room fallback
  const localSessionRef = useRef<LocalGameSession | null>(null);
  const localLobbyRef = useRef<any | null>(null);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);
  const myPlayerIdRef = useRef<string>(localStorage.getItem('skru_my_player_id') || 'player_1');

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
      const isMe = p.id === myId;
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
        hand: p.hand.map((c) => ({
          id: c.id,
          isFaceUp: c.isFaceUp || isRoundOver,
          value: (c.isFaceUp || isRoundOver) ? c.value : undefined,
          action: (c.isFaceUp || isRoundOver) ? c.action : undefined,
          labelAr: (c.isFaceUp || isRoundOver) ? c.labelAr : undefined,
          labelEn: (c.isFaceUp || isRoundOver) ? c.labelEn : undefined,
          color: (c.isFaceUp || isRoundOver) ? c.color : undefined
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

    // Cross-tab broadcast
    if (broadcastChannelRef.current) {
      broadcastChannelRef.current.postMessage({ type: 'GAME_STATE', payload: state });
    }
  }, []);

  // Initialize BroadcastChannel for cross-tab multi-window sync
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('skru_rooms');
      broadcastChannelRef.current = channel;

      channel.onmessage = (ev) => {
        const { type, payload } = ev.data || {};
        if (type === 'LOBBY_STATE') {
          localLobbyRef.current = payload;
          setLobbyState(payload);
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

  // WebSocket Connection
  const connect = useCallback(() => {
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
        // Fallback for public hosting / GitHub Pages
        url = 'ws://127.0.0.1:3001';
      }
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
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
        setIsConnected(false);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
        reconnectTimeoutRef.current = setTimeout(connect, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 4000);
    }
  }, [serverUrl]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, [connect]);

  // Client-side fallback action dispatcher
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

        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'LOBBY_STATE', payload: lobby });
        }
        break;
      }

      case 'JOIN_ROOM': {
        const { roomCode, playerId, name, avatar, team } = payload;
        let lobby = localLobbyRef.current;
        if (!lobby) {
          // Create instant lobby for this code
          lobby = {
            roomCode,
            status: 'LOBBY',
            hostId: playerId || myId,
            options: { variant: 'CLASSIC', pointsCap: 100, turnTimer: 20, maxPlayers: 4 },
            players: [],
            spectators: []
          };
        }

        const newPlayer = {
          id: playerId || myId,
          name: name || 'Player',
          avatar: avatar || '🦁',
          team: team || (lobby.players.length % 2 === 0 ? 'A' : 'B'),
          connected: true,
          isHost: lobby.players.length === 0
        };

        const updatedLobby = {
          ...lobby,
          players: [...lobby.players.filter((p: any) => p.id !== newPlayer.id), newPlayer]
        };

        localLobbyRef.current = updatedLobby;
        setLobbyState(updatedLobby);

        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'LOBBY_STATE', payload: updatedLobby });
        }
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

        const configs = playersToStart.map((p, idx) => ({
          name: p.name,
          avatar: p.avatar,
          isAi: p.isAi || (p.id !== myId && !p.connected)
        }));

        const session = new LocalGameSession(
          configs,
          lobby.options.variant,
          lobby.options.pointsCap
        );

        // Map IDs
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
        if (!session) return;
        session.discard();
        syncLocalGameState();
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
        session.matchSlap(0, payload.handIndex);
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
        if (broadcastChannelRef.current) {
          broadcastChannelRef.current.postMessage({ type: 'EMOJI_REACTION', payload: emojiItem });
        }
        break;
      }

      default:
        break;
    }
  }, [syncLocalGameState]);

  const send = useCallback((event: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    } else {
      // Offline / standalone PWA execution
      handleClientSideAction(event, payload);
    }
  }, [handleClientSideAction]);

  const addBotToLobby = useCallback(() => {
    send('ADD_BOT', {});
  }, [send]);

  const leaveRoom = useCallback(() => {
    localSessionRef.current = null;
    localLobbyRef.current = null;
    setLobbyState(null);
    setGameState(null);
  }, []);

  const clearPeekReveal = () => setPeekReveal(null);

  return {
    isConnected,
    gameState,
    lobbyState,
    peekReveal,
    chatMessages,
    emojiReactions,
    send,
    clearPeekReveal,
    leaveRoom,
    addBotToLobby
  };
}

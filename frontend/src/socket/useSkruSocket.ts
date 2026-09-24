import { useEffect, useRef, useState, useCallback } from 'react';
import { SanitizedGameState } from '../types';

export interface UseSkruSocketReturn {
  isConnected: boolean;
  gameState: SanitizedGameState | null;
  lobbyState: any | null;
  peekReveal: any | null;
  chatMessages: Array<{ senderName: string; text: string; timestamp: number }>;
  emojiReactions: Array<{ id: string; emoji: string; senderName: string }>;
  send: (event: string, payload: any) => void;
  clearPeekReveal: () => void;
}

export function useSkruSocket(serverUrl: string = 'ws://localhost:3001'): UseSkruSocketReturn {
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [gameState, setGameState] = useState<SanitizedGameState | null>(null);
  const [lobbyState, setLobbyState] = useState<any | null>(null);
  const [peekReveal, setPeekReveal] = useState<any | null>(null);
  const [chatMessages, setChatMessages] = useState<Array<{ senderName: string; text: string; timestamp: number }>>([]);
  const [emojiReactions, setEmojiReactions] = useState<Array<{ id: string; emoji: string; senderName: string }>>([]);

  const reconnectTimeoutRef = useRef<any>(null);
  const heartbeatIntervalRef = useRef<any>(null);

  const connect = useCallback(() => {
    // Resolve dynamic host for LAN, public tunnel, GitHub Pages, or Cloud deployment
    let url = serverUrl;
    if (typeof window !== 'undefined') {
      const customWs = localStorage.getItem('skru_ws_server');
      if (customWs) {
        url = customWs;
      } else if (window.location.hostname.endsWith('github.io')) {
        // Live public WebSocket game server for GitHub Pages
        url = 'wss://0301c2c0c9b92bea-41-38-119-57.serveousercontent.com/ws';
      } else {
        const isHttps = window.location.protocol === 'https:';
        const wsProto = isHttps ? 'wss:' : 'ws:';
        url = `${wsProto}//${window.location.host}/ws`;
      }
    }

    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Start heartbeat
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
        reconnectTimeoutRef.current = setTimeout(() => {
          connect();
        }, 2000);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch (e) {
      setIsConnected(false);
      reconnectTimeoutRef.current = setTimeout(connect, 3000);
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

  const send = useCallback((event: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event, payload }));
    }
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
    clearPeekReveal
  };
}

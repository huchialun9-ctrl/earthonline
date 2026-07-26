import { useState, useEffect, useRef, useCallback } from 'react';

export default function useSocket(SOCKET_URL, region, token, onLogout) {
  const [isConnected, setIsConnected] = useState(false);
  const [ping, setPing] = useState(0);
  const wsRef = useRef(null);
  const handlersRef = useRef({});
  const queueRef = useRef([]);
  const socketRef = useRef(null);

  const getSocket = useCallback(() => {
    if (!socketRef.current) {
      socketRef.current = {
        on: (event, handler) => {
          if (!handlersRef.current[event]) handlersRef.current[event] = [];
          handlersRef.current[event].push(handler);
          const idx = handlersRef.current[event].length - 1;
          return () => {
            handlersRef.current[event]?.splice(idx, 1);
          };
        },
        off: (event) => {
          delete handlersRef.current[event];
        },
        removeAllListeners: () => {
          handlersRef.current = {};
        },
        emit: (event, payload) => {
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ event, payload }));
          } else {
            queueRef.current.push({ event, payload });
          }
        },
      };
    }
    return socketRef.current;
  }, []);

  useEffect(() => {
    const wsUrl = (SOCKET_URL || '').replace(/^http/, 'ws') + `/ws?region=${region}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.addEventListener('open', () => {
      setIsConnected(true);
      const socket = getSocket();
      socket.connected = true;
      ws.send(JSON.stringify({ event: 'auth', payload: { username: getUsernameFromToken(token) || 'guest', token } }));
      while (queueRef.current.length > 0) {
        const q = queueRef.current.shift();
        ws.send(JSON.stringify(q));
      }
    });

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.event === 'auth_error') {
          alert(data.message || '授權已過期');
          onLogout();
          return;
        }
        const handlers = handlersRef.current[data.event];
        if (handlers) handlers.forEach(h => h(data));
      } catch (err) {
        console.error('[WS] Parse error:', err);
      }
    });

    ws.addEventListener('close', () => {
      setIsConnected(false);
      if (socketRef.current) socketRef.current.connected = false;
    });

    ws.addEventListener('error', () => {
      setIsConnected(false);
      if (socketRef.current) socketRef.current.connected = false;
    });

    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        const start = Date.now();
        ws.send(JSON.stringify({ event: 'ping' }));
        const handlers = handlersRef.current['pong'];
        if (handlers) handlers.forEach(h => h(Date.now() - start));
        setPing(Date.now() - start);
      }
    }, 2000);

    return () => {
      clearInterval(pingInterval);
      ws.close();
      wsRef.current = null;
      handlersRef.current = {};
      queueRef.current = [];
    };
  }, [region, token, onLogout, getSocket]);

  return { socket: socketRef.current, isConnected, ping, setSocket: getSocket };
}

function getUsernameFromToken(token) {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const body = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return body.username || null;
  } catch { return null; }
}

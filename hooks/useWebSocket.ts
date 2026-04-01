'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const RECONNECT_DELAY_MS = 2000;

interface UseWebSocketOptions {
  url: string | null;
  onMessage: (data: string) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export interface UseWebSocketReturn {
  isConnected: boolean;
  send: (data: string) => boolean;
  error: string | null;
}

export function useWebSocket({
  url,
  onMessage,
  onOpen,
  onClose,
}: UseWebSocketOptions): UseWebSocketReturn {
  const socketRef = useRef<WebSocket | null>(null);
  // Keep all callbacks in refs so the effect never needs to re-run when they change
  const onMessageRef = useRef(onMessage);
  const onOpenRef = useRef(onOpen);
  const onCloseRef = useRef(onClose);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onOpenRef.current = onOpen;
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!url) {
      setIsConnected(false);
      return undefined;
    }

    let intentionalClose = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        setIsConnected(true);
        setError(null);
        onOpenRef.current?.();
      };

      socket.onmessage = (event) => {
        onMessageRef.current(event.data);
      };

      socket.onerror = () => {
        setError('Connection error');
      };

      socket.onclose = () => {
        // Only clear the ref if this socket is still the active one.
        // In React StrictMode, the cleanup for the first effect run fires after
        // the second run has already created a new socket — without this guard
        // the stale onclose would wipe out the new socket's reference.
        if (socketRef.current === socket) {
          socketRef.current = null;
        }
        setIsConnected(false);
        onCloseRef.current?.();

        if (intentionalClose) {
          return;
        }

        setError('Connection lost. Reconnecting...');
        reconnectTimer = setTimeout(() => {
          if (!intentionalClose) {
            setError(null);
            connect();
          }
        }, RECONNECT_DELAY_MS);
      };
    };

    connect();

    return () => {
      intentionalClose = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
      }
      const socket = socketRef.current;
      if (socket) {
        socket.close();
      }
      socketRef.current = null;
      setIsConnected(false);
    };
  }, [url]);

  const send = useCallback((data: string): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return false;
    }
    socket.send(data);
    return true;
  }, []);

  return { isConnected, send, error };
}

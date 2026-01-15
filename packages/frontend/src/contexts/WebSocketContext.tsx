/**
 * WebSocket Context - Provides a single shared WebSocket connection
 *
 * This fixes the bug where multiple useWebSocket() calls created separate
 * connections, causing subscription/broadcast issues.
 */
import { createContext, useContext, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAppStore } from '../stores/appStore';
import type { ServerToClientEvent, ClientToServerEvent } from '@parawork/shared';

// Configuration
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRY_DELAY = 30000;
const MAX_RETRIES = 10;
const BACKOFF_MULTIPLIER = 2;

type EventHandler = (event: ServerToClientEvent) => void;

interface WebSocketContextValue {
  send: (event: ClientToServerEvent) => boolean;
  subscribe: (handler: EventHandler) => () => void;
  reset: () => void;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

interface WebSocketProviderProps {
  children: ReactNode;
}

export function WebSocketProvider({ children }: WebSocketProviderProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Set<EventHandler>>(new Set());
  const retryCountRef = useRef(0);
  const retryDelayRef = useRef(INITIAL_RETRY_DELAY);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isUnmountedRef = useRef(false);

  const { setWsConnected, wsConnected } = useAppStore();

  const getWsUrl = useCallback(() => {
    const apiKey = localStorage.getItem('parawork_api_key') || '';
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = import.meta.env.VITE_WS_HOST || window.location.host;
    return `${protocol}//${host}?api_key=${encodeURIComponent(apiKey)}`;
  }, []);

  const connect = useCallback(() => {
    if (isUnmountedRef.current) {
      console.log('[WebSocket] Not connecting: component unmounted');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log('[WebSocket] Not connecting: already connected');
      return;
    }

    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = getWsUrl();
    console.log('[WebSocket] Connecting to:', url);
    const ws = new WebSocket(url);

    ws.onopen = () => {
      console.log('[WebSocket] Connected');
      setWsConnected(true);
      retryCountRef.current = 0;
      retryDelayRef.current = INITIAL_RETRY_DELAY;
    };

    ws.onclose = (event) => {
      console.log(`[WebSocket] Disconnected: ${event.code} ${event.reason}`);
      setWsConnected(false);
      wsRef.current = null;

      if (isUnmountedRef.current) return;
      if (event.code === 1000 || event.code === 1001) return;

      if (retryCountRef.current < MAX_RETRIES) {
        const delay = Math.min(retryDelayRef.current, MAX_RETRY_DELAY);
        console.log(`[WebSocket] Reconnecting in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);

        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          retryDelayRef.current *= BACKOFF_MULTIPLIER;
          connect();
        }, delay);
      } else {
        console.error('[WebSocket] Max reconnection attempts reached');
      }
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data: ServerToClientEvent = JSON.parse(event.data);
        console.log('[WebSocket] Received message:', data.type);
        // Broadcast to all handlers
        const handlerCount = handlersRef.current.size;
        console.log('[WebSocket] Broadcasting to', handlerCount, 'handlers');
        handlersRef.current.forEach((handler) => handler(data));
      } catch (error) {
        console.error('[WebSocket] Error parsing message:', error);
      }
    };

    wsRef.current = ws;
  }, [getWsUrl, setWsConnected]);

  const disconnect = useCallback(() => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }
  }, []);

  const send = useCallback((event: ClientToServerEvent): boolean => {
    const ws = wsRef.current;
    const readyState = ws?.readyState;
    console.log('[WebSocket] send() called:', {
      type: event.type,
      hasWs: !!ws,
      readyState,
      readyStateLabel: readyState === WebSocket.OPEN ? 'OPEN' :
                       readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                       readyState === WebSocket.CLOSING ? 'CLOSING' :
                       readyState === WebSocket.CLOSED ? 'CLOSED' : 'NONE'
    });

    if (ws?.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(event));
      console.log('[WebSocket] Message sent successfully:', event.type);
      return true;
    } else {
      console.warn('[WebSocket] Cannot send - not connected');
      return false;
    }
  }, []);

  const subscribe = useCallback((handler: EventHandler) => {
    handlersRef.current.add(handler);
    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  const reset = useCallback(() => {
    console.log('[WebSocket] reset() called - reconnecting with fresh state');
    retryCountRef.current = 0;
    retryDelayRef.current = INITIAL_RETRY_DELAY;
    disconnect();
    connect();
  }, [disconnect, connect]);

  // Connect on mount
  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      disconnect();
      handlersRef.current.clear();
    };
  }, [connect, disconnect]);

  const value: WebSocketContextValue = {
    send,
    subscribe,
    reset,
    connected: wsConnected,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

/**
 * Hook to access the shared WebSocket connection
 */
export function useWebSocket(): WebSocketContextValue {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}

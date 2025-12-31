/**
 * WebSocket hook for real-time updates with exponential backoff
 */
import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../stores/appStore';
import type { ServerToClientEvent, ClientToServerEvent } from '@parawork/shared';

// Configuration
const INITIAL_RETRY_DELAY = 1000; // 1 second
const MAX_RETRY_DELAY = 30000; // 30 seconds
const MAX_RETRIES = 10;
const BACKOFF_MULTIPLIER = 2;

type EventHandler = (event: ServerToClientEvent) => void;

export function useWebSocket() {
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
    if (isUnmountedRef.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(getWsUrl());

    ws.onopen = () => {
      console.log('WebSocket connected');
      setWsConnected(true);
      // Reset retry state on successful connection
      retryCountRef.current = 0;
      retryDelayRef.current = INITIAL_RETRY_DELAY;
    };

    ws.onclose = (event) => {
      console.log(`WebSocket disconnected: ${event.code} ${event.reason}`);
      setWsConnected(false);
      wsRef.current = null;

      // Don't retry if unmounted or if closed cleanly by server shutdown
      if (isUnmountedRef.current) return;
      if (event.code === 1000 || event.code === 1001) return;

      // Exponential backoff retry
      if (retryCountRef.current < MAX_RETRIES) {
        const delay = Math.min(retryDelayRef.current, MAX_RETRY_DELAY);
        console.log(`Reconnecting in ${delay}ms (attempt ${retryCountRef.current + 1}/${MAX_RETRIES})`);

        retryTimeoutRef.current = setTimeout(() => {
          retryCountRef.current++;
          retryDelayRef.current *= BACKOFF_MULTIPLIER;
          connect();
        }, delay);
      } else {
        console.error('Max WebSocket reconnection attempts reached');
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data: ServerToClientEvent = JSON.parse(event.data);
        handlersRef.current.forEach((handler) => handler(data));
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current = ws;
  }, [getWsUrl, setWsConnected]);

  const disconnect = useCallback(() => {
    // Clear any pending retry
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
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(event));
      return true;
    } else {
      console.warn('WebSocket not connected, message not sent');
      return false;
    }
  }, []);

  const subscribe = useCallback((handler: EventHandler) => {
    handlersRef.current.add(handler);

    return () => {
      handlersRef.current.delete(handler);
    };
  }, []);

  // Reset connection (useful for API key changes)
  const reset = useCallback(() => {
    retryCountRef.current = 0;
    retryDelayRef.current = INITIAL_RETRY_DELAY;
    disconnect();
    connect();
  }, [disconnect, connect]);

  useEffect(() => {
    isUnmountedRef.current = false;
    connect();

    return () => {
      isUnmountedRef.current = true;
      disconnect();
      // Clear all handlers on unmount
      handlersRef.current.clear();
    };
  }, [connect, disconnect]);

  return {
    send,
    subscribe,
    reset,
    connected: wsConnected,
  };
}

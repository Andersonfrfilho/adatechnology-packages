/// <reference types="vite/client" />
// Hook para WebSocket real-time updates (only when processing)

import { useEffect, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import type { ProgressEvent } from '../types/index';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3000';

export function useWebSocket(jobId: string | null, enabled: boolean = false) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [progress, setProgress] = useState<ProgressEvent | null>(null);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!jobId || !enabled) {
      return;
    }

    // Create socket connection
    const newSocket = io(WS_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    // Connection events
    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      setError(null);

      // Subscribe to job
      newSocket.emit('subscribe', { jobId });
    });

    // Progress updates
    newSocket.on('progress', (data: ProgressEvent) => {
      console.log('📊 Progress:', data);
      setProgress(data);
    });

    // Job completed
    newSocket.on('completed', (result: any) => {
      console.log('✅ Completed:', result);
      setCompleted(true);
      setProgress({ stage: 'remuxing', percent: 100, message: 'Concluído!' });
      newSocket.disconnect();
    });

    // Job failed
    newSocket.on('failed', (error: any) => {
      console.error('❌ Failed:', error);
      setError(error.message || 'Job failed');
      newSocket.disconnect();
    });

    // Connection errors
    newSocket.on('error', (err: any) => {
      console.error('⚠️ Error:', err);
      setError(err.message || 'Connection error');
      newSocket.disconnect();
    });

    // Disconnected
    newSocket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
      setIsConnected(false);
    });

    setSocket(newSocket);

    // Cleanup
    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [jobId, enabled]);

  const disconnect = useCallback(() => {
    if (socket) {
      socket.disconnect();
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket]);

  return {
    socket,
    isConnected,
    progress,
    completed,
    error,
    disconnect,
  };
}

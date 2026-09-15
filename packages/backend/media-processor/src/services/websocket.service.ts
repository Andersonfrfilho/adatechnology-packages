// WebSocket Service - Real-time progress updates (only during processing)

import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { Queue, Job } from 'bullmq';
import { Logger } from '@adatechnology/logger';
import { ProgressEvent } from '../types/index.js';
import { WEBSOCKET_CONFIG } from '../constants/index.js';

export class WebSocketService {
  private io: SocketIOServer;
  private logger: Logger;
  private jobConnections = new Map<string, Set<string>>(); // jobId -> Set<socketId>

  constructor(
    httpServer: HttpServer,
    private queue: Queue,
    logger: Logger,
  ) {
    this.logger = logger;
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
      },
      transports: WEBSOCKET_CONFIG.TRANSPORTS as any[],
      pingInterval: WEBSOCKET_CONFIG.PING_INTERVAL,
      pingTimeout: WEBSOCKET_CONFIG.PING_TIMEOUT,
    });

    this.setupConnections();
  }

  private setupConnections(): void {
    this.io.on('connection', (socket: Socket) => {
      this.logger.info('[WebSocket] Client connected', { socketId: socket.id });

      socket.on('subscribe', (data: { jobId: string }) => {
        this.handleSubscribe(socket, data.jobId);
      });

      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      socket.on('reconnect_attempt', () => {
        this.logger.debug('[WebSocket] Reconnect attempt', { socketId: socket.id });
      });
    });
  }

  private async handleSubscribe(socket: Socket, jobId: string): Promise<void> {
    try {
      // Validate job exists and is processing
      const job = await this.queue.getJob(jobId);

      if (!job) {
        socket.emit('error', { message: 'Job not found', jobId });
        socket.disconnect(true);
        return;
      }

      const state = await job.getState();

      // ❌ Only allow connection if job is actively processing
      if (state !== 'active') {
        socket.emit('error', {
          message: `Job not processing (status: ${state})`,
          jobId,
          currentStatus: state,
        });
        socket.disconnect(true);
        return;
      }

      // ✅ Join room for this job
      socket.join(`job:${jobId}`);

      // Track connection
      if (!this.jobConnections.has(jobId)) {
        this.jobConnections.set(jobId, new Set());
      }
      this.jobConnections.get(jobId)!.add(socket.id);

      // Send current progress
      const progress = await job.progress();
      if (progress) {
        socket.emit('progress', progress);
      }

      this.logger.info('[WebSocket] Subscribed to job', {
        socketId: socket.id,
        jobId,
      });

      // Monitor job completion
      this.setupJobCompletionListener(jobId, socket);

    } catch (error) {
      this.logger.error('[WebSocket] Subscription error', {
        jobId,
        error: error instanceof Error ? error.message : String(error),
      });
      socket.emit('error', { message: 'Subscription failed' });
      socket.disconnect(true);
    }
  }

  private handleDisconnect(socket: Socket): void {
    // Remove from all jobs
    for (const [jobId, socketIds] of this.jobConnections.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          this.jobConnections.delete(jobId);
        }
      }
    }

    this.logger.info('[WebSocket] Client disconnected', { socketId: socket.id });
  }

  private setupJobCompletionListener(jobId: string, socket: Socket): void {
    const checkCompletion = async () => {
      try {
        const job = await this.queue.getJob(jobId);
        if (!job) return;

        const state = await job.getState();

        if (state === 'completed' || state === 'failed') {
          const result = await job.result();
          socket.emit(
            state === 'completed' ? 'completed' : 'failed',
            result || { success: false },
          );
          socket.disconnect(true);

          this.logger.info('[WebSocket] Job finalized, disconnecting', {
            jobId,
            socketId: socket.id,
            state,
          });
          return;
        }

        // Check again in 2 seconds
        setTimeout(checkCompletion, 2000);

      } catch (error) {
        this.logger.error('[WebSocket] Completion check error', {
          jobId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    };

    checkCompletion();
  }

  // Called by worker to emit progress to all connected clients
  emitProgress(jobId: string, progress: ProgressEvent): void {
    this.io.to(`job:${jobId}`).emit('progress', progress);
    this.logger.debug('[WebSocket] Progress emitted', { jobId, percent: progress.percent });
  }

  // Called by worker when job completes
  emitCompleted(jobId: string, result: Record<string, any>): void {
    this.io.to(`job:${jobId}`).emit('completed', result);
    this.io.socketsLeave(`job:${jobId}`);
    this.jobConnections.delete(jobId);

    this.logger.info('[WebSocket] Job completed event emitted', { jobId });
  }

  // Called by worker when job fails
  emitError(jobId: string, error: Error | string): void {
    const message = error instanceof Error ? error.message : String(error);
    this.io.to(`job:${jobId}`).emit('error', { message });
    this.io.socketsLeave(`job:${jobId}`);
    this.jobConnections.delete(jobId);

    this.logger.error('[WebSocket] Job error event emitted', { jobId, message });
  }

  // Get connected clients count for a job
  getConnectedClientsCount(jobId: string): number {
    return this.jobConnections.get(jobId)?.size || 0;
  }

  // Get metrics
  getMetrics(): {
    totalConnected: number;
    activeJobs: number;
  } {
    return {
      totalConnected: this.io.engine.clientsCount,
      activeJobs: this.jobConnections.size,
    };
  }

  // Cleanup
  async close(): Promise<void> {
    this.io.close();
    this.logger.info('[WebSocket] Server closed');
  }
}

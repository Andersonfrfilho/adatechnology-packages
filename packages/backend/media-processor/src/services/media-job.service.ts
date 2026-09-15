// Media Job Service - Manages job lifecycle

import { MediaJob, MediaJobInput, MediaJobStatus, ProgressEvent, ProcessingStage } from '../types/index.js';
import { Queue, Job } from 'bullmq';
import { RedisConnection } from 'bullmq';
import { QUEUE_CONFIG, PROCESSING_STAGES } from '../constants/index.js';
import { JobNotFoundError, InvalidJobStatusError } from '../errors/index.js';
import { Logger } from '@adatechnology/logger';

interface JobRepository {
  create(job: MediaJob): Promise<MediaJob>;
  getById(jobId: string): Promise<MediaJob | null>;
  update(jobId: string, partial: Partial<MediaJob>): Promise<MediaJob>;
  delete(jobId: string): Promise<void>;
}

export class MediaJobService {
  private queue: Queue;
  private logger: Logger;

  constructor(
    private redisConnection: RedisConnection,
    private repository: JobRepository,
    logger: Logger,
  ) {
    this.logger = logger;
    this.queue = new Queue(QUEUE_CONFIG.QUEUE_NAME, { connection: redisConnection });
  }

  async createJob(input: MediaJobInput, userId: string): Promise<MediaJob> {
    const job: MediaJob = {
      id: crypto.randomUUID(),
      videoUrl: input.videoUrl,
      outputType: input.outputType,
      status: 'pending',
      detectedLanguage: '',
      detectedLanguageConfidence: 0,
      isLanguageConfirmed: false,
      targetLanguages: input.targetLanguages || [],
      subtitleFormat: input.subtitleFormat || 'srt',
      subtitleBurned: input.subtitleBurned ?? false,
      dubbingVoiceId: input.dubbingVoiceId,
      currentStage: null,
      progressPercent: 0,
      progressMessage: 'Aguardando processamento...',
      progressEtaSeconds: null,
      createdAt: new Date(),
      startedAt: null,
      completedAt: null,
      errorMessage: null,
      retryCount: 0,
      lastRetryAt: null,
      estimatedDurationSeconds: null,
      actualDurationSeconds: null,
    };

    // Save to repository
    const savedJob = await this.repository.create(job);

    // Enqueue to BullMQ
    await this.queue.add(QUEUE_CONFIG.QUEUE_NAME, {
      jobId: job.id,
      ...input,
    }, {
      jobId: job.id,
      attempts: QUEUE_CONFIG.MAX_RETRY_ATTEMPTS,
      backoff: {
        type: 'exponential',
        delay: 1000 * 60, // 1 minute initial
      },
    });

    this.logger.info('[MediaJobService] Job created', {
      jobId: job.id,
      userId,
      outputType: input.outputType,
    });

    return savedJob;
  }

  async getJob(jobId: string): Promise<MediaJob> {
    const job = await this.repository.getById(jobId);
    if (!job) {
      throw new JobNotFoundError(jobId);
    }
    return job;
  }

  async updateProgress(
    jobId: string,
    stage: ProcessingStage,
    percent: number,
    message: string,
    eta?: number,
  ): Promise<void> {
    const job = await this.getJob(jobId);

    if (job.status !== 'processing') {
      throw new InvalidJobStatusError(jobId, job.status, 'processing');
    }

    await this.repository.update(jobId, {
      currentStage: stage,
      progressPercent: percent,
      progressMessage: message,
      progressEtaSeconds: eta,
    });

    this.logger.debug('[MediaJobService] Progress updated', {
      jobId,
      stage,
      percent,
      eta,
    });
  }

  async markStarted(jobId: string): Promise<void> {
    await this.repository.update(jobId, {
      status: 'processing' as MediaJobStatus,
      startedAt: new Date(),
      progressMessage: 'Iniciando processamento...',
    });

    this.logger.info('[MediaJobService] Job started', { jobId });
  }

  async markCompleted(jobId: string, result: Record<string, any>): Promise<void> {
    const job = await this.getJob(jobId);

    const duration = job.startedAt
      ? Math.round((Date.now() - job.startedAt.getTime()) / 1000)
      : undefined;

    await this.repository.update(jobId, {
      status: 'completed' as MediaJobStatus,
      completedAt: new Date(),
      progressPercent: 100,
      progressMessage: 'Concluído com sucesso!',
      actualDurationSeconds: duration,
    });

    this.logger.info('[MediaJobService] Job completed', {
      jobId,
      duration,
      result,
    });
  }

  async markFailed(jobId: string, error: Error, retryCount: number): Promise<void> {
    const shouldRetry = retryCount < QUEUE_CONFIG.MAX_RETRY_ATTEMPTS;

    await this.repository.update(jobId, {
      status: (shouldRetry ? 'pending' : 'failed') as MediaJobStatus,
      errorMessage: error.message,
      retryCount,
      lastRetryAt: new Date(),
    });

    this.logger.error('[MediaJobService] Job failed', {
      jobId,
      error: error.message,
      retryCount,
      shouldRetry,
    });
  }

  async getJobsByStatus(status: MediaJobStatus, limit = 100): Promise<MediaJob[]> {
    // Implement based on your repository
    return [];
  }

  async getJobMetrics(): Promise<{
    totalPending: number;
    totalProcessing: number;
    totalCompleted: number;
    totalFailed: number;
    averageProcessingTime: number;
  }> {
    const queueMetrics = await this.queue.getMetrics('count');

    return {
      totalPending: queueMetrics.count || 0,
      totalProcessing: queueMetrics.active || 0,
      totalCompleted: queueMetrics.completed || 0,
      totalFailed: queueMetrics.failed || 0,
      averageProcessingTime: 0, // Implement from repository
    };
  }

  async cleanup(): Promise<void> {
    await this.queue.close();
  }
}

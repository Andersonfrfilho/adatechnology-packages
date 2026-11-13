// Example Worker - Dubbing/Subtitle Processing Pipeline

import { Worker, Job, ConnectionOptions } from 'bullmq'
import { MediaJobService } from '../services/media-job.service.js'
import { WebSocketService } from '../services/websocket.service.js'
import { SubtitleService } from '../services/subtitle.service.js'
import {
  QUEUE_CONFIG,
  PROCESSING_STAGES,
  STAGE_LABELS,
  STAGE_PROGRESS,
  STAGE_DURATION_SECONDS,
} from '../constants/index.js'
import { MediaJobInput, ProgressEvent, ProcessingStage } from '../types/index.js'
import { Logger } from '@adatechnology/logger'

interface JobData extends MediaJobInput {
  jobId: string
}

/**
 * Example worker setup - In production, this would be in a separate worker service
 */
export async function setupDubbingWorker(
  redisConnection: ConnectionOptions,
  jobService: MediaJobService,
  wsService: WebSocketService,
  subtitleService: SubtitleService,
  logger: Logger,
): Promise<Worker> {
  const worker = new Worker<JobData>(
    QUEUE_CONFIG.QUEUE_NAME,
    async (job: Job<JobData>) => {
      const { jobId, outputType, targetLanguages } = job.data

      try {
        // Mark job as started
        await jobService.markStarted(jobId)

        // =============== STAGE 1: EXTRACT AUDIO ===============
        await processStage(
          jobId,
          PROCESSING_STAGES.EXTRACTING,
          async () => {
            logger.info('[Worker] Extracting audio', { jobId })
            // In production: extract audio with FFmpeg
            // const audioPath = await extractAudioWithFFmpeg(videoUrl);
            await new Promise((r) => setTimeout(r, 1000)) // Simulate
            return { audioPath: '/tmp/audio.wav' }
          },
          job,
          jobService,
          wsService,
          logger,
        )

        // =============== STAGE 2: TRANSCRIBE ===============
        const transcriptData = await processStage(
          jobId,
          PROCESSING_STAGES.TRANSCRIBING,
          async () => {
            logger.info('[Worker] Transcribing audio', { jobId })
            // In production: use Whisper API
            // const transcript = await whisperService.transcribe(audioPath);
            await new Promise((r) => setTimeout(r, 2000)) // Simulate
            return {
              transcript: [
                { startTime: 0.5, endTime: 2.1, text: 'Olá, como você está?' },
                { startTime: 2.5, endTime: 4.8, text: 'Tudo bem?' },
              ],
              detectedLanguage: 'pt',
              confidence: 0.95,
            }
          },
          job,
          jobService,
          wsService,
          logger,
        )

        // =============== STAGE 3: TRANSLATE (if needed) ===============
        const translatedSegments = transcriptData.transcript

        if (outputType === 'subtitles' && targetLanguages.includes('en')) {
          await processStage(
            jobId,
            PROCESSING_STAGES.TRANSLATING,
            async () => {
              logger.info('[Worker] Translating segments', { jobId, targetLanguages })
              // In production: call OpenAI/Claude translation
              // translatedSegments = await translateService.translate(transcript, targetLanguages);
              await new Promise((r) => setTimeout(r, 1000)) // Simulate
              return { translatedSegments }
            },
            job,
            jobService,
            wsService,
            logger,
          )
        }

        // =============== STAGE 4: GENERATE (TTS or Subtitles) ===============
        if (outputType === 'dub') {
          await processStage(
            jobId,
            PROCESSING_STAGES.GENERATING,
            async () => {
              logger.info('[Worker] Generating dubbed audio', { jobId })
              // In production: call ElevenLabs TTS
              // const dubbedAudio = await ttsService.generate(translatedSegments);
              await new Promise((r) => setTimeout(r, 3000)) // Simulate
              return { dubbedAudioPath: '/tmp/dubbed.wav' }
            },
            job,
            jobService,
            wsService,
            logger,
          )

          // =============== STAGE 5: ALIGN TIMING ===============
          await processStage(
            jobId,
            PROCESSING_STAGES.ALIGNING,
            async () => {
              logger.info('[Worker] Aligning audio timing', { jobId })
              // In production: use librosa for time-stretching
              // const alignedAudio = await alignmentService.alignTimings(dubbedAudio, originalSegments);
              await new Promise((r) => setTimeout(r, 1000)) // Simulate
              return { alignedAudioPath: '/tmp/aligned.wav' }
            },
            job,
            jobService,
            wsService,
            logger,
          )

          // =============== STAGE 6: REMUX VIDEO ===============
          await processStage(
            jobId,
            PROCESSING_STAGES.REMUXING,
            async () => {
              logger.info('[Worker] Remuxing video', { jobId })
              // In production: use FFmpeg to replace audio
              // const finalVideo = await remuxService.remux(videoUrl, alignedAudioPath);
              // const uploadedUrl = await storageService.upload(finalVideo);
              await new Promise((r) => setTimeout(r, 2000)) // Simulate
              return { videoUrl: 's3://bucket/output.mp4' }
            },
            job,
            jobService,
            wsService,
            logger,
          )
        } else {
          // SUBTITLES PATH
          await processStage(
            jobId,
            PROCESSING_STAGES.GENERATING,
            async () => {
              logger.info('[Worker] Generating subtitles', { jobId })

              // Generate SRT for each language
              const subtitles: Record<string, string> = {}
              for (const lang of targetLanguages) {
                subtitles[lang] = subtitleService.generateSRT(
                  translatedSegments.map((seg: any) => ({
                    id: crypto.randomUUID(),
                    jobId,
                    sequenceNumber: 0,
                    startTime: seg.startTime,
                    endTime: seg.endTime,
                    originalText: seg.text,
                  })),
                )
              }

              // In production: upload to S3
              // const uploadedUrls = await storageService.uploadSubtitles(subtitles);
              await new Promise((r) => setTimeout(r, 1000)) // Simulate

              return {
                subtitles,
                subtitleUrls: Object.fromEntries(
                  Object.entries(subtitles).map(([lang]) => [lang, `s3://bucket/subtitles/${lang}.srt`]),
                ),
              }
            },
            job,
            jobService,
            wsService,
            logger,
          )

          // For subtitles, remuxing is optional (burn into video)
          if (job.data.subtitleBurned) {
            await processStage(
              jobId,
              PROCESSING_STAGES.REMUXING,
              async () => {
                logger.info('[Worker] Burning subtitles into video', { jobId })
                // In production: use FFmpeg to burn subtitles
                // const burnedVideo = await remuxService.burnSubtitles(videoUrl, subtitlePath);
                await new Promise((r) => setTimeout(r, 2000)) // Simulate
                return { videoUrl: 's3://bucket/output-burned.mp4' }
              },
              job,
              jobService,
              wsService,
              logger,
            )
          }
        }

        // Mark as completed
        await jobService.markCompleted(jobId, {
          success: true,
          outputType,
          duration: job.finishedOn ? job.finishedOn - job.processedOn! : 0,
        })

        wsService.emitCompleted(jobId, {
          success: true,
          outputType,
        })

        return { success: true }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error))
        const retryCount = job.attemptsMade || 0

        await jobService.markFailed(jobId, err, retryCount)
        wsService.emitError(jobId, err)

        logger.error('[Worker] Job failed', {
          jobId,
          error: err.message,
          retryCount,
        })

        throw err
      }
    },
    {
      connection: redisConnection,
      concurrency: QUEUE_CONFIG.CONCURRENCY,
      stalledInterval: QUEUE_CONFIG.STALLED_INTERVAL,
      maxStalledCount: QUEUE_CONFIG.STALLED_COUNT,
    },
  )

  worker.on('completed', (job: Job) => {
    logger.info('[Worker] Job completed', { jobId: job.id })
  })

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error('[Worker] Job failed', {
      jobId: job?.id,
      error: err.message,
    })
  })

  return worker
}

/**
 * Helper to process a stage with progress updates
 */
async function processStage(
  jobId: string,
  stage: ProcessingStage,
  processFn: () => Promise<any>,
  job: Job,
  jobService: MediaJobService,
  wsService: WebSocketService,
  logger: Logger,
): Promise<any> {
  const label = STAGE_LABELS[stage]
  const percent = STAGE_PROGRESS[stage]
  const duration = STAGE_DURATION_SECONDS[stage]

  try {
    // Update job progress
    await jobService.updateProgress(jobId, stage, percent, label, duration)

    // Emit via WebSocket
    const progress: ProgressEvent = {
      stage,
      percent,
      message: label,
      eta: duration,
    }
    wsService.emitProgress(jobId, progress)

    // Update BullMQ job progress
    job.updateProgress(percent)

    logger.info('[Worker] Stage started', { jobId, stage, label })

    // Execute the actual processing
    const result = await processFn()

    logger.info('[Worker] Stage completed', { jobId, stage })
    return result
  } catch (error) {
    logger.error('[Worker] Stage failed', {
      jobId,
      stage,
      error: error instanceof Error ? error.message : String(error),
    })
    throw error
  }
}

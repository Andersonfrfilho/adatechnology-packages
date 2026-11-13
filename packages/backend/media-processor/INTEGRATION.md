# Integration Guide

## Step-by-Step Integration

### 1. Add to your API project

```bash
bun add @adatechnology/media-processor
```

### 2. Create API endpoints

Create `src/modules/media/media.controller.ts`:

```typescript
import { Router } from 'express';
import { MediaJobService } from '@adatechnology/media-processor';

export function createMediaRouter(jobService: MediaJobService) {
  const router = Router();

  // Create new media processing job
  router.post('/', async (req, res, next) => {
    try {
      const { videoUrl, outputType, targetLanguages, subtitleFormat, subtitleBurned } = req.body;

      const job = await jobService.createJob({
        videoUrl,
        outputType,
        targetLanguages,
        subtitleFormat,
        subtitleBurned,
      }, req.user.id);

      // Return 202 Accepted - job is queued, not waiting for result
      res.status(202).json({
        jobId: job.id,
        status: job.status,
        _links: {
          self: `/api/media/job/${job.id}`,
          status: `/api/media/job/${job.id}/status`,
          stream: `/api/media/job/${job.id}/stream`,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  // Get job status
  router.get('/:jobId/status', async (req, res, next) => {
    try {
      const job = await jobService.getJob(req.params.jobId);

      res.json({
        id: job.id,
        status: job.status,
        stage: job.currentStage,
        percent: job.progressPercent,
        message: job.progressMessage,
        eta: job.progressEtaSeconds,
        createdAt: job.createdAt,
        completedAt: job.completedAt,
      });
    } catch (error) {
      next(error);
    }
  });

  // SSE stream (alternative to WebSocket for simple cases)
  router.get('/:jobId/stream', (req, res) => {
    const jobId = req.params.jobId;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // In production: listen to job events and stream them
    const sendUpdate = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const sendError = (error: any) => {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify(error)}\n\n`);
    };

    res.on('close', () => {
      // Cleanup listeners
    });
  });

  return router;
}

// In your main app setup:
const mediaRouter = createMediaRouter(jobService);
app.use('/api/media', mediaRouter);
```

### 3. Setup WebSocket handler

Create `src/infra/websocket/index.ts`:

```typescript
import { Server as HttpServer } from 'http';
import { WebSocketService } from '@adatechnology/media-processor';
import { dubbingQueue } from '@/infra/queues';
import { logger } from '@/infra/logger';

export function initializeWebSocket(httpServer: HttpServer): WebSocketService {
  const wsService = new WebSocketService(httpServer, dubbingQueue, logger);
  return wsService;
}

// Make accessible to workers
export let wsServiceInstance: WebSocketService;

export function setWebSocketService(ws: WebSocketService) {
  wsServiceInstance = ws;
}
```

### 4. Setup worker

Create `apps/worker-media/src/index.ts`:

```typescript
import { setupDubbingWorker } from '@adatechnology/media-processor/workers';
import { redis } from '@/infra/redis';
import { jobService } from '@/services/media-job.service';
import { wsServiceInstance } from '@/infra/websocket';
import { subtitleService } from '@/services/subtitle.service';
import { logger } from '@/infra/logger';

async function startWorker() {
  const worker = await setupDubbingWorker(
    redis,
    jobService,
    wsServiceInstance,
    subtitleService,
    logger,
  );

  logger.info('Media processing worker started');

  process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, gracefully shutting down...');
    await worker.close();
    process.exit(0);
  });
}

startWorker().catch((err) => {
  logger.error('Worker startup failed', err);
  process.exit(1);
});
```

### 5. Database migrations

Create migration file (e.g., `2024-09-15-create-media-tables.sql`):

```sql
CREATE TABLE media_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Input
  video_url VARCHAR NOT NULL,
  output_type VARCHAR NOT NULL CHECK (output_type IN ('dub', 'subtitles')),
  
  -- Language detection
  detected_language VARCHAR(5),
  detected_language_confidence DECIMAL(3, 2),
  is_language_confirmed BOOLEAN DEFAULT false,
  
  -- Subtitles specific
  target_languages VARCHAR[] DEFAULT '{}',
  subtitle_format VARCHAR,
  subtitle_burned BOOLEAN DEFAULT false,
  
  -- Dubbing specific
  dubbing_voice_id VARCHAR,
  
  -- Status tracking
  status VARCHAR NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  current_stage VARCHAR,
  progress_percent INT DEFAULT 0,
  progress_message VARCHAR,
  progress_eta_seconds INT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message VARCHAR,
  retry_count INT DEFAULT 0,
  last_retry_at TIMESTAMPTZ,
  
  -- Metadata
  estimated_duration_seconds INT,
  actual_duration_seconds INT,
  
  -- Audit
  created_by UUID NOT NULL,
  INDEX idx_status (status),
  INDEX idx_created_at (created_at),
  INDEX idx_created_by (created_by)
);

CREATE TABLE subtitles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,
  
  language VARCHAR(5) NOT NULL,
  format VARCHAR(3) NOT NULL CHECK (format IN ('srt', 'vtt')),
  
  srt_url VARCHAR NOT NULL,
  translated_segments JSONB,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_job_id (job_id),
  INDEX idx_language (language)
);

CREATE TABLE job_progress_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES media_jobs(id) ON DELETE CASCADE,
  
  stage VARCHAR,
  percent INT,
  message VARCHAR,
  eta_seconds INT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_job_id (job_id),
  INDEX idx_created_at (created_at)
);
```

### 6. Frontend React component

Create `src/components/MediaJobProgress.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

interface MediaJobProgressProps {
  jobId: string;
  onComplete?: (result: any) => void;
  onError?: (error: any) => void;
}

export function MediaJobProgress({
  jobId,
  onComplete,
  onError,
}: MediaJobProgressProps) {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('pending');
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  // Check initial status and setup polling/WebSocket
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/media/job/${jobId}/status`);
        const data = await res.json();
        setStatus(data.status);

        if (data.status === 'processing' && !socket?.connected) {
          connectWebSocket();
        } else if (data.status === 'completed') {
          onComplete?.(data);
        } else if (data.status === 'failed') {
          onError?.(new Error(data.error_message));
        }
      } catch (error) {
        console.error('Status check failed:', error);
      }
    };

    checkStatus();

    // Poll every 2 seconds while pending
    if (status === 'pending') {
      pollInterval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [jobId, status, socket?.connected, onComplete, onError]);

  const connectWebSocket = () => {
    const newSocket = io(process.env.REACT_APP_API_URL || 'http://localhost:3000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5,
    });

    newSocket.on('connect', () => {
      console.log('✅ WebSocket connected');
      setIsConnected(true);
      newSocket.emit('subscribe', { jobId });
    });

    newSocket.on('progress', (data) => {
      console.log('📊 Progress:', data);
      setProgress(data);
    });

    newSocket.on('completed', (result) => {
      console.log('✅ Completed:', result);
      setStatus('completed');
      onComplete?.(result);
      newSocket.disconnect();
    });

    newSocket.on('error', (error) => {
      console.error('❌ Error:', error);
      newSocket.disconnect();
      setIsConnected(false);

      if (error.message.includes('not processing')) {
        setStatus('pending');
      } else {
        onError?.(new Error(error.message));
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    setSocket(newSocket);
  };

  return (
    <div className="media-job-progress">
      <h2>{status}</h2>
      {isConnected && <span className="live-indicator">● LIVE</span>}

      {progress && (
        <div className="progress-card">
          <h3>{progress.message}</h3>
          <progress value={progress.percent} max="100" />
          <span>{progress.percent}%</span>

          {progress.eta && (
            <p>ETA: {Math.ceil(progress.eta / 60)}min</p>
          )}
        </div>
      )}

      {status === 'completed' && (
        <div className="success">✅ Job completed!</div>
      )}

      {status === 'failed' && (
        <div className="error">❌ Job failed</div>
      )}
    </div>
  );
}
```

## Testing

```bash
# Start Redis
docker run -p 6379:6379 redis

# Run worker
bun run dev:worker

# Test API
curl -X POST http://localhost:3000/api/media \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "s3://bucket/video.mp4",
    "outputType": "subtitles",
    "targetLanguages": ["pt-BR", "en"],
    "subtitleFormat": "srt"
  }'

# Check status
curl http://localhost:3000/api/media/job/{jobId}/status
```

## Troubleshooting

### Job stuck in "pending"

- Check Redis connection
- Check if worker process is running
- Check worker logs for errors

### WebSocket not connecting

- Check if frontend URL is correct in WebSocket config
- Check CORS settings
- Verify job status is "processing"

### No progress updates

- Check Redis connection
- Check if WebSocket is subscribed (emit 'subscribe' event)
- Check worker logs for progress updates

### High memory usage

- Check for large file temp storage
- Enable cleanup of temp files
- Reduce concurrent jobs

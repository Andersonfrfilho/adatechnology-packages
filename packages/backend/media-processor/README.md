# @adatechnology/media-processor

Video dubbing and subtitle generation service with real-time WebSocket progress tracking.

## Features

✅ **Non-blocking job processing** — HTTP returns 202 Accepted, processing happens asynchronously  
✅ **Real-time WebSocket updates** — Only connects during active processing, auto-disconnects when done  
✅ **Dual output modes** — Dubbing (audio) or Subtitles (SRT/VTT)  
✅ **Multi-language support** — Translate and generate for any language  
✅ **Automatic language detection** — Whisper + fallback language detection  
✅ **Distributed queue** — BullMQ with Redis for horizontal scaling  
✅ **Auto-recovery** — Exponential backoff retries, circuit breakers  
✅ **Resource isolation** — CPU/Memory limits per worker  

## Architecture

### Pipeline Stages

```
Extract Audio → Transcribe → Translate → Generate → Align Timing → Remux Video
   5%            30%          50%         70%          85%           95%
```

### Job Lifecycle

```
pending (polling)
   ↓
processing (WebSocket real-time)
   ↓
completed/failed (auto-disconnect)
```

## Installation

```bash
bun add @adatechnology/media-processor
```

## Usage

### 1. Backend Setup

```typescript
import { MediaJobService, WebSocketService, SubtitleService } from '@adatechnology/media-processor';
import { createServer } from 'http';
import Redis from 'ioredis';

const redis = new Redis();
const httpServer = createServer(app);

// Initialize services
const jobService = new MediaJobService(redis, repository, logger);
const wsService = new WebSocketService(httpServer, queue, logger);
const subtitleService = new SubtitleService(logger);

// Setup worker
import { setupDubbingWorker } from '@adatechnology/media-processor/workers';
await setupDubbingWorker(redis, jobService, wsService, subtitleService, logger);
```

### 2. API Endpoint

```typescript
// POST /api/media
app.post('/api/media', async (req, res) => {
  const input = {
    videoUrl: 's3://bucket/video.mp4',
    outputType: 'subtitles', // 'dub' | 'subtitles'
    targetLanguages: ['pt-BR', 'es', 'en'],
    subtitleFormat: 'srt',
    subtitleBurned: false,
  };

  const job = await jobService.createJob(input, userId);

  // Return 202 Accepted (non-blocking)
  return res.status(202).json({
    jobId: job.id,
    status: job.status,
    _links: {
      self: `/api/job/${job.id}`,
      stream: `/api/job/${job.id}/stream`, // SSE
    },
  });
});

// GET /api/job/:jobId/status
app.get('/api/job/:jobId/status', async (req, res) => {
  const job = await jobService.getJob(req.params.jobId);
  return res.json({
    id: job.id,
    status: job.status,
    stage: job.currentStage,
    percent: job.progressPercent,
    message: job.progressMessage,
  });
});
```

### 3. Frontend - Conditional WebSocket

```typescript
import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

export function JobProgress({ jobId }) {
  const [progress, setProgress] = useState(null);
  const [status, setStatus] = useState('pending');
  const [socket, setSocket] = useState(null);

  // 1️⃣ Check initial status
  useEffect(() => {
    async function checkStatus() {
      const res = await fetch(`/api/job/${jobId}/status`);
      const data = await res.json();
      setStatus(data.status);

      if (data.status === 'processing') {
        connectWebSocket();
      } else if (data.status === 'pending') {
        pollUntilProcessing();
      }
    }

    checkStatus();
  }, [jobId]);

  // 2️⃣ Poll while pending (no WebSocket)
  function pollUntilProcessing() {
    const interval = setInterval(async () => {
      const res = await fetch(`/api/job/${jobId}/status`);
      const data = await res.json();

      if (data.status === 'processing') {
        clearInterval(interval);
        setStatus('processing');
        connectWebSocket();
      }
    }, 2000);

    return () => clearInterval(interval);
  }

  // 3️⃣ Connect WebSocket only when processing
  function connectWebSocket() {
    const newSocket = io('http://localhost:3000', {
      transports: ['websocket'],
    });

    newSocket.on('connect', () => {
      newSocket.emit('subscribe', { jobId });
    });

    newSocket.on('progress', (data) => {
      setProgress(data);
    });

    newSocket.on('completed', (result) => {
      setStatus('completed');
      setProgress({ stage: 'completed', percent: 100, message: 'Done!' });
      newSocket.disconnect();
    });

    newSocket.on('error', (error) => {
      if (error.message.includes('not processing')) {
        setStatus('pending');
        pollUntilProcessing();
      }
      newSocket.disconnect();
    });

    setSocket(newSocket);
  }

  return (
    <div>
      <h2>{status}</h2>
      {progress && (
        <div>
          <p>{progress.message}</p>
          <progress value={progress.percent} max="100" />
          <span>{progress.percent}%</span>
        </div>
      )}
    </div>
  );
}
```

## Database Schema

```sql
CREATE TABLE media_jobs (
  id UUID PRIMARY KEY,
  output_type VARCHAR CHECK (output_type IN ('dub', 'subtitles')),
  status VARCHAR CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  detected_language VARCHAR(5),
  detected_language_confidence DECIMAL(3,2),
  current_stage VARCHAR,
  progress_percent INT,
  progress_message VARCHAR,
  progress_eta_seconds INT,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message VARCHAR,
  retry_count INT DEFAULT 0
);

CREATE TABLE subtitles (
  id UUID PRIMARY KEY,
  job_id UUID REFERENCES media_jobs(id),
  language VARCHAR(5),
  format VARCHAR(3),
  srt_url VARCHAR,
  created_at TIMESTAMPTZ
);
```

## Configuration

### Environment Variables

```env
# Redis
REDIS_URL=redis://localhost:6379

# WebSocket
WEBSOCKET_PING_INTERVAL=25000
WEBSOCKET_PING_TIMEOUT=60000

# Processing
MEDIA_PROCESSOR_CONCURRENCY=1
MEDIA_PROCESSOR_MAX_RETRIES=3
MEDIA_PROCESSOR_JOB_TIMEOUT_MS=1800000

# API
ELEVENLABS_API_KEY=sk-...
OPENAI_API_KEY=sk-...
S3_BUCKET=my-bucket
S3_REGION=us-east-1

# Frontend
FRONTEND_URL=http://localhost:3000
```

### Rate Limits

- **Whisper**: 3 req/min
- **ElevenLabs**: 3 req/min
- **OpenAI**: 5 req/min

Limits are enforced with local queues to prevent service overload.

## Performance

### Costs

- **Pending (HTTP polling)**: ~10 requests per 2 seconds = negligible bandwidth
- **Processing (WebSocket)**: 1 TCP connection + events = ~1KB/min
- **Savings**: ~80% compared to continuous polling

### Timeouts

- Whisper: 60s
- ElevenLabs TTS: 120s
- S3 Upload: 300s
- Retry backoff: 1min, 2min, 4min (exponential)

### Resource Limits

- Worker CPU: 2 cores max
- Worker Memory: 2GB max
- Job timeout: 30 minutes
- Auto-scaling: 2-10 workers based on queue depth

## Error Handling

All errors follow the pattern:

```typescript
{
  code: 'ERROR_TYPE',
  message: 'Human readable message',
  details: { context... }
}
```

### Circuit Breaker

If an external service (Whisper, ElevenLabs) fails:
1. Service goes offline
2. Queue jobs locally
3. Retry after 30 seconds
4. Auto-recover when service is back

### Auto-Recovery

- **OOM Kill**: Worker restarts, job re-queued
- **Timeout**: Job moved to DLQ, manual review
- **Network Error**: Exponential backoff retry
- **Rate Limit**: Queue locally, retry after delay

## Development

```bash
# Build
bun run build

# Type check
bun run type-check

# Test
bun test

# Watch
bun run dev
```

## License

Proprietary - Ada Technology

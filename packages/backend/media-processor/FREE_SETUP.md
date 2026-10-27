# 🎉 100% Free Media Processor Setup

Complete guide to running video dubbing and subtitle generation **with zero paid APIs**.

## 📋 Components Used (All Free & Open-Source)

| Component | Purpose | Cost | Setup Time |
|-----------|---------|------|-----------|
| **Redis** | Job queue | Free | 1 min (Docker) |
| **PostgreSQL** | Metadata storage | Free | 1 min (Docker) |
| **LibreTranslate** | Translation | Free | 1 min (Docker) |
| **Piper TTS** | Text-to-speech | Free | 5 min |
| **Whisper (Groq)** | Transcription | Free (240/day) | 2 min |
| **Whisper.cpp** | Transcription (alt) | Free (unlimited) | 15 min |
| **FFmpeg** | Audio/video processing | Free | 2 min |

**Total Setup Time: ~30 minutes** | **Total Cost: $0**

---

## 🚀 Quick Start (5 minutes)

### Step 1: Get Groq API Key (Free)

Visit https://console.groq.com:
1. Create free account
2. Copy API key (looks like `gsk_xxxxx`)
3. Set environment variable:

```bash
export GROQ_API_KEY=gsk_xxxxx
```

### Step 2: Start Services (Docker)

```bash
cd /path/to/adatechnology-packages

# Start all free services
docker-compose -f docker-compose.free-media-stack.yml up -d

# Wait ~30 seconds for services to start
docker-compose ps

# Check if all are "healthy"
```

### Step 3: Test It

```bash
# Create a job
curl -X POST http://localhost:3000/api/media \
  -H "Content-Type: application/json" \
  -d '{
    "videoUrl": "s3://bucket/video.mp4",
    "outputType": "subtitles",
    "targetLanguages": ["pt-BR", "en"],
    "subtitleFormat": "srt"
  }'

# Response: { "jobId": "abc123", "status": "pending" }

# Check status
curl http://localhost:3000/api/job/abc123/status
```

---

## 📦 Detailed Setup

### Prerequisites

- **Docker + Docker Compose** (easiest, no Python/Node install needed)
- **Git** (to clone repo)
- **4GB RAM minimum** (8GB recommended)
- **Internet** (for first download of models)

### Option A: Full Docker Stack (Recommended)

```bash
# 1. Navigate to repo
cd adatechnology-packages

# 2. Set Groq key
export GROQ_API_KEY=gsk_xxxxx

# 3. Start stack
docker-compose -f docker-compose.free-media-stack.yml up -d

# 4. Check services
docker-compose logs -f

# 5. Stop when done
docker-compose -f docker-compose.free-media-stack.yml down
```

**What starts:**
- ✅ Redis (job queue)
- ✅ PostgreSQL (database)
- ✅ LibreTranslate (translation)
- ✅ App (API + workers)
- ✅ Frontend (optional)

### Option B: Local Development

**Prerequisites:**
```bash
# Install Node.js
brew install node  # Mac
# or download from nodejs.org

# Install dependencies
bun install

# Install Piper TTS
pip install piper-tts

# Or if using Whisper.cpp
git clone https://github.com/ggerganov/whisper.cpp
cd whisper.cpp && make
```

**Start Redis + PostgreSQL (Docker):**
```bash
docker run -p 6379:6379 redis:7-alpine
docker run -p 5432:5432 -e POSTGRES_PASSWORD=password postgres:16-alpine
```

**Start LibreTranslate:**
```bash
docker run -p 5000:5000 libretranslate/libretranslate
```

**Start App:**
```bash
bun run dev
```

---

## 🔧 Configuration

### Environment Variables

Create `.env.local`:

```env
# Required
GROQ_API_KEY=gsk_xxxxx  # Free from https://console.groq.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/media_processor

# Redis
REDIS_URL=redis://localhost:6379

# Translation
LIBRETRANSLATE_URL=http://localhost:5000

# TTS
TTS_PROVIDER=piper
PIPER_BINARY=piper

# Storage (use local for testing)
STORAGE_TYPE=local
STORAGE_LOCAL_PATH=./storage
```

### Transcription Options

#### Option 1: Groq (Recommended - No Setup)
- **Limit**: 240 requests/day (free)
- **Speed**: 0.5 seconds per minute of audio
- **Setup**: Just need API key
- **Cost**: Free forever

```env
TRANSCRIPTION_PROVIDER=groq
GROQ_API_KEY=gsk_xxxxx
```

#### Option 2: Whisper.cpp (Unlimited - Requires Setup)
- **Limit**: None (unlimited)
- **Speed**: 15-30 seconds per minute (CPU), 1-2 seconds (GPU)
- **Setup**: 15 minutes to compile
- **Cost**: Free forever

```bash
# Download model (~1.5GB)
cd whisper.cpp
./models/download-ggml-model.sh base

# Start server
./server -m models/ggml-base.bin

# Set env var
export WHISPER_URL=http://localhost:8000
export TRANSCRIPTION_PROVIDER=whisper_local
```

---

## 💻 Supported Features

### Translation Languages
- Portuguese (Brasil)
- Spanish
- English
- French
- Italian
- German
- Russian
- Japanese
- Chinese
- Korean

(30+ more available - enable in LibreTranslate config)

### TTS Languages (Piper)
- Portuguese (Brazil) - High quality ⭐
- Spanish - High quality ⭐
- English (US) - High quality ⭐
- French - Medium quality
- Italian - Low quality

(20+ more available on Hugging Face)

### Output Formats
- **SRT subtitles** (most compatible)
- **VTT subtitles** (HTML5 video)
- **Dubbed video** (WAV audio + remux)
- **Burned subtitles** (permanently embedded)

---

## 📊 Performance

### Costs Per Video

| Step | Time | Cost |
|------|------|------|
| Extract | 10s | $0 |
| Transcribe | 60s (groq) / 300s (local) | $0 |
| Translate | 30s | $0 |
| TTS | 180s (cpu) | $0 |
| Align | 30s | $0 |
| Remux | 60s | $0 |
| **Total** | **~8-10 min** | **$0** |

### System Requirements

**Minimum:**
- 2 CPU cores
- 4GB RAM
- 50GB storage

**Recommended:**
- 4+ CPU cores
- 8GB+ RAM
- 200GB+ storage (for models + temp files)

**Optimal (with GPU):**
- NVIDIA GPU (CUDA 11.8+)
- 16GB RAM
- 500GB+ storage

---

## 🔍 Troubleshooting

### Services won't start

```bash
# Check Docker is running
docker ps

# Check logs
docker-compose -f docker-compose.free-media-stack.yml logs

# Rebuild
docker-compose -f docker-compose.free-media-stack.yml build --no-cache
```

### Groq API fails ("rate limit exceeded")

```
Error: Rate limit exceeded (240/day)
```

**Solution**: Use Whisper.cpp for unlimited requests:

```bash
docker run -p 8000:8000 ghcr.io/ggerganov/whisper.cpp:latest
export WHISPER_URL=http://localhost:8000
```

### LibreTranslate is slow

```bash
# Increase threads
LIBRETRANSLATE_THREADS=8 docker run -p 5000:5000 libretranslate/libretranslate
```

### Piper TTS not found

```bash
# Install locally
pip install piper-tts
piper --help

# Or use Docker
docker run -v /models:/models piper
```

### High memory usage

```bash
# Reduce LibreTranslate languages
LOAD_ONLY=pt,es,en docker run libretranslate/libretranslate

# Reduce Piper model quality
PIPER_MODELS_DIR=/tmp/piper (models will re-download)
```

---

## 🎯 Production Deployment

### Docker Swarm / Kubernetes

```bash
# Scale workers
docker service update --replicas 5 media-processor-app

# Or with Kubernetes
kubectl scale deployment media-processor-app --replicas 5
```

### Monitoring

```bash
# Check queue depth
curl http://localhost:3000/api/metrics/queue

# Check worker status
curl http://localhost:3000/api/metrics/workers

# Check processing time
curl http://localhost:3000/api/metrics/jobs
```

---

## 💡 Tips & Tricks

### Batch Multiple Videos

```bash
for video in videos/*.mp4; do
  curl -X POST http://localhost:3000/api/media \
    -d "{\"videoUrl\": \"file://$video\", ...}"
done
```

### Auto-download Models

```bash
# Piper auto-downloads on first use (~50-200MB per language)
# LibreTranslate auto-downloads on first use (~500MB)
# Whisper.cpp models: ./models/download-ggml-model.sh base
```

### Custom Voices

Piper supports many free voices from Hugging Face:
- Multiple speakers per language
- Different emotions/styles
- Clone your own voice (advanced)

```bash
piper --help  # See all available voices
```

---

## 🔗 Useful Links

| Service | Link | Docs |
|---------|------|------|
| **Groq** | https://console.groq.com | [API Docs](https://console.groq.com/docs) |
| **LibreTranslate** | https://github.com/LibreTranslate/LibreTranslate | [GitHub](https://github.com/LibreTranslate/LibreTranslate) |
| **Piper** | https://github.com/rhasspy/piper | [Voices](https://huggingface.co/rhasspy/piper-voices) |
| **Whisper.cpp** | https://github.com/ggerganov/whisper.cpp | [GitHub](https://github.com/ggerganov/whisper.cpp) |
| **FFmpeg** | https://ffmpeg.org | [Documentation](https://ffmpeg.org/documentation.html) |

---

## ❌ What NOT To Do

- ❌ Don't use OpenAI API (paid, $0.006/min audio for Whisper)
- ❌ Don't use ElevenLabs free tier (very limited)
- ❌ Don't use commercial TTS services
- ❌ Don't hardcode API keys in code

## ✅ What TO Do

- ✅ Use Groq free tier (240/day requests)
- ✅ Use Whisper.cpp for unlimited (run locally)
- ✅ Use Piper TTS (free, offline)
- ✅ Use LibreTranslate (free, self-hosted)
- ✅ Use env variables for secrets

---

## 📈 Scaling To Production

**Same setup, just:**
1. Increase Docker resources
2. Scale workers horizontally
3. Add monitoring (Prometheus)
4. Add backup strategy (DB snapshots)
5. Use persistent volumes for models
6. Setup auto-restart policies

**No paid services needed at any scale.**

---

## 🎓 Learning Resources

- [Piper Documentation](https://github.com/rhasspy/piper)
- [LibreTranslate Wiki](https://github.com/LibreTranslate/LibreTranslate/wiki)
- [Whisper.cpp Guide](https://github.com/ggerganov/whisper.cpp)
- [FFmpeg Filters](https://ffmpeg.org/ffmpeg-filters.html)
- [BullMQ Docs](https://docs.bullmq.io)

---

**Questions? Everything is documented in the code and Docker images. All components are battle-tested open-source.**

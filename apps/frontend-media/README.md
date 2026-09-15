# Frontend - MediaHub

Audio transcription and video dubbing UI built with React + TypeScript.

## Features

✅ **Audio Transcription** - Upload audio files and get automatic transcription  
✅ **Video Dubbing** - Create dubbed videos or generate subtitles in multiple languages  
✅ **Real-time Progress** - WebSocket updates during processing  
✅ **Multi-language** - Support for 99+ languages (Whisper) and 30+ translation languages  
✅ **100% Free** - Open-source, no paid APIs required  

## Stack

- **React 18** + TypeScript
- **Vite** - Fast build tool
- **Tailwind CSS** - Styling
- **React Hook Form** + Zod - Form validation
- **Socket.IO** - Real-time updates
- **React Router** - Navigation

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 3001)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

Create `.env.local`:

```env
VITE_API_URL=http://localhost:3000
VITE_WS_URL=http://localhost:3000
```

## Deployment

### Railway (Recommended)

1. Connect your GitHub repository to Railway
2. Railway automatically detects the Dockerfile
3. Set environment variables in Railway dashboard
4. Deploy on push

```bash
# Deploy manually
railway up
```

### Docker

```bash
docker build -t mediahub-frontend .
docker run -p 3001:3001 \
  -e VITE_API_URL=http://api.example.com \
  mediahub-frontend
```

### Vercel/Netlify

```bash
npm run build
# Upload dist/ folder
```

## Project Structure

```
src/
├── components/     # React components
├── pages/         # Page components
├── hooks/         # Custom hooks (useMediaJob, useWebSocket)
├── types/         # TypeScript types
├── App.tsx        # Main app
└── main.tsx       # Entry point
```

## Pages

- **/**  - Audio transcription
- **/dub** - Video dubbing & subtitles

## API Endpoints

- `POST /api/transcribe` - Create transcription job
- `POST /api/media` - Create media processing job
- `GET /api/job/:id/status` - Get job status
- `WS /` - WebSocket for real-time updates

## License

MIT

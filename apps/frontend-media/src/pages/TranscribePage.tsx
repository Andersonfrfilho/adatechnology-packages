// Audio Transcription Page

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Download, Copy, CheckCircle } from 'lucide-react';
import { useMediaJob } from '../hooks/useMediaJob.js';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { ProgressCard } from '../components/ProgressCard.js';

const transcribeSchema = z.object({
  file: z.instanceof(File).refine(
    (file) => file.size <= 100 * 1024 * 1024,
    'Arquivo muito grande (máx 100MB)'
  ),
  language: z.string().optional(),
});

type TranscribeFormData = z.infer<typeof transcribeSchema>;

export function TranscribePage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { transcribeAudio, loading, error } = useMediaJob();
  const { progress, isConnected, completed } = useWebSocket(jobId, !!jobId);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<TranscribeFormData>({
    resolver: zodResolver(transcribeSchema),
  });

  const onSubmit = async (data: TranscribeFormData) => {
    try {
      const result = await transcribeAudio(data.file, data.language);
      setJobId(result.id);
    } catch (err) {
      console.error('Transcription failed:', err);
    }
  };

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (jobId && progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            Transcrevendo áudio...
          </h1>

          <ProgressCard
            progress={progress}
            isConnected={isConnected}
            isCompleted={completed}
          />

          {completed && progress.details?.transcript && (
            <div className="mt-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                ✅ Transcrição Completa
              </h2>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Idioma Detectado
                </label>
                <p className="text-lg font-semibold text-gray-900">
                  {progress.details.transcript.language} (
                  {Math.round(progress.details.transcript.confidence * 100)}%)
                </p>
              </div>

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Texto Transcrito
                  </label>
                  <button
                    onClick={() =>
                      copyToClipboard(progress.details.transcript.text)
                    }
                    className="flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm"
                  >
                    {copied ? (
                      <>
                        <CheckCircle size={16} />
                        Copiado!
                      </>
                    ) : (
                      <>
                        <Copy size={16} />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  value={progress.details.transcript.text}
                  readOnly
                  rows={10}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-gray-50 font-mono text-sm"
                />
              </div>

              <button
                onClick={() => {
                  setJobId(null);
                  reset();
                }}
                className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition"
              >
                Transcrever Outro Áudio
              </button>
            </div>
          )}

          {error && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">
                ❌ Erro na transcrição
              </p>
              <p className="text-red-700">{error.message}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Transcrever Áudio
          </h1>
          <p className="text-lg text-gray-600">
            Envie um arquivo de áudio e obtenha a transcrição automática
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* File Upload */}
            <div>
              <label htmlFor="file" className="block text-sm font-medium text-gray-700 mb-3">
                Arquivo de Áudio
              </label>
              <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-400 transition cursor-pointer">
                <input
                  {...register('file')}
                  type="file"
                  accept="audio/*"
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                <p className="font-semibold text-gray-900">
                  Clique ou arraste um arquivo de áudio
                </p>
                <p className="text-sm text-gray-500">
                  MP3, WAV, FLAC, OGG (máx 100MB)
                </p>
              </div>
              {errors.file && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.file.message}
                </p>
              )}
            </div>

            {/* Language Selection */}
            <div>
              <label htmlFor="language" className="block text-sm font-medium text-gray-700 mb-2">
                Idioma (Opcional)
              </label>
              <select
                {...register('language')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Detectar automaticamente</option>
                <option value="pt">Português (Brasil)</option>
                <option value="es">Español</option>
                <option value="en">English</option>
                <option value="fr">Français</option>
              </select>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-semibold py-3 rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Transcrever
                </>
              )}
            </button>
          </form>
        </div>

        {/* Info */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">⚡ Rápido</h3>
            <p className="text-gray-600 text-sm">
              Processamento em tempo real com WebSocket
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">🌍 Multilíngue</h3>
            <p className="text-gray-600 text-sm">
              Suporta 99+ idiomas automaticamente
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
            <h3 className="font-semibold text-gray-900 mb-2">🔒 Gratuito</h3>
            <p className="text-gray-600 text-sm">
              100% open-source, sem custos
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

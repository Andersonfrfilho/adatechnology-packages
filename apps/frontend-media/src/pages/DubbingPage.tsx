// Video Dubbing & Subtitles Page

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Upload, Download } from 'lucide-react';
import { useMediaJob } from '../hooks/useMediaJob';
import { useWebSocket } from '../hooks/useWebSocket';
import { ProgressCard } from '../components/ProgressCard';

const dubbingSchema = z.object({
  videoUrl: z.string().url('URL inválida').optional(),
  file: z.instanceof(File).optional(),
  outputType: z.enum(['dub', 'subtitles']),
  targetLanguages: z.array(z.string()).min(1, 'Selecione pelo menos um idioma'),
  subtitleFormat: z.enum(['srt', 'vtt']).optional(),
  subtitleBurned: z.boolean().optional(),
});

type DubbingFormData = z.infer<typeof dubbingSchema>;

const LANGUAGES = [
  { value: 'pt-BR', label: '🇧🇷 Português (Brasil)' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'en', label: '🇺🇸 English' },
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'it', label: '🇮🇹 Italiano' },
];

export function DubbingPage() {
  const [jobId, setJobId] = useState<string | null>(null);
  const { createMediaJob, loading, error } = useMediaJob();
  const { progress, isConnected, completed } = useWebSocket(jobId, !!jobId);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
    reset,
  } = useForm<DubbingFormData>({
    resolver: zodResolver(dubbingSchema),
    defaultValues: {
      outputType: 'subtitles',
      targetLanguages: ['pt-BR'],
      subtitleFormat: 'srt',
    },
  });

  const outputType = watch('outputType');
  const selectedLanguages = watch('targetLanguages');

  const onSubmit = async (data: DubbingFormData) => {
    try {
      const result = await createMediaJob({
        videoUrl: data.videoUrl,
        file: data.file,
        outputType: data.outputType,
        targetLanguages: data.targetLanguages,
        subtitleFormat: data.subtitleFormat as 'srt' | 'vtt' | undefined,
        subtitleBurned: data.subtitleBurned,
      });
      setJobId(result.id);
    } catch (err) {
      console.error('Job creation failed:', err);
    }
  };

  if (jobId && progress) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-gray-900 mb-8">
            {outputType === 'dub' ? 'Dublando vídeo...' : 'Gerando legendas...'}
          </h1>

          <ProgressCard
            progress={progress}
            isConnected={isConnected}
            isCompleted={completed}
          />

          {completed && progress.details?.results && (
            <div className="mt-8 bg-white rounded-lg shadow-md p-6 border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-900 mb-6">
                ✅ Processamento Concluído
              </h2>

              {outputType === 'subtitles' &&
                progress.details.results.subtitles && (
                  <div className="space-y-4">
                    {progress.details.results.subtitles.map((sub: any) => (
                      <div
                        key={sub.language}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {sub.language}
                          </p>
                          <p className="text-sm text-gray-600">{sub.format}</p>
                        </div>
                        <a
                          href={sub.srtUrl}
                          download
                          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                          <Download size={16} />
                          Baixar
                        </a>
                      </div>
                    ))}
                  </div>
                )}

              {outputType === 'dub' && progress.details.results.videoUrl && (
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium text-gray-900 mb-3">
                    Vídeo Dublado Pronto
                  </p>
                  <a
                    href={progress.details.results.videoUrl}
                    download
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition w-fit"
                  >
                    <Download size={16} />
                    Baixar Vídeo
                  </a>
                </div>
              )}

              <button
                onClick={() => {
                  setJobId(null);
                  reset();
                }}
                className="mt-6 w-full bg-purple-600 text-white font-semibold py-3 rounded-lg hover:bg-purple-700 transition"
              >
                Processar Outro Vídeo
              </button>
            </div>
          )}

          {error && (
            <div className="mt-8 bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-red-800 font-semibold">❌ Erro</p>
              <p className="text-red-700">{error.message}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            Dublagem & Legendas
          </h1>
          <p className="text-lg text-gray-600">
            Gere legendas em múltiplos idiomas ou crie áudio dublado
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-8 border border-gray-200">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Video Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Vídeo
              </label>
              <div className="space-y-4">
                <div>
                  <input
                    {...register('videoUrl')}
                    type="url"
                    placeholder="Ou cole uma URL S3..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 hover:border-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                  />
                  {errors.videoUrl && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.videoUrl.message}
                    </p>
                  )}
                </div>

                <div className="relative border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-purple-400 transition cursor-pointer">
                  <input
                    {...register('file')}
                    type="file"
                    accept="video/*"
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="font-semibold text-gray-900">
                    Ou clique/arraste para fazer upload
                  </p>
                  <p className="text-sm text-gray-500">MP4, WebM (máx 5GB)</p>
                </div>
              </div>
            </div>

            {/* Output Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Tipo de Saída
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-purple-400 has-[:checked]:border-purple-600 has-[:checked]:bg-purple-50 transition">
                  <input
                    {...register('outputType')}
                    type="radio"
                    value="subtitles"
                    className="w-4 h-4"
                  />
                  <span className="ml-3 font-medium text-gray-900">
                    Legendas (SRT/VTT)
                  </span>
                </label>
                <label className="flex items-center p-4 border-2 border-gray-200 rounded-lg cursor-pointer hover:border-purple-400 has-[:checked]:border-purple-600 has-[:checked]:bg-purple-50 transition">
                  <input
                    {...register('outputType')}
                    type="radio"
                    value="dub"
                    className="w-4 h-4"
                  />
                  <span className="ml-3 font-medium text-gray-900">
                    Vídeo Dublado
                  </span>
                </label>
              </div>
            </div>

            {/* Languages */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Idiomas ({selectedLanguages.length})
              </label>
              <div className="space-y-2">
                {LANGUAGES.map((lang) => (
                  <label
                    key={lang.value}
                    className="flex items-center p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      {...register('targetLanguages')}
                      type="checkbox"
                      value={lang.value}
                      className="w-4 h-4 rounded"
                    />
                    <span className="ml-3 font-medium text-gray-900">
                      {lang.label}
                    </span>
                  </label>
                ))}
              </div>
              {errors.targetLanguages && (
                <p className="mt-2 text-sm text-red-600">
                  {errors.targetLanguages.message}
                </p>
              )}
            </div>

            {/* Subtitle Options */}
            {outputType === 'subtitles' && (
              <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Formato
                  </label>
                  <select
                    {...register('subtitleFormat')}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-white text-gray-900 hover:border-gray-400 focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="srt">SRT (recomendado)</option>
                    <option value="vtt">VTT (HTML5)</option>
                  </select>
                </div>

                <label className="flex items-center">
                  <input
                    {...register('subtitleBurned')}
                    type="checkbox"
                    className="w-4 h-4 rounded"
                  />
                  <span className="ml-3 text-sm font-medium text-gray-900">
                    Queimar legendas no vídeo (não removível)
                  </span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  {outputType === 'dub' ? 'Dublar Vídeo' : 'Gerar Legendas'}
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

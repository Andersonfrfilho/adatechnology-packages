// Progress Card - Real-time job progress display

import { FileAudio, Film, MoreVertical } from 'lucide-react';
import type { ProgressEvent, ProcessingStage } from '../types/index.js';

const STAGE_ICONS: Record<ProcessingStage, React.ReactNode> = {
  extracting: '🎬',
  transcribing: '🗣️',
  translating: '🌍',
  generating: '🎤',
  aligning: '⏱️',
  remuxing: '🎥',
};

interface ProgressCardProps {
  progress: ProgressEvent | null;
  isConnected: boolean;
  isCompleted: boolean;
}

export function ProgressCard({
  progress,
  isConnected,
  isCompleted,
}: ProgressCardProps) {
  if (!progress) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{STAGE_ICONS[progress.stage]}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {progress.message}
            </h3>
            <p className="text-sm text-gray-500">
              {isConnected && <span className="text-green-600">● LIVE</span>}
              {!isConnected && !isCompleted && (
                <span className="text-amber-600">● Polling...</span>
              )}
              {isCompleted && <span className="text-green-600">✓ Concluído</span>}
            </p>
          </div>
        </div>

        <button className="p-2 hover:bg-gray-100 rounded-full">
          <MoreVertical size={20} className="text-gray-500" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progresso</span>
          <span className="text-lg font-bold text-blue-600">
            {progress.percent}%
          </span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              isCompleted ? 'bg-green-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(progress.percent, 100)}%` }}
          />
        </div>
      </div>

      {/* ETA */}
      {progress.eta && !isCompleted && (
        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-gray-600">Tempo estimado:</span>
          <span className="font-medium text-gray-900">
            {Math.ceil(progress.eta / 60)} min
          </span>
        </div>
      )}

      {/* Details */}
      {progress.details && (
        <details className="mt-4 pt-4 border-t border-gray-200">
          <summary className="cursor-pointer text-sm font-medium text-gray-700 hover:text-gray-900">
            Detalhes técnicos
          </summary>
          <pre className="mt-3 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-48 text-gray-600">
            {JSON.stringify(progress.details, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}

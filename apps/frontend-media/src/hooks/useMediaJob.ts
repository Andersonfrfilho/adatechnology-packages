/// <reference types="vite/client" />
// Hook para gerenciar jobs de mídia

import { useState, useCallback } from 'react';
import axios from 'axios';
import type { AnyJob, ApiError } from '../types/index';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function useMediaJob() {
  const [job, setJob] = useState<AnyJob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  // Fetch job status
  const fetchJob = useCallback(async (jobId: string) => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`${API_URL}/api/job/${jobId}/status`);
      setJob(response.data);
      return response.data;
    } catch (err) {
      const apiError: ApiError = {
        code: 'FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Failed to fetch job',
      };
      setError(apiError);
      throw apiError;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create transcription job
  const transcribeAudio = useCallback(
    async (file: File, language?: string) => {
      try {
        setLoading(true);
        setError(null);

        const formData = new FormData();
        formData.append('file', file);
        if (language) formData.append('language', language);

        const response = await axios.post(`${API_URL}/api/transcribe`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        setJob(response.data);
        return response.data;
      } catch (err) {
        const apiError: ApiError = {
          code: 'TRANSCRIBE_FAILED',
          message: err instanceof Error ? err.message : 'Transcription failed',
        };
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // Create dubbing/subtitles job
  const createMediaJob = useCallback(
    async (data: {
      videoUrl?: string;
      file?: File;
      outputType: 'dub' | 'subtitles';
      targetLanguages: string[];
      subtitleFormat?: 'srt' | 'vtt';
      subtitleBurned?: boolean;
    }) => {
      try {
        setLoading(true);
        setError(null);

        let payload: Record<string, any> = {
          outputType: data.outputType,
          targetLanguages: data.targetLanguages,
          subtitleFormat: data.subtitleFormat || 'srt',
          subtitleBurned: data.subtitleBurned ?? false,
        };

        if (data.videoUrl) {
          payload.videoUrl = data.videoUrl;
        } else if (data.file) {
          // Upload file first
          const formData = new FormData();
          formData.append('file', data.file);
          const uploadRes = await axios.post(`${API_URL}/api/upload`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          });
          payload.videoUrl = uploadRes.data.url;
        }

        const response = await axios.post(`${API_URL}/api/media`, payload);
        setJob(response.data);
        return response.data;
      } catch (err) {
        const apiError: ApiError = {
          code: 'JOB_CREATION_FAILED',
          message: err instanceof Error ? err.message : 'Failed to create job',
        };
        setError(apiError);
        throw apiError;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  return {
    job,
    loading,
    error,
    fetchJob,
    transcribeAudio,
    createMediaJob,
  };
}

// Voice input: record with expo-audio, transcribe via the backend's
// existing POST /audio/transcribe (whisper-1) — the SAME endpoint the web
// composer uses, so quality and language behavior match exactly.
//
// Upload goes through expo-file-system uploadAsync (multipart, field
// `file`) — the one upload mechanism that works on SDK 57 (see upload.ts).

import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';

import { API_BASE_URL, API_VERSION } from './env';

export async function transcribeAudioFile(
  token: string,
  fileUri: string,
): Promise<string> {
  const res = await uploadAsync(
    `${API_BASE_URL}/api/${API_VERSION}/audio/transcribe`,
    fileUri,
    {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'file',
      mimeType: 'audio/m4a',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    },
  );
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Transcription failed (${res.status})`);
  }
  const body = JSON.parse(res.body || '{}');
  return (body.transcription || '').trim();
}

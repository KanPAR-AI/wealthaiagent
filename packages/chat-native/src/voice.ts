// Voice input: transcribe a recording through the backend's existing
// POST /audio/transcribe (whisper-1) — the SAME endpoint the web composer
// uses, so quality and language behaviour match exactly (that matters here:
// KneeFit's users speak Hindi, and whisper handles it).
//
// SHARED, not copied. This lived at `apps/mobile/src/lib/voice.ts`, and the
// upload path next door (upload.ts) had already been through exactly this
// move — a second app needing it is the moment it stops being app-local, and
// two copies of an upload contract drift the first time somebody fixes one.
// `apiUrl` was app-local (`./server-config`); it is the platform adapter's
// job here, like upload.ts.
//
// The recording itself is expo-audio, which the COMPOSER owns (chat-input);
// this module only turns a file URI into text.

import { uploadAsync, FileSystemUploadType } from 'expo-file-system/legacy';
import { getPlatform } from '@wealthai/core';

const apiUrl = (endpoint: string) => getPlatform().getApiUrl(endpoint);

export async function transcribeAudioFile(
  token: string,
  fileUri: string,
): Promise<string> {
  const res = await uploadAsync(
    apiUrl('/audio/transcribe'),
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

// Native multipart upload — the path that actually works on Expo SDK 57.
//
// Journey documented for posterity, since three "obvious" routes failed:
//   1. RN {uri,name,type} FormData part  → expo/fetch (which SDK 57
//      installs as the GLOBAL fetch) rejects it: "Unsupported
//      FormDataPart implementation".
//   2. fetch(file://).blob() → FormData   → RN's Blob polyfill can't
//      build blobs from array buffers: "Creating blobs from
//      'ArrayBuffer' ... not supported".
//   3. new File([...])                    → same Blob limitation.
// expo-file-system's uploadAsync streams the file natively (no JS-side
// FormData at all) and is Expo's canonical answer for exactly this.
// (Legacy import path: SDK 54+ moved the callback API there.)

import * as FileSystem from 'expo-file-system/legacy';
import type { MessageFile } from '@wealthai/core';

import { apiUrl as serverApiUrl } from './server-config';

const apiUrl = serverApiUrl;

export async function uploadFileNative(
  token: string,
  asset: { uri: string; name: string; type: string; size?: number },
  onProgress?: (fraction: number) => void,
): Promise<MessageFile> {
  // createUploadTask (vs uploadAsync) exposes native upload progress —
  // the subtle bar in the composer runs off this callback.
  const task = FileSystem.createUploadTask(
    apiUrl('/files/upload'),
    asset.uri,
    {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: 'files',
      mimeType: asset.type || 'application/octet-stream',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    },
    (p) => {
      if (onProgress && p.totalBytesExpectedToSend > 0) {
        onProgress(p.totalBytesSent / p.totalBytesExpectedToSend);
      }
    },
  );
  const res = await task.uploadAsync();
  if (!res) throw new Error(`Upload cancelled for ${asset.name}`);
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`Upload failed (${res.status}) for ${asset.name}`);
  }
  const result = JSON.parse(res.body || '{}');
  const uploaded = result?.files?.[0];
  if (!uploaded?.url) throw new Error(`Invalid upload response for ${asset.name}`);
  return {
    name: uploaded.fileName || asset.name,
    url: apiUrl(uploaded.url),
    type: asset.type,
    size: asset.size ?? 0,
  };
}

// components/chat/file-preview-modal.tsx
import { useJwtToken } from '@/hooks/use-jwt-token';
import { MessageFile } from '@/types';
import { X } from 'lucide-react';
import { JSX, useEffect, useState } from 'react';

// Helper to securely fetch and blobify the file
const usePreviewUrl = (file: MessageFile | null, jwt: string | null) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !jwt) return;

    const fetchBlob = async () => {
      try {
        const res = await fetch(file.url, {
          headers: { Authorization: `Bearer ${jwt}` },
        });
        console.log(res)
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
      } catch (err) {
        console.error('Failed to fetch preview blob:', err);
        setBlobUrl(null);
      }
    };

    fetchBlob();

    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [file, jwt, blobUrl]);

  return blobUrl;
};

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: MessageFile | null;
}

export function FilePreviewModal({
  isOpen,
  onClose,
  file,
}: FilePreviewModalProps): JSX.Element | null {
  const {token} = useJwtToken();
  const blobUrl = usePreviewUrl(file, token);

  if (!isOpen || !file || !token) return null;

  const isImage = file.type?.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  const _isExcel = file.type?.includes('spreadsheetml') || file.type?.includes('excel');

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors z-10"
        onClick={onClose}
        aria-label="Close file preview"
      >
        <X size={32} />
      </button>

      <div
        className="relative max-h-full w-full h-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {isImage && blobUrl ? (
          <img
            src={blobUrl}
            alt={file.name}
            className="max-w-full max-h-[90vh] object-contain mx-auto my-auto"
          />
        ) : isPDF && blobUrl ? (
          <embed
            src={blobUrl}
            type="application/pdf"
            className="w-full h-full"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-white">
            <p className="text-xl font-semibold">Preview not available for this file type.</p>
            <a
              href={file.url + `?token=${encodeURIComponent(token)}`}
              download={file.name}
              className="mt-4 text-blue-400 underline hover:text-blue-300"
            >
              Download File
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

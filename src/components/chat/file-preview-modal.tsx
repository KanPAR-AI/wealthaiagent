// components/chat/file-preview-modal.tsx
import { useJwtToken } from '@/hooks/use-jwt-token';
import { useCachedFile } from '@/hooks/use-cached-file';
import { MessageFile } from '@/types';
import { X, Loader2 } from 'lucide-react';
import { JSX } from 'react';

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
  const { token } = useJwtToken();
  const { blobUrl, isLoading, error } = useCachedFile(file, token);

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
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <Loader2 className="animate-spin size-8 text-zinc-500 mb-4" />
              <span className="text-zinc-600">Loading preview...</span>
            </div>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <p className="text-xl font-semibold text-red-600 mb-4">Failed to load preview</p>
            <a
              href={file.url + `?token=${encodeURIComponent(token)}`}
              download={file.name}
              className="text-blue-400 underline hover:text-blue-300"
            >
              Download File
            </a>
          </div>
        ) : isImage && blobUrl ? (
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
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-zinc-600">
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

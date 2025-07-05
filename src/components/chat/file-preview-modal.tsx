import { MessageFile } from '@/types/chat';
import { FileRenderer } from './file-renderer';
import { X } from 'lucide-react';
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
  if (!isOpen || !file) return null;

  const isImage = file.type?.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  const isExcel = file.type?.includes('sheet');

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
        {isImage ? (
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full max-h-[90vh] object-contain mx-auto my-auto"
          />
        ) : isPDF ? (
          <iframe
            src={file.url}
            className="w-full h-full"
            title={file.name}
          />
        ) : isExcel ? (
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url!)}`}
            title={file.name}
            className="w-full h-full"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-white">
            <p className="text-xl font-semibold">Preview not available for this file type.</p>
            <a
              href={file.url}
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


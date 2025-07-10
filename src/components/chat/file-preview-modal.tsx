// components/chat/file-preview-modal.tsx

import { MessageFile } from '@/types/chat';
import { X } from 'lucide-react';
import { JSX } from 'react';

interface FilePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: MessageFile | null; // The file to preview
}

export function FilePreviewModal({
  isOpen,
  onClose,
  file,
}: FilePreviewModalProps): JSX.Element | null {
  // Don't render if not open or no file is provided
  if (!isOpen || !file) return null;

  // Determine file type for conditional rendering
  const isImage = file.type?.startsWith('image/');
  const isPDF = file.type === 'application/pdf';
  // Check for common Excel MIME types
  const isExcel = file.type?.includes('spreadsheetml') || file.type?.includes('excel');

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose} // Close modal when clicking outside content
    >
      {/* Close button */}
      <button
        className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors z-10"
        onClick={onClose}
        aria-label="Close file preview"
      >
        <X size={32} />
      </button>

      {/* Modal content area */}
      <div
        className="relative max-h-full w-full h-full max-w-5xl bg-white rounded-lg shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside content
      >
        {isImage ? (
          // Image preview
          <img
            src={file.url}
            alt={file.name}
            className="max-w-full max-h-[90vh] object-contain mx-auto my-auto"
          />
        ) : isPDF ? (
          // PDF preview using iframe
          <iframe
            src={file.url}
            className="w-full h-full"
            title={file.name}
          />
        ) : isExcel ? (
          // Excel preview using Office Online Viewer (requires publicly accessible URL)
          <iframe
            src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(file.url)}`}
            title={file.name}
            className="w-full h-full"
          />
        ) : (
          // Fallback for unsupported file types
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

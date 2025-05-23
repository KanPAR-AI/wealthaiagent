import { X } from 'lucide-react';
import { JSX } from 'react';
interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
}

export function ImageModal({ isOpen, onClose, imageUrl }: ImageModalProps): JSX.Element | null {
  if (!isOpen || !imageUrl) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 text-white hover:text-zinc-300 transition-colors z-10"
        onClick={onClose}
        aria-label="Close image view"
      >
        <X size={32} />
      </button>
      <div
        className="relative max-w-full max-h-full"
        onClick={(e) => e.stopPropagation()} // Prevent closing modal when clicking on the image
      >
        <img
          src={imageUrl}
          alt="Expanded view"
          className="max-w-full max-h-[90vh] object-contain"
        />
      </div>
    </div>
  );
}
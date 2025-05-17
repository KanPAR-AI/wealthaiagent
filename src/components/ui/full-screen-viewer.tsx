// src/components/chat/structured-content/FullScreenViewer.tsx
import React from 'react';
import { X as CloseIcon } from 'lucide-react'; // Assuming icon library

interface FullScreenViewerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

const FullScreenViewer: React.FC<FullScreenViewerProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-zinc-900 rounded-lg shadow-xl w-full max-w-4xl h-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()} // Prevent click inside from closing
      >
        <div className="flex items-center justify-between p-4 border-b dark:border-zinc-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-zinc-200">{title || 'Expanded View'}</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            aria-label="Close"
          >
            <CloseIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="flex-grow p-4 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  );
};

export default FullScreenViewer;
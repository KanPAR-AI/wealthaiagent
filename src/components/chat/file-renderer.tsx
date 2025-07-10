// components/chat/file-renderer.tsx

import { MessageFile } from '@/types/chat';
import { Download, FileText, Maximize, TriangleAlert } from 'lucide-react';
import { JSX, useState } from 'react';

interface FileRendererProps {
  file: MessageFile;
  onFileClick: (file: MessageFile) => void; // Handler to open the preview modal
}

interface PdfPreviewProps {
  file: MessageFile;
}

// --- Individual File Preview Components ---

const ImagePreview: React.FC<FileRendererProps> = ({ file, onFileClick }) => {
  const [hasError, setHasError] = useState(false);

  // If there's an error loading the image or no URL, show an error state
  if (hasError || !file.url) {
    return (
      <div className="w-full h-48 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-md text-destructive">
        <TriangleAlert className="size-8" />
        <span className="text-xs mt-2">Preview unavailable</span>
      </div>
    );
  }

  return (
    <div className="relative group bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden">
      <img
        src={file.url} // Use the provided file URL
        alt={`Preview of ${file.name}`}
        className="max-w-full h-auto max-h-72 object-contain mx-auto"
        onError={() => setHasError(true)} // Set error state if image fails to load
      />
      {/* Overlay for "Maximize" icon to open full preview */}
      <div
        className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
        onClick={() => onFileClick(file)} // Call onFileClick to open the modal
      >
        <Maximize className="text-white" size={32} />
      </div>
    </div>
  );
};

const PdfPreview: React.FC<PdfPreviewProps> = ({ file }) => {
  // Using a simple iframe to let the browser handle the PDF rendering.
  // This is the simplest method with no external libraries.
  // Note: This might not work if the backend serves PDFs with Content-Disposition: attachment
  return (
    <div className="w-full h-[400px] border border-border rounded-md overflow-hidden">
      <iframe
        src={file.url} // Use the provided file URL
        title={`PDF preview for ${file.name}`}
        width="100%"
        height="100%"
        className="border-none"
      />
    </div>
  );
};

const GenericFile: React.FC<{ file: MessageFile }> = ({ file }) => (
  <div className="flex items-center gap-3 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-border">
    <FileText className="size-8 flex-shrink-0 text-muted-foreground" />
    <div className="flex-grow truncate">
      <p className="font-medium truncate text-sm" title={file.name}>{file.name}</p>
      <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
    </div>
    {/* Provide a download link for generic files */}
    {file.url && (
      <a
        href={file.url}
        download={file.name} // Suggests filename for download
        className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md flex-shrink-0"
        title={`Download ${file.name}`}
      >
        <Download className="size-5" />
      </a>
    )}
  </div>
);


// --- Main Dispatcher Component ---

export function FileRenderer({ file, onFileClick }: FileRendererProps): JSX.Element {
  // Renders different components based on file MIME type
  if (file.type.startsWith('image/')) {
    return <ImagePreview file={file} onFileClick={onFileClick} />;
  }
  // Only try to render PDF if a URL is available
  if (file.type === 'application/pdf' && file.url) {
    return <PdfPreview file={file} />;
  }
  // Fallback for all other file types
  return <GenericFile file={file} />;
}

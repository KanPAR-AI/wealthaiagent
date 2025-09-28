// components/chat/file-renderer.tsx

import { MessageFile } from '@/types';
import { Download, FileText, Maximize, TriangleAlert } from 'lucide-react';
import React, { JSX, useEffect, useState } from 'react';
import { fetchFileWithToken } from '@/services/chat-service';
import { Loader2 } from 'lucide-react';
import { useJwtToken } from '@/hooks/use-jwt-token';

interface FileRendererProps {
  file: MessageFile;
  onFileClick?: (file: MessageFile) => void;
}

// --- Image Preview ---
function ImagePreview({ file, onFileClick }: FileRendererProps) {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(false);
    const { token } = useJwtToken();
  
    useEffect(() => {
      if (!file.url || !token) {
        console.log('ImagePreview: Missing URL or token', { url: file.url, hasToken: !!token });
        return;
      }
      console.log('ImagePreview: Loading image', file.url);
      setIsLoading(true);
      setError(false);
      fetchFileWithToken(file.url, token)
        .then((url) => {
          console.log('ImagePreview: Successfully loaded image');
          setPreviewUrl(url);
          setIsLoading(false);
        })
        .catch((err) => {
          console.error('Failed to load image:', err);
          setError(true);
          setIsLoading(false);
        });
    }, [file.url, token]);
  
    if (error || !previewUrl) {
      return (
        <div className="w-full h-48 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-md text-destructive">
          <TriangleAlert className="size-8" />
          <span className="text-xs mt-2">Preview unavailable</span>
        </div>
      );
    }
  
    return (
      <div className="relative group bg-zinc-100 dark:bg-zinc-800 rounded-md overflow-hidden flex items-center justify-center min-h-[180px]">
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
            <Loader2 className="animate-spin size-6 text-zinc-500" />
          </div>
        )}
  
        <img
          src={previewUrl}
          alt={`Preview of ${file.name}`}
          onLoad={() => setIsLoading(false)} // double-safe
          className="max-w-full h-auto max-h-72 object-contain mx-auto transition-opacity duration-300"
          style={{ opacity: isLoading ? 0 : 1 }}
        />
  
        {onFileClick && !isLoading && (
          <div
            className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer z-20"
            onClick={() => onFileClick(file)}
          >
            <Maximize className="text-white" size={32} />
          </div>
        )}
      </div>
    );
  }

// --- PDF Preview ---
function PdfPreview({ file }: { file: MessageFile }) {
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { token } = useJwtToken();

  useEffect(() => {
    if (!file.url || !token) return;
    setError(false);
    fetchFileWithToken(file.url, token)
      .then(setPdfUrl)
      .catch((err) => {
        console.error('Failed to load PDF:', err);
        setError(true);
      });
  }, [file.url, token]);

  if (error || !pdfUrl) {
    return (
      <div className="w-full h-48 flex items-center justify-center text-destructive bg-zinc-100 dark:bg-zinc-800 rounded-md">
        <TriangleAlert className="size-8 mr-2" />
        <span className="text-sm">PDF preview not available</span>
      </div>
    );
  }

  return (
    <div className="w-full h-[400px] border border-border rounded-md overflow-hidden">
      <iframe
        src={pdfUrl}
        title={`PDF preview of ${file.name}`}
        width="100%"
        height="100%"
        className="border-none"
      />
    </div>
  );
}

// --- Fallback for other files ---
function GenericFile({ file }: { file: MessageFile }) {
  const { token } = useJwtToken();

  const secureUrl = token
    ? `${file.url}?token=${encodeURIComponent(token)}`
    : file.url;

  return (
    <div className="flex items-center gap-3 p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-border">
      <FileText className="size-8 flex-shrink-0 text-muted-foreground" />
      <div className="flex-grow truncate">
        <p className="font-medium truncate text-sm" title={file.name}>{file.name}</p>
        <p className="text-xs text-muted-foreground">{Math.round(file.size / 1024)} KB</p>
      </div>
      {file.url && (
        <a
          href={secureUrl}
          download={file.name}
          className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md flex-shrink-0"
        >
          <Download className="size-5" />
        </a>
      )}
    </div>
  );
}

// Helper function to detect file type from URL
function detectFileTypeFromUrl(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase();
  
  switch (extension) {
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
      return 'image/' + extension;
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'doc':
    case 'docx':
      return 'application/msword';
    case 'xls':
    case 'xlsx':
      return 'application/vnd.ms-excel';
    default:
      return 'application/octet-stream';
  }
}

// Error boundary component for file rendering
function FileRendererErrorBoundary({ children, file }: { children: React.ReactNode; file: MessageFile }) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleError = () => setHasError(true);
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);

  if (hasError) {
    return (
      <div className="w-full h-48 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-md text-destructive">
        <TriangleAlert className="size-8" />
        <span className="text-xs mt-2">Failed to render file</span>
        <span className="text-xs text-muted-foreground mt-1">{file.name}</span>
      </div>
    );
  }

  return <>{children}</>;
}

// --- Main Dispatcher ---
export function FileRenderer({ file, onFileClick }: FileRendererProps): JSX.Element {
  // Use detected type if the file type is unknown or generic
  const fileType = file.type === 'application/octet-stream' || !file.type 
    ? detectFileTypeFromUrl(file.url) 
    : file.type;

  console.log('FileRenderer: Processing file', { 
    name: file.name, 
    originalType: file.type, 
    detectedType: fileType, 
    url: file.url 
  });

  return (
    <FileRendererErrorBoundary file={file}>
      {fileType.startsWith('image/') ? (
        <ImagePreview file={{ ...file, type: fileType }} onFileClick={onFileClick} />
      ) : fileType === 'application/pdf' ? (
        <PdfPreview file={{ ...file, type: fileType }} />
      ) : (
        <GenericFile file={{ ...file, type: fileType }} />
      )}
    </FileRendererErrorBoundary>
  );
}

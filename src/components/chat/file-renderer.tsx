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

// Helper function to detect file type by making a GET request with Range header
async function detectFileTypeFromServer(url: string, token: string): Promise<string> {
  try {
    console.log('detectFileTypeFromServer: Making GET request with Range header to', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        Authorization: `Bearer ${token}`,
        Range: 'bytes=0-1023' // Only fetch first 1KB to get headers and detect type
      }
    });
    
    if (response.ok || response.status === 206) { // 206 is Partial Content
      const contentType = response.headers.get('content-type');
      console.log('detectFileTypeFromServer: Content-Type header:', contentType);
      
      // If we got a content type, use it
      if (contentType && contentType !== 'application/octet-stream') {
        return contentType;
      }
      
      // If content type is still unknown, try to detect from the actual content
      const blob = await response.blob();
      const detectedType = await detectFileTypeFromBlob(blob);
      console.log('detectFileTypeFromServer: Detected type from blob:', detectedType);
      return detectedType;
    } else if (response.status === 416) { // Range Not Satisfiable - try without Range header
      console.log('detectFileTypeFromServer: Range not supported, trying without Range header');
      return await detectFileTypeFromServerWithoutRange(url, token);
    } else {
      console.log('detectFileTypeFromServer: GET request failed with status', response.status);
      return 'application/octet-stream';
    }
  } catch (error) {
    console.error('detectFileTypeFromServer: Error making GET request:', error);
    return 'application/octet-stream';
  }
}

// Fallback function to detect file type without Range header
async function detectFileTypeFromServerWithoutRange(url: string, token: string): Promise<string> {
  try {
    console.log('detectFileTypeFromServerWithoutRange: Making GET request without Range header to', url);
    const response = await fetch(url, {
      method: 'GET',
      headers: { 
        Authorization: `Bearer ${token}`
      }
    });
    
    if (response.ok) {
      const contentType = response.headers.get('content-type');
      console.log('detectFileTypeFromServerWithoutRange: Content-Type header:', contentType);
      
      // If we got a content type, use it
      if (contentType && contentType !== 'application/octet-stream') {
        return contentType;
      }
      
      // If content type is still unknown, try to detect from the actual content
      // Only read first 1KB to avoid downloading large files
      const blob = await response.blob();
      const smallBlob = blob.slice(0, 1024);
      const detectedType = await detectFileTypeFromBlob(smallBlob);
      console.log('detectFileTypeFromServerWithoutRange: Detected type from blob:', detectedType);
      return detectedType;
    } else {
      console.log('detectFileTypeFromServerWithoutRange: GET request failed with status', response.status);
      return 'application/octet-stream';
    }
  } catch (error) {
    console.error('detectFileTypeFromServerWithoutRange: Error making GET request:', error);
    return 'application/octet-stream';
  }
}

// Helper function to detect file type from blob content
async function detectFileTypeFromBlob(blob: Blob): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arrayBuffer = reader.result as ArrayBuffer;
      const uint8Array = new Uint8Array(arrayBuffer);
      
      // Check magic bytes for common file types
      if (uint8Array.length >= 4) {
        // PNG: 89 50 4E 47
        if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
          resolve('image/png');
          return;
        }
        
        // JPEG: FF D8 FF
        if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
          resolve('image/jpeg');
          return;
        }
        
        // GIF: 47 49 46 38
        if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x38) {
          resolve('image/gif');
          return;
        }
        
        // PDF: 25 50 44 46
        if (uint8Array[0] === 0x25 && uint8Array[1] === 0x50 && uint8Array[2] === 0x44 && uint8Array[3] === 0x46) {
          resolve('application/pdf');
          return;
        }
        
        // WebP: 52 49 46 46 (RIFF) followed by 57 45 42 50 (WEBP)
        if (uint8Array.length >= 12 && 
            uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46 &&
            uint8Array[8] === 0x57 && uint8Array[9] === 0x45 && uint8Array[10] === 0x42 && uint8Array[11] === 0x50) {
          resolve('image/webp');
          return;
        }
      }
      
      resolve('application/octet-stream');
    };
    reader.readAsArrayBuffer(blob.slice(0, 1024)); // Only read first 1KB
  });
}

// Dynamic file type detection component for chat history files
function DynamicFileRenderer({ file, onFileClick }: FileRendererProps) {
  const [detectedType, setDetectedType] = useState<string>(file.type);
  const [isDetecting, setIsDetecting] = useState(false);
  const { token } = useJwtToken();

  useEffect(() => {
    // Only try to detect type if it's unknown or generic
    if (file.type === 'application/octet-stream' && token) {
      setIsDetecting(true);
      detectFileTypeFromServer(file.url, token)
        .then((detectedType) => {
          console.log('DynamicFileRenderer: Detected type:', detectedType);
          setDetectedType(detectedType);
          setIsDetecting(false);
        })
        .catch((error) => {
          console.error('DynamicFileRenderer: Failed to detect type:', error);
          setDetectedType(file.type);
          setIsDetecting(false);
        });
    }
  }, [file.url, file.type, token]);

  if (isDetecting) {
    return (
      <div className="w-full h-48 flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800 rounded-md">
        <Loader2 className="animate-spin size-6 text-zinc-500 mb-2" />
        <span className="text-xs text-muted-foreground">Detecting file type...</span>
      </div>
    );
  }

  // Use the detected type for rendering
  const fileWithDetectedType = { ...file, type: detectedType };

  return (
    <FileRendererErrorBoundary file={file}>
      {detectedType.startsWith('image/') ? (
        <ImagePreview file={fileWithDetectedType} onFileClick={onFileClick} />
      ) : detectedType === 'application/pdf' ? (
        <PdfPreview file={fileWithDetectedType} />
      ) : (
        <GenericFile file={fileWithDetectedType} />
      )}
    </FileRendererErrorBoundary>
  );
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
  // First try to detect type from URL extension
  const fileType = file.type === 'application/octet-stream' || !file.type 
    ? detectFileTypeFromUrl(file.url) 
    : file.type;

  console.log('FileRenderer: Processing file', { 
    name: file.name, 
    originalType: file.type, 
    detectedType: fileType, 
    url: file.url 
  });

  // If we still have unknown type and it looks like a chat history file (generic name), use dynamic detection
  if (fileType === 'application/octet-stream' && (file.name === 'download' || file.name === 'file')) {
    console.log('FileRenderer: Using DynamicFileRenderer for chat history file');
    return <DynamicFileRenderer file={file} onFileClick={onFileClick} />;
  }

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

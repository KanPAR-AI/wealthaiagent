import { MessageFile } from '@/types/chat';
import { Download, FileText, Maximize, TriangleAlert } from 'lucide-react';
import { JSX,useState } from 'react';    

interface FileRendererProps {
  file: MessageFile;
  onImageClick: (url: string) => void;
}

interface PdfPreviewProps {
    file: MessageFile;
}

// --- Individual File Preview Components ---

const ImagePreview: React.FC<FileRendererProps> = ({ file, onImageClick }) => {
    const [hasError, setHasError] = useState(false);

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
                src={file.url}
                alt={`Preview of ${file.name}`}
                className="max-w-full h-auto max-h-72 object-contain mx-auto"
                onError={() => setHasError(true)}
            />
            <div 
                className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => onImageClick(file.url!)}
            >
                <Maximize className="text-white" size={32} />
            </div>
        </div>
    );
};

const PdfPreview: React.FC<PdfPreviewProps> = ({ file }) => {
    // Using a simple iframe to let the browser handle the PDF rendering.
    // This is the simplest method with no external libraries.
    return (
        <div className="w-full h-[400px] border border-border rounded-md overflow-hidden">
            <iframe
                src={file.url}
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
      {file.url && (
         <a href={file.url} download={file.name} className="p-2 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md flex-shrink-0" title={`Download ${file.name}`}>
           <Download className="size-5" />
         </a>
       )}
    </div>
);


// --- Main Dispatcher Component ---

export function FileRenderer({ file, onImageClick }: FileRendererProps): JSX.Element {
  if (file.type.startsWith('image/')) { 
    return <ImagePreview file={file} onImageClick={onImageClick} />;
  }
  if (file.type === 'application/pdf' && file.url) {
    return <PdfPreview file={file} />;
  }
  return <GenericFile file={file} />;
}
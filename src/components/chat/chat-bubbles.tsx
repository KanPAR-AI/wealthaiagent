// src/components/chat/ChatBubble.tsx
import { ChatBubbleAvatar } from '@/components/ui/chat-bubble'; // Adjust path
import { Download, FileText } from 'lucide-react'; // Example icons
import React, { JSX, useEffect } from 'react';
import { Message } from '@/types/chat'; // Adjust path
import StructuredContentRenderer from '@/components/ui/structured-content-renderer';
// Type Definitions (ensure MessageFile matches ChatWindow's)


interface UserInfo {
  imageUrl?: string | null;
  firstName?: string | null;
}
interface ActionIconDef {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  type: string;
  action: (messageId: string) => void;
}

interface ChatBubbleProps {
  message: Message;
  currentUser: UserInfo | undefined;
  botAvatarSrc?: string;
  botAvatarFallback?: string;
  actionIcons: ActionIconDef[];
}

export function ChatBubble({
  message,
  currentUser,
  botAvatarSrc = "/logo.svg", // Default bot avatar
  botAvatarFallback = "AI",  // Default bot fallback
  actionIcons,
}: ChatBubbleProps): JSX.Element {
  const isUser = message.sender === 'user';
  const avatarSrc = isUser ? currentUser?.imageUrl : botAvatarSrc;
  const avatarFallback = isUser
    ? currentUser?.firstName?.substring(0, 2)?.toUpperCase() || 'U'
    : botAvatarFallback;

  useEffect(() => {
    const urlsToRevoke: string[] = [];
    message.files?.forEach(file => {
      if (file.url && file.url.startsWith('blob:')) {
        urlsToRevoke.push(file.url);
      }
    });

    return () => {
      urlsToRevoke.forEach(url => {
        URL.revokeObjectURL(url);
        // console.log(`REVOKED (ChatBubble): ${url} for ${message.id}`);
      });
    };
  }, [message.files, message.id]); // Add message.id to ensure effect reruns if message object identity changes but files are same

  return (
    <div key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[85%] md:max-w-[80%]`}>
        <div
          className={`px-3 py-2 md:px-4 md:py-2 rounded-2xl break-words text-sm md:text-base ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted dark:bg-zinc-700 dark:text-zinc-200'
          }`}
        >
          {message.isLoading ? (
            <span className="italic opacity-70">Loading...</span>
          ) : message.error ? (
            <span className="italic text-red-500">{message.error}</span>
          ) : (
            // Display message text, or null if no text but files exist, otherwise "..."
            message.message || (message.files && message.files.length > 0 ? null : <span className="italic opacity-70">...</span>)
          )}

          {/* File attachments with previews */}
          {message.files && message.files.length > 0 && (
            <div className={`mt-2 ${message.message || (message.files && message.files.length > 0 && !message.message) ? 'pt-2 border-t border-border/50' : ''} space-y-2`}>
              {message.files.map((file, index) => (
                <div
                  key={index}
                  className={`p-2 rounded-md text-white ${isUser ? 'bg-primary/80 dark:bg-primary/70' : 'bg-muted-foreground/10 dark:bg-zinc-600'} `}
                >
                  {file.url && file.type.startsWith('image/') ? (
                    <div className="flex flex-col items-center">
                      <img
                        src={file.url}
                        alt={`preview ${file.name}`}
                        className="max-w-full max-h-60 md:max-h-72 rounded-md object-contain border border-border bg-white dark:bg-zinc-500"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent && !parent.querySelector('.preview-error')) { // Prevent multiple error messages
                            const errorDiv = document.createElement('div');
                            errorDiv.className = "preview-error text-red-500 p-2 flex items-center gap-1 text-xs";
                            // Using Lucide icons directly in innerHTML is not recommended, build with React or use SVG string
                            errorDiv.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg> Preview unavailable`;
                            parent.appendChild(errorDiv);
                          }
                        }}
                      />
                      <a
                        href={file.url}
                        download={file.name}
                        className="mt-1 text-xs hover:underline flex items-center gap-1"
                        title={`Download ${file.name}`}
                      >
                        <Download className="size-3 flex-shrink-0" />
                        <span className="truncate">{file.name} ({Math.round(file.size / 1024)} KB)</span>
                      </a>
                    </div>
                  ) : file.url && file.type === 'application/pdf' ? (
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <FileText className={`size-8 flex-shrink-0 ${isUser ? 'text-primary-foreground/80' : 'text-muted-foreground dark:text-zinc-300'}`} />
                        <div className="flex-grow truncate">
                          <p className="font-medium truncate" title={file.name}>{file.name}</p>
                          <p className="text-xs opacity-80">{Math.round(file.size / 1024)} KB</p>
                        </div>
                      </div>
                       <a
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 text-xs hover:underline flex items-center gap-1 text-blue-600 dark:text-blue-100"
                        >
                          <Download className="size-3 flex-shrink-0" /> Open PDF
                        </a>
                      {/* <details className="mt-1">
                         <summary className="cursor-pointer text-xs text-blue-600 dark:text-blue-400 hover:underline">Show PDF Preview (Embed)</summary>
                         <embed src={file.url} type="application/pdf" width="100%" height="200px" className="mt-1 border border-border rounded bg-white" />
                       </details> */}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <FileText className={`size-6 flex-shrink-0 ${isUser ? 'text-primary-foreground/80' : 'text-muted-foreground dark:text-zinc-300'}`} />
                       <div className="flex-grow truncate">
                         <p className="font-medium truncate" title={file.name}>{file.name}</p>
                         <p className="text-xs opacity-80">{Math.round(file.size / 1024)} KB</p>
                       </div>
                      {file.url && (
                         <a href={file.url} download={file.name} className="ml-auto p-1 hover:bg-muted-foreground/20 rounded flex-shrink-0" title={`Download ${file.name}`}>
                           <Download className="size-4" />
                         </a>
                       )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {message.structuredContent && (
            <div className={message.message || (message.files && message.files.length > 0) ? 'mt-2 pt-2 border-t border-border/50' : 'mt-1'}>
              <StructuredContentRenderer content={message.structuredContent} />
            </div>
          )}

        

        {/* Action Buttons for Bot Messages */}
        {!isUser && !message.isLoading && !message.error && actionIcons && actionIcons.length > 0 && (
          <div className="flex gap-1 mt-2">
            {actionIcons.map(({ icon: Icon, type, action }) => (
              <button
                key={type}
                onClick={() => action(message.id)}
                title={type}
                className="p-1 hover:bg-secondary dark:hover:bg-zinc-600 rounded-md transition-colors text-muted-foreground hover:text-foreground dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                <Icon className="size-3.5" />
              </button>
            ))}
          </div>
        )}
      </div>

      {isUser && <ChatBubbleAvatar src={avatarSrc} fallback={avatarFallback} className="flex-shrink-0" />}
    </div>
  );
}
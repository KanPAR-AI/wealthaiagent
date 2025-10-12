// types/chat.ts

/**
 * Represents a single file attachment in a message.
 */
export interface MessageFile {
  name: string;
  type: string; // MIME type, e.g., 'image/png', 'application/pdf'
  size: number; // Size in bytes
  url: string; // Remote URL for preview or download (not optional for uploaded files)
}

/**
 * Defines the structure for a node in a graph.
 */
export interface GraphNode {
  id: string;
  label: string;
  [key: string]: any;
}

/**
 * Defines the structure for a link between nodes in a graph.
 */
export interface GraphLink {
  source: string;
  target: string;
  label?: string;
  [key: string]: any;
}

/**
 * Represents structured content of type 'graph'.
 */
export interface AiGraphContent {
  contentType: 'graph';
  graphType: 'bar' | 'pie' | 'line' | 'network'; // Supported graph types
  title: string;
  data: any[];
  options: {
    categoryKey: string;
    dataKeys: string[];
    colors?: string[];
    xAxisLabel?: string;
    yAxisLabel?: string;
  };
  description?: string;
}

/**
 * Represents structured content of type 'table'.
 */
export interface AiTableContent {
  contentType: 'table';
  title: string;
  data: Record<string, any>[];
  columns: {
    accessorKey: string;
    header: string;
  }[];
  description?: string;
}

/**
 * Union type for all possible structured content types.
 */
export type StructuredContent = AiGraphContent | AiTableContent;

/**
 * Widget data for rendering interactive components
 */
export interface Widget {
  id: string;
  type: string;
  title?: string;
  data: any;
  config?: any;
  sourceUrl?: string;
}

/**
 * Represents a single message in the chat.
 */
export interface Message {
  id: string;
  message: string; // The text content of the message (legacy field, kept for backward compatibility)
  sender: 'user' | 'bot';
  timestamp?: string;
  files?: MessageFile[]; // Array of attached files
  isLoading?: boolean; // Useful for initial sending state
  isStreaming?: boolean; // Indicates if the message content is actively being streamed
  streamingContent?: string; // Accumulated streaming content for real-time rendering
  streamingChunks?: string[]; // Individual chunks received (optional, for debugging)
  error?: string; // Error message if something went wrong
  structuredContent?: StructuredContent; // Structured data like graphs or tables
  widgets?: Widget[]; // Array of widgets to render (charts, tables, etc.)
}

/**
 * Represents a single chat session in the sidebar.
 */
export interface Chat {
  id: string;
  title: string;
  date?: string;
  isFavorite?: boolean;
}

/**
 * Defines user information needed for displaying avatars and names.
 */
export interface UserInfo {
  imageUrl?: string | null;
  firstName?: string | null;
}

/**
 * Defines an action icon for chat bubbles (e.g., copy, like, dislike).
 */
export interface ActionIconDefinition {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  type: string;
  action: (messageId: string) => void;
}

/**
 * Data for a single suggestion tile.
 */
export interface SuggestionTileData {
  id: number;
  title: string;
  description: string;
  useMockService?: boolean;
}

/**
 * Props for the main ChatWindow component.
 */
export interface ChatWindowProps {
  chatId?: string;
  onNewChatCreated?: (newChatId: string) => void;
  className?: string;
}

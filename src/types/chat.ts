// src/types/chat.ts

export type MessageSender = "user" | "bot";

export interface MessageFile {
  name: string;
  type: string;
  size: number;
  url?: string; // For blob: preview URLs for images/PDFs
}

// --- Definitions for Structured Content ---

export interface AiStructuredContentBase {
  title?: string;
  description?: string;
}

export type AiGraphType = 'pie' | 'bar' | 'line';

export interface AiGraphContent extends AiStructuredContentBase {
  contentType: 'graph';
  graphType: AiGraphType;
  /**
   * Data format for Recharts:
   * - Pie: { name: string, value: number }[] (categoryKey maps to 'name', first dataKey maps to 'value')
   * - Bar/Line: { categoryKey_value: string, dataKey1_value: number, dataKey2_value?: number ... }[]
   * Example: data: [{ month: 'Jan', sales: 100, expenses: 50 }, { month: 'Feb', ...}]
   * Here, categoryKey would be 'month', dataKeys would be ['sales', 'expenses']
   */
  data: Record<string, any>[];
  options: { // Made options required for clarity in chart components
    categoryKey: string; // Key in data objects for category axis or pie chart names
    dataKeys: string[];   // Keys in data objects for value axes or pie chart values (first one for pie)
    colors?: string[];     // Optional array of hex colors for series/slices
    xAxisLabel?: string;
    yAxisLabel?: string;
    // Additional specific options can be added if needed
  };
}

export interface AiTableContent extends AiStructuredContentBase {
  contentType: 'table';
  data: Record<string, any>[];
  columns?: {
    accessorKey: string;
    header: string;
  }[];
}

export type AiStructuredContentType = AiGraphContent | AiTableContent;

// --- Updated Message Interface ---
export interface Message {
  id: string;
  message: string; // Primary text message
  sender: MessageSender;
  structuredContent?: AiStructuredContentType;
  files?: MessageFile[];
  isLoading?: boolean;
  error?: string;
  timestamp?: string; // e.g., new Date().toISOString()
}
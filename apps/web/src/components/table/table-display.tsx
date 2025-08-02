// src/components/chat/structured-content/table/TableDisplay.tsx
import React from 'react';
import { AiTableContent } from '@/types/chat'; // Adjust path

interface TableDisplayProps {
  tableContent: AiTableContent;
  isFullScreen: boolean;
}

const TableDisplay: React.FC<TableDisplayProps> = ({ tableContent, isFullScreen }) => {
  const { data, columns: explicitColumns } = tableContent;

  if (!data || data.length === 0) {
    return <p className="text-muted-foreground italic my-2">No data available for the table.</p>;
  }

  const headers = explicitColumns
    ? explicitColumns.map(col => col.header)
    : Object.keys(data[0]);

  const columnAccessors = explicitColumns
    ? explicitColumns.map(col => col.accessorKey)
    : headers;

  return (
    <div className={`my-2 overflow-x-auto ${isFullScreen ? 'p-4' : ''}`}>
      <table className="min-w-full divide-y divide-gray-200 dark:divide-zinc-700 border border-gray-200 dark:border-zinc-700">
        <thead className="bg-gray-50 dark:bg-zinc-800">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                scope="col"
                className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-zinc-400 uppercase tracking-wider"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-zinc-900 divide-y divide-gray-200 dark:divide-zinc-700">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
              {columnAccessors.map((accessor, cellIndex) => (
                <td key={cellIndex} className="px-4 py-2 whitespace-nowrap text-sm text-gray-700 dark:text-zinc-300">
                  {String(row[accessor] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TableDisplay;
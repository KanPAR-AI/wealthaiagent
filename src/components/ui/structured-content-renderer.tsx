// src/components/chat/structured-content/StructuredContentRenderer.tsx
import React, { useState, Suspense, lazy } from 'react';
import { StructuredContent, AiGraphContent, AiTableContent } from '@/types/chat'; // Adjust path
import FullScreenViewer from './full-screen-viewer';
import { Maximize2 as ExpandIcon } from 'lucide-react'; // Assuming icon library

// Lazy load chart components
const PieChartDisplay = lazy(() => import('../charts/pie-chart-display'));
const BarChartDisplay = lazy(() => import('../charts/bar-chart-display'));
const LineChartDisplay = lazy(() => import('../charts/line-chart-dsiplay'));
const TableDisplay = lazy(() => import('../table/table-display'));
const ChartErrorFallback = lazy(() => import('../charts/error-fallback'));


interface StructuredContentRendererProps {
  content: StructuredContent;
}

const StructuredContentRenderer: React.FC<StructuredContentRendererProps> = ({ content }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  // No need for modalContent state if we always use the `content` prop for the modal

  const handleExpand = () => {
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  const renderContent = (isFullScreen: boolean) => {
    try {
      if (content.contentType === 'graph') {
        const graphContent = content as AiGraphContent;
        switch (graphContent.graphType) {
          case 'pie':
            return <PieChartDisplay chartData={graphContent} isFullScreen={isFullScreen} />;
          case 'bar':
            return <BarChartDisplay chartData={graphContent} isFullScreen={isFullScreen} />;
          case 'line':
            return <LineChartDisplay chartData={graphContent} isFullScreen={isFullScreen} />;
          default:
            return <ChartErrorFallback errorMessage={`Unsupported graph type: ${(graphContent as any).graphType}`} />;
        }
      } else if (content.contentType === 'table') {
        return <TableDisplay tableContent={content as AiTableContent} isFullScreen={isFullScreen} />;
      }
      return <p className="text-red-500">Unknown structured content type.</p>;
    } catch (error) {
      console.error("Error rendering structured content:", error);
      return <ChartErrorFallback errorMessage="An error occurred while rendering this content." />;
    }
  };

  return (
    <div className="mt-2 p-3 border border-gray-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800/30 shadow-sm">
      {content.title && <h3 className="text-md font-semibold mb-1 text-gray-800 dark:text-zinc-200">{content.title}</h3>}

      <div className="relative group">
        <Suspense fallback={<div className="h-64 flex items-center justify-center text-muted-foreground">Loading content...</div>}>
          {renderContent(false)}
        </Suspense>
        <button
          onClick={handleExpand}
          className="absolute top-1 right-1 p-1.5 bg-gray-200 dark:bg-zinc-700 hover:bg-gray-300 dark:hover:bg-zinc-600 rounded-full opacity-50 group-hover:opacity-100 transition-opacity"
          title="Expand to fullscreen"
          aria-label="Expand content to fullscreen"
        >
          <ExpandIcon className="w-4 h-4 text-gray-700 dark:text-zinc-300" />
        </button>
      </div>

      {content.description && (
        <p className="mt-2 text-xs text-gray-600 dark:text-zinc-400">{content.description}</p>
      )}

      <FullScreenViewer isOpen={isModalOpen} onClose={handleCloseModal} title={content.title}>
        {isModalOpen && ( // Only render content for modal when it's open
          <Suspense fallback={<div className="h-full flex items-center justify-center text-muted-foreground">Loading expanded view...</div>}>
            {renderContent(true)}
          </Suspense>
        )}
      </FullScreenViewer>
    </div>
  );
};

export default StructuredContentRenderer;
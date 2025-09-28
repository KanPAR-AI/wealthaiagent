import React from 'react';
import { AlertTriangle } from 'lucide-react'; // Assuming you have an icon library

interface ChartErrorFallbackProps {
  errorMessage?: string;
}

const ChartErrorFallback: React.FC<ChartErrorFallbackProps> = ({
  errorMessage = "Could not render chart due to invalid data or configuration.",
}) => {
  return (
    <div className="p-4 my-2 bg-red-100 border border-red-400 text-red-700 rounded-md text-sm flex items-center gap-2">
      <AlertTriangle className="w-5 h-5" />
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
      <span>{errorMessage}</span>
    </div>
  );
};

export default ChartErrorFallback;
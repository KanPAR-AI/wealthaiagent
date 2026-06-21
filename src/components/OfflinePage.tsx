import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';

const OfflinePage: React.FC = () => {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <WifiOff className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            You're Offline
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            It looks like you've lost your internet connection. Some features may not be available.
          </p>
        </div>
        
        <div className="space-y-4">
          <button
            onClick={handleRefresh}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2 px-4 rounded-lg flex items-center justify-center space-x-2 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
          
          <p className="text-sm text-gray-500 dark:text-gray-400">
            WealthWise AI will automatically reconnect when your internet connection is restored.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OfflinePage;

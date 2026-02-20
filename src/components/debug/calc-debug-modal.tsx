import React, { useState, useEffect } from 'react';
import { X, Copy, Check, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { getApiUrl } from '@/config/environment';
import { getStoredJwtToken } from '@/utils/jwt-storage';

interface CalcDebugModalProps {
  chatId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

const CalcDebugModal: React.FC<CalcDebugModalProps> = ({ chatId, isOpen, onClose }) => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen && chatId) {
      fetchDebugData();
    }
  }, [isOpen, chatId]);

  const fetchDebugData = async () => {
    if (!chatId) return;

    setLoading(true);
    setError(null);

    try {
      const token = getStoredJwtToken();
      const response = await fetch(getApiUrl(`/chats/${chatId}/debug`), {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'No debug data found for this chat');
      }
    } catch (err) {
      setError(`Failed to fetch: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (data) {
      await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-gray-900 rounded-lg shadow-xl w-[90vw] max-w-4xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">Calculation Debug Data</h2>
            <p className="text-sm text-gray-400">Chat: {chatId?.slice(0, 20)}...</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={!data}
              className="text-gray-300"
            >
              {copied ? <Check size={16} className="mr-1" /> : <Copy size={16} className="mr-1" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X size={20} />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin text-emerald-400" size={32} />
              <span className="ml-2 text-gray-400">Fetching debug data...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">
              {error}
            </div>
          )}

          {!loading && !error && data && (
            <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono bg-gray-800 rounded-lg p-4 overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          )}

          {!loading && !error && !data && (
            <div className="text-center py-12 text-gray-400">
              No calculation data available for this chat.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CalcDebugModal;

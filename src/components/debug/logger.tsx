import React, { useState, useEffect, useContext } from 'react';
import { LogContext, NetworkLog } from './log-context';
import { Search, Trash2, Download, Play, Pause, ChevronDown, ChevronRight, Copy } from 'lucide-react';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';

// Type definitions for props and internal state
interface LogEntryProps {
  log: NetworkLog;
  isExpanded: boolean;
  onToggleExpand: (logId: number) => void;
  onCopyToClipboard: (text: string) => void;
}

type RequestStatus = number | 'pending' | 'error';

// --- HELPER & UTILITY FUNCTIONS ---
const getStatusColor = (status: RequestStatus): string => {
  if (status === 'pending') return 'bg-yellow-500';
  if (status === 'error') return 'bg-red-500';
  if (typeof status === 'number') {
    if (status >= 200 && status < 300) return 'bg-green-500';
    if (status >= 300 && status < 400) return 'bg-blue-500';
    if (status >= 400) return 'bg-red-500';
  }
  return 'bg-gray-500';
};

const getMethodColor = (method: string): string => {
  const colors: Record<string, string> = {
    GET: 'bg-green-500', POST: 'bg-blue-500', PUT: 'bg-yellow-500',
    DELETE: 'bg-red-500', PATCH: 'bg-purple-500', OPTIONS: 'bg-gray-500',
    HEAD: 'bg-gray-500'
  };
  return colors[method] || 'bg-gray-500';
};

const formatTime = (timestamp: number) => new Date(timestamp).toLocaleTimeString();
const formatDuration = (duration: number | null) => duration ? `${duration}ms` : 'N/A';
const copyToClipboard = (text: string) => navigator.clipboard.writeText(text);


// --- MAIN COMPONENT ---
const NetworkLogger: React.FC = () => {
  const { logs, clearLogs, isLogging, toggleLogging } = useContext(LogContext);
  const [filteredLogs, setFilteredLogs] = useState<NetworkLog[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [expandedLogs, setExpandedLogs] = useState<Set<number>>(new Set());
  const navigate = useNavigate();

  // Filter logs when logs or filter term change
  useEffect(() => {
    if (!filter) {
      setFilteredLogs(logs);
    } else {
      const lowercasedFilter = filter.toLowerCase();
      setFilteredLogs(logs.filter(log =>
        log.url.toLowerCase().includes(lowercasedFilter) ||
        log.method.toLowerCase().includes(lowercasedFilter) ||
        log.status.toString().includes(lowercasedFilter)
      ));
    }
  }, [logs, filter]);

  const toggleExpanded = (logId: number) => {
    setExpandedLogs(prev => {
      const newExpanded = new Set(prev);
      
      // ✅ Corrected Logic
      if (newExpanded.has(logId)) {
        newExpanded.delete(logId);
      } else {
        newExpanded.add(logId);
      }
  
      return newExpanded;
    });
  };

  const exportLogs = () => {
    const dataStr = JSON.stringify(logs, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `network-logs-${new Date().toISOString()}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Calculate stats
  const stats = {
    total: logs.length,
    success: logs.filter(log => log.success === true).length,
    error: logs.filter(log => log.success === false).length,
    pending: logs.filter(log => log.status === 'pending').length,
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6 font-sans mx-auto max-w-7xl">
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8 flex items-center justify-between">
            <div className='flex gap-4 justify-center items-center'>
          <Button variant={"outline"} onClick={()=>navigate(-1)}>Back</Button>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-500 bg-clip-text text-transparent mb-2">
            Network Logger
          </h1>
          </div>
          <p className="text-gray-400">Monitoring all application network requests.</p>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-sm text-gray-400">Total</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{stats.success}</div>
            <div className="text-sm text-gray-400">Successful</div>
          </div>
          <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-red-400">{stats.error}</div>
            <div className="text-sm text-gray-400">Failed</div>
          </div>
           <div className="bg-gray-800 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
            <div className="text-sm text-gray-400">Pending</div>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6 items-center">
          <button onClick={toggleLogging} className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${isLogging ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'}`}>
            {isLogging ? <Pause size={16} /> : <Play size={16} />}
            {isLogging ? 'Pause' : 'Resume'}
          </button>
          <button onClick={clearLogs} className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors">
            <Trash2 size={16} /> Clear
          </button>
          <button onClick={exportLogs} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-medium transition-colors">
            <Download size={16} /> Export
          </button>
          <div className="flex-grow flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
            <Search size={18} className="text-gray-400" />
            <input type="text" placeholder="Filter by URL, method, or status..." value={filter} onChange={(e) => setFilter(e.target.value)} className="w-full bg-transparent border-none outline-none text-white placeholder-gray-400" />
          </div>
        </div>

        {/* Log List */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="max-h-[60vh] overflow-y-auto">
            {filteredLogs.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No network requests to display.</div>
            ) : (
              filteredLogs.map((log) => (
                <LogEntry
                  key={log.id}
                  log={log}
                  isExpanded={expandedLogs.has(log.id)}
                  onToggleExpand={toggleExpanded}
                  onCopyToClipboard={copyToClipboard}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- LOG ENTRY SUB-COMPONENT ---
const LogEntry: React.FC<LogEntryProps> = ({ log, isExpanded, onToggleExpand, onCopyToClipboard }) => {
    // A helper for rendering body content
    const renderBody = (body: any) => {
        if (!body) return 'null';
        if (body instanceof FormData) return 'FormData (inspect in browser DevTools)';
        if (body instanceof Blob) return 'Blob (binary data)';
        if (body instanceof ArrayBuffer) return 'ArrayBuffer (binary data)';
        if (typeof body === 'string') {
            try {
                // Try to parse and pretty-print if it's a JSON string
                return JSON.stringify(JSON.parse(body), null, 2);
            } catch {
                return body; // Return as-is if not JSON
            }
        }
        // For objects that are not strings (already parsed JSON)
        return JSON.stringify(body, null, 2);
    };

    return (
        <div className="border-b border-gray-700 last:border-b-0">
            {/* Summary Row */}
            <div className="p-4 hover:bg-gray-700/50 cursor-pointer flex items-center justify-between" onClick={() => onToggleExpand(log.id)}>
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <button className="text-gray-400 hover:text-white">{isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</button>
                    <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getMethodColor(log.method)}`}>{log.method}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium text-white ${getStatusColor(log.status)}`}>{log.status}</span>
                    <span className="text-white truncate flex-1">{log.url}</span>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-400 ml-4">
                    <span>{formatDuration(log.duration)}</span>
                    <span>{formatTime(log.startTime)}</span>
                </div>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-4 pb-4 pt-2 bg-gray-900/70">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Request Panel */}
                        <div>
                            <h4 className="text-lg font-semibold text-gray-300 mb-2">Request</h4>
                            <div className="space-y-3">
                                <DetailSection title="URL" content={log.url} onCopy={() => onCopyToClipboard(log.url)} />
                                {Object.keys(log.requestHeaders).length > 0 && <DetailSection title="Headers" content={JSON.stringify(log.requestHeaders, null, 2)} isCode />}
                                {log.requestBody && <DetailSection title="Body" content={renderBody(log.requestBody)} isCode />}
                            </div>
                        </div>

                        {/* Response/Error Panel */}
                        <div>
                           {log.error ? (
                                <>
                                    <h4 className="text-lg font-semibold text-red-400 mb-2">Error</h4>
                                    <DetailSection title="Message" content={log.error} isCode />
                                </>
                           ) : (
                                <>
                                    <h4 className="text-lg font-semibold text-gray-300 mb-2">Response</h4>
                                    <div className="space-y-3">
                                      {Object.keys(log.responseHeaders).length > 0 && <DetailSection title="Headers" content={JSON.stringify(log.responseHeaders, null, 2)} isCode />}
                                      {log.responseBody && <DetailSection title="Body" content={renderBody(log.responseBody)} isCode />}
                                    </div>
                                </>
                           )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- DETAIL SECTION SUB-COMPONENT ---
const DetailSection: React.FC<{title: string, content: string, onCopy?: () => void, isCode?: boolean}> = ({ title, content, onCopy, isCode }) => (
    <div>
        <div className="flex justify-between items-center mb-1">
            <h5 className="text-sm font-medium text-gray-400">{title}</h5>
            {onCopy && (
                 <button onClick={(e) => { e.stopPropagation(); onCopy(); }} className="text-emerald-400 hover:text-emerald-300">
                    <Copy size={14} />
                </button>
            )}
        </div>
        <div className="bg-gray-800 rounded p-3 text-sm max-h-60 overflow-y-auto">
            {isCode ? <pre className="text-white whitespace-pre-wrap break-all">{content}</pre> : <div className="text-white break-all">{content}</div>}
        </div>
    </div>
);

export default NetworkLogger;
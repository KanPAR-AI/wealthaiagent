import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Loader2, Copy, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getApiUrl } from '@/config/environment';
import { getStoredJwtToken } from '@/utils/jwt-storage';

interface SlotSchema {
  label: string;
  type: string;
}

interface SlotResponse {
  chat_id: string;
  domain: string;
  slots: Record<string, any>;
  sources: Record<string, string>;
  version: number;
  schema: Record<string, SlotSchema> | null;
}

function formatValue(value: any, type: string): string {
  if (value === null || value === undefined) return '--';
  if (type === 'float' && typeof value === 'number') {
    if (value >= 10000000) return `${(value / 10000000).toFixed(2)} Cr`;
    if (value >= 100000) return `${(value / 100000).toFixed(2)} L`;
    return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
  }
  return String(value);
}

const Debug: React.FC = () => {
  const { chatid } = useParams<{ chatid: string }>();
  const [data, setData] = useState<SlotResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clearing, setClearing] = useState(false);

  const fetchSlots = useCallback(async () => {
    if (!chatid) return;
    setLoading(true);
    setError(null);
    try {
      const token = getStoredJwtToken();
      const response = await fetch(
        getApiUrl(`/chats/${chatid}/slots?domain=real_estate`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${response.status}`);
      }
      const result: SlotResponse = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch slots');
    } finally {
      setLoading(false);
    }
  }, [chatid]);

  useEffect(() => {
    fetchSlots();
  }, [fetchSlots]);

  const copyToClipboard = async () => {
    if (!data) return;
    await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearSlots = async () => {
    if (!chatid || !confirm('Clear all slots for this chat? This resets to defaults.')) return;
    setClearing(true);
    try {
      const token = getStoredJwtToken();
      const response = await fetch(
        getApiUrl(`/chats/${chatid}/slots?domain=real_estate`),
        { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok && response.status !== 204) {
        throw new Error(`HTTP ${response.status}`);
      }
      await fetchSlots();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to clear slots');
    } finally {
      setClearing(false);
    }
  };

  const slots = data?.slots || {};
  const sources = data?.sources || {};
  const schema = data?.schema || {};
  const filledCount = Object.values(slots).filter(v => v !== null && v !== undefined).length;
  const totalCount = Object.keys(schema).length || Object.keys(slots).length;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b border-border/50">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={chatid ? `/chat/${chatid}` : '/new'}>
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-lg font-semibold">Slot Debug</h1>
              <p className="text-xs text-muted-foreground font-mono">
                {chatid ? `${chatid.slice(0, 24)}...` : 'No chat selected'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={copyToClipboard}
              disabled={!data || !Object.keys(slots).length}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearSlots}
              disabled={clearing || !filledCount}
              className="text-destructive hover:text-destructive"
            >
              {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Reset
            </Button>
            <Button variant="outline" size="sm" onClick={fetchSlots} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {loading && !data && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="animate-spin text-muted-foreground" size={28} />
            <span className="ml-2 text-muted-foreground">Loading slots...</span>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive text-sm">
            {error}
          </div>
        )}

        {data && (
          <>
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-6 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                Domain: <span className="font-medium text-foreground">{data.domain}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                Filled: <span className="font-medium text-foreground">{filledCount}/{totalCount}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted">
                Version: <span className="font-medium text-foreground">{data.version}</span>
              </span>
            </div>

            {/* Slot table */}
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 border-b border-border">
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Parameter</th>
                    <th className="text-right px-4 py-2.5 font-medium text-muted-foreground">Value</th>
                    <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden sm:table-cell">Source</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(schema).length > 0
                    ? Object.entries(schema).map(([key, meta]) => {
                        const value = slots[key];
                        const filled = value !== null && value !== undefined;
                        return (
                          <tr
                            key={key}
                            className={`border-b border-border/50 last:border-0 ${filled ? '' : 'opacity-50'}`}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium">{meta.label}</div>
                              <div className="text-xs text-muted-foreground font-mono">{key}</div>
                            </td>
                            <td className="px-4 py-3 text-right font-mono">
                              {filled ? (
                                <span className="text-foreground">{formatValue(value, meta.type)}</span>
                              ) : (
                                <span className="text-muted-foreground">--</span>
                              )}
                            </td>
                            <td className="px-4 py-3 hidden sm:table-cell">
                              {sources[key] ? (
                                <span className="text-xs text-muted-foreground font-mono">{sources[key]}</span>
                              ) : (
                                <span className="text-xs text-muted-foreground">--</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    : Object.entries(slots).map(([key, value]) => (
                        <tr key={key} className="border-b border-border/50 last:border-0">
                          <td className="px-4 py-3 font-mono">{key}</td>
                          <td className="px-4 py-3 text-right font-mono">{formatValue(value, 'float')}</td>
                          <td className="px-4 py-3 hidden sm:table-cell text-xs text-muted-foreground font-mono">
                            {sources[key] || '--'}
                          </td>
                        </tr>
                      ))}
                </tbody>
              </table>
            </div>

            {/* Raw JSON */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Raw JSON
              </summary>
              <pre className="mt-2 p-4 rounded-lg bg-muted text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                {JSON.stringify(data, null, 2)}
              </pre>
            </details>
          </>
        )}

        {data && !Object.keys(slots).length && !error && (
          <div className="text-center py-16 text-muted-foreground">
            No slots have been filled for this chat yet. Start a conversation about a property to see parameters accumulate here.
          </div>
        )}
      </div>
    </div>
  );
};

export default Debug;

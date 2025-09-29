import React, { useState, useEffect, useRef, ReactNode, useCallback } from 'react';
import { LogContext, type NetworkLog, type HttpMethod } from './log-context';

// --- HELPER REFS & ONE-TIME PATCHING LOGIC ---
const originalFetch = window.fetch;
const originalXHR = window.XMLHttpRequest;
let isPatched = false;

// --- PROVIDER COMPONENT ---
export const LogProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logs, setLogs] = useState<NetworkLog[]>(() => {
    try {
      const savedLogs = localStorage.getItem('network-logs');
      return savedLogs ? JSON.parse(savedLogs) : [];
    } catch (error) {
      console.error('Failed to read logs from localStorage:', error);
      return [];
    }
  });

  const [isLogging, setIsLogging] = useState<boolean>(true);

  // Use a ref to allow the patched functions to see the latest `isLogging` value
  const isLoggingRef = useRef(isLogging);
  useEffect(() => {
    isLoggingRef.current = isLogging;
  }, [isLogging]);

  // --- LOGGING ACTIONS ---
  const addLog = useCallback((log: NetworkLog) => {
    setLogs(prevLogs => [log, ...prevLogs]);
  }, []);

  const updateLog = useCallback((logId: number, updates: Partial<NetworkLog>) => {
    setLogs(prevLogs =>
      prevLogs.map(log => (log.id === logId ? { ...log, ...updates } : log))
    );
  }, []);

  const clearLogs = () => setLogs([]);
  const toggleLogging = () => setIsLogging(prev => !prev);

  // --- PERSISTENCE ---
  useEffect(() => {
    try {
      localStorage.setItem('network-logs', JSON.stringify(logs.slice(0, 100)));
    } catch (error) {
      console.error('Failed to save logs to localStorage:', error);
    }
  }, [logs]);


  // This synchronous, one-time patch prevents race conditions on app startup.
  if (!isPatched) {
    isPatched = true;

    // --- 1. Patch fetch API ---
    window.fetch = async (...args: Parameters<typeof fetch>): Promise<Response> => {
      // If logging is paused, just call the original fetch and exit.
      if (!isLoggingRef.current) {
        return Reflect.apply(originalFetch, window, args);
      }

      const startTime = Date.now();
      const [url, options = {}] = args;
      const method = (options.method || 'GET').toUpperCase() as HttpMethod;
      const logId = Date.now() + Math.random();

      addLog({
        id: logId, url: url.toString(), method, status: 'pending', startTime,
        endTime: null, duration: null, requestHeaders: (options.headers as Record<string, string>) || {},
        requestBody: options.body || null, responseHeaders: {}, responseBody: null,
        error: null, success: null, type: 'fetch'
      });

      try {
        const response = await Reflect.apply(originalFetch, window, args);
        const endTime = Date.now();
        const responseClone = response.clone();
        let responseBody: string | object | null = 'Could not parse response body';

        try {
          const contentType = response.headers.get('content-type');
          responseBody = contentType?.includes('application/json')
            ? await responseClone.json()
            : await responseClone.text();
        } catch {
            console.error("error in log provider")
        }

        const responseHeaders: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        updateLog(logId, {
          status: response.status, statusText: response.statusText, endTime,
          duration: endTime - startTime,
          responseHeaders,
          responseBody, success: response.ok
        });
        return response;
      } catch (error) {
        const endTime = Date.now();
        updateLog(logId, {
          status: 'error', endTime, duration: endTime - startTime,
          error: error instanceof Error ? error.message : 'Unknown fetch error',
          success: false
        });
        throw error;
      }
    };

    // --- 2. Patch XMLHttpRequest ---
    window.XMLHttpRequest = function(this: XMLHttpRequest) {
      const xhr = new originalXHR();
      
      // If logging is off, just return the real xhr instance immediately.
      if (!isLoggingRef.current) {
        return xhr;
      }

      const logId = Date.now() + Math.random();
      let startTime: number;
      let method: HttpMethod;
      let url: string;

      const originalOpen = xhr.open;
      const originalSend = xhr.send;

      // Use modern rest parameters instead of the 'arguments' object.
      xhr.open = function(...openArgs: [string, string | URL, ...any[]]) {
        const [_method, _url] = openArgs;
        startTime = Date.now();
        method = _method.toUpperCase() as HttpMethod;
        url = _url.toString();

        if (isLoggingRef.current) {
          addLog({
            id: logId, url, method, status: 'pending', startTime,
            endTime: null, duration: null, requestHeaders: {}, requestBody: null,
            responseHeaders: {}, responseBody: null, error: null, success: null, type: 'xhr'
          });
        }
        if (openArgs.length < 3) {
            openArgs[2] = true; // Default async to true if not provided
        }

        return originalOpen.apply(xhr, openArgs as any); // Cast as any to resolve final signature conflict
      
      };

      xhr.send = function(...sendArgs: [Document | XMLHttpRequestBodyInit | null | undefined]) {
        const [data] = sendArgs;
        let safeRequestBody: BodyInit | null = null;
        if (data) {
            if (data instanceof Document) {
                safeRequestBody = new XMLSerializer().serializeToString(data);
            } else {
                safeRequestBody = data as BodyInit;
            }
        }
        if (isLoggingRef.current) {
            updateLog(logId, { requestBody: safeRequestBody });
        }

        xhr.addEventListener('loadend', () => {
            if (isLoggingRef.current) {
                const endTime = Date.now();
                const responseHeaders = xhr.getAllResponseHeaders().split('\n').reduce((acc: Record<string, string>, header: string) => {
                    const [key, value] = header.split(':').map(s => s.trim());
                    if (key && value) acc[key] = value;
                    return acc;
                }, {});

                updateLog(logId, {
                    status: xhr.status, statusText: xhr.statusText, endTime,
                    duration: endTime - startTime, responseHeaders, responseBody: xhr.responseText,
                    success: xhr.status >= 200 && xhr.status < 300
                });
            }
        });

        xhr.addEventListener('error', () => {
          if (isLoggingRef.current) {
            const endTime = Date.now();
            updateLog(logId, {
                status: 'error', endTime, duration: endTime - startTime,
                error: 'XHR Network Error', success: false
            });
          }
        });

        return originalSend.apply(xhr, sendArgs);
      };

      return xhr;
    } as any;
  }

  return (
    <LogContext.Provider value={{ logs, clearLogs, isLogging, toggleLogging }}>
      {children}
    </LogContext.Provider>
  );
};
// services/massive-websocket.ts
// WebSocket service for Massive.com real-time stock data

export type MassiveEventType = 'AM' | 'T' | 'Q' | 'X'; // AM = Aggregate Minute, T = Trade, Q = Quote, X = Exchange

export interface MassiveAggregateMessage {
  ev: 'AM'; // Event type
  sym: string; // Symbol (e.g., "AAPL")
  v: number; // Volume
  av?: number; // Today's accumulated volume
  op?: number; // Today's official opening price
  vw?: number; // Volume weighted average price
  o: number; // Open price
  c: number; // Close price
  h: number; // High price
  l: number; // Low price
  a: number; // VWAP (Volume Weighted Average Price)
  z?: number; // Average trade size
  s: number; // Start timestamp (Unix ms)
  e: number; // End timestamp (Unix ms)
  otc?: boolean; // Whether this aggregate is for an OTC ticker
}

export interface MassiveTradeMessage {
  ev: 'T';
  sym: string;
  p: number; // Price
  s: number; // Size
  t: number; // Timestamp (Unix ms)
}

// Message can be a single message or an array of messages
export type MassiveMessage = MassiveAggregateMessage | MassiveTradeMessage;

export type MassiveConnectionStatus = 'disconnected' | 'connecting' | 'authenticating' | 'connected' | 'error';

export interface MassiveWebSocketCallbacks {
  onStatusChange?: (status: MassiveConnectionStatus) => void;
  onMessage?: (message: MassiveMessage) => void;
  onError?: (error: Error) => void;
  onReconnect?: () => void;
}

export class MassiveWebSocketService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private url: string;
  private callbacks: MassiveWebSocketCallbacks;
  private status: MassiveConnectionStatus = 'disconnected';
  private subscribedSymbols: Set<string> = new Set();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private connectionTimeout: NodeJS.Timeout | null = null;
  private authenticationTimeout: NodeJS.Timeout | null = null;
  private isManualClose = false;

  /**
   * Check if US stock market is currently open
   * Market hours: 9:30 AM - 4:00 PM ET (14:30 - 21:00 UTC)
   * Pre-market: 4:00 AM - 9:30 AM ET (9:00 - 14:30 UTC)
   * After-hours: 4:00 PM - 8:00 PM ET (21:00 - 1:00 UTC next day)
   * 
   * Note: This is a simplified check. Real market status depends on holidays, early closes, etc.
   */
  private isMarketOpen(): { isOpen: boolean; reason: string; shouldUseDelayed: boolean } {
    const now = new Date();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const dayOfWeek = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
    const month = now.getUTCMonth(); // 0 = January
    const date = now.getUTCDate();
    
    // Market is closed on weekends
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return { isOpen: false, reason: 'Market is closed (weekend)', shouldUseDelayed: true };
    }
    
    // Check for major US holidays (simplified - real implementation would need a holiday calendar)
    // Thanksgiving is typically 4th Thursday of November
    if (month === 10) { // November (0-indexed)
      const thanksgiving = this.getThanksgivingDate(now.getUTCFullYear());
      if (date === thanksgiving) {
        return { isOpen: false, reason: 'Market is closed (Thanksgiving holiday)', shouldUseDelayed: true };
      }
    }
    
    // Convert to ET (UTC-5 in winter, UTC-4 in summer - using UTC-5 as approximation)
    // ET is roughly UTC-5, so 9:30 AM ET = 14:30 UTC, 4:00 PM ET = 21:00 UTC
    const utcTime = utcHours * 60 + utcMinutes;
    const marketOpen = 14 * 60 + 30; // 14:30 UTC = 9:30 AM ET
    const marketClose = 21 * 60; // 21:00 UTC = 4:00 PM ET
    
    if (utcTime >= marketOpen && utcTime < marketClose) {
      return { isOpen: true, reason: 'Market is open', shouldUseDelayed: false };
    } else if (utcTime < marketOpen) {
      return { isOpen: false, reason: 'Market is closed (pre-market hours)', shouldUseDelayed: false };
    } else {
      return { isOpen: false, reason: 'Market is closed (after-hours)', shouldUseDelayed: false };
    }
  }

  /**
   * Calculate Thanksgiving date (4th Thursday of November)
   */
  private getThanksgivingDate(year: number): number {
    // November 1st
    const nov1 = new Date(Date.UTC(year, 10, 1));
    const dayOfWeek = nov1.getUTCDay(); // 0 = Sunday
    
    // Find first Thursday
    let firstThursday = 1;
    if (dayOfWeek <= 4) {
      // If Nov 1 is Sun-Thu, first Thursday is (4 - dayOfWeek + 1)
      firstThursday = 4 - dayOfWeek + 1;
    } else {
      // If Nov 1 is Fri-Sat, first Thursday is next week
      firstThursday = 4 - dayOfWeek + 8;
    }
    
    // 4th Thursday is 3 weeks after first Thursday
    return firstThursday + 21;
  }

  constructor(
    apiKey: string,
    useRealtime: boolean = true,
    callbacks: MassiveWebSocketCallbacks = {}
  ) {
    if (!apiKey || apiKey.trim() === '') {
      throw new Error('Massive.com API key is required');
    }
    this.apiKey = apiKey.trim();
    // Based on Massive.com documentation: https://massive.com/docs/websocket/quickstart
    // Real-time: wss://socket.massive.com/stocks
    // Delayed: wss://delayed.massive.com/stocks
    const baseUrl = useRealtime ? 'wss://socket.massive.com/stocks' : 'wss://delayed.massive.com/stocks';
    this.url = baseUrl;
    this.callbacks = callbacks;
    
    if (typeof window !== 'undefined') {
      if (window.location.protocol === 'http:') {
        console.warn('[MassiveWebSocket] Using HTTP - WebSocket connections may be blocked. Consider using HTTPS.');
      }
      
      // Check if we're in Firefox and log a helpful message
      const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
      if (isFirefox) {
        console.log('[MassiveWebSocket] Firefox detected - if connection fails, check about:config for network.http.spdy.websockets');
      }
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('[MassiveWebSocket] Already connected');
      return;
    }

    if (this.ws?.readyState === WebSocket.CONNECTING) {
      console.log('[MassiveWebSocket] Connection already in progress');
      return;
    }

    this.isManualClose = false;
    this.setStatus('connecting');

    console.log('[MassiveWebSocket] Attempting to connect to:', this.url);
    console.log('[MassiveWebSocket] API key present:', !!this.apiKey, 'Length:', this.apiKey?.length);
    console.log('[MassiveWebSocket] Protocol:', typeof window !== 'undefined' ? window.location.protocol : 'unknown');
    console.log('[MassiveWebSocket] User agent:', typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown');
    
    // Check market status
    const marketStatus = this.isMarketOpen();
    console.log('[MassiveWebSocket] Market status:', marketStatus.reason);
    
    // If market is closed and we should use delayed, suggest switching
    if (!marketStatus.isOpen && marketStatus.shouldUseDelayed && this.url.includes('realtime')) {
      console.warn('[MassiveWebSocket] Market is closed. Real-time endpoint may not be available.');
      console.warn('[MassiveWebSocket] Recommendation: Use delayed endpoint (wss://delayed.massive.com/stocks) when market is closed.');
      console.warn('[MassiveWebSocket] The delayed endpoint should work even when market is closed.');
    }

    try {
      // Check if WebSocket is supported
      if (typeof WebSocket === 'undefined') {
        throw new Error('WebSocket is not supported in this environment');
      }

      // Create WebSocket connection
      // Note: WebSocket URLs should NOT have trailing slashes
      const wsUrl = this.url.replace(/\/$/, ''); // Remove trailing slash if present
      console.log('[MassiveWebSocket] Connecting to:', wsUrl);
      
      this.ws = new WebSocket(wsUrl);
      
      // Log connection attempt
      console.log('[MassiveWebSocket] WebSocket instance created, readyState:', this.ws.readyState);
      
      // Set a timeout to detect if connection hangs
      this.connectionTimeout = setTimeout(() => {
        if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
          console.error('[MassiveWebSocket] Connection timeout after 10 seconds');
          this.ws.close();
          this.callbacks.onError?.(new Error('WebSocket connection timeout'));
        }
      }, 10000);
      
      // Clear timeout on successful connection
      this.ws.onopen = () => {
        if (this.connectionTimeout) {
          clearTimeout(this.connectionTimeout);
          this.connectionTimeout = null;
        }
        console.log('[MassiveWebSocket] Connected to', wsUrl);
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.authenticate();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onerror = (error) => {
        console.error('[MassiveWebSocket] WebSocket error:', error);
        // The error event doesn't provide much detail, but we'll log the readyState
        const readyState = this.ws?.readyState;
        const readyStateText = readyState === WebSocket.CONNECTING ? 'CONNECTING' :
                              readyState === WebSocket.OPEN ? 'OPEN' :
                              readyState === WebSocket.CLOSING ? 'CLOSING' :
                              readyState === WebSocket.CLOSED ? 'CLOSED' : 'UNKNOWN';
        console.error('[MassiveWebSocket] WebSocket readyState:', readyStateText, readyState);
        
        // Check if market is closed and provide helpful message
        const marketStatus = this.isMarketOpen();
        let errorMessage = `WebSocket connection error (state: ${readyStateText})`;
        if (!marketStatus.isOpen && this.url.includes('realtime')) {
          errorMessage += `. ${marketStatus.reason}. Try using delayed endpoint.`;
        }
        
        this.callbacks.onError?.(new Error(errorMessage));
        this.setStatus('error');
      };

      this.ws.onclose = (event) => {
        const closeCode = event.code;
        const closeReason = event.reason || 'No reason provided';
        const wasClean = event.wasClean;
        
        // Check market status for context
        const marketStatus = this.isMarketOpen();
        
        console.log('[MassiveWebSocket] Connection closed', {
          code: closeCode,
          reason: closeReason,
          wasClean,
          url: this.url,
          marketStatus: marketStatus.reason
        });
        
        // Handle 404 errors specifically - endpoint might not exist or need different path
        if (closeCode === 1006 || closeCode === 1002) {
          // 1006 = Abnormal closure (often means 404 or connection refused)
          // 1002 = Protocol error (can also indicate endpoint issues)
          console.error('[MassiveWebSocket] Connection failed - endpoint may not exist or be incorrect');
          console.error('[MassiveWebSocket] Current URL:', this.url);
          console.error('[MassiveWebSocket] This might indicate:');
          console.error('  1. The endpoint URL is incorrect');
          console.error('  2. The endpoint requires a path (e.g., /ws, /v1/ws)');
          console.error('  3. The endpoint requires authentication in the URL');
          console.error('  4. The service is temporarily unavailable');
          
          // Don't attempt reconnect for 404-like errors - they won't resolve
          if (!this.isManualClose) {
            this.setStatus('error');
            this.callbacks.onError?.(new Error(`WebSocket endpoint not found (404). URL: ${this.url}. Please verify the endpoint is correct.`));
          }
          return;
        }
        
        // If connection failed and market is closed, suggest using delayed endpoint
        if (!wasClean && !marketStatus.isOpen && this.url.includes('realtime') && closeCode === 1006) {
          console.warn('[MassiveWebSocket] Connection failed. Market is closed - real-time endpoint may not be available.');
          console.warn('[MassiveWebSocket] Suggestion: Use delayed endpoint (wss://delayed.massive.com/stocks) when market is closed.');
        }

        // Log close code meanings for debugging
        if (closeCode !== 1000) { // 1000 is normal closure
          const closeCodeMeanings: Record<number, string> = {
            1001: 'Going Away - Server is going down or browser is navigating away',
            1002: 'Protocol Error - Endpoint received invalid data',
            1003: 'Unsupported Data - Endpoint received data type it cannot accept',
            1006: 'Abnormal Closure - Connection closed without close frame',
            1007: 'Invalid Data - Endpoint received data that violates its policy',
            1008: 'Policy Violation - Generic policy violation',
            1009: 'Message Too Big - Message is too large to process',
            1010: 'Extension Error - Server terminated connection due to extension negotiation failure',
            1011: 'Internal Error - Server encountered unexpected condition',
            1012: 'Service Restart - Server is restarting',
            1013: 'Try Again Later - Temporary server condition',
            1014: 'Bad Gateway - Gateway received invalid response',
            1015: 'TLS Handshake - TLS handshake failure (cannot use close code)',
          };
          const meaning = closeCodeMeanings[closeCode] || 'Unknown close code';
          console.error(`[MassiveWebSocket] Close code ${closeCode}: ${meaning}`);
        }

        this.cleanup();
        
        if (!this.isManualClose) {
          // Only attempt reconnect if it wasn't a policy violation, authentication error, or 404-like error
          // 1006 and 1002 often indicate endpoint issues (404) and won't resolve with retries
          if (closeCode !== 1008 && closeCode !== 1003 && closeCode !== 1006 && closeCode !== 1002) {
            this.attemptReconnect();
          } else {
            console.error('[MassiveWebSocket] Not attempting reconnect due to close code:', closeCode);
            this.setStatus('error');
            this.callbacks.onError?.(new Error(`Connection closed: ${closeReason} (code: ${closeCode})`));
          }
        } else {
          this.setStatus('disconnected');
        }
      };
    } catch (error) {
      console.error('[MassiveWebSocket] Failed to create WebSocket:', error);
      this.callbacks.onError?.(error as Error);
      this.setStatus('error');
    }
  }

  /**
   * Authenticate with the API key
   * Based on Massive.com documentation: send { action: 'auth', params: API_KEY }
   */
  private authenticate(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('[MassiveWebSocket] Cannot authenticate: WebSocket not open');
      return;
    }

    this.setStatus('authenticating');
    
    const authMessage = {
      action: 'auth',
      params: this.apiKey,
    };

    try {
      this.ws.send(JSON.stringify(authMessage));
      console.log('[MassiveWebSocket] Authentication sent:', { action: 'auth', params: '***' });
      
      // Set a timeout for authentication - if no response in 10 seconds, consider it failed
      this.authenticationTimeout = setTimeout(() => {
        if (this.status === 'authenticating') {
          console.error('[MassiveWebSocket] Authentication timeout - no response received');
          this.callbacks.onError?.(new Error('Authentication timeout - no response from server'));
          this.setStatus('error');
          this.disconnect();
        }
      }, 10000);
    } catch (error) {
      console.error('[MassiveWebSocket] Failed to send authentication:', error);
      this.callbacks.onError?.(error as Error);
      if (this.authenticationTimeout) {
        clearTimeout(this.authenticationTimeout);
        this.authenticationTimeout = null;
      }
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: any = JSON.parse(data);

      // 🔍 DEBUG: always log raw message while testing
      console.log('[MassiveWebSocket] raw message:', message);

      // Handle authentication response
      // Based on Massive.com documentation and client library examples:
      // Authentication response is an array: [{ ev: 'status', status: 'auth_success' }]
      if (this.status === 'authenticating') {
        // Clear authentication timeout
        if (this.authenticationTimeout) {
          clearTimeout(this.authenticationTimeout);
          this.authenticationTimeout = null;
        }
        
        // Check if message is an array (common format from Massive.com)
        const authResponse = Array.isArray(message) ? message[0] : message;
        
        // Check if this is a status message
        if (authResponse?.ev === 'status') {
          const status = authResponse.status as string | undefined;
          
          // ✅ Treat any non-error status as a success
          const isSuccess =
            status &&
            !['auth_failed', 'error'].includes(status.toLowerCase());
          
          const isExplicitSuccess =
            ['auth_success', 'success', 'ok', 'connected'].includes(
              status?.toLowerCase() || ''
            );
          
          if (isSuccess) {
            console.log(
              '[MassiveWebSocket] Auth OK, status:',
              status,
              'message:',
              authResponse.message
            );
            this.setStatus('connected');
            this.startHeartbeat();
            
            // Resubscribe to previously subscribed symbols
            if (this.subscribedSymbols.size > 0) {
              this.resubscribe();
            }
            return;
          }
          
          // ❌ Explicit failure
          if (!isSuccess) {
            console.error(
              '[MassiveWebSocket] Authentication failed:',
              authResponse
            );
            this.callbacks.onError?.(new Error(
              `Authentication failed: ${status ?? 'unknown error'}`
            ));
            this.setStatus('error');
            this.disconnect();
            return;
          }
        }
        
        // If we're still authenticating and got a message that's not a status response, log it
        console.warn(
          '[MassiveWebSocket] Unexpected message during auth:',
          message
        );
        // Fall through - but don't try to forward as data yet
        return;
      }

      // After we are connected, forward data messages
      if (this.status === 'connected') {
        // Handle both single messages and arrays of messages
        if (Array.isArray(message)) {
          // Forward each message in the array
          message.forEach((msg: any) => {
            if (typeof msg === 'object' && 'ev' in msg) {
              this.callbacks.onMessage?.(msg as MassiveMessage);
            }
          });
        } else if (typeof message === 'object' && 'ev' in message) {
          // Forward single message
          this.callbacks.onMessage?.(message as MassiveMessage);
        }
      }
    } catch (error) {
      console.error('[MassiveWebSocket] Failed to parse message:', error, data);
    }
  }

  /**
   * Subscribe to aggregate minute bars for a symbol
   */
  subscribe(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[MassiveWebSocket] Cannot subscribe: WebSocket not open');
      // Queue subscription for when connection is ready
      this.subscribedSymbols.add(symbol);
      return;
    }

    if (this.status !== 'connected') {
      console.warn('[MassiveWebSocket] Cannot subscribe: Not authenticated');
      this.subscribedSymbols.add(symbol);
      return;
    }

    const subscribeMessage = {
      action: 'subscribe',
      params: `AM.${symbol.toUpperCase()}`,
    };

    try {
      this.ws.send(JSON.stringify(subscribeMessage));
      this.subscribedSymbols.add(symbol);
      console.log('[MassiveWebSocket] Subscribed to', symbol);
    } catch (error) {
      console.error('[MassiveWebSocket] Failed to subscribe:', error);
      this.callbacks.onError?.(error as Error);
    }
  }

  /**
   * Unsubscribe from a symbol
   */
  unsubscribe(symbol: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.subscribedSymbols.delete(symbol);
      return;
    }

    const unsubscribeMessage = {
      action: 'unsubscribe',
      params: `AM.${symbol.toUpperCase()}`,
    };

    try {
      this.ws.send(JSON.stringify(unsubscribeMessage));
      this.subscribedSymbols.delete(symbol);
      console.log('[MassiveWebSocket] Unsubscribed from', symbol);
    } catch (error) {
      console.error('[MassiveWebSocket] Failed to unsubscribe:', error);
    }
  }

  /**
   * Resubscribe to all previously subscribed symbols
   */
  private resubscribe(): void {
    const symbols = Array.from(this.subscribedSymbols);
    this.subscribedSymbols.clear();
    
    symbols.forEach(symbol => {
      this.subscribe(symbol);
    });
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[MassiveWebSocket] Max reconnect attempts reached');
      this.setStatus('error');
      this.callbacks.onError?.(new Error('Max reconnect attempts reached'));
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`[MassiveWebSocket] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  /**
   * Start heartbeat to keep connection alive
   */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    // Send a ping every 30 seconds
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        // Some WebSocket implementations support ping/pong
        // If not, we can send a lightweight message
        try {
          this.ws.send(JSON.stringify({ action: 'ping' }));
        } catch (error) {
          console.error('[MassiveWebSocket] Heartbeat failed:', error);
        }
      }
    }, 30000);
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Set connection status and notify callbacks
   */
  private setStatus(status: MassiveConnectionStatus): void {
    if (this.status !== status) {
      this.status = status;
      this.callbacks.onStatusChange?.(status);
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): MassiveConnectionStatus {
    return this.status;
  }

  /**
   * Get list of subscribed symbols
   */
  getSubscribedSymbols(): string[] {
    return Array.from(this.subscribedSymbols);
  }

  /**
   * Disconnect from the WebSocket
   */
  disconnect(): void {
    this.isManualClose = true;
    this.cleanup();
    
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.error('[MassiveWebSocket] Error closing WebSocket:', error);
      }
      this.ws = null;
    }
    
    this.setStatus('disconnected');
  }

  /**
   * Cleanup timers and resources
   */
  private cleanup(): void {
    this.stopHeartbeat();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = null;
    }
    
    if (this.authenticationTimeout) {
      clearTimeout(this.authenticationTimeout);
      this.authenticationTimeout = null;
    }
  }

  /**
   * Check if connected and authenticated
   */
  isConnected(): boolean {
    return this.status === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get current market status
   */
  getMarketStatus(): { isOpen: boolean; reason: string; shouldUseDelayed: boolean } {
    return this.isMarketOpen();
  }
}


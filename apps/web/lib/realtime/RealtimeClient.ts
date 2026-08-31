/**
 * NeuroMove Universal Real-Time WebSocket Client.
 *
 * Implements connection lifecycle management, exponential reconnect with jitter,
 * protocol handshakes (HELLO -> WELCOME), PING/PONG heartbeats, snapshot initialization,
 * sequence gap detection, and event deduplication.
 */

import {
  ClientLifecycleState,
  DataFreshness,
  EventEnvelope,
  OperatingMode,
  TransportMessage,
  TransportSnapshotPayload,
  TransportStream,
  TransportWelcomePayload,
} from "@neuromove/contracts";


export type MessageCallback = (msg: TransportMessage) => void;
export type EventCallback = (envelope: EventEnvelope) => void;
export type SnapshotCallback = (snapshot: TransportSnapshotPayload) => void;
export type StateChangeCallback = (state: ClientLifecycleState) => void;

export interface RealtimeClientOptions {
  url?: string;
  defaultStreams?: TransportStream[];
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  heartbeatIntervalMs?: number;
  autoConnect?: boolean;
}

export class RealtimeClient {
  private url: string;
  private ws: WebSocket | null = null;
  private state: ClientLifecycleState = "DISCONNECTED";

  private defaultStreams: Set<string>;
  private streamListeners: Map<string, Set<MessageCallback>> = new Map();
  private eventListeners: Set<EventCallback> = new Set();
  private snapshotListeners: Set<SnapshotCallback> = new Set();
  private stateListeners: Set<StateChangeCallback> = new Set();

  private welcomeData: TransportWelcomePayload | null = null;
  private latestSnapshot: TransportSnapshotPayload | null = null;
  private operatingMode: OperatingMode = "SIMULATION";

  // Reconnect & Jitter
  private reconnectBaseMs: number;
  private reconnectMaxMs: number;
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isExplicitlyClosed = false;

  // Heartbeat & Latency
  private heartbeatIntervalMs: number;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private lastPingSentTime: number | null = null;
  private latencyMs = 0;
  private lastMessageReceivedTime: number = Date.now();

  // Monotonic Sequencing & Gap Detection
  private highestTransportSeq = 0;
  private detectedGapsCount = 0;

  // Deduplication Cache (event_id:sequence -> timestamp)
  private processedEventKeys = new Map<string, number>();

  constructor(options: RealtimeClientOptions = {}) {
    const defaultApiUrl =
      typeof window !== "undefined"
        ? process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000"
        : "http://127.0.0.1:8000";

    const wsProtocol = defaultApiUrl.startsWith("https") ? "wss" : "ws";
    const wsHost = defaultApiUrl.replace(/^https?:\/\//, "");
    this.url = options.url || `${wsProtocol}://${wsHost}/ws/stream`;

    this.defaultStreams = new Set(
      options.defaultStreams || ["live", "robot", "safety", "eeg"]
    );
    this.reconnectBaseMs = options.reconnectBaseMs || 1000;
    this.reconnectMaxMs = options.reconnectMaxMs || 10000;
    this.heartbeatIntervalMs = options.heartbeatIntervalMs || 5000;

    if (options.autoConnect !== false && typeof window !== "undefined") {
      this.connect();
    }
  }

  public getState(): ClientLifecycleState {
    return this.state;
  }

  public getLatency(): number {
    return this.latencyMs;
  }

  public getMode(): OperatingMode {
    return this.operatingMode;
  }

  public getLatestSnapshot(): TransportSnapshotPayload | null {
    return this.latestSnapshot;
  }

  public getFreshness(maxFreshAgeMs = 2000): DataFreshness {
    if (this.state === "DISCONNECTED" || this.state === "CONNECTING") {
      return "DISCONNECTED";
    }
    const age = Date.now() - this.lastMessageReceivedTime;
    return age <= maxFreshAgeMs ? "FRESH" : "STALE";
  }

  public connect(): void {
    if (typeof window === "undefined") return;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    this.isExplicitlyClosed = false;
    this.setState("CONNECTING");

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.setState("CONNECTED");
        this.reconnectAttempts = 0;
        this.sendHelloHandshake();
        this.startHeartbeatLoop();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        this.handleRawMessage(event.data);
      };

      this.ws.onerror = (err) => {
        console.warn("[RealtimeClient] WebSocket error encountered:", err);
      };

      this.ws.onclose = () => {
        this.cleanupTimers();
        if (!this.isExplicitlyClosed) {
          this.setState("RECONNECTING");
          this.scheduleReconnect();
        } else {
          this.setState("DISCONNECTED");
        }
      };
    } catch (e) {
      console.error("[RealtimeClient] Connection failure:", e);
      this.setState("DISCONNECTED");
      this.scheduleReconnect();
    }
  }

  public disconnect(): void {
    this.isExplicitlyClosed = true;
    this.cleanupTimers();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setState("DISCONNECTED");
  }

  public subscribe(stream: TransportStream | string, callback: MessageCallback): () => void {
    if (!this.streamListeners.has(stream)) {
      this.streamListeners.set(stream, new Set());
    }
    this.streamListeners.get(stream)!.add(callback);

    // If already open, notify server of subscription
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.sendMessage({
        type: "SUBSCRIBE",
        timestamp: new Date().toISOString(),
        payload: { streams: Array.from(this.streamListeners.keys()) },
      });
    }

    return () => {
      this.unsubscribe(stream, callback);
    };
  }

  public unsubscribe(stream: TransportStream | string, callback: MessageCallback): void {
    const listeners = this.streamListeners.get(stream);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.streamListeners.delete(stream);
      }
    }
  }

  public onEvent(callback: EventCallback): () => void {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  public onSnapshot(callback: SnapshotCallback): () => void {
    this.snapshotListeners.add(callback);
    if (this.latestSnapshot) {
      callback(this.latestSnapshot);
    }
    return () => this.snapshotListeners.delete(callback);
  }

  public onStateChange(callback: StateChangeCallback): () => void {
    this.stateListeners.add(callback);
    callback(this.state);
    return () => this.stateListeners.delete(callback);
  }

  public requestSnapshot(): void {
    this.sendMessage({
      type: "SNAPSHOT",
      timestamp: new Date().toISOString(),
    });
  }

  private sendMessage(msg: TransportMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private sendHelloHandshake(): void {
    const streamsToRequest = Array.from(
      new Set([...this.defaultStreams, ...this.streamListeners.keys()])
    );
    this.sendMessage({
      type: "HELLO",
      timestamp: new Date().toISOString(),
      payload: {
        client_id: `client_web_${Math.random().toString(36).substring(2, 9)}`,
        client_name: "NeuroMove Web Command Center",
        client_version: "0.1.0",
        requested_streams: streamsToRequest,
      },
    });
  }

  private handleRawMessage(rawData: string): void {
    this.lastMessageReceivedTime = Date.now();

    try {
      const msg = JSON.parse(rawData) as TransportMessage;

      // Check sequence gap detection
      if (msg.transport_seq !== undefined && msg.transport_seq !== null) {
        if (this.highestTransportSeq > 0 && msg.transport_seq > this.highestTransportSeq + 1) {
          const missing = msg.transport_seq - this.highestTransportSeq - 1;
          this.detectedGapsCount += missing;
          console.warn(
            `[RealtimeClient] Transport sequence gap detected: expected ${this.highestTransportSeq + 1}, got ${msg.transport_seq} (${missing} missing)`
          );
        }
        if (msg.transport_seq > this.highestTransportSeq) {
          this.highestTransportSeq = msg.transport_seq;
        }
      }

      switch (msg.type) {
        case "WELCOME": {
          this.welcomeData = msg.payload as TransportWelcomePayload;
          if (this.welcomeData?.mode) {
            this.operatingMode = this.welcomeData.mode;
          }
          this.setState("STREAMING");
          break;
        }

        case "SNAPSHOT": {
          this.latestSnapshot = msg.payload as TransportSnapshotPayload;
          if (this.latestSnapshot?.mode) {
            this.operatingMode = this.latestSnapshot.mode;
          }
          for (const cb of this.snapshotListeners) {
            try {
              cb(this.latestSnapshot);
            } catch (e) {
              console.error("[RealtimeClient] Snapshot callback error:", e);
            }
          }
          break;
        }

        case "PING": {
          // Respond to server ping with pong
          this.sendMessage({
            type: "PONG",
            timestamp: new Date().toISOString(),
            payload: {
              client_time: msg.payload?.client_time || new Date().toISOString(),
              server_time: new Date().toISOString(),
              seq: msg.transport_seq || 0,
            },
          });
          break;
        }

        case "PONG": {
          if (this.lastPingSentTime) {
            this.latencyMs = Math.max(0, Date.now() - this.lastPingSentTime);
            this.lastPingSentTime = null;
          }
          break;
        }

        case "EVENT": {
          if (msg.event) {
            // Deduplicate event by event_id + sequence
            const dedupeKey = `${msg.event.event_id}:${msg.event.sequence}`;
            if (this.processedEventKeys.has(dedupeKey)) {
              return; // Ignore duplicate
            }
            this.processedEventKeys.set(dedupeKey, Date.now());

            // Bound deduplication cache size (retain last 1000 items)
            if (this.processedEventKeys.size > 1000) {
              const oldestKey = this.processedEventKeys.keys().next().value;
              if (oldestKey) this.processedEventKeys.delete(oldestKey);
            }

            for (const cb of this.eventListeners) {
              try {
                cb(msg.event);
              } catch (e) {
                console.error("[RealtimeClient] Event listener error:", e);
              }
            }
          }
          break;
        }

        case "ERROR": {
          console.warn("[RealtimeClient] Server transport error:", msg.payload);
          break;
        }
      }

      // Dispatch to stream-specific listeners
      if (msg.stream && this.streamListeners.has(msg.stream)) {
        for (const cb of this.streamListeners.get(msg.stream)!) {
          try {
            cb(msg);
          } catch (e) {
            console.error(`[RealtimeClient] Stream listener error (${msg.stream}):`, e);
          }
        }
      }

      // Dispatch to 'all' wildcard listeners
      if (this.streamListeners.has("all")) {
        for (const cb of this.streamListeners.get("all")!) {
          try {
            cb(msg);
          } catch (e) {
            console.error("[RealtimeClient] Wildcard listener error:", e);
          }
        }
      }
    } catch (e) {
      console.error("[RealtimeClient] Failed to parse message:", e);
    }
  }

  private startHeartbeatLoop(): void {
    this.cleanupHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.lastPingSentTime = Date.now();
        this.sendMessage({
          type: "PING",
          timestamp: new Date().toISOString(),
          payload: { client_time: new Date().toISOString(), seq: this.highestTransportSeq },
        });
      }
    }, this.heartbeatIntervalMs);
  }

  private scheduleReconnect(): void {
    if (this.isExplicitlyClosed) return;

    this.reconnectAttempts++;
    // Exponential backoff: base * 2^attempts with 20% random jitter
    const expBackoff = Math.min(
      this.reconnectMaxMs,
      this.reconnectBaseMs * Math.pow(1.5, this.reconnectAttempts)
    );
    const jitter = (Math.random() - 0.5) * 0.4 * expBackoff;
    const delay = Math.max(500, Math.round(expBackoff + jitter));

    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private setState(newState: ClientLifecycleState): void {
    if (this.state !== newState) {
      this.state = newState;
      for (const cb of this.stateListeners) {
        try {
          cb(newState);
        } catch (e) {
          console.error("[RealtimeClient] State callback error:", e);
        }
      }
    }
  }

  private cleanupTimers(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.cleanupHeartbeat();
  }

  private cleanupHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}

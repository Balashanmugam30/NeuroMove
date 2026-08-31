"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  ReactNode,
} from "react";
import {
  RealtimeClient,
  RealtimeClientOptions,
} from "@/lib/realtime/RealtimeClient";
import {
  ClientLifecycleState,
  DataFreshness,
  OperatingMode,
  TransportSnapshotPayload,
} from "@neuromove/contracts";

interface RealtimeContextValue {
  client: RealtimeClient | null;
  connectionState: ClientLifecycleState;
  latencyMs: number;
  operatingMode: OperatingMode;
  freshness: DataFreshness;
  latestSnapshot: TransportSnapshotPayload | null;
  connect: () => void;
  disconnect: () => void;
  requestSnapshot: () => void;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  client: null,
  connectionState: "DISCONNECTED",
  latencyMs: 0,
  operatingMode: "SIMULATION",
  freshness: "DISCONNECTED",
  latestSnapshot: null,
  connect: () => {},
  disconnect: () => {},
  requestSnapshot: () => {},
});

export function RealtimeProvider({
  children,
  options,
}: {
  children: ReactNode;
  options?: RealtimeClientOptions;
}) {
  const [client, setClient] = useState<RealtimeClient | null>(null);
  const [connectionState, setConnectionState] =
    useState<ClientLifecycleState>("DISCONNECTED");
  const [latencyMs, setLatencyMs] = useState<number>(0);
  const [operatingMode, setOperatingMode] =
    useState<OperatingMode>("SIMULATION");
  const [latestSnapshot, setLatestSnapshot] =
    useState<TransportSnapshotPayload | null>(null);
  const [freshness, setFreshness] = useState<DataFreshness>("DISCONNECTED");

  useEffect(() => {
    const rtClient = new RealtimeClient(options);
    setClient(rtClient);

    const unsubState = rtClient.onStateChange((st) => {
      setConnectionState(st);
      setFreshness(rtClient.getFreshness());
    });

    const unsubSnap = rtClient.onSnapshot((snap) => {
      setLatestSnapshot(snap);
      if (snap.mode) setOperatingMode(snap.mode);
    });

    const freshnessInterval = setInterval(() => {
      setFreshness(rtClient.getFreshness());
      setLatencyMs(rtClient.getLatency());
      setOperatingMode(rtClient.getMode());
    }, 1000);

    return () => {
      clearInterval(freshnessInterval);
      unsubState();
      unsubSnap();
      rtClient.disconnect();
    };
  }, [options]);

  const value = useMemo(
    () => ({
      client,
      connectionState,
      latencyMs,
      operatingMode,
      freshness,
      latestSnapshot,
      connect: () => client?.connect(),
      disconnect: () => client?.disconnect(),
      requestSnapshot: () => client?.requestSnapshot(),
    }),
    [
      client,
      connectionState,
      latencyMs,
      operatingMode,
      freshness,
      latestSnapshot,
    ]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime(): RealtimeContextValue {
  return useContext(RealtimeContext);
}

"use client";

import { useEffect, useState, useRef } from "react";
import { useRealtime } from "@/components/providers/RealtimeProvider";
import {
  EventEnvelope,
  TransportMessage,
  TransportStream,
} from "@neuromove/contracts";

export function useRealtimeStream<T = any>(
  stream: TransportStream | string,
  onMessage?: (msg: TransportMessage) => void
) {
  const { client, connectionState } = useRealtime();
  const [latestMessage, setLatestMessage] = useState<TransportMessage | null>(null);
  const [latestData, setLatestData] = useState<T | null>(null);
  const callbackRef = useRef(onMessage);

  useEffect(() => {
    callbackRef.current = onMessage;
  }, [onMessage]);

  useEffect(() => {
    if (!client) return;

    const unsub = client.subscribe(stream, (msg) => {
      setLatestMessage(msg);
      if (msg.event?.payload) {
        setLatestData(msg.event.payload as T);
      } else if (msg.payload) {
        setLatestData(msg.payload as T);
      }
      callbackRef.current?.(msg);
    });

    return () => {
      unsub();
    };
  }, [client, stream]);

  return {
    latestMessage,
    latestData,
    connectionState,
  };
}

export function useRealtimeEvents(onEvent?: (event: EventEnvelope) => void) {
  const { client } = useRealtime();
  const [events, setEvents] = useState<EventEnvelope[]>([]);
  const callbackRef = useRef(onEvent);

  useEffect(() => {
    callbackRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    if (!client) return;

    const unsub = client.onEvent((evt) => {
      setEvents((prev) => [evt, ...prev.slice(0, 49)]);
      callbackRef.current?.(evt);
    });

    return () => {
      unsub();
    };
  }, [client]);

  return { events };
}

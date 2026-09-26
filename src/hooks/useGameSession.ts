import { useCallback, useEffect, useRef, useState } from "react";

import type { GameSnapshot } from "@contracts/game.ts";

import { getGameSnapshot } from "../services/game-client.ts";
import { getSupabaseClient } from "../services/supabase-client.ts";

const ACTIVE_POLL_INTERVAL_MS = 3_000;

export function chooseNewerSnapshot(
  current: GameSnapshot | null,
  incoming: GameSnapshot,
): GameSnapshot {
  if (!current || incoming.revision >= current.revision) return incoming;
  return current;
}

export type GameSessionState = {
  snapshot: GameSnapshot | null;
  loading: boolean;
  refreshing: boolean;
  realtimeConnected: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
};

/**
 * Realtime is a notification channel only. Every notification, reconnect and
 * foreground transition pulls a newly validated, viewer-specific snapshot.
 */
export function useGameSession(roomId: string | null): GameSessionState {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [loading, setLoading] = useState(Boolean(roomId));
  const [refreshing, setRefreshing] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const activeRoomRef = useRef(roomId);
  const connectedRef = useRef(false);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    activeRoomRef.current = roomId;
    requestSequenceRef.current += 1;
    setSnapshot(null);
    setLoading(Boolean(roomId));
    setRefreshing(false);
    setRealtimeConnected(false);
    connectedRef.current = false;
    setError(null);
  }, [roomId]);

  const refresh = useCallback(async () => {
    const requestedRoomId = activeRoomRef.current;
    if (!requestedRoomId) return;
    const requestSequence = ++requestSequenceRef.current;
    setRefreshing(true);
    try {
      const incoming = await getGameSnapshot(requestedRoomId);
      if (activeRoomRef.current !== requestedRoomId) return;
      setSnapshot((current) => chooseNewerSnapshot(current, incoming));
      if (requestSequence === requestSequenceRef.current) setError(null);
    } catch (cause) {
      if (
        activeRoomRef.current !== requestedRoomId ||
        requestSequence < requestSequenceRef.current
      ) return;
      setError(cause instanceof Error ? cause : new Error("Could not refresh the game."));
    } finally {
      if (
        activeRoomRef.current === requestedRoomId &&
        requestSequence === requestSequenceRef.current
      ) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;
    let active = true;
    const supabase = getSupabaseClient();
    const channel = supabase
      .channel(`room:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "rooms",
          filter: `id=eq.${roomId}`,
        },
        () => {
          if (active) void refresh();
        },
      )
      .subscribe((status) => {
        if (!active) return;
        const connected = status === "SUBSCRIBED";
        connectedRef.current = connected;
        setRealtimeConnected(connected);
        if (connected) void refresh();
      });

    void refresh();
    const interval = window.setInterval(() => {
      if (
        active &&
        !connectedRef.current &&
        document.visibilityState === "visible"
      ) {
        void refresh();
      }
    }, ACTIVE_POLL_INTERVAL_MS);
    const refreshWhenActive = () => {
      if (active && document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("online", refreshWhenActive);
    window.addEventListener("focus", refreshWhenActive);
    document.addEventListener("visibilitychange", refreshWhenActive);

    return () => {
      active = false;
      connectedRef.current = false;
      window.clearInterval(interval);
      window.removeEventListener("online", refreshWhenActive);
      window.removeEventListener("focus", refreshWhenActive);
      document.removeEventListener("visibilitychange", refreshWhenActive);
      void supabase.removeChannel(channel);
    };
  }, [refresh, roomId]);

  return {
    snapshot,
    loading,
    refreshing,
    realtimeConnected,
    error,
    refresh,
  };
}

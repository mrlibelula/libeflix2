import { useCallback, useEffect, useRef, useState } from 'react';
import { router } from '@inertiajs/react';
import axios from 'axios';
import { usePolling } from '@/hooks/use-polling';
import type { PartyChatMessage, PartySnapshot, PartyVoiceSignal } from '@/types/party';

type Options = {
  code: string;
  initialSnapshot: PartySnapshot;
  onVoiceSignals?: (signals: PartyVoiceSignal[]) => void;
};

function theaterPathFor(code: string): string {
  return `/party/${code}`.replace(/\/$/, '').toLowerCase();
}

function urlLeavesTheater(href: string | URL, code: string): boolean {
  try {
    const url = href instanceof URL ? href : new URL(href, window.location.origin);
    if (url.origin !== window.location.origin) {
      return true;
    }
    const path = url.pathname.replace(/\/$/, '').toLowerCase();
    return path !== theaterPathFor(code);
  } catch {
    return true;
  }
}

function leaveViaBeacon(code: string): void {
  const token =
    document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '';
  const body = new FormData();
  body.append('_token', token);
  const url = route('party.leave', { code });

  if (typeof navigator.sendBeacon === 'function') {
    const queued = navigator.sendBeacon(url, body);
    if (queued) {
      return;
    }
  }

  void fetch(url, {
    method: 'POST',
    body,
    credentials: 'same-origin',
    keepalive: true,
  });
}

export function usePartySync({ code, initialSnapshot, onVoiceSignals }: Options) {
  const [snapshot, setSnapshot] = useState<PartySnapshot>(initialSnapshot);
  const [chatMessages, setChatMessages] = useState<PartyChatMessage[]>(initialSnapshot.chat || []);
  const sinceChatId = useRef(
    initialSnapshot.chat?.length ? Math.max(...initialSnapshot.chat.map((m) => m.id)) : 0
  );
  const sinceSignalId = useRef(0);
  const onVoiceSignalsRef = useRef(onVoiceSignals);
  const holdPlaybackUntil = useRef(0);
  const latestPlaybackPost = useRef(0);
  const hasLeftRef = useRef(false);

  useEffect(() => {
    onVoiceSignalsRef.current = onVoiceSignals;
  });

  const mergeSnapshot = useCallback((next: PartySnapshot) => {
    setSnapshot((prev) => {
      const holding = Date.now() < holdPlaybackUntil.current;
      return {
        ...next,
        playback: holding ? prev.playback : next.playback,
        current_item: holding
          ? prev.playback.current_queue_item_id === next.playback.current_queue_item_id
            ? prev.current_item
            : next.current_item
          : next.current_item,
        chat: prev.chat,
        voice_signals: [],
      };
    });

    if (next.chat?.length) {
      setChatMessages((prev) => {
        const map = new Map(prev.map((m) => [m.id, m]));
        next.chat.forEach((m) => map.set(m.id, m));
        const merged = Array.from(map.values()).sort((a, b) => a.id - b.id);
        sinceChatId.current = merged.length ? merged[merged.length - 1].id : sinceChatId.current;
        return merged;
      });
    }

    if (next.voice_signals?.length) {
      const last = next.voice_signals[next.voice_signals.length - 1];
      sinceSignalId.current = Math.max(sinceSignalId.current, last.id);
      onVoiceSignalsRef.current?.(next.voice_signals);
    }
  }, []);

  const fetchSync = useCallback(async () => {
    const { data } = await axios.get(route('api.party.sync', { code }), {
      params: {
        since_chat_id: sinceChatId.current || undefined,
        since_signal_id: sinceSignalId.current || undefined,
      },
    });
    if (data?.snapshot) {
      mergeSnapshot(data.snapshot as PartySnapshot);
    }
  }, [code, mergeSnapshot]);

  usePolling(fetchSync, { interval: 1200, enabled: true, immediate: false });

  const postPlayback = useCallback(
    async (payload: {
      is_playing?: boolean;
      position_seconds?: number;
      queue_item_id?: number;
    }) => {
      const postId = ++latestPlaybackPost.current;
      // Hold longer when changing play/pause so heartbeats/polls can't undo it
      const holdMs = typeof payload.is_playing === 'boolean' ? 2500 : 1200;
      holdPlaybackUntil.current = Date.now() + holdMs;

      setSnapshot((prev) => ({
        ...prev,
        playback: {
          ...prev.playback,
          is_playing:
            typeof payload.is_playing === 'boolean' ? payload.is_playing : prev.playback.is_playing,
          position_seconds:
            typeof payload.position_seconds === 'number'
              ? payload.position_seconds
              : prev.playback.position_seconds,
          current_queue_item_id:
            typeof payload.queue_item_id === 'number'
              ? payload.queue_item_id
              : prev.playback.current_queue_item_id,
          playback_updated_at: new Date().toISOString(),
        },
        current_item:
          typeof payload.queue_item_id === 'number'
            ? prev.queue.find((q) => q.id === payload.queue_item_id) || prev.current_item
            : prev.current_item,
      }));

      try {
        const { data } = await axios.post(route('api.party.playback', { code }), payload);
        if (postId !== latestPlaybackPost.current) {
          return;
        }
        if (data?.playback) {
          setSnapshot((prev) => ({
            ...prev,
            playback: {
              ...prev.playback,
              ...data.playback,
            },
          }));
          holdPlaybackUntil.current = Date.now() + 800;
        }
      } catch {
        // keep optimistic state; next poll will reconcile
      }
    },
    [code]
  );

  /** Position-only sync while playing — must NOT send is_playing or fight peers */
  const postPositionHeartbeat = useCallback(
    async (position: number) => {
      if (Date.now() < holdPlaybackUntil.current) {
        return;
      }
      // Silent: update server anchor without optimistic UI thrash / long holds
      try {
        await axios.post(route('api.party.playback', { code }), {
          position_seconds: position,
        });
      } catch {
        // ignore transient errors
      }
    },
    [code]
  );

  const sendChat = useCallback(
    async (body: string) => {
      const { data } = await axios.post(route('api.party.chat', { code }), { body });
      if (data?.message) {
        setChatMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          const next = [...prev, data.message as PartyChatMessage];
          sinceChatId.current = data.message.id;
          return next;
        });
      }
    },
    [code]
  );

  const addToQueue = useCallback(
    async (type: 'movie' | 'episode', id: number) => {
      await axios.post(route('api.party.queue.add', { code }), { type, id });
      await fetchSync();
    },
    [code, fetchSync]
  );

  const removeFromQueue = useCallback(
    async (itemId: number) => {
      await axios.delete(route('api.party.queue.remove', { code, item: itemId }));
      await fetchSync();
    },
    [code, fetchSync]
  );

  const updateSettings = useCallback(
    async (settings: Record<string, unknown>) => {
      await axios.patch(route('api.party.settings', { code }), settings);
      await fetchSync();
    },
    [code, fetchSync]
  );

  const leaveQuietly = useCallback(
    (mode: 'async' | 'beacon' = 'async') => {
      if (hasLeftRef.current) {
        return;
      }
      hasLeftRef.current = true;
      if (mode === 'beacon') {
        leaveViaBeacon(code);
        return;
      }
      void axios.post(route('party.leave', { code })).catch(() => {
        // Room may already be gone (deleted) or race with navigation.
      });
    },
    [code]
  );

  const leave = useCallback(async () => {
    if (hasLeftRef.current) {
      return;
    }
    hasLeftRef.current = true;
    try {
      await axios.post(route('party.leave', { code }));
    } catch {
      // ignore — already left or room ended
    }
  }, [code]);

  // Leaving the theater page (sidebar link, browser nav, tab close) counts as leave.
  useEffect(() => {
    hasLeftRef.current = false;

    const offBefore = router.on('before', (event) => {
      if (urlLeavesTheater(event.detail.visit.url, code)) {
        leaveQuietly('async');
      }
    });

    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.('a');
      if (!anchor || !(anchor instanceof HTMLAnchorElement) || !anchor.href) {
        return;
      }
      if (anchor.target === '_blank' || anchor.hasAttribute('download')) {
        return;
      }
      if (urlLeavesTheater(anchor.href, code)) {
        leaveQuietly('async');
      }
    };

    const onPageHide = () => {
      leaveQuietly('beacon');
    };

    document.addEventListener('click', onDocumentClick, true);
    window.addEventListener('pagehide', onPageHide);

    return () => {
      offBefore();
      document.removeEventListener('click', onDocumentClick, true);
      window.removeEventListener('pagehide', onPageHide);
      // Safety net when Inertia unmounts after a nav that skipped `before`/`click`.
      // Skip while still on this theater (React Strict Mode remount).
      if (urlLeavesTheater(window.location.href, code)) {
        leaveQuietly('beacon');
      }
    };
  }, [code, leaveQuietly]);

  const deleteRoom = useCallback(async () => {
    hasLeftRef.current = true;
    await axios.delete(route('party.destroy', { code }));
  }, [code]);

  const sendVoiceSignal = useCallback(
    async (toUserId: number, type: string, payload: Record<string, unknown>) => {
      await axios.post(route('api.party.voice', { code }), {
        to_user_id: toUserId,
        type,
        payload,
      });
    },
    [code]
  );

  return {
    snapshot,
    chatMessages,
    postPlayback,
    postPositionHeartbeat,
    sendChat,
    addToQueue,
    removeFromQueue,
    updateSettings,
    leave,
    deleteRoom,
    sendVoiceSignal,
    fetchSync,
  };
}

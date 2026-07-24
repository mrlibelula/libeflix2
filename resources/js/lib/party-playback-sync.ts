import { useCallback, useEffect, useRef, useState } from 'react';

export type PartyPlayerSync = {
  enabled: boolean;
  canControl: boolean;
  isPlaying: boolean;
  positionSeconds: number;
  playbackUpdatedAt: string | null;
  /** Play / pause / seek — always send both fields together */
  onTransport: (playing: boolean, position: number) => void;
  /** While playing, send position only (never is_playing). Prefer host-only. */
  onPositionHeartbeat?: (position: number) => void;
};

/** Only correct big desync / scrub while playing — tiny drift is normal and must not seek */
const PLAYING_SEEK_DRIFT_SECONDS = 5;
/** When paused, land on the same frame */
const PAUSED_SEEK_DRIFT_SECONDS = 0.5;
/** How often the host reports position (for late joiners) — not for live scrubbing */
const HEARTBEAT_INTERVAL_MS = 10000;

export function expectedPartyPosition(
  positionSeconds: number,
  isPlaying: boolean,
  playbackUpdatedAt: string | null,
  nowMs: number = Date.now()
): number {
  const base = Number(positionSeconds) || 0;
  if (!isPlaying || !playbackUpdatedAt) {
    return base;
  }
  const updatedMs = Date.parse(playbackUpdatedAt);
  if (Number.isNaN(updatedMs)) {
    return base;
  }
  return Math.max(0, base + (nowMs - updatedMs) / 1000);
}

type BridgeArgs = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  sync?: PartyPlayerSync | null;
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
};

/**
 * Bridges a local custom player to party room playback state.
 * While playing, the video clock runs freely; we only seek on real desync
 * (scrub / big drift) or play↔pause changes — never on routine heartbeats.
 */
export function usePartyPlaybackBridge({ videoRef, sync, isPlaying, setIsPlaying }: BridgeArgs) {
  const enabled = !!sync?.enabled;
  const remoteDepth = useRef(0);
  const holdUntil = useRef(0);
  const lastAppliedPlaying = useRef<boolean | null>(sync?.isPlaying ?? null);
  const lastHeartbeat = useRef(0);
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unlockedRef = useRef(false);
  const [needsTap, setNeedsTap] = useState(false);
  const needsTapRef = useRef(false);
  const syncRef = useRef(sync);
  const isPlayingRef = useRef(isPlaying);
  const applyGeneration = useRef(0);
  syncRef.current = sync;
  isPlayingRef.current = isPlaying;
  needsTapRef.current = needsTap;

  const isRemote = () => remoteDepth.current > 0 || Date.now() < holdUntil.current;

  const runRemote = useCallback(async (fn: () => void | Promise<void>) => {
    remoteDepth.current += 1;
    try {
      await fn();
      await new Promise((r) => setTimeout(r, 80));
    } finally {
      remoteDepth.current = Math.max(0, remoteDepth.current - 1);
    }
  }, []);

  const publishTransport = useCallback(
    (playing: boolean, position?: number) => {
      if (!enabled || !sync?.canControl) return;
      const video = videoRef.current;
      const pos = typeof position === 'number' ? position : video?.currentTime || 0;
      holdUntil.current = Date.now() + 2500;
      lastAppliedPlaying.current = playing;
      sync.onTransport(playing, pos);
    },
    [enabled, sync, videoRef]
  );

  const onLocalPlayPause = useCallback(
    (playing: boolean) => {
      if (!enabled) return;
      unlockedRef.current = true;
      setNeedsTap(false);
      publishTransport(playing);
    },
    [enabled, publishTransport]
  );

  const onLocalSeek = useCallback(
    (position: number, playing: boolean) => {
      if (!enabled || !sync?.canControl) return;
      if (seekTimer.current) {
        clearTimeout(seekTimer.current);
      }
      seekTimer.current = setTimeout(() => {
        publishTransport(playing, position);
      }, 220);
    },
    [enabled, publishTransport, sync?.canControl]
  );

  const applyRoomPlayback = useCallback(
    async (opts?: { force?: boolean; fromGesture?: boolean }) => {
      if (!enabled) return;
      const current = syncRef.current;
      const video = videoRef.current;
      if (!current || !video) return;

      if (!opts?.force && Date.now() < holdUntil.current) {
        lastAppliedPlaying.current = current.isPlaying;
        return;
      }

      // Already waiting on a user gesture — don't keep calling play() in a loop.
      if (
        current.isPlaying &&
        needsTapRef.current &&
        !opts?.force &&
        !opts?.fromGesture
      ) {
        lastAppliedPlaying.current = current.isPlaying;
        return;
      }

      const localPlaying = isPlayingRef.current;
      const playStateChanged = lastAppliedPlaying.current !== current.isPlaying;
      const wantPos = expectedPartyPosition(
        current.positionSeconds,
        current.isPlaying,
        current.playbackUpdatedAt
      );
      const absDrift = Math.abs((video.currentTime || 0) - wantPos);
      const driftLimit = current.isPlaying ? PLAYING_SEEK_DRIFT_SECONDS : PAUSED_SEEK_DRIFT_SECONDS;

      // Critical: do NOT seek just because the server timestamp changed (heartbeats).
      // Only seek on play/pause edges or when drift is large (scrub / real desync).
      const shouldSeek =
        opts?.force ||
        absDrift >= driftLimit ||
        (playStateChanged && absDrift > PAUSED_SEEK_DRIFT_SECONDS);

      const mediaMirrorsRoom = current.isPlaying ? !video.paused : video.paused;
      const shouldFixPlayState =
        opts?.force ||
        playStateChanged ||
        current.isPlaying !== localPlaying ||
        !mediaMirrorsRoom;

      if (!shouldSeek && !shouldFixPlayState) {
        return;
      }

      const generation = ++applyGeneration.current;

      await runRemote(async () => {
        if (generation !== applyGeneration.current) return;

        if (shouldSeek) {
          try {
            video.currentTime = wantPos;
          } catch {
            // media not ready
          }
        }

        if (current.isPlaying) {
          // Background tabs often reject play(); wait until visible instead of
          // forcing the "Watch together" gate while users are idle elsewhere.
          if (typeof document !== 'undefined' && document.hidden && !opts?.fromGesture) {
            lastAppliedPlaying.current = current.isPlaying;
            return;
          }

          setIsPlaying(true);
          try {
            await video.play();
            if (generation !== applyGeneration.current) return;
            unlockedRef.current = true;
            setNeedsTap(false);
          } catch {
            if (generation !== applyGeneration.current) return;
            // Only ask for a tap after a real autoplay rejection.
            setNeedsTap(true);
            setIsPlaying(false);
          }
        } else {
          setIsPlaying(false);
          if (!video.paused) {
            video.pause();
          }
          setNeedsTap(false);
        }

        lastAppliedPlaying.current = current.isPlaying;
      });
    },
    [enabled, runRemote, setIsPlaying, videoRef]
  );

  // Apply room play/pause; seek only when truly needed
  useEffect(() => {
    if (!enabled || !sync) return;
    void applyRoomPlayback();
  }, [
    applyRoomPlayback,
    enabled,
    isPlaying,
    sync,
    sync?.isPlaying,
    sync?.positionSeconds,
    sync?.playbackUpdatedAt,
  ]);

  // When returning from another tab/room, resume with the room — don't leave a stale gate up.
  useEffect(() => {
    if (!enabled) return;

    const onVisibility = () => {
      if (document.hidden) return;
      void applyRoomPlayback({ force: true });
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onVisibility);
    };
  }, [applyRoomPlayback, enabled]);

  // Any theater gesture can satisfy autoplay and clear the join gate.
  useEffect(() => {
    if (!enabled) return;

    const onGesture = () => {
      unlockedRef.current = true;
      const current = syncRef.current;
      const video = videoRef.current;
      if (!current?.isPlaying || !video) return;
      if (!video.paused && !needsTap) return;
      void applyRoomPlayback({ force: true, fromGesture: true });
    };

    document.addEventListener('pointerdown', onGesture);
    document.addEventListener('keydown', onGesture);
    return () => {
      document.removeEventListener('pointerdown', onGesture);
      document.removeEventListener('keydown', onGesture);
    };
  }, [applyRoomPlayback, enabled, needsTap, videoRef]);

  // Host position anchor for late joiners — infrequent, never forces scrubbing on peers
  useEffect(() => {
    if (!enabled || !sync?.canControl || !sync.onPositionHeartbeat) return;
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      const current = syncRef.current;
      if (!current?.isPlaying || video.paused || isRemote()) return;
      const now = Date.now();
      if (now - lastHeartbeat.current < HEARTBEAT_INTERVAL_MS) return;
      lastHeartbeat.current = now;
      // Do not hold/block local playback for heartbeats
      current.onPositionHeartbeat?.(video.currentTime || 0);
    };

    video.addEventListener('timeupdate', onTimeUpdate);
    return () => video.removeEventListener('timeupdate', onTimeUpdate);
  }, [enabled, sync?.canControl, sync?.onPositionHeartbeat, videoRef]);

  const joinPlayback = useCallback(async () => {
    if (!enabled || !sync) return;
    unlockedRef.current = true;
    holdUntil.current = Date.now() + 1500;
    await applyRoomPlayback({ force: true, fromGesture: true });
  }, [applyRoomPlayback, enabled, sync]);

  useEffect(() => {
    return () => {
      if (seekTimer.current) {
        clearTimeout(seekTimer.current);
      }
    };
  }, []);

  return {
    enabled,
    needsTap,
    joinPlayback,
    onLocalPlayPause,
    onLocalSeek,
    canControl: sync?.canControl ?? true,
  };
}

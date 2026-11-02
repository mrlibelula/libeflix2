import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';

export type AudioMode = 'original' | 'dialogue' | 'strong';

export const AUDIO_MODE_OPTIONS: ReadonlyArray<{ id: AudioMode; label: string }> = [
  { id: 'original', label: 'Original' },
  { id: 'dialogue', label: 'Dialogue' },
  { id: 'strong', label: 'Strong' },
];

const STORAGE_KEY = 'libeflix.audioMode';

type AudioModePreset = {
  lowShelfHz: number;
  lowShelfGainDb: number;
  presenceHz: number;
  presenceGainDb: number;
  presenceQ: number;
  threshold: number;
  knee: number;
  ratio: number;
  attack: number;
  release: number;
  makeupGain: number;
};

/** Tunable numbers for this 3.1 — adjust here without touching the players. */
const AUDIO_MODE_PRESETS: Record<Exclude<AudioMode, 'original'>, AudioModePreset> = {
  dialogue: {
    lowShelfHz: 110,
    lowShelfGainDb: -7,
    presenceHz: 2800,
    presenceGainDb: 3,
    presenceQ: 1,
    threshold: -24,
    knee: 12,
    ratio: 3,
    attack: 0.01,
    release: 0.25,
    makeupGain: 2,
  },
  strong: {
    lowShelfHz: 120,
    lowShelfGainDb: -12,
    presenceHz: 2800,
    presenceGainDb: 4,
    presenceQ: 1,
    threshold: -28,
    knee: 20,
    ratio: 6,
    attack: 0.005,
    release: 0.2,
    makeupGain: 2.8,
  },
};

type GraphNodes = {
  context: AudioContext;
  source: MediaElementAudioSourceNode;
  dryGain: GainNode;
  wetGain: GainNode;
  lowShelf: BiquadFilterNode;
  presence: BiquadFilterNode;
  compressor: DynamicsCompressorNode;
  makeup: GainNode;
  element: HTMLVideoElement;
};

function isAudioMode(value: string | null): value is AudioMode {
  return value === 'original' || value === 'dialogue' || value === 'strong';
}

function readStoredAudioMode(): AudioMode {
  if (typeof window === 'undefined') {
    return 'original';
  }

  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isAudioMode(stored) ? stored : 'original';
  } catch {
    return 'original';
  }
}

function applyPreset(nodes: GraphNodes, mode: AudioMode) {
  const { dryGain, wetGain, lowShelf, presence, compressor, makeup, context } = nodes;
  const now = context.currentTime;

  if (mode === 'original') {
    dryGain.gain.setTargetAtTime(1, now, 0.02);
    wetGain.gain.setTargetAtTime(0, now, 0.02);
    return;
  }

  const preset = AUDIO_MODE_PRESETS[mode];

  lowShelf.type = 'lowshelf';
  lowShelf.frequency.setTargetAtTime(preset.lowShelfHz, now, 0.02);
  lowShelf.gain.setTargetAtTime(preset.lowShelfGainDb, now, 0.02);

  presence.type = 'peaking';
  presence.frequency.setTargetAtTime(preset.presenceHz, now, 0.02);
  presence.Q.setTargetAtTime(preset.presenceQ, now, 0.02);
  presence.gain.setTargetAtTime(preset.presenceGainDb, now, 0.02);

  compressor.threshold.setTargetAtTime(preset.threshold, now, 0.02);
  compressor.knee.setTargetAtTime(preset.knee, now, 0.02);
  compressor.ratio.setTargetAtTime(preset.ratio, now, 0.02);
  compressor.attack.setTargetAtTime(preset.attack, now, 0.02);
  compressor.release.setTargetAtTime(preset.release, now, 0.02);
  makeup.gain.setTargetAtTime(preset.makeupGain, now, 0.02);

  dryGain.gain.setTargetAtTime(0, now, 0.02);
  wetGain.gain.setTargetAtTime(1, now, 0.02);
}

function createGraph(element: HTMLVideoElement): GraphNodes | null {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  const context = new AudioContextCtor();
  const source = context.createMediaElementSource(element);
  const dryGain = context.createGain();
  const wetGain = context.createGain();
  const lowShelf = context.createBiquadFilter();
  const presence = context.createBiquadFilter();
  const compressor = context.createDynamicsCompressor();
  const makeup = context.createGain();

  dryGain.gain.value = 1;
  wetGain.gain.value = 0;
  makeup.gain.value = 1;

  source.connect(dryGain);
  dryGain.connect(context.destination);

  source.connect(lowShelf);
  lowShelf.connect(presence);
  presence.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(wetGain);
  wetGain.connect(context.destination);

  return {
    context,
    source,
    dryGain,
    wetGain,
    lowShelf,
    presence,
    compressor,
    makeup,
    element,
  };
}

type UseDialogueAudioOptions = {
  /** Rebuild the graph when the video element remounts (e.g. audio language path). */
  sourceKey?: string;
  /** False while the main video is unmounted (closed episode dialog). */
  active?: boolean;
};

export function useDialogueAudio(
  videoRef: RefObject<HTMLVideoElement | null>,
  options: UseDialogueAudioOptions = {}
) {
  const { sourceKey = '', active = true } = options;
  const [audioMode, setAudioModeState] = useState<AudioMode>(() => readStoredAudioMode());
  const audioModeRef = useRef(audioMode);
  const graphRef = useRef<GraphNodes | null>(null);

  audioModeRef.current = audioMode;

  const tearDownGraph = useCallback(() => {
    const graph = graphRef.current;
    if (!graph) {
      return;
    }

    try {
      graph.source.disconnect();
      graph.dryGain.disconnect();
      graph.wetGain.disconnect();
      graph.lowShelf.disconnect();
      graph.presence.disconnect();
      graph.compressor.disconnect();
      graph.makeup.disconnect();
    } catch {
      // Nodes may already be disconnected when the element unmounts.
    }

    void graph.context.close().catch(() => undefined);
    graphRef.current = null;
  }, []);

  const ensureGraph = useCallback(() => {
    const element = videoRef.current;
    if (!element) {
      return null;
    }

    const existing = graphRef.current;
    if (existing && existing.element === element) {
      return existing;
    }

    // createMediaElementSource may only be called once per element. Only rebuild
    // when the video node itself changed (language switch remounts it).
    if (existing) {
      tearDownGraph();
    }

    try {
      const graph = createGraph(element);
      if (!graph) {
        return null;
      }
      graphRef.current = graph;
      applyPreset(graph, audioModeRef.current);
      return graph;
    } catch (error) {
      console.error('Failed to create dialogue audio graph:', error);
      return null;
    }
  }, [tearDownGraph, videoRef]);

  const resumeContext = useCallback(() => {
    const graph = ensureGraph();
    if (graph && graph.context.state === 'suspended') {
      void graph.context.resume().catch(() => undefined);
    }
  }, [ensureGraph]);

  const setAudioMode = useCallback((mode: AudioMode) => {
    setAudioModeState(mode);
    audioModeRef.current = mode;

    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Ignore quota / private-mode failures; in-memory mode still works.
    }

    const graph = graphRef.current ?? ensureGraph();
    if (graph) {
      applyPreset(graph, mode);
      if (graph.context.state === 'suspended') {
        void graph.context.resume().catch(() => undefined);
      }
    }
  }, [ensureGraph]);

  useEffect(() => {
    if (!active) {
      tearDownGraph();
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attachedElement: HTMLVideoElement | null = null;

    const handlePlay = () => {
      resumeContext();
    };

    const detachPlayListener = () => {
      if (attachedElement) {
        attachedElement.removeEventListener('play', handlePlay);
        attachedElement = null;
      }
    };

    const tryAttach = () => {
      if (cancelled) {
        return;
      }

      const element = videoRef.current;
      if (!element) {
        if (graphRef.current) {
          tearDownGraph();
        }
        if (attempts < 40) {
          attempts += 1;
          retryTimer = setTimeout(tryAttach, 50);
        }
        return;
      }

      const graph = ensureGraph();
      if (!graph) {
        return;
      }

      applyPreset(graph, audioModeRef.current);

      if (attachedElement !== element) {
        detachPlayListener();
        attachedElement = element;
        element.addEventListener('play', handlePlay);
      }

      if (!element.paused) {
        resumeContext();
      }
    };

    tryAttach();

    return () => {
      cancelled = true;
      if (retryTimer) {
        clearTimeout(retryTimer);
      }
      detachPlayListener();
    };
  }, [active, ensureGraph, resumeContext, sourceKey, tearDownGraph, videoRef]);

  useEffect(() => {
    return () => {
      tearDownGraph();
    };
  }, [tearDownGraph]);

  const audioModeLabel =
    AUDIO_MODE_OPTIONS.find((option) => option.id === audioMode)?.label ?? 'Original';

  return {
    audioMode,
    setAudioMode,
    audioModeLabel,
    audioModeOptions: AUDIO_MODE_OPTIONS,
  } as const;
}

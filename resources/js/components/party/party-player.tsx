import { useCallback, useMemo } from 'react';
import { Play } from 'lucide-react';
import { PlayMoviePlayer } from '@/components/ui/play-movie-player';
import { PlayEpisodeDialog } from '@/components/ui/play-episode-dialog';
import type { PartyQueueItem, PartySnapshot } from '@/types/party';
import type { PartyPlayerSync } from '@/lib/party-playback-sync';

type Props = {
  item: PartyQueueItem | null;
  queue: PartyQueueItem[];
  playback: PartySnapshot['playback'];
  canControl: boolean;
  isHost?: boolean;
  /** Host-only notice under the player. Disable when the parent keeps it outside sticky video. */
  showHostNotice?: boolean;
  onTransport: (playing: boolean, position: number) => void;
  onPositionHeartbeat: (position: number) => void;
  onEpisodeRepeatMode?: (mode: 'none' | 'one' | 'season' | 'tvshow') => void;
  /** Switch the room to a playlist item (controllers only). */
  onPlayQueueItem: (id: number) => void | Promise<void>;
  imgBaseUrl?: string;
};

export function PartyPlayer({
  item,
  queue,
  playback,
  canControl,
  isHost = false,
  showHostNotice = true,
  onTransport,
  onPositionHeartbeat,
  onEpisodeRepeatMode,
  onPlayQueueItem,
  imgBaseUrl = '',
}: Props) {
  const playlistNav = useMemo(() => {
    const currentId = playback.current_queue_item_id;
    const index = queue.findIndex((q) => q.id === currentId);
    const prev = index > 0 ? queue[index - 1] : null;
    const next = index >= 0 && index < queue.length - 1 ? queue[index + 1] : null;
    const first = queue[0] ?? null;
    return { prev, next, first, index };
  }, [playback.current_queue_item_id, queue]);

  const playItem = useCallback(
    (target: PartyQueueItem | null | undefined) => {
      if (!canControl || !target) return;
      void onPlayQueueItem(target.id);
    },
    [canControl, onPlayQueueItem]
  );

  const playNextInPlaylist = useCallback(() => {
    playItem(playlistNav.next);
  }, [playItem, playlistNav.next]);

  const playPreviousInPlaylist = useCallback(() => {
    playItem(playlistNav.prev);
  }, [playItem, playlistNav.prev]);

  /** When season/show repeat is on, loop the room playlist — not the TV series. */
  const loopPlaylistFromStart = useCallback(() => {
    playItem(playlistNav.first);
  }, [playItem, playlistNav.first]);

  if (!item) {
    return (
      <div className="flex aspect-video w-full min-w-0 max-w-full items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
        Pick something from the queue to get started
      </div>
    );
  }

  if (!item.can_play || !item.media) {
    return (
      <div className="flex aspect-video w-full min-w-0 max-w-full flex-col items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-center text-zinc-300">
        <p className="text-lg font-medium">{item.title}</p>
        <p className="text-sm text-zinc-400">
          You need an active membership to watch this title here.
        </p>
      </div>
    );
  }

  const partySync: PartyPlayerSync = useMemo(
    () => ({
      enabled: true,
      canControl,
      isPlaying: playback.is_playing,
      positionSeconds: playback.position_seconds,
      playbackUpdatedAt: playback.playback_updated_at,
      onTransport,
      // Only the host anchors position — prevents dual-heartbeat seek fights
      onPositionHeartbeat: isHost ? onPositionHeartbeat : undefined,
    }),
    [
      canControl,
      isHost,
      onPositionHeartbeat,
      onTransport,
      playback.is_playing,
      playback.playback_updated_at,
      playback.position_seconds,
    ]
  );

  const hostNotice =
    showHostNotice && !canControl ? (
      <p className="bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
        Only the host can control playback in this theater.
      </p>
    ) : null;

  const hasNextInPlaylist = Boolean(playlistNav.next);
  const hasPreviousInPlaylist = Boolean(playlistNav.prev);

  if (item.media.kind === 'movie' && item.media.movie && item.media.encFilePath) {
    return (
      <div className="w-full min-w-0 max-w-full overflow-hidden rounded-lg">
        <PlayMoviePlayer
          key={`party-movie-${item.id}-${item.media.encFilePath}`}
          movie={item.media.movie}
          encFilePath={item.media.encFilePath}
          imgBaseUrl={imgBaseUrl}
          autoPlay={false}
          partySync={partySync}
          className="max-w-full"
          onComplete={playNextInPlaylist}
        />
        {hostNotice}
      </div>
    );
  }

  if (item.media.kind === 'episode' && item.media.episode) {
    return (
      <div className="party-episode-player relative w-full min-w-0 max-w-full overflow-hidden">
        <PlayEpisodeDialog
          key={`party-episode-${item.id}`}
          episode={item.media.episode}
          tvshowName={item.media.tvshowName || 'TV Show'}
          tvshowId={item.media.tvshowId}
          tvshowSlug={item.media.tvshowSlug}
          totalSeasons={item.media.totalSeasons || 1}
          isOpen={true}
          embedded
          autoPlay={false}
          partySync={partySync}
          initialRepeatMode={playback.episode_repeat_mode || 'tvshow'}
          onRepeatModeChange={onEpisodeRepeatMode}
          hasNextEpisode={hasNextInPlaylist}
          hasPreviousEpisode={hasPreviousInPlaylist}
          onNextEpisode={playNextInPlaylist}
          onPreviousEpisode={playPreviousInPlaylist}
          onFirstEpisodeOfSeason={loopPlaylistFromStart}
          onFirstEpisodeOfTVShow={loopPlaylistFromStart}
          onComplete={playNextInPlaylist}
        />
        {hostNotice}
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-zinc-900 text-zinc-400">
      <Play className="size-8 opacity-50" />
      <p>This title can’t be played in the theater yet.</p>
    </div>
  );
}

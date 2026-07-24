import { Play } from 'lucide-react';
import { PlayMoviePlayer } from '@/components/ui/play-movie-player';
import { PlayEpisodeDialog } from '@/components/ui/play-episode-dialog';
import type { PartyQueueItem, PartySnapshot } from '@/types/party';
import type { PartyPlayerSync } from '@/lib/party-playback-sync';

type Props = {
  item: PartyQueueItem | null;
  playback: PartySnapshot['playback'];
  canControl: boolean;
  isHost?: boolean;
  onTransport: (playing: boolean, position: number) => void;
  onPositionHeartbeat: (position: number) => void;
  imgBaseUrl?: string;
};

export function PartyPlayer({
  item,
  playback,
  canControl,
  isHost = false,
  onTransport,
  onPositionHeartbeat,
  imgBaseUrl = '',
}: Props) {
  if (!item) {
    return (
      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-zinc-900 text-zinc-400">
        Pick something from the queue to get started
      </div>
    );
  }

  if (!item.can_play || !item.media) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg bg-zinc-900 px-6 text-center text-zinc-300">
        <p className="text-lg font-medium">{item.title}</p>
        <p className="text-sm text-zinc-400">
          You need an active membership to watch this title here.
        </p>
      </div>
    );
  }

  const partySync: PartyPlayerSync = {
    enabled: true,
    canControl,
    isPlaying: playback.is_playing,
    positionSeconds: playback.position_seconds,
    playbackUpdatedAt: playback.playback_updated_at,
    onTransport,
    // Only the host anchors position — prevents dual-heartbeat seek fights
    onPositionHeartbeat: isHost ? onPositionHeartbeat : undefined,
  };

  if (item.media.kind === 'movie' && item.media.movie && item.media.encFilePath) {
    return (
      <div className="w-full overflow-hidden rounded-lg">
        <PlayMoviePlayer
          key={`party-movie-${item.id}-${item.media.encFilePath}`}
          movie={item.media.movie}
          encFilePath={item.media.encFilePath}
          imgBaseUrl={imgBaseUrl}
          autoPlay={false}
          partySync={partySync}
        />
        {!canControl && (
          <p className="bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            Only the host can control playback in this theater.
          </p>
        )}
      </div>
    );
  }

  if (item.media.kind === 'episode' && item.media.episode) {
    return (
      <div className="party-episode-player relative w-full">
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
          hasNextEpisode={false}
          hasPreviousEpisode={false}
        />
        {!canControl && (
          <p className="bg-zinc-900 px-3 py-2 text-xs text-zinc-400">
            Only the host can control playback in this theater.
          </p>
        )}
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

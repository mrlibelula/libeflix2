import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PartyMember, PartySnapshot } from '@/types/party';

type Playback = PartySnapshot['playback'];
type RepeatMode = Playback['episode_repeat_mode'];

function memberLabel(member: Pick<PartyMember, 'user_id' | 'name'> | undefined, userId: number | null): string {
  if (member?.name?.trim()) {
    return member.name.trim();
  }
  if (userId) {
    return `User #${userId}`;
  }
  return 'Someone';
}

function repeatModeDescription(mode: RepeatMode): string {
  switch (mode) {
    case 'one':
      return 'Repeat current episode';
    case 'season':
      return 'Repeat this season';
    case 'tvshow':
      return 'Repeat entire TV show';
    case 'none':
    default:
      return 'Repeat turned off';
  }
}

/**
 * Toast everyone in the theater when shared episode repeat mode changes.
 */
export function usePartyEpisodeRepeatToast(
  playback: Playback,
  members: PartyMember[],
  localUserId: number
) {
  const prevRef = useRef<{ by: number | null; mode: RepeatMode } | null>(null);

  useEffect(() => {
    const by = playback.episode_repeat_updated_by ?? null;
    const mode = playback.episode_repeat_mode || 'tvshow';

    // First snapshot (including join into a room that already has a mode) — no toast.
    if (prevRef.current === null) {
      prevRef.current = { by, mode };
      return;
    }

    if (prevRef.current.by === by && prevRef.current.mode === mode) {
      return;
    }

    // Ignore empty attribution until someone actually changes repeat in this session.
    if (by === null && playback.episode_repeat_updated_at == null) {
      prevRef.current = { by, mode };
      return;
    }

    prevRef.current = { by, mode };

    const actor = members.find((m) => m.user_id === by);
    const who = by === localUserId ? 'You' : memberLabel(actor, by);

    toast.message(who === 'You' ? 'You changed repeat' : `${who} changed repeat`, {
      description: repeatModeDescription(mode),
      id: 'party-episode-repeat',
      duration: 4000,
    });
  }, [
    playback.episode_repeat_mode,
    playback.episode_repeat_updated_at,
    playback.episode_repeat_updated_by,
    members,
    localUserId,
  ]);
}

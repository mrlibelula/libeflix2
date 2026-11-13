import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PartyMember, PartySnapshot } from '@/types/party';

type Activity = PartySnapshot['activity'];

function memberLabel(member: Pick<PartyMember, 'user_id' | 'name'> | undefined, userId: number | null): string {
  if (member?.name?.trim()) {
    return member.name.trim();
  }
  if (userId) {
    return `User #${userId}`;
  }
  return 'Someone';
}

function whoLabel(by: number | null, members: PartyMember[], localUserId: number): string {
  if (by === localUserId) {
    return 'You';
  }
  return memberLabel(
    members.find((m) => m.user_id === by),
    by
  );
}

function settingsDescription(meta: Record<string, unknown>): string {
  const changes = Array.isArray(meta.changes) ? (meta.changes as string[]) : [];
  const labels: Record<string, string> = {
    name: 'name',
    host_only_controls: 'playback controls',
    allow_chat: 'chat',
    allow_voice: 'mic',
    is_public: 'lobby visibility',
    max_members: 'seat count',
  };
  const parts = changes.map((key) => labels[key] || key);
  return parts.length ? parts.join(', ') : 'Theater settings';
}

function titleFromMeta(meta: Record<string, unknown>): string {
  const title = typeof meta.title === 'string' ? meta.title.trim() : '';
  return title || 'Untitled';
}

/**
 * Toast shared theater actions: queue add/remove, now playing, settings.
 * Join/leave/ready and episode-repeat keep their dedicated hooks.
 */
export function usePartyActivityToast(
  activity: Activity | null | undefined,
  members: PartyMember[],
  localUserId: number
) {
  const prevAtRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const at = activity?.at ?? null;

    if (prevAtRef.current === undefined) {
      prevAtRef.current = at;
      return;
    }

    if (!activity || !at || at === prevAtRef.current || !activity.type) {
      prevAtRef.current = at;
      return;
    }

    prevAtRef.current = at;

    const who = whoLabel(activity.by, members, localUserId);
    const meta = activity.meta || {};
    const title = titleFromMeta(meta);

    switch (activity.type) {
      case 'queue_add':
        toast.message(who === 'You' ? 'You added to the queue' : `${who} added to the queue`, {
          description: title,
          id: 'party-activity-queue',
          duration: 4000,
        });
        break;
      case 'queue_remove':
        toast.message(who === 'You' ? 'You removed from the queue' : `${who} removed from the queue`, {
          description: title,
          id: 'party-activity-queue',
          duration: 4000,
        });
        break;
      case 'now_playing':
        toast.message(who === 'You' ? 'You started playing' : `${who} started playing`, {
          description: title,
          id: 'party-activity-now-playing',
          duration: 4000,
        });
        break;
      case 'settings':
        toast.message(who === 'You' ? 'You updated settings' : `${who} updated settings`, {
          description: settingsDescription(meta),
          id: 'party-activity-settings',
          duration: 4000,
        });
        break;
      default:
        break;
    }
  }, [activity, members, localUserId]);
}

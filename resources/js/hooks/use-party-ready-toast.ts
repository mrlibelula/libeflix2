import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import type { PartyMember } from '@/types/party';

function memberLabel(member: Pick<PartyMember, 'user_id' | 'name'>): string {
  return member.name?.trim() || `User #${member.user_id}`;
}

const LEAVE_TOAST_DELAY_MS = 2000;

/**
 * Notify everyone when the theater goes from solo → multi-person online
 * (and when a late joiner lands in an already-ready room),
 * plus when someone leaves the room.
 *
 * Leave toasts are briefly delayed so a refresh (leave + auto-rejoin)
 * does not flicker leave/join notifications.
 */
export function usePartyReadyToast(members: PartyMember[], localUserId: number) {
  const prevOnlineIdsRef = useRef<Set<number> | null>(null);
  const prevMembersRef = useRef<Map<number, Pick<PartyMember, 'user_id' | 'name'>> | null>(null);
  const pendingLeaveToastsRef = useRef(
    new Map<number, { timer: ReturnType<typeof setTimeout>; label: string }>()
  );

  useEffect(() => {
    return () => {
      for (const pending of pendingLeaveToastsRef.current.values()) {
        clearTimeout(pending.timer);
      }
      pendingLeaveToastsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const online = members.filter((m) => m.online);
    const onlineIds = new Set(online.map((m) => m.user_id));
    const onlineCount = onlineIds.size;
    const prev = prevOnlineIdsRef.current;
    const memberMap = new Map(
      members.map((m) => [m.user_id, { user_id: m.user_id, name: m.name }] as const)
    );
    const prevMembers = prevMembersRef.current;

    const announceReady = () => {
      const others = online.filter((m) => m.user_id !== localUserId);
      const description =
        onlineCount === 2 && others[0]
          ? `${memberLabel(others[0])} is here — you're synced and ready to play.`
          : `${onlineCount} people online — you're synced and ready to play.`;

      toast.success("Everyone's ready", {
        description,
        id: 'party-ready-synced',
        duration: 5500,
      });
    };

    if (prev === null || prevMembers === null) {
      prevOnlineIdsRef.current = onlineIds;
      prevMembersRef.current = memberMap;
      // Joiner (or refresh) into a room that already has multiple people online
      if (onlineCount >= 2) {
        announceReady();
      }
      return;
    }

    const crossedReady = prev.size < 2 && onlineCount >= 2;
    if (crossedReady) {
      announceReady();
    } else if (onlineCount >= 2) {
      const newcomers = online.filter((m) => !prev.has(m.user_id));
      for (const joiner of newcomers) {
        if (joiner.user_id === localUserId) {
          continue;
        }
        const pendingLeave = pendingLeaveToastsRef.current.get(joiner.user_id);
        if (pendingLeave) {
          clearTimeout(pendingLeave.timer);
          pendingLeaveToastsRef.current.delete(joiner.user_id);
          continue;
        }
        toast.message(`${memberLabel(joiner)} joined`, {
          description: 'Party stays in sync — ready when you are.',
          id: `party-joined-${joiner.user_id}`,
          duration: 4000,
        });
      }
    }

    for (const [userId, leaver] of prevMembers) {
      if (memberMap.has(userId) || userId === localUserId) {
        continue;
      }
      if (pendingLeaveToastsRef.current.has(userId)) {
        continue;
      }
      const label = memberLabel(leaver);
      const timer = setTimeout(() => {
        pendingLeaveToastsRef.current.delete(userId);
        toast.message(`${label} left`, {
          description: 'They left the party room.',
          id: `party-left-${userId}`,
          duration: 4000,
        });
      }, LEAVE_TOAST_DELAY_MS);
      pendingLeaveToastsRef.current.set(userId, { timer, label });
    }

    prevOnlineIdsRef.current = onlineIds;
    prevMembersRef.current = memberMap;
  }, [members, localUserId]);
}

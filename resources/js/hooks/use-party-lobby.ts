import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { usePolling } from '@/hooks/use-polling';
import type { PartyLobbyRoom } from '@/types/party';

type Options = {
  initialPublicRooms: PartyLobbyRoom[];
  initialMyRooms: PartyLobbyRoom[];
};

export function usePartyLobby({ initialPublicRooms, initialMyRooms }: Options) {
  const [publicRooms, setPublicRooms] = useState(initialPublicRooms);
  const [myRooms, setMyRooms] = useState(initialMyRooms);
  const [live, setLive] = useState(true);
  const [highlightIds, setHighlightIds] = useState<Set<number>>(new Set());
  const knownPublicIds = useRef(new Set(initialPublicRooms.map((r) => r.id)));
  const highlightTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      highlightTimers.current.forEach((timer) => clearTimeout(timer));
      highlightTimers.current.clear();
    };
  }, []);

  const flashNewRooms = useCallback((rooms: PartyLobbyRoom[]) => {
    const fresh: PartyLobbyRoom[] = [];
    for (const room of rooms) {
      if (!knownPublicIds.current.has(room.id)) {
        fresh.push(room);
      }
    }
    knownPublicIds.current = new Set(rooms.map((r) => r.id));

    if (fresh.length === 0) {
      return;
    }

    for (const room of fresh) {
      // Creator already knows — only notify other lobby viewers.
      if (room.is_host || room.is_member) {
        continue;
      }
      const host = room.host_name?.trim();
      toast.message('New theater opened', {
        description: host ? `“${room.name}” by ${host}` : `“${room.name}” is live in the lobby.`,
        id: `party-lobby-new-${room.id}`,
        duration: 4500,
      });
    }

    const freshIds = fresh.map((r) => r.id);

    setHighlightIds((prev) => {
      const next = new Set(prev);
      freshIds.forEach((id) => next.add(id));
      return next;
    });

    for (const id of freshIds) {
      const existing = highlightTimers.current.get(id);
      if (existing) {
        clearTimeout(existing);
      }
      const timer = setTimeout(() => {
        setHighlightIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        highlightTimers.current.delete(id);
      }, 4200);
      highlightTimers.current.set(id, timer);
    }
  }, []);

  const fetchLobby = useCallback(async () => {
    try {
      const { data } = await axios.get(route('api.party.lobby'));
      if (data?.publicRooms) {
        flashNewRooms(data.publicRooms as PartyLobbyRoom[]);
        setPublicRooms(data.publicRooms as PartyLobbyRoom[]);
      }
      if (data?.myRooms) {
        setMyRooms(data.myRooms as PartyLobbyRoom[]);
      }
      setLive(true);
    } catch {
      setLive(false);
    }
  }, [flashNewRooms]);

  usePolling(fetchLobby, { interval: 2500, enabled: true, immediate: false });

  const removeRoomLocally = useCallback((roomId: number) => {
    setPublicRooms((prev) => prev.filter((r) => r.id !== roomId));
    setMyRooms((prev) => prev.filter((r) => r.id !== roomId));
    knownPublicIds.current.delete(roomId);
  }, []);

  const deleteRoom = useCallback(
    async (code: string, roomId: number) => {
      removeRoomLocally(roomId);
      await axios.delete(route('party.destroy', { code }));
      await fetchLobby();
    },
    [fetchLobby, removeRoomLocally]
  );

  return {
    publicRooms,
    myRooms,
    live,
    highlightIds,
    deleteRoom,
    refresh: fetchLobby,
  };
}

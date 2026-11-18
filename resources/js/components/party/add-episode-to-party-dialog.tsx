import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from '@inertiajs/react';
import { LoaderCircle, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { PartyLobbyRoom } from '@/types/party';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  episodeId: number | null;
  episodeLabel?: string;
  excludeRoomCode?: string | null;
};

export function AddEpisodeToPartyDialog({
  open,
  onOpenChange,
  episodeId,
  episodeLabel,
  excludeRoomCode = null,
}: Props) {
  const [rooms, setRooms] = useState<PartyLobbyRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingCode, setAddingCode] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(route('api.party.lobby'));
      const myRooms: PartyLobbyRoom[] = Array.isArray(data?.myRooms) ? data.myRooms : [];
      const exclude = excludeRoomCode?.toUpperCase() ?? null;
      setRooms(
        myRooms.filter((room) => {
          if (exclude && room.code?.toUpperCase() === exclude) {
            return false;
          }
          return true;
        })
      );
    } catch (error) {
      console.error('Failed to load party rooms:', error);
      toast.error('Could not load your party rooms');
      setRooms([]);
    } finally {
      setLoading(false);
    }
  }, [excludeRoomCode]);

  useEffect(() => {
    if (!open) {
      setAddingCode(null);
      return;
    }
    loadRooms();
  }, [open, loadRooms]);

  const handleAdd = async (room: PartyLobbyRoom) => {
    if (!episodeId || !room.can_control || addingCode) {
      return;
    }

    setAddingCode(room.code);
    try {
      await axios.post(route('api.party.queue.add', { code: room.code }), {
        type: 'episode',
        id: episodeId,
      });
      toast.success(`Added to “${room.name}”`, {
        description: episodeLabel || undefined,
        action: {
          label: 'Open',
          onClick: () => {
            window.location.href = route('party.theater', { code: room.code });
          },
        },
      });
      onOpenChange(false);
    } catch (error: any) {
      const message =
        error?.response?.data?.message ||
        error?.response?.data?.error ||
        'Could not add episode to that room';
      toast.error(message);
    } finally {
      setAddingCode(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-neutral-900 border-neutral-700 text-white z-[70]">
        <DialogHeader>
          <DialogTitle>Add to party room</DialogTitle>
          <DialogDescription className="text-neutral-400">
            {episodeLabel
              ? `Choose a room to queue “${episodeLabel}”.`
              : 'Choose a room to queue this episode.'}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-72 overflow-y-auto space-y-2 py-1">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-neutral-400">
              <LoaderCircle className="w-5 h-5 animate-spin mr-2" />
              Loading rooms…
            </div>
          ) : rooms.length === 0 ? (
            <div className="rounded-md border border-neutral-700 bg-neutral-800/60 px-4 py-6 text-center text-sm text-neutral-300">
              <p className="mb-3">You are not in any party rooms yet.</p>
              <Button asChild variant="secondary" size="sm">
                <Link href={route('party.index')}>Go to Party lobby</Link>
              </Button>
            </div>
          ) : (
            rooms.map((room) => {
              const disabled = !room.can_control || addingCode === room.code;
              return (
                <button
                  key={room.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleAdd(room)}
                  className={`w-full rounded-md border px-3 py-2.5 text-left transition-colors ${
                    room.can_control
                      ? 'border-neutral-700 bg-neutral-800 hover:border-rose-500/60 hover:bg-neutral-800/80'
                      : 'border-neutral-800 bg-neutral-900/50 opacity-60 cursor-not-allowed'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-medium text-white">{room.name}</div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-neutral-400">
                        <span className="uppercase tracking-wide">{room.code}</span>
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {room.member_count}/{room.max_members}
                        </span>
                      </div>
                      {!room.can_control && (
                        <div className="mt-1 text-xs text-amber-400">Host-only queue</div>
                      )}
                    </div>
                    {addingCode === room.code ? (
                      <LoaderCircle className="w-4 h-4 animate-spin text-rose-500 flex-shrink-0" />
                    ) : room.can_control ? (
                      <span className="text-xs text-rose-400 flex-shrink-0">Add</span>
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

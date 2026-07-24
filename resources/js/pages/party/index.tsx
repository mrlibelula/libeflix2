import { FormEvent, useState } from 'react';
import { Head, router, useForm } from '@inertiajs/react';
import {
  Clapperboard,
  DoorOpen,
  Globe2,
  Lock,
  Play,
  Radio,
  Trash2,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePartyLobby } from '@/hooks/use-party-lobby';
import { cn } from '@/lib/utils';
import type { PartyLobbyRoom } from '@/types/party';
import type { BreadcrumbItem } from '@/types';

type Props = {
  publicRooms: PartyLobbyRoom[];
  myRooms: PartyLobbyRoom[];
  absoluteMaxMembers: number;
};

const breadcrumbs: BreadcrumbItem[] = [{ title: 'Party Theater', href: '/party' }];

function OccupancyBar({ count, max }: { count: number; max: number }) {
  const pct = Math.min(100, Math.round((count / Math.max(max, 1)) * 100));

  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-800">
      <div
        className={cn(
          'h-full rounded-full transition-all duration-500',
          pct >= 100 ? 'bg-rose-500' : pct >= 70 ? 'bg-amber-400' : 'bg-emerald-400'
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function RoomCard({
  room,
  highlighted,
  onEnter,
  onDelete,
}: {
  room: PartyLobbyRoom;
  highlighted?: boolean;
  onEnter: () => void;
  onDelete?: () => void;
}) {
  const isPaused = Boolean(room.is_paused || room.status === 'paused');
  const canEnter = isPaused || !room.is_full || Boolean(room.is_member);

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-zinc-950/60 p-4 transition-all duration-300',
        'hover:border-zinc-600 hover:bg-zinc-900/80',
        highlighted && 'animate-in fade-in zoom-in-95 border-emerald-500/50 bg-emerald-500/5 shadow-[0_0_24px_-8px_rgba(16,185,129,0.55)]',
        isPaused && 'border-amber-500/35 bg-amber-500/[0.04]',
        !canEnter && 'opacity-60'
      )}
    >
      <div className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full bg-red-500/10 blur-2xl transition-opacity group-hover:opacity-100" />

      <div className="relative flex items-start justify-between gap-3">
        <button
          type="button"
          disabled={!canEnter}
          onClick={onEnter}
          className="min-w-0 flex-1 text-left disabled:cursor-not-allowed"
        >
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-semibold tracking-tight text-zinc-50">{room.name}</h3>
            {highlighted && (
              <span className="rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                New
              </span>
            )}
            {isPaused && (
              <span className="rounded-md bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                Continue
              </span>
            )}
            {room.is_host && (
              <span className="rounded-md bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-red-300">
                Host
              </span>
            )}
            {!canEnter && (
              <span className="rounded-md bg-zinc-700/60 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300">
                Full
              </span>
            )}
          </div>
          <p className="mt-1 truncate text-sm text-zinc-400">
            {isPaused
              ? 'Paused — pick up where you left off'
              : room.host_name
                ? `Hosted by ${room.host_name}`
                : 'Open theater'}
            {' · '}
            <span className="font-mono text-zinc-300">{room.code}</span>
          </p>
          {room.now_showing && (
            <div className="mt-2.5 flex items-center gap-2.5 rounded-lg border border-zinc-800/80 bg-black/25 px-2 py-1.5">
              {room.now_showing.poster ? (
                <img
                  src={room.now_showing.poster}
                  alt=""
                  className="size-9 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-zinc-800/80 text-zinc-500">
                  <Clapperboard className="size-3.5" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider',
                    room.now_showing.state === 'playing' ? 'text-red-400/90' : 'text-amber-400/90'
                  )}
                >
                  {room.now_showing.state === 'playing' ? (
                    <>
                      <Play className="size-2.5 fill-current" />
                      Now playing
                    </>
                  ) : (
                    'About to play'
                  )}
                </p>
                <p className="truncate text-sm text-zinc-200">{room.now_showing.title}</p>
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center gap-3 text-xs text-zinc-400">
            <span className="inline-flex items-center gap-1.5">
              <Users className="size-3.5" />
              {isPaused ? 'Empty' : `${room.member_count}/${room.max_members}`}
            </span>
            {room.is_public !== false ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-400/90">
                <Globe2 className="size-3.5" />
                Public
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <Lock className="size-3.5" />
                Private
              </span>
            )}
          </div>
          {!isPaused && <OccupancyBar count={room.member_count} max={room.max_members} />}
        </button>

        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            title="Delete theater"
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}

export default function PartyIndex({ publicRooms: initialPublic, myRooms: initialMy, absoluteMaxMembers }: Props) {
  const { publicRooms, myRooms, live, highlightIds, deleteRoom } = usePartyLobby({
    initialPublicRooms: initialPublic,
    initialMyRooms: initialMy,
  });

  const createForm = useForm<{
    name: string;
    is_public: boolean;
    host_only_controls: boolean;
    allow_chat: boolean;
    allow_voice: boolean;
    max_members: number;
  }>({
    name: '',
    is_public: true,
    host_only_controls: false,
    allow_chat: true,
    allow_voice: true,
    max_members: absoluteMaxMembers,
  });

  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PartyLobbyRoom | null>(null);
  const [deleting, setDeleting] = useState(false);

  const onCreate = (e: FormEvent) => {
    e.preventDefault();
    createForm.post(route('party.store'));
  };

  const onJoin = (e: FormEvent) => {
    e.preventDefault();
    setJoining(true);
    setJoinError(null);
    router.post(
      route('party.join'),
      { code: joinCode.trim() },
      {
        onError: (errors) => setJoinError(errors.code || 'Could not join theater.'),
        onFinish: () => setJoining(false),
      }
    );
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await deleteRoom(pendingDelete.code, pendingDelete.id);
      toast.success('Theater deleted');
      setPendingDelete(null);
    } catch {
      toast.error('Could not delete theater');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Party Theater" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 overflow-hidden p-6 md:p-8">
        <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 bg-[radial-gradient(ellipse_at_top,rgba(220,38,38,0.18),transparent_60%)]" />
        <div className="pointer-events-none absolute -left-24 top-40 -z-10 size-64 rounded-full bg-red-600/10 blur-3xl" />

        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-red-400/90">
              <Clapperboard className="size-5" />
              <span className="text-sm font-medium uppercase tracking-[0.18em]">Watch together</span>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">Party Theater</h1>
            <p className="mt-2 max-w-2xl text-zinc-400">
              Open a screening, share the code, and stay in sync — up to {absoluteMaxMembers} seats with
              chat and optional mic.
            </p>
          </div>
          <div
            className={cn(
              'inline-flex items-center gap-2 self-start rounded-full border px-3 py-1.5 text-xs font-medium',
              live
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            )}
          >
            <Radio className={cn('size-3.5', live && 'animate-pulse')} />
            {live ? 'Live lobby' : 'Reconnecting…'}
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <form
            onSubmit={onCreate}
            className="relative space-y-4 overflow-hidden rounded-2xl border border-zinc-800 bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black p-5 shadow-lg shadow-black/20"
          >
            <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-red-500/15 blur-2xl" />
            <div className="relative">
              <h2 className="text-lg font-medium">Create a theater</h2>
              <p className="mt-1 text-sm text-zinc-500">Public by default — friends can find you in the lobby.</p>
            </div>
            <div className="relative space-y-1">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={createForm.data.name}
                onChange={(e) => createForm.setData('name', e.target.value)}
                placeholder="Friday night movies"
                maxLength={80}
              />
            </div>
            <div className="relative space-y-1">
              <Label htmlFor="max">Seats (2–{absoluteMaxMembers})</Label>
              <Input
                id="max"
                type="number"
                min={2}
                max={absoluteMaxMembers}
                value={createForm.data.max_members}
                onChange={(e) => createForm.setData('max_members', Number(e.target.value))}
              />
            </div>
            <div className="relative space-y-2.5 rounded-xl border border-zinc-800/80 bg-black/30 p-3">
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-red-500"
                  checked={createForm.data.is_public}
                  onChange={(e) => createForm.setData('is_public', e.target.checked)}
                />
                Show in the public lobby
              </label>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm">
                <input
                  type="checkbox"
                  className="size-4 accent-red-500"
                  checked={createForm.data.host_only_controls}
                  onChange={(e) => createForm.setData('host_only_controls', e.target.checked)}
                />
                Only I can play, pause, and skip
              </label>
            </div>
            <Button type="submit" disabled={createForm.processing} className="relative w-full">
              Open theater
            </Button>
          </form>

          <form
            onSubmit={onJoin}
            className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5"
          >
            <div>
              <h2 className="text-lg font-medium">Join a theater</h2>
              <p className="mt-1 text-sm text-zinc-500">Got an invite code? Drop it in and take a seat.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="code">Room code</Label>
              <Input
                id="code"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="ABC123"
                maxLength={12}
                className="font-mono tracking-[0.2em]"
              />
            </div>
            {joinError && <p className="text-sm text-red-400">{joinError}</p>}
            <Button type="submit" disabled={joining || !joinCode.trim()} className="w-full" variant="secondary">
              <DoorOpen className="mr-2 size-4" />
              Enter theater
            </Button>
          </form>
        </div>

        {myRooms.length > 0 && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-medium">Your theaters</h2>
              <span className="text-xs text-zinc-500">{myRooms.length} saved</span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {myRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onEnter={() => router.visit(route('party.theater', { code: room.code }))}
                  onDelete={room.is_host ? () => setPendingDelete(room) : undefined}
                />
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium">Open lobbies</h2>
              <p className="mt-0.5 text-sm text-zinc-500">Updates live as theaters open or close.</p>
            </div>
            <span className="text-xs text-zinc-500">{publicRooms.length} public</span>
          </div>
          {publicRooms.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-zinc-800 px-6 py-12 text-center">
              <Clapperboard className="mx-auto mb-3 size-8 text-zinc-600" />
              <p className="text-sm text-zinc-400">No open theaters right now.</p>
              <p className="mt-1 text-xs text-zinc-600">Create one and it will appear here for everyone.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {publicRooms.map((room) => (
                <RoomCard
                  key={room.id}
                  room={room}
                  highlighted={highlightIds.has(room.id)}
                  onEnter={() => router.visit(route('party.theater', { code: room.code }))}
                  onDelete={room.is_host ? () => setPendingDelete(room) : undefined}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogTitle>Delete this theater?</DialogTitle>
          <DialogDescription>
            {pendingDelete
              ? `“${pendingDelete.name}” (${pendingDelete.code}) will be removed for everyone. This cannot be undone.`
              : 'This theater will be removed for everyone.'}
          </DialogDescription>
          <DialogFooter className="gap-2">
            <DialogClose asChild>
              <Button type="button" variant="secondary" disabled={deleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="button" variant="destructive" disabled={deleting} onClick={() => void confirmDelete()}>
              {deleting ? 'Deleting…' : 'Delete theater'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

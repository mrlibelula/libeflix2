import { useState } from 'react';
import { router } from '@inertiajs/react';
import { toast } from 'sonner';
import type { PartySnapshot } from '@/types/party';
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
  DialogTrigger,
} from '@/components/ui/dialog';

type Props = {
  snapshot: PartySnapshot;
  absoluteMaxMembers: number;
  onSave: (settings: Record<string, unknown>) => Promise<void>;
  onDelete?: () => Promise<void>;
};

export function PartySettings({ snapshot, absoluteMaxMembers, onSave, onDelete }: Props) {
  const [name, setName] = useState(snapshot.room.name);
  const [hostOnly, setHostOnly] = useState(snapshot.room.host_only_controls);
  const [allowChat, setAllowChat] = useState(snapshot.room.allow_chat);
  const [allowVoice, setAllowVoice] = useState(snapshot.room.allow_voice);
  const [isPublic, setIsPublic] = useState(snapshot.room.is_public);
  const [maxMembers, setMaxMembers] = useState(snapshot.room.max_members);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!snapshot.viewer.is_host) {
    return null;
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-200 bg-white/80 p-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-transparent">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Theater settings</h3>
      <div className="space-y-1">
        <Label htmlFor="party-name">Name</Label>
        <Input id="party-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={hostOnly} onChange={(e) => setHostOnly(e.target.checked)} />
        Only I can play, pause, and skip
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allowChat} onChange={(e) => setAllowChat(e.target.checked)} />
        Allow chat
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={allowVoice} onChange={(e) => setAllowVoice(e.target.checked)} />
        Allow mic
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
        Show in the public lobby
      </label>
      <div className="space-y-1">
        <Label htmlFor="max-members">Seats (2–{absoluteMaxMembers})</Label>
        <Input
          id="max-members"
          type="number"
          min={2}
          max={absoluteMaxMembers}
          value={maxMembers}
          onChange={(e) => setMaxMembers(Number(e.target.value))}
        />
      </div>
      <Button
        type="button"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await onSave({
              name,
              host_only_controls: hostOnly,
              allow_chat: allowChat,
              allow_voice: allowVoice,
              is_public: isPublic,
              max_members: maxMembers,
            });
          } finally {
            setSaving(false);
          }
        }}
      >
        Save settings
      </Button>

      {onDelete && (
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" variant="destructive" className="w-full">
              Delete theater
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogTitle>Delete this theater?</DialogTitle>
            <DialogDescription>
              Everyone will be kicked out and the room will be removed. This cannot be undone.
            </DialogDescription>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button type="button" variant="secondary" disabled={deleting}>
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                variant="destructive"
                disabled={deleting}
                onClick={async () => {
                  setDeleting(true);
                  try {
                    await onDelete();
                    toast.success('Theater deleted');
                    router.visit(route('party.index'));
                  } catch {
                    toast.error('Could not delete theater');
                    setDeleting(false);
                  }
                }}
              >
                {deleting ? 'Deleting…' : 'Delete theater'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

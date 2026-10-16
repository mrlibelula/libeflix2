import { useCallback, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import { Copy, LogOut, Mic, MicOff } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { PartyPlayer } from '@/components/party/party-player';
import { PartyQueue } from '@/components/party/party-queue';
import { PartyChat } from '@/components/party/party-chat';
import { PartyMembers } from '@/components/party/party-members';
import { PartySettings } from '@/components/party/party-settings';
import { usePartySync } from '@/hooks/use-party-sync';
import { usePartyVoice } from '@/hooks/use-party-voice';
import { usePartyReadyToast } from '@/hooks/use-party-ready-toast';
import type { PartySnapshot, PartyVoiceSignal } from '@/types/party';
import type { BreadcrumbItem } from '@/types';
import { toast } from 'sonner';

type Props = {
  code: string;
  initialSnapshot: PartySnapshot;
  absoluteMaxMembers: number;
  backdropUrl: string;
};

export default function PartyTheater({ code, initialSnapshot, absoluteMaxMembers, backdropUrl }: Props) {
  const voiceHandlerRef = useRef<(signals: PartyVoiceSignal[]) => void>(() => undefined);

  const {
    snapshot,
    chatMessages,
    postPlayback,
    postPositionHeartbeat,
    sendChat,
    addToQueue,
    removeFromQueue,
    updateSettings,
    leave,
    deleteRoom,
    sendVoiceSignal,
  } = usePartySync({
    code,
    initialSnapshot,
    onVoiceSignals: (signals) => voiceHandlerRef.current(signals),
  });

  const voice = usePartyVoice({
    enabled: snapshot.room.allow_voice,
    localUserId: snapshot.viewer.user_id,
    members: snapshot.members,
    sendSignal: sendVoiceSignal,
  });

  voiceHandlerRef.current = (signals) => {
    void voice.handleSignals(signals);
  };

  usePartyReadyToast(snapshot.members, snapshot.viewer.user_id);

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Party Theater', href: '/party' },
    { title: snapshot.room.name, href: `/party/${code}` },
  ];

  const onTransport = useCallback(
    (playing: boolean, position: number) => {
      void postPlayback({ is_playing: playing, position_seconds: position });
    },
    [postPlayback]
  );

  const onPositionHeartbeat = useCallback(
    (position: number) => {
      void postPositionHeartbeat(position);
    },
    [postPositionHeartbeat]
  );

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${snapshot.room.name} · Party`} />

      <div className="relative flex min-h-[calc(100vh-5.5rem)] flex-col overflow-hidden overflow-y-auto sidebar-scrollbar">
        <div
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
          }}
          className="pointer-events-none absolute inset-0 h-full min-h-[calc(100vh-5.5rem)] w-full opacity-30 dark:opacity-20"
        />
        <div className="pointer-events-none absolute inset-0 h-full min-h-[calc(100vh-5.5rem)] w-full bg-gradient-to-b from-white/40 via-white/55 to-white/75 dark:from-transparent dark:via-transparent dark:to-transparent dark:dark-gradient-hero" />

        <div className="relative z-10 flex flex-col gap-4 p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">{snapshot.room.name}</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Room <span className="font-mono text-zinc-800 dark:text-zinc-200">{snapshot.room.code}</span>
                {snapshot.room.host_only_controls
                  ? ' · Only the host controls playback'
                  : ' · Anyone here can control playback'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(window.location.href);
                  toast.success('Invite link copied');
                }}
              >
                <Copy className="mr-1.5 size-3.5" />
                Copy link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!snapshot.room.allow_voice}
                onClick={() => void voice.toggleMic()}
              >
                {voice.micOn ? <MicOff className="mr-1.5 size-3.5" /> : <Mic className="mr-1.5 size-3.5" />}
                {voice.micOn ? 'Mic off' : 'Mic on'}
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={async () => {
                  voice.stopAll();
                  await leave();
                  router.visit(route('party.index'));
                }}
              >
                <LogOut className="mr-1.5 size-3.5" />
                Leave
              </Button>
            </div>
          </div>

          {voice.error && <p className="text-sm text-amber-400">{voice.error}</p>}

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <PartyPlayer
                item={snapshot.current_item}
                playback={snapshot.playback}
                canControl={snapshot.viewer.can_control}
                isHost={snapshot.viewer.is_host}
                onTransport={onTransport}
                onPositionHeartbeat={onPositionHeartbeat}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="min-h-64 rounded-xl border border-zinc-200 bg-white/80 p-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-transparent">
                  <PartyQueue
                    queue={snapshot.queue}
                    currentId={snapshot.playback.current_queue_item_id}
                    canControl={snapshot.viewer.can_control}
                    onAdd={addToQueue}
                    onRemove={removeFromQueue}
                    onPlayItem={async (id) => {
                      await postPlayback({ queue_item_id: id, is_playing: true, position_seconds: 0 });
                    }}
                  />
                </div>
                <div className="min-h-64 rounded-xl border border-zinc-200 bg-white/80 p-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-transparent">
                  <PartyChat
                    messages={chatMessages}
                    enabled={snapshot.room.allow_chat}
                    localUserId={snapshot.viewer.user_id}
                    onSend={sendChat}
                  />
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-zinc-200 bg-white/80 p-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-transparent">
                <PartyMembers members={snapshot.members} maxMembers={snapshot.room.max_members} />
              </div>
              <PartySettings
                snapshot={snapshot}
                absoluteMaxMembers={absoluteMaxMembers}
                onSave={updateSettings}
                onDelete={deleteRoom}
              />
            </aside>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

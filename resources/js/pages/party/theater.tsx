import { useCallback, useMemo, useRef, useState } from 'react';
import { Head, router } from '@inertiajs/react';
import { Copy, LogOut, Mic, MicOff } from 'lucide-react';
import AppLayout from '@/layouts/app-layout';
import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { PartyInviteDialog } from '@/components/party/party-invite-dialog';
import { PartyPlayer } from '@/components/party/party-player';
import { PartySidePanel } from '@/components/party/party-side-panel';
import { usePartySync } from '@/hooks/use-party-sync';
import { usePartyVoice } from '@/hooks/use-party-voice';
import { usePartyReadyToast } from '@/hooks/use-party-ready-toast';
import { usePartyEpisodeRepeatToast } from '@/hooks/use-party-episode-repeat-toast';
import { usePartyActivityToast } from '@/hooks/use-party-activity-toast';
import type { PartySnapshot, PartyVoiceSignal } from '@/types/party';
import type { BreadcrumbItem } from '@/types';

type Props = {
  code: string;
  initialSnapshot: PartySnapshot;
  absoluteMaxMembers: number;
  backdropUrl: string;
};

export default function PartyTheater({ code, initialSnapshot, absoluteMaxMembers, backdropUrl }: Props) {
  const voiceHandlerRef = useRef<(signals: PartyVoiceSignal[]) => void>(() => undefined);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState('');

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
  usePartyEpisodeRepeatToast(
    snapshot.playback,
    snapshot.members,
    snapshot.viewer.user_id
  );
  usePartyActivityToast(
    snapshot.activity,
    snapshot.members,
    snapshot.viewer.user_id
  );

  const breadcrumbs: BreadcrumbItem[] = [
    { title: 'Party Theater', href: '/party' },
    { title: snapshot.room.name, href: `/party/${code}` },
  ];

  const controlHint = snapshot.room.host_only_controls
    ? 'Only the host controls playback'
    : 'Anyone here can control playback';

  const micTooltip = useMemo(() => {
    if (!snapshot.room.allow_voice) {
      return {
        label: 'Mic unavailable',
        detail: 'Voice chat is disabled by the host for this theater.',
      };
    }
    if (voice.error) {
      return {
        label: 'Mic blocked',
        detail: voice.error,
      };
    }
    if (voice.micOn) {
      return {
        label: 'Mic on',
        detail: 'You are broadcasting to the party. Tap to mute.',
      };
    }
    return {
      label: 'Mic off',
      detail: 'Tap to unmute and join party voice chat.',
    };
  }, [snapshot.room.allow_voice, voice.error, voice.micOn]);

  const headerMeta = (
    <span className="inline-flex min-w-0 max-w-[40%] items-center gap-1.5 overflow-hidden text-xs text-zinc-500 sm:max-w-[55%] md:max-w-none dark:text-zinc-400">
      <span className="shrink-0 text-zinc-400 dark:text-zinc-600" aria-hidden>
        ·
      </span>
      <span className="shrink-0 font-mono text-zinc-700 dark:text-zinc-200">{snapshot.room.code}</span>
      <span className="hidden min-w-0 truncate rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-medium text-zinc-600 sm:inline dark:bg-zinc-800/80 dark:text-zinc-300">
        {controlHint}
      </span>
    </span>
  );

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

  const onEpisodeRepeatMode = useCallback(
    (mode: 'none' | 'one' | 'season' | 'tvshow') => {
      void postPlayback({ episode_repeat_mode: mode });
    },
    [postPlayback]
  );

  const openInvite = useCallback(() => {
    setShareUrl(window.location.href);
    setInviteOpen(true);
  }, []);

  return (
    <AppLayout
      breadcrumbs={breadcrumbs}
      headerMeta={headerMeta}
      headerActions={
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 px-2 sm:px-3"
            onClick={openInvite}
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">Copy link</span>
          </Button>
          <Tooltip
            delayMs={300}
            position="bottom"
            content={
              <div className="space-y-0.5 text-left">
                <p className="font-medium">{micTooltip.label}</p>
                <p className="text-[11px] opacity-80">{micTooltip.detail}</p>
              </div>
            }
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              disabled={!snapshot.room.allow_voice}
              aria-label={`${micTooltip.label}. ${micTooltip.detail}`}
              onClick={() => void voice.toggleMic()}
            >
              {voice.micOn ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
            </Button>
          </Tooltip>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            className="h-8 gap-1.5 px-2 sm:px-3"
            onClick={async () => {
              voice.stopAll();
              await leave();
              router.visit(route('party.index'));
            }}
          >
            <LogOut className="size-3.5" />
            <span className="hidden sm:inline">Leave</span>
          </Button>
        </>
      }
    >
      <Head title={`${snapshot.room.name} · Party`} />

      <PartyInviteDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        roomName={snapshot.room.name}
        roomCode={snapshot.room.code}
        shareUrl={shareUrl}
      />

      <div className="relative flex min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full flex-col overflow-x-hidden overflow-y-auto scroll-pt-[min(56.25vw,40vh)] sidebar-scrollbar lg:scroll-pt-0">
        <div
          style={{
            backgroundImage: `url(${backdropUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
          className="pointer-events-none absolute inset-0 h-full min-h-[calc(100vh-4rem)] w-full bg-scroll opacity-30 lg:bg-fixed dark:opacity-20"
        />
        <div className="pointer-events-none absolute inset-0 h-full min-h-[calc(100vh-4rem)] w-full bg-gradient-to-b from-white/40 via-white/55 to-white/75 dark:from-transparent dark:via-transparent dark:to-transparent dark:dark-gradient-hero" />

        <div className="relative z-10 flex w-full min-w-0 max-w-full flex-col gap-3 p-3 sm:gap-4 sm:p-4 md:p-6">
          {voice.error && <p className="text-sm text-amber-400">{voice.error}</p>}

          {/*
            Mobile: sticky video is a sibling of the side panel inside one tall column so it
            stays pinned while queue/search scrolls underneath (same idea as movie.tsx).
            Sticky wraps only the video — host notice scrolls away with the page.
          */}
          <div className="flex w-full min-w-0 max-w-full flex-col gap-3 sm:gap-4 xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)] xl:items-start">
            <div className="sticky top-0 z-30 min-w-0 w-full max-w-full bg-black lg:relative lg:z-auto">
              <PartyPlayer
                item={snapshot.current_item}
                queue={snapshot.queue}
                playback={snapshot.playback}
                canControl={snapshot.viewer.can_control}
                isHost={snapshot.viewer.is_host}
                showHostNotice={false}
                onTransport={onTransport}
                onPositionHeartbeat={onPositionHeartbeat}
                onEpisodeRepeatMode={onEpisodeRepeatMode}
                onPlayQueueItem={async (id) => {
                  await postPlayback({ queue_item_id: id, is_playing: true, position_seconds: 0 });
                }}
              />
            </div>

            {!snapshot.viewer.can_control && snapshot.current_item?.can_play && snapshot.current_item.media ? (
              <p className="min-w-0 rounded-lg bg-zinc-900 px-3 py-2 text-xs text-zinc-400 xl:col-start-1">
                Only the host can control playback in this theater.
              </p>
            ) : null}

            <div className="min-w-0 w-full max-w-full overflow-x-hidden xl:col-start-2 xl:row-start-1 xl:row-span-2">
              <PartySidePanel
                snapshot={snapshot}
                chatMessages={chatMessages}
                absoluteMaxMembers={absoluteMaxMembers}
                onSaveSettings={updateSettings}
                onDeleteRoom={deleteRoom}
                onAddToQueue={addToQueue}
                onRemoveFromQueue={removeFromQueue}
                onPlayQueueItem={async (id) => {
                  await postPlayback({ queue_item_id: id, is_playing: true, position_seconds: 0 });
                }}
                onSendChat={sendChat}
              />
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

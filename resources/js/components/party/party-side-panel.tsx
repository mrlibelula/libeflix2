import { useEffect, useRef, useState } from 'react';
import { MessageSquare, Settings2 } from 'lucide-react';
import { PartyChat } from '@/components/party/party-chat';
import { PartyMembers } from '@/components/party/party-members';
import { PartyQueue } from '@/components/party/party-queue';
import { PartySettings } from '@/components/party/party-settings';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import type { PartyChatMessage, PartySnapshot } from '@/types/party';

type TabId = 'settings' | 'chat';

type Props = {
  snapshot: PartySnapshot;
  chatMessages: PartyChatMessage[];
  absoluteMaxMembers: number;
  onSaveSettings: (settings: Record<string, unknown>) => Promise<void>;
  onDeleteRoom?: () => Promise<void>;
  onAddToQueue: (type: 'movie' | 'episode', id: number) => Promise<void>;
  onRemoveFromQueue: (id: number) => Promise<void>;
  onPlayQueueItem: (id: number) => Promise<void>;
  onSendChat: (body: string) => Promise<void>;
};

function TabBadge({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <span
      className="party-tab-dot absolute -top-0.5 -right-0.5 size-2 rounded-full bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.85)]"
      aria-hidden
    />
  );
}

export function PartySidePanel({
  snapshot,
  chatMessages,
  absoluteMaxMembers,
  onSaveSettings,
  onDeleteRoom,
  onAddToQueue,
  onRemoveFromQueue,
  onPlayQueueItem,
  onSendChat,
}: Props) {
  const [tab, setTab] = useState<TabId>('settings');
  const [unreadChat, setUnreadChat] = useState(false);
  const seenChatIdRef = useRef(chatMessages.at(-1)?.id ?? 0);
  const localUserId = snapshot.viewer.user_id;

  useEffect(() => {
    const latestId = chatMessages.at(-1)?.id ?? 0;
    if (latestId <= seenChatIdRef.current) return;

    const newest = chatMessages[chatMessages.length - 1];
    const fromOther = Boolean(newest && newest.user_id !== localUserId);

    if (tab === 'chat') {
      seenChatIdRef.current = latestId;
      setUnreadChat(false);
      return;
    }

    if (fromOther) {
      setUnreadChat(true);
    }
    seenChatIdRef.current = latestId;
  }, [chatMessages, localUserId, tab]);

  const onTabChange = (value: string) => {
    const next = value as TabId;
    setTab(next);
    if (next === 'chat') {
      seenChatIdRef.current = chatMessages.at(-1)?.id ?? seenChatIdRef.current;
      setUnreadChat(false);
    }
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden sm:gap-4">
      {/* Always-visible playlist section — Search/Browse scrolls underneath */}
      <section className="flex h-[min(58vh,36rem)] min-h-64 min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/80 p-3 backdrop-blur-sm dark:border-zinc-800 dark:bg-transparent">
        <PartyQueue
          queue={snapshot.queue}
          currentId={snapshot.playback.current_queue_item_id}
          canControl={snapshot.viewer.can_control}
          onAdd={onAddToQueue}
          onRemove={onRemoveFromQueue}
          onPlayItem={onPlayQueueItem}
        />
      </section>

      {/* Settings / Chat + always-visible members */}
      <aside className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-transparent">
        <Tabs value={tab} onValueChange={onTabChange} className="flex min-h-0 flex-1 flex-col gap-0">
          <div className="border-b border-zinc-200 p-2 dark:border-zinc-800">
            <TabsList className="grid h-10 w-full grid-cols-2 bg-zinc-100/90 dark:bg-zinc-900/80">
              <TabsTrigger value="settings" className="relative gap-1.5 text-xs sm:text-sm">
                <Settings2 className="size-3.5" />
                <span className="truncate">Settings</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="relative gap-1.5 text-xs sm:text-sm">
                <span className="relative inline-flex">
                  <MessageSquare className="size-3.5" />
                  <TabBadge visible={unreadChat && tab !== 'chat'} />
                </span>
                <span className="truncate">Chat</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="shrink-0 border-b border-zinc-200 px-3 py-3 dark:border-zinc-800">
            <PartyMembers members={snapshot.members} maxMembers={snapshot.room.max_members} />
          </div>

          <TabsContent
            value="settings"
            className={cn(
              'm-0 min-h-0 flex-1 overflow-y-auto overscroll-contain p-3 outline-none',
              'data-[state=inactive]:hidden'
            )}
          >
            {snapshot.viewer.is_host ? (
              <PartySettings
                snapshot={snapshot}
                absoluteMaxMembers={absoluteMaxMembers}
                onSave={onSaveSettings}
                onDelete={onDeleteRoom}
                embedded
              />
            ) : (
              <div className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
                <p>
                  Chat {snapshot.room.allow_chat ? 'on' : 'off'} · Mic{' '}
                  {snapshot.room.allow_voice ? 'on' : 'off'}
                </p>
                <p>
                  {snapshot.room.host_only_controls
                    ? 'Only the host controls playback.'
                    : 'Anyone here can control playback.'}
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="chat"
            className={cn(
              'm-0 flex min-h-64 flex-1 flex-col overflow-hidden p-3 outline-none',
              'data-[state=inactive]:hidden'
            )}
          >
            <PartyChat
              messages={chatMessages}
              enabled={snapshot.room.allow_chat}
              localUserId={snapshot.viewer.user_id}
              onSend={onSendChat}
              embedded
            />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}

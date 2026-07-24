import { FormEvent, useEffect, useRef, useState } from 'react';
import type { PartyChatMessage } from '@/types/party';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type Props = {
  messages: PartyChatMessage[];
  enabled: boolean;
  localUserId: number;
  onSend: (body: string) => Promise<void>;
};

const NEAR_BOTTOM_PX = 56;

function playChatBip() {
  try {
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(920, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(640, ctx.currentTime + 0.09);

    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.045, ctx.currentTime + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.15);
    osc.onended = () => {
      void ctx.close();
    };
  } catch {
    // Ignore audio failures (autoplay policy, unsupported, etc.)
  }
}

/** Keep the page/viewport where it is while chat focus or list scroll would otherwise move it. */
function preservePageScroll(run?: () => void) {
  const x = window.scrollX;
  const y = window.scrollY;
  run?.();
  requestAnimationFrame(() => {
    window.scrollTo(x, y);
    requestAnimationFrame(() => window.scrollTo(x, y));
  });
}

export function PartyChat({ messages, enabled, localUserId, onSend }: Props) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [shine, setShine] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);
  const seenLenRef = useRef(messages.length);
  const shineTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const prevLen = seenLenRef.current;
    const grew = messages.length > prevLen;
    seenLenRef.current = messages.length;

    if (!grew) return;

    const newest = messages[messages.length - 1];
    const fromOther = Boolean(newest && newest.user_id !== localUserId);
    const shouldScrollList = stickToBottomRef.current || !fromOther;

    if (shouldScrollList) {
      // Scroll only the chat list — never scrollIntoView (that moves the page).
      list.scrollTop = list.scrollHeight;
      stickToBottomRef.current = true;
    }

    if (fromOther) {
      setShine(true);
      playChatBip();
      if (shineTimerRef.current !== null) {
        window.clearTimeout(shineTimerRef.current);
      }
      shineTimerRef.current = window.setTimeout(() => {
        setShine(false);
        shineTimerRef.current = null;
      }, 750);
    }
  }, [messages, localUserId]);

  useEffect(() => {
    return () => {
      if (shineTimerRef.current !== null) {
        window.clearTimeout(shineTimerRef.current);
      }
    };
  }, []);

  const onListScroll = () => {
    const list = listRef.current;
    if (!list) return;
    stickToBottomRef.current =
      list.scrollHeight - list.scrollTop - list.clientHeight <= NEAR_BOTTOM_PX;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!enabled || !body.trim() || sending) return;
    setSending(true);
    try {
      await onSend(body.trim());
      setBody('');
      stickToBottomRef.current = true;
      preservePageScroll(() => {
        const list = listRef.current;
        if (list) list.scrollTop = list.scrollHeight;
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Chat</h3>
      {!enabled && <p className="text-xs text-zinc-500">Chat is disabled by the host.</p>}
      <div
        ref={listRef}
        onScroll={onListScroll}
        className={cn(
          'min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded border border-zinc-800 p-2 transition-[border-color,box-shadow] duration-500',
          shine && 'party-chat-shine border-sky-400/60 shadow-[0_0_22px_-6px_rgba(56,189,248,0.55)]'
        )}
      >
        {messages.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-medium text-zinc-200">{m.user_name || 'User'}: </span>
            <span className="text-zinc-300">{m.body}</span>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onMouseDown={() => preservePageScroll()}
          onTouchStart={() => preservePageScroll()}
          onFocus={() => preservePageScroll()}
          placeholder={enabled ? 'Say something…' : 'Chat disabled'}
          disabled={!enabled || sending}
          maxLength={1000}
        />
        <Button type="submit" disabled={!enabled || sending || !body.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

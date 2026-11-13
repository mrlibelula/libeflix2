import { useEffect, useState } from 'react';
import { Check, Copy, Link2 } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomName: string;
  roomCode: string;
  shareUrl: string;
};

const LOGO_SRC = '/images/libesoft.io_inv.png';
const QR_SIZE = 220;
const LOGO_SIZE = 44;
const LOGO_PAD = 52;
/** Transparent placeholder so qrcode.react excavates modules under the logo pad. */
const EXCAVATE_SRC =
  'data:image/svg+xml,' +
  encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

export function PartyInviteDialog({
  open,
  onOpenChange,
  roomName,
  roomCode,
  shareUrl,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) {
      setCopied(false);
    }
  }, [open]);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('Invite link copied');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden border-zinc-200/80 p-0 sm:max-w-md dark:border-zinc-800">
        <div className="relative overflow-hidden bg-gradient-to-br from-zinc-100 via-white to-rose-50 px-6 pb-6 pt-8 dark:from-zinc-950 dark:via-zinc-900 dark:to-rose-950/40">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-rose-500/10 blur-2xl dark:bg-rose-500/20"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-20 -left-10 size-40 rounded-full bg-violet-500/10 blur-2xl dark:bg-violet-500/15"
          />

          <DialogHeader className="relative z-10 space-y-1.5 text-center sm:text-center">
            <DialogTitle className="text-xl tracking-tight">Invite to party</DialogTitle>
            <DialogDescription className="text-zinc-600 dark:text-zinc-400">
              Scan the QR code or copy the link to join{' '}
              <span className="font-medium text-zinc-800 dark:text-zinc-200">{roomName}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="relative z-10 mt-6 flex flex-col items-center gap-5">
            <div className="rounded-2xl border border-zinc-200/80 bg-white p-4 shadow-lg shadow-zinc-900/5 ring-1 ring-black/5 dark:border-zinc-700/60 dark:bg-zinc-950 dark:shadow-black/40 dark:ring-white/5">
              <div className="relative">
                <QRCodeSVG
                  value={shareUrl}
                  size={QR_SIZE}
                  level="H"
                  marginSize={2}
                  bgColor="#ffffff"
                  fgColor="#18181b"
                  title={`Join party ${roomCode}`}
                  imageSettings={{
                    src: EXCAVATE_SRC,
                    height: LOGO_PAD,
                    width: LOGO_PAD,
                    excavate: true,
                  }}
                />
                {/* Dark pad so the inverted (light) logo stays readable on white QR */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-zinc-950 shadow-inner"
                  style={{ width: LOGO_PAD, height: LOGO_PAD }}
                >
                  <img
                    src={LOGO_SRC}
                    alt=""
                    className="object-contain"
                    style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
                    draggable={false}
                  />
                </div>
              </div>
            </div>

            <p className="font-mono text-xs tracking-[0.2em] text-zinc-500 dark:text-zinc-400">
              {roomCode}
            </p>

            <div className="w-full space-y-2">
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <Link2 className="size-3.5" />
                Share link
              </label>
              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white/80 px-3 py-2.5 dark:border-zinc-700 dark:bg-zinc-950/80">
                  <p className="truncate font-mono text-xs text-zinc-700 dark:text-zinc-200 sm:text-sm">
                    {shareUrl}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="h-auto shrink-0 gap-1.5 px-3"
                  onClick={() => void copyLink()}
                >
                  {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect, useState } from 'react';
import {
  Bookmark,
  BookmarkCheck,
  Heart,
  MoreVertical,
  Share2,
  Users,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { AddEpisodeToPartyDialog } from '@/components/party/add-episode-to-party-dialog';
import { EpisodesApi } from '@/services/episodes-api';

export type EpisodeRowActionTarget = {
  id: number;
  name?: string;
  episode_number: number;
  season_number?: number;
  overview?: string;
  is_watch_later?: boolean;
  is_liked?: boolean;
};

/** Blocks episode-row play clicks while a mobile actions sheet is open / just closed. */
let suppressEpisodeSelectUntil = 0;

export function markEpisodeSelectSuppressed(ms = 600) {
  suppressEpisodeSelectUntil = Math.max(suppressEpisodeSelectUntil, Date.now() + ms);
}

export function isEpisodeSelectSuppressed() {
  return Date.now() < suppressEpisodeSelectUntil;
}

type Props = {
  episode: EpisodeRowActionTarget;
  seasonNumber: number;
  tvshowName: string;
  variant: 'mobile' | 'desktop';
  isAuthenticated: boolean;
  excludePartyRoomCode?: string | null;
  onWatchLaterToggle: (
    episode: EpisodeRowActionTarget
  ) => Promise<boolean | void> | boolean | void;
  onShare: (episode: EpisodeRowActionTarget, seasonNumber: number) => void | Promise<void>;
  onLikeToggle: (
    episode: EpisodeRowActionTarget,
    currentlyLiked: boolean
  ) => Promise<{ is_liked: boolean; likes_count: number } | void> | void;
};

export function EpisodeRowActions({
  episode,
  seasonNumber,
  tvshowName,
  variant,
  isAuthenticated,
  excludePartyRoomCode = null,
  onWatchLaterToggle,
  onShare,
  onLikeToggle,
}: Props) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const [partyOpen, setPartyOpen] = useState(false);
  const [isWatchLater, setIsWatchLater] = useState(!!episode.is_watch_later);
  const [isLiked, setIsLiked] = useState(!!episode.is_liked);
  const [likeKnown, setLikeKnown] = useState(typeof episode.is_liked === 'boolean');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setIsWatchLater(!!episode.is_watch_later);
  }, [episode.id, episode.is_watch_later]);

  useEffect(() => {
    if (typeof episode.is_liked === 'boolean') {
      setIsLiked(episode.is_liked);
      setLikeKnown(true);
    } else {
      setLikeKnown(false);
    }
  }, [episode.id, episode.is_liked]);

  const label = episode.name
    ? `${episode.episode_number}. ${episode.name}`
    : `Episode ${episode.episode_number}`;

  const ensureLikeState = async () => {
    if (likeKnown || !isAuthenticated) {
      return isLiked;
    }
    try {
      const data = await EpisodesApi.getLikes(episode.id);
      setIsLiked(data.is_liked);
      setLikeKnown(true);
      return data.is_liked;
    } catch (error) {
      console.error('Failed to load episode likes:', error);
      return false;
    }
  };

  const handleOpenMobile = async () => {
    // Opening the menu must never count as "play this episode".
    markEpisodeSelectSuppressed(800);
    setSheetOpen(true);
    if (isAuthenticated) {
      await ensureLikeState();
    }
  };

  /** Close sheet without letting the same gesture "click through" to the episode row underneath. */
  const handleSheetOpenChange = (open: boolean) => {
    if (open) {
      markEpisodeSelectSuppressed(800);
      setSheetOpen(true);
      return;
    }

    if (sheetOpen) {
      markEpisodeSelectSuppressed(800);
      const shield = document.createElement('div');
      shield.setAttribute('aria-hidden', 'true');
      shield.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;touch-action:none;cursor:default;';
      document.body.appendChild(shield);

      // Swallow the ghost click that fires after the overlay unmounts, then drop the shield.
      const swallowClick = (e: Event) => {
        e.preventDefault();
        e.stopPropagation();
        cleanup();
      };
      const cleanup = () => {
        shield.remove();
        document.removeEventListener('click', swallowClick, true);
      };

      document.addEventListener('click', swallowClick, true);
      window.setTimeout(cleanup, 800);
    }
    setSheetOpen(false);
  };

  const handleDesktopOpenChange = async (open: boolean) => {
    if (open && isAuthenticated) {
      await ensureLikeState();
    }
  };

  const runWatchLater = async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      const next = await onWatchLaterToggle(episode);
      if (typeof next === 'boolean') {
        setIsWatchLater(next);
      }
      handleSheetOpenChange(false);
    } catch (error) {
      console.error('Failed to toggle watch later:', error);
    } finally {
      setBusy(false);
    }
  };

  const runShare = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await onShare(episode, seasonNumber);
      handleSheetOpenChange(false);
    } catch (error) {
      console.error('Failed to share episode:', error);
    } finally {
      setBusy(false);
    }
  };

  const runLike = async () => {
    if (!isAuthenticated || busy) return;
    setBusy(true);
    try {
      const currentlyLiked = await ensureLikeState();
      const result = await onLikeToggle(episode, currentlyLiked);
      if (result && typeof result.is_liked === 'boolean') {
        setIsLiked(result.is_liked);
        setLikeKnown(true);
      }
      handleSheetOpenChange(false);
    } catch (error) {
      console.error('Failed to toggle like:', error);
    } finally {
      setBusy(false);
    }
  };

  const openPartyPicker = () => {
    if (!isAuthenticated) {
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = '/login?redirect=' + encodeURIComponent(currentUrl);
      return;
    }
    handleSheetOpenChange(false);
    setPartyOpen(true);
  };

  const actionItems = (
    <>
      <button
        type="button"
        disabled={!isAuthenticated || busy}
        onClick={runWatchLater}
        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        {isWatchLater ? (
          <BookmarkCheck className="w-4 h-4 text-green-400" />
        ) : (
          <Bookmark className="w-4 h-4 text-neutral-300" />
        )}
        <span>{isWatchLater ? 'Remove from Watch Later' : 'Add to Watch Later'}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={runShare}
        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        <Share2 className="w-4 h-4 text-neutral-300" />
        <span>Share episode</span>
      </button>
      <button
        type="button"
        disabled={!isAuthenticated || busy}
        onClick={runLike}
        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        <Heart className={`w-4 h-4 ${isLiked ? 'text-rose-500 fill-rose-500' : 'text-neutral-300'}`} />
        <span>{isLiked ? 'Unlike' : 'Like'}</span>
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={openPartyPicker}
        className="flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-sm text-white hover:bg-neutral-800 disabled:opacity-50"
      >
        <Users className="w-4 h-4 text-neutral-300" />
        <span>Add to party room</span>
      </button>
    </>
  );

  const triggerButton = (
    <button
      type="button"
      aria-label={`Episode options for ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        if (variant === 'mobile') {
          handleOpenMobile();
        }
      }}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => {
        e.stopPropagation();
        markEpisodeSelectSuppressed(800);
      }}
      onTouchStart={(e) => {
        e.stopPropagation();
        markEpisodeSelectSuppressed(800);
      }}
      className="flex-shrink-0 p-1 text-neutral-500 hover:text-neutral-300"
    >
      <MoreVertical className="w-5 h-5" />
    </button>
  );

  return (
    <>
      {variant === 'mobile' ? (
        <>
          {triggerButton}
          <Sheet open={sheetOpen} onOpenChange={handleSheetOpenChange}>
            <SheetContent
              side="bottom"
              className="bg-neutral-900 border-neutral-700 text-white rounded-t-xl z-[70]"
              overlayClassName="z-[70]"
              onClick={(e) => e.stopPropagation()}
              onCloseAutoFocus={(e) => e.preventDefault()}
              onPointerDownOutside={(e) => {
                // Prevent Radix from dismissing on pointerdown so the trailing
                // click/tap cannot hit the episode row under the overlay.
                e.preventDefault();
                handleSheetOpenChange(false);
              }}
              onInteractOutside={(e) => {
                e.preventDefault();
              }}
            >
              <SheetHeader className="text-left">
                <SheetTitle className="text-white truncate pr-8">
                  {tvshowName}
                </SheetTitle>
                <p className="text-sm text-neutral-400 truncate">{label}</p>
              </SheetHeader>
              <div className="px-2 pb-4">{actionItems}</div>
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <DropdownMenu onOpenChange={handleDesktopOpenChange}>
          <DropdownMenuTrigger asChild>
            {triggerButton}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-neutral-900 border-neutral-700 text-white z-[70]"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem
              disabled={!isAuthenticated || busy}
              onSelect={(e) => {
                e.preventDefault();
                runWatchLater();
              }}
              className="cursor-pointer focus:bg-neutral-800 focus:text-white"
            >
              {isWatchLater ? (
                <BookmarkCheck className="text-green-400" />
              ) : (
                <Bookmark />
              )}
              {isWatchLater ? 'Remove from Watch Later' : 'Add to Watch Later'}
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                runShare();
              }}
              className="cursor-pointer focus:bg-neutral-800 focus:text-white"
            >
              <Share2 />
              Share episode
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={!isAuthenticated || busy}
              onSelect={(e) => {
                e.preventDefault();
                runLike();
              }}
              className="cursor-pointer focus:bg-neutral-800 focus:text-white"
            >
              <Heart className={isLiked ? 'text-rose-500 fill-rose-500' : undefined} />
              {isLiked ? 'Unlike' : 'Like'}
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-neutral-700" />
            <DropdownMenuItem
              disabled={busy}
              onSelect={(e) => {
                e.preventDefault();
                openPartyPicker();
              }}
              className="cursor-pointer focus:bg-neutral-800 focus:text-white"
            >
              <Users />
              Add to party room
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <AddEpisodeToPartyDialog
        open={partyOpen}
        onOpenChange={setPartyOpen}
        episodeId={episode.id}
        episodeLabel={`${tvshowName} — ${label}`}
        excludeRoomCode={excludePartyRoomCode}
      />
    </>
  );
}

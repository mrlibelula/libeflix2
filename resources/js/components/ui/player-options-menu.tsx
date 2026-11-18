import type { CSSProperties, ReactNode, RefObject, TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronLeft } from 'lucide-react';
import type { AudioMode } from '@/hooks/use-dialogue-audio';
import {
  usePlayerMenuPortalTarget,
  useViewportMenuPosition,
} from '@/hooks/use-viewport-menu-position';

export type PlayerMenuSection = 'none' | 'subtitles' | 'audio' | 'sound';

export type PlayerMenuTrack = {
  id: string;
  label: string;
  selected: boolean;
};

type AudioModeOption = {
  id: AudioMode;
  label: string;
};

const menuTouchHandlers = {
  onTouchStart: (e: TouchEvent) => e.stopPropagation(),
  onTouchMove: (e: TouchEvent) => e.stopPropagation(),
  onTouchEnd: (e: TouchEvent) => e.stopPropagation(),
};

const scrollStyle: CSSProperties = {
  touchAction: 'pan-y',
  WebkitOverflowScrolling: 'touch',
};

function MenuRow({
  label,
  value,
  selected,
  onSelect,
  showChevron,
}: {
  label: string;
  value?: string;
  selected?: boolean;
  onSelect: () => void;
  showChevron?: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-neutral-100 active:bg-neutral-200 dark:hover:bg-neutral-800 dark:active:bg-neutral-700"
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
    >
      <span className="flex-1 text-sm font-medium">{label}</span>
      {value != null && (
        <span className="flex items-center text-xs text-neutral-500 dark:text-neutral-400">
          {value}
          {showChevron && (
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </span>
      )}
      {selected && <Check className="h-4 w-4 flex-shrink-0 text-rose-500" />}
    </button>
  );
}

function MobilePanel({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        className="flex w-full flex-shrink-0 items-center gap-2 border-b border-neutral-200 px-4 py-3 text-left dark:border-neutral-700"
        onClick={(e) => {
          e.stopPropagation();
          onBack();
        }}
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="text-sm font-medium">{title}</span>
      </button>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" style={scrollStyle}>
        {children}
      </div>
    </div>
  );
}

type PlayerOptionsMenuProps = {
  variant: 'mobile' | 'desktop';
  menuRef: RefObject<HTMLDivElement | null>;
  /** Player root used to keep menus visible inside native fullscreen. */
  anchorRef?: RefObject<HTMLElement | null>;
  activeSection: PlayerMenuSection;
  setActiveSection: (section: PlayerMenuSection) => void;
  hasSubtitles: boolean;
  subtitleTracks: PlayerMenuTrack[];
  audioTracks: PlayerMenuTrack[];
  onSelectSubtitle: (id: string) => void;
  onSelectAudio: (id: string) => void;
  normalizeVolume: boolean;
  setNormalizeVolume: (enabled: boolean) => void;
  audioMode: AudioMode;
  setAudioMode: (mode: AudioMode) => void;
  audioModeOptions: ReadonlyArray<AudioModeOption>;
  audioModeLabel: string;
};

export function PlayerOptionsMenu({
  variant,
  menuRef,
  anchorRef,
  activeSection,
  setActiveSection,
  hasSubtitles,
  subtitleTracks,
  audioTracks,
  onSelectSubtitle,
  onSelectAudio,
  normalizeVolume,
  setNormalizeVolume,
  audioMode,
  setAudioMode,
  audioModeOptions,
  audioModeLabel,
}: PlayerOptionsMenuProps) {
  const selectedSubtitle = subtitleTracks.find((track) => track.selected)?.label || 'Off';
  const selectedAudio = audioTracks.find((track) => track.selected)?.label || 'Original';
  const portalTarget = usePlayerMenuPortalTarget(anchorRef, variant === 'mobile');
  const viewport = useViewportMenuPosition(
    menuRef,
    true,
    [variant, activeSection, hasSubtitles, audioTracks.length, portalTarget],
    anchorRef
  );

  if (variant === 'mobile') {
    const useFixed = !portalTarget || portalTarget === document.body;
    const mobileMenu = (
      <div
        ref={menuRef}
        data-player-menu="true"
        role="menu"
        className={`${useFixed ? 'fixed' : 'absolute'} z-[60] flex w-max max-w-[min(240px,calc(100%-2rem))] flex-col overflow-hidden rounded-md border border-neutral-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95`}
        style={{
          ...scrollStyle,
          right: viewport.right,
          bottom: viewport.bottom,
          width: viewport.width,
          maxHeight: viewport.maxHeight,
        }}
        onClick={(e) => e.stopPropagation()}
        {...menuTouchHandlers}
      >
        {activeSection === 'none' && (
          <div
            className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1"
            style={scrollStyle}
          >
            {hasSubtitles && (
              <MenuRow
                label="Subtitles"
                value={selectedSubtitle}
                showChevron
                onSelect={() => setActiveSection('subtitles')}
              />
            )}
            {audioTracks.length > 1 && (
              <MenuRow
                label="Audio"
                value={selectedAudio}
                showChevron
                onSelect={() => setActiveSection('audio')}
              />
            )}
            <MenuRow
              label="Sound"
              value={audioModeLabel}
              showChevron
              onSelect={() => setActiveSection('sound')}
            />
          </div>
        )}

        {activeSection === 'subtitles' && (
          <MobilePanel title="Subtitles" onBack={() => setActiveSection('none')}>
            {subtitleTracks.map((track) => (
              <MenuRow
                key={track.id}
                label={track.label}
                selected={track.selected}
                onSelect={() => onSelectSubtitle(track.id)}
              />
            ))}
          </MobilePanel>
        )}

        {activeSection === 'audio' && (
          <MobilePanel title="Audio" onBack={() => setActiveSection('none')}>
            {audioTracks.map((track) => (
              <MenuRow
                key={track.id}
                label={track.label}
                selected={track.selected}
                onSelect={() => onSelectAudio(track.id)}
              />
            ))}
          </MobilePanel>
        )}

        {activeSection === 'sound' && (
          <MobilePanel title="Sound" onBack={() => setActiveSection('none')}>
            <MenuRow
              label="Normalize volume"
              selected={normalizeVolume}
              onSelect={() => setNormalizeVolume(!normalizeVolume)}
            />
            <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
            {audioModeOptions.map((option) => (
              <MenuRow
                key={option.id}
                label={option.label}
                selected={audioMode === option.id}
                onSelect={() => setAudioMode(option.id)}
              />
            ))}
          </MobilePanel>
        )}
      </div>
    );

    if (portalTarget) {
      return createPortal(mobileMenu, portalTarget);
    }

    return mobileMenu;
  }

  const submenuAnchorClass = viewport.openSubmenuUpward ? 'bottom-0 top-auto' : 'top-0';

  return (
    <div
      ref={menuRef}
      data-player-menu="true"
      role="menu"
      // No overflow-hidden here — desktop Audio/Sound/Subtitles flyouts use
      // absolute right-full and must paint outside this box.
      className="absolute bottom-14 right-10 z-50 flex flex-col rounded-md border border-neutral-200 bg-white/95 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95"
      style={{ width: '240px', maxHeight: viewport.maxHeight, ...scrollStyle }}
      onClick={(e) => e.stopPropagation()}
      {...menuTouchHandlers}
    >
      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain rounded-md py-1"
        style={{ maxHeight: viewport.maxHeight, ...scrollStyle }}
      >
        {hasSubtitles && (
          <div
            role="menuitem"
            className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
              activeSection === 'subtitles'
                ? 'bg-neutral-100 dark:bg-neutral-800'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            onMouseEnter={() => setActiveSection('subtitles')}
            onClick={(e) => {
              e.stopPropagation();
              setActiveSection(activeSection === 'subtitles' ? 'none' : 'subtitles');
            }}
          >
            <span className="text-sm font-medium">Subtitles</span>
            <span className="flex items-center text-xs text-neutral-500 dark:text-neutral-400">
              {selectedSubtitle}
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        )}

        {audioTracks.length > 1 && (
          <div
            role="menuitem"
            className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
              activeSection === 'audio'
                ? 'bg-neutral-100 dark:bg-neutral-800'
                : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
            }`}
            onMouseEnter={() => setActiveSection('audio')}
            onClick={(e) => {
              e.stopPropagation();
              setActiveSection(activeSection === 'audio' ? 'none' : 'audio');
            }}
          >
            <span className="text-sm font-medium">Audio</span>
            <span className="flex items-center text-xs text-neutral-500 dark:text-neutral-400">
              {selectedAudio}
              <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
            </span>
          </div>
        )}

        <div
          role="menuitem"
          className={`flex cursor-pointer items-center justify-between px-4 py-3 transition-colors ${
            activeSection === 'sound'
              ? 'bg-neutral-100 dark:bg-neutral-800'
              : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
          }`}
          onMouseEnter={() => setActiveSection('sound')}
          onClick={(e) => {
            e.stopPropagation();
            setActiveSection(activeSection === 'sound' ? 'none' : 'sound');
          }}
        >
          <span className="text-sm font-medium">Sound</span>
          <span className="flex items-center text-xs text-neutral-500 dark:text-neutral-400">
            {audioModeLabel}
            <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </span>
        </div>
      </div>

      {activeSection === 'subtitles' && (
        <div
          data-player-menu="true"
          className={`absolute right-full overflow-y-auto overscroll-contain rounded-md border border-neutral-200 bg-white/95 py-1 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 ${submenuAnchorClass}`}
          style={{ width: '180px', maxHeight: viewport.submenuMaxHeight, ...scrollStyle }}
          onClick={(e) => e.stopPropagation()}
          {...menuTouchHandlers}
        >
          {subtitleTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={(e) => {
                e.stopPropagation();
                onSelectSubtitle(track.id);
              }}
            >
              <span className="flex-1 text-sm">{track.label}</span>
              {track.selected && <Check className="h-4 w-4 text-rose-500" />}
            </button>
          ))}
        </div>
      )}

      {activeSection === 'audio' && (
        <div
          data-player-menu="true"
          className={`absolute right-full overflow-y-auto overscroll-contain rounded-md border border-neutral-200 bg-white/95 py-1 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 ${submenuAnchorClass}`}
          style={{ width: '180px', maxHeight: viewport.submenuMaxHeight, ...scrollStyle }}
          onClick={(e) => e.stopPropagation()}
          {...menuTouchHandlers}
        >
          {audioTracks.map((track) => (
            <button
              key={track.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={(e) => {
                e.stopPropagation();
                onSelectAudio(track.id);
              }}
            >
              <span className="flex-1 text-sm">{track.label}</span>
              {track.selected && <Check className="h-4 w-4 text-rose-500" />}
            </button>
          ))}
        </div>
      )}

      {activeSection === 'sound' && (
        <div
          data-player-menu="true"
          className={`absolute right-full overflow-y-auto overscroll-contain rounded-md border border-neutral-200 bg-white/95 py-1 shadow-lg backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-900/95 ${submenuAnchorClass}`}
          style={{ width: '180px', maxHeight: viewport.submenuMaxHeight, ...scrollStyle }}
          onClick={(e) => e.stopPropagation()}
          {...menuTouchHandlers}
        >
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center px-4 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
            onClick={(e) => {
              e.stopPropagation();
              setNormalizeVolume(!normalizeVolume);
            }}
          >
            <span className="flex-1 text-sm">Normalize volume</span>
            {normalizeVolume && <Check className="h-4 w-4 text-rose-500" />}
          </button>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-700" />
          {audioModeOptions.map((option) => (
            <button
              key={option.id}
              type="button"
              role="menuitem"
              className="flex w-full items-center px-4 py-2 text-left transition-colors hover:bg-neutral-100 dark:hover:bg-neutral-800"
              onClick={(e) => {
                e.stopPropagation();
                setAudioMode(option.id);
              }}
            >
              <span className="flex-1 text-sm">{option.label}</span>
              {audioMode === option.id && <Check className="h-4 w-4 text-rose-500" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function isPlayerMenuTarget(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('[data-player-menu]');
}

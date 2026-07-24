export type PartyLobbyNowShowing = {
  title: string;
  type: 'movie' | 'episode';
  poster: string | null;
  /** playing = actively watching; up_next = queued / about to start / paused */
  state: 'playing' | 'up_next';
};

export type PartyLobbyRoom = {
  id: number;
  code: string;
  name: string;
  host_name?: string | null;
  host_user_id?: number;
  member_count: number;
  max_members: number;
  is_public?: boolean;
  is_full?: boolean;
  is_host?: boolean;
  is_member?: boolean;
  is_paused?: boolean;
  status?: 'open' | 'playing' | 'paused' | 'ended' | string;
  updated_at?: string | null;
  now_showing?: PartyLobbyNowShowing | null;
};

export type PartyQueueItem = {
  id: number;
  position: number;
  type: 'movie' | 'episode';
  watchable_id: number;
  title: string;
  poster: string | null;
  enc_file_path: string | null;
  disk: string | null;
  is_free: boolean;
  can_play: boolean;
  meta: Record<string, unknown>;
  added_by?: string | null;
  added_by_id?: number;
  media?: {
    kind: 'movie' | 'episode';
    encFilePath?: string | null;
    movie?: Record<string, unknown>;
    episode?: Record<string, unknown>;
    tvshowName?: string;
    tvshowId?: number;
    tvshowSlug?: string;
    totalSeasons?: number;
  } | null;
};

export type PartyMember = {
  user_id: number;
  name: string | null;
  role: string;
  is_host: boolean;
  online: boolean;
  last_seen_at: string | null;
};

export type PartyChatMessage = {
  id: number;
  user_id: number;
  user_name: string | null;
  body: string;
  created_at: string | null;
};

export type PartyVoiceSignal = {
  id: number;
  from_user_id: number;
  type: 'offer' | 'answer' | 'ice' | 'mute';
  payload: Record<string, unknown>;
};

export type PartySnapshot = {
  server_time: string;
  room: {
    id: number;
    code: string;
    name: string;
    status: string;
    host_user_id: number;
    host_only_controls: boolean;
    allow_chat: boolean;
    allow_voice: boolean;
    max_members: number;
    absolute_max_members: number;
    is_public: boolean;
    member_count: number;
  };
  playback: {
    current_queue_item_id: number | null;
    is_playing: boolean;
    position_seconds: number;
    playback_updated_at: string | null;
  };
  current_item: PartyQueueItem | null;
  queue: PartyQueueItem[];
  members: PartyMember[];
  chat: PartyChatMessage[];
  voice_signals: PartyVoiceSignal[];
  viewer: {
    user_id: number;
    is_host: boolean;
    can_control: boolean;
    can_access_premium: boolean;
  };
};

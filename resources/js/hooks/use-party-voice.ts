import { useCallback, useEffect, useRef, useState } from 'react';
import type { PartyMember, PartyVoiceSignal } from '@/types/party';

type Options = {
  enabled: boolean;
  localUserId: number;
  members: PartyMember[];
  sendSignal: (toUserId: number, type: string, payload: Record<string, unknown>) => Promise<void>;
};

const ICE_SERVERS: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

export function usePartyVoice({ enabled, localUserId, members, sendSignal }: Options) {
  const [micOn, setMicOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const peersRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const membersRef = useRef(members);
  const sendSignalRef = useRef(sendSignal);

  useEffect(() => {
    membersRef.current = members;
    sendSignalRef.current = sendSignal;
  });

  const ensureRemoteAudio = (userId: number) => {
    let el = remoteAudioRef.current.get(userId);
    if (!el) {
      el = new Audio();
      el.autoplay = true;
      remoteAudioRef.current.set(userId, el);
    }
    return el;
  };

  const createPeer = useCallback(async (remoteUserId: number, asOfferer: boolean) => {
    if (peersRef.current.has(remoteUserId) || !localStreamRef.current) {
      return peersRef.current.get(remoteUserId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    peersRef.current.set(remoteUserId, pc);

    localStreamRef.current.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignalRef.current(remoteUserId, 'ice', {
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const audio = ensureRemoteAudio(remoteUserId);
      audio.srcObject = event.streams[0];
      void audio.play().catch(() => undefined);
    };

    if (asOfferer) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignalRef.current(remoteUserId, 'offer', {
        sdp: offer.sdp,
        type: offer.type,
      });
    }

    return pc;
  }, []);

  const handleSignals = useCallback(
    async (signals: PartyVoiceSignal[]) => {
      if (!micOn || !localStreamRef.current) return;

      for (const signal of signals) {
        const from = signal.from_user_id;
        if (from === localUserId) continue;

        if (signal.type === 'offer') {
          const pc = (await createPeer(from, false))!;
          await pc.setRemoteDescription({
            type: 'offer',
            sdp: String(signal.payload.sdp || ''),
          });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignalRef.current(from, 'answer', {
            sdp: answer.sdp,
            type: answer.type,
          });
        } else if (signal.type === 'answer') {
          const pc = peersRef.current.get(from);
          if (pc) {
            await pc.setRemoteDescription({
              type: 'answer',
              sdp: String(signal.payload.sdp || ''),
            });
          }
        } else if (signal.type === 'ice') {
          const pc = peersRef.current.get(from) || (await createPeer(from, false));
          if (pc && signal.payload.candidate) {
            try {
              await pc.addIceCandidate(signal.payload.candidate as RTCIceCandidateInit);
            } catch {
              // ignore late/bad candidates
            }
          }
        }
      }
    },
    [createPeer, localUserId, micOn]
  );

  const stopAll = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close());
    peersRef.current.clear();
    remoteAudioRef.current.forEach((el) => {
      el.srcObject = null;
      el.remove();
    });
    remoteAudioRef.current.clear();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setMicOn(false);
  }, []);

  const toggleMic = useCallback(async () => {
    if (!enabled) {
      setError('Voice is disabled in this theater.');
      return;
    }

    if (micOn) {
      stopAll();
      return;
    }

    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      localStreamRef.current = stream;
      setMicOn(true);

      const others = membersRef.current.filter(
        (m) => m.user_id !== localUserId && m.online
      );
      for (const member of others) {
        // Lower id initiates to avoid glare
        const asOfferer = localUserId < member.user_id;
        await createPeer(member.user_id, asOfferer);
      }
    } catch (e) {
      setError('Microphone permission denied or unavailable.');
      stopAll();
    }
  }, [createPeer, enabled, localUserId, micOn, stopAll]);

  useEffect(() => {
    if (!micOn || !enabled) return;

    const onlineOthers = members.filter((m) => m.user_id !== localUserId && m.online);
    onlineOthers.forEach((m) => {
      if (!peersRef.current.has(m.user_id)) {
        const asOfferer = localUserId < m.user_id;
        void createPeer(m.user_id, asOfferer);
      }
    });

    peersRef.current.forEach((pc, userId) => {
      if (!onlineOthers.some((m) => m.user_id === userId)) {
        pc.close();
        peersRef.current.delete(userId);
      }
    });
  }, [createPeer, enabled, localUserId, members, micOn]);

  useEffect(() => () => stopAll(), [stopAll]);

  return {
    micOn,
    error,
    toggleMic,
    handleSignals,
    stopAll,
  };
}

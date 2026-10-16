import type { PartyMember } from '@/types/party';

type Props = {
  members: PartyMember[];
  maxMembers: number;
};

export function PartyMembers({ members, maxMembers }: Props) {
  const onlineCount = members.filter((m) => m.online).length;
  const waitingForCompany = onlineCount < 2;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Watching ({members.length}/{maxMembers})
      </h3>
      {waitingForCompany ? (
        <p className="text-xs text-zinc-500">Waiting for someone else to join…</p>
      ) : (
        <p className="text-xs text-emerald-600 dark:text-emerald-500/90">Synced · ready to play</p>
      )}
      <ul className="space-y-1">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-100">
            <span
              className={`size-2 rounded-full ${m.online ? 'bg-emerald-500' : 'bg-zinc-400 dark:bg-zinc-600'}`}
              title={m.online ? 'Online' : 'Away'}
            />
            <span className="truncate">{m.name || `User #${m.user_id}`}</span>
            {m.is_host && (
              <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] uppercase text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                Host
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

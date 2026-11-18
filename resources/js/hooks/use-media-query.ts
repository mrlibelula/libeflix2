import { useEffect, useState } from 'react';

/** Below Tailwind's `lg` breakpoint — party theater uses its compact (mobile) layout. */
export const PARTY_COMPACT_QUERY = '(max-width: 1023.98px)';

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
  interval: number;
  enabled?: boolean;
  immediate?: boolean;
}

export function usePolling<T>(
  fetchFn: () => Promise<T>,
  { interval, enabled = true, immediate = true }: UsePollingOptions
) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const enabledRef = useRef(enabled);
  const fetchFnRef = useRef(fetchFn);

  // Update refs when props change
  useEffect(() => {
    enabledRef.current = enabled;
    fetchFnRef.current = fetchFn;
  });

  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    if (enabledRef.current) {
      intervalRef.current = setInterval(async () => {
        if (enabledRef.current) {
          try {
            await fetchFnRef.current();
          } catch (error) {
            // Errors should be handled in the provided fetch function
          }
        }
      }, interval);
    }
  }, [interval]);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const restartPolling = useCallback(() => {
    stopPolling();
    startPolling();
  }, [startPolling, stopPolling]);

  // Initialize polling on mount
  useEffect(() => {
    if (enabled && immediate) {
      fetchFnRef.current().catch(() => {
        // Errors should be handled in the provided fetch function
      });
    }

    if (enabled) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, []); // Empty dependency array to prevent infinite re-renders

  // Handle enabled state changes
  useEffect(() => {
    enabledRef.current = enabled;
    if (enabled) {
      startPolling();
    } else {
      stopPolling();
    }
  }, [enabled, startPolling, stopPolling]);

  return {
    startPolling,
    stopPolling,
    restartPolling,
  };
} 
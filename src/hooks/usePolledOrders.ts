import React, { useState, useEffect, useRef, useCallback } from 'react';

export interface UsePolledOrdersOptions {
  intervalMs?: number;
  enabled?: boolean;
}

export interface UsePolledOrdersResult<T> {
  data: T[];
  isLoading: boolean;
  error: Error | null;
  refetchNow: () => Promise<void>;
  setData: React.Dispatch<React.SetStateAction<T[]>>;
}

/**
 * Custom hook for polling order/review endpoints with smart diffing
 * to avoid unnecessary React re-renders and auto-pausing on inactive tabs.
 */
export function usePolledOrders<T = any>(
  endpoint: string,
  options: UsePolledOrdersOptions = {}
): UsePolledOrdersResult<T> {
  const { intervalMs = 3000, enabled = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  // Store serialized representation of last data to avoid unnecessary state replacement
  const lastDataJsonRef = useRef<string>('');
  const isMountedRef = useRef<boolean>(true);
  const isFetchingRef = useRef<boolean>(false);

  const fetchData = useCallback(async (isInitial: boolean = false) => {
    if (!endpoint || !enabled || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      if (isInitial && lastDataJsonRef.current === '') {
        setIsLoading(true);
      }

      const res = await fetch(endpoint, {
        headers: { 'Cache-Control': 'no-cache' }
      });

      if (!res.ok) {
        throw new Error(`Failed to fetch orders from ${endpoint}: ${res.statusText}`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        // Dev server or proxy returned HTML fallback during restart/transition, ignore silently
        return;
      }

      const text = await res.text();
      if (!text || text.startsWith('<')) {
        return;
      }

      let json: any;
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        return;
      }

      const items: T[] = Array.isArray(json) ? json : (json.data || json.rows || []);
      const newJsonString = JSON.stringify(items);

      if (isMountedRef.current) {
        // Deep compare / stringify compare to prevent re-renders when data has not changed
        if (newJsonString !== lastDataJsonRef.current) {
          lastDataJsonRef.current = newJsonString;
          setData(items);
        }
        setError(null);
      }
    } catch (err: any) {
      if (isMountedRef.current) {
        // Suppress noisy network console errors in client preview/static hosting
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      isFetchingRef.current = false;
      if (isMountedRef.current && isInitial) {
        setIsLoading(false);
      }
    }
  }, [endpoint, enabled]);

  const refetchNow = useCallback(async () => {
    await fetchData(false);
  }, [fetchData]);

  useEffect(() => {
    isMountedRef.current = true;

    if (!enabled) {
      setIsLoading(false);
      return;
    }

    // Initial fetch
    fetchData(true);

    let timer: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (timer) clearInterval(timer);
      timer = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData(false);
        }
      }, intervalMs);
    };

    const stopPolling = () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    };

    // Start polling if document is visible
    if (document.visibilityState === 'visible') {
      startPolling();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData(false); // Fetch immediately upon tab refocus
        startPolling();
      } else {
        stopPolling(); // Pause polling when tab is inactive
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchData, intervalMs, enabled]);

  return {
    data,
    isLoading,
    error,
    refetchNow,
    setData
  };
}

export default usePolledOrders;

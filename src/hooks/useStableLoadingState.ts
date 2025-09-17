import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingState {
  isLoading: boolean;
  conversationId?: string;
}

/**
 * Stable loading state management to prevent race conditions
 * and ensure loading indicators properly wait for message delivery
 */
export function useStableLoadingState() {
  const [loadingState, setLoadingStateInternal] = useState<LoadingState>({ isLoading: false });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const loadingStartTime = useRef<number>(0);

  const setLoadingState = useCallback((state: LoadingState) => {
    if (state.isLoading) {
      loadingStartTime.current = Date.now();
      
      // Clear any existing timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      // Set a safety timeout to prevent infinite loading
      timeoutRef.current = setTimeout(() => {
        console.warn('Loading state timeout - clearing after 45 seconds');
        setLoadingStateInternal({ isLoading: false });
      }, 45000);
    } else {
      // Clear timeout when loading is done
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = undefined;
      }
    }
    
    setLoadingStateInternal(state);
  }, []);

  const clearLoadingState = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = undefined;
    }
    setLoadingStateInternal({ isLoading: false });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    loadingState,
    setLoadingState,
    clearLoadingState,
    loadingDuration: loadingState.isLoading ? Date.now() - loadingStartTime.current : 0
  };
}
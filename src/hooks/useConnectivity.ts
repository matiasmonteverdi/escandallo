import { useEffect } from 'react';
import { useAppStore } from '../store/useAppStore';

export function useConnectivity() {
  const setOnline = useAppStore(state => state.setOnline);
  const isOnline = useAppStore(state => state.isOnline);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check
    setOnline(navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [setOnline]);

  return { isOnline };
}

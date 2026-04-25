import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setInstallPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;

    // Show the prompt
    installPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await installPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the PWA install');
    } else {
      console.log('User dismissed the PWA install');
    }

    // Clear the saved prompt since it can't be used again
    setInstallPrompt(null);
    setIsInstallable(false);
  };

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

  return { isInstallable, handleInstall, isIOS, isStandalone };
}

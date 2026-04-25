import { useState, useEffect } from 'react';

export function usePWAInstall() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt captured');
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true;
  const isAndroid = /Android/.test(navigator.userAgent);

  const handleInstall = async () => {
    console.log('[PWA] Install button clicked, prompt:', installPrompt);

    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      console.log('[PWA] User choice:', outcome);
      setInstallPrompt(null);
      return;
    }

    // Fallback: no prompt available (browser already showed it, or criteria not met)
    if (isIOS) {
      alert('Para instalar en iPhone/iPad:\n1. Pulsa el botón "Compartir" (cuadrado con flecha)\n2. Selecciona "Añadir a la pantalla de inicio"');
      return;
    }

    if (isAndroid) {
      alert('Para instalar:\n1. Abre el menú del navegador (⋮)\n2. Selecciona "Añadir a pantalla de inicio" o "Instalar aplicación"');
      return;
    }

    // Desktop Chrome/Edge fallback
    alert('Para instalar:\n1. Busca el icono de instalación (⊕) en la barra de direcciones\n2. O abre el menú del navegador y busca "Instalar"');
  };

  // Show button if not already installed as standalone
  const isInstallable = !isStandalone;

  return { isInstallable, handleInstall, isIOS, isAndroid, isStandalone, hasNativePrompt: !!installPrompt };
}

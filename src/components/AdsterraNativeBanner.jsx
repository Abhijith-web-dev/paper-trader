import React, { useEffect } from 'react';
import { ADSTERRA_CONFIG } from '../config/adsterra';

/**
 * Adsterra Native Banner Widget
 * 
 * Container: container-888259038f64ffcff3fbd3c3c0ab4f09
 * Script: https://bauval.org/21/888259038f64ffcff3fbd3c3c0ab4f09
 */
export default function AdsterraNativeBanner({ className = '' }) {
  const nativeConfig = ADSTERRA_CONFIG.formats.native;

  useEffect(() => {
    if (!nativeConfig.enabled || !nativeConfig.scriptUrl) return;

    const scriptId = 'adsterra-native-script';
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.id = scriptId;
      script.type = 'text/javascript';
      script.src = nativeConfig.scriptUrl;
      script.async = true;
      script.setAttribute('data-cfasync', 'false');
      document.body.appendChild(script);
    }
  }, [nativeConfig]);

  if (!nativeConfig.enabled) return null;

  return (
    <div className={`adsterra-native-wrapper my-4 flex justify-center ${className}`}>
      <div id={nativeConfig.containerId} />
    </div>
  );
}

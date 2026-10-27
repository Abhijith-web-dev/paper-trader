import React, { lazy } from 'react';

/**
 * Resilient Dynamic Module Importer with Automatic Reload Recovery
 * 
 * Solves the classic Vite production deployment race condition:
 * When a new version is deployed to Firebase Hosting, old JavaScript chunk hashes
 * are replaced by new hashes. Users with an older index.html in cache or memory
 * would get a "Failed to fetch dynamically imported module" error upon clicking
 * code-split routes like the Screener or Journal.
 * 
 * lazyWithRetry:
 * 1. Attempts normal dynamic import.
 * 2. If it fails due to a chunk hash mismatch / 404, triggers a single force-refresh
 *    to fetch the latest index.html with new chunk hashes.
 * 3. Prevents infinite refresh loops using sessionStorage.
 */
export function lazyWithRetry(componentImport, componentName = 'component') {
  return lazy(async () => {
    const storageKey = `retry_import_${componentName}`;
    const hasRetried = window.sessionStorage.getItem(storageKey) === 'true';

    try {
      const module = await componentImport();
      window.sessionStorage.removeItem(storageKey);
      return module;
    } catch (error) {
      console.warn(`[ModuleLoader] Chunk import failed for ${componentName}:`, error);

      // Check if this error is due to chunk mismatch / network failure
      const isChunkError = 
        error?.message?.includes('Failed to fetch dynamically imported module') ||
        error?.message?.includes('error loading dynamically imported module') ||
        error?.message?.includes('Loading chunk') ||
        error?.name === 'ChunkLoadError';

      if (isChunkError && !hasRetried) {
        window.sessionStorage.setItem(storageKey, 'true');
        console.info(`[ModuleLoader] New deployment detected. Reloading to fetch latest application chunks...`);
        window.location.reload();
        // Return an empty promise to prevent rendering crash while reload executes
        return new Promise(() => {});
      }

      // If already retried and still failing, throw to ErrorBoundary
      window.sessionStorage.removeItem(storageKey);
      throw error;
    }
  });
}

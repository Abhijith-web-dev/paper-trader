/**
 * Client-Side Backtester Runner Bridge
 * Spawns the backtester Web Worker and manages postMessage lifecycle.
 */

export function runBacktestAsync(params) {
  return new Promise((resolve, reject) => {
    try {
      const worker = new Worker(
        new URL('../workers/backtester.worker.js', import.meta.url),
        { type: 'module' }
      );

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('Backtest simulation timed out after 30 seconds.'));
      }, 30000);

      worker.onmessage = (e) => {
        clearTimeout(timeout);
        worker.terminate();
        if (e.data.error) {
          reject(new Error(e.data.error));
        } else {
          resolve(e.data.results);
        }
      };

      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new Error(err.message || 'Worker thread execution error'));
      };

      worker.postMessage(params);
    } catch (err) {
      reject(err);
    }
  });
}

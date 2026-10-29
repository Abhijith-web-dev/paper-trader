/* Monetag Push Notifications & MultiTag Service Worker */
/* Zone ID: 12144415 */
self.options = {
  domain: "alwingulla.com",
  zoneId: 12144415
};

self.lary = "";

try {
  importScripts('https://alwingulla.com/act/files/service-worker.min.js?r=sw');
} catch (e) {
  // Service worker fallback handling
}

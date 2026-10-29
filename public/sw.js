/* Monetag Official Service Worker */
/* MultiTag Zone: 303149 */
self.options = {
  domain: "quge5.com",
  zoneId: 303149
};

self.lary = "";

try {
  importScripts('https://quge5.com/act/files/service-worker.min.js?r=sw');
} catch (e) {
  // Service worker fallback handling
}

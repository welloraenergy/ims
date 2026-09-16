const CACHE_NAME='wellora-ims-install-v2';
const INSTALL_ASSETS=['./icon-192.png','./icon-512.png','./apple-touch-icon.png','./favicon-32x32.png','./manifest.webmanifest'];

self.addEventListener('install',event=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache=>cache.addAll(INSTALL_ASSETS))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',event=>{
  event.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key))))
      .then(()=>self.clients.claim())
  );
});

// IMS is intentionally online-only. The service worker exists for installability
// and install assets only; application/data requests always go to the network.
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin===self.location.origin&&INSTALL_ASSETS.some(path=>url.pathname.endsWith(path.replace('./','/')))){
    event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(fetch(event.request));
});

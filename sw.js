/* Service worker do VanBerto's — Detetive do E-mail.
   Estratégia simples: responde da cache se existir (para funcionar sem rede
   depois da 1ª visita) e, em paralelo, tenta atualizar a cache a partir da
   rede sempre que há ligação. Coloca este ficheiro na MESMA pasta do
   index.html para o registo funcionar. */

const CACHE_NAME = 'vanbertos-detetive-email-v1';
const CORE_ASSETS = [
  './',
  './index.html'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      return cache.addAll(CORE_ASSETS).catch(function(){ /* algum caminho pode não existir consoante o alojamento */ });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE_NAME; })
            .map(function(k){ return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event){
  if(event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function(cached){
      var networkFetch = fetch(event.request).then(function(response){
        if(response && (response.ok || response.type === 'opaque')){
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function(cache){ cache.put(event.request, copy); });
        }
        return response;
      }).catch(function(){ return cached; });

      /* mostra logo a versão em cache se existir (mais rápido e funciona offline);
         sem cache, espera pela rede */
      return cached || networkFetch;
    })
  );
});

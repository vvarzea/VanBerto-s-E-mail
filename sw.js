/* Service worker do VanBerto's — Detetive do E-mail.
   Estratégia simples: responde da cache se existir (para funcionar sem rede
   depois da 1ª visita) e, em paralelo, tenta atualizar a cache a partir da
   rede sempre que há ligação. As atualizações ficam guardadas para a abertura
   seguinte. Coloca este ficheiro na MESMA pasta do index.html para o registo
   funcionar (e mantém lá também o manifest, os ícones e a pasta fonts/). */

const CACHE_NAME = 'vanbertos-detetive-email-v4';
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png',
  './apple-touch-icon.png',
  './fonts/baloo-2-latin-500-normal.woff2',
  './fonts/baloo-2-latin-700-normal.woff2',
  './fonts/baloo-2-latin-800-normal.woff2',
  './fonts/inter-latin-400-normal.woff2',
  './fonts/inter-latin-500-normal.woff2',
  './fonts/inter-latin-600-normal.woff2',
  './fonts/inter-latin-700-normal.woff2'
];

self.addEventListener('install', function(event){
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache){
      /* um a um: se algum ficheiro não existir (consoante o alojamento), os outros ficam na mesma em cache */
      return Promise.all(CORE_ASSETS.map(function(url){
        return cache.add(url).catch(function(){ /* ignorar */ });
      }));
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
  var req = event.request;
  if(req.method !== 'GET') return;

  event.respondWith(
    /* ignoreSearch: um link com "?..." (ex.: partilhado por mensagem) usa a mesma cópia em cache */
    caches.match(req, { ignoreSearch: true }).then(function(cached){
      var network = fetch(req);

      /* atualiza a cache em segundo plano; o waitUntil impede que o browser interrompa a gravação */
      var stored = network.then(function(response){
        if(response && response.status !== 206 && (response.ok || response.type === 'opaque')){
          return caches.open(CACHE_NAME).then(function(cache){ return cache.put(req, response.clone()); });
        }
      }).catch(function(){ /* sem rede — ignorar */ });
      event.waitUntil(stored);

      /* mostra logo a versão em cache se existir (mais rápido e funciona offline);
         sem cache, espera pela rede — e, se a rede falhar, cai para o index.html em cache */
      if(cached) return cached;
      return network.catch(function(){
        if(req.mode === 'navigate'){
          return caches.match('./index.html').then(function(page){ return page || Response.error(); });
        }
        return Response.error();
      });
    })
  );
});

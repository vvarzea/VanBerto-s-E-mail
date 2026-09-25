/* Service worker do VanBerto's — Detetive do E-mail.
   Duas estratégias:
   • A PÁGINA (index.html): REDE PRIMEIRO, com limite de 3 segundos. Se a rede responder a
     tempo, o aluno vê logo a versão mais recente (e a cache fica atualizada). Se a rede
     estiver lenta ou sem ligação, abre a cópia em cache — por isso continua a funcionar
     sem rede depois da 1ª visita.
   • Ícones, fontes e manifest: cache primeiro (abrem logo), com atualização em segundo plano
     para a abertura seguinte.
   Coloca este ficheiro na MESMA pasta do index.html para o registo funcionar (e mantém lá
   também o manifest, os ícones e a pasta fonts/). */

const CACHE_NAME = 'vanbertos-detetive-email-v6';
const PAGE_TIMEOUT_MS = 3000;
const INDEX_URL = new URL('./index.html', self.registration.scope).href;
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

/* é um pedido da página principal? (abrir o jogo, "./" ou "index.html") */
function isPageRequest(req, url){
  if(url.origin !== self.location.origin) return false;
  return req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
}

/* Rede primeiro com limite de tempo; cache se a rede for lenta, falhar ou der erro. */
function pageNetworkFirst(event, req){
  var timer;

  var network = fetch(req);

  /* guarda a versão nova na cache assim que chegar (mesmo que já tenhamos aberto a cópia antiga);
     o waitUntil impede que o browser interrompa a gravação. Guarda sempre sob o mesmo endereço,
     para links com "?..." não criarem cópias diferentes. */
  var stored = network.then(function(response){
    if(response && response.ok){
      var copy = response.clone();
      return caches.open(CACHE_NAME).then(function(cache){ return cache.put(INDEX_URL, copy); });
    }
  }).catch(function(){ /* sem rede — ignorar */ });
  event.waitUntil(stored);

  var timeout = new Promise(function(resolve){
    timer = setTimeout(function(){ resolve(null); }, PAGE_TIMEOUT_MS);
  });

  return Promise.race([network, timeout]).then(function(response){
    clearTimeout(timer);
    if(response && response.ok) return response;            /* rede a tempo: versão mais recente */
    return caches.match(INDEX_URL).then(function(cached){   /* rede lenta ou com erro: cópia em cache */
      if(cached) return cached;
      return response || network;                           /* 1ª visita, sem cópia: espera pela rede */
    });
  }).catch(function(){                                       /* sem rede: cópia em cache */
    clearTimeout(timer);
    return caches.match(INDEX_URL).then(function(cached){ return cached || Response.error(); });
  });
}

self.addEventListener('fetch', function(event){
  var req = event.request;
  if(req.method !== 'GET') return;

  var url = new URL(req.url);
  if(isPageRequest(req, url)){
    event.respondWith(pageNetworkFirst(event, req));
    return;
  }

  /* ícones, fontes e manifest: cache primeiro.
     ignoreSearch: um link com "?..." (ex.: partilhado por mensagem) usa a mesma cópia em cache */
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(function(cached){
      var network = fetch(req);

      /* atualiza a cache em segundo plano; o waitUntil impede que o browser interrompa a gravação */
      var stored = network.then(function(response){
        if(response && response.status !== 206 && (response.ok || response.type === 'opaque')){
          return caches.open(CACHE_NAME).then(function(cache){ return cache.put(req, response.clone()); });
        }
      }).catch(function(){ /* sem rede — ignorar */ });
      event.waitUntil(stored);

      /* mostra logo a versão em cache se existir; sem cache, espera pela rede */
      if(cached) return cached;
      return network.catch(function(){ return Response.error(); });
    })
  );
});

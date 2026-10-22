'use strict';

const VERSAO = 'quadro-v3';
const PRINCIPAIS = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO).then(c => c.addAll(PRINCIPAIS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(chaves => Promise.all(chaves.filter(c => c !== VERSAO).map(c => caches.delete(c))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => Response.json(
        { erro: 'Sem conexão. Reconnecte para atualizar os horários.' },
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      ))
    );
    return;
  }

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          caches.open(VERSAO).then(c => c.match('./index.html').then(hit => {
            if (!hit) c.add('./index.html').catch(() => { });
          }));
          return r;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit =>
      hit ||
      fetch(e.request).then(r => {
        const copia = r.clone();
        caches.open(VERSAO).then(c => c.put(e.request, copia)).catch(() => { });
        return r;
      })
    )
  );
});

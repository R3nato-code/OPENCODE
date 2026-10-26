'use strict';

const VERSAO = 'pixel-chess-v1';
const PRINCIPAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSAO)
      .then(c => c.addAll(PRINCIPAIS))
      .then(() => self.skipWaiting())
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
  if (e.request.method !== 'GET') return;

  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.ok) {
            const copia = r.clone();
            caches.open(VERSAO).then(c => c.put('./index.html', copia)).catch(() => {});
          }
          return r;
        })
        .catch(() => caches.match('./index.html').then(hit => hit || caches.match('./')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(hit => {
      const atualiza = fetch(e.request)
        .then(r => {
          if (r && r.ok) {
            const copia = r.clone();
            caches.open(VERSAO).then(c => c.put(e.request, copia)).catch(() => {});
          }
          return r;
        })
        .catch(() => hit);
      return hit || atualiza;
    })
  );
});

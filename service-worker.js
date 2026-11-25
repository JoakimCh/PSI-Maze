const PREFIX = 'psi-maze:'
const CACHE = PREFIX + 'v2'
const shell = [
  './index.html', './style.css', './app.js', './maze.js', './steering.js', './apple.js', './microphone.js', './history.js',
  './TRNG.audioWorklet.js', './manifest.webmanifest', './icon-192.png', './icon-512.png', './icon-maskable.png'
]
const index = new URL('./index.html', self.registration.scope).href
const assets = new Set(shell.map(path => new URL(path, self.registration.scope).href))

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(shell)))
})
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys()
    await Promise.all(names.filter(name => name.startsWith(PREFIX) && name !== CACHE).map(name => caches.delete(name)))
    await self.clients.claim()
  })())
})
self.addEventListener('fetch', event => {
  const { request } = event
  if (request.method !== 'GET' || !request.url.startsWith(self.registration.scope)) return
  if (request.mode !== 'navigate' && !assets.has(request.url)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE)
    const response = await cache.match(request.mode === 'navigate' ? index : request)
    return response ?? fetch(request)
  })())
})

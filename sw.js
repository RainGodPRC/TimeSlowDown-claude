// TSD Claude Code 分支 Service Worker
const CACHE = 'tsd-cc-v37';
const ASSETS = ['./', './index.html', './styles.css?v=34', './app.js?v=34', './data.js?v=34', './push.js?v=34', './widget.js?v=34', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});

// Periodic Background Sync：让 home-screen badge 在 app 未开时也演化（Finch 式活体存在）
// 守原则5：周期 sync 只更新 badge 0/1，绝不触发推送/弹窗/计数
self.addEventListener('periodicsync', (e) => {
  if (e.tag !== 'tsd-widget-sync') return;
  e.waitUntil(
    (async () => {
      // SW 无 DOM/TSD 访问，只能通知 client 重新同步 badge
      const clients = await self.clients.matchAll({ includeUncontrolled: true });
      clients.forEach(c => c.postMessage({ type: 'tsd-sync-badge' }));
    })()
  );
});

// 接收 client 消息：无 client 响应时（app 未开），SW 无法读 IndexedDB 的 TSD 状态
// 故 periodic-sync 仅作为"唤醒已打开的 client 刷新 badge"的机制；真正的离线 badge 演化需原生壳
self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'tsd-skip-waiting') self.skipWaiting();
});

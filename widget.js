/* ============================================================
   TSD Widget Badge 控制器（Finch 式 home-screen 活体存在）
   守原则5：只 0/1 安静点，永不计数/永不"漏 X 天"/永不红点焦虑
   守原则9：widget 模式是 home-screen 入口的超精简单屏，不延长会话

   三层落地（守"单文件 PWA 不碰原生"边界）：
   1. App Badging API：navigator.setAppBadge / clearAppBadge（Chromium / Android Add-to-Home-Screen 生效；iOS Safari 静默降级）
   2. Periodic Background Sync：让 badge 在 app 未开时也随时间演化（原生壳走 Capacitor Background Task；web 走 SW periodic-sync，不生效时静默）
   3. Widget Mode：从 home-screen 启动带 ?from=widget → 超精简单屏（echo 缩略 + 留半句提示），原生 WidgetKit 留待 Xcode hand-off
   ============================================================ */

const WidgetBadge = (() => {
  const BADGE_API = () => {
    try { return navigator.setAppBadge ? navigator : null; } catch (e) { return null; }
  };

  // 同步 home-screen 图标 badge（只 0/1，永不计数）
  async function sync() {
    const nav = BADGE_API();
    if (!nav) return false;
    try {
      const b = (typeof TSD !== 'undefined') ? TSD.badgeState() : { dot: false };
      if (b.dot) {
        // 只显示 1（"有新回声"），绝不显示漏天数/未读数
        if (navigator.setAppBadge) await navigator.setAppBadge(1);
      } else {
        if (navigator.clearAppBadge) await navigator.clearAppBadge();
      }
      return true;
    } catch (e) { return false; }
  }

  // Periodic Background Sync 注册（让 badge 在 app 未开时演化）
  // 守原则5：周期 sync 只更新 badge 状态，绝不触发推送/弹窗
  async function registerPeriodicSync() {
    if (!('serviceWorker' in navigator) || !('PeriodicSyncManager' in window)) return false;
    try {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.periodicSync) return false;
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return false;
      // 最小间隔 12h（一天最多 2 次静默更新，守低频原则）
      await reg.periodicSync.register('tsd-widget-sync', { minInterval: 12 * 60 * 60 * 1000 });
      return true;
    } catch (e) { return false; }
  }

  // 是否支持 home-screen 安装（Add to Home Screen / install prompt）
  function installable() {
    return 'BeforeInstallPromptEvent' in window || (/iphone|ipad|ipod/i.test(navigator.userAgent) && 'standalone' in navigator);
  }

  // iOS Add to Home Screen 检测（iOS Safari 无 beforeinstallprompt，靠手动 + 提示）
  function isStandalone() {
    return ('standalone' in navigator && navigator.standalone) || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);
  }

  return {
    sync,
    registerPeriodicSync,
    installable,
    isStandalone,
    hasBadgeApi: () => !!BADGE_API(),
  };
})();

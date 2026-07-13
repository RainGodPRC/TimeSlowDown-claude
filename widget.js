/* ============================================================
   TSD Widget Badge 控制器（Finch 式 home-screen 活体存在）
   守原则5：只 0/1 安静点，永不计数/永不"漏 X 天"/永不红点焦虑
   守原则9：widget 模式是 home-screen 入口的超精简单屏，不延长会话

   四层落地（原生 WidgetKit hand-off 已就绪）：
   1. App Badging API：navigator.setAppBadge / clearAppBadge（Chromium / Android Add-to-Home-Screen 生效；iOS Safari 静默降级）
   2. Periodic Background Sync：让 badge 在 app 未开时也随时间演化（原生壳走 Capacitor Background Task；web 走 SW periodic-sync，不生效时静默）
   3. Widget Mode：从 home-screen 启动带 ?from=widget → 超精简单屏（echo 缩略 + 留半句提示）
   4. 原生 WidgetKit（iOS）：通过 Capacitor TSDWidgetPlugin 写 App Group UserDefaults → Widget Extension 读 → 静态 widget 显示 header/sub + 安静点
      注：TSDWidgetPlugin 在 capacitor.config.json packageClassList 注册后生效；未注入时静默降级。
   ============================================================ */

const WidgetBadge = (() => {
  const BADGE_API = () => {
    try { return navigator.setAppBadge ? navigator : null; } catch (e) { return null; }
  };

  // Capacitor 原生 plugin 句柄（注入后用于 WidgetKit App Group 写入）
  const nativeWidget = () => {
    try {
      // Capacitor 6 全局：window.Capacitor.Plugins.TSDWidget
      const C = window.Capacitor;
      if (C && C.Plugins && C.Plugins.TSDWidget) return C.Plugins.TSDWidget;
      // @capacitor/core import 形式降级
      if (C && C.registerPlugin) {
        try { return C.registerPlugin('TSDWidget'); } catch (_) { return null; }
      }
      return null;
    } catch (e) { return null; }
  };

  // 当前 locale（"zh"|"en"），供 widget 文案
  const locale = () => {
    try { return (typeof I18N !== 'undefined' && I18N.getLocale) ? (I18N.getLocale() || 'zh').slice(0, 2) : 'zh'; }
    catch (e) { return 'zh'; }
  };

  // 把 widgetState 的 header/sub + 安静点写入原生 WidgetKit（App Group UserDefaults）
  // 守原则5：只传 dot true/false + 两句文案，永不传计数/天数。
  async function syncNativeWidget() {
    const plugin = nativeWidget();
    if (!plugin || typeof TSD === 'undefined') return false;
    try {
      const w = TSD.widgetState();
      const b = TSD.badgeState();
      await plugin.writeWidgetState({
        header: w.headline,
        sub: w.sub,
        dot: !!b.dot,
        locale: locale(),
        at: Date.now(),
      });
      return true;
    } catch (e) { return false; }
  }

  // 同步 home-screen 图标 badge（只 0/1，永不计数）+ 原生 widget 状态
  async function sync() {
    // 1. 原生 WidgetKit（iOS App Group）—— 优先，失败静默
    await syncNativeWidget();
    // 2. App Badging API（web / Android home-screen）
    const nav = BADGE_API();
    if (!nav) return true;
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
    syncNativeWidget,
    registerPeriodicSync,
    installable,
    isStandalone,
    hasBadgeApi: () => !!BADGE_API(),
    hasNativeWidget: () => !!nativeWidget(),
  };
})();

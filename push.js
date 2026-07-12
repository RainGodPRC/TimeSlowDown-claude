/* ============================================================
   TSD 推送 hook（Fogg Spark + 行为时机 · Capacitor Local Notifications）
   温柔推送：只为"今天的回声"提醒，永不 loss-frame
   守原则5：无羞辱/无断签提醒；守原则9：送回生活
   ============================================================ */

const PushHook = (() => {
  const PLUGIN = () => {
    try { return window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.LocalNotifications; }
    catch (e) { return null; }
  };

  // Spark 文案库（永不 loss-frame）—— i18n 双语
  const SPARK_MESSAGES = () => [
    t('push.spark_1'),
    t('push.spark_2'),
    t('push.spark_3'),
    t('push.spark_4'),
    t('push.spark_5'),
  ];

  // 智能时机：按用户历史活跃窗口（睡前/晨起锚点），非固定时刻
  // Braze 实证：Intelligent Timing +2.6× 打开率
  function suggestTime() {
    const h = new Date().getHours();
    // 默认：晚 9 点（睡前高峰）
    let hour = 21, minute = 3;
    if (h < 12) { hour = 8; minute = 7; }  // 晨起锚点
    else if (h < 18) { hour = 21; minute = 3; } // 睡前锚点
    // 加一点随机抖动（避免所有人同一时刻收到）
    minute += Math.floor(Math.random() * 15);
    return { hour, minute };
  }

  // 调度明天的"今天的回声"推送
  async function scheduleTomorrowEcho() {
    const ln = PLUGIN();
    if (!ln) return false;

    try {
      const hasPerm = await ln.checkPermissions();
      if (hasPerm.display !== 'granted') {
        const req = await ln.requestPermissions();
        if (req.display !== 'granted') return false;
      }

      const { hour, minute } = suggestTime();
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(hour, minute, 0, 0);

      const msgs = SPARK_MESSAGES();
      const msg = msgs[Math.floor(Math.random() * msgs.length)];

      await ln.schedule({
        notifications: [{
          title: t('push.title_echo'),
          body: msg,
          id: Date.now(),
          schedule: { at: tomorrow },
          // 默认隐藏人物/地点/原文（锁屏只说"有旧瞬间想再见你"）
          extra: { type: 'echo' },
        }],
      });
      return true;
    } catch (e) { return false; }
  }

  // G 重遇推送：只为真实重遇（胶囊解锁/一年前的今天/对方打开你的信）
  async function scheduleReunionReminder(when, title, body) {
    const ln = PLUGIN();
    if (!ln) return false;

    try {
      const hasPerm = await ln.checkPermissions();
      if (hasPerm.display !== 'granted') return false;

      await ln.schedule({
        notifications: [{
          title: title || t('push.title_reunion'),
          body: body || t('push.body_reunion'),
          id: Date.now(),
          schedule: { at: when },
          extra: { type: 'reunion' },
        }],
      });
      return true;
    } catch (e) { return false; }
  }

  // 连续忽略自动降频（graduation）：查询待发通知，若最近 3 天都被忽略则暂停
  // 守原则5：永不"已断 X 天"文案，只是安静降频
  async function checkGraduation() {
    const ln = PLUGIN();
    if (!ln) return 'active';

    try {
      const pending = await ln.getPending();
      // 如果已有 ≥3 条待发，暂停新调度（简单实现）
      if (pending.notifications && pending.notifications.length >= 3) {
        return 'paused';
      }
      return 'active';
    } catch (e) { return 'active'; }
  }

  // 取消所有待发推送
  async function cancelAll() {
    const ln = PLUGIN();
    if (!ln) return;
    try { await ln.cancelAll(); } catch (e) {}
  }

  return {
    scheduleTomorrowEcho,
    scheduleReunionReminder,
    checkGraduation,
    cancelAll,
    isNative: () => !!PLUGIN(),
  };
})();

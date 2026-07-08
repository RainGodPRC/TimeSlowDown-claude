/* ============================================================
   TSD Claude Code 分支 · 数据层
   三态模型：moment（瞬间）/ revisit（回访）/ layered（时间层叠）
   原始线索 / AI 草稿 / 用户确认版 三态分离保存
   ============================================================ */

const TSD = (() => {
  const KEY = 'tsd-cc-branch-v1';
  const VERSION = 1;

  // ---------- 种子瞬间（冷启动用） ----------
  // 覆盖日常/高光/家庭/模糊时间/平淡，让回声调度有素材
  const SEED_MOMENTS = [
    {
      id: 'm-seed-01',
      quote: '今天带孩子去公园，他第一次自己爬上滑梯。我在下面有点紧张。',
      kind: 'bloom', // 高光
      when: { precision: 'day', text: '去年秋天某个周六', start: daysAgo(290) },
      people: ['孩子'],
      place: '公园',
      tags: ['第一次', '陪伴'],
      media: null,
      important: true,
      createdAt: daysAgo(290) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-02',
      quote: '晚上跑了第一个5公里，最后一公里很想停，但还是跑完了。',
      kind: 'bloom',
      when: { precision: 'day', text: '三个月前的一个晚上', start: daysAgo(95) },
      people: [],
      place: '小区跑道',
      tags: ['坚持', '身体'],
      media: null,
      important: true,
      createdAt: daysAgo(95) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-03',
      quote: '晚上和爸爸吃了碗面，他说最近睡得还行。我发现他头发又白了一点。',
      kind: 'night', // 平淡带轻愁
      when: { precision: 'day', text: '两个月前', start: daysAgo(61) },
      people: ['爸爸'],
      place: '面馆',
      tags: ['家人', '时间'],
      media: null,
      important: true,
      createdAt: daysAgo(61) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-04',
      quote: '阳台上的薄荷不知道什么时候活了，今天浇水才发现它长了新叶。',
      kind: 'grass', // 日常
      when: { precision: 'day', text: '五周前', start: daysAgo(38) },
      people: [],
      place: '家',
      tags: ['日常', '小确幸'],
      media: null,
      important: false,
      createdAt: daysAgo(38) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-05',
      quote: '我好像20岁那年才学会骑自行车，具体哪天忘了。',
      kind: 'grass',
      when: { precision: 'age', text: '20岁那年', ageAnchor: 20, start: null },
      people: [],
      place: '记不清了',
      tags: ['第一次', '模糊'],
      media: null,
      important: false,
      createdAt: daysAgo(500) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-06',
      quote: '加班回家路上买了个烤红薯，特别烫，边走边换手。那一刻觉得冬天真的来了。',
      kind: 'grass',
      when: { precision: 'day', text: '上周三', start: daysAgo(9) },
      people: [],
      place: '回家路上',
      tags: ['日常', '季节'],
      media: null,
      important: false,
      createdAt: daysAgo(9) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-07',
      quote: '和老朋友通了四十分钟电话，聊到大学时候那次翘课去爬山。我们都笑了很久。',
      kind: 'bloom',
      when: { precision: 'day', text: '十二天前', start: daysAgo(12) },
      people: ['老朋友'],
      place: null,
      tags: ['友谊', '回忆'],
      media: null,
      important: true,
      createdAt: daysAgo(12) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
    {
      id: 'm-seed-08',
      quote: '今天还行。',
      kind: 'grass',
      when: { precision: 'day', text: '三天前', start: daysAgo(3) },
      people: [],
      place: null,
      tags: ['平淡'],
      media: null,
      important: false,
      createdAt: daysAgo(3) * 1000,
      source: 'seed',
      aiDraft: null,
      confirmed: true,
    },
  ];

  // 种子回访记录 —— 让"变厚"和"层叠"在首屏就能看到
  const SEED_REVISITS = [
    { id: 'r-01', momentId: 'm-seed-03', at: daysAgo(30) * 1000, feeling: '今天又想起这碗面。想周末回家一趟。', source: 'user' },
    { id: 'r-02', momentId: 'm-seed-03', at: daysAgo(10) * 1000, feeling: '爸爸最近接电话慢了半拍。', source: 'user' },
    { id: 'r-03', momentId: 'm-seed-01', at: daysAgo(20) * 1000, feeling: '孩子现在爬滑梯都不用我看着了。', source: 'user' },
    { id: 'r-04', momentId: 'm-seed-02', at: daysAgo(15) * 1000, feeling: '已经能跑8公里了。原来那天是真的开始。', source: 'user' },
    { id: 'r-05', momentId: 'm-seed-07', at: daysAgo(5) * 1000, feeling: '又想给他打个电话了。', source: 'user' },
  ];

  function daysAgo(n) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - n);
    return Math.floor(d.getTime() / 1000);
  }

  // ---------- 持久化（IndexedDB；商业级：突破 LocalStorage 5MB 上限 + 抗缓存清理）----------
  // 内存态 state 同步读写不变，IDB 作后端：启动 async 载入，save 异步写回
  const DB_NAME = 'tsd-cc';
  const STORE = 'kv';
  let _dbP = null;
  function idbOpen() {
    if (_dbP) return _dbP;
    _dbP = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => { const d = req.result; if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { _dbP = null; reject(req.error); };
    });
    return _dbP;
  }
  function idbGet(key) {
    return idbOpen().then(db => new Promise((resolve, reject) => {
      const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    }));
  }
  function idbSet(key, val) {
    return idbOpen().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    }));
  }

  let state = null;
  let _ready = null;
  // 启动时调用（app.js start 会 await）；从 IDB 载入，自动迁移旧 LocalStorage 数据
  function init() {
    if (_ready) return _ready;
    _ready = (async () => {
      let parsed = null;
      try {
        parsed = await idbGet(KEY);
        if (!parsed) {
          const ls = localStorage.getItem(KEY); // 迁移旧版数据
          if (ls) { parsed = JSON.parse(ls); await idbSet(KEY, parsed); }
        }
      } catch (e) {
        try { parsed = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
      }
      state = (parsed && parsed.version === VERSION) ? parsed : freshState();
      return state;
    })();
    return _ready;
  }
  function freshState() {
    return {
      version: VERSION,
      onboarded: false,
      birthYear: null,
      reviewContext: 'evening', // evening | weekend | morning
      notifications: false,
      privacyMode: 'private', // private | ai-assist
      aiConsent: false,
      moments: SEED_MOMENTS.slice(),
      revisits: SEED_REVISITS.slice(),
      settings: {
        reducedMotion: false,
        darkMode: 'auto',
        soundOn: false,
      },
      account: { tier: 'free', signedIn: false }, // free | pass | plus | family
      aiLog: [], // AI 任务记录
      lastEchoMomentId: null,
      lastEchoDate: null,
      achievements: {},
    };
  }
  function save() {
    if (!state) return;
    try { idbSet(KEY, state).catch(() => {}); } catch (e) {}
  }

  // ---------- moments ----------
  function getMoments() { return state.moments.slice(); }
  function getMoment(id) { return state.moments.find(m => m.id === id); }
  function addMoment(data) {
    const m = Object.assign({
      id: 'm-' + Date.now(),
      kind: 'grass',
      when: { precision: 'day', text: '今天', start: daysAgo(0) },
      people: [], place: null, tags: [],
      media: null, important: false,
      createdAt: Date.now(),
      source: 'user', aiDraft: null, confirmed: true,
    }, data);
    state.moments.unshift(m);
    save();
    return m;
  }
  function updateMoment(id, patch) {
    const m = getMoment(id);
    if (!m) return null;
    Object.assign(m, patch);
    save();
    return m;
  }

  // ---------- revisits ----------
  function getRevisits(momentId) {
    return state.revisits.filter(r => r.momentId === momentId).sort((a, b) => a.at - b.at);
  }
  function getRevisitCount(momentId) {
    return state.revisits.filter(r => r.momentId === momentId).length;
  }
  function addRevisit(momentId, feeling) {
    const r = {
      id: 'r-' + Date.now(),
      momentId,
      at: Date.now(),
      feeling: feeling || '',
      source: 'user',
    };
    state.revisits.push(r);
    save();
    return r;
  }

  // 回访厚度 —— 0次=草地，1次=花苞，2+次=变厚
  function thickness(momentId) {
    const c = getRevisitCount(momentId);
    if (c === 0) return 'grass';
    if (c === 1) return 'bloom';
    return 'thick';
  }

  // ---------- T2-ClaudeCode 回访候选发现 ----------
  // 与 Codex T2（今天不像昨天）的核心差异：本调度指向"过去哪个瞬间值得带回"
  function pickEcho() {
    // 当天已回访过则不再推（避免一天内重复）
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime();
    const alreadyToday = state.revisits.some(r => r.at >= todayMs);
    // 但允许今天再推一个新瞬间（回访是"带回"不是"记录"）
    // 反信息茧房：综合 久未回访 + 重要 + 随机 + 情境
    const candidates = state.moments.filter(m => m.confirmed !== false);
    if (!candidates.length) return null;

    const scored = candidates.map(m => {
      const revs = getRevisits(m.id);
      const lastSeen = revs.length ? Math.max(...revs.map(r => r.at)) : 0;
      const daysSince = lastSeen ? (Date.now() - lastSeen) / 86400000 : 999;
      let score = 0;
      score += Math.min(daysSince / 30, 3) * 10;        // 久未回访加权
      score += m.important ? 15 : 5;                     // 重要加权
      score += (m.kind === 'bloom' ? 4 : m.kind === 'night' ? 3 : 2);
      // 情境呼应：周末优先家庭/友谊类
      const dow = today.getDay();
      const isWeekend = dow === 0 || dow === 6;
      if (isWeekend && (m.tags.includes('家人') || m.tags.includes('友谊') || m.tags.includes('陪伴'))) score += 8;
      // 反茧房随机扰动
      score += Math.random() * 8;
      // 避免连续推同一个：上次推过的降权
      if (state.lastEchoMomentId === m.id) score *= 0.3;
      return { m, score, daysSince, count: revs.length };
    });
    scored.sort((a, b) => b.score - a.score);
    const picked = scored[0].m;
    state.lastEchoMomentId = picked.id;
    state.lastEchoDate = todayMs;
    save();
    return picked;
  }

  // ---------- 周回访图谱 ----------
  function weekRevisits() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0,0,0,0);
    const startMs = weekStart.getTime();
    return state.revisits
      .filter(r => r.at >= startMs)
      .sort((a, b) => a.at - b.at);
  }
  function weekRevisitStats() {
    const wr = weekRevisits();
    const byMoment = {};
    wr.forEach(r => { byMoment[r.momentId] = (byMoment[r.momentId] || 0) + 1; });
    const distinct = Object.keys(byMoment).length;
    const total = wr.length;
    // 回访密度 vs 可讲述性初步对照：被回访≥2次的瞬间视为"高密度"
    const thickIds = Object.entries(byMoment).filter(([,c]) => c >= 2).map(([id]) => id);
    const ws = new Date();
    ws.setDate(ws.getDate() - 6);
    ws.setHours(0, 0, 0, 0);
    return { total, distinct, thickIds, byMoment, weekStart: ws.getTime() };
  }

  // ---------- 三个月对照指标 ----------
  function ninetyDayStats() {
    const startMs = Date.now() - 90 * 86400000;
    const revs = state.revisits.filter(r => r.at >= startMs);
    const byMoment = {};
    revs.forEach(r => { byMoment[r.momentId] = (byMoment[r.momentId] || 0) + 1; });
    const revisitedIds = Object.keys(byMoment);
    const thickIds = revisitedIds.filter(id => byMoment[id] >= 2);
    const notRevisited = state.moments.filter(m => !byMoment[m.id] && m.when.start && (m.when.start * 1000) >= startMs);
    return {
      revisitedCount: revisitedIds.length,
      thickCount: thickIds.length,
      notRevisitedCount: notRevisited.length,
      byMoment,
      // 可讲述性自评占位（M2 真实用户验证）：被回访≥2次的瞬间，假设可讲述率更高
      hypothesisNote: '回访固化假设：被回访≥2次的瞬间，可讲述率应显著高于未回访瞬间。M2 真实用户验证。',
    };
  }

  // ---------- onboarding / settings ----------
  function setOnboarded(v) { state.onboarded = v; save(); }
  function setBirthYear(y) { state.birthYear = y; save(); }
  function setReviewContext(c) { state.reviewContext = c; save(); }
  function setNotifications(v) { state.notifications = v; save(); }
  function setPrivacyMode(m) { state.privacyMode = m; save(); }
  function setAiConsent(v) { state.aiConsent = v; save(); }
  function setSetting(k, v) { state.settings[k] = v; save(); }
  function setTier(t) { state.account.tier = t; state.account.signedIn = (t !== 'free'); save(); }

  // ---------- AI 任务日志（可审计、可撤销） ----------
  function logAiTask(task) {
    const t = Object.assign({
      id: 'ai-' + Date.now(),
      at: Date.now(),
      type: 'T0', // T0-T4
      status: 'done', // done | reverted
      revertedAt: null,
      payload: null,
      result: null,
      localOnly: true,
    }, task);
    state.aiLog.unshift(t);
    if (state.aiLog.length > 50) state.aiLog.pop();
    save();
    return t;
  }
  function revertAiTask(id) {
    const t = state.aiLog.find(x => x.id === id);
    if (t) { t.status = 'reverted'; t.revertedAt = Date.now(); save(); }
    return t;
  }
  function getAiLog() { return state.aiLog.slice(); }

  // ---------- 成就 / 里程碑（非惩罚式 · 回访论点对齐）----------
  // 守原则5：只靠"做到了什么"解锁，绝不靠"没漏掉"——漏记不损失任何成就，无断签羞辱
  const ACHIEVEMENTS = [
    { id: 'first_echo', icon: '⊜', title: '第一次被带回', desc: '完成今天的第一次回声', test: s => s.onboarded },
    { id: 'first_layer', icon: '✎', title: '时间层叠', desc: '回访时留下第一句"现在再看"', test: s => s.revisits.some(r => r.feeling && r.feeling.trim()) },
    { id: 'thick', icon: '◈', title: '开始变厚', desc: '有一个瞬间被回访 ≥2 次', test: s => { const c = {}; s.revisits.forEach(r => c[r.momentId] = (c[r.momentId] || 0) + 1); return Object.values(c).some(n => n >= 2); } },
    { id: 'diverse', icon: '⚯', title: '不困在一个瞬间', desc: '一周内回访 ≥3 个不同瞬间', test: s => { const wk = Date.now() - 7 * 864e5; return new Set(s.revisits.filter(r => r.at >= wk).map(r => r.momentId)).size >= 3; } },
    { id: 'revisit10', icon: '◯', title: '回访图谱 · 10', desc: '累计回访满 10 次', test: s => s.revisits.length >= 10 },
    { id: 'revisit30', icon: '◉', title: '回访图谱 · 30', desc: '累计回访满 30 次', test: s => s.revisits.length >= 30 },
  ];
  function checkAchievements() {
    if (!state.achievements) state.achievements = {}; // 迁移：旧 state 无此字段
    const newly = [];
    for (const a of ACHIEVEMENTS) {
      if (!state.achievements[a.id] && a.test(state)) { state.achievements[a.id] = Date.now(); newly.push(a); }
    }
    if (newly.length) save();
    return newly;
  }
  function getAchievements() {
    const u = state.achievements || {};
    return ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, title: a.title, desc: a.desc, unlocked: !!u[a.id], at: u[a.id] || null }));
  }

  // ---------- 导出 / 清空 ----------
  function exportData() {
    return JSON.parse(JSON.stringify(state));
  }
  function clearAll() {
    state = freshState();
    state.onboarded = true; // 清空后不重新走 onboarding
    save();
  }

  // ---------- 记忆包：版本化导出 / 校验 / 导入 ----------
  // 非密码学完整性校验（djb2 变体）：用于检测传输/存储损坏，不用于防篡改
  function checksum(str) {
    let h = 5381;
    for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
    return (h >>> 0).toString(16).padStart(8, '0');
  }
  const PKG_VERSION = 1;

  function makePackage() {
    const data = JSON.parse(JSON.stringify(state));
    const body = JSON.stringify(data);
    return {
      schema: 'tsd-memory-package',
      pkgVersion: PKG_VERSION,
      appVersion: VERSION,
      exportedAt: Date.now(),
      counts: { moments: data.moments.length, revisits: data.revisits.length, aiLog: data.aiLog.length },
      checksum: checksum(body),
      note: '非密码学校验和，仅检测损坏',
      data,
    };
  }

  // 校验包，返回 { ok, errors[], matched, counts, ... }，不写状态
  function importPackage(pkg) {
    const errors = [];
    if (!pkg || typeof pkg !== 'object') { errors.push('包不是有效对象'); }
    else {
      if (pkg.schema !== 'tsd-memory-package') errors.push('schema 不匹配（期望 tsd-memory-package）');
      if (typeof pkg.pkgVersion !== 'number') errors.push('缺少 pkgVersion');
      if (pkg.pkgVersion !== PKG_VERSION) errors.push('包版本不匹配（期望 ' + PKG_VERSION + '，包内 ' + pkg.pkgVersion + '）');
      if (!pkg.data || typeof pkg.data !== 'object') errors.push('缺少 data 字段');
      else if (pkg.data.version !== VERSION) errors.push('数据版本不匹配（期望 ' + VERSION + '，包内 ' + pkg.data.version + '）');
    }
    if (errors.length) return { ok: false, errors, matched: false, counts: null };
    const body = JSON.stringify(pkg.data);
    const calc = checksum(body);
    const matched = (calc === pkg.checksum);
    if (!matched) errors.push('完整性校验失败：checksum 不一致，包可能损坏或被改动');
    return {
      ok: matched, errors, matched,
      counts: pkg.counts || { moments: pkg.data.moments.length, revisits: pkg.data.revisits.length, aiLog: pkg.data.aiLog.length },
      checksumExpected: pkg.checksum, checksumActual: calc,
    };
  }
  // 校验通过后调用：替换状态
  function applyImport(pkg) {
    state = JSON.parse(JSON.stringify(pkg.data));
    save();
    return state;
  }

  // ---------- 软删除 + 墓碑撤销 ----------
  // 删除前快照到独立 key，生成回执；用户可在会话内撤销
  const TOMBSTONE_KEY = KEY + '-tombstone';

  function softDelete() {
    const counts = { moments: state.moments.length, revisits: state.revisits.length, aiLog: state.aiLog.length };
    const savedAt = Date.now();
    try {
      localStorage.setItem(TOMBSTONE_KEY, JSON.stringify({ savedAt, data: JSON.parse(JSON.stringify(state)) }));
    } catch (e) {}
    state = freshState();
    state.onboarded = true;
    save();
    return { receiptToken: 'TSD-DEL-' + savedAt.toString(36).toUpperCase(), savedAt, counts };
  }
  function hasTombstone() {
    try { return !!localStorage.getItem(TOMBSTONE_KEY); } catch (e) { return false; }
  }
  function restoreTombstone() {
    try {
      const raw = localStorage.getItem(TOMBSTONE_KEY);
      if (!raw) return false;
      state = JSON.parse(raw).data;
      save();
      localStorage.removeItem(TOMBSTONE_KEY);
      return true;
    } catch (e) { return false; }
  }
  function clearTombstone() {
    try { localStorage.removeItem(TOMBSTONE_KEY); } catch (e) {}
  }

  // ---------- 生命周格 ----------
  function lifeWeeks() {
    if (!state.birthYear) return null;
    const now = new Date();
    const birth = new Date(state.birthYear, 0, 1);
    const weeks = Math.floor((now - birth) / (7 * 86400000));
    return { lived: weeks, total: 52 * 90, current: weeks };
  }

  return {
    reset: () => { state = freshState(); save(); },
    init,
    raw: () => state,
    getMoments, getMoment, addMoment, updateMoment,
    getRevisits, getRevisitCount, addRevisit, thickness,
    pickEcho, weekRevisits, weekRevisitStats, ninetyDayStats,
    setOnboarded, setBirthYear, setReviewContext, setNotifications,
    setPrivacyMode, setAiConsent, setSetting, setTier,
    logAiTask, revertAiTask, getAiLog,
    checkAchievements, getAchievements,
    exportData, clearAll, lifeWeeks,
    makePackage, importPackage, applyImport,
    softDelete, hasTombstone, restoreTombstone, clearTombstone,
    SEED_MOMENTS,
  };
})();

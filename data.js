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
    { id: 'r-01', momentId: 'm-seed-03', at: daysAgo(30) * 1000, feeling: '今天又想起这碗面。想周末回家一趟。', feelingTag: '一种说不出的想念', source: 'user' },
    { id: 'r-02', momentId: 'm-seed-03', at: daysAgo(10) * 1000, feeling: '爸爸最近接电话慢了半拍。', feelingTag: '那时候不懂', source: 'user' },
    { id: 'r-03', momentId: 'm-seed-01', at: daysAgo(20) * 1000, feeling: '孩子现在爬滑梯都不用我看着了。', feelingTag: '一种轻轻的释然', source: 'user' },
    { id: 'r-04', momentId: 'm-seed-02', at: daysAgo(15) * 1000, feeling: '已经能跑8公里了。原来那天是真的开始。', feelingTag: '原来已经走了这么远', source: 'user' },
    { id: 'r-05', momentId: 'm-seed-07', at: daysAgo(5) * 1000, feeling: '又想给他打个电话了。', feelingTag: '远远的温暖', source: 'user' },
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
  // save 失败标志：IDB 写入失败（配额超限/损坏）时置位，UI 层据此警示用户导出备份。
  // 不在 data 层直接 toast（避免 UI 耦合 + 避免高频刷屏）；首次失败触发回调一次。
  let _saveFailed = false;
  let _onSaveError = null; // app.js 可注册回调（如 toast + 设置页警示）

  function save() {
    if (!state) return;
    try {
      idbSet(KEY, state).catch((e) => {
        _saveFailed = true;
        if (_onSaveError) _onSaveError(e);
      });
    } catch (e) {
      _saveFailed = true;
      if (_onSaveError) _onSaveError(e);
    }
  }
  function hasSaveError() { return _saveFailed; }
  function clearSaveError() { _saveFailed = false; }
  function onSaveError(fn) { _onSaveError = fn; }
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
      state = (parsed && typeof parsed === 'object') ? migrateState(parsed) : freshState();
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
      capsules: [], // 时间胶囊：封存给未来的自己（C-A 病毒引擎）
      grove: null, // 共享林子（4z）
    };
  }

  // ---------- Schema migration（交付级：跨版本升级永远保留用户数据）----------
  // Day One 级数据完整性：版本不匹配时 merge 缺字段，绝不丢弃用户记忆。
  // 新字段加到 freshState + 这里显式 migrate，确保旧数据升级后字段完整。
  function migrateState(parsed) {
    if (!parsed || typeof parsed !== 'object') return freshState();
    const fresh = freshState();
    // 顶层字段 merge：优先用户已有值，缺字段补 fresh 默认
    const merged = Object.assign({}, fresh, parsed);
    // 嵌套对象 merge（settings/account 等不能整个覆盖丢字段）
    if (parsed.settings) merged.settings = Object.assign({}, fresh.settings, parsed.settings);
    if (parsed.account) merged.account = Object.assign({}, fresh.account, parsed.account);
    // 数组字段：缺失补空数组（绝不覆盖为 undefined）
    merged.moments = Array.isArray(parsed.moments) ? parsed.moments : fresh.moments;
    merged.revisits = Array.isArray(parsed.revisits) ? parsed.revisits : fresh.revisits;
    merged.aiLog = Array.isArray(parsed.aiLog) ? parsed.aiLog : [];
    merged.achievements = (parsed.achievements && typeof parsed.achievements === 'object') ? parsed.achievements : {};
    merged.capsules = Array.isArray(parsed.capsules) ? parsed.capsules : [];
    merged.grove = (parsed.grove && typeof parsed.grove === 'object') ? parsed.grove : null;
    // moment 字段完整性：缺 when/media/important 等补默认（防后续访问 undefined 崩）
    merged.moments = merged.moments.map(m => Object.assign({
      id: 'm-' + Date.now() + '-' + Math.random().toString(36).slice(2,6),
      kind: 'grass',
      when: { precision: 'day', text: '某天', start: null },
      people: [], place: null, tags: [],
      media: null, audio: null, important: false, thread: null,
      createdAt: Date.now(), source: 'migrated', aiDraft: null, confirmed: true,
    }, m));
    merged.version = VERSION;
    return merged;
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
  // ---------- 语音捕获（Stoic/Rosebud/Day One 式 · 情感密度最高）----------
  // 回访后"按住录 5 秒"附到瞬间；未来回访 echo 卡自动播 2s 片段。
  // 守原则5：可选不强制；守原则9：不延长会话（限时录制）。
  // 存储：base64 dataURL 入 IndexedDB（与影像同位），native 走 Capacitor Audio。
  function setMomentAudio(id, dataUrl, durationMs) {
    const m = getMoment(id);
    if (!m || !dataUrl) return null;
    // 限长：录音超 30s 截断标记（防存储膨胀，与影像压缩同哲学）
    m.audio = { dataUrl, durationMs: Math.min(durationMs || 0, 30000), at: Date.now() };
    save();
    return m.audio;
  }
  function getMomentAudio(id) {
    const m = getMoment(id);
    return (m && m.audio) ? m.audio : null;
  }
  // 删除单个瞬间 —— 级联清理回访/引子/胶囊，但生成墓碑支持会话内撤销（守"数据不丢"铁律）
  // 复用 softDelete 的 localStorage 墓碑模式，独立 key（单瞬间墓碑与全清墓碑互不干扰，至多各 1 条）
  const MOMENT_TOMB_KEY = KEY + '-moment-tomb';
  function deleteMoment(id) {
    const m = getMoment(id);
    if (!m) return false;
    const myRevisits = state.revisits.filter(r => r.momentId === id);
    const myCapsules = (state.capsules || []).filter(c => c.momentId === id);
    const snapshot = JSON.parse(JSON.stringify({ moment: m, revisits: myRevisits, capsules: myCapsules }));
    try { localStorage.setItem(MOMENT_TOMB_KEY, JSON.stringify({ savedAt: Date.now(), data: snapshot })); } catch (e) {}
    // 级联清理
    state.moments = state.moments.filter(x => x.id !== id);
    state.revisits = state.revisits.filter(r => r.momentId !== id);
    if (state.capsules) state.capsules = state.capsules.filter(c => c.momentId !== id);
    save();
    return true;
  }
  // 恢复刚删除的瞬间（墓碑回灌，避免 id 冲突）
  function restoreDeletedMoment() {
    try {
      const raw = localStorage.getItem(MOMENT_TOMB_KEY);
      if (!raw) return false;
      const s = JSON.parse(raw).data;
      if (s.moment && !state.moments.find(x => x.id === s.moment.id)) state.moments.unshift(s.moment);
      if (s.revisits) s.revisits.forEach(r => { if (!state.revisits.find(x => x.id === r.id)) state.revisits.push(r); });
      if (s.capsules && state.capsules) s.capsules.forEach(c => { if (!state.capsules.find(x => x.id === c.id)) state.capsules.push(c); });
      localStorage.removeItem(MOMENT_TOMB_KEY);
      save();
      return true;
    } catch (e) { return false; }
  }
  function hasMomentTombstone() { try { return !!localStorage.getItem(MOMENT_TOMB_KEY); } catch (e) { return false; } }
  function clearMomentTombstone() { try { localStorage.removeItem(MOMENT_TOMB_KEY); } catch (e) {} }

  // 搜索瞬间 —— 全文模糊匹配 quote/people/place/tags，返回打分排序结果
  // 商品级必需（Day One 核心）：瞬间变多后用户需要"找回那个关于爸爸的"
  function searchMoments(q) {
    const query = (q || '').trim().toLowerCase();
    if (!query) return [];
    const tokens = query.split(/\s+/).filter(Boolean);
    const scored = [];
    state.moments.forEach(m => {
      let score = 0;
      const quote = (m.quote || '').toLowerCase();
      const people = (m.people || []).join(' ').toLowerCase();
      const place = (m.place || '').toLowerCase();
      const tags = (m.tags || []).join(' ').toLowerCase();
      const whenText = (m.when && m.when.text || '').toLowerCase();
      tokens.forEach(t => {
        if (quote.includes(t)) score += 3;
        if (people.includes(t)) score += 4;
        if (place.includes(t)) score += 2;
        if (tags.includes(t)) score += 2;
        if (whenText.includes(t)) score += 1;
      });
      if (score > 0) scored.push({ m, score });
    });
    return scored.sort((a, b) => b.score - a.score).map(o => o.m);
  }

  // ---------- revisits ----------
  function getRevisits(momentId) {
    return state.revisits.filter(r => r.momentId === momentId).sort((a, b) => a.at - b.at);
  }
  function getRevisitCount(momentId) {
    return state.revisits.filter(r => r.momentId === momentId).length;
  }
  function addRevisit(momentId, feeling, feelingTag) {
    const r = {
      id: 'r-' + Date.now(),
      momentId,
      at: Date.now(),
      feeling: feeling || '',
      feelingTag: feelingTag || null,
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

  // ---------- "我也是"感受标签（4p · 病毒侧锚点C）----------
  // 预设抽象感受词库：完整短语（非单字），覆盖回访常见情绪光谱
  // 不按积极/消极排序（守情绪语法原则：晴/雨/雾/长夜共存）
  const FEELING_TAGS = [
    '一种轻轻的释然',
    '安静的力量',
    '一种说不出的想念',
    '远远的温暖',
    '原来已经走了这么远',
    '那时候不懂',
    '只是安静地待了一会儿',
    '什么都没变',
    '幸好当时留住了',
    '谢谢那个自己',
    '一个很小的光',
    '还记得',
  ];

  // ---------- 开放回路（Zeigarnik · 低频留存锚点）----------
  // 原理：未完的念头制造记忆张力，驱动次日主动回来"续上"——天然同构于回访主轴。
  // 守原则5：全局同时只 1 条引子（低频）、3 天静默过期（无提醒/无羞辱）、绝不展示"X 条待续"计数。
  // 守原则9：引子只在"今天的回声"里温和浮出一次，不增加会话时长。
  const THREAD_TTL_DAYS = 3;
  function setThread(momentId, text) {
    if (!text || !text.trim()) return clearThread(momentId);
    // 低频铁律：开新引子前，静默关闭其它所有引子（全局至多 1 条）
    state.moments.forEach(m => { if (m.id !== momentId && m.thread) m.thread = null; });
    const m = getMoment(momentId);
    if (!m) return null;
    m.thread = { text: text.trim(), setAt: Date.now() };
    save();
    return m.thread;
  }
  function clearThread(momentId) {
    const m = getMoment(momentId);
    if (m && m.thread) { m.thread = null; save(); }
    return null;
  }
  // 返回"今日应续"的活跃引子：昨日或更早设置、未过期、今天还没回访过。
  // 顺带静默清扫过期引子（无任何用户可见提示）。
  function activeThread() {
    const now = Date.now();
    const today0 = new Date(); today0.setHours(0, 0, 0, 0);
    const todayMs = today0.getTime();
    let expired = false, found = null;
    for (const m of state.moments) {
      if (!m.thread) continue;
      if ((now - m.thread.setAt) / 86400000 > THREAD_TTL_DAYS) { m.thread = null; expired = true; continue; } // 静默过期
      if (m.thread.setAt >= todayMs) continue;                                   // 今天刚设，明天才浮出
      if (state.revisits.some(r => r.momentId === m.id && r.at >= todayMs)) continue; // 今天已回访，视为已续
      if (!found) found = { moment: m, thread: m.thread };
    }
    if (expired) save();
    return found;
  }

  // ---------- T2-ClaudeCode 回访候选发现 ----------
  // 与 Codex T2（今天不像昨天）的核心差异：本调度指向"过去哪个瞬间值得带回"
  function pickEcho() {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime();
    // 守"今天带回一个"的确定性：今天已选过 echo 且该瞬间仍在，直接返回同一个，不重选。
    // 例外：用户今天已回访过该 echo，则允许换一个新瞬间（回访后有新 echo 浮出，但不刷新也稳）。
    if (state.lastEchoDate === todayMs && state.lastEchoMomentId) {
      const prev = state.moments.find(m => m.id === state.lastEchoMomentId);
      const revisitedPrev = prev && state.revisits.some(r => r.momentId === prev.id && r.at >= todayMs);
      if (prev && !revisitedPrev) return prev;
      // 已回访过 prev → 落到下方重新选一个（不再 return）
    }
    // 允许今天再推一个新瞬间（回访是"带回"不是"记录"），不因今天已回访而停止推 echo。
    // 反信息茧房：综合 久未回访 + 重要 + 随机 + 情境
    const candidates = state.moments.filter(m => m.confirmed !== false);
    if (!candidates.length) return null;

    // 开放回路（Zeigarnik）：昨天的未完引子今天近乎必然被带回（低频：全局至多 1 条）
    const thread = activeThread();

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
      // 开放回路压倒一切：未完引子 +60（基线最高 ~40，引子必胜）
      if (thread && thread.moment.id === m.id) score += 60;
      return { m, score, daysSince, count: revs.length };
    });
    scored.sort((a, b) => b.score - a.score);
    const picked = scored[0].m;
    state.lastEchoMomentId = picked.id;
    state.lastEchoDate = todayMs;
    save();
    return picked;
  }

  // ---------- "这一天"多年对照（On This Day · Day One 式签名特性）----------
  // 守原则5：纯被动浮出，无通知/无 badge/无"还差几个"；同日多年若不存在则什么都不显示（无羞辱）
  // 守原则9：只在 today 屏温和浮出一次，不抢占回声主交付
  function onThisDay(limit = 3) {
    const now = new Date();
    const m = now.getMonth() + 1, d = now.getDate();
    const matches = state.moments
      .filter(x => x.when && typeof x.when.start === 'number' && x.when.start > 0)
      .map(x => {
        const wd = new Date(x.when.start * 1000);
        // 同月同日、但年份更早（排除今年，排除今日回声本身）
        if (wd.getMonth() + 1 !== m || wd.getDate() !== d) return null;
        const yrsAgo = now.getFullYear() - wd.getFullYear();
        if (yrsAgo < 1) return null;
        return { m: x, yrsAgo, whenDate: wd };
      })
      .filter(Boolean)
      .sort((a, b) => a.yrsAgo - b.yrsAgo); // 由近及远
    return matches.slice(0, limit);
  }

  // ---------- 情绪粒度网格（How We Feel / Yale Mood Meter 范式）----------
  // 2 轴：能量（低↔高）× 愉悦（不愉↔愉），4 象限 144 词。
  // 与 FEELING_TAGS 并存：FEELING_TAGS 是"回访感受的抽象分享词库"（病毒侧·零暴露面），
  // EMOTION_GRID 是"此刻情绪的精细标签"（内省侧·非分享）。两者用途不同，不替代关系。
  // 守原则5：不要求每天打、不打分、不排名；只在用户主动要细标时浮出。
  const EMOTION_GRID = {
    // 左上：高能量·不愉悦（焦虑/愤怒系）
    hl: {
      name: '高涨·紧绷', color: 'bloom',
      words: ['焦虑','紧张','愤怒','烦躁','慌乱','挫败','急躁','恼火','担忧','惧怕','惶恐','不安','亢奋','咄咄逼人','憋屈','恼怒','气恼','惊慌','警惕','受挫','忿忿','躁动','纠结','坐立不安'],
    },
    // 右上：高能量·愉悦（兴奋/投入系）
    hh: {
      name: '高昂·明亮', color: 'accent',
      words: ['兴奋','喜悦','激动','充实','投入','雀跃','热情','自豪','满足','鼓舞','兴高采烈','欢欣','振奋','被爱','幸运','骄傲','感激','被看见','有力量','期待','畅快','昂扬','热切','欢腾'],
    },
    // 左下：低能量·不愉悦（低落/疲惫系）
    ll: {
      name: '低沉·灰雾', color: 'night',
      words: ['低落','疲惫','空虚','孤独','失落','消沉','低回','灰暗','无望','怅然','倦怠','沉闷','落寞','阴郁','麻木','沮丧','压抑','泄气','难过','悲伤','无助','黯然','怅惘','心灰'],
    },
    // 右下：低能量·愉悦（平静/满足系）
    lh: {
      name: '低缓·温润', color: 'growth',
      words: ['平静','安宁','释然','舒适','松弛','满足','温柔','踏实','柔软','安心','怡然','恬淡','和煦','笃定','温润','祥和','闲适','自在','清澈','舒展','柔和','熨帖','清安','惬意'],
    },
  };

  // 思维陷阱库（Moodnotes CBT 范式 · 6 个常见认知扭曲）
  // 守原则5：可选、不推送、不要求每天；仅在用户回访后且感受落在不愉象限时温和邀请
  const THINKING_TRAPS = [
    { id: 'catastrophizing', name: '灾难化', desc: '把可能的不便想成必然的灾难', reframe: '最坏的情况真的会发生吗？它发生的概率有多大？' },
    { id: 'blackwhite', name: '非黑即白', desc: '不是全好就是全坏，没有中间地带', reframe: '这件事里，有没有既不全好也不全坏的部分？' },
    { id: 'mindreading', name: '读心术', desc: '笃定别人在想什么，但没有证据', reframe: '我有他们真的这么想的证据吗？还是我替他们下了结论？' },
    { id: 'fortune', name: '算命', desc: '断言未来一定怎样，仿佛已发生', reframe: '我凭什么知道还没发生的事？换一个同样可能的结局会是什么？' },
    { id: 'should', name: '应该陷阱', desc: '用"应该/必须"绑架自己和别人', reframe: '把"应该"换成"我希望"——事情还是那件事，但压迫感轻了。' },
    { id: 'labeling', name: '贴标签', desc: '一次行为给自己整个人下定论', reframe: '我做了一件不漂亮的事，不等于我就是一个糟糕的人。' },
  ];

  // ---------- 对话式回访 + 与过去自己对话（AI 锚点 · 回访论点差异化） ----------
  // 市场收敛于"AI 引导对话"（Day One Daily Chat / Rosebud / Life Note）。
  // TSD 差异化：对话只锚定被带回的旧记忆，不锚定今日日记——这是 TSD 独有的楔子。
  // 守原则5：AI 只问、用户答、然后结束；无 streak/无评分/无"再来一次"诱导。
  // 守原则9：3 题微对话，单次会话不延长；最后一题可"留半句给明天"（Zeigarnik 兼容）。

  // 对话式回访：固定 3 问引导（不调 LLM，纯本地脚本引导；LLM 增强可选）
  const REVISIT_DIALOGUE_PROMPTS = [
    '这一刻，你最先注意到的是什么？',
    '和那时相比，你有什么不一样了？',
    '想对那时的自己说一句话吗？（可只写半句，留到明天）',
  ];
  function getDialogue(mId) {
    const m = getMoment(mId);
    return (m && m.dialogue) ? m.dialogue : null;
  }
  function setDialogueAnswer(mId, index, text) {
    const m = getMoment(mId);
    if (!m) return null;
    if (!m.dialogue) m.dialogue = { answers: [], createdAt: Date.now() };
    if (!m.dialogue.answers) m.dialogue.answers = [];
    m.dialogue.answers[index] = (text || '').trim();
    // 第 3 题（index=2）若写了"半句"，自动成为明日引子（与 Zeigarnik 回路同构）
    if (index === 2 && m.dialogue.answers[2] && m.dialogue.answers[2].length > 0) {
      setThread(mId, m.dialogue.answers[2]);
    }
    save();
    return m.dialogue;
  }

  // 与过去自己对话：单轮问答，AI 以"写那条瞬间的自己"的视角作答。
  // 真实 LLM 调用留待后端代理（防 key 暴露，参 M1.2 暂缓说明）；
  // 本地 fallback：基于瞬间文本的"镜像式"回应模板（不伪造未在原文中出现的信息）。
  function askPastSelf(mId, question) {
    const m = getMoment(mId);
    if (!m || !question || !question.trim()) return null;
    const q = question.trim();
    // 镜像式本地回应：把用户的问题温和地"还回去"——引导用户自己回到那一刻
    // 不编造原文之外的"事实"，守诚实原则
    const quote = m.quote || '';
    const lower = q.toLowerCase();
    let mirror;
    if (/为什么|为啥|why/i.test(q)) {
      mirror = '我也不知道为什么。但当时我写下的是："' + quote + '"。你问我这个，是因为现在的你已经在重新看它了吗？';
    } else if (/后悔|遗憾|不想|遗憾/i.test(q)) {
      mirror = '我不能替你回答有没有后悔。我那时只记下了："' + quote + '"。你现在这样问，是不是已经有了一点答案？';
    } else if (/想|希望|wish|希望/i.test(q)) {
      mirror = '我那时想要的，可能就藏在这句里："' + quote + '"。现在的你，还想要同样的东西吗？';
    } else if (/怎么|如何|how/i.test(q)) {
      mirror = '具体怎么走到那一步，我自己也讲不清。我只留下这一句："' + quote + '"。你是想沿着它往回走一段吗？';
    } else {
      mirror = '我那时写的是："' + quote + '"。其余的我也说不准。你是想和我再待一会儿，还是想走了？';
    }
    const answer = {
      question: q,
      answer: mirror,
      at: Date.now(),
      mode: 'local-mirror', // 标识本地 fallback，区别于未来 LLM 增强
    };
    // 作为"重逢印记"追加（复用现有 imprints 结构，若有）
    if (!m.reunions) m.reunions = [];
    m.reunions.push(answer);
    save();
    return answer;
  }
  function getReunions(mId) {
    const m = getMoment(mId);
    return (m && m.reunions) ? m.reunions.slice() : [];
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
    { id: 'cross_year', icon: '✦', title: '重逢多年', desc: '回访了一个一年前的旧瞬间', test: s => s.revisits.some(r => { const m = s.moments.find(x => x.id === r.momentId); return m && m.createdAt && (r.at - m.createdAt) >= 365 * 864e5; }) },
    { id: 'long_absence', icon: '⌛', title: '久别重逢', desc: '把一个 90 天前的旧瞬间又带回', test: s => s.revisits.some(r => { const m = s.moments.find(x => x.id === r.momentId); return m && m.createdAt && (r.at - m.createdAt) >= 90 * 864e5; }) },
    { id: 'active_recall', icon: '✿', title: '主动想起', desc: '累计留下 10 句"现在再看"', test: s => s.revisits.filter(r => r.feeling && r.feeling.trim()).length >= 10 },
    // 人生印记（hidden：解锁前不显示条件，惊喜出现；参 Codex"雾中印记"）
    { id: 'deep_well', icon: '◉', title: '深井', desc: '有一个瞬间被反复回访 5 次以上', hidden: true, test: s => { const c = {}; s.revisits.forEach(r => c[r.momentId] = (c[r.momentId] || 0) + 1); return Object.values(c).some(n => n >= 5); } },
    { id: 'centurion', icon: '✶', title: '回访者', desc: '累计回访满 100 次', hidden: true, test: s => s.revisits.length >= 100 },
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
    return ACHIEVEMENTS.map(a => ({ id: a.id, icon: a.icon, title: a.title, desc: a.desc, hidden: !!a.hidden, unlocked: !!u[a.id], at: u[a.id] || null }));
  }

  // ---------- 时间胶囊（封存给未来的自己 · C-A 病毒引擎）----------
  function addCapsule(data) {
    if (!state.capsules) state.capsules = [];
    const c = Object.assign({ id: 'cap-' + Date.now(), quote: '', momentId: null, unlockAt: Date.now() + 365 * 864e5, createdAt: Date.now(), unlocked: false, viewed: false }, data);
    state.capsules.unshift(c); save(); return c;
  }
  function getCapsules() { return (state.capsules || []).slice(); }
  function checkCapsuleUnlocks() {
    const now = Date.now(); const newly = [];
    (state.capsules || (state.capsules = [])).forEach(c => { if (!c.unlocked && c.unlockAt <= now) { c.unlocked = true; newly.push(c); } });
    if (newly.length) save();
    return newly;
  }
  function markCapsuleViewed(id) { const c = (state.capsules || []).find(x => x.id === id); if (c && !c.viewed) { c.viewed = true; save(); } }

  // ---------- 重逢报告（C-D · 反思性统计，Wrapped 反 Feed 版）----------
  // 守 C 铁律：基数计数/描述过去时/第一人称/无排行/无百分位/无群体参照
  function reportStats() {
    const ms = state.moments.filter(m => m.confirmed !== false);
    const revs = state.revisits || [];
    const revCount = {}; revs.forEach(r => revCount[r.momentId] = (revCount[r.momentId] || 0) + 1);
    const thickestEntry = Object.entries(revCount).sort((a, b) => b[1] - a[1])[0];
    const thickest = thickestEntry ? state.moments.find(m => m.id === thickestEntry[0]) : null;
    const ppl = {}; ms.forEach(m => (m.people || []).forEach(p => p && (ppl[p] = (ppl[p] || 0) + 1)));
    const topPerson = Object.entries(ppl).sort((a, b) => b[1] - a[1])[0];
    const tags = {}; ms.forEach(m => (m.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
    const topTag = Object.entries(tags).sort((a, b) => b[1] - a[1])[0];
    const crossYear = revs.filter(r => { const m = state.moments.find(x => x.id === r.momentId); return m && m.createdAt && (r.at - m.createdAt) >= 365 * 864e5; }).length;
    const earliest = ms.filter(m => m.createdAt).sort((a, b) => a.createdAt - b.createdAt)[0];
    // 感受标签频率统计（4p · "我也是"）
    const tagFreq = {};
    revs.forEach(r => { if (r.feelingTag) tagFreq[r.feelingTag] = (tagFreq[r.feelingTag] || 0) + 1; });
    const topFeelingTag = Object.entries(tagFreq).sort((a, b) => b[1] - a[1])[0];
    return {
      momentCount: ms.length,
      revisitCount: revs.length,
      thickestCount: thickestEntry ? thickestEntry[1] : 0,
      thickestQuote: thickest ? thickest.quote : null,
      topPerson: topPerson ? topPerson[0] : null,
      topTag: topTag ? topTag[0] : null,
      crossYearRevisits: crossYear,
      earliest,
      topFeelingTag: topFeelingTag ? topFeelingTag[0] : null,
      topFeelingTagCount: topFeelingTag ? topFeelingTag[1] : 0,
      feelingTagFreq: tagFreq,
    };
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
      counts: {
        moments: data.moments.length,
        revisits: data.revisits.length,
        capsules: (data.capsules || []).length,
        achievements: Object.keys(data.achievements || {}).length,
        aiLog: data.aiLog.length,
        groveReceived: (data.grove && data.grove.received) ? data.grove.received.length : 0,
      },
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

  // ---------- Shared Grove（2 人共享记忆池 · Day One Shared Journals 式）----------
  // 哲学最险的锚点——引入社交，但无任何 feed/点赞/评论/排行榜/奖励。
  // 守原则5：每人只经回声卡节奏看对方瞬间（一天一个），不能浏览对方全历史（反 FOMO）。
  // 守原则7：1:1 二元，非公开。
  // 同步层：无后端 → 离线"信物"模式（导出瞬间为可分享数据 → 对方导入）。
  // 真正 CRDT 云同步留待 M2/生产后端。
  function getGrove() {
    if (!state.grove) state.grove = { paired: false, partnerName: null, received: [], lastEchoDate: 0, lastEchoMomentQuote: null };
    return state.grove;
  }
  function setGrovePartner(name) {
    const g = getGrove();
    g.paired = true; g.partnerName = (name || 'ta').trim();
    save(); return g;
  }
  function leaveGrove() {
    state.grove = { paired: false, partnerName: null, received: [], lastEchoDate: 0, lastEchoMomentQuote: null };
    save();
  }
  // 导出一个瞬间为"信物"（给 ta 带回去）—— 返回可分享的紧凑数据
  function exportGroveGift(momentId) {
    const m = getMoment(momentId);
    if (!m) return null;
    // 守原则7：只带原话+感受+大致时间，不带定位/人物原名（隐私最小化）
    return {
      type: 'tsd-grove-gift',
      v: 1,
      quote: m.quote,
      kind: m.kind,
      // 模糊时间（参 Codex 模糊时间一等数据）：只保留大致时段
      whenText: m.when ? m.when.text : '某天',
      // 不带 audio（体积大、隐私）；feelingTag 不在信物协议（两端均未消费，避免误导）
      media: m.media || null,
      fromAt: Date.now(),
    };
  }
  // 导入对方的"信物"到 grove
  function importGroveGift(gift) {
    if (!gift || gift.type !== 'tsd-grove-gift') return null;
    const g = getGrove();
    const item = {
      id: 'gg-' + Date.now(),
      quote: gift.quote,
      kind: gift.kind || 'grass',
      whenText: gift.whenText || '某天',
      media: gift.media || null,
      receivedAt: Date.now(),
      surfaced: false, // 是否已通过回声卡 surface 过（守节奏：一天一个）
      viewed: false,
    };
    g.received.unshift(item);
    save(); return item;
  }
  // Grove 回声：每天 surface 一个未看过的对方瞬间（守原则5：一天一个，不浏览全历史）
  function groveEcho() {
    const g = getGrove();
    if (!g.paired || !g.received.length) return null;
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime();
    // 今天已 surface 过 → 返回同一个
    if (g.lastEchoDate >= todayMs) {
      return g.received.find(r => r.id === g.lastEchoId) || null;
    }
    // 找今天没 surface 过、没 viewed 的
    const fresh = g.received.filter(r => !r.surfaced);
    const pick = fresh[0] || g.received.find(r => !r.viewed);
    if (pick) {
      pick.surfaced = true;
      g.lastEchoDate = todayMs;
      g.lastEchoId = pick.id;
      save();
    }
    return pick || null;
  }
  function markGroveViewed(itemId) {
    const g = getGrove();
    const it = g.received.find(r => r.id === itemId);
    if (it) { it.viewed = true; save(); }
  }
  function getGroveReceived() {
    const g = getGrove();
    return g.received.slice();
  }

  // ---------- Widget 状态（Finch 式 home-screen 活体存在）----------
  // 守原则5：badge/图标点只表"有/无新回声"，永不显示"漏了 X 天"/计数器/红点焦虑
  // 守原则9：widget 模式是 home-screen 入口的超精简单屏（echo 缩略 + 留半句提示），不延长会话
  // 活体演化：晨=今日回声缩略，夜=留半句给明天（Zeigarnik）提示
  function widgetState() {
    const today = new Date(); today.setHours(0,0,0,0);
    const todayMs = today.getTime();
    const revisitedToday = state.revisits.some(r => r.at >= todayMs);
    const echo = state.moments.find(m => m.id === state.lastEchoMomentId) || null;
    const thread = activeThread();
    const hr = new Date().getHours();
    // 时段态：晨(6-11) / 午(12-17) / 夜(18-23) / 深(0-5)
    const phase = hr < 6 ? 'deep' : hr < 12 ? 'morning' : hr < 18 ? 'afternoon' : 'evening';
    return {
      // badge 用：有没有新回声待看（只 0/1，绝不计数）
      hasNewEcho: !revisitedToday && !!echo,
      revisitedToday,
      echo: echo ? { id: echo.id, quote: echo.quote, kind: echo.kind, media: echo.media } : null,
      thread: thread ? { text: thread.thread.text, momentId: thread.moment.id } : null,
      phase,
      // widget 演化主文案（Spark 式，永不 loss-frame · i18n 双语）
      headline: revisitedToday
        ? t('widget.h_revisited')
        : (echo ? t('widget.h_has_echo') : t('widget.h_empty')),
      sub: thread
        ? t('widget.sub_thread')
        : (revisitedToday ? t('widget.sub_revisited') : (echo ? t('widget.sub_echo') : t('widget.sub_empty'))),
    };
  }

  // Badge API 用：返回 home-screen 图标点应显示的状态
  // 守原则5：返回 { level: 0|1, dot: false|true }，绝不返回数字计数
  function badgeState() {
    const w = widgetState();
    // 只在"今天还没回访 且 有回声"时显示一个安静的点
    return { level: w.hasNewEcho ? 1 : 0, dot: w.hasNewEcho };
  }

  return {
    reset: () => { state = freshState(); save(); },
    init,
    onSaveError, hasSaveError, clearSaveError,
    raw: () => state,
    getMoments, getMoment, addMoment, updateMoment, deleteMoment,
    setMomentAudio, getMomentAudio,
    restoreDeletedMoment, hasMomentTombstone, clearMomentTombstone,
    searchMoments,
    getRevisits, getRevisitCount, addRevisit, thickness,
    setThread, clearThread, activeThread,
    pickEcho, weekRevisits, weekRevisitStats, ninetyDayStats,
    setOnboarded, setBirthYear, setReviewContext, setNotifications,
    setPrivacyMode, setAiConsent, setSetting, setTier,
    logAiTask, revertAiTask, getAiLog,
    checkAchievements, getAchievements,
    addCapsule, getCapsules, checkCapsuleUnlocks, markCapsuleViewed,
    reportStats,
    exportData, clearAll, lifeWeeks,
    widgetState, badgeState,
    getGrove, setGrovePartner, leaveGrove, exportGroveGift, importGroveGift, groveEcho, markGroveViewed, getGroveReceived,
    makePackage, importPackage, applyImport,
    softDelete, hasTombstone, restoreTombstone, clearTombstone,
    onThisDay,
    EMOTION_GRID, THINKING_TRAPS,
    REVISIT_DIALOGUE_PROMPTS, getDialogue, setDialogueAnswer,
    askPastSelf, getReunions,
    FEELING_TAGS, SEED_MOMENTS,
  };
})();

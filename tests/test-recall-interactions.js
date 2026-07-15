const vm = require('vm'); const fs = require('fs');
function fakeIDB() {
  const s = { kv: new Map(), media: new Map() };
  function mk(r) {
    const q = { result: r, onsuccess: null, onerror: null, onupgradeneeded: null };
    setTimeout(() => { if (q.onupgradeneeded) q.onupgradeneeded({}); if (q.onsuccess) q.onsuccess({}); }, 0);
    return q;
  }
  return {
    open: (n, v) => mk({
      objectStoreNames: { contains: (k) => k in s },
      transaction: (ns, m) => ({
        objectStore: (k) => ({
          get: (kk) => { const r = {}; setTimeout(() => { r.result = s[k].get(kk); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
          put: (val, kk) => { const r = {}; setTimeout(() => { s[k].set(kk, val); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
          delete: (kk) => { const r = {}; setTimeout(() => { s[k].delete(kk); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
        }),
        oncomplete: null, onerror: null, abort: () => {},
      }),
    }),
  };
}
let src = fs.readFileSync('data.js', 'utf8');
src = src.replace(/^\s*const TSD = \(\(\) => \{/m, 'TSD = (() => {');
const sandbox = {
  TSD: undefined, navigator: {}, window: {}, self: {},
  IDBKeyRange: { bound: (a, b) => ({ lower: a, upper: b }) },
  indexedDB: fakeIDB(),
  fetch: async () => { throw new Error('no fetch'); },
  I18N: { getLocale: () => 'zh' },
  console: { log: (...a) => console.log(...a), error: () => {}, warn: () => {} },
  setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
  Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp,
  parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
  Response: class { constructor(b, o) { this._b = b; this.status = o?.status || 200; this.ok = (o?.status||200) < 400; } async json() { return JSON.parse(this._b); } },
  Promise, Symbol, URL: { createObjectURL: () => '' },
};
vm.runInNewContext(src, sandbox, { filename: 'data.js' });
const TSD = sandbox.TSD;
let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; console.log('  ✅ ' + m); } else { fail++; console.log('  ❌ ' + m); } };

(async () => {
  await TSD.init();
  const ms = TSD.getMoments();
  const m = ms[0];

  // 1. skipRecall 写 interaction 不写 revisit
  const revisitsBefore = TSD.raw().revisits.length;
  const it = TSD.skipRecall(m.id);
  assert(it.outcome === 'skipped', 'skipRecall 返回 outcome=skipped');
  assert(TSD.raw().revisits.length === revisitsBefore, 'skip 不增加 revisits（种子回访数不变）');
  assert(TSD.raw().recallInteractions.length === 1, 'skip 写一条 recallInteractions');

  // 2. pickEcho 跳过冷却中的 m（skip 后 7 天内不再被选）
  let avoided = true;
  for (let i = 0; i < 30; i++) { const e = TSD.pickEcho(); if (e && e.id === m.id) { avoided = false; break; } }
  assert(avoided, 'skip 冷却期内 pickEcho（30 次）不再推该瞬间');

  // 3. addRevisit 同步写 interaction(revisited)
  const m2 = ms[1];
  const beforeInt = TSD.raw().recallInteractions.length;
  TSD.addRevisit(m2.id, '晴', 'light');
  assert(TSD.raw().recallInteractions.length === beforeInt + 1, 'addRevisit 同步写一条 interaction');
  assert(TSD.raw().recallInteractions[TSD.raw().recallInteractions.length - 1].outcome === 'revisited', '最新 interaction outcome=revisited');

  // 4. addRevisit opts.mode 可选（source 隐藏式回忆用）
  TSD.addRevisit(ms[2].id, '雾', 'fog', { mode: 'remembered' });
  const last = TSD.raw().recallInteractions[TSD.raw().recallInteractions.length - 1];
  assert(last.mode === 'remembered', 'addRevisit opts.mode 透传=remembered');

  // 5. freshState 含字段
  assert(Array.isArray(TSD.raw().recallInteractions), 'freshState 含 recallInteractions 数组');

  // 6. addRevisit 兼容旧调用（不传 opts，mode=null）
  TSD.addRevisit(ms[3].id, '雾', 'fog');
  const last2 = TSD.raw().recallInteractions[TSD.raw().recallInteractions.length - 1];
  assert(last2.mode === null, '不传 opts 时 mode=null（向后兼容）');

  console.log('\n' + pass + ' pass, ' + fail + ' fail');
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('崩溃: ' + e.message + '\n' + e.stack); process.exit(1); });

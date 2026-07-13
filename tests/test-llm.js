const vm = require('vm');
const fs = require('fs');
const path = require('path');

const fetchCalls = [];
const results = [];
let fetchImpl = async () => { throw new Error('not set'); };

// 假 IDB：open() 立即异步 resolve（onsuccess），事务 mock 返回同步 store
function fakeIDB() {
  const stores = { kv: new Map(), media: new Map() };
  function makeReq(successResult) {
    const req = { result: successResult, error: null, onsuccess: null, onerror: null, onupgradeneeded: null };
    setTimeout(() => { if (req.onupgradeneeded) req.onupgradeneeded({}); if (req.onsuccess) req.onsuccess({}); }, 0);
    return req;
  }
  return {
    open: (name, ver) => makeReq({ objectStoreNames: { contains: (n) => n in stores }, transaction: (names, mode) => ({
      objectStore: (n) => ({
        get: (k) => { const r = {}; setTimeout(() => { r.result = stores[n].get(k); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
        put: (v, k) => { const r = {}; setTimeout(() => { stores[n].set(k, v); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
        delete: (k) => { const r = {}; setTimeout(() => { stores[n].delete(k); if (r.onsuccess) r.onsuccess(); }, 0); return r; },
      }),
      oncomplete: null, onerror: null, abort: () => {},
    }) }),
  };
}

function loadTSD(opts) {
  let src = fs.readFileSync(path.join(process.cwd(), 'data.js'), 'utf8');
  src = src.replace(/^\s*const TSD = \(\(\) => \{/m, 'TSD = (() => {');
  const idb = fakeIDB();
  const sandbox = {
    TSD: undefined,
    navigator: {}, window: {}, self: {},
    IDBKeyRange: { bound: (a, b) => ({ lower: a, upper: b }) },
    indexedDB: idb,
    fetch: (url, o) => { fetchCalls.push({ url, body: o ? JSON.parse(o.body) : null }); return fetchImpl(url, o); },
    I18N: { getLocale: () => opts.locale || 'zh' },
    console: { log: (...a) => results.push(a.join(' ')), error: (...a) => results.push('ERR: ' + a.join(' ')), warn: () => {} },
    setTimeout, clearTimeout, setInterval: () => 0, clearInterval: () => {},
    Date, Math, JSON, Object, Array, String, Number, Boolean, RegExp,
    parseInt, parseFloat, isNaN, isFinite, encodeURIComponent, decodeURIComponent,
    Response: class { constructor(b, o) { this._b = b; this.status = o?.status || 200; this.ok = (o?.status||200) < 400; } async json() { return JSON.parse(this._b); } async text() { return this._b; } },
    Promise, Symbol, URL: { createObjectURL: () => 'blob:x' },
  };
  vm.runInNewContext(src, sandbox, { filename: 'data.js' });
  return sandbox.TSD;
}

let pass = 0, fail = 0;
const assert = (c, m) => { if (c) { pass++; results.push('  ✅ ' + m); } else { fail++; results.push('  ❌ ' + m); } };

(async () => {
  const TSD = loadTSD({});
  if (!TSD) { results.push('FATAL: TSD undefined'); print(); process.exit(1); }
  await TSD.init();
  const m = TSD.getMoments()[0];
  if (!m) { results.push('FATAL: no seed moment'); print(); process.exit(1); }

  results.push('=== 0: setLlmEndpoint ===');
  assert(TSD.hasLlmEndpoint() === false, '初始无 endpoint');
  TSD.setLlmEndpoint('https://tsd-llm.x.workers.dev/');
  assert(TSD.hasLlmEndpoint() === true, '设置后 true');

  results.push('=== 1: 无 aiConsent → local-mirror ===');
  TSD.setAiConsent(false); fetchCalls.length = 0;
  const a1 = await TSD.askPastSelf(m.id, '为什么？');
  assert(a1 && a1.mode === 'local-mirror', 'mode=local-mirror');
  assert(fetchCalls.length === 0, '不调 fetch');

  results.push('=== 2: aiConsent + LLM 成功 ===');
  TSD.setAiConsent(true);
  fetchImpl = async () => new Response(JSON.stringify({ answer: '我那时只觉得累。', mode: 'llm' }), { status: 200 });
  const a2 = await TSD.askPastSelf(m.id, '为什么？');
  assert(a2 && a2.mode === 'llm', 'mode=llm');
  assert(a2.answer === '我那时只觉得累。', 'answer=LLM 返回');
  assert(fetchCalls.length === 1 && fetchCalls[0].url.endsWith('/ask'), 'fetch endpoint/ask');
  assert(fetchCalls[0].body.moment.quote === m.quote, 'payload.quote 正确');

  results.push('=== 3: LLM 502 → fallback ===');
  fetchImpl = async () => new Response('{"error":"x"}', { status: 502 });
  const a3 = await TSD.askPastSelf(m.id, '怎么？');
  assert(a3 && a3.mode === 'llm-failed-fallback', 'mode=llm-failed-fallback');

  results.push('=== 4: 网络异常 → fallback ===');
  fetchImpl = async () => { throw new Error('network'); };
  const a4 = await TSD.askPastSelf(m.id, '想？');
  assert(a4 && a4.mode === 'llm-failed-fallback', '网络异常回退');

  results.push('=== 5: 无 endpoint → local-mirror ===');
  TSD.setLlmEndpoint(null);
  const a5 = await TSD.askPastSelf(m.id, '为什么？');
  assert(a5 && a5.mode === 'local-mirror', '无 endpoint → local-mirror');

  print(); process.exit(fail ? 1 : 0);
})().catch(e => { results.push('崩溃: ' + e.message + '\n' + e.stack); print(); process.exit(1); });

function print() { results.forEach(l => console.log(l)); console.log(`\n${pass} pass, ${fail} fail`); }

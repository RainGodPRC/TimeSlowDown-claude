// 逻辑单测：WidgetBadge.syncNativeWidget 分支 + payload 契约
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const captured = { calls: [] };
const TSD = {
  widgetState: () => ({ headline: '有一个旧瞬间想再见你', sub: '点开待 10 秒',
    echo: { id: 'm1' }, revisitedToday: false, hasNewEcho: true, phase: 'morning' }),
  badgeState: () => ({ level: 1, dot: true }),
};
const I18N = { getLocale: () => 'zh' };

function loadWidgetSandbox(opts) {
  let src = fs.readFileSync(path.join(process.cwd(), 'widget.js'), 'utf8');
  // const WidgetBadge = (...) → var WidgetBadge = (...)，便于从 sandbox 拿出来
  src = src.replace('const WidgetBadge =', 'var WidgetBadge =');
  const sandbox = {
    navigator: opts.navigator || {},
    window: Object.assign({}, opts.window || {}, { Capacitor: opts.Capacitor }),
    Capacitor: opts.Capacitor,
    TSD: opts.TSD,
    I18N: opts.I18N,
    matchMedia: () => ({ matches: false }),
    console,
  };
  vm.runInNewContext(src, sandbox);
  return sandbox.WidgetBadge;
}

let pass = 0, fail = 0;
const assert = (c, m) => c ? (pass++, console.log('  ✅ ' + m)) : (fail++, console.log('  ❌ ' + m));

(async () => {
  console.log('=== 测试 1: Capacitor plugin 存在 → 写状态 ===');
  const wb = loadWidgetSandbox({
    Capacitor: { Plugins: { TSDWidget: { writeWidgetState: async (p) => { captured.calls.push(p); return { ok: true }; } } } },
    TSD, I18N,
  });
  const ok = await wb.syncNativeWidget();
  assert(ok === true, 'syncNativeWidget 返回 true');
  assert(captured.calls.length === 1, 'plugin.writeWidgetState 被调一次');
  const p = captured.calls[0] || {};
  assert(p.header === '有一个旧瞬间想再见你', 'payload.header 正确');
  assert(p.sub === '点开待 10 秒', 'payload.sub 正确');
  assert(p.dot === true, 'payload.dot = true');
  assert(p.locale === 'zh', 'payload.locale = zh');
  assert(typeof p.at === 'number' && p.at > 0, 'payload.at 是时间戳');

  console.log('=== 测试 2: 无 Capacitor → 静默降级 ===');
  const wb2 = loadWidgetSandbox({ TSD, I18N });
  const ok2 = await wb2.syncNativeWidget();
  assert(ok2 === false, '无 plugin 时返回 false');
  assert(captured.calls.length === 1, 'plugin 未被调用');

  console.log('=== 测试 3: hasNativeWidget 检测 ===');
  const wb3 = loadWidgetSandbox({ Capacitor: { Plugins: { TSDWidget: {} } }, TSD, I18N });
  assert(wb3.hasNativeWidget() === true, '有 plugin 时 hasNativeWidget=true');
  const wb4 = loadWidgetSandbox({ TSD, I18N });
  assert(wb4.hasNativeWidget() === false, '无 plugin 时 hasNativeWidget=false');

  console.log(`\n结果: ${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error('崩溃:', e); process.exit(1); });

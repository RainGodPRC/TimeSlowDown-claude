/* ============================================================
   TSD Claude Code 分支 · 应用主体
   论点：回访（retrieval practice）
   主交付：今日回访（被带回过去），非今日切片（生产新内容）
   ============================================================ */

// ---------- 全局错误捕获（参 ZCode · TestFlight 真机调试必备）----------
// 守"数据不丢/可带走"：运行时错误/未捕获 Promise rejection 落 localStorage，
// 设置页可导出，方便 TestFlight beta 用户把真机崩溃栈带回来。50 条上限、msg/stack 截断防爆。
(function() {
  const LOG_KEY = 'tsd-cc-error-log';
  const MAX_LOGS = 50;
  function logError(type, msg, url, line, col, stack) {
    try {
      const entry = { t: Date.now(), type, msg: String(msg).substring(0, 300), url: url ? String(url).substring(0, 100) : '', line, col, stack: stack ? String(stack).substring(0, 500) : '' };
      const raw = localStorage.getItem(LOG_KEY);
      const logs = raw ? JSON.parse(raw) : [];
      logs.unshift(entry);
      if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch(e) {}
  }
  window.addEventListener('error', e => logError('error', e.message, e.filename, e.lineno, e.colno, e.error && e.error.stack));
  window.addEventListener('unhandledrejection', e => logError('promise', e.reason && (e.reason.message || e.reason), '', 0, 0, e.reason && e.reason.stack));
  window.__tsdExportErrorLog = function() {
    const raw = localStorage.getItem(LOG_KEY);
    return raw ? JSON.parse(raw) : [];
  };
  window.__tsdClearErrorLog = function() { localStorage.removeItem(LOG_KEY); };
})();

const App = (() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  // ---------- 路由 ----------
  const routes = {};
  let currentView = null;
  // 路由级计时器（revisit/life-mash/voice）：离开视图前必须清理，否则后台 interval
  // 会继续引用已移除的 DOM 节点 → 内存泄漏 + 操作 null 元素竞态。
  // 提到模块作用域统一管理，render() 开头兜底 clearInterval。
  let routeTimer = null;
  function setRouteTimer(id) { clearRouteTimer(); routeTimer = id; }
  function clearRouteTimer() { if (routeTimer) { clearInterval(routeTimer); routeTimer = null; } }

  function route(path, handler) { routes[path] = handler; }

  function navigate(path, opts = {}) {
    if (opts.replace) history.replaceState({ path }, '', '#' + path);
    else history.pushState({ path }, '', '#' + path);
    render(path);
  }
  window.addEventListener('popstate', e => {
    const path = (e.state && e.state.path) || location.hash.replace('#', '') || 'today';
    render(path);
  });

  function render(path) {
    const [name, ...rest] = path.split('/');
    const params = rest;
    const handler = routes[name] || routes.today;
    const app = $('#app');
    // 离开上一个视图前清理其计时器（防 revisit/voice/mash 的 interval 泄漏 + 竞态）
    clearRouteTimer();
    app.innerHTML = '';
    currentView = name;

    // topbar
    const top = el('div', { class: 'topbar' }, [
      el('div', { class: 'topbar__title' }, [document.createTextNode('TimeSlowDown')]),
      el('div', { class: 'topbar__right' }, [
        // 无 aria-label：accessible name 来自可见文本（符号+vh 文本），避免 label-content-name-mismatch
        el('button', { class: 'btn btn--sm btn--ghost', onclick: () => navigate('search') }, ['⌕', el('span', { class: 'vh' }, [t('nav.search')])]),
        el('button', { class: 'btn btn--sm btn--ghost', onclick: () => navigate('settings') }, ['⚙︎', el('span', { class: 'vh' }, [t('nav.settings')])]),
      ]),
    ]);
    app.appendChild(top);

    // view 容器
    const view = el('div', { class: 'view' + (opts_fullView(name) ? ' view--full' : '') });
    app.appendChild(view);

    const ctx = { view, params, navigate, el, $, $$, toast, sheet };
    handler(ctx);

    // tabbar（全屏视图如重温不显示）
    if (!opts_noTabbar(name)) {
      app.appendChild(renderTabbar(name));
    }
    window.scrollTo(0, 0);
  }
  function opts_fullView(name) { return ['revisit', 'onboarding'].includes(name); }
  function opts_noTabbar(name) { return ['revisit', 'onboarding'].includes(name); }

  function renderTabbar(active) {
    const tabs = [
      { id: 'today', icon: '⚬', label: t('tab.echo') },
      { id: 'wilderness', icon: '◧', label: t('tab.wilderness') },
      { id: 'media', icon: '◈', label: t('tab.media') },
      { id: 'ai', icon: '✦', label: t('tab.ai') },
      { id: 'settings', icon: '⚙', label: t('tab.settings') },
    ];
    return el('nav', { class: 'tabbar' }, tabs.map(tab =>
      el('button', {
        class: 'tabbar__btn' + (active === tab.id ? ' is-active' : ''),
        onclick: () => { haptic('impact'); navigate(tab.id); },
      }, [
        el('span', { class: 'tabbar__icon' }, [tab.icon]),
        el('span', { class: 'tabbar__label' }, [tab.label]),
      ])
    ));
  }

  // ---------- helpers ----------
  function el(tag, attrs = {}, children = []) {
    const e = document.createElement(tag);
    for (const k in attrs) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'onclick') e.addEventListener('click', attrs[k]);
      else if (k === 'oninput') e.addEventListener('input', attrs[k]);
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k.startsWith('data-') || k.startsWith('aria-')) e.setAttribute(k, attrs[k]);
      else if (k === 'style') e.setAttribute('style', attrs[k]);
      else e[k] = attrs[k];
    }
    // a11y：非 button 元素带 onclick → 自动补 role=button + tabindex + 键盘激活（VoiceOver/键盘可达）
    if (tag !== 'button' && attrs.onclick) {
      e.setAttribute('role', 'button');
      e.setAttribute('tabindex', '0');
      e.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); attrs.onclick(ev); }
      });
    }
    // 健壮化：children 可为 string / Node / array / null
    const kids = Array.isArray(children) ? children
      : (children == null ? []
        : (typeof children === 'string' || children.nodeType ? [children] : [String(children)]));
    kids.forEach(c => {
      if (c == null) return;
      e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return e;
  }

  let toastTimer;
  function toast(msg) {
    let t = $('.toast:not(.toast--undo)');
    if (!t) { t = el('div', { class: 'toast' }); document.body.appendChild(t); }
    t.textContent = msg;
    t.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-show'), 2200);
  }

  // 底部 sheet
  function sheet(contentNode, opts = {}) {
    const backdrop = el('div', { class: 'sheet-backdrop' });
    const s = el('div', { class: 'sheet' }, [
      el('div', { class: 'sheet__handle' }),
      contentNode,
    ]);
    document.body.appendChild(backdrop);
    document.body.appendChild(s);
    requestAnimationFrame(() => { backdrop.classList.add('is-open'); s.classList.add('is-open'); });
    const close = () => {
      backdrop.classList.remove('is-open'); s.classList.remove('is-open');
      setTimeout(() => { backdrop.remove(); s.remove(); }, 300);
    };
    backdrop.addEventListener('click', close);
    s._close = close;
    return s;
  }

  function fmtWhen(when) {
    if (!when) return t('common.someday');
    return when.text || t('common.someday');
  }
  function fmtRelative(ts) {
    if (!ts) return '';
    const diff = Date.now() - ts;
    const d = Math.floor(diff / 86400000);
    if (d === 0) return t('rel.today');
    if (d === 1) return t('rel.yesterday');
    if (d < 7) return d === 1 ? t('rel.one_day_ago') : t('rel.days_ago', { d });
    if (d < 30) { const w = Math.floor(d / 7); return w === 1 ? t('rel.one_week_ago') : t('rel.weeks_ago', { w }); }
    if (d < 365) { const m = Math.floor(d / 30); return m === 1 ? t('rel.one_month_ago') : t('rel.months_ago', { m }); }
    const y = Math.floor(d / 365);
    return y === 1 ? t('rel.one_year_ago') : t('rel.years_ago', { y });
  }
  function fmtDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  }

  // ============================================================
  // 视图：onboarding
  // ============================================================
  route('onboarding', ({ view, navigate }) => {
    let step = 0;
    let userSeedId = null; // D-A1：用户自造的首个瞬间（让回访演示用自己的内容，自造正峰）
    const steps = [
      // 0: 承诺
      () => el('div', { class: 'text-center', style: 'padding-top:20vh;' }, [
        el('div', { style: 'font-size:56px;margin-bottom:24px;' }, ['⊜']),
        el('h1', { class: 'h1 serif', style: 'margin-bottom:16px;' }, [t('onb.title_1')]),
        el('h1', { class: 'h1 serif', style: 'margin-bottom:32px;' }, [t('onb.title_2')]),
        el('p', { class: 'lead muted', style: 'margin-bottom:48px;' }, [
          t('onb.intro'),
        ]),
        el('button', { class: 'btn btn--primary btn--lg btn--block', onclick: next }, [t('onb.cta_start')]),
        el('button', { class: 'btn btn--ghost btn--block mt-3', style: 'font-size:13px;color:var(--fg-mute);', onclick: finish }, [t('onb.cta_skip')]),
      ]),
      // 1: 自造第一个瞬间（D-A1：60 秒内自造正峰，让回访演示用用户自己的内容）
      () => el('div', { class: 'text-center', style: 'padding-top:10vh;' }, [
        el('h2', { class: 'h2 mb-3' }, [t('onb.seed_prompt')]),
        el('p', { class: 'muted mb-5', style: 'font-size:13px;' }, [t('onb.seed_hint')]),
        el('textarea', { id: 'onboard-seed', placeholder: t('onb.seed_example'), style: 'width:100%;min-height:90px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:15px;font-family:var(--font-serif);resize:none;' }),
        el('div', { class: 'flex gap-3 mt-4' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => next() }, [t('onb.seed_skip')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
            const seedText = ($('#onboard-seed') ? $('#onboard-seed').value : '').trim();
            if (seedText) { const mm = TSD.addMoment({ quote: seedText, kind: 'grass', people: [], when: { precision: 'day', text: t('rel.today'), start: Math.floor(Date.now() / 1000) } }); userSeedId = mm.id; haptic('success'); }
            next();
          } }, [t('onb.seed_cta_keep')]),
        ]),
      ]),
      // 2: 第一次回声体验（优先用用户自造的瞬间，否则种子）
      () => {
        const m = (userSeedId && TSD.getMoment(userSeedId)) || TSD.SEED_MOMENTS[2];
        return el('div', { class: 'text-center' }, [
          el('div', { class: 'section-title', style: 'margin-top:8vh;' }, [t('onb.section_now')]),
          echoCard(m, { navigate, ctaText: t('onb.stay_a_moment'), ctaAction: next }),
          el('p', { class: 'muted', style: 'font-size:13px;margin-top:24px;' }, [
            t('onb.echo_hint_1'),
            el('br'),
            t('onb.echo_hint_2'),
          ]),
        ]);
      },
      // 2: 才问生日
      () => el('div', { class: 'text-center', style: 'padding-top:12vh;' }, [
        el('div', { style: 'font-size:40px;margin-bottom:20px;' }, ['▦']),
        el('h2', { class: 'h2', style: 'margin-bottom:12px;' }, [t('onb.birth_title')]),
        el('p', { class: 'muted mb-6' }, [t('onb.birth_prompt')]),
        el('input', {
          type: 'number', placeholder: t('common.example_year'),
          style: 'text-align:center;font-size:24px;padding:16px;width:100%;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;margin-bottom:24px;',
          id: 'birth-input',
        }),
        el('div', { class: 'flex gap-3' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => { next(); } }, [t('onb.seed_skip')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
            const v = $('#birth-input').value;
            if (v) TSD.setBirthYear(parseInt(v));
            next();
          } }, [t('onb.next')]),
        ]),
      ]),
      // 3: 周回顾情境
      () => el('div', { style: 'padding-top:12vh;' }, [
        el('h2', { class: 'h2 mb-3' }, [t('onb.review_title')]),
        el('p', { class: 'muted mb-6' }, [t('onb.review_intro')]),
        ...[['evening', t('onb.review_evening_t'), t('onb.review_evening_sub')],
            ['weekend', t('onb.review_weekend_t'), t('onb.review_weekend_sub')],
            ['morning', t('onb.review_morning_t'), t('onb.review_morning_sub')]].map(([id, title, sub]) =>
          el('button', {
            class: 'card mb-3', style: 'width:100%;text-align:left;display:block;',
            onclick: () => { TSD.setReviewContext(id); next(); }
          }, [
            el('div', { class: 'h3' }, [title]),
            el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px;' }, [sub]),
          ])
        ),
      ]),
      // 4: 通知权限（最后才问）
      () => el('div', { class: 'text-center', style: 'padding-top:14vh;' }, [
        el('div', { style: 'font-size:40px;margin-bottom:20px;' }, ['🔔']),
        el('h2', { class: 'h2 mb-3' }, [t('onb.notify_title')]),
        el('p', { class: 'muted mb-6' }, [t('onb.notify_intro')]),
        el('div', { class: 'flex gap-3' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => { TSD.setNotifications(false); finish(); } }, [t('onb.notify_off')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
            TSD.setNotifications(true);
            // 立即请求权限 + 调度首条"今天的回声"推送（原生壳内生效，web 静默降级）
            // 留存漏斗修复：用户同意通知后即调度，不依赖当天完成回访
            if (typeof PushHook !== 'undefined' && PushHook.isNative()) {
              PushHook.scheduleTomorrowEcho().then(ok => {
                if (ok) toast(t('toast.scheduled_tomorrow'));
              });
            }
            finish();
          } }, [t('onb.notify_on')]),
        ]),
      ]),
    ];
    function next() { step++; if (step < steps.length) draw(); else finish(); }
    function finish() {
      TSD.setOnboarded(true);
      navigate('today', { replace: true });
    }
    function draw() {
      view.innerHTML = '';
      view.appendChild(steps[step]());
    }
    draw();
  });

  // ============================================================
  // 视图：today 今天的回声（主交付）
  // ============================================================
  route('today', ({ view, navigate }) => {
    if (!TSD.raw().onboarded) { navigate('onboarding', { replace: true }); return; }

    // 唤醒：一周窗口 + 当前周位置
    const stats = TSD.weekRevisitStats();
    const nd = TSD.ninetyDayStats();
    const echo = TSD.pickEcho();
    // 开放回路（Zeigarnik）：若今日回声正是昨天的未完引子，回声卡显示"继续昨天的引子"
    const dueThread = TSD.activeThread();

    view.appendChild(
      el('div', {}, [
        // 时间唤醒
        el('div', { class: 'flex items-center justify-between mb-4' }, [
          el('div', {}, [
            el('div', { class: 'section-title', style: 'margin:0;' }, [nowLabel()]),
            el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;' }, [
              t('today.week_revisited') + ' ', el('strong', { class: 'nums' }, [String(stats.distinct)]), ' ' + t('today.moments_unit'),
              ' · ', el('span', { class: 'nums' }, [String(stats.total)]), ' ' + t('today.times_unit'),
            ]),
          ]),
          el('button', { class: 'chip chip--accent', onclick: () => navigate('wilderness') }, [t('today.life_grid') + ' ▸']),
        ]),

        // Fresh-Start 仪式（周一/月初）
        ...(freshStart() ? [freshStart()] : []),

        // 今天的回声 —— 主交付
        echo ? echoCard(echo, {
          navigate,
          ctaText: t('today.bring_back'),
          ctaAction: () => navigate('revisit/' + echo.id),
          thread: (dueThread && dueThread.moment.id === echo.id) ? dueThread.thread : null,
        }) : el('div', { class: 'empty' }, [
          el('div', { class: 'empty__icon' }, ['⊘']),
          el('div', { class: 'empty__title' }, [t('today.empty_title')]),
          el('div', { class: 'empty__sub' }, [t('today.empty_sub')]),
          el('button', { class: 'btn btn--primary mt-4', onclick: () => navigate('capture') }, [t('today.empty_cta')]),
        ]),

        // 这一天 · 多年对照（On This Day · Day One 式签名特性）
        // 守原则5/9：纯被动浮出，无 badge/无通知/无"还差几个"；同日多年不存在则什么都不显示
        ...(onThisDayRail(navigate) || []),

        // 三个月对照假设 —— 本分支北极星的可视化
        el('div', { class: 'section-title' }, [t('today.cohort_title')]),
        el('div', { class: 'card' }, [
          el('div', { class: 'flex items-center justify-between mb-3' }, [
            el('div', {}, [
              el('div', { class: 'h3' }, [t('today.cohort_subtitle')]),
              el('div', { class: 'muted', style: 'font-size:12px;' }, [t('today.cohort_note')]),
            ]),
            ringPct(nd.thickCount / Math.max(nd.revisitedCount + nd.notRevisitedCount, 1), nd.thickCount),
          ]),
          el('div', { class: 'divider', style: 'margin:12px 0;' }),
          el('div', { class: 'flex gap-4' }, [
            statBlock(String(nd.revisitedCount), t('today.cohort_revisited'), 'accent'),
            statBlock(String(nd.thickCount), t('today.cohort_thick'), 'growth'),
            statBlock(String(nd.notRevisitedCount), t('today.cohort_unrevisited'), 'mute'),
          ]),
          disclosure(t('today.cohort_why'), [
            el('p', { class: 'muted', style: 'font-size:11px;line-height:1.5;' }, [t('today.cohort_why_body')]),
          ]),
        ]),

        // 重逢印记（Codex 雾中范式：惊喜，非打卡；安静模式时隐藏）
        ...(TSD.raw().settings && TSD.raw().settings.quietMode ? [] : [
          el('div', { class: 'section-title' }, [t('today.imprints_title')]),
          milestoneCard(),
        ]),

        // 本周回访过的瞬间
        el('div', { class: 'section-title' }, [t('today.week_graph')]),
        weekGraph(navigate),

        // 回访日历热力图（Stoic/Day One 式 · 近 8 周回访密度可视化）
        el('div', { class: 'section-title' }, [t('today.heatmap_title')]),
        revisitHeatmap(),

        // 今日微小行动（原则6：导向行动）
        el('div', { class: 'section-title' }, [t('today.action_title')]),
        el('div', { class: 'card card--glass' }, [
          el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px;' }, [t('today.action_sub')]),
          el('div', { class: 'serif', style: 'font-size:16px;line-height:1.5;' }, [
            echo ? todayActionHint(echo) : t('today.no_action')
          ]),
        ]),
      ])
    );
  });

  // ============================================================
  // 视图：widget 模式（home-screen 入口超精简单屏 · Finch 式活体存在）
  // 从 home-screen widget 启动（?from=widget）→ 单屏 echo 缩略 + 留半句提示
  // 守原则5/9：不延长会话；点"带回"进完整 revisit，点"关"即退回主屏
  // ============================================================
  route('widget', ({ view, navigate }) => {
    if (!TSD.raw().onboarded) { navigate('onboarding', { replace: true }); return; }
    const w = TSD.widgetState();
    view.appendChild(el('div', { class: 'widget-view' }, [
      el('div', { class: 'widget-view__label muted' }, [w.phase === 'morning' ? t('widget.morning_today') : w.phase === 'afternoon' ? t('widget.afternoon_today') : w.phase === 'evening' ? t('widget.evening_today') : t('widget.deep_today')]),
      el('div', { class: 'widget-view__headline serif' }, [w.headline]),
      el('div', { class: 'widget-view__sub muted' }, [w.sub]),
      // echo 缩略（若有）—— 仅一行原话截断，无媒体（守最小暴露面）
      w.echo ? el('div', { class: 'widget-view__echo serif' }, ['"' + truncate(w.echo.quote, 28) + '"']) : null,
      // 留半句提示（若有 Zeigarnik 引子）
      w.thread ? el('div', { class: 'widget-view__thread' }, [
        el('div', { class: 'muted', style: 'font-size:11px;' }, [t('echo.thread_hint')]),
        el('div', { class: 'serif', style: 'font-size:13px;color:var(--fg-soft);line-height:1.4;' }, ['"' + truncate(w.thread.text, 30) + '"']),
      ]) : null,
      el('div', { class: 'widget-view__actions' }, [
        w.echo && !w.revisitedToday
          ? el('button', { class: 'btn btn--primary btn--lg btn--block', onclick: () => navigate('revisit/' + w.echo.id) }, [t('today.bring_back')])
          : null,
        w.revisitedToday
          ? el('div', { class: 'muted', style: 'text-align:center;font-size:13px;' }, [t('widget.h_revisited') + '。' + t('widget.sub_revisited') + '。'])
          : null,
        el('button', { class: 'btn btn--ghost btn--sm btn--block', onclick: () => navigate('today') }, [t('widget.open_tsd')]),
      ]),
    ]));
  });

  function nowLabel() {
    const h = new Date().getHours();
    const d = new Date().getDay();
    const wd = d === 0 || d === 6 ? t('weekday.weekend') : t('weekday.weekday');
    if (h < 6) return t('phase.deep') + ' · ' + wd;
    if (h < 12) return t('phase.morning') + ' · ' + wd;
    if (h < 18) return t('phase.afternoon') + ' · ' + wd;
    return t('phase.evening') + ' · ' + wd;
  }

  // Fresh-Start 仪式（B-D / Dai 2014 temporal landmarks）：周一/月初温和重启点
  function freshStart() {
    const now = new Date();
    const dow = now.getDay(), dom = now.getDate();
    let title = null, sub = null;
    if (dow === 1) { const last = TSD.weekRevisitStats(); title = t('today.fresh_week_title'); sub = t('today.fresh_week_sub', {n: last.distinct}); }
    else if (dom === 1) { title = t('today.fresh_month_title'); sub = t('today.fresh_month_sub'); }
    if (!title) return null;
    return el('div', { class: 'card card--glass' }, [
      el('div', { class: 'flex items-center gap-3' }, [
        el('div', { style: 'font-size:24px;' }, ['✦']),
        el('div', {}, [
          el('div', { class: 'serif', style: 'font-size:16px;color:var(--fg);' }, [title]),
          el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;' }, [sub]),
        ]),
      ]),
    ]);
  }

  function todayActionHint(echo) {
    if (echo.people && echo.people.length) {
      return t('today.action_people', {name: echo.people[0]});
    }
    if (echo.tags && echo.tags.includes('身体')) return t('today.action_body_tag');
    if (echo.tags && echo.tags.includes('日常')) return t('today.action_daily_tag');
    return t('today.action_default');
  }

  // 这一天 · 多年对照（On This Day · Day One 式签名特性）
  // 纯被动：同日多年若存在则温和浮出 1-3 张缩略卡，无则返回 null（什么也不显示，无羞辱）
  function onThisDayRail(navigate) {
    const matches = TSD.onThisDay(3);
    if (!matches || !matches.length) return null;
    return [
      el('div', { class: 'section-title' }, [t('today.on_this_day_title')]),
      el('div', { class: 'card' }, matches.map(({ m, yrsAgo }) =>
        el('div', { class: 'list-row', onclick: () => navigate('moment/' + m.id) }, [
          el('div', { class: 'list-row__icon', style: thicknessColor(m.id) }, [TSD.thickness(m.id) === 'thick' ? '◈' : '○']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title serif', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, ['"' + truncate(m.quote, 24) + '"']),
            el('div', { class: 'list-row__sub' }, [
              t('common.years_ago_today', {n: yrsAgo}),
              (m.people && m.people.length) ? ' · ' + m.people.join('、') : '',
            ]),
          ]),
          el('div', { class: 'list-row__right' }, ['▸']),
        ])
      )),
    ];
  }

  // 回声卡 —— 被带回的过去（opts.thread 存在时 = Zeigarnik 开放回路的"续昨天的引子"）
  function echoCard(m, opts = {}) {
    const revCount = TSD.getRevisitCount(m.id);
    const revs = TSD.getRevisits(m.id);
    const lastFeelingTag = revs.length ? revs[revs.length - 1].feelingTag : null;
    return el('div', { class: 'echo-card' }, [
      el('div', { class: 'echo-card__label' }, [opts.thread ? t('echo.label_thread') : t('echo.label_echo')]),
      opts.thread ? el('div', { class: 'echo-card__thread' }, [
        el('div', { class: 'muted', style: 'font-size:11px;margin-bottom:4px;' }, [t('echo.thread_hint')]),
        el('div', { class: 'serif', style: 'font-size:14px;line-height:1.55;color:var(--fg);' }, ['"' + opts.thread.text + '"']),
      ]) : null,
      el('div', { class: 'echo-card__quote serif' }, ['"' + m.quote + '"']),
      el('div', { class: 'echo-card__when' }, [
        fmtWhen(m.when),
        revCount > 0 ? ' · ' + t('echo.revisited_count', { n: revCount }) : ' · ' + t('today.first_brought_back'),
      ]),
      lastFeelingTag ? el('div', { class: 'echo-card__mood' }, [lastFeelingTag]) : null,
      opts.media !== false && m.media ? el('img', { src: m.media, style: 'max-width:60%;border-radius:14px;margin:0 auto 20px;position:relative;' }) : null,
      // 语音回声（Stoic/Rosebud 式 · 情感密度最高）：有录音时 echo 卡显示"听这一刻的声音"
      // 守原则9：不自动播（不打扰），用户点才播；2s 片段守不延长会话
      m.audio ? el('div', { style: 'text-align:center;margin:0 auto 20px;' }, [
        el('button', {
          class: 'btn btn--ghost btn--sm',
          'aria-label': t('echo.listen_voice'),
          onclick: (e) => {
            // 复用浏览器原生 audio，避免引入复杂播放器
            const a = document.createElement('audio');
            a.src = m.audio.dataUrl;
            a.currentTime = Math.max(0, (m.audio.durationMs - 2000) / 1000); // 末尾 2s
            a.play().catch(() => {});
            e.target.textContent = t('echo.listening');
            a.addEventListener('ended', () => { e.target.textContent = t('echo.relisten'); });
            a.addEventListener('pause', () => { e.target.textContent = t('echo.relisten'); });
          },
        }, [t('echo.listen_voice')]),
      ]) : null,
      el('div', { class: 'echo-card__actions' }, [
        el('button', { class: 'btn btn--primary btn--lg btn--block', onclick: opts.ctaAction }, [opts.ctaText || t('today.bring_back')]),
        el('button', { class: 'btn btn--ghost btn--sm', onclick: () => opts.navigate('moment/' + m.id) }, [t('today.view_full')]),
      ]),
    ]);
  }

  function statBlock(num, label, color) {
    const colorVar = { accent: 'var(--accent)', growth: 'var(--growth)', mute: 'var(--fg-mute)' }[color] || 'var(--fg)';
    return el('div', { style: 'flex:1;text-align:center;' }, [
      el('div', { class: 'nums', style: 'font-size:24px;font-weight:700;color:' + colorVar + ';' }, [num]),
      el('div', { class: 'muted', style: 'font-size:11px;margin-top:2px;' }, [label]),
    ]);
  }

  function ringPct(pct, label) {
    const r = 26, c = 2 * Math.PI * r;
    const off = c * (1 - Math.min(pct, 1));
    return el('div', { class: 'ring' }, [
      el('svg', { class: 'ring__svg', width: 64, height: 64, viewBox: '0 0 64 64' }, [
        el('circle', { class: 'ring__track', cx: 32, cy: 32, r: r, fill: 'none', 'stroke-width': 4 }),
        el('circle', { class: 'ring__fill', cx: 32, cy: 32, r: r, fill: 'none', 'stroke-width': 4,
          'stroke-dasharray': c, 'stroke-dashoffset': off }),
      ]),
      el('div', { class: 'ring__label nums' }, [String(label)]),
    ]);
  }

  function weekGraph(navigate) {
    const wr = TSD.weekRevisits();
    if (!wr.length) {
      return el('div', { class: 'card muted text-center', style: 'font-size:13px;' }, [t('today.week_empty')]);
    }
    const byMoment = {};
    wr.forEach(r => { (byMoment[r.momentId] = byMoment[r.momentId] || []).push(r); });
    const items = Object.entries(byMoment).sort((a, b) => b[1].length - a[1].length);
    return el('div', { class: 'card' }, items.map(([mid, revs]) => {
      const m = TSD.getMoment(mid);
      if (!m) return null;
      return el('div', { class: 'list-row', onclick: () => navigate('moment/' + mid) }, [
        el('div', { class: 'list-row__icon', style: thicknessColor(m.id) }, [revs.length >= 2 ? '◈' : '○']),
        el('div', { class: 'list-row__main' }, [
          el('div', { class: 'list-row__title serif', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, ['"' + truncate(m.quote, 22) + '"']),
          el('div', { class: 'list-row__sub' }, [t('today.week_graph_sub', {n: revs.length, when: fmtRelative(revs[revs.length - 1].at)})]),
        ]),
        el('div', { class: 'list-row__right' }, [revs.length >= 2 ? el('span', { class: 'thickness-badge' }, ['×' + revs.length]) : '×1']),
      ]);
    }));
  }
  function thicknessColor(mid) {
    const t = TSD.thickness(mid);
    return t === 'thick' ? 'background:var(--accent-glow);color:var(--accent);'
      : t === 'bloom' ? 'background:rgba(212,135,158,0.14);color:var(--bloom);'
      : '';
  }
  function truncate(s, n) { return s.length > n ? s.slice(0, n) + '…' : s; }

  // 重逢印记墙（Codex"雾中印记"范式：惊喜出现，不展示 %/锁定清单，永久雾中未知位）
  function milestoneCard() {
    const unlocked = TSD.getAchievements().filter(a => a.unlocked);
    return el('div', { class: 'card', onclick: () => navigate('imprints') }, [
      el('div', { style: 'display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;' }, [
        ...unlocked.map(a => imprintTile(a, false)),
        el('div', { style: 'display:flex;flex-direction:column;align-items:center;width:52px;' }, [
          el('div', { style: 'font-size:22px;color:var(--fg-faint);' }, ['?']),
          el('div', { style: 'font-size:11px;text-align:center;margin-top:4px;line-height:1.2;color:var(--fg-faint);' }, [t('today.imprints_fog')]),
        ]),
      ]),
      el('span', { class: 'vh' }, [t('today.milestone_wall_vh')]),
      el('div', { class: 'muted', style: 'font-size:11px;margin-top:14px;text-align:center;' }, [t('today.imprints_hint')]),
    ]);
  }
  function imprintTile(a, big) {
    return el('div', { style: 'display:flex;flex-direction:column;align-items:center;width:' + (big ? '64' : '52') + 'px;', title: a.title + ' · ' + a.desc }, [
      el('div', { style: 'font-size:' + (big ? '28' : '22') + 'px;color:var(--accent);' }, [a.icon]),
      el('div', { class: 'muted', style: 'font-size:' + (big ? '10' : '9') + 'px;text-align:center;margin-top:' + (big ? '6' : '4') + 'px;line-height:1.2;' }, [a.title]),
    ]);
  }

  // ============================================================
  // 视图：revisit/:id 回访重温（限时、原声、可追加层叠）
  // ============================================================
  route('revisit', ({ view, navigate, params }) => {
    const id = params[0];
    const m = TSD.getMoment(id);
    if (!m) { navigate('today', { replace: true }); return; }

    const revs = TSD.getRevisits(id);
    let secondsLeft = 10;
    let finished = false;

    view.appendChild(el('div', {}, [
      el('div', { class: 'section-title' }, [t('revisit.title')]),
      el('p', { class: 'muted', style: 'font-size:12px;margin-bottom:16px;' }, [
        t('revisit.intro'),
      ]),

      // 瞬间本体（原话 + 媒体）
      el('div', { class: 'moment-card moment-card--thick' }, [
        m.media ? el('div', { class: 'moment-card__media' }, [el('img', { src: m.media })]) : null,
        el('div', { class: 'moment-card__body' }, [
          el('div', { class: 'moment-card__quote serif' }, ['"' + m.quote + '"']),
          el('div', { class: 'moment-card__meta' }, [
            el('span', {}, [fmtWhen(m.when)]),
            el('span', {}, [m.people && m.people.length ? m.people.join('、') : t('revisit.alone')]),
          ]),
          // 已有层叠
          revs.length ? el('div', { class: 'moment-card__layers' }, revs.map(r =>
            el('div', { class: 'moment-card__layer' }, [
              el('div', { class: 'moment-card__layer-time' }, [fmtDate(r.at) + ' · ' + t('revisit.layer_label') + (r.feelingTag ? ' · ' + r.feelingTag : '')]),
              el('div', {}, [r.feeling || t('revisit.only_stayed')]),
            ])
          )) : null,
        ]),
      ]),

      // 计时环
      el('div', { class: 'text-center mt-5', id: 'timer-wrap' }, [
        ringPct(0, t('revisit.timer_default')),
        el('div', { class: 'muted', style: 'font-size:12px;margin-top:8px;' }, [t('revisit.timer_hint')]),
        // 守硬上限但尊重峰终：10 秒到点后出现"再停留 10 秒"（最多 1 次加时，防沉迷）
        el('button', { class: 'btn btn--ghost btn--sm mt-3', id: 'extend-btn', style: 'display:none;', onclick: () => extendOnce() }, [t('revisit.extend_btn')]),
      ]),

      // 追加感受（10秒后激活）
      el('div', { class: 'mt-5', id: 'feeling-wrap' }, [
        el('textarea', {
          id: 'feeling-input',
          placeholder: t('revisit.feeling_placeholder_full'),
          style: 'width:100%;min-height:80px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:15px;resize:none;',
          disabled: true,
        }),
        // 开放回路（Zeigarnik）：可选"留半句给明天"——低频、可忽略；勾选后这句未完感受成为明日引子
        el('label', { style: 'display:flex;align-items:flex-start;gap:8px;margin-top:12px;font-size:13px;color:var(--fg-mute);cursor:pointer;line-height:1.4;' }, [
          el('input', { type: 'checkbox', id: 'thread-check', disabled: true, style: 'margin-top:2px;accent-color:var(--accent);width:16px;height:16px;flex:none;' }),
          el('span', {}, [t('revisit.thread_check')]),
        ]),
        // 语音捕获（Stoic/Rosebud 式 · 情感密度最高）：10s 后浮出，可选录 5s
        el('div', { id: 'voice-wrap', style: 'display:none;margin-top:12px;' }, [
          el('button', { class: 'btn btn--ghost btn--sm btn--block', id: 'voice-btn', onclick: () => openVoiceCaptureSheet(id) }, [t('revisit.voice_btn')]),
        ]),
        el('div', { class: 'flex gap-3 mt-3' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => navigate('today') }, [t('revisit.stay_here')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', id: 'save-feeling', disabled: true }, [t('revisit.keep_layer')]),
        ]),
      ]),
    ]));

    // 计时
    const ringFill = $('.ring__fill', view);
    const ringLabel = $('.ring__label', view);
    const c = 2 * Math.PI * 26;
    let extended = false;
    function extendOnce() {
      if (extended || !finished) return;
      extended = true;
      finished = false;
      secondsLeft = 10;
      const eb = $('#extend-btn', view);
      if (eb) eb.style.display = 'none';
      // 禁用感受输入，回到"只沉浸"态
      $('#feeling-input', view).disabled = true;
      $('#save-feeling', view).disabled = true;
      $('#thread-check', view).disabled = true;
      if (ringLabel) ringLabel.textContent = '10';
      setRouteTimer(setInterval(() => {
        secondsLeft--;
        const elapsed = 10 - secondsLeft;
        if (ringFill) {
          ringFill.setAttribute('stroke-dashoffset', String(c * (1 - elapsed / 10)));
          ringLabel.textContent = String(Math.max(secondsLeft, 0));
        }
        if (secondsLeft <= 0 && !finished) {
          finished = true;
          clearRouteTimer();
          $('#feeling-input', view).disabled = false;
          $('#save-feeling', view).disabled = false;
          $('#thread-check', view).disabled = false;
          ringLabel.textContent = '✓';
          const vw2 = $('#voice-wrap', view);
          if (vw2) vw2.style.display = '';
        }
      }, 1000));
      haptic('impact');
    }
    setRouteTimer(setInterval(() => {
      secondsLeft--;
      const elapsed = 10 - secondsLeft;
      if (ringFill) {
        ringFill.setAttribute('stroke-dashoffset', String(c * (1 - elapsed / 10)));
        ringLabel.textContent = String(Math.max(secondsLeft, 0));
      }
      if (secondsLeft <= 0 && !finished) {
        finished = true;
        clearRouteTimer();
        $('#feeling-input', view).disabled = false;
        $('#save-feeling', view).disabled = false;
        $('#thread-check', view).disabled = false;
        ringLabel.textContent = '✓';
        // 显示"再停留"按钮（最多加时 1 次）
        const eb = $('#extend-btn', view);
        if (eb && !extended) eb.style.display = '';
        // 显示语音捕获入口（Stoic/Rosebud 式 · 情感密度最高）
        const vw = $('#voice-wrap', view);
        if (vw) vw.style.display = '';
        toast(t('toast.can_add'));
      }
    }, 1000));

    $('#save-feeling', view).addEventListener('click', () => {
      const v = $('#feeling-input', view).value.trim();
      // 开放回路（Zeigarnik）：勾选"明天再续"且写了字 → 这句未完感受成为明日引子；否则视为续完，关闭回路
      const keepOpen = $('#thread-check', view).checked && v;
      if (keepOpen) TSD.setThread(id, v); else TSD.clearThread(id);
      // 记录 AI 任务日志（T1 忠实整理：只排列不改写）
      TSD.logAiTask({
        type: 'T1',
        payload: { momentId: id, action: 'append_layer', feeling: v || t('revisit.feeling_empty') },
        result: t('revisit.t1_result'),
        localOnly: true,
      });
      clearRouteTimer();
      // 对话式回访（Day One Daily Chat 范式 · TSD 差异化：只锚定旧记忆）：
      // 有感受时先邀请"和这一刻说三句"，再进标签微仪式；无感受直接 peakEnd。
      // 守原则5：可选、单次、不诱导续杯。
      if (v) {
        openRevisitDialogueSheet(id, navigate);
      } else {
        TSD.addRevisit(id, v);
        const neu = TSD.checkAchievements();
        const qm = TSD.raw().settings && TSD.raw().settings.quietMode;
        haptic(neu.length && !qm ? 'success' : 'impact');
        peakEndRitual(t('revisit.ritual_keep'), neu.length && !qm ? t('revisit.ritual_sub_imprint') : t('revisit.ritual_sub_thick'), () => navigate('today'));
      }
    });
  });

  // ============================================================
  // 视图：moment/:id 瞬间详情
  // ============================================================
  route('moment', ({ view, navigate, params }) => {
    const id = params[0];
    const m = TSD.getMoment(id);
    if (!m) { navigate('today', { replace: true }); return; }
    const revs = TSD.getRevisits(id);

    view.appendChild(el('div', {}, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [
        el('button', { class: 'btn btn--sm btn--ghost', onclick: () => history.back() }, [t('moment.back')]),
        el('span', { class: 'chip ' + kindChipClass(m.kind) }, [kindLabel(m.kind)]),
      ]),
      el('div', { class: 'moment-card moment-card--thick' }, [
        m.media ? el('div', { class: 'moment-card__media' }, [el('img', { src: m.media })]) : null,
        el('div', { class: 'moment-card__body' }, [
          el('div', { class: 'moment-card__quote serif' }, ['"' + m.quote + '"']),
          el('div', { class: 'moment-card__meta' }, [
            el('span', {}, [fmtWhen(m.when)]),
            el('span', {}, [m.place || '']),
          ]),
          el('div', { class: 'flex gap-2 mt-3' }, (m.tags || []).map(t => el('span', { class: 'chip' }, [t]))),
          el('div', { class: 'divider' }),
          el('div', { class: 'muted', style: 'font-size:12px;' }, [
            t('moment.source_label') + (m.source === 'seed' ? t('moment.source_seed') : t('moment.source_user')) + t('moment.created_at', {when: fmtRelative(m.createdAt)}),
          ]),
        ]),
      ]),

      el('div', { class: 'section-title' }, [t('moment.layers_title', {n: revs.length})]),

      // 与过去自己的对话记录（Life Note 式 · 单轮问答留痕作为"重逢印记"）
      // 守原则5：只展示已发生的，不诱导"再来一次"；无计数/无排名
      (() => {
        const reunions = TSD.getReunions(id);
        if (!reunions.length) return null;
        return el('div', {}, [
          el('div', { class: 'section-title' }, [t('moment.with_then_self')]),
          el('div', { class: 'card' }, reunions.map(r =>
            el('div', { class: 'moment-card__layer' }, [
              el('div', { class: 'moment-card__layer-time' }, [fmtDate(r.at) + ' · ' + t('moment.ask_label')]),
              el('div', { class: 'serif', style: 'font-size:14px;color:var(--fg-soft);margin-bottom:6px;' }, ['"' + r.question + '"']),
              el('div', { class: 'serif', style: 'font-size:14px;line-height:1.55;color:var(--fg);' }, ['"' + r.answer + '"']),
            ])
          )),
        ]);
      })(),

      // 思维陷阱 reframe 注解（Moodnotes CBT · 已记下的认知重构）
      (() => {
        const notes = (m.reframeNotes && m.reframeNotes.length) ? m.reframeNotes : null;
        if (!notes) return null;
        return el('div', {}, [
          el('div', { class: 'section-title' }, [t('moment.traps_title')]),
          el('div', { class: 'card' }, notes.map(n =>
            el('div', { class: 'moment-card__layer' }, [
              el('div', { class: 'moment-card__layer-time' }, [fmtDate(n.at) + ' · ' + n.name]),
              el('div', { class: 'serif', style: 'font-size:13px;line-height:1.55;color:var(--fg-soft);' }, [t('moment.reframe_prefix') + n.reframe]),
            ])
          )),
        ]);
      })(),

      revs.length ? el('div', { class: 'card' }, revs.map((r, i) =>
        el('div', { class: i > 0 ? 'moment-card__layer mt-3' : 'moment-card__layer' }, [
          el('div', { class: 'moment-card__layer-time' }, [t('moment.nth_visit', {n: (i + 1)}) + ' · ' + fmtDate(r.at)]),
          el('div', {}, [
            r.feeling || t('moment.only_stayed_short'),
            r.feelingTag ? el('span', { class: 'chip', style: 'margin-left:6px;font-size:10px;padding:1px 7px;' }, [r.feelingTag]) : null,
          ]),
        ])
      )) : el('div', { class: 'card muted text-center', style: 'font-size:13px;' }, [t('moment.not_revisited')]),

      // 感受天气（该瞬间的情绪分布）
      (() => {
        const tagFreq = {};
        revs.forEach(r => { if (r.feelingTag) tagFreq[r.feelingTag] = (tagFreq[r.feelingTag] || 0) + 1; });
        return Object.keys(tagFreq).length >= 2
          ? el('div', { class: 'card mt-3' }, [
              el('div', { class: 'echo-card__label', style: 'margin-bottom:8px;' }, [t('moment.feeling_weather')]),
              feelingWeatherChart(tagFreq),
            ])
          : null;
      })(),

      el('button', { class: 'btn btn--primary btn--lg btn--block mt-5', onclick: () => navigate('revisit/' + id) }, [t('moment.revisit_again')]),
      // 与过去自己对话（Life Note 式签名特性 · 仅 30 天前的旧瞬间出现）
      // 守原则5：单轮问答即关，无持续聊天/无诱导；本地镜像 fallback，不伪造原文之外的事实
      momentAgeDays(m) >= 30 ? el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => openAskPastSelfSheet(m) }, [t('moment.ask_past_self')]) : null,
      el('input', { type: 'file', accept: 'image/*', id: 'moment-photo', style: 'display:none;' }),
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => $('#moment-photo', view).click() }, [m.media ? t('moment.change_media') : t('moment.add_media')]),
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => openSealSheet(m) }, [t('moment.seal_future')]),
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => openTellOneSheet(m) }, [t('moment.tell_one')]),
      // Shared Grove：把这个瞬间作为"信物"送给 Grove 里的人（Day One Shared Journals 式）
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => openGroveGiftSheet(m) }, [t('moment.grove_gift')]),
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => openShareSheet(m, revs, navigate) }, [t('moment.share')]),
      el('div', { class: 'divider' }),
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => openEditMomentSheet(m, navigate) }, [t('moment.edit')]),
      el('button', { class: 'btn btn--ghost btn--block mt-3', style: 'color:var(--danger);', onclick: () => openDeleteMomentSheet(m, navigate) }, [t('moment.delete_this')]),
    ]));
    $('#moment-photo', view).addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      toast(t('toast.processing_image'));
      try {
        const { dataUrl } = await fileToCompressedDataUrl(f);
        TSD.updateMoment(id, { media: dataUrl });
        toast(m.media ? t('moment.media_updated') : t('moment.media_added'));
        navigate('moment/' + id);
      } catch (err) { toast(err.message || t('moment.media_failed')); }
    });
  });

  function kindLabel(k) { return { bloom: t('kind.bloom'), grass: t('kind.grass'), night: t('kind.night') }[k] || t('kind.moment'); }
  function kindChipClass(k) { return { bloom: 'chip--bloom', grass: 'chip--growth', night: 'chip--night' }[k] || ''; }
  // 瞬间年龄（天）——用于"问那时的自己"30 天门槛
  function momentAgeDays(m) {
    if (!m || !m.when || typeof m.when.start !== 'number' || m.when.start <= 0) {
      // 退化到创建时间
      return m ? (Date.now() - m.createdAt) / 86400000 : 0;
    }
    return (Date.now() / 1000 - m.when.start) / 86400;
  }

  // ============================================================
  // 视图：wilderness 人生旷野
  // ============================================================
  route('wilderness', ({ view, navigate }) => {
    const life = TSD.lifeWeeks();
    const moments = TSD.getMoments();

    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-2' }, [t('wilderness.title')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;' }, [
        t('wilderness.grid_intro'),
        el('span', { style: 'color:var(--accent);' }, ' ◈ '),
        t('wilderness.legend_thick'),
        el('span', { style: 'color:var(--bloom);' }, ' ● '),
        t('wilderness.legend_bloom'),
        el('span', { style: 'color:var(--growth);' }, ' ▦ '),
        t('wilderness.legend_grass'),
      ]),

      life ? (() => {
        const total = life.total;
        const lived = life.lived;
        const grid = el('div', { class: 'wilderness' }, [
          el('div', { class: 'wilderness-grid', id: 'wild-grid' }),
          el('div', { class: 'flex justify-between mt-4' }, [
            el('div', { class: 'muted', style: 'font-size:11px;' }, [
              t('wilderness.walked_weeks'),
              el('strong', { class: 'nums', style: 'color:var(--accent);' }, [String(lived)]),
              t('wilderness.weeks_unit'),
              el('span', { class: 'nums' }, [String(Math.max(total - lived, 0))]),
              t('wilderness.weeks_suffix'),
            ]),
            el('div', { class: 'muted', style: 'font-size:11px;' }, [t('wilderness.no_exact_lifespan')]),
          ]),
        ]);
        // 渲染格子（采样到 ~13x40=520 格）
        setTimeout(() => {
          const g = $('#wild-grid');
          if (!g) return;
          const N = 13 * 40;             // 520 视觉格
          const total = life.total;       // 4680 周（90 年）
          const lived = life.lived;
          const weekMs = 7 * 86400000;
          const birthMs = Date.now() - lived * weekMs; // 反推出生时刻
          // 预映射瞬间到"生命周"（出生=0，现在=lived，终=total）
          const mw = moments
            .filter(m => m.when && m.when.start)
            .map(m => ({ m, wk: Math.round((m.when.start * 1000 - birthMs) / weekMs) }))
            .filter(o => o.wk >= 0 && o.wk <= total);
          const span = Math.max(1, Math.ceil(total / N)); // 每格 ≈9 周
          const det = w => { const v = Math.sin(w * 12.9898) * 43758.5453; return v - Math.floor(v); }; // 确定性伪随机
          for (let i = 0; i < N; i++) {
            const wk = Math.round(i / N * total); // 格 → 生命周（比例，余生可见）
            const attrs = { class: 'wilderness-cell' };
            if (wk > lived + 1) {
              attrs.class += ' wilderness-cell--future';
            } else if (wk >= lived - 1) {
              attrs.class += ' wilderness-cell--today';
            } else {
              const nearby = mw.filter(o => Math.abs(o.wk - wk) < span)
                .sort((a, b) => TSD.getRevisitCount(b.m.id) - TSD.getRevisitCount(a.m.id));
              if (nearby.length) {
                // 有瞬间的格子：可点击 → 跳这周的记录（el 的 onclick 自动补 role/tabindex/键盘）
                const near = nearby[0];
                const t = TSD.thickness(near.m.id);
                attrs.class += ' wilderness-cell--' + (t === 'thick' ? 'thick' : t === 'bloom' ? 'bloom' : 'grass') + ' wilderness-cell--tap';
                attrs.onclick = () => navigate('moment/' + near.m.id);
                attrs['aria-label'] = t('aria.week_cell', {txt: ((near.m.when && near.m.when.text) || t('common.someday'))});
              } else {
                // 确定性草地 + 近因渐变：近期密/亮，远古稀/淡（记忆隐喻）
                const recency = lived > 0 ? wk / lived : 0;
                const density = 0.30 + recency * 0.35;
                if (det(wk) < density) {
                  attrs.class += ' wilderness-cell--grass';
                  attrs.style = 'opacity:' + (0.35 + recency * 0.55).toFixed(2) + ';';
                }
              }
            }
            g.appendChild(el('div', attrs));
          }
        }, 0);
        return grid;
      })() : el('div', { class: 'card text-center muted' }, [
        t('wilderness.no_birth_year'),
        el('button', { class: 'btn btn--sm btn--ghost mt-3', onclick: () => navigate('settings') }, [t('wilderness.go_settings')]),
      ]),

      el('div', { class: 'section-title' }, [t('wilderness.three_lenses')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'list-row', onclick: () => navigate('media') }, [
          el('div', { class: 'list-row__icon' }, ['⏱']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [t('wilderness.time_lens')]),
            el('div', { class: 'list-row__sub' }, [t('wilderness.time_lens_sub')]),
          ]),
          el('div', { class: 'list-row__right' }, ['▸']),
        ]),
        el('div', { class: 'list-row', onclick: () => navigate('media') }, [
          el('div', { class: 'list-row__icon' }, ['☻']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [t('wilderness.people_lens')]),
            el('div', { class: 'list-row__sub' }, [t('wilderness.people_lens_sub')]),
          ]),
          el('div', { class: 'list-row__right' }, ['▸']),
        ]),
        el('div', { class: 'list-row', onclick: () => navigate('media') }, [
          el('div', { class: 'list-row__icon' }, ['◎']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [t('wilderness.theme_lens')]),
            el('div', { class: 'list-row__sub' }, [t('wilderness.theme_lens_sub')]),
          ]),
          el('div', { class: 'list-row__right' }, ['▸']),
        ]),
      ]),

      disclosure(t('wilderness.full_emotion_disclosure'), [
        el('p', { class: 'muted', style: 'font-size:13px;line-height:1.6;' }, [t('wilderness.weather_philosophy')]),
      ]),
    ]));
  });

  // ============================================================
  // 视图：media 影像回访入口
  // ============================================================
  route('media', ({ view, navigate }) => {
    const moments = TSD.getMoments().filter(m => m.media);
    const all = TSD.getMoments();

    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-2' }, [t('media.revisit-entry')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;' }, [
        t('media.not_today_attachment'),
        el('strong', { style: 'color:var(--accent);' }, [t('today.brought-back-body')]),
        t('media.revisit_material'),
      ]),

      // 媒体墙
      moments.length ? el('div', { class: 'card' }, [
        el('div', { class: 'section-title', style: 'margin-top:0;' }, [t('media.memory-wall')]),
        el('div', { style: 'display:grid;grid-template-columns:repeat(3,1fr);gap:8px;' },
          moments.map(m => {
            const c = TSD.getRevisitCount(m.id);
            return el('div', {
              style: 'position:relative;aspect-ratio:1;border-radius:10px;overflow:hidden;cursor:pointer;' + (c >= 2 ? 'box-shadow:0 0 0 2px var(--accent);' : ''),
              onclick: () => navigate('revisit/' + m.id),
            }, [
              el('img', { src: m.media, style: 'width:100%;height:100%;object-fit:cover;' }),
              c > 0 ? el('div', { class: 'thickness-badge', style: 'position:absolute;top:4px;right:6px;background:rgba(0,0,0,0.6);padding:2px 6px;border-radius:8px;color:#fff;' }, ['×' + (c + 1)]) : null,
            ]);
          })
        ),
      ]) : el('div', { class: 'card text-center muted' }, [
        el('div', { style: 'font-size:32px;margin-bottom:8px;' }, ['◈']),
        t('media.no_media_moments'),
        el('br'),
        el('span', { style: 'font-size:12px;' }, [t('media.prod-photo-import')]),
      ]),

      el('div', { class: 'section-title' }, [t('settings.production-boundary-media')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'list-row' }, [el('div', { class: 'list-row__icon' }, ['◭']), el('div', { class: 'list-row__main' }, [el('div', { class: 'list-row__title' }, [t('capsule.local-first')]), el('div', { class: 'list-row__sub' }, [t('media.local-first-detail')])])]),
        el('div', { class: 'list-row' }, [el('div', { class: 'list-row__icon' }, ['⊘']), el('div', { class: 'list-row__main' }, [el('div', { class: 'list-row__title' }, [t('search.no-full-scan')]), el('div', { class: 'list-row__sub' }, [t('media.system-picker-only')])])]),
        el('div', { class: 'list-row' }, [el('div', { class: 'list-row__icon' }, ['⤓']), el('div', { class: 'list-row__main' }, [el('div', { class: 'list-row__title' }, [t('settings.full-export-delete')]), el('div', { class: 'list-row__sub' }, [t('capsule.includes-detail')])])]),
        el('div', { class: 'list-row' }, [el('div', { class: 'list-row__icon' }, ['♨']), el('div', { class: 'list-row__main' }, [el('div', { class: 'list-row__title' }, [t('media.family-review')]), el('div', { class: 'list-row__sub' }, [t('settings.sensitive-consent')])])]),
      ]),

      el('div', { class: 'section-title' }, [t('report.people-lens-detail')]),
      el('div', { class: 'card' }, peopleLens(all, navigate)),
    ]));

    function peopleLens(moments, navigate) {
      const map = {};
      moments.forEach(m => (m.people || []).forEach(p => {
        if (!p) return;
        (map[p] = map[p] || []).push(m);
      }));
      const entries = Object.entries(map).sort((a, b) => b[1].length - a[1].length);
      if (!entries.length) return [el('div', { class: 'muted text-center', style: 'font-size:13px;' }, [t('report.no-people')])];
      return entries.map(([name, ms]) =>
        el('div', { class: 'list-row' }, [
          el('div', { class: 'list-row__icon' }, ['☻']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [name]),
            el('div', { class: 'list-row__sub' }, [t('media.shared_moments', {n: ms.length, m: ms.reduce((s, m) => s + TSD.getRevisitCount(m.id), 0)})]),
          ]),
          el('div', { class: 'list-row__right' }, [String(ms.length)]),
        ])
      );
    }
  });

  // ============================================================
  // 视图：ai 忠实编辑器 + 任务契约 + 四道门
  // ============================================================
  route('ai', ({ view, navigate }) => {
    const log = TSD.getAiLog();

    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-2' }, [t('ai.faithful-editor')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;' }, [
        t('ai.intro'),
      ]),

      el('div', { class: 'section-title' }, [t('ai.five-task-contracts')]),
      el('div', { class: 'card' }, [
        taskRow('T0', t('ai.t0_name'), t('ai.t0_desc'), t('ai.t0_diff')),
        taskRow('T1', t('ai.t1_name'), t('ai.t1_desc'), t('ai.t1_diff')),
        taskRow('T2', t('ai.t2_name'), t('ai.t2_desc'), t('ai.t2_diff'), true),
        taskRow('T3', t('ai.t3_name'), t('ai.t3_desc'), t('ai.t3_diff')),
        taskRow('T4', t('ai.t4_name'), t('ai.t4_desc'), t('ai.t4_diff')),
      ]),

      el('div', { class: 'section-title' }, [t('onboarding.four-gates')]),
      el('div', { class: 'card' }, [
        gateRow(t('ai.gate_fact'), t('ai.gate_fact_desc'), t('ai.gate_fact_fail')),
        gateRow(t('ai.gate_tone'), t('ai.gate_tone_desc'), t('ai.gate_tone_fail')),
        gateRow(t('ai.gate_privacy'), t('ai.gate_privacy_desc'), t('ai.gate_privacy_fail')),
        gateRow(t('ai.gate_claim'), t('ai.gate_claim_desc'), t('ai.gate_claim_fail')),
      ]),
      disclosure(t('ai.iron_rule_title'), [
        el('p', { class: 'muted', style: 'font-size:11px;line-height:1.6;' }, [t('ai.iron_rule_body')]),
      ]),

      el('div', { class: 'section-title' }, [t('ai.mobile-tiers')]),
      el('div', { class: 'card' }, [
        layerRow('L0', t('ai.l0_name'), t('ai.cost_zero'), t('ai.l0_role'), 'badge--pass'),
        layerRow('L1', t('ai.l1_name'), t('ai.cost_low'), t('ai.l1_role'), 'badge--poc'),
        layerRow('L2', t('ai.l2_name'), t('ai.cost_low'), t('ai.l2_role'), 'badge--poc'),
        layerRow('L3', t('ai.l3_name'), t('ai.cost_zero'), t('ai.l3_role'), 'badge--todo'),
        layerRow('L4', t('ai.l4_name'), t('ai.cost_device'), t('ai.l4_role'), 'badge--todo'),
      ]),
      el('p', { class: 'muted mt-3', style: 'font-size:11px;' }, [t('ai.l_free_note')]),

      el('div', { class: 'section-title' }, [t('ai.task-ledger-detail')]),
      log.length ? el('div', { class: 'card' }, log.slice(0, 10).map(t =>
        el('div', { class: 'list-row' }, [
          el('div', { class: 'list-row__icon' }, [t.type === 'T2' ? '✦' : t.type === 'T1' ? '✎' : '⚙']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [t.type + ' · ' + (t.payload && t.payload.action || t('ai.task_action_fallback'))]),
            el('div', { class: 'list-row__sub' }, [fmtRelative(t.at) + ' · ' + (t.localOnly ? t('ai.local_only_label') : t('ai.cloud_label')) + ' · ' + t.result]),
          ]),
          el('div', { class: 'list-row__right' }, [
            t.status === 'reverted'
              ? el('span', { class: 'badge badge--todo' }, [t('common.undone')])
              : el('button', { class: 'btn btn--sm btn--ghost', onclick: () => { TSD.revertAiTask(t.id); navigate('ai'); } }, [t('common.undo')]),
          ]),
        ])
      )) : el('div', { class: 'card muted text-center', style: 'font-size:13px;' }, [t('ai.no-tasks-yet')]),

      el('div', { class: 'section-title' }, [t('settings.off-device-ledger')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'list-row' }, [el('div', { class: 'list-row__icon' }, ['📵']), el('div', { class: 'list-row__main' }, [el('div', { class: 'list-row__title' }, [t('common.current')]), el('div', { class: 'list-row__sub' }, [t('ai.on-device-only')])]), el('div', { class: 'list-row__right' }, [el('span', { class: 'badge badge--pass' }, ['PASS'])])]),
        el('div', { class: 'list-row' }, [el('div', { class: 'list-row__icon' }, ['👤']), el('div', { class: 'list-row__main' }, [el('div', { class: 'list-row__title' }, [t('settings.user-id-pseudonym')]), el('div', { class: 'list-row__sub' }, [t('settings.prod-pseudonym-only')])]), el('div', { class: 'list-row__right' }, [el('span', { class: 'badge badge--poc' }, ['PoC'])])]),
      ]),
    ]));

    function taskRow(t, name, desc, diff, highlight) {
      return el('div', { class: 'list-row' }, [
        el('div', { class: 'list-row__icon' + (highlight ? '' : ''), style: highlight ? 'background:var(--accent-glow);color:var(--accent);' : '' }, [t]),
        el('div', { class: 'list-row__main' }, [
          el('div', { class: 'list-row__title' }, [name + (highlight ? t('ai.branch_exclusive') : '')]),
          el('div', { class: 'list-row__sub' }, [desc]),
          el('div', { class: 'muted', style: 'font-size:10px;margin-top:2px;color:var(--fg-faint);' }, [diff]),
        ]),
      ]);
    }
    function gateRow(name, desc, fail) {
      return el('div', { class: 'list-row' }, [
        el('div', { class: 'list-row__icon' }, ['⌬']),
        el('div', { class: 'list-row__main' }, [
          el('div', { class: 'list-row__title' }, [name]),
          el('div', { class: 'list-row__sub' }, [desc + ' · ' + fail]),
        ]),
      ]);
    }
    function layerRow(l, name, cost, role, badgeClass) {
      return el('div', { class: 'list-row' }, [
        el('div', { class: 'list-row__icon' }, [l]),
        el('div', { class: 'list-row__main' }, [
          el('div', { class: 'list-row__title' }, [name]),
          el('div', { class: 'list-row__sub' }, [role + ' · ' + t('ai.layer_cost_label') + cost]),
        ]),
        el('div', { class: 'list-row__right' }, [el('span', { class: 'badge ' + badgeClass }, [l === 'L0' ? 'PASS' : l === 'L4' ? 'TODO' : 'PoC'])]),
      ]);
    }
  });

  // ============================================================
  // 视图：settings
  // ============================================================
  route('settings', ({ view, navigate }) => {
    const s = TSD.raw();

    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-5' }, [t('settings.title')]),

      el('div', { class: 'section-title' }, [t('settings.account-rights')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row' }, [
          el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.current-plan')]), el('div', { class: 'setting-row__sub' }, [tierLabel(s.account.tier)])]),
          el('span', { class: 'chip chip--accent' }, [s.account.tier.toUpperCase()]),
        ]),
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.local-first')]), el('div', { class: 'setting-row__sub' }, [t('settings.local-first-detail')])]), el('span', { class: 'badge badge--pass' }, [t('settings.local-first-tag')])]),
      ]),
      el('p', { class: 'muted mt-2', style: 'font-size:11px;' }, [t('settings.no-account-needed')]),

      el('div', { class: 'section-title' }, [t('onboarding.value-ladder')]),
      el('div', { class: 'card' }, [
        ['free', t('settings.tier_free_name'), t('settings.tier_free_sub')],
        ['pass', t('settings.tier_pass_name'), t('settings.tier_pass_sub')],
        ['plus', t('settings.tier_plus_name'), t('settings.tier_plus_sub')],
        ['family', t('settings.tier_family_name'), t('settings.tier_family_sub')],
      ].map(([id, name, sub]) =>
        el('div', { class: 'setting-row', onclick: () => { TSD.setTier(id); navigate('settings'); } }, [
          el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [name]), el('div', { class: 'setting-row__sub' }, [sub])]),
          s.account.tier === id ? el('span', { class: 'chip chip--accent' }, [t('common.current')]) : el('span', { class: 'muted', style: 'font-size:11px;' }, [t('common.choose')]),
        ])
      )),

      el('div', { class: 'section-title' }, [t('settings.privacy-ai')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row' }, [
          el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.privacy-mode')]), el('div', { class: 'setting-row__sub' }, [s.privacyMode === 'private' ? t('settings.privacy_mode_private') : t('settings.privacy_mode_ai')])]),
          el('button', { class: 'switch' + (s.privacyMode === 'ai-assist' ? ' is-on' : ''), onclick: () => { TSD.setPrivacyMode(s.privacyMode === 'private' ? 'ai-assist' : 'private'); navigate('settings'); } }, []),
        ]),
        el('div', { class: 'setting-row' }, [
          el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('ai.consent')]), el('div', { class: 'setting-row__sub' }, [t('ai.per-task-consent')])]),
          el('button', { class: 'switch' + (s.aiConsent ? ' is-on' : ''), onclick: () => { TSD.setAiConsent(!s.aiConsent); navigate('settings'); } }, []),
        ]),
        el('div', { class: 'setting-row', onclick: () => navigate('ai') }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('ai.task-ledger')]), el('div', { class: 'setting-row__sub' }, [t('ai.view-revoke-all')])]), el('div', { class: 'list-row__right' }, ['▸'])]),
      ]),

      el('div', { class: 'section-title' }, [t('settings.memory-vault')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.local-data')]), el('div', { class: 'setting-row__sub' }, [t('settings.local_stats', {m: TSD.getMoments().length, r: TSD.raw().revisits.length, p: TSD.getMoments().filter(m => m.media).length})])]), el('span', { class: 'badge badge--pass' }, [t('settings.local')])]),
        el('input', { type: 'file', accept: 'application/json,.json', id: 'set-import', style: 'display:none;' }),
        el('div', { class: 'setting-row', onclick: () => { const pkg = TSD.makePackage(); downloadJSON(pkg, 'tsd-memory-package-' + Date.now() + '.json'); toast(t('toast.exported_pkg')); } }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.export_pkg_title')]), el('div', { class: 'setting-row__sub' }, [t('settings.export_pkg_sub')])]), el('div', { class: 'list-row__right' }, ['⤓'])]),
        el('div', { class: 'setting-row', onclick: () => $('#set-import', view).click() }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('capsule.import-memory')]), el('div', { class: 'setting-row__sub' }, [t('capsule.validate-before-write')])]), el('div', { class: 'list-row__right' }, ['⤒'])]),
        el('div', { class: 'setting-row', onclick: () => openDeleteSheet(navigate) }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.clear-local-data')]), el('div', { class: 'setting-row__sub' }, [t('settings.clear_data_sub')])]), el('div', { class: 'list-row__right' }, ['⊘'])]),
      ]),
      TSD.hasTombstone() ? el('div', { class: 'card mt-3', style: 'border:1px solid var(--bloom);' }, [
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('moment.undo-delete')]), el('div', { class: 'setting-row__sub' }, [t('moment.tombstone-restore')])]), el('span', { class: 'badge badge--poc' }, [t('ai.revocable')])]),
        el('button', { class: 'btn btn--primary btn--block mt-2', onclick: () => { if (TSD.restoreTombstone()) { toast(t('toast.restored')); navigate('today', { replace: true }); } else toast(t('toast.restore_failed')); } }, [t('settings.undo_delete_btn')]),
      ]) : null,

      el('div', { class: 'section-title' }, [t('settings.appearance')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.dark_mode')]), el('div', { class: 'setting-row__sub' }, [{ auto: t('settings.dark_auto'), dark: t('settings.dark_dark'), light: t('settings.dark_light') }[s.settings.darkMode || 'auto']])]), el('button', { class: 'btn btn--sm btn--ghost', onclick: () => { const cycle = { auto: 'dark', dark: 'light', light: 'auto' }; const next = cycle[s.settings.darkMode || 'auto']; TSD.setSetting('darkMode', next); applyTheme(next); navigate('settings'); } }, [t('settings.switch')])]),
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.reduced_motion')]), el('div', { class: 'setting-row__sub' }, [t('settings.reduced_motion_sub')])]), el('button', { class: 'switch' + (s.settings.reducedMotion ? ' is-on' : ''), onclick: () => { TSD.setSetting('reducedMotion', !s.settings.reducedMotion); document.body.style.transition = 'none'; navigate('settings'); } }, [])]),
        // 语言切换（中英双语 · 守 manifest 声明）：点击在 zh/en 间切换，setLocale 触发重渲染
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.language')]), el('div', { class: 'setting-row__sub' }, [t('settings.language_sub')])]), el('button', { class: 'btn btn--sm btn--ghost', onclick: () => { I18N.setLocale(I18N.getLocale() === 'zh' ? 'en' : 'zh'); } }, [t('locale.zh_label')])]),
      ]),

      // 主屏幕活体存在（Finch 式 home-screen widget · D1/D7 54/37 超 Duolingo）
      // 守原则5：badge 只 0/1 安静点，永不计数/永不"漏 X 天"
      el('div', { class: 'section-title' }, [t('settings.home-screen')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row' }, [el('div', { class: 'setting-row__main' }, [
          el('div', { class: 'setting-row__title' }, [t('settings.live-icon-dot')]),
          el('div', { class: 'setting-row__sub' }, [
            WidgetBadge.hasBadgeApi() ? t('settings.badge_supported') : t('settings.badge_unsupported'),
          ]),
        ]), el('div', { class: 'list-row__right' }, [WidgetBadge.hasBadgeApi() ? '✓' : '—'])]),
        el('div', { class: 'setting-row', onclick: () => openInstallGuide(navigate) }, [el('div', { class: 'setting-row__main' }, [
          el('div', { class: 'setting-row__title' }, [t('settings.put-on-home-screen')]),
          el('div', { class: 'setting-row__sub' }, [t('settings.add-home-finch')]),
        ]), el('div', { class: 'list-row__right' }, ['▸'])]),
      ]),

      el('div', { class: 'section-title' }, [t('onboarding.trial-guide-review')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row', onclick: () => openTrialGuide(navigate) }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('onboarding.trial-guide')]), el('div', { class: 'setting-row__sub' }, [t('onboarding.demo-route')])]), el('div', { class: 'list-row__right' }, ['▸'])]),
        el('div', { class: 'setting-row', onclick: () => navigate('qa') }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, ['Demo QA Console']), el('div', { class: 'setting-row__sub' }, [t('onboarding.scoring-route')])]), el('div', { class: 'list-row__right' }, ['▸'])]),
        // 错误日志导出（参 ZCode · TestFlight 真机调试必备）：把运行时错误栈导出为 JSON 下载
        el('div', { class: 'setting-row', onclick: () => {
          const logs = window.__tsdExportErrorLog ? window.__tsdExportErrorLog() : [];
          if (!logs.length) { toast(t('toast.no_error_log')); return; }
          const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = el('a', { href: url, download: 'tsd-error-log-' + Date.now() + '.json' });
          document.body.appendChild(a); a.click(); a.remove();
          URL.revokeObjectURL(url);
          toast(t('toast.exported_logs', {n: logs.length}));
        } }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.export-error-log')]), el('div', { class: 'setting-row__sub' }, [t('settings.error_log_sub', {n: (window.__tsdExportErrorLog ? window.__tsdExportErrorLog().length : 0)})])]), el('div', { class: 'list-row__right' }, ['▸'])]),
      ]),

      el('div', { class: 'section-title' }, [t('capsule.future-letters')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row', onclick: () => navigate('capsules') }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('capsule.time-capsule')]), el('div', { class: 'setting-row__sub' }, [t('settings.capsule_sub', {n: TSD.getCapsules().length})])]), el('div', { class: 'list-row__right' }, ['▸'])]),
      ]),

      el('div', { class: 'section-title' }, [t('report.reunion-report')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row', onclick: () => navigate('report') }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('report.time-revisited-title')]), el('div', { class: 'setting-row__sub' }, [t('report.reflective-stats')])]), el('div', { class: 'list-row__right' }, ['▸'])]),
      ]),

      el('div', { class: 'section-title' }, [t('invite.give-tsd')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row', onclick: () => navigate('invite') }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('invite.gift-recommendation')]), el('div', { class: 'setting-row__sub' }, [t('invite.your-own-words')])]), el('div', { class: 'list-row__right' }, ['▸'])]),
        // Shared Grove（2 人共享记忆池 · Day One Shared Journals 式 · 守原则5/7）
        el('div', { class: 'setting-row', onclick: () => navigate('grove') }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('grove.shared-grove')]), el('div', { class: 'setting-row__sub' }, [TSD.getGrove().paired ? t('settings.grove_sub_paired', {name: TSD.getGrove().partnerName}) : t('settings.grove_sub_unpaired')])]), el('div', { class: 'list-row__right' }, ['▸'])]),
      ]),

      el('div', { class: 'section-title' }, [t('settings.about')]),
      el('div', { class: 'card text-center muted', style: 'font-size:12px;line-height:1.6;' }, [
        el('div', { class: 'serif', style: 'font-size:16px;color:var(--fg);margin-bottom:8px;' }, [t('settings.app-title-branch')]),
        t('settings.about_thesis'),
        el('br'),
        t('settings.about_tagline'),
        el('div', { class: 'mt-3', style: 'font-size:11px;color:var(--fg-faint);' }, [t('onboarding.m1-disclaimer')]),
        el('a', { href: 'privacy.html', target: '_blank', style: 'display:inline-block;margin-top:10px;color:var(--accent);font-size:12px;text-decoration:none;' }, [t('settings.privacy-policy')]),
      ]),
    ]));
    $('#set-import', view).addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const pkg = JSON.parse(await f.text());
        openImportSheet(pkg, navigate);
      } catch (err) { toast(t('toast.read_json_failed')); }
      e.target.value = '';
    });
  });

  function tierLabel(tier) { return { free: t('settings.tier_label_free'), pass: t('settings.tier_label_pass'), plus: t('settings.tier_label_plus'), family: t('settings.tier_label_family') }[tier] || tier; }

  // ============================================================
  // 视图：qa Demo QA Console
  // ============================================================
  route('qa', ({ view, navigate }) => {
    const checks = [
      ['回声主入口可见', 'today', 'PASS', '进入 App 首屏即"今天的回声"'],
      ['回访限时 10 秒', 'revisit/m-seed-01', 'PASS', '进入重温后倒计时'],
      ['回访追加层叠保留原话', 'revisit/m-seed-01', 'PASS', 'AI 不改写'],
      ['反信息茧房：7天≥3个不同', 'today', 'POC', '调度含随机扰动'],
      ['冷启动种子', 'today', 'PASS', '8 条种子瞬间'],
      ['三个月对照指标', 'today', 'PASS', '回访 vs 未回访可讲述'],
      ['影像作为回访入口', 'media', 'PASS', '真实照片选择器+压缩+事后补影像'],
      ['人生周格旷野', 'wilderness', 'PASS', '含变厚/花丛/草地'],
      ['AI 任务账本可撤销', 'ai', 'PASS', 'T1 记录可撤销'],
      ['四道门可见', 'ai', 'PASS', '事实/语气/隐私/认领'],
      ['L0–L4 分层', 'ai', 'PASS', '规则层底座'],
      ['本机优先·无账户', 'settings', 'PASS', '诚实声明·不联网不上传'],
      ['记忆保险箱导出/清空', 'settings', 'PASS', '版本化包+checksum'],
      ['导出包校验/导入', 'settings', 'PASS', 'checksum 校验+回灌写入'],
      ['删除回执+会话内撤销', 'settings', 'PASS', '回执 token+墓碑撤销'],
      ['价值阶梯四层', 'settings', 'POC', '价格待验证'],
      ['退订取回窗口', 'settings', 'N/A', '无订阅·无账户·无需退订'],
      ['E2EE 媒体保险箱路径', 'media', 'N/A', '已声明本机优先·不实现 E2EE·不联网'],
      ['"我也是"感受标签微仪式', 'today', 'PASS', '回访追加感受后可跳过标签步骤'],
      ['纯感受卡分享（零可识别信息）', 'today', 'PASS', 'canvas 只含抽象词+水印'],
      ['重逢报告感受维度', 'settings', 'PASS', 'topFeelingTag stat 卡'],
      ['全局搜索瞬间', 'search', 'PASS', 'topbar ⌕ 入口，按原话/人物/地点/标签'],
      ['编辑瞬间（正文/人物/地点/类型/时间）', 'moment/m-seed-01', 'PASS', 'moment 路由底部"编辑这一刻"'],
      ['删除瞬间（二次确认+会话内撤销）', 'moment/m-seed-01', 'PASS', '墓碑回灌，5秒撤销'],
      ['onboarding 跳过逃生口', 'onboarding', 'PASS', '承诺页"先逛逛"'],
      ['主题三态平滑切换（无 reload）', 'settings', 'PASS', 'auto/dark/light data-theme'],
      ['回访加时（再停留 10 秒，最多 1 次）', 'revisit/m-seed-01', 'PASS', '守硬上限+尊重峰终'],
    ];
    const pass = checks.filter(c => c[2] === 'PASS').length;
    const poc = checks.filter(c => c[2] === 'POC').length;
    const todo = checks.filter(c => c[2] === 'TODO').length;

    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-2' }, ['Demo QA Console']),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;' }, [t('onboarding.trial-verify-status')]),

      el('div', { class: 'card' }, [
        el('div', { class: 'flex gap-4' }, [
          statBlock(String(pass), 'PASS', 'growth'),
          statBlock(String(poc), 'POC', 'accent'),
          statBlock(String(todo), 'TODO', 'mute'),
        ]),
        el('div', { class: 'divider', style: 'margin:16px 0;' }),
        el('div', { class: 'muted', style: 'font-size:12px;' }, [t('qa.total_summary', {n: checks.length, pct: Math.round(pass / checks.length * 100)})]),
      ]),

      el('div', { class: 'section-title' }, [t('onboarding.acceptance-checklist')]),
      el('div', { class: 'card' }, checks.map(c =>
        el('div', { class: 'list-row' }, [
          el('div', { class: 'list-row__icon' }, [c[2] === 'PASS' ? '✓' : c[2] === 'POC' ? '○' : '·']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [c[0]]),
            el('div', { class: 'list-row__sub' }, [c[3]]),
          ]),
          el('div', { class: 'list-row__right' }, [
            el('span', { class: 'badge badge--' + c[2].toLowerCase() }, [c[2]]),
            el('button', { class: 'btn btn--sm btn--ghost', style: 'margin-left:8px;', onclick: () => navigate(c[1]) }, [t('qa.try_btn')]),
          ]),
        ])
      )),

      el('div', { class: 'section-title' }, [t('onboarding.smoke-route')]),
      el('div', { class: 'card' }, [
        t('qa.smoke_step_1'),
        el('br'), t('qa.smoke_step_2'),
        el('br'), t('qa.smoke_step_3'),
        el('br'), t('qa.smoke_step_4'),
        el('br'), t('qa.smoke_step_5'),
        el('br'), t('qa.smoke_step_6'),
        el('br'), t('qa.smoke_step_7'),
        el('br'), t('qa.smoke_step_8'),
        el('br'), t('qa.smoke_step_9'),
      ]),

      el('button', { class: 'btn btn--ghost btn--block mt-4', onclick: () => {
        const report = t('qa.report_header') + '\n' + '='.repeat(40) + '\n'
          + t('qa.report_time') + new Date().toLocaleString('zh-CN') + '\n'
          + t('qa.report_summary', {p: pass, oc: poc, td: todo}) + '\n\n'
          + checks.map(c => '[' + c[2] + '] ' + c[0]).join('\n');
        navigator.clipboard.writeText(report).then(() => toast(t('toast.qa_copied')));
      } }, [t('report.copy-qa')]),
    ]));
  });

  // ============================================================
  // 视图：search 搜索瞬间（Day One 级核心功能）
  // ============================================================
  route('search', ({ view, navigate }) => {
    const all = TSD.getMoments();
    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-3' }, [t('search.find-moment')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;' }, [t('search.description')]),
      el('input', {
        id: 'search-input',
        type: 'search',
        placeholder: t('search.placeholder'),
        style: 'width:100%;padding:14px 16px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:16px;margin-bottom:20px;',
        autocomplete: 'off',
      }),
      el('div', { id: 'search-results' }),
      el('div', { id: 'search-hint', class: 'muted', style: 'font-size:12px;line-height:1.6;' }, all.length ? [t('search.count_hint', {n: all.length})] : [t('moment.no-moments')]),
    ]));

    const input = $('#search-input', view);
    const resultsBox = $('#search-results', view);
    const hint = $('#search-hint', view);

    const renderResults = (q) => {
      resultsBox.innerHTML = '';
      if (!q) {
        if (all.length >= 4) {
          // 无搜索词时：展示最近 6 个瞬间（Day One 式最近列表）
          const recent = all.slice(0, 6);
          resultsBox.appendChild(el('div', { class: 'section-title', style: 'margin-top:0;' }, [t('moment.recent')]));
          resultsBox.appendChild(el('div', { class: 'card' }, recent.map(m =>
            el('div', { class: 'list-row', onclick: () => navigate('moment/' + m.id) }, [
              el('div', { class: 'list-row__icon', style: thicknessColor(m.id) }, [TSD.thickness(m.id) === 'thick' ? '◈' : '○']),
              el('div', { class: 'list-row__main' }, [
                el('div', { class: 'list-row__title serif', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, ['"' + truncate(m.quote, 26) + '"']),
                el('div', { class: 'list-row__sub' }, [(m.when && m.when.text) || t('common.someday')] + ' · ' + fmtRelative(m.createdAt)),
              ]),
              el('div', { class: 'list-row__right' }, ['▸']),
            ])
          )));
        }
        return;
      }
      const found = TSD.searchMoments(q);
      if (!found.length) {
        resultsBox.appendChild(el('div', { class: 'card muted text-center', style: 'font-size:13px;' }, [t('search.no-match')]));
        return;
      }
      resultsBox.appendChild(el('div', { class: 'section-title', style: 'margin-top:0;' }, [t('search.found_count', {n: found.length})]));
      resultsBox.appendChild(el('div', { class: 'card' }, found.map(m =>
        el('div', { class: 'list-row', onclick: () => navigate('moment/' + m.id) }, [
          el('div', { class: 'list-row__icon', style: thicknessColor(m.id) }, [TSD.thickness(m.id) === 'thick' ? '◈' : '○']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title serif', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, ['"' + truncate(m.quote, 26) + '"']),
            el('div', { class: 'list-row__sub' }, [(m.when && m.when.text) || t('common.someday')] + (m.people && m.people.length ? ' · ' + m.people.join(t('moment.people_join')) : '')),
          ]),
          el('div', { class: 'list-row__right' }, ['▸']),
        ])
      )));
    };

    input.addEventListener('input', () => {
      const q = input.value.trim();
      renderResults(q);
      if (q) hint.textContent = '';
      else hint.textContent = all.length ? t('search.count_hint', {n: all.length}) : t('search.empty_hint');
    });
    renderResults('');
    setTimeout(() => input.focus(), 100);
  });

  // ============================================================
  // 视图：capture 留下新瞬间（可选，非主交付）
  // ============================================================
  route('capture', ({ view, navigate }) => {
    let pendingMedia = null;
    view.appendChild(el('div', {}, [
      el('h2', { class: 'h2 mb-2' }, [t('capture.leave-moment')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;' }, [
        t('capture.intro'),
      ]),
      el('textarea', {
        id: 'cap-quote', placeholder: t('capture.quote_placeholder'),
        style: 'width:100%;min-height:100px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:16px;font-family:var(--font-serif);resize:none;',
      }),
      el('div', { class: 'section-title' }, [t('common.type')]),
      el('div', { class: 'flex gap-2 mb-4', id: 'cap-kind' }, [
        ...[['grass', t('kind.grass')],['bloom', t('kind.bloom')],['night', t('kind.night')]].map(([k, l], i) =>
          el('button', { class: 'chip' + (i === 0 ? ' chip--growth' : ''), 'data-k': k, onclick: (e) => {
            $$('#cap-kind .chip').forEach(c => c.className = 'chip');
            e.target.className = 'chip chip--' + (k === 'bloom' ? 'bloom' : k === 'night' ? 'night' : 'growth');
          } }, [l]))
      ]),
      el('div', { class: 'section-title' }, [t('moment.people-field-optional')]),
      el('input', { id: 'cap-people', placeholder: t('edit.people_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;' }),
      el('div', { class: 'section-title' }, [t('moment.place-optional')]),
      el('input', { id: 'cap-place', placeholder: t('edit.place_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;' }),
      el('div', { class: 'section-title' }, [t('media.revisit-entry-optional')]),
      el('input', { type: 'file', accept: 'image/*', id: 'cap-photo', style: 'display:none;' }),
      el('div', { id: 'cap-photo-preview' }),
      el('button', { class: 'btn btn--ghost btn--sm mb-4', onclick: () => $('#cap-photo', view).click() }, [t('media.pick-photo')]),
      el('div', { class: 'flex gap-3' }, [
        el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => navigate('today') }, [t('common.cancel')]),
        el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
          const q = $('#cap-quote').value.trim();
          if (!q) { toast(t('toast.write_a_line')); return; }
          const kindEl = $$('#cap-kind .chip').find(c => c.className.includes('chip--'));
          const kind = kindEl ? kindEl.getAttribute('data-k') : 'grass';
          const people = $('#cap-people').value.split(',').map(s => s.trim()).filter(Boolean);
          const place = $('#cap-place').value.trim() || null;
          TSD.addMoment({ quote: q, kind, people, place, media: pendingMedia, when: { precision: 'day', text: t('rel.today'), start: Math.floor(Date.now()/1000) } });
          TSD.logAiTask({ type: 'T0', payload: { action: 'extract', quote: q, hasMedia: !!pendingMedia }, result: t('revisit.t0_extract_result'), localOnly: true });
          toast(t('toast.kept_moment'));
          navigate('today');
        } }, [t('common.hold-on')]),
      ]),
    ]));
    $('#cap-photo', view).addEventListener('change', async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      toast(t('toast.processing_image'));
      try {
        const { dataUrl } = await fileToCompressedDataUrl(f);
        pendingMedia = dataUrl;
        const box = $('#cap-photo-preview', view);
        box.innerHTML = '';
        box.appendChild(el('img', { src: dataUrl, style: 'max-width:100%;max-height:220px;border-radius:12px;' }));
        toast(t('toast.image_selected'));
      } catch (err) { toast(err.message || t('moment.media_failed')); }
    });
  });

  // ============================================================
  // 视图：imprints 重逢印记（独立页 · Codex 雾中范式 + 安静模式开关）
  // ============================================================
  route('imprints', ({ view, navigate }) => {
    const unlocked = TSD.getAchievements().filter(a => a.unlocked);
    view.appendChild(el('div', {}, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [
        el('button', { class: 'btn btn--sm btn--ghost', onclick: () => history.back() }, [t('moment.back')]),
      ]),
      el('h2', { class: 'h2 mb-2' }, [t('revisit.reunion-imprint')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;line-height:1.6;' }, [
        t('imprints.intro'),
        el('br'), el('strong', { style: 'color:var(--fg);' }, [t('revisit.reunion-is-reward')]),
      ]),
      el('div', { class: 'card' }, [
        el('div', { style: 'display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start;' }, [
          ...(unlocked.length ? unlocked.map(a => imprintTile(a, true)) : [el('div', { class: 'muted', style: 'font-size:13px;' }, [t('revisit.no-imprints')])]),
          // 永久雾中未知位
          el('div', { style: 'display:flex;flex-direction:column;align-items:center;width:64px;opacity:.45;' }, [
            el('div', { style: 'font-size:28px;color:var(--fg-faint);' }, ['?']),
            el('div', { class: 'muted', style: 'font-size:10px;text-align:center;margin-top:6px;line-height:1.2;' }, [t('today.imprints_fog')]),
            el('div', { class: 'muted', style: 'font-size:11px;text-align:center;margin-top:2px;color:var(--fg-mute);' }, [t('common.next-in-mist')]),
          ]),
        ]),
      ]),
      disclosure(t('imprints.how_title'), [
        el('p', { class: 'muted', style: 'font-size:12px;line-height:1.7;' }, [
          t('imprints.how_1'), el('br'),
          t('imprints.how_2'), el('br'),
          t('imprints.how_3'), el('br'),
          t('imprints.how_4'),
        ]),
      ]),
      el('div', { class: 'section-title' }, [t('settings.quiet-mode')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row' }, [
          el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('settings.quiet-mode')]), el('div', { class: 'setting-row__sub' }, [t('settings.privacy-mode-desc')])]),
          el('button', { class: 'switch' + ((TSD.raw().settings && TSD.raw().settings.quietMode) ? ' is-on' : ''), onclick: () => { TSD.setSetting('quietMode', !(TSD.raw().settings && TSD.raw().settings.quietMode)); navigate('imprints'); } }, []),
        ]),
      ]),
      el('p', { class: 'muted mt-4', style: 'font-size:11px;text-align:center;' }, [t('imprints.design_note')]),
    ]));
  });

  // ---------- 时间胶囊：封存给未来的自己（C-A 病毒引擎）----------
  function openSealSheet(m) {
    const opts = [['1m', t('capsule.opt_1m'), 30], ['3m', t('capsule.opt_3m'), 90], ['1y', t('capsule.opt_1y'), 365], ['3y', t('capsule.opt_3y'), 1095], ['5y', t('capsule.opt_5y'), 1825]];
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('capsule.seal-for-future')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;' }, [t('capsule.moment-locked')]),
      el('div', { class: 'serif', style: 'font-size:15px;color:var(--fg);background:var(--bg-elev);padding:14px;border-radius:12px;margin-bottom:16px;line-height:1.5;' }, ['"' + m.quote + '"']),
      el('div', { class: 'section-title' }, [t('capsule.unlock-when')]),
      el('div', { class: 'flex', style: 'flex-wrap:wrap;gap:8px;' }, opts.map(([k, label, days]) =>
        el('button', { class: 'chip', onclick: (e) => {
          const unlockAt = Date.now() + days * 864e5;
          TSD.addCapsule({ quote: m.quote, momentId: m.id, unlockAt });
          haptic('success');
          toast(t('toast.sealed_capsule', {date: new Date(unlockAt).toLocaleDateString(I18N.getLocale()==='zh'?'zh-CN':'en')}));
          const s = e.target.closest('.sheet'); if (s && s._close) s._close();
        } }, [label])
      )),
      el('p', { class: 'muted mt-4', style: 'font-size:11px;line-height:1.5;' }, [t('capsule.unlock-reunion-share')]),
    ]);
    sheet(content);
  }

  // ============================================================
  // 视图：capsules 未来的信（时间胶囊列表）
  // ============================================================
  route('capsules', ({ view, navigate }) => {
    const caps = TSD.getCapsules();
    const now = Date.now();
    view.appendChild(el('div', {}, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [
        el('button', { class: 'btn btn--sm btn--ghost', onclick: () => history.back() }, [t('moment.back')]),
      ]),
      el('h2', { class: 'h2 mb-2' }, [t('capsule.future-letters')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;line-height:1.6;' }, [t('capsule.seal-description')]),
      caps.length ? el('div', {}, caps.map(c => {
        if (c.unlocked) {
          TSD.markCapsuleViewed(c.id);
          return el('div', { class: 'card mb-3', style: 'border:1px solid var(--accent-glow, rgba(216,201,160,.3));' }, [
            el('div', { class: 'echo-card__label' }, [t('capsule.unlocked_label', {date: new Date(c.unlockAt).toLocaleDateString('zh-CN')})]),
            el('div', { class: 'serif', style: 'font-size:17px;line-height:1.5;margin:10px 0;color:var(--fg);' }, ['"' + c.quote + '"']),
            el('div', { class: 'muted', style: 'font-size:11px;' }, [t('capsule.sealed_at', {when: fmtRelative(c.createdAt)})]),
            el('button', { class: 'btn btn--ghost btn--sm mt-3', onclick: () => shareRevisitCard({ quote: c.quote, when: { text: t('capsule.sealed_at', {when: fmtRelative(c.createdAt)}), start: Math.floor(c.createdAt / 1000) } }, []) }, [t('capsule.share_letter')]),
          ]);
        }
        const days = Math.ceil((c.unlockAt - now) / 864e5);
        return el('div', { class: 'card mb-3', style: 'opacity:.72;' }, [
          el('div', { style: 'font-size:24px;' }, ['🔒']),
          el('div', { class: 'muted', style: 'font-size:13px;margin-top:8px;' }, [t('capsule.unlock_in', {date: new Date(c.unlockAt).toLocaleDateString('zh-CN'), n: days})]),
          el('div', { class: 'muted', style: 'font-size:11px;margin-top:6px;' }, [t('capsule.content-hidden')]),
        ]);
      })) : el('div', { class: 'card text-center muted', style: 'font-size:13px;padding:28px 20px;' }, [
        el('div', { style: 'font-size:36px;margin-bottom:10px;' }, ['✉']),
        el('div', { class: 'serif', style: 'font-size:15px;color:var(--fg-soft);margin-bottom:6px;' }, [t('capsule.no-letters')]),
        el('div', { style: 'margin-bottom:18px;' }, [t('capsule.open-moment-seal')]),
        el('button', { class: 'btn btn--primary', onclick: () => navigate('today') }, [t('today.see-echo')]),
      ]),
      el('p', { class: 'muted mt-5', style: 'font-size:11px;text-align:center;' }, [t('capsule.ref-futureme')]),
    ]));
  });

  // ============================================================
  // 视图：grove · Shared Grove（2 人共享记忆池 · Day One Shared Journals 式）
  // 守原则5/7：1:1 二元，无公开 feed/无点赞/无评论/无排行榜；每人只经回声卡节奏看对方瞬间（一天一个），不能浏览对方全历史（反 FOMO）
  // 同步层：离线"信物"模式（导出/导入），真正 CRDT 云同步留待 M2/生产后端
  // ============================================================
  route('grove', ({ view, navigate }) => {
    const g = TSD.getGrove();
    view.appendChild(el('div', {}, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [
        el('button', { class: 'btn btn--sm btn--ghost', onclick: () => history.back() }, [t('moment.back')]),
      ]),
      el('h2', { class: 'h2 mb-2' }, [t('grove.shared-grove')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;line-height:1.6;' }, [
        t('grove.intro_1'), el('br'),
        t('grove.intro_2'),
      ]),

      // 配对状态
      !g.paired ? el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3 mb-2' }, [t('grove.no-grove-established')]),
        el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.5;' }, [t('grove.name-and-send')]),
        el('input', { id: 'grove-name', placeholder: t('grove.name_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:12px;' }),
        el('button', { class: 'btn btn--primary btn--block', onclick: () => {
          const n = ($('#grove-name', view) || {}).value;
          if (!n || !n.trim()) { toast(t('toast.name_required')); return; }
          TSD.setGrovePartner(n);
          toast(t('toast.grove_created', {name: n.trim()}));
          navigate('grove');
        } }, [t('grove.establish')]),
        // 导入对方的信物
        el('div', { class: 'divider', style: 'margin:16px 0;' }),
        el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:8px;' }, [t('grove.receive-gift-prompt')]),
        el('textarea', { id: 'grove-import', placeholder: t('grove.import_placeholder'), style: 'width:100%;min-height:60px;padding:10px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;font-size:12px;resize:none;' }),
        el('button', { class: 'btn btn--ghost btn--sm btn--block mt-2', onclick: () => {
          const txt = (($('#grove-import', view) || {}).value || '').trim();
          if (!txt) { toast(t('toast.paste_gift')); return; }
          try {
            const gift = JSON.parse(txt);
            const item = TSD.importGroveGift(gift);
            if (item) { haptic('success'); toast(t('toast.grove_received')); navigate('grove'); }
            else toast(t('toast.gift_invalid'));
          } catch (e) { toast(t('toast.gift_invalid')); }
        } }, [t('grove.import-gift')]),
      ]) : el('div', { class: 'card mb-3' }, [
        el('div', { class: 'flex items-center justify-between' }, [
          el('div', {}, [
            el('div', { class: 'h3' }, [t('grove.with_partner', {name: g.partnerName})]),
            el('div', { class: 'muted', style: 'font-size:12px;margin-top:2px;' }, [t('grove.received_count', {n: g.received.length})]),
          ]),
          el('button', { class: 'btn btn--ghost btn--sm', onclick: () => { if (confirm(t('grove.leave_confirm'))) { TSD.leaveGrove(); navigate('grove'); } } }, [t('common.leave')]),
        ]),
      ]),

      // 今天的 Grove 回声（守原则5：一天一个，不浏览全历史）
      g.paired && g.received.length ? (() => {
        const echo = TSD.groveEcho();
        return echo ? el('div', { class: 'card mb-3', style: 'border:1px solid var(--accent-glow, rgba(240,178,136,.3));' }, [
          el('div', { class: 'echo-card__label' }, [t('grove.today_echo_from', {name: g.partnerName})]),
          echo.media ? el('img', { src: echo.media, style: 'max-width:100%;border-radius:12px;margin:10px 0;' }) : null,
          el('div', { class: 'serif', style: 'font-size:17px;line-height:1.5;margin:10px 0;color:var(--fg);' }, ['"' + echo.quote + '"']),
          el('div', { class: 'muted', style: 'font-size:11px;' }, [echo.whenText + ' · ' + fmtRelative(echo.receivedAt) + t('grove.received_at')]),
          el('button', { class: 'btn btn--ghost btn--sm mt-3', onclick: () => { TSD.markGroveViewed(echo.id); toast(t('toast.viewed')); } }, [t('grove.i_see')]),
        ]) : null;
      })() : null,

      // 收到过的瞬间（只显示已 surfaced 的，且只显示引文截断 + 时间，不展示全部 · 反 FOMO）
      g.paired && g.received.length ? el('div', {}, [
        el('div', { class: 'section-title' }, [t('grove.from-them')]),
        el('div', { class: 'card' }, g.received.filter(r => r.surfaced).map(r =>
          el('div', { class: 'list-row' }, [
            el('div', { class: 'list-row__icon', style: 'background:var(--accent-glow);color:var(--accent);' }, [r.viewed ? '○' : '●']),
            el('div', { class: 'list-row__main' }, [
              el('div', { class: 'list-row__title serif', style: 'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' }, ['"' + truncate(r.quote, 24) + '"']),
              el('div', { class: 'list-row__sub' }, [r.whenText + ' · ' + fmtRelative(r.receivedAt)]),
            ]),
          ])
        )),
      ]) : null,

      el('p', { class: 'muted mt-5', style: 'font-size:11px;text-align:center;line-height:1.5;' }, [
        t('grove.ref_note'), el('br'),
        t('grove.sync_note'),
      ]),
    ]));
  });

  // ============================================================
  // 视图：report 重逢报告（C-D · Wrapped 反 Feed 版，反思性统计 + 怀旧重遇）
  // ============================================================
  route('report', ({ view, navigate }) => {
    const s = TSD.reportStats();
    const card = (kind, opts) => {
      const c = el('div', { class: 'card mb-3', style: 'position:relative;' });
      if (kind === 'stat') {
        c.appendChild(el('div', { class: 'text-center' }, [
          el('div', { class: 'serif nums', style: 'font-size:56px;color:var(--accent);font-weight:700;' }, [String(opts.headline)]),
          el('div', { class: 'muted', style: 'font-size:14px;margin-top:8px;' }, [opts.label]),
        ]));
        if (opts.onShare) c.appendChild(el('button', { class: 'btn btn--ghost btn--sm', style: 'position:absolute;top:12px;right:12px;', onclick: opts.onShare }, [t('common.share')]));
      } else {
        c.appendChild(el('div', {}, [
          el('div', { class: 'echo-card__label' }, [opts.title]),
          el('div', { class: 'serif', style: 'font-size:17px;line-height:1.5;margin:10px 0;color:var(--fg);' }, ['"' + opts.quote + '"']),
          el('div', { class: 'muted', style: 'font-size:11px;' }, [opts.sub]),
        ]));
        if (opts.m) c.appendChild(el('button', { class: 'btn btn--ghost btn--sm mt-3', onclick: () => shareRevisitCard(opts.m, []) }, [t('moment.share')]));
      }
      return c;
    };
    view.appendChild(el('div', {}, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [el('button', { class: 'btn btn--sm btn--ghost', onclick: () => history.back() }, [t('moment.back')])]),
      el('h2', { class: 'h2 mb-2' }, [t('report.title')]),
      el('p', { class: 'muted mb-5', style: 'font-size:13px;line-height:1.6;' }, [t('report.intro')]),
      card('stat', { headline: s.momentCount, label: t('report.moments_kept'), onShare: () => shareStatCard(s.momentCount, t('report.moments_kept')) }),
      card('stat', { headline: s.revisitCount, label: t('report.times_brought_back'), onShare: () => shareStatCard(s.revisitCount, t('report.times_brought_back')) }),
      s.crossYearRevisits ? card('stat', { headline: s.crossYearRevisits, label: t('report.cross_year'), onShare: () => shareStatCard(s.crossYearRevisits, t('report.cross_year_short')) }) : null,
      s.thickestQuote ? card('quote', { title: t('report.thickest_title'), quote: s.thickestQuote, sub: t('report.thickest_sub', { n: s.thickestCount }), m: { quote: s.thickestQuote, when: { text: t('report.thickest_sub', { n: s.thickestCount }) } } }) : null,
      s.topPerson ? card('stat', { headline: s.topPerson, label: t('report.top_person'), onShare: () => shareStatCard(s.topPerson, t('report.top_person')) }) : null,
      s.earliest ? card('quote', { title: t('report.earliest_title'), quote: s.earliest.quote, sub: t('report.earliest_sub') + fmtRelative(s.earliest.createdAt), m: s.earliest }) : null,
      s.topFeelingTag ? card('stat', { headline: s.topFeelingTag, label: t('report.top_feeling'), onShare: () => shareStatCard(s.topFeelingTag, t('report.top_feeling')) }) : null,
      // 感受天气图（Stoic 式情绪可视化 · 守原则5：不排名/不比较/不评判，只展示分布）
      Object.keys(s.feelingTagFreq).length >= 2 ? el('div', { class: 'card mb-3' }, [
        el('div', { class: 'echo-card__label' }, [t('report.weather_title')]),
        el('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 16px;' }, [t('report.weather_sub')]),
        feelingWeatherChart(s.feelingTagFreq),
      ]) : null,
      // Life Mash（1SE 式蒙太奇 · 把最近回访的瞬间照片编译成 15s 幻灯片）
      // 守原则9：按需生成非每日；无 streak。复用现有 share-card 基建。
      lifeMashSection(),
      el('p', { class: 'muted mt-5', style: 'font-size:11px;text-align:center;' }, [t('report.ref-wrapped')]),
    ]));
  });

  // Life Mash 区块（1SE 式蒙太奇 · 按需生成 15s 幻灯片）
  function lifeMashSection() {
    // 收集最近被回访的、有照片的瞬间（最近 N 个，倒序）
    const revisited = TSD.raw().revisits
      .slice().sort((a, b) => b.at - a.at)
      .map(r => TSD.getMoment(r.momentId))
      .filter((m, i, arr) => m && m.media && arr.findIndex(x => x && x.id === m.id) === i) // 去重
      .slice(0, 8);
    const hasEnough = revisited.length >= 2;
    return el('div', { class: 'card mb-3' }, [
      el('div', { class: 'echo-card__label' }, [t('mash.life-montage')]),
      el('p', { class: 'muted', style: 'font-size:12px;margin:6px 0 16px;line-height:1.5;' }, [
        t('mash.intro'), el('br'),
        hasEnough ? t('mash.has_enough') : t('mash.not_enough'),
      ]),
      hasEnough ? el('button', {
        class: 'btn btn--primary btn--block',
        onclick: () => openLifeMashSheet(revisited),
      }, [t('mash.generate-15s')]) : el('div', { class: 'muted text-center', style: 'font-size:12px;padding:12px;' }, [t('mash.need_more', {n: (2 - revisited.length)})]),
    ]);
  }

  // Life Mash 生成器（canvas 序列帧 → 自动播放幻灯片）
  function openLifeMashSheet(moments) {
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const content = el('div', { class: 'feeling-tag__content', style: 'max-width:420px;' });
    const canvas = el('canvas', { width: 540, height: 540, style: 'width:100%;max-width:420px;border-radius:14px;background:#0f1014;display:block;margin:0 auto;' });
    const ctx = canvas.getContext('2d');
    let idx = 0, playing = false;

    const drawFrame = (i) => {
      const m = moments[i % moments.length];
      ctx.fillStyle = '#0f1014'; ctx.fillRect(0, 0, 540, 540);
      // 加载图片
      const img = new Image();
      img.onload = () => {
        // cover 居中
        const r = Math.max(540 / img.width, 540 / img.height);
        const w = img.width * r, h = img.height * r;
        ctx.drawImage(img, (540 - w) / 2, (540 - h) / 2, w, h);
        // 渐变暗角 + 引文叠层
        const g = ctx.createLinearGradient(0, 340, 0, 540);
        g.addColorStop(0, 'rgba(15,16,20,0)'); g.addColorStop(1, 'rgba(15,16,20,0.92)');
        ctx.fillStyle = g; ctx.fillRect(0, 340, 540, 200);
        // 引文（截断）
        ctx.fillStyle = '#ece8df'; ctx.font = '20px Georgia, serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const q = m.quote.length > 32 ? m.quote.slice(0, 31) + '…' : m.quote;
        wrapText(ctx, '"' + q + '"', 270, 470, 480, 26);
        // 索引点
        ctx.fillStyle = 'rgba(240,178,136,0.5)'; ctx.font = '12px sans-serif';
        ctx.fillText((i + 1) + ' / ' + moments.length, 270, 28);
      };
      img.src = m.media;
    };

    const play = () => {
      playing = true;
      drawFrame(0);
      setRouteTimer(setInterval(() => {
        idx = (idx + 1) % moments.length;
        drawFrame(idx);
      }, 2000)); // 每帧 2s，8 帧 ≈ 16s（接近 15s 目标）
    };
    const stop = () => { clearRouteTimer(); playing = false; };

    content.appendChild(el('div', {}, [
      el('h3', { class: 'h3 mb-3', style: 'text-align:center;' }, [t('mash.life-montage-15s')]),
      canvas,
      el('div', { class: 'flex gap-3 mt-4' }, [
        el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => { playing ? stop() : play(); } }, [t('common.play-pause')]),
        el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: async () => {
          // 导出当前帧为图片分享（canvas 截图，复用 share 通路）
          try {
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const file = new File([blob], 'tsd-mash-' + Date.now() + '.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              await navigator.share({ files: [file], title: t('mash.share_title'), text: t('mash.share_text') });
            } else { toast(t('toast.generated_no_share')); }
          } catch (e) {}
        } }, [t('moment.share-frame')]),
      ]),
      el('button', { class: 'btn btn--ghost btn--sm btn--block mt-3', onclick: () => { stop(); closeRitual(overlay); } }, [t('common.close')]),
      el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('mash.ref-1se')]),
    ]));

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    // 自动播放（reduced-motion 用户只显示第一帧，不自动轮播——守 a11y）
    if (prefersReducedMotion()) drawFrame(0); else setTimeout(play, 100);
  }

  // canvas 文本换行
  function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
    const chars = text.split('');
    let line = '', lineCount = 0;
    for (let i = 0; i < chars.length; i++) {
      const test = line + chars[i];
      if (ctx.measureText(test).width > maxWidth && line) {
        ctx.fillText(line, x, y + lineCount * lineHeight);
        line = chars[i]; lineCount++;
        if (lineCount > 2) break; // 最多 3 行
      } else { line = test; }
    }
    if (lineCount <= 2) ctx.fillText(line, x, y + lineCount * lineHeight);
  }

  // ============================================================
  // 视图：invite 礼物式推荐（C-F · 用户自写邀请，零奖励）
  // ============================================================
  route('invite', ({ view, navigate }) => {
    view.appendChild(el('div', {}, [
      el('div', { class: 'flex items-center justify-between mb-4' }, [el('button', { class: 'btn btn--sm btn--ghost', onclick: () => history.back() }, [t('moment.back')])]),
      el('h2', { class: 'h2 mb-2' }, [t('invite.give-tsd')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;' }, [t('invite.real-gift')]),
      el('textarea', { id: 'invite-text', placeholder: t('invite.placeholder'), style: 'width:100%;min-height:100px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:15px;font-family:var(--font-serif);resize:none;margin-bottom:16px;' }),
      el('div', { id: 'invite-preview', class: 'mb-4' }),
      el('button', { class: 'btn btn--primary btn--block', onclick: async () => {
        const invText = ($('#invite-text', view) ? $('#invite-text', view).value.trim() : '') || t('invite.default_text');
        const c = renderInviteCard(invText); const blob = await new Promise(res => c.toBlob(res, 'image/png'));
        const file = new File([blob], 'tsd-invite-' + Date.now() + '.png', { type: 'image/png' });
        haptic('success');
        if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: t('invite.share_title'), text: invText }); return; } catch (e) {} }
        const a = el('a', { href: URL.createObjectURL(blob), download: file.name }); document.body.appendChild(a); a.click(); a.remove(); toast(t('toast.invite_saved'));
      } }, [t('invite.generate-invite-card')]),
      el('p', { class: 'muted mt-4', style: 'font-size:11px;text-align:center;' }, [t('invite.zero_reward_note')]),
    ]));
    const rerender = () => { const invText = ($('#invite-text', view) ? $('#invite-text', view).value.trim() : '') || t('invite.default_text'); const box = $('#invite-preview', view); if (box) { box.innerHTML = ''; box.appendChild(el('img', { src: renderInviteCard(invText).toDataURL('image/png'), style: 'width:100%;border-radius:14px;' })); } };
    $('#invite-text', view).addEventListener('input', rerender);
    rerender();
  });

  // ---------- 分享 sheet ----------
  // canvas 中文按字符换行
  function canvasWrap(ctx, text, x, y, maxW, lh) {
    let line = '', cy = y;
    for (const ch of text) {
      if (ctx.measureText(line + ch).width > maxW && line) { ctx.fillText(line, x, cy); line = ch; cy += lh; }
      else line += ch;
    }
    if (line) ctx.fillText(line, x, cy);
    return cy;
  }
  // 渲染可分享"重逢卡"（1080×1350 社交肖像 · 深色旷野美学 · 原则7：分享成品非 Feed）
  function renderRevisitCard(m, revs) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16161e'); g.addColorStop(1, '#0b0b11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d8c9a0'; ctx.textAlign = 'left'; ctx.font = '600 28px "PingFang SC",sans-serif';
    ctx.fillText(t('canvas.revisit_brand'), 88, 120);
    if (revs.length) { ctx.textAlign = 'right'; ctx.font = '500 26px "PingFang SC",sans-serif'; ctx.fillText(t('canvas.revisit_count', {n: revs.length}), W - 88, 120); }
    ctx.fillStyle = '#ece8df'; ctx.textAlign = 'left'; ctx.font = '44px "Songti SC","STSong","PingFang SC",serif';
    let endY = canvasWrap(ctx, '"' + m.quote + '"', 88, 480, W - 176, 70);
    const last = revs.length ? revs[revs.length - 1].feeling : '';
    if (last && last.trim()) { ctx.fillStyle = '#a39d92'; ctx.font = 'italic 30px "PingFang SC",serif'; endY = canvasWrap(ctx, t('canvas.seeing_again') + last, 88, endY + 72, W - 176, 50); }
    ctx.fillStyle = '#6a655c'; ctx.font = '24px "PingFang SC",sans-serif'; ctx.textAlign = 'left';
    ctx.fillText(fmtWhen(m.when), 88, H - 130);
    ctx.fillStyle = '#9a7f3a'; ctx.font = '500 26px "PingFang SC",sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(t('canvas.tagline'), W - 88, H - 130);
    return c;
  }
  // 分享/保存重逢卡：优先 Web Share（文件 → Instagram/微信/系统分享），降级下载
  async function shareRevisitCard(m, revs) {
    const canvas = renderRevisitCard(m, revs);
    const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
    const file = new File([blob], 'tsd-revisit-' + Date.now() + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: t('canvas.reunion_share_title'), text: t('canvas.reunion_share_text', {quote: m.quote, n: revs.length}) }); return; }
      catch (e) { /* 取消 */ }
    }
    const a = el('a', { href: URL.createObjectURL(blob), download: file.name }); document.body.appendChild(a); a.click(); a.remove();
    toast(t('toast.reunion_saved'));
  }
  // 重逢报告 stat 卡（C-D）：大数字/词 + label，居中，可分享 PNG
  function renderStatCard(headline, label) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#16161e'); g.addColorStop(1, '#0b0b11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d8c9a0'; ctx.font = '600 28px "PingFang SC",sans-serif'; ctx.textAlign = 'left'; ctx.fillText(t('canvas.reunion_brand'), 88, 120);
    ctx.textAlign = 'center'; ctx.fillStyle = '#ece8df'; ctx.font = 'bold 140px "PingFang SC",sans-serif';
    ctx.fillText(String(headline), W / 2, H / 2 - 20);
    ctx.fillStyle = '#a39d92'; ctx.font = '32px "PingFang SC",serif';
    ctx.fillText(label, W / 2, H / 2 + 90);
    ctx.fillStyle = '#9a7f3a'; ctx.font = '500 24px "PingFang SC",sans-serif'; ctx.fillText(t('canvas.tagline'), W / 2, H - 130);
    return c;
  }
  async function shareStatCard(headline, label) {
    const c = renderStatCard(headline, label);
    const blob = await new Promise(res => c.toBlob(res, 'image/png'));
    const file = new File([blob], 'tsd-report-' + Date.now() + '.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: t('canvas.report_brand') }); return; } catch (e) {} }
    const a = el('a', { href: URL.createObjectURL(blob), download: file.name }); document.body.appendChild(a); a.click(); a.remove(); toast(t('toast.report_saved'));
  }
  // 讲给一个人：信物卡（C-B · 二元具名，雾蓝→陶土亲密美学，区别于重逢卡的旷野深色）
  function renderGiftCard(m, recipient) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#2a2d3a'); g.addColorStop(1, '#3a2e2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    const initial = ((recipient || t('canvas.default_recipient')).trim().charAt(0)) || t('canvas.default_recipient');
    ctx.beginPath(); ctx.arc(W / 2, 300, 92, 0, Math.PI * 2); ctx.fillStyle = 'rgba(216,201,160,.16)'; ctx.fill();
    ctx.fillStyle = '#d8c9a0'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '600 74px "PingFang SC",serif';
    ctx.fillText(initial, W / 2, 302);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.fillStyle = '#ece8df'; ctx.font = '40px "Songti SC","PingFang SC",serif';
    let endY = canvasWrap(ctx, '"' + m.quote + '"', 110, 560, W - 220, 62);
    ctx.textAlign = 'center'; ctx.fillStyle = '#a39d92'; ctx.font = '26px "PingFang SC",serif';
    ctx.fillText(t('canvas.gift_to', {name: (recipient || t('canvas.default_recipient'))}), W / 2, endY + 80);
    ctx.fillStyle = '#9a7f3a'; ctx.font = '500 22px "PingFang SC",sans-serif';
    ctx.fillText(t('canvas.gift_brand'), W / 2, H - 130);
    return c;
  }
  function openTellOneSheet(m) {
    const previewSlot = el('div', { class: 'mb-4' });
    const nameInput = el('input', { id: 'gift-recipient', placeholder: t('invite.recipient_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;text-align:center;font-size:15px;' });
    const rerender = () => {
      const name = ($('#gift-recipient') ? $('#gift-recipient').value.trim() : '') || t('canvas.default_recipient');
      previewSlot.innerHTML = '';
      previewSlot.appendChild(el('img', { src: renderGiftCard(m, name).toDataURL('image/png'), style: 'width:100%;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.45);', alt: t('invite.gift_card_alt') }));
    };
    nameInput.addEventListener('input', rerender);
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('invite.tell-one-person')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;' }, [t('invite.gift-not-message')]),
      nameInput, previewSlot,
      el('button', { class: 'btn btn--primary btn--block mt-3', onclick: async () => {
        const name = ($('#gift-recipient') ? $('#gift-recipient').value.trim() : '') || t('canvas.default_recipient');
        const c = renderGiftCard(m, name); const blob = await new Promise(res => c.toBlob(res, 'image/png'));
        const file = new File([blob], 'tsd-gift-' + Date.now() + '.png', { type: 'image/png' });
        haptic('success');
        if (navigator.canShare && navigator.canShare({ files: [file] })) { try { await navigator.share({ files: [file], title: t('invite.gift_share_title'), text: t('invite.gift_share_text') }); return; } catch (e) {} }
        const a = el('a', { href: URL.createObjectURL(blob), download: file.name }); document.body.appendChild(a); a.click(); a.remove(); toast(t('toast.gift_saved'));
      } }, [t('invite.generate-gift-card')]),
      el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('invite.narrow-cast')]),
    ]);
    sheet(content);
    rerender();
  }
  // 礼物式推荐邀请卡（C-F · 用户自写文案，零奖励）
  function renderInviteCard(userText) {
    const W = 1080, H = 1350, c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1a1a22'); g.addColorStop(1, '#0b0b11');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#d8c9a0'; ctx.font = '600 28px "PingFang SC",sans-serif'; ctx.textAlign = 'left'; ctx.fillText(t('canvas.letter_brand'), 88, 120);
    ctx.textAlign = 'left'; ctx.fillStyle = '#ece8df'; ctx.font = '40px "Songti SC","PingFang SC",serif';
    canvasWrap(ctx, '"' + userText + '"', 88, 560, W - 176, 62);
    ctx.textAlign = 'center'; ctx.fillStyle = '#9a7f3a'; ctx.font = '500 26px "PingFang SC",sans-serif';
    ctx.fillText(t('canvas.invite_brand'), W / 2, H - 130);
    return c;
  }

  // Shared Grove 信物导出 sheet（把这个瞬间打包成可分享的紧凑数据给 ta）
  // 守原则7：1:1 二元；守隐私最小化：不带定位/人物原名
  function openGroveGiftSheet(m) {
    const g = TSD.getGrove();
    const gift = TSD.exportGroveGift(m.id);
    const giftText = gift ? JSON.stringify(gift) : '';
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('grove.grove-for-them')]),
      !g.paired ? el('p', { class: 'muted mb-3', style: 'font-size:13px;line-height:1.6;' }, [t('grove.no-grove-yet')]) : el('p', { class: 'muted mb-3', style: 'font-size:13px;line-height:1.6;' }, [t('grove.send_as_gift', {name: g.partnerName})]),
      el('div', { class: 'card mb-3', style: 'background:var(--bg-elev);' }, [
        el('div', { class: 'serif', style: 'font-size:14px;line-height:1.5;color:var(--fg);margin-bottom:6px;' }, ['"' + (m.quote || '') + '"']),
        el('div', { class: 'muted', style: 'font-size:11px;' }, [t('invite.gift-content-rule')]),
      ]),
      g.paired ? el('div', {}, [
        el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:6px;' }, [t('grove.copy_hint', {name: g.partnerName})]),
        el('textarea', { readonly: '', style: 'width:100%;min-height:80px;padding:10px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;font-size:10px;resize:none;font-family:var(--font-mono);color:var(--fg-mute);' }, [giftText]),
        el('div', { class: 'flex gap-3 mt-3' }, [
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: async () => {
            try { await navigator.clipboard.writeText(giftText); toast(t('toast.gift_copied', {name: g.partnerName})); }
            catch (e) { toast(t('toast.copy_failed')); }
          } }, [t('invite.copy-gift')]),
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: async () => {
            if (navigator.share) { try { await navigator.share({ title: t('grove.share_title'), text: giftText }); } catch (e) {} }
            else { try { await navigator.clipboard.writeText(giftText); toast(t('toast.copied_no_share')); } catch (e) {} }
          } }, [t('common.system-share')]),
        ]),
      ]) : el('button', { class: 'btn btn--primary btn--block', onclick: () => { sheet_close(); location.hash = 'grove'; } }, [t('grove.go-establish')]),
      el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('common.principle-7')]),
    ]);
    const overlay = sheet(content);
    const sheet_close = () => { if (overlay && overlay._close) overlay._close(); };
  }

  function openShareSheet(m, revs, navigate) {
    const cardSlot = el('div', { id: 'share-card-slot', class: 'mb-4' });
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('moment.share')]),
      cardSlot,
      el('div', { class: 'section-title' }, [t('settings.privacy-tiers')]),
      el('div', { class: 'card' }, [
        el('div', { class: 'setting-row', onclick: () => toast(t('toast.private_note')) }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('share.tell_one_title')]), el('div', { class: 'setting-row__sub' }, [t('share.tell_one_sub')])]), el('span', { class: 'chip chip--accent' }, [t('share.private_chip')])]),
        el('div', { class: 'setting-row', onclick: () => toast(t('toast.public_hidden')) }, [el('div', { class: 'setting-row__main' }, [el('div', { class: 'setting-row__title' }, [t('share.landscape_title')]), el('div', { class: 'setting-row__sub' }, [t('share.landscape_sub')])]), el('span', { class: 'chip' }, [t('share.public_chip')])]),
      ]),
      el('button', { class: 'btn btn--primary btn--block mt-4', onclick: () => shareRevisitCard(m, revs) }, [t('revisit.generate-reunion-card')]),
      el('button', { class: 'btn btn--ghost btn--block mt-3', onclick: () => {
        const text = t('share.text_template', {quote: m.quote, n: revs.length});
        navigator.clipboard.writeText(text).then(() => toast(t('toast.text_copied')));
      } }, [t('common.copy-text-only')]),
      el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('invite.share-not-feed')]),
    ]);
    const s = sheet(content);
    const cv = renderRevisitCard(m, revs);
    cardSlot.appendChild(el('img', { src: cv.toDataURL('image/png'), style: 'width:100%;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.45);', alt: t('share.reunion_alt') }));
    return s;
  }

  // ---------- 编辑瞬间 sheet（商品级必需：用户能改正文/人物/地点/类型/时间）----------
  // 守"AI 不改写过去"铁律：这里是用户亲自改，非 AI 改；保留 createdAt，不改 id。
  function openEditMomentSheet(m, navigate) {
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('moment.edit')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.5;' }, [t('ai.your-edit-not-ai')]),
      el('label', { class: 'field-label' }, [t('moment.original-words')]),
      el('textarea', { id: 'edit-quote', style: 'width:100%;min-height:90px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:15px;font-family:var(--font-serif);resize:none;margin-bottom:16px;' }, [m.quote]),
      el('label', { class: 'field-label' }, [t('moment.people-field')]),
      el('input', { id: 'edit-people', value: (m.people || []).join(', '), placeholder: t('edit.people_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;' }),
      el('label', { class: 'field-label' }, [t('moment.place')]),
      el('input', { id: 'edit-place', value: m.place || '', placeholder: t('edit.place_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;' }),
      el('label', { class: 'field-label' }, [t('revisit.back-then')]),
      el('input', { id: 'edit-when', value: (m.when && m.when.text) || '', placeholder: t('edit.when_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;' }),
      el('label', { class: 'field-label' }, [t('common.type')]),
      el('div', { class: 'flex gap-2 mb-4', id: 'edit-kind' }, [
        ...[['grass', t('kind.grass')],['bloom', t('kind.bloom')],['night', t('kind.night')]].map(([k, l]) =>
          el('button', { class: 'chip' + (m.kind === k ? ' chip--' + (k === 'bloom' ? 'bloom' : k === 'night' ? 'night' : 'growth') : ''), 'data-k': k, onclick: (e) => {
            $$('#edit-kind .chip').forEach(c => { c.className = 'chip'; });
            e.target.className = 'chip chip--' + (k === 'bloom' ? 'bloom' : k === 'night' ? 'night' : 'growth');
          } }, [l]))
      ]),
      el('div', { class: 'flex gap-3' }, [
        el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => { const s = document.querySelector('.sheet'); if (s && s._close) s._close(); } }, [t('common.cancel')]),
        el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
          const quote = $('#edit-quote').value.trim();
          if (!quote) { toast(t('toast.quote_empty')); return; }
          const people = $('#edit-people').value.split(',').map(s => s.trim()).filter(Boolean);
          const place = $('#edit-place').value.trim() || null;
          const whenText = $('#edit-when').value.trim();
          const kindEl = $$('#edit-kind .chip').find(c => c.className.includes('chip--'));
          const kind = kindEl ? kindEl.getAttribute('data-k') : m.kind;
          const patch = { quote, people, place, kind };
          if (whenText) patch.when = Object.assign({}, m.when, { text: whenText });
          TSD.updateMoment(m.id, patch);
          // 记录 AI 任务账本（T0 结构抽取：用户手工修订视为本地结构更新）
          TSD.logAiTask({ type: 'T0', payload: { action: 'user_edit', momentId: m.id }, result: t('revisit.t0_user_edit_result'), localOnly: true });
          haptic('success');
          toast(t('toast.moment_updated'));
          const s = document.querySelector('.sheet'); if (s && s._close) s._close();
          navigate('moment/' + m.id);
        } }, [t('common.save')]),
      ]),
    ]);
    sheet(content);
  }

  // ---------- 删除瞬间 sheet（商品级必需：二次确认 + 会话内撤销墓碑）----------
  function openDeleteMomentSheet(m, navigate) {
    const revCount = TSD.getRevisitCount(m.id);
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3', style: 'color:var(--danger);' }, [t('moment.delete')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;' }, [
        t('delete.warning_line'), el('strong', { style: 'color:var(--fg);' }, [String(revCount)]), t('delete.warning_revisits'),
        el('br'), t('delete.warning_undo'),
      ]),
      el('div', { class: 'serif', style: 'font-size:15px;color:var(--fg-soft);background:var(--bg-elev);padding:14px;border-radius:12px;margin-bottom:16px;line-height:1.5;' }, ['"' + m.quote + '"']),
      el('div', { class: 'flex gap-3' }, [
        el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => { const s = document.querySelector('.sheet'); if (s && s._close) s._close(); } }, [t('common.keep')]),
        el('button', { class: 'btn btn--lg', style: 'flex:1;background:var(--danger);color:#fff;border:none;', onclick: () => {
          TSD.deleteMoment(m.id);
          haptic('impact');
          const s = document.querySelector('.sheet'); if (s && s._close) s._close();
          const t = el('div', { class: 'toast toast--undo is-show', role: 'status', 'aria-live': 'polite' }, [
            el('span', {}, [t('moment.deleted')]),
            el('button', { class: 'btn btn--sm', style: 'color:var(--accent);background:transparent;border:none;font-size:13px;font-weight:600;', onclick: () => {
              if (TSD.restoreDeletedMoment()) { toast(t('toast.restored_moment')); navigate('moment/' + m.id); }
              else toast(t('toast.restore_failed')); t.remove();
            } }, [t('common.undo')]),
          ]);
          document.body.appendChild(t);
          setTimeout(() => t.remove(), 5500);
          navigate('today');
        } }, [t('common.confirm-delete')]),
      ]),
    ]);
    sheet(content);
  }

  // ---------- 试用指南 sheet ----------
  function openTrialGuide(navigate) {
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('onboarding.trial-guide-3min')]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;' }, [t('onboarding.step1-today-echo')]),
        el('p', { class: 'muted', style: 'font-size:13px;' }, [t('today.home-screen-echo')]),
      ]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;' }, [t('onboarding.step2-revisit')]),
        el('p', { class: 'muted', style: 'font-size:13px;' }, [t('voice.timed-10s')]),
      ]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;' }, [t('onboarding.step3-revisit-map')]),
        el('p', { class: 'muted', style: 'font-size:13px;' }, [t('report.back-to-home')]),
      ]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;' }, [t('onboarding.step4-three-month')]),
        el('p', { class: 'muted', style: 'font-size:13px;' }, [t('report.revisit-visualization')]),
      ]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;' }, [t('onboarding.step5-wilderness-ai')]),
        el('p', { class: 'muted', style: 'font-size:13px;' }, [t('report.life-grid-ai-ledger')]),
      ]),
      el('div', { class: 'section-title' }, [t('settings.production-boundary')]),
      el('p', { class: 'muted', style: 'font-size:12px;' }, [t('settings.demo_disclaimer')]),
    ]);
    sheet(content);
  }

  // 把 TSD 放到主屏幕（Finch 式活体存在引导）
  // 安装后 home-screen 图标会有 badge 安静点（今天有旧瞬间想见你时）
  function openInstallGuide(navigate) {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('settings.put-on-home-screen')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;' }, [
        t('install.intro_1'),
        el('br'), t('install.intro_2'),
      ]),
      // 安装按钮（Android Chromium 支持 beforeinstallprompt）
      window.__tsdInstallPrompt ? el('button', { class: 'btn btn--primary btn--lg btn--block mb-4', onclick: async () => {
        const ev = window.__tsdInstallPrompt;
        ev.prompt();
        try { await ev.userChoice; } catch (e) {}
        window.__tsdInstallPrompt = null;
        toast(t('toast.added_to_home'));
      } }, [t('settings.install-home-screen')]) : null,
      // iOS 手动引导
      isIOS ? el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;margin-bottom:8px;' }, [t('onboarding.ios-two-steps')]),
        el('p', { class: 'muted', style: 'font-size:13px;line-height:1.6;' }, [
          t('install.ios_step_1'), el('strong', {}, [t('install.ios_share')]), t('install.ios_step_1_suffix'), el('span', { style: 'font-size:16px;' }, [' ⎋ ']),
          el('br'), t('install.ios_step_2'), el('strong', {}, [t('install.ios_add_home')]),
        ]),
      ]) : null,
      // Android 手动引导
      isAndroid && !window.__tsdInstallPrompt ? el('div', { class: 'card mb-3' }, [
        el('div', { class: 'h3', style: 'font-size:14px;margin-bottom:8px;' }, [t('onboarding.android-browser-menu')]),
        el('p', { class: 'muted', style: 'font-size:13px;line-height:1.6;' }, [t('onboarding.browser-menu-steps')]),
      ]) : null,
      el('div', { class: 'card mb-3', style: 'background:var(--bg-elev);' }, [
        el('div', { class: 'h3', style: 'font-size:14px;margin-bottom:6px;' }, [t('onboarding.after-install')]),
        el('div', { class: 'muted', style: 'font-size:12px;line-height:1.6;' }, [
          t('install.after_1'),
          el('br'), t('install.after_2'),
          el('br'), t('install.after_3'),
        ]),
      ]),
      el('p', { class: 'muted', style: 'font-size:11px;text-align:center;' }, [t('install.widget_note')]),
    ]);
    sheet(content);
  }

  // ============================================================
  // 语音捕获（Stoic/Rosebud/Day One 式 · 情感密度最高）
  // 回访后"按住录 5 秒"附到瞬间；未来回访 echo 卡自动播 2s 片段。
  // 守原则5：可选不强制；守原则9：限时 5s，不延长会话。
  // MediaRecorder API (PWA) + Capacitor Audio (native)；存储 base64 入 IndexedDB。
  // ============================================================
  function openVoiceCaptureSheet(momentId) {
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const content = el('div', { class: 'feeling-tag__content' });
    let mediaRecorder = null;
    let chunks = [];
    let stream = null;
    let startTime = 0;
    let recording = false;

    const render = (state, audioUrl, durationMs) => {
      content.innerHTML = '';
      const children = [
        el('div', { style: 'font-size:32px;margin-bottom:8px;text-align:center;' }, ['🎙']),
        el('h3', { class: 'h3 mb-2', style: 'text-align:center;' }, [t('voice.record-for-moment')]),
      ];
      if (state === 'idle') {
        children.push(el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;text-align:center;' }, [
          t('voice.idle_hint_1'), el('br'),
          t('voice.idle_hint_2'),
        ]));
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          children.push(el('p', { class: 'muted', style: 'font-size:12px;text-align:center;color:var(--danger);' }, [t('voice.record-unsupported')]));
        }
        children.push(el('button', { class: 'btn btn--primary btn--lg btn--block mt-4', id: 'rec-btn', onclick: startRec }, [t('voice.start-record')]));
        children.push(el('button', { class: 'btn btn--ghost btn--sm btn--block mt-3', onclick: () => closeRitual(overlay) }, [t('common.skip')]));
      } else if (state === 'recording') {
        children.push(el('div', { class: 'voice-pulse' }, ['●']));
        children.push(el('div', { class: 'nums', style: 'font-size:32px;color:var(--accent);text-align:center;margin:12px 0;', id: 'rec-timer' }, ['5']));
        children.push(el('p', { class: 'muted', style: 'font-size:12px;text-align:center;' }, [t('voice.recording')]));
        children.push(el('button', { class: 'btn btn--ghost btn--lg btn--block mt-3', onclick: stopRec }, [t('common.stop')]));
      } else if (state === 'done') {
        children.push(el('p', { class: 'muted mb-3', style: 'font-size:13px;text-align:center;' }, [t('voice.recorded-listen')]));
        children.push(el('audio', { controls: '', src: audioUrl, style: 'width:100%;margin-bottom:12px;' }));
        children.push(el('div', { class: 'flex gap-3' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => { resetRec(); render('idle'); } }, [t('voice.re-record')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: async () => {
            try {
              const dataUrl = await blobToDataUrl(audioUrl);
              TSD.setMomentAudio(momentId, dataUrl, durationMs);
              haptic('success');
              toast(t('toast.voice_saved'));
            } catch (e) { toast(t('toast.storage_failed')); }
            closeRitual(overlay);
          } }, [t('common.hold-on')]),
        ]));
      }
      content.appendChild(el('div', {}, children));
    };

    const startRec = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        chunks = [];
        const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
        mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
        mediaRecorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
        mediaRecorder.onstop = () => {
          const blob = new Blob(chunks, { type: mime || 'audio/webm' });
          const url = URL.createObjectURL(blob);
          const durationMs = Date.now() - startTime;
          if (stream) stream.getTracks().forEach(t => t.stop());
          recording = false;
          render('done', url, durationMs);
        };
        mediaRecorder.start();
        recording = true;
        startTime = Date.now();
        render('recording');
        let left = 5;
        setRouteTimer(setInterval(() => {
          left--;
          const t = $('#rec-timer', content);
          if (t) t.textContent = String(Math.max(left, 0));
          if (left <= 0) { clearRouteTimer(); stopRec(); }
        }, 1000));
      } catch (e) {
        toast(t('toast.mic_denied'));
        closeRitual(overlay);
      }
    };
    const stopRec = () => {
      clearRouteTimer();
      if (mediaRecorder && recording) { recording = false; mediaRecorder.stop(); }
    };
    const resetRec = () => {
      if (stream) stream.getTracks().forEach(t => t.stop());
      chunks = []; mediaRecorder = null;
    };

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    render('idle');
  }

  // blob → dataURL（base64，存 IndexedDB）
  function blobToDataUrl(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onloadend = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

  // iOS 触觉反馈（沉浸锚点）：native 下 Capacitor 注入 Haptics，web 静默降级
  function haptic(kind) {
    try {
      const H = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Haptics;
      if (!H) return;
      if (kind === 'success') H.notification({ type: 'SUCCESS' });
      else if (kind === 'warning') H.notification({ type: 'WARNING' });
      else H.impact({ style: 'LIGHT' });
    } catch (e) {}
  }

  // 回访日历热力图（Stoic/Day One 式 · 近 8 周回访密度可视化）
  function revisitHeatmap() {
    const now = new Date(); now.setHours(0,0,0,0);
    const todayMs = now.getTime();
    const dayMs = 86400000;
    // 构建近 56 天（8 周）的日历
    const days = [];
    for (let i = 55; i >= 0; i--) {
      const dayStart = todayMs - i * dayMs;
      const dayEnd = dayStart + dayMs;
      const count = TSD.raw().revisits.filter(r => r.at >= dayStart && r.at < dayEnd).length;
      days.push({ dayStart, count, isToday: i === 0 });
    }
    // 渲染：7 列 × 8 行（周一→周日，8 周）
    const weekDays = [t('cal.mon'), t('cal.tue'), t('cal.wed'), t('cal.thu'), t('cal.fri'), t('cal.sat'), t('cal.sun')];
    // 调整到周一开始
    const firstDay = new Date(days[0].dayStart);
    const offset = (firstDay.getDay() + 6) % 7; // 0=Mon
    const grid = [];
    // 填充前面的空白
    for (let i = 0; i < offset; i++) grid.push(null);
    days.forEach(d => grid.push(d));

    const maxCount = Math.max(...days.map(d => d.count), 1);
    const cellColor = (count) => {
      if (!count && count !== 0) return 'background:transparent;';
      if (count === 0) return 'background:var(--bg-elev-2);';
      const intensity = Math.min(count / maxCount, 1);
      if (intensity < 0.33) return 'background:rgba(240,178,136,.25);';
      if (intensity < 0.66) return 'background:rgba(240,178,136,.5);';
      return 'background:var(--accent);';
    };

    return el('div', { class: 'card' }, [
      el('div', { style: 'display:flex;gap:2px;font-size:11px;color:var(--fg-mute);margin-bottom:6px;' }, weekDays.map(w =>
        el('div', { style: 'flex:1;text-align:center;' }, [w])
      )),
      el('div', { style: 'display:grid;grid-template-columns:repeat(7,1fr);gap:3px;' },
        grid.map(d => {
          if (!d) return el('div', { style: 'aspect-ratio:1;border-radius:3px;' });
          const dateStr = new Date(d.dayStart).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
          return el('div', {
            style: 'aspect-ratio:1;border-radius:3px;' + cellColor(d.count) + (d.isToday ? 'outline:2px solid var(--accent);outline-offset:1px;' : ''),
            title: t('cal.heatmap_title', {date: dateStr, n: d.count}),
          });
        })
      ),
      el('div', { style: 'display:flex;align-items:center;gap:6px;margin-top:10px;justify-content:flex-end;' }, [
        el('div', { class: 'muted', style: 'font-size:10px;' }, [t('cal.less')]),
        el('div', { style: 'width:10px;height:10px;border-radius:2px;background:var(--bg-elev-2);' }),
        el('div', { style: 'width:10px;height:10px;border-radius:2px;background:rgba(240,178,136,.25);' }),
        el('div', { style: 'width:10px;height:10px;border-radius:2px;background:rgba(240,178,136,.5);' }),
        el('div', { style: 'width:10px;height:10px;border-radius:2px;background:var(--accent);' }),
        el('div', { class: 'muted', style: 'font-size:10px;' }, [t('cal.more')]),
      ]),
    ]);
  }

  // 感受天气图（Stoic 式情绪分布可视化 · 横条 bar chart，不排名只展示分布）
  function feelingWeatherChart(freq) {
    const entries = Object.entries(freq).sort((a, b) => b[1] - a[1]);
    const max = entries[0][1];
    const colors = ['var(--accent)', 'var(--growth)', 'var(--bloom)', 'var(--night)', 'var(--fg-soft)'];
    return el('div', {}, entries.map(([tag, count], i) =>
      el('div', { style: 'display:flex;align-items:center;gap:10px;margin-bottom:10px;' }, [
        el('div', { style: 'flex:1;font-size:13px;font-family:var(--font-serif);color:var(--fg-soft);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;' }, [tag]),
        el('div', { style: 'width:' + Math.max(20, (count / max) * 100) + '%;height:8px;border-radius:4px;background:' + colors[i % colors.length] + ';transition:width .5s var(--ease);flex-shrink:0;' }),
        el('div', { class: 'nums', style: 'font-size:11px;color:var(--fg-faint);width:20px;text-align:right;flex-shrink:0;' }, [String(count)]),
      ])
    ));
  }

  // 4p "我也是"感受标签微仪式（病毒侧锚点C · 最小暴露面分享抽象感受）
  // 触发：回访追加非空感受后，在 peakEndRitual 前插入可跳过的"给感受起个名字"
  // 守原则5：完全可选可跳过、不展示完成率；守原则9：不增加会话总时长；守原则7：分享成品非 Feed
  function feelingTagRitual(momentId, feeling, navigate) {
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const tags = TSD.FEELING_TAGS;
    let selectedTag = null;

    const tagChips = el('div', { class: 'feeling-tag__chips' }, tags.map(t =>
      el('button', { class: 'feeling-tag__chip', onclick: (e) => {
        $$('.feeling-tag__chip', overlay).forEach(c => c.classList.remove('is-selected'));
        e.target.classList.add('is-selected');
        selectedTag = t;
        haptic('impact');
      } }, [t])
    ));

    const customInput = el('input', {
      id: 'feeling-tag-custom',
      placeholder: t('feeling.custom_placeholder'),
      class: 'feeling-tag__input',
      oninput: () => {
        // 自写时取消预设选中
        if (customInput.value.trim()) {
          $$('.feeling-tag__chip', overlay).forEach(c => c.classList.remove('is-selected'));
          selectedTag = null;
        }
      },
    });

    const previewSlot = el('div', { class: 'feeling-tag__preview' });
    const rerenderPreview = () => {
      const tag = customInput.value.trim() || selectedTag;
      previewSlot.innerHTML = '';
      if (tag) {
        previewSlot.appendChild(el('img', { src: renderFeelingCard(tag).toDataURL('image/png'), style: 'width:100%;border-radius:14px;box-shadow:0 8px 30px rgba(0,0,0,.45);', alt: t('feeling.card_alt') }));
      }
    };
    customInput.addEventListener('input', rerenderPreview);
    // 预设 chip 选中时也刷新预览
    const origOnclicks = tags.map((t, i) => {
      const chip = tagChips.children[i];
      const orig = chip.onclick;
      chip.onclick = (e) => { orig(e); customInput.value = ''; rerenderPreview(); };
    });

    overlay.appendChild(el('div', { class: 'feeling-tag__content' }, [
      el('div', { style: 'font-size:32px;margin-bottom:12px;' }, ['≋']),
      el('h3', { class: 'h3 mb-3', style: 'text-align:center;' }, [t('moment.name-feeling')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;text-align:center;' }, [t('moment.feeling-card-hint')]),
      tagChips,
      customInput,
      previewSlot,
      el('div', { class: 'flex gap-3 mt-4' }, [
        el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => {
          // 跳过 → 不存标签，直接 peakEnd
          TSD.addRevisit(momentId, feeling);
          finishRevisit(navigate);
          closeRitual(overlay);
        } }, [t('common.skip')]),
        el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: async () => {
          const tag = customInput.value.trim() || selectedTag;
          TSD.addRevisit(momentId, feeling, tag);
          haptic('success');
          // 有标签 → 可选分享感受卡
          if (tag) {
            const canvas = renderFeelingCard(tag);
            const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
            const file = new File([blob], 'tsd-feeling-' + Date.now() + '.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              try { await navigator.share({ files: [file], title: t('canvas.me_too'), text: t('canvas.me_too_share_text', {tag: tag}) }); } catch (e) { /* 取消 */ }
            }
          }
          finishRevisit(navigate);
          closeRitual(overlay);
        } }, [selectedTag || customInput.value.trim() ? t('feeling.share_btn') : t('feeling.done_btn')]),
      ]),
      el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('moment.feeling-card-privacy')]),
      // Emotion Grid 入口：想更精细地标此刻情绪（144 词象限 · Yale Mood Meter）
      // 守原则5：可选、独立于分享词库；点了进入象限网格
      el('button', { class: 'btn btn--ghost btn--sm btn--block mt-3', onclick: () => {
        closeRitual(overlay);
        openEmotionGridSheet(momentId, feeling, navigate);
      } }, [t('moment.fine-grain-emotion')]),
    ]));

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
  }

  function closeRitual(overlay) {
    overlay.classList.remove('is-in');
    setTimeout(() => overlay.remove(), 320);
  }

  function finishRevisit(navigate) {
    const neu = TSD.checkAchievements();
    const qm = TSD.raw().settings && TSD.raw().settings.quietMode;
    haptic(neu.length && !qm ? 'success' : 'impact');
    // 推送 hook（Fogg Spark）：回访完成后调度明天的回声提醒（原生壳内生效，web 静默）
    if (typeof PushHook !== 'undefined' && PushHook.isNative() && TSD.raw().notifications) {
      PushHook.checkGraduation().then(status => {
        if (status === 'active') PushHook.scheduleTomorrowEcho();
      });
    }
    // Widget badge 清除（今天已重逢 → home-screen 图标点消失）
    if (typeof WidgetBadge !== 'undefined') WidgetBadge.sync();
    peakEndRitual(t('revisit.ritual_keep'), neu.length && !qm ? t('revisit.ritual_sub_imprint') : t('revisit.ritual_sub_thick'), () => navigate('today'));
  }

  // ============================================================
  // Emotion Grid · 情绪粒度网格（How We Feel / Yale Mood Meter 范式）
  // 与 FEELING_TAGS 并存：这里是内省侧的"此刻精细情绪"，非分享词。
  // 守原则5：可选、不推送、不打分；只在用户回访后主动想细标时温和邀请。
  // 守原则9：单次浮出，不延长会话；选完即闭。
  // ============================================================
  function openEmotionGridSheet(momentId, feeling, navigate) {
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const grid = TSD.EMOTION_GRID;
    const quadrants = [
      { key: 'hh', cls: 'emotion-quad--hh' },  // 右上 高昂·明亮
      { key: 'hl', cls: 'emotion-quad--hl' },  // 左上 高涨·紧绷
      { key: 'lh', cls: 'emotion-quad--lh' },  // 右下 低缓·温润
      { key: 'll', cls: 'emotion-quad--ll' },  // 左下 低沉·灰雾
    ];
    let zoomed = null;        // 当前展开的象限 key
    let selectedWord = null;  // 选中的词
    let selectedQuad = null;  // 词所在象限

    const content = el('div', { class: 'feeling-tag__content' }, [
      el('div', { style: 'font-size:32px;margin-bottom:8px;text-align:center;' }, ['◍']),
      el('h3', { class: 'h3 mb-2', style: 'text-align:center;' }, [t('moment.precise-emotion')]),
      el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;text-align:center;' }, [
        t('emotion.intro_1'), el('br'),
        t('emotion.intro_2'),
      ]),
    ]);

    const gridWrap = el('div', { class: 'emotion-grid' });
    const quadEls = {};
    quadrants.forEach(q => {
      const qd = grid[q.key];
      const quadEl = el('button', {
        class: 'emotion-quad ' + q.cls,
        'aria-label': qd.name,
        onclick: (e) => {
          // 展开本象限词库；再次点同一象限则收起
          if (zoomed === q.key) { zoomed = null; }
          else { zoomed = q.key; selectedWord = null; selectedQuad = null; }
          haptic('impact');
          rerender();
        },
      }, [
        el('div', { class: 'emotion-quad__name serif' }, [qd.name]),
        el('div', { class: 'emotion-quad__hint muted' }, [zoomed === q.key ? t('emotion.collapse') : t('emotion.expand')]),
      ]);
      quadEls[q.key] = quadEl;
      gridWrap.appendChild(quadEl);
    });

    const wordSlot = el('div', { class: 'emotion-words mt-4' });
    const selectedSlot = el('div', { class: 'emotion-selected mt-4' });

    const rerender = () => {
      // 重置展开态视觉
      Object.keys(quadEls).forEach(k => {
        quadEls[k].classList.toggle('is-zoom', zoomed === k);
      });
      wordSlot.innerHTML = '';
      selectedSlot.innerHTML = '';
      if (zoomed) {
        const qd = grid[zoomed];
        qd.words.forEach(w => {
          const isSel = (selectedWord === w);
          wordSlot.appendChild(el('button', {
            class: 'feeling-tag__chip' + (isSel ? ' is-selected' : ''),
            onclick: (e) => {
              selectedWord = w; selectedQuad = zoomed;
              haptic('impact');
              rerender();
            },
          }, [w]));
        });
      }
      if (selectedWord) {
        selectedSlot.appendChild(el('div', { class: 'card', style: 'padding:14px;text-align:center;' }, [
          el('div', { class: 'muted', style: 'font-size:11px;margin-bottom:4px;' }, [t('common.selected')]),
          el('div', { class: 'serif', style: 'font-size:18px;color:var(--accent);' }, [selectedWord]),
          el('div', { class: 'muted', style: 'font-size:11px;margin-top:4px;' }, [grid[selectedQuad].name]),
        ]));
      }
    };

    content.appendChild(gridWrap);
    content.appendChild(wordSlot);
    content.appendChild(selectedSlot);
    content.appendChild(el('div', { class: 'flex gap-3 mt-4' }, [
      el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => {
        // 跳过细标，仍记录普通回访 + feeling
        TSD.addRevisit(momentId, feeling);
        finishRevisit(navigate);
        closeRitual(overlay);
      } }, [t('common.skip')]),
      el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
        // 把精细词存进回访 feelingTag 字段（与分享词库同位，但这是内省词）
        TSD.addRevisit(momentId, feeling, selectedWord);
        haptic('success');
        // Moodnotes 式思维陷阱：若落在不愉象限（hl/ll），温和邀请"那是什么陷阱"
        // 守原则5：可选、不推送；点了进 reframe，不点直接结束
        if (selectedWord && (selectedQuad === 'hl' || selectedQuad === 'll')) {
          closeRitual(overlay);
          openThinkingTrapsSheet(momentId, navigate);
        } else {
          finishRevisit(navigate);
          closeRitual(overlay);
        }
      } }, [selectedWord ? t('emotion.keep_layer') : t('emotion.that_way')]),
    ]));
    content.appendChild(el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [
      t('emotion.note'),
    ]));

    overlay.appendChild(content);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
  }

  // ============================================================
  // 对话式回访（Day One Daily Chat / Rosebud / Life Note 范式）
  // TSD 差异化楔子：对话只锚定被带回的旧记忆，不锚定今日日记。
  // 3 题引导微对话，纯本地脚本（不调 LLM，无 key 暴露风险）。
  // 守原则5：AI 只问、用户答、然后结束；无 streak/无评分/无"再来一次"。
  // 守原则9：最后一题可"留半句给明天"——与 Zeigarnik 回路同构。
  // ============================================================
  function openRevisitDialogueSheet(momentId, navigate) {
    const m = TSD.getMoment(momentId);
    if (!m) return;
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const prompts = TSD.REVISIT_DIALOGUE_PROMPTS;
    let step = 0;
    const existing = TSD.getDialogue(momentId);
    const answers = existing ? existing.answers.slice() : [];

    const head = el('div', { class: 'feeling-tag__content' });
    const render = () => {
      head.innerHTML = '';
      if (step >= prompts.length) {
        // 完成 → 进入"我也是"感受标签微仪式（4p 病毒锚点 · 内部会 addRevisit + finishRevisit）
        closeRitual(overlay);
        feelingTagRitual(momentId, '', navigate);
        return;
      }
      const prevAnswers = answers.slice(0, step).filter(Boolean);
      head.appendChild(el('div', {}, [
        el('div', { class: 'muted', style: 'font-size:11px;margin-bottom:6px;' }, [t('dialogue.step_count', {i: (step + 1), n: prompts.length})]),
        el('div', { class: 'serif', style: 'font-size:15px;color:var(--fg-soft);margin-bottom:10px;line-height:1.5;' }, ['"' + (m.quote || '') + '"']),
        // 已答的前题（温柔回显，不压迫）
        prevAnswers.length ? el('div', { class: 'card', style: 'padding:10px;margin-bottom:12px;background:var(--bg-elev);' }, prevAnswers.map((a, i) =>
          el('div', { style: 'font-size:12px;color:var(--fg-mute);margin-bottom:6px;line-height:1.4;' }, [
            el('span', { style: 'color:var(--fg-faint);' }, [t('dialogue.asked') + prompts[i]]),
            el('br'), el('span', { style: 'color:var(--fg-soft);' }, [t('dialogue.answered') + a]),
          ])
        )) : null,
        el('div', { class: 'serif', style: 'font-size:17px;color:var(--fg);line-height:1.55;margin-bottom:14px;' }, [prompts[step]]),
        el('textarea', {
          id: 'dialogue-input',
          placeholder: step === prompts.length - 1 ? t('dialogue.last_placeholder') : t('dialogue.normal_placeholder'),
          style: 'width:100%;min-height:80px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:15px;resize:none;font-family:var(--font-serif);',
        }, answers[step] ? [answers[step]] : []),
        el('div', { class: 'flex gap-3 mt-3' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => {
            TSD.setDialogueAnswer(momentId, step, '');
            step++; render();
          } }, [t('common.skip-line')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
            const v = ($('#dialogue-input', head) || {}).value;
            TSD.setDialogueAnswer(momentId, step, v);
            haptic('impact');
            step++; render();
          } }, [step === prompts.length - 1 ? t('dialogue.keep_half') : t('dialogue.next_line')]),
        ]),
        el('button', { class: 'btn btn--ghost btn--sm btn--block mt-3', onclick: () => { closeRitual(overlay); } }, [t('common.pause-here')]),
      ]));
    };
    overlay.appendChild(head);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    render();
  }

  // ============================================================
  // 与过去自己对话（Life Note 式 · 单轮问答）
  // 本地镜像 fallback：把用户的问题温和"还回去"，引导用户自己回到那一刻。
  // 不伪造原文之外的"事实"。真实 LLM 增强留待后端代理（防 key 暴露）。
  // 守原则5：单轮即关，无持续聊天/无诱导。
  // ============================================================
  function openAskPastSelfSheet(m) {
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const content = el('div', { class: 'feeling-tag__content' });
    const render = (answer) => {
      content.innerHTML = '';
      content.appendChild(el('div', {}, [
        el('div', { style: 'font-size:32px;margin-bottom:8px;text-align:center;' }, ['✦']),
        el('h3', { class: 'h3 mb-2', style: 'text-align:center;' }, [t('revisit.ask-then-self')]),
        el('div', { class: 'serif', style: 'font-size:14px;color:var(--fg-soft);background:var(--bg-elev);padding:14px;border-radius:12px;margin-bottom:16px;line-height:1.55;' }, ['"' + m.quote + '"']),
        !answer ? el('div', {}, [
          el('textarea', {
            id: 'ask-input',
            placeholder: t('ask.placeholder'),
            style: 'width:100%;min-height:70px;padding:14px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:14px;font-size:15px;resize:none;',
          }),
          el('div', { class: 'flex gap-3 mt-3' }, [
            el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => closeRitual(overlay) }, [t('common.never-mind')]),
            el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
              const q = ($('#ask-input', content) || {}).value;
              if (!q || !q.trim()) { toast(t('toast.ask_empty')); return; }
              const ans = TSD.askPastSelf(m.id, q);
              haptic('impact');
              render(ans);
            } }, [t('ask.submit')]),
          ]),
          el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;line-height:1.5;' }, [
            t('ask.local_mirror_1'), el('br'),
            t('ask.local_mirror_2'),
          ]),
        ]) : el('div', {}, [
          el('div', { class: 'serif', style: 'font-size:14px;color:var(--fg-mute);margin-bottom:8px;' }, [t('ask.you_asked', {q: answer.question})]),
          el('div', { class: 'card', style: 'padding:16px;background:var(--bg-elev);' }, [
            el('div', { class: 'muted', style: 'font-size:11px;margin-bottom:6px;' }, [t('revisit.then-self')]),
            el('div', { class: 'serif', style: 'font-size:15px;line-height:1.6;color:var(--fg);' }, ['"' + answer.answer + '"']),
          ]),
          el('button', { class: 'btn btn--primary btn--lg btn--block mt-4', onclick: () => { closeRitual(overlay); } }, [t('common.thats-it')]),
          el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('revisit.exchange-saved-as-imprint')]),
        ]),
      ]));
    };
    overlay.appendChild(content);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    render(null);
  }

  // ============================================================
  // 思维陷阱 / 认知重构选择器（Moodnotes CBT 范式）
  // 仅在用户回访后、情绪落在不愉象限时温和邀请。完全可选、不推送。
  // 守原则5：识别而非诊断；点了加一条 reframe 注解，不点直接结束。
  // ============================================================
  function openThinkingTrapsSheet(momentId, navigate) {
    const overlay = el('div', { class: 'feeling-tag-ritual' });
    const traps = TSD.THINKING_TRAPS;
    let selected = null;
    const head = el('div', { class: 'feeling-tag__content' });
    const rerender = () => {
      head.innerHTML = '';
      head.appendChild(el('div', {}, [
        el('div', { style: 'font-size:32px;margin-bottom:8px;text-align:center;' }, ['◇']),
        el('h3', { class: 'h3 mb-2', style: 'text-align:center;' }, [t('ai.trap-question')]),
        el('p', { class: 'muted mb-4', style: 'font-size:13px;line-height:1.6;text-align:center;' }, [
          t('traps.intro_1'), el('br'),
          t('traps.intro_2'),
        ]),
        el('div', { class: 'feeling-tag__chips' }, traps.map(t =>
          el('button', {
            class: 'feeling-tag__chip' + (selected && selected.id === t.id ? ' is-selected' : ''),
            onclick: (e) => { selected = t; haptic('impact'); rerender(); },
          }, [t.name])
        )),
        selected ? el('div', { class: 'card mt-4', style: 'padding:14px;background:var(--bg-elev);' }, [
          el('div', { class: 'serif', style: 'font-size:15px;color:var(--accent);margin-bottom:6px;' }, [selected.name]),
          el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:10px;line-height:1.5;' }, [selected.desc]),
          el('div', { class: 'serif', style: 'font-size:14px;color:var(--fg);line-height:1.55;' }, [t('traps.reframe_prefix') + selected.reframe]),
        ]) : null,
        el('div', { class: 'flex gap-3 mt-4' }, [
          el('button', { class: 'btn btn--ghost btn--lg', style: 'flex:1', onclick: () => {
            finishRevisit(navigate);
            closeRitual(overlay);
          } }, [t('common.skip')]),
          el('button', { class: 'btn btn--primary btn--lg', style: 'flex:1', onclick: () => {
            // 把 reframe 作为一条"层叠注解"追加到瞬间（复用 updateMoment，不打扰原话）
            if (selected) {
              const m = TSD.getMoment(momentId);
              const notes = (m && m.reframeNotes) ? m.reframeNotes.slice() : [];
              notes.push({ trap: selected.id, name: selected.name, reframe: selected.reframe, at: Date.now() });
              TSD.updateMoment(momentId, { reframeNotes: notes });
              haptic('success');
            }
            finishRevisit(navigate);
            closeRitual(overlay);
          } }, [selected ? t('traps.keep_reframe') : t('traps.no_trap')]),
        ]),
        el('p', { class: 'muted mt-3', style: 'font-size:11px;text-align:center;' }, [t('ai.ref-moodnotes')]),
      ]));
    };
    overlay.appendChild(head);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    rerender();
  }

  // 纯感受卡 canvas（4p · 最小暴露面：只含抽象感受词 + TSD 水印，零可识别信息）
  // 留白美学：莫兰迪/雾蓝/陶土渐变，区别于重逢卡旷野深色、信物卡雾蓝→陶土
  function renderFeelingCard(tag) {
    const W = 1080, H = 1350;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    // 莫兰迪雾蓝→陶土渐变（亲密美学，与信物卡同族但更极简）
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#2a2d3a');
    g.addColorStop(0.5, '#2f2a30');
    g.addColorStop(1, '#3a2e2a');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    // 装饰性圆环（与信物卡同族视觉语言）
    ctx.beginPath(); ctx.arc(W / 2, H / 2 - 80, 120, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(216,201,160,.12)'; ctx.lineWidth = 2; ctx.stroke();
    // 感受词（大字居中，衬线体，大量留白——像只写了一行诗的明信片）
    ctx.fillStyle = '#ece8df'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '44px "Songti SC","STSong","PingFang SC",serif';
    canvasWrap(ctx, '"' + tag + '"', W / 2, H / 2 - 80, W - 220, 68);
    // "我也是" 标记
    ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#a39d92';
    ctx.font = 'italic 28px "PingFang SC",serif';
    ctx.fillText(t('canvas.me_too'), W / 2, H / 2 + 60);
    // TSD 水印
    ctx.fillStyle = '#9a7f3a'; ctx.font = '500 22px "PingFang SC",sans-serif';
    ctx.fillText(t('canvas.me_too_brand'), W / 2, H - 130);
    return c;
  }

  // 峰终仪式（沉浸锚点 · 峰终定律）：会话结尾 1.1s 微仪式，满足性终止、送人离开（守原则9）
  // reduced-motion 判定（交付级 a11y）：同时尊重系统级 prefers-reduced-motion 和用户 app 内设置。
  // JS 驱动的动画（peakEndRitual/life-mash/voice pulse）据此缩短或跳过动画，保留功能。
  function prefersReducedMotion() {
    const sys = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const user = TSD.raw() && TSD.raw().settings && TSD.raw().settings.reducedMotion;
    return !!(sys || user);
  }

  function peakEndRitual(text, sub, done) {
    const overlay = el('div', { class: 'ritual' }, [
      el('div', { class: 'ritual__mark' }, ['◈']),
      el('div', { class: 'ritual__text serif' }, [text]),
      sub ? el('div', { class: 'ritual__sub muted' }, [sub]) : null,
    ]);
    document.body.appendChild(overlay);
    // reduced-motion：跳过动画过渡，直接显示终态后短暂停留即关闭（保留仪式感但无运动）
    const holdMs = prefersReducedMotion() ? 400 : 1100;
    const fadeMs = prefersReducedMotion() ? 0 : 320;
    requestAnimationFrame(() => overlay.classList.add('is-in'));
    setTimeout(() => {
      if (fadeMs) overlay.classList.remove('is-in');
      setTimeout(() => { overlay.remove(); done && done(); }, fadeMs);
    }, holdMs);
  }

  // 渐进展开（减文字过载）：headline 可见，点开看详情。原生 <details>，免 JS、自带 a11y
  function disclosure(label, children) {
    return el('details', { class: 'disclosure' }, [
      el('summary', { class: 'disclosure__summary' }, [label]),
      el('div', { class: 'disclosure__body' }, children),
    ]);
  }

  function downloadJSON(d, name) {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name || 'tsd-memory-' + Date.now() + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  // 影像 → 压缩 dataURL（避免 LocalStorage 撑爆；原图 4MB 经此变 ~200KB）
  function fileToCompressedDataUrl(file, opts = {}) {
    const maxDim = opts.maxDim || 1024;
    const quality = opts.quality || 0.82;
    return new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith('image/')) { reject(new Error(t('file.err_not_image'))); return; }
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          let w = img.width, h = img.height;
          if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
          else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          c.getContext('2d').drawImage(img, 0, 0, w, h);
          resolve({ dataUrl: c.toDataURL('image/jpeg', quality), w, h });
        };
        img.onerror = () => reject(new Error(t('file.err_decode')));
        img.src = fr.result;
      };
      fr.onerror = () => reject(new Error(t('file.err_read')));
      fr.readAsDataURL(file);
    });
  }

  // ---------- 导入校验 / 删除回执 sheet ----------
  function openImportSheet(pkg, navigate) {
    const r = TSD.importPackage(pkg);
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('capsule.import-validation')]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'list-row' }, [
          el('div', { class: 'list-row__icon', style: r.matched ? 'background:var(--accent-glow);color:var(--accent);' : 'background:rgba(220,120,120,0.16);color:#c66;' }, [r.matched ? '✓' : '✗']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [r.matched ? t('import.passed') : t('import.failed')]),
            el('div', { class: 'list-row__sub' }, [r.matched ? t('import.passed_sub') : (r.errors[0] || t('import.unknown_error'))]),
          ]),
        ]),
        r.counts ? el('div', { class: 'list-row' }, [
          el('div', { class: 'list-row__icon' }, ['◇']),
          el('div', { class: 'list-row__main' }, [
            el('div', { class: 'list-row__title' }, [t('capsule.internal-count')]),
            el('div', { class: 'list-row__sub' }, [t('import.counts_sub', {m: (r.counts.moments || 0), r: (r.counts.revisits || 0), a: (r.counts.aiLog || 0)})]),
          ]),
        ]) : null,
      ]),
      r.ok
        ? el('button', { class: 'btn btn--primary btn--block mt-3', onclick: () => { TSD.applyImport(pkg); toast(t('toast.imported_overwrite')); navigate('today', { replace: true }); } }, [t('import.confirm_btn')])
        : el('p', { class: 'muted text-center', style: 'font-size:12px;' }, [t('capsule.validation-failed')]),
    ]);
    sheet(content);
  }

  function openDeleteSheet(navigate) {
    const raw = TSD.raw();
    const counts = { moments: TSD.getMoments().length, revisits: raw.revisits.length, aiLog: raw.aiLog.length };
    const content = el('div', {}, [
      el('h3', { class: 'h3 mb-3' }, [t('settings.clear-local-data')]),
      el('div', { class: 'card mb-3' }, [
        el('div', { class: 'muted', style: 'font-size:12px;margin-bottom:10px;' }, [t('settings.delete-warning')]),
        el('div', { class: 'flex gap-4' }, [
          statBlock(String(counts.moments), t('delete.stat_moments'), 'accent'),
          statBlock(String(counts.revisits), t('delete.stat_revisits'), 'growth'),
          statBlock(String(counts.aiLog), t('delete.stat_ailog'), 'mute'),
        ]),
      ]),
      el('div', { class: 'section-title' }, [t('common.type-confirm')]),
      el('input', { id: 'del-confirm', placeholder: t('delete.confirm_placeholder'), style: 'width:100%;padding:12px;background:var(--bg-elev);border:1px solid var(--line-strong);border-radius:10px;margin-bottom:16px;text-align:center;' }),
      el('button', { class: 'btn btn--lg btn--block', id: 'del-btn', disabled: true, style: 'opacity:0.5;' }, [t('settings.permanent-delete')]),
    ]);
    const s = sheet(content);
    const input = $('#del-confirm', s);
    const btn = $('#del-btn', s);
    input.addEventListener('input', () => {
      const ok = input.value.trim() === t('delete.confirm_match');
      btn.disabled = !ok;
      btn.style.opacity = ok ? '1' : '0.5';
      btn.className = 'btn btn--lg btn--block ' + (ok ? 'btn--primary' : '');
    });
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      const receipt = TSD.softDelete();
      downloadJSON({
        receiptToken: receipt.receiptToken,
        savedAt: receipt.savedAt,
        savedAtText: new Date(receipt.savedAt).toLocaleString('zh-CN'),
        counts: receipt.counts,
        note: t('delete.receipt_note'),
      }, 'tsd-deletion-receipt-' + receipt.savedAt + '.json');
      if (s._close) s._close();
      toast(t('toast.deleted_receipt'));
      navigate('settings');
    });
  }

  // ---------- 主题应用（三态：auto/dark/light，无 reload 平滑切换）----------
  function applyTheme(mode) {
    const root = document.documentElement;
    if (mode === 'dark') root.setAttribute('data-theme', 'dark');
    else if (mode === 'light') root.setAttribute('data-theme', 'light');
    else root.removeAttribute('data-theme'); // auto = 跟随系统
    // 同步写 localStorage 缓存（防首屏 FOUC：index.html inline script 同步读取设 data-theme，
    // 避免 IDB 异步加载期间用户自定义主题先以系统主题闪烁）
    try { if (mode && mode !== 'auto') localStorage.setItem('tsd-theme', mode); else localStorage.removeItem('tsd-theme'); } catch (e) {}
    // 同步 theme-color meta（影响 Safari 地址栏 / 状态栏配色）
    const dark = '#0f1014', light = '#f7f4ef';
    const isDark = mode === 'dark' || (mode !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
    $$('meta[name="theme-color"]').forEach(m => m.setAttribute('content', isDark ? dark : light));
  }

  // ---------- 启动 ----------
  async function start() {
    await TSD.init();
    // IDB 写入失败警示（配额超限/损坏）：首次失败 toast 一次，提示用户导出备份。
    // 守"数据不丢"铁律：绝不静默吞掉持久化失败让用户以为已保存。
    TSD.onSaveError(() => {
      toast(t('toast.save_failed_export'));
    });
    applyTheme(TSD.raw().settings && TSD.raw().settings.darkMode || 'auto');
    TSD.checkAchievements(); // 启动静默解锁已达成成就（不在启动时 toast，避免噪音）
    haptic('impact'); // 入场触觉（D-B1）：建立"进入仪式空间"的条件反射（native 生效，web 静默）
    const newCaps = TSD.checkCapsuleUnlocks(); // 时间胶囊解锁检查（C-A）
    // G 重遇推送：胶囊解锁时调度本地通知（原生壳内生效，web 静默）
    if (typeof PushHook !== 'undefined' && PushHook.isNative() && newCaps.length) {
      PushHook.scheduleReunionReminder(
        new Date(Date.now() + 5 * 60 * 1000), // 5 分钟后推送（让用户先看到仪式）
        t('capsule.letter_arrived_title'),
        t('capsule.push_body')
      );
    }
    // Widget badge 同步（Finch 式活体存在 · App Badging API）
    // 守原则5：只 0/1 安静点，永不计数/永不"漏 X 天"
    if (typeof WidgetBadge !== 'undefined') WidgetBadge.sync();
    // widget 模式检测：从 home-screen widget 入口带 ?from=widget 启动 → 超精简单屏
    const isWidgetMode = new URLSearchParams(location.search).get('from') === 'widget';
    const path = isWidgetMode ? 'widget' : (location.hash.replace('#', '') || 'today');
    render(path);
    const boot = document.getElementById('boot');
    const revealCaps = () => { if (newCaps.length) setTimeout(() => peakEndRitual(t('capsule.letter_arrived_title'), t('capsule.letters_from_past', {n: newCaps.length}), () => navigate('capsules')), 200); };
    if (boot) { boot.classList.add('is-out'); setTimeout(() => { boot.remove(); revealCaps(); }, 350); }
    else revealCaps();
  }

  // rerender：切换语言时重渲染当前视图（不 reload，保持数据与滚动状态）
  function rerender() {
    if (currentView) render(location.hash.replace('#', '') || 'today');
  }

  return { start, navigate, rerender };
})();

document.addEventListener('DOMContentLoaded', () => App.start());

// PWA 安装提示捕获（Android Chromium · 用于设置页"安装到主屏幕"按钮）
// iOS Safari 无此事件，走手动引导
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  window.__tsdInstallPrompt = e;
});

// SW periodic-sync 唤醒：刷新 home-screen badge（Finch 式活体演化）
navigator.serviceWorker && navigator.serviceWorker.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'tsd-sync-badge' && typeof WidgetBadge !== 'undefined') {
    WidgetBadge.sync();
  }
});

// standalone 模式启动后注册周期同步（让 badge 在 app 未开时也演化）
if (WidgetBadge && WidgetBadge.isStandalone && WidgetBadge.isStandalone()) {
  WidgetBadge.registerPeriodicSync();
}

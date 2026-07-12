/* ============================================================
   TSD i18n · 中英双语（manifest 声明中英全球发）
   守哲学：翻译保持温柔、非 loss-frame、反 streak 语气；品牌调性跨语言一致。
   机制：locale 检测（localStorage → navigator.language → zh 默认）；
         t(key, params) 查字典 + {占位符} 插值；setLocale 写 localStorage + 触发重渲染。
   约定：用户数据（种子 quote/用户记的瞬间）不翻译，只翻译 UI 文案。
   ============================================================ */

const I18N = (() => {
  const DEFAULT_LOCALE = 'zh';
  const SUPPORTED = ['zh', 'en'];

  function detect() {
    try {
      const saved = localStorage.getItem('tsd-locale');
      if (saved && SUPPORTED.includes(saved)) return saved;
    } catch (e) {}
    // navigator.language: 'zh-CN'/'zh'/'en-US'/'en'
    const nav = (navigator.language || '').toLowerCase();
    if (nav.startsWith('zh')) return 'zh';
    if (nav.startsWith('en')) return 'en';
    return DEFAULT_LOCALE;
  }

  let _locale = detect();

  function getLocale() { return _locale; }
  function setLocale(loc) {
    if (!SUPPORTED.includes(loc)) return;
    _locale = loc;
    try { localStorage.setItem('tsd-locale', loc); } catch (e) {}
    // 触发重渲染（App.start 后 navigate 当前路径；App 未就绪时由 start 调 render）
    if (typeof App !== 'undefined' && App.rerender) App.rerender();
    // 同步 html lang 属性（a11y / 屏幕阅读器语言切换）
    if (typeof document !== 'undefined') document.documentElement.lang = loc === 'zh' ? 'zh-CN' : 'en';
  }

  // 字典：{ key: { zh, en } }。t('today.echo') → 当前 locale 的串。
  // 支持占位符：t('days_ago', { d: 3 }) → "3 天前" / "3 days ago"
  const DICT = {
    // ---------- 通用 / topbar / tabbar ----------
    'app.name': { zh: 'TimeSlowDown', en: "TimeSlowDown" },
    'nav.search': { zh: '搜索瞬间', en: "Search moments" },
    'nav.settings': { zh: '设置', en: "Settings" },
    'tab.echo': { zh: '回声', en: "Echo" },
    'tab.wilderness': { zh: '旷野', en: "Wilderness" },
    'tab.media': { zh: '影像', en: "Media" },
    'tab.ai': { zh: 'AI', en: "AI" },
    'tab.settings': { zh: '设置', en: "Settings" },

    // ---------- 相对时间（动态拼接）----------
    'rel.just_now': { zh: '刚刚', en: "just now" },
    'rel.today': { zh: '今天', en: "today" },
    'rel.yesterday': { zh: '昨天', en: "yesterday" },
    'rel.days_ago': { zh: '{d} 天前', en: "{d} days ago" },
    'rel.weeks_ago': { zh: '{w} 周前', en: "{w} weeks ago" },
    'rel.months_ago': { zh: '{m} 个月前', en: "{m} months ago" },
    'rel.years_ago': { zh: '{y} 年前', en: "{y} years ago" },
    'rel.one_day_ago': { zh: '1 天前', en: "1 day ago" },
    'rel.one_week_ago': { zh: '1 周前', en: "1 week ago" },
    'rel.one_month_ago': { zh: '1 个月前', en: "1 month ago" },
    'rel.one_year_ago': { zh: '1 年前', en: "1 year ago" },

    // ---------- 时段（深夜·周末 等）----------
    'phase.deep': { zh: '深夜', en: "late night" },
    'phase.morning': { zh: '清晨', en: "morning" },
    'phase.afternoon': { zh: '午后', en: "afternoon" },
    'phase.evening': { zh: '夜晚', en: "evening" },
    'weekday.mon': { zh: '一', en: "M" },
    'weekday.tue': { zh: '二', en: "T" },
    'weekday.wed': { zh: '三', en: "W" },
    'weekday.thu': { zh: '四', en: "T" },
    'weekday.fri': { zh: '五', en: "F" },
    'weekday.sat': { zh: '六', en: "S" },
    'weekday.sun': { zh: '日', en: "S" },
    'weekday.weekend': { zh: '周末', en: "weekend" },
    'weekday.weekday': { zh: '工作日', en: "weekday" },

    // ---------- onboarding ----------
    'onb.title_1': { zh: '让走过的时间，', en: "Let the time you've lived" },
    'onb.title_2': { zh: '长成你的人生。', en: "grow into your life." },
    'onb.intro': { zh: 'TSD 不要求你每天记新东西。它每天把你带回一个过去的瞬间，让记忆在反复回访里变厚。', en: "TSD doesn't ask you to record something new every day. It brings you back to one past moment each day, letting memory thicken through revisiting." },
    'onb.cta_start': { zh: '开始第一次回访', en: "Start your first revisit" },
    'onb.cta_skip': { zh: '先逛逛，之后再设置', en: "Look around first, set up later" },
    'onb.seed_prompt': { zh: '先留一句今天的小事', en: "Leave one small thing from today" },
    'onb.seed_hint': { zh: '一个词就够——它会成为你第一个能被"带回"的瞬间。', en: "One word is enough — it becomes your first moment that can be \"brought back\"." },
    'onb.seed_placeholder': { zh: '今天发生了…', en: "Today, what happened…" },
    'onb.seed_skip': { zh: '跳过', en: "Skip" },
    'onb.seed_cta': { zh: '留住这一刻', en: "Keep this moment" },
    'onb.birth_prompt': { zh: '用来画出你的人生周格。可以跳过。', en: "Used to draw your life grid. You can skip." },
    'onb.section_now': { zh: '今天的回声', en: "Today's echo" },
    'onb.seed_cta_keep': { zh: '留住', en: 'Keep' },
    'onb.seed_example': { zh: '比如：今天阳光很好，在阳台站了一会儿。', en: 'e.g. The sunlight was nice today; I stood on the balcony for a while.' },
    'onb.stay_a_moment': { zh: '停留一下', en: 'Stay a moment' },
    'onb.echo_hint_1': { zh: '这是 TSD 从你的过去里带回的一个瞬间。', en: 'This is a moment TSD brought back from your past.' },
    'onb.echo_hint_2': { zh: '回访不需要你写新东西，只需被带回。', en: "Revisiting doesn't ask you to write anything new — just be brought back." },
    'onb.birth_title': { zh: '你大概哪一年出生？', en: 'Roughly which year were you born?' },

    // ---------- today ----------
    'today.echo_title': { zh: '今天的回声', en: "Today's echo" },
    'today.first_brought_back': { zh: '第一次被带回', en: "First time brought back" },
    'today.bring_back': { zh: '带回这一刻', en: "Bring this back" },
    'today.view_full': { zh: '看完整瞬间', en: "View full moment" },
    'echo.label_thread': { zh: '✦ 继续昨天的引子', en: "✦ Continue yesterday's thread" },
    'echo.label_echo': { zh: '今天的回声', en: "Today's echo" },
    'echo.thread_hint': { zh: '你昨天留了半句：', en: 'You left half a line yesterday:' },
    'echo.revisited_count': { zh: '已回访 {n} 次', en: 'revisited {n} time(s)' },
    'echo.listen_voice': { zh: '♪ 听这一刻的声音', en: "♪ Listen to this moment's sound" },
    'echo.listening': { zh: '◉ 正在听…', en: '◉ Listening…' },
    'echo.relisten': { zh: '↺ 再听这一刻的声音', en: '↺ Listen again' },
    'today.life_grid': { zh: '人生周格', en: "Life grid" },
    'today.week_revisited': { zh: '本周已回访', en: "This week revisited" },
    'today.moments_unit': { zh: '个瞬间', en: "moments" },
    'today.times_unit': { zh: '次', en: "times" },
    'today.cohort_title': { zh: '三个月回访固化', en: "Three-month revisit consolidation" },
    'today.cohort_subtitle': { zh: '回访 vs 可讲述', en: "Revisiting vs. tellability" },
    'today.cohort_note': { zh: '对照假设（M2 真实验证）', en: "Comparative hypothesis (M2 real-world validation)" },
    'today.cohort_revisited': { zh: '被回访过', en: "Revisited" },
    'today.cohort_thick': { zh: '变厚(≥2次)', en: "Thickened (≥2)" },
    'today.cohort_unrevisited': { zh: '未回访', en: "Not revisited" },
    'today.cohort_why': { zh: '为什么是这个对照指标？', en: "Why this comparison metric?" },
    'today.imprints_title': { zh: '重逢印记', en: "Reunion imprints" },
    'today.imprints_view_all': { zh: '查看全部重逢印记', en: "View all reunion imprints" },
    'today.imprints_wall_label': { zh: '重逢印记墙，点击查看全部', en: "Reunion imprint wall, tap to view all" },
    'today.imprints_fog': { zh: '雾中', en: "in the fog" },
    'today.imprints_fog_sub': { zh: '下一枚仍在生活的雾里', en: "The next one is still in the fog of life" },
    'today.week_graph': { zh: '本周回访图谱', en: "This week's revisit graph" },
    'today.week_empty': { zh: '本周还没有回访。今天带回第一个瞬间吧。', en: "No revisits this week. Bring back the first one today." },
    'today.heatmap_title': { zh: '回访日历', en: "Revisit calendar" },
    'today.heatmap_label': { zh: '{date}：回访 {n} 次', en: "{date}: revisited {n} time(s)" },
    'today.heatmap_less': { zh: '少', en: "less" },
    'today.heatmap_more': { zh: '多', en: "more" },
    'today.action_title': { zh: '今天的一个小动作', en: "One small action for today" },
    'today.action_sub': { zh: '回访之后，可选地把过去变成今天的动力', en: "After revisiting, optionally turn the past into today's momentum" },
    'today.empty_title': { zh: '还没有可回访的瞬间', en: 'No moments to revisit yet' },
    'today.empty_sub': { zh: '先留下一个瞬间，TSD 之后会把它带回给你。', en: 'Leave one moment first — TSD will bring it back to you later.' },
    'today.empty_cta': { zh: '留下第一个瞬间', en: 'Leave your first moment' },
    'today.no_action': { zh: '今天没有建议。', en: 'No suggestion for today.' },
    'today.cohort_why_body': { zh: '假设：被回访≥2次的瞬间，三个月后可讲述率显著高于未回访。这是本分支可证伪的北极星，不同于"能否讲出5个瞬间"的整体指标。', en: 'Hypothesis: moments revisited ≥2 times have a significantly higher tellability rate after three months than un-revisited ones. This is the falsifiable north star of this branch — different from the overall "can you tell 5 moments" metric.' },

    // ---------- revisit ----------
    'revisit.timer_default': { zh: '10', en: "10" },
    'revisit.stay_here': { zh: '就到这里', en: "That's enough for now" },
    'revisit.keep_layer': { zh: '留下这一层', en: "Keep this layer" },
    'revisit.feeling_placeholder': { zh: '现在再看，我想说…', en: "Seeing it again, I want to say…" },
    'revisit.thread_check': { zh: '这句还没想完，明天再续（留个引子）', en: "Not finished with this — continue tomorrow (leave a thread)" },
    'revisit.voice_btn': { zh: '🎙 录一段声音（5 秒）', en: "🎙 Record a sound (5 seconds)" },
    'revisit.can_add_or_not': { zh: '可以补一句了，也可以不补', en: "You can add a line now — or not" },
    'revisit.extend_btn': { zh: '再停留一会儿', en: "Stay a little longer" },
    'revisit.timer_hint': { zh: '秒后可以补一句"现在再看"', en: 'seconds until you can add a "seeing it again" line' },
    'revisit.only_stayed': { zh: '（只停留了一会儿，没说话）', en: '(just stayed a moment, said nothing)' },
    'revisit.feeling_placeholder_full': { zh: '现在再看，我想说…（可选，保留你的原话）', en: 'Seeing it again, I want to say… (optional, in your own words)' },
    'revisit.ritual_keep': { zh: '这一层留住了', en: "This layer is kept" },
    'revisit.ritual_sub_imprint': { zh: '又浮现一枚印记', en: "An imprint has surfaced" },
    'revisit.ritual_sub_thick': { zh: '被带回的这一刻，又厚了一层', en: "This revisited moment has thickened again" },

    // ---------- settings ----------
    'settings.title': { zh: '设置', en: "Settings" },
    'settings.account': { zh: '账户与权利', en: "Account & rights" },
    'settings.privacy': { zh: '隐私', en: "Privacy" },
    'settings.about': { zh: '关于', en: "About" },
    'settings.appearance': { zh: '外观', en: "Appearance" },
    'settings.dark_mode': { zh: '深色模式', en: "Dark mode" },
    'settings.dark_auto': { zh: '跟随系统', en: "Follow system" },
    'settings.dark_dark': { zh: '始终深色', en: "Always dark" },
    'settings.dark_light': { zh: '始终浅色', en: "Always light" },
    'settings.reduced_motion': { zh: '减少动效', en: "Reduce motion" },
    'settings.reduced_motion_sub': { zh: '降低动画与过渡', en: "Reduce animations and transitions" },
    'settings.sound': { zh: '声音', en: "Sound" },
    'settings.language': { zh: '语言', en: "Language" },
    'settings.language_sub': { zh: '中英双语', en: "Chinese / English" },
    'settings.switch': { zh: '切换', en: "Switch" },

    // ---------- 通用动作 ----------
    'action.close': { zh: '关闭', en: "Close" },
    'action.cancel': { zh: '取消', en: "Cancel" },
    'action.save': { zh: '保存', en: "Save" },
    'action.delete': { zh: '删除', en: "Delete" },
    'action.export': { zh: '导出', en: "Export" },
    'action.share': { zh: '分享', en: "Share" },
    'action.skip': { zh: '跳过', en: "Skip" },
    'action.done': { zh: '完成', en: "Done" },
  };

  function t(key, params) {
    const entry = DICT[key];
    if (!entry) return key; // 字典缺 key 时回退显示 key（开发期可见，不崩）
    let s = entry[_locale] || entry[DEFAULT_LOCALE] || key;
    if (params) {
      for (const k in params) {
        s = s.split('{' + k + '}').join(params[k]);
      }
    }
    return s;
  }

  return { t, getLocale, setLocale, supported: SUPPORTED, DICT };
})();

// 暴露全局 t() 简写（所有 UI 代码用 t('key')）+ I18N（设置页语言切换用）
window.t = I18N.t;
window.I18N = I18N;

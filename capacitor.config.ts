import type { CapacitorConfig } from '@capacitor/cli';

// TSD Claude Code 分支（回访）Capacitor 配置
// bundle id 用回访论点命名，避免与 Codex/ZCode 分支冲突
const config: CapacitorConfig = {
  appId: 'com.raingodprc.tsdrevisit',
  appName: 'TSD 回访',
  webDir: 'www',
  backgroundColor: '#0f1014',
  ios: {
    // 原生壳不抢屏幕时间（原则9）：禁用橡皮筋滚动溢出，保持 app 感
    scrollEnabled: false,
    // contentInset 'always'：防 notch/Dynamic Island 遮挡顶部内容（参 ZCode · iPhone 必备）
    contentInset: 'always',
    // 限制 WKWebView 只能导航到 App-Bound Domains（ATS 安全，防意外跳外部域）
    limitsNavigationsToAppBoundDomains: true,
  },
  // 自定义本地 plugin 注册（非 npm 包，须显式列名 → Capacitor 自动生成注册代码）
  // TSDWidgetPlugin：把 PWA widgetState 写入 App Group UserDefaults，供 WidgetKit 读取
  // 注：packageClassList 是 iOS 工程字段，不在 CapacitorConfig TS 类型里，用 as 断言保留
  ...({
    packageClassList: ['HapticsPlugin', 'LocalNotificationsPlugin', 'TSDWidgetPlugin'],
  } as any),
  plugins: {
    LocalNotifications: {
      // 品牌化通知：smallIcon/iconColor/sound 需对应原生资源就绪后生效（参 ZCode）
      // 资源未就绪时用系统默认，不影响功能
      iconColor: '#c8873c',
    },
  },
};

export default config;

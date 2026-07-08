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
  },
};

export default config;

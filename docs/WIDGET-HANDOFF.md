# TSD WidgetKit Xcode Hand-off

> 代码已全部写好。以下是你在 Xcode 里需要做的操作步骤，让 WidgetKit 真正跑起来。
> 全程约 10 分钟，无需写任何代码。

## 已写好的文件（本仓库）

| 文件 | 作用 |
|------|------|
| `ios/App/App/TSDWidgetPlugin.swift` | Capacitor plugin：PWA 调 `TSDWidget.writeWidgetState()` → 写 App Group UserDefaults → 触发 widget 刷新 |
| `ios/App/App/Widget/TSDWidgetProvider.swift` | TimelineProvider：30 分钟刷新一次，读 App Group 状态 |
| `ios/App/App/Widget/TSDWidget.swift` | SwiftUI view + Widget 主结构（systemSmall/Medium） |
| `ios/App/App/Widget/Info.plist` | Widget Extension 的 Info |
| `ios/App/App/Widget/TSDWidgetExtension.entitlements` | Widget 的 App Group entitlement |
| `ios/App/App/App.entitlements` | 主 app 的 App Group entitlement |
| `widget.js` | PWA 侧：`sync()` 时检测到 Capacitor → 调 plugin 写状态 |
| `capacitor.config.ts` | `packageClassList` 加了 `TSDWidgetPlugin` |

## Xcode 操作步骤

### 1. 同步代码到 iOS 工程

```bash
cd /Users/geralt/TimeSlowDown/claude-code-branch
npm run sync   # = build + cap copy
```

### 2. 打开 Xcode

```bash
npx cap open ios
```

### 3. 把 Swift 文件加入主 target

- 在左侧 Project Navigator 里，右键 `App` 文件夹 → "Add Files to App..."
- 选 `TSDWidgetPlugin.swift`（在 `ios/App/App/` 下）
- 勾选：☑︎ Copy items if needed（取消勾选，文件已在工程目录）· 目标勾选 **App** target
- 同样把 `Widget/` 整个文件夹加进来（先不加 target，下一步建 Widget Extension 时再处理）

> `TSDWidgetPlugin.swift` 必须在 **App target** 编译（它是 Capacitor plugin）。
> `Widget/` 下的三个 `.swift` 必须在 **Widget Extension target** 编译（下一步建）。

### 4. 建 Widget Extension target

- 菜单 File → New → Target...
- 选 **Widget Extension** → Next
- Product Name: `TSDWidgetExtension`
- Embed in: **App**
- ☑︎ Include Configuration App Intent（**取消勾选**，我们用 StaticConfiguration）
- Language: Swift
- Finish。Xcode 会问 "Activate scheme?" → 选 **Cancel**（不要激活 widget scheme，保持 App scheme）

建好后：
- 删掉 Xcode 自动生成的 `TSDWidgetExtension.swift`（我们用自己的）
- 把 `Widget/` 下的 `TSDWidget.swift`、`TSDWidgetProvider.swift` 加到这个 Widget target（Project Navigator → 选中文件 → File Inspector → Target Membership 勾 Widget Extension）
- 设 Widget target 的 Bundle Identifier：`com.raingodprc.tsdrevisit.TSDWidgetExtension`

### 5. 配 App Group（两个 target 都要）

**主 App target**：
1. 选 App target → Signing & Capabilities → + Capability → **App Groups**
2. 加 group：`group.com.raingodprc.tsdrevisit`
3. + Capability → **Capability** 不需要再加（App Groups 够了）
4. 确认 Code Signing → Team 选好（你自己的 Developer Team）

**Widget Extension target**：
1. 选 Widget target → Signing & Capabilities → + Capability → **App Groups**
2. 加同一个 group：`group.com.raingodprc.tsdrevisit`
3. Team 选与主 app **相同** 的 Team

> 两边的 App Group identifier 必须完全一致 = `group.com.raingodprc.tsdrevisit`。
> 这与 `TSDWidgetPlugin.swift` 里写死的常量一致。若你改名，三处（plugin、App.entitlements、Widget.entitlements）一起改。

### 6. 绑定 entitlements

- 主 App target → Build Settings → 搜 "Entitlements File" → 设为 `App/App.entitlements`
- Widget target → 同样设为 `Widget/TSDWidgetExtension.entitlements`

> 如果 Xcode 已经自动给主 app 生成了 `App.entitlements` 并开了 App Groups，检查里面 group 是否一致即可，不必用我的模板覆盖。

### 7. 编译运行

- 选 App scheme（不是 Widget scheme）→ 选模拟器/真机 → Run
- App 启动后，进入今天页面 → `WidgetBadge.sync()` 会自动调 plugin 写状态
- 回主屏 → 长按 → 加 Widget → 找 "TSD 回访" → 选 Small/Medium → 应显示 header + 安静点

## 验证清单

- [ ] 编译无错（App + Widget Extension 两个 target 都过）
- [ ] App 启动不崩（TSDWidgetPlugin 注册成功）
- [ ] Widget 加到主屏后显示中文 header（默认空态："还没有可回访的瞬间"）
- [ ] App 里留一个瞬间 → 等下次 echo 调度 → 回主屏 → Widget 刷新成 "有一个旧瞬间想再见你" + 亮色点
- [ ] 回访完 → Widget 变 "今天已重逢" + 点变空心

## 守原则核对

| 原则 | 落地 |
|------|------|
| 原则5（不计数/不漏天数） | Widget 只显示 dot 0/1，header 三态，无任何数字 |
| 原则9（widget 不延长会话） | 只 2 行文字 + 1 点，点 widget 打开 app 的 `?from=widget` 单屏 |
| 本机优先 | Widget 数据走 App Group UserDefaults，不经任何服务器；plugin 未注入时 PWA 静默降级 |

## 故障排查

**Widget 一直显示空态 "还没有可回访的瞬间"**
→ App Group 没配对。检查两个 target 的 App Groups identifier 是否都是 `group.com.raingodprc.tsdrevisit`。
→ 或 plugin 没注册。检查 `capacitor.config.json` 的 `packageClassList` 是否含 `TSDWidgetPlugin`（`npm run sync` 后会同步）。

**编译报 "Cannot find 'TSDWidgetPlugin' in scope"（Widget target 里）**
→ 已解决：`TSDWidgetProvider.swift` 内联读 `UserDefaults(suiteName:)`，Widget target **不依赖** App target 的 plugin 类。两个 target 完全解耦，不会出此错。

> 仅当你在 Widget target 里手动加了 `import` App target 的代码时才可能报错——别这么做。Widget 只读 UserDefaults。

**Widget 不刷新**
→ `WidgetCenter.shared.reloadAllTimelines()` 只在真机/模拟器生效，且 App 必须前台或后台未挂起时调。属正常限制。

## 与 PWA 的关系

- Web 端（GitHub Pages）无 Capacitor → `WidgetBadge.syncNativeWidget()` 检测无 plugin → 静默返回 false，走 App Badging API 降级。
- 原生壳（iOS App）→ `window.Capacitor.Plugins.TSDWidget` 存在 → 写 App Group → Widget 读。
- 两端代码同一份 widget.js，无需分叉。

import Foundation
import Capacitor
import WidgetKit

/**
 TSDWidgetPlugin — 把 PWA 侧的 widget 状态写入 App Group UserDefaults，供 WidgetKit 读取。

 守原则5：widget 只显示 0/1 安静点，永不计数/永不"漏 X 天"。
 守原则9：widget 是超精简单屏入口，不延长会话。

 数据契约（PWA 侧 widget.js sync() 时调用 writeWidgetState）：
   {
     "header": "今天已重逢" | "有一个旧瞬间想再见你" | "还没有可回访的瞬间",
     "sub": "明天还会有一个" | "点开待 10 秒" | "先留下一个瞬间" | "昨天留了半句，今天续上？",
     "dot": true | false,          // 安静点（hasNewEcho）
     "locale": "zh" | "en",          // 文案语言
     "at": 1700000000000             // 写入时间戳（ms），widget 用其判断新鲜度
   }

 App Group 配置（用户在 Xcode 操作）：
   1. 主 target + Widget target 都开 App Groups capability → 加 group.com.raingodprc.tsdrevisit
   2. 主 target 的 WidgetKit capability 不需要（widget target 才需要）
   注入（capacitor.config.json packageClassList 加 "TSDWidgetPlugin"）
 */
@objc(TSDWidgetPlugin)
public class TSDWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
  // CAPBridgedPlugin 协议（Capacitor 6）要求 identifier / jsName / pluginMethods。
  // jsName 必须与 widget.js 的 registerPlugin('TSDWidget') 一致；
  // pluginMethods 必须列出所有暴露给 JS 的方法，否则 JSExport 不生成桥接。
  public let identifier = "TSDWidgetPlugin"
  public let jsName = "TSDWidget"
  public let pluginMethods: [CAPPluginMethod] = [
    CAPPluginMethod(name: "writeWidgetState", returnType: CAPPluginReturnPromise),
  ]

  /// App Group identifier —— 必须与主 target / Widget target 的 App Groups 一致。
  /// 用户在 Xcode → Signing & Capabilities → App Groups 配好后此处自动生效。
  private let appGroup = "group.com.raingodprc.tsdrevisit"
  private let stateKey = "tsd.widgetState"

  public override func load() {
    super.load()
  }

  /// PWA 调用：TSDWidget.writeWidgetState({header,sub,dot,locale,at}) → 写 UserDefaults + 触发 widget 刷新
  @objc func writeWidgetState(_ call: CAPPluginCall) {
    guard let payload = call.options as? [String: Any] else {
      call.reject("invalid payload")
      return
    }
    guard let suite = UserDefaults(suiteName: appGroup) else {
      // App Group 未配（用户未在 Xcode 加 capability）→ 静默降级，不报错（守"不阻断主流程"）
      call.resolve(["ok": false, "reason": "no-app-group"])
      return
    }
    let snapshot: [String: Any] = [
      "header": payload["header"] as? String ?? "",
      "sub": payload["sub"] as? String ?? "",
      "dot": payload["dot"] as? Bool ?? false,
      "locale": payload["locale"] as? String ?? "zh",
      "at": payload["at"] as? Double ?? 0,
    ]
    suite.set(snapshot, forKey: stateKey)
    suite.synchronize()

    // 触发所有 widget 重新加载时间线（低频，随 PWA sync 调用，最小 12h 间隔由 PWA 周期 sync 保证）
    #if arch(arm64) || arch(x86_64)
    WidgetCenter.shared.reloadAllTimelines()
    #endif

    call.resolve(["ok": true])
  }

  /// 静态读取（供 Widget Extension 直接调，非 Capacitor 路径）
  static func readSharedState() -> [String: Any]? {
    guard let suite = UserDefaults(suiteName: "group.com.raingodprc.tsdrevisit") else { return nil }
    return suite.dictionary(forKey: "tsd.widgetState")
  }
}

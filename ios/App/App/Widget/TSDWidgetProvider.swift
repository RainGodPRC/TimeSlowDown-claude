import WidgetKit
import SwiftUI

// MARK: - Entry

/// Widget 展示的最小数据。守原则5：dot 只 0/1，无计数。
struct TSDWidgetEntry: TimelineEntry {
  let date: Date
  let header: String      // 今天已重逢 / 有一个旧瞬间想再见你 / 还没有可回访的瞬间
  let sub: String         // 副标题
  let dot: Bool           // 安静点（有新回声）
  let locale: String      // "zh" | "en"
}

// MARK: - TimelineProvider

/// 时间线策略：守低频原则。
/// - 每条 Entry 有效 30 分钟（半小时内不刷新，避免高频拉取）
/// - 下一个刷新点对齐到下一个 30 分钟整点（一天最多 48 次系统允许的刷新机会，实际 PWA 写入触发才是主路径）
/// - 真正的状态更新由 PWA 侧 WidgetBadge.sync() → TSDWidgetPlugin.writeWidgetState → WidgetCenter.reload 触发
struct TSDWidgetProvider: TimelineProvider {
  func placeholder(in context: Context) -> TSDWidgetEntry {
    TSDWidgetEntry(date: Date(), header: "有一个旧瞬间想再见你", sub: "点开待 10 秒", dot: true, locale: "zh")
  }

  func getSnapshot(in context: Context, completion: @escaping (TSDWidgetEntry) -> Void) {
    completion(readEntry())
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<TSDWidgetEntry>) -> Void) {
    let now = Date()
    let entry = readEntry(at: now)

    // 下一个整 30 分钟点刷新（低频，守原则9）
    let cal = Calendar.current
    let curMin = cal.component(.minute, from: now)
    let nextMin = (curMin / 30) * 30 + 30
    let nextHalf: Date = cal.date(bySetting: .minute, value: nextMin, of: now)
      ?? cal.date(byAdding: .minute, value: 30, to: now)!
    let entries = [entry, TSDWidgetEntry(date: nextHalf, header: entry.header, sub: entry.sub, dot: entry.dot, locale: entry.locale)]
    completion(Timeline(entries: entries, policy: .after(nextHalf)))
  }

  /// 从 App Group UserDefaults 读最新状态；读不到（用户未配 App Group / 未开过 app）→ 空态。
  /// 守"两个 target 解耦"：Widget target 不依赖 App target 的 TSDWidgetPlugin 类，内联读 UserDefaults。
  private func readEntry(at date: Date = Date()) -> TSDWidgetEntry {
    guard let suite = UserDefaults(suiteName: "group.com.raingodprc.tsdrevisit"),
          let snap = suite.dictionary(forKey: "tsd.widgetState") else {
      return TSDWidgetEntry(date: date, header: "还没有可回访的瞬间", sub: "先留下一个瞬间", dot: false, locale: "zh")
    }
    return TSDWidgetEntry(
      date: date,
      header: (snap["header"] as? String) ?? "",
      sub: (snap["sub"] as? String) ?? "",
      dot: (snap["dot"] as? Bool) ?? false,
      locale: (snap["locale"] as? String) ?? "zh"
    )
  }
}

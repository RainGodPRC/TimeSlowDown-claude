import WidgetKit
import SwiftUI

// MARK: - Entry View（超精简单屏，守原则9）

/// 只显示：一个安静点 + 一句 header + 一句 sub。不延长会话，不展示内容。
struct TSDWidgetEntryView: View {
  @Environment(\.widgetFamily) var family
  var entry: TSDWidgetProvider.Entry

  // 色板与 PWA styles.css #0f1014 一致
  private let bg = Color(red: 0.0588, green: 0.0627, blue: 0.0784)        // #0f1014
  private let ink = Color(red: 0.956, green: 0.960, blue: 0.968)         // #f4f5f6
  private let ink2 = Color(red: 0.580, green: 0.588, blue: 0.620)        // 次级文字
  private let ember = Color(red: 0.929, green: 0.580, blue: 0.314)       // 安静点亮色（不饱和）

  var body: some View {
    ZStack(alignment: .topLeading) {
      bg.ignoresSafeArea()

      VStack(alignment: .leading, spacing: 6) {
        // 安静点（dot），守原则5：只 0/1，无数字
        if entry.dot {
          Circle()
            .fill(ember)
            .frame(width: 7, height: 7)
            .opacity(0.85)
        } else {
          Circle()
            .stroke(ink2.opacity(0.25), lineWidth: 1)
            .frame(width: 7, height: 7)
        }

        Spacer().frame(height: 2)

        Text(entry.header.isEmpty ? "还没有可回访的瞬间" : entry.header)
          .font(.system(size: family == .systemSmall ? 13 : 14, weight: .semibold))
          .foregroundColor(ink)
          .lineLimit(2)
          .minimumScaleFactor(0.85)

        Text(entry.sub.isEmpty ? "先留下一个瞬间" : entry.sub)
          .font(.system(size: family == .systemSmall ? 11 : 12))
          .foregroundColor(ink2)
          .lineLimit(2)
      }
      .padding(12)
    }
  }
}

// MARK: - Widget 定义

@main
struct TSDWidget: Widget {
  let kind: String = "TSDWidget"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: TSDWidgetProvider()) { entry in
      if #available(iOS 17.0, *) {
        TSDWidgetEntryView(entry: entry)
          .containerBackground(.fill.tertiary, for: .widget)
      } else {
        // iOS < 17 fallback：用与 PWA 一致的 #0f1014 字面色（bg 私有属性跨 struct 不可见）
        TSDWidgetEntryView(entry: entry)
          .padding()
          .background(Color(red: 0.0588, green: 0.0627, blue: 0.0784))
      }
    }
    .configurationDisplayName("TSD 回访")
    .description("每天把你带回一个过去的瞬间。只一个安静点，不计数、不催。")
    .supportedFamilies([.systemSmall, .systemMedium])
  }
}

// MARK: - 预览

#Preview(as: .systemSmall) {
  TSDWidget()
} timeline: {
  TSDWidgetEntry(date: .now, header: "有一个旧瞬间想再见你", sub: "点开待 10 秒", dot: true, locale: "zh")
  TSDWidgetEntry(date: .now, header: "今天已重逢", sub: "明天还会有一个", dot: false, locale: "zh")
}

# TSD 分支交付清单 — 用户操作手册

> **状态**: 代码侧全就绪（HEAD `b39fbd5`，工作树干净）。以下 4 项需你在本机操作，无需写代码。
> **总预估**: 约 45 分钟（含等待）。
> **完成标志**: iPhone 上能看到 Widget + 能"问过去自己"+ iCloud 同步生效。

---

## ① WidgetKit Xcode 7 步（约 10 分钟）

**目标**: 让桌面小组件显示"今日回访瞬间"。

**详细步骤**: 见 [`docs/WIDGET-HANDOFF.md`](WIDGET-HANDOFF.md)（已写好，含每步截图级说明）。

**摘要**:
```bash
cd ~/TimeSlowDown/claude-code-branch
npm run sync          # build + cap copy
npx cap open ios      # 打开 Xcode
```
然后在 Xcode 里：加 Swift 文件到 App target → 建 Widget Extension → 配 App Group → 跑。

**成功标志**: Xcode 跑起 app → 长按桌面加 Widget → 选 TSD → 显示 systemSmall/Medium 卡片。

**遇问题**:
- `swiftc -typecheck` 已过（commit 9bf9ad9 修了 2 个真 bug）。若 Xcode 报 Calendar.date API 错 → 确认 iOS Deployment Target ≥ 17.0。
- App Group 不匹配 → 检查 `App.entitlements` 和 `TSDWidgetExtension.entitlements` 的 `group.com.tsd.app` 一致。

---

## ② LLM Worker 部署（约 5 分钟）

**目标**: 部署 Cloudflare Worker，让"问过去自己"走 Claude Haiku 4.5（而非本地镜像 fallback）。

**前置**: 装 wrangler（`npm i -g wrangler`）+ Cloudflare 账号 + Claude API key。

**命令**（在仓库根目录）:
```bash
npx wrangler deploy cloudflare/worker.js --name tsd-llm --compatibility-date 2026-07-01

# 设密钥（粘贴时不显示，不进 git）
npx wrangler secret put ANTHROPIC_API_KEY        # 粘贴 Claude API key (sk-ant-...)
npx wrangler secret put ALLOWED_ORIGIN           # 设为 https://raingodprc.github.io
```

**成功标志**:
- `wrangler deploy` 输出 `https://tsd-llm.<你的子域>.workers.dev`
- 在 PWA 设置页填入该 URL → "问过去自己"返回 `mode: "llm"`（非 `local-mirror`）。
- 测试: `curl -X POST https://tsd-llm.xxx.workers.dev/ask -H "Content-Type: application/json" -d '{"moment":{"quote":"test","kind":"tell","createdAt":"2026-01-01"},"question":"hi","locale":"zh"}'`

**回退**: Worker 挂了不影响 app——data.js 的 `askPastSelf` 自动三态降级到 `local-mirror`（本地镜像）。

**成本**: Haiku 4.5 约 $0.25/百万 input token，单次对话 ~500 token，月成本 < $1（轻度使用）。

---

## ③ iCloud CloudKit container（约 10 分钟）

**目标**: 让多设备同步瞬间（Shared Grove 当前为离线信物模式，iCloud LWW 抽象层已就绪待 provider 注入）。

**步骤**:
1. Apple Developer → Certificates, Identifiers & Profiles → Identifiers → 新建 CloudKit Container（如 `iCloud.com.tsd.app`）。
2. Xcode → App target → Signing & Capabilities → + Capability → iCloud → 勾 CloudKit → 选刚建的 container。
3. 告诉 Claude container ID → 注入 provider（代码侧抽象层已就绪，只差 ID）。

**成功标志**: 两台设备登录同 Apple ID → 一台建瞬间 → 另台可见。

**回退**: 不做这步 app 完全可用——只是单设备。Shared Grove 的离线信物模式不依赖 iCloud。

---

## ④ 签名 Team + App Store 元数据（约 20 分钟）

**目标**: 能装到真机 / 上架 TestFlight。

**步骤**:
1. Xcode → App target → Signing & Capabilities → Team 选你的 Apple Developer 账号。
2. Bundle Identifier 改成你的（如 `com.raingodprc.tsd`）。
3. App Store Connect → 新建 App → 填元数据（名称/描述/截图/隐私政策 URL）。
4. Xcode → Product → Archive → Distribute → TestFlight。

**成功标志**: TestFlight 构建处理完成 → 内测链接可装。

**注意**:
- App Store 审核: TSD 是健康类 app，**避免**声称"治疗/诊断"——文案用"记录/回访/重温"。
- 隐私政策: 因用到 CloudKit + Health（若有）需写隐私政策页（可用 GitHub Pages 托管）。
- Widget Extension 需单独签 same Team。

---

## 优先级建议

若时间有限，按此序：
1. **② LLM Worker**（5 分钟，立竿见影——"问过去自己"从本地镜像升级到真 LLM）
2. **① WidgetKit**（10 分钟，最显眼的产品差异化）
3. **④ 签名 + TestFlight**（20 分钟，能真机测）
4. **③ iCloud**（10 分钟，多设备同步，可后置）

## 验证全绿（代码侧已过）

| 检查 | 命令 | 状态 |
|---|---|---|
| JS 语法 | `node -c app.js data.js widget.js push.js sw.js i18n.js` | ✅ |
| Swift 类型 | `swiftc -typecheck`（iPhoneSimulator SDK） | ✅ |
| ESM | `node --check` | ✅ |
| Widget 单测 | `node tests/test-widget.js` | ✅ 11/11 |
| LLM 单测 | `node tests/test-llm.js` | ✅ 11/11 |
| Plist | `xmllint` 5 个 | ✅ |

## 录屏脚本（可选，用于交付留档）

```
1. 开终端: npm run sync && npx cap open ios   (10s)
2. Xcode 操作 WidgetKit 7 步                  (加快 4x, 2min)
3. 真机/模拟器演示 Widget 显示                  (15s)
4. wrangler deploy + secret put                (加快 3x, 30s)
5. PWA 设置页填 Worker URL → 问过去自己         (20s)
6. 展示三态: llm / llm-failed-fallback / local-mirror (各 5s)
```

---

关联: [[TimeSlowDown-Claude-Code-Branch]] · [[TimeSlowDown-Claude-Code-Retention-Design]] · `docs/WIDGET-HANDOFF.md`

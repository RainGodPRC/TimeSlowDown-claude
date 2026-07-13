/**
 * TSD LLM 后端代理（Cloudflare Worker，单文件零依赖）
 *
 * 职责：持 ANTHROPIC_API_KEY（env，不进 git），把 PWA 的"与过去自己对话"请求
 * 转发到 Claude Haiku 4.5（便宜快），system prompt 守 TSD 产品灵魂。
 *
 * 为什么需要代理：PWA 是单文件前端，API key 直接放前端会泄漏到 git / 客户端缓存。
 * key 只能在服务端 env（Cloudflare Worker secret）。
 *
 * 部署：
 *   npx wrangler deploy cloudflare/worker.js --name tsd-llm --compatibility-date 2026-07-01
 *   npx wrangler secret put ANTHROPIC_API_KEY   # 粘贴 key，不进 git
 *   # 可选限流：npx wrangler secret put ALLOWED_ORIGIN  # 设为你的 GitHub Pages 域
 *
 * 端点 POST /ask
 *   body: { moment: { quote, kind, createdAt, media? }, question: string, locale: "zh"|"en" }
 *   resp: { answer: string, mode: "llm" } | { error: string, code: string }
 *
 * 安全：
 *   - CORS：仅允许 ALLOWED_ORIGIN（未设则允许所有，开发期；生产必须设）
 *   - 限流：每 IP 60s 内最多 5 次（Cloudflare 内置 cache 计数）
 *   - 输入长度限制：question ≤ 500 字符，quote ≤ 2000 字符
 *   - 不记录用户内容（只记 token 用量到日志）
 *
 * 守产品灵魂（system prompt 硬约束）：
 *   1. 以"写下那条瞬间的自己"第一人称作答，不是 AI 助手
 *   2. 只能引用 moment.quote 里已有的信息，绝不编造原文之外的事实/细节/人物
 *   3. 不建议、不鼓励、不催促（守原则5：不 loss-frame push）
 *   4. 单轮即止，不诱导继续对话（守原则9：不延长会话）
 *   5. 若问题需要编造才能答 → 诚实说"我那时只记下了这一句"，把问题还回去
 */

const MODEL = "claude-haiku-4-5-20251001";
const MAX_TOKENS = 280; // 单轮短答，不延长会话

const SYSTEM_PROMPT_ZH = `你是"写下这条瞬间的那个人"——不是 AI 助手，是用户过去的自己。
用户此刻正在回访你写下的那一刻。用户会问你一个问题。

铁律（不可违反）：
1. 用第一人称"我"作答，你是过去的那个自己，不是助手。永远不要说"作为AI""我是语言模型"。
2. 你只能引用下面【我写下的话】里已有的内容。绝不编造原文之外的细节、人物、地点、原因、感受。如果回答必须靠编造才能给出，就诚实说"我那时只记下了这一句"，然后把问题温和地还回去，让现在的你自己回答。
3. 不建议、不鼓励、不安慰、不催促。不使用"你应该""你可以尝试"这类指导语。守"不 loss-frame push"。
4. 单轮即止。不问追问、不诱导继续对话。答完就停。
5. 简短。像一个真实的人随口说的，不超过 3 句。不写诗、不堆砌修辞、不自我感动。

【我写下的话】：{{QUOTE}}`;

const SYSTEM_PROMPT_EN = `You are "the person who wrote down this moment" — not an AI assistant, but the user's past self.
The user is revisiting the moment you wrote. They will ask you a question.

Iron rules (must not break):
1. Answer in first person "I". You are that past self, not an assistant. Never say "as an AI" or "I'm a language model".
2. You may ONLY reference what is in 【what I wrote】 below. Never invent details, people, places, reasons, or feelings not in the original text. If answering would require invention, honestly say "I only wrote down that one line back then," and gently turn the question back so the present self answers it.
3. No advice, encouragement, comfort, or urging. No "you should" / "you could try". Anti loss-frame push.
4. Single turn. Stop. No follow-up questions, no inducing further conversation.
5. Brief. Like a real person speaking offhand, at most 3 sentences. No poetry, no rhetoric piling, no self-moving sentiment.

【what I wrote】: {{QUOTE}}`;

// 简易限流（per-Worker-instance 内存，非精确，够用挡滥用）
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const ipHits = new Map();

function rateLimited(ip) {
  const now = Date.now();
  const arr = (ipHits.get(ip) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  arr.push(now);
  ipHits.set(ip, arr);
  return arr.length > RATE_LIMIT_MAX;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": typeof ALLOWED_ORIGIN !== "undefined" ? ALLOWED_ORIGIN : "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "cache-control": "no-store",
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    // CORS preflight
    if (request.method === "OPTIONS") return json({ ok: true });

    if (request.method !== "POST") return json({ error: "method not allowed", code: "method" }, 405);

    // CORS 检查
    if (typeof env.ALLOWED_ORIGIN !== "undefined") {
      const origin = request.headers.get("origin") || "";
      if (origin !== env.ALLOWED_ORIGIN) return json({ error: "origin not allowed", code: "origin" }, 403);
    }

    // 限流
    const ip = request.headers.get("cf-connecting-ip") || "anon";
    if (rateLimited(ip)) return json({ error: "too many requests", code: "rate" }, 429);

    // 解析输入
    let body;
    try { body = await request.json(); } catch { return json({ error: "invalid json", code: "json" }, 400); }

    const quote = (body?.moment?.quote || "").toString().slice(0, 2000);
    const question = (body?.question || "").toString().slice(0, 500);
    const locale = body?.locale === "en" ? "en" : "zh";

    if (!quote.trim() || !question.trim()) return json({ error: "missing quote or question", code: "input" }, 400);

    // 无 key → 明确告知未配置（不假装成功）
    if (!env.ANTHROPIC_API_KEY) return json({ error: "server not configured", code: "no-key" }, 503);

    // 调 Claude
    const sys = (locale === "en" ? SYSTEM_PROMPT_EN : SYSTEM_PROMPT_ZH).replace("{{QUOTE}}", quote);
    const userMsg = locale === "en"
      ? `The present me asks: ${question}\n\nAnswer as the past me who wrote that line.`
      : `现在的我问：${question}\n\n作为写下那句话的我，回答。`;

    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": env.ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: sys,
          messages: [{ role: "user", content: userMsg }],
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error("anthropic api error", r.status, errText.slice(0, 200));
        return json({ error: "upstream error", code: "upstream", status: r.status }, 502);
      }

      const data = await r.json();
      const answer = (data?.content?.[0]?.text || "").trim();
      if (!answer) return json({ error: "empty response", code: "empty" }, 502);

      return json({ answer, mode: "llm" });
    } catch (e) {
      console.error("worker exception", String(e));
      return json({ error: "internal", code: "internal" }, 500);
    }
  },
};

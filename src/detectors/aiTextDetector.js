/**
 * ScamGuard Bot — AITextDetector
 *
 * Analyses message text by sending it to an LLM (OpenAI or Anthropic).
 * The model is prompted to return a structured JSON verdict so we can
 * parse confidence scores and reasoning programmatically.
 *
 * Supported providers (set AI_PROVIDER in .env)
 * ───────────────────────────────────────────────
 *   "openai"    — uses the Chat Completions API  (default model: gpt-4o-mini)
 *   "anthropic" — uses the Messages API          (default model: claude-haiku-3)
 */

"use strict";

const https            = require("https");
const { BaseDetector } = require("./baseDetector");

// ─── Shared prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are ScamGuard, an expert at identifying scam messages in Discord servers.
Analyse the user message and respond ONLY with a valid JSON object — no prose, no markdown.

JSON schema:
{
  "isScam": boolean,
  "confidence": number,        // 0.0 (definitely safe) → 1.0 (definitely scam)
  "category": string,          // e.g. "crypto_scam", "phishing", "nitro_scam", "giveaway_fraud", "safe"
  "reason": string             // short, one-sentence explanation
}

Guidelines:
- Crypto investment promises with guaranteed returns → high confidence scam
- "Free Nitro" or Discord reward links → almost certainly scam
- Requests for seed phrases, private keys, or passwords → scam
- Suspicious URLs with urgent calls to action → likely scam
- Normal conversation, memes, questions → safe
`.trim();

// ─── Tiny HTTP helper (avoids adding axios/node-fetch as a dependency) ────────

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);

    const req = https.request(
      {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   "POST",
        headers:  { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(payload), ...headers },
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          if (res.statusCode >= 400) {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          } else {
            resolve(JSON.parse(data));
          }
        });
      }
    );

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
}

// ─── Detector class ───────────────────────────────────────────────────────────

class AITextDetector extends BaseDetector {
  constructor(config, logger) {
    super("AITextDetector", config, logger);

    const ai       = config.detection.ai;
    this.provider  = ai.provider;
    this.apiKey    = ai.apiKey;
    this.model     = ai.model;
    this.threshold = ai.threshold;
  }

  async init() {
    if (!this.apiKey) {
      throw new Error("[AITextDetector] AI_API_KEY is required when DETECTION_MODE=ai");
    }
    this.logger.info(`[${this.name}] Provider: ${this.provider} | Model: ${this.model} | Threshold: ${this.threshold}`);
  }

  /**
   * @param   {string}           text — raw message content
   * @returns {Promise<DetectionResult>}
   */
  async analyze(text) {
    if (!text || typeof text !== "string" || text.trim().length < 5) {
      return this._result(false, 0, "Message too short to analyse");
    }

    try {
      const verdict = await this._callProvider(text);
      const isScam  = verdict.isScam && verdict.confidence >= this.threshold;

      this.logger.debug(`[${this.name}] verdict=${JSON.stringify(verdict)}`);

      return this._result(
        isScam,
        verdict.confidence,
        verdict.reason,
        { category: verdict.category, raw: verdict }
      );
    } catch (err) {
      this.logger.error(`[${this.name}] API call failed — falling back to safe`, err);
      // Fail-safe: don't delete messages when the API is unreachable
      return this._result(false, 0, `API error: ${err.message}`);
    }
  }

  // ── Provider adapters ──────────────────────────────────────────────────────

  async _callProvider(text) {
    switch (this.provider) {
      case "openai":    return this._callOpenAI(text);
      case "anthropic": return this._callAnthropic(text);
      default:
        throw new Error(`Unknown AI provider: "${this.provider}"`);
    }
  }

  async _callOpenAI(text) {
    const data = await httpsPost(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model:       this.model,
        max_tokens:  200,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user",   content: text },
        ],
      }
    );

    return JSON.parse(data.choices[0].message.content);
  }

  async _callAnthropic(text) {
    const data = await httpsPost(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key":         this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      {
        model:      this.model || "claude-haiku-4-5-20251001",
        max_tokens: 200,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: "user", content: text }],
      }
    );

    return JSON.parse(data.content[0].text);
  }
}

module.exports = { AITextDetector };

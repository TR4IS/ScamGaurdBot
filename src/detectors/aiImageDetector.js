/**
 * ScamGuard Bot — AIImageDetector
 *
 * Analyses Discord image attachments using a vision-capable LLM.
 * Sends the image URL directly to the provider's API; no local
 * image processing is required.
 *
 * Supported providers (set AI_PROVIDER in .env)
 * ───────────────────────────────────────────────
 *   "openai"    — GPT-4o / GPT-4o-mini vision (recommended)
 *   "anthropic" — Claude claude-sonnet-4-20250514 vision
 */

"use strict";

const https            = require("https");
const { BaseDetector } = require("./baseDetector");

// ─── Vision prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are ScamGuard, an expert at identifying scam images in Discord servers.
The user will share an image URL. Analyse the image and return ONLY a valid JSON object — no prose, no markdown.

JSON schema:
{
  "isScam": boolean,
  "confidence": number,        // 0.0 (safe) → 1.0 (definitely scam)
  "category": string,          // e.g. "crypto_scam", "fake_giveaway", "phishing_site", "fake_investment", "safe"
  "reason": string             // concise one-sentence explanation
}

What to look for:
- Crypto investment screenshots with exaggerated profits
- "Send X BTC to receive 2X back" type graphics
- QR codes linked to wallets or phishing sites
- Fake Nitro / Steam / gift card promotions
- Urgency indicators: timers, "LIMITED OFFER", "ACT NOW"
- Poorly edited screenshots impersonating official services
`.trim();

// ─── Shared HTTP helper ───────────────────────────────────────────────────────

function httpsPost(url, headers, body) {
  return new Promise((resolve, reject) => {
    const parsed  = new URL(url);
    const payload = JSON.stringify(body);

    const req = https.request(
      {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   "POST",
        headers:  {
          "Content-Type":   "application/json",
          "Content-Length": Buffer.byteLength(payload),
          ...headers,
        },
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

class AIImageDetector extends BaseDetector {
  constructor(config, logger) {
    super("AIImageDetector", config, logger);

    const ai       = config.detection.ai;
    this.provider  = ai.provider;
    this.apiKey    = ai.apiKey;
    this.model     = ai.model;
    this.threshold = ai.threshold;
  }

  async init() {
    if (!this.apiKey) {
      throw new Error("[AIImageDetector] AI_API_KEY is required when DETECTION_MODE=ai");
    }
    this.logger.info(`[${this.name}] Provider: ${this.provider} | Model: ${this.model}`);
  }

  /**
   * @param   {string}           imageUrl — public Discord CDN image URL
   * @returns {Promise<DetectionResult>}
   */
  async analyze(imageUrl) {
    try {
      const verdict = await this._callProvider(imageUrl);
      const isScam  = verdict.isScam && verdict.confidence >= this.threshold;

      this.logger.debug(`[${this.name}] verdict=${JSON.stringify(verdict)}`);

      return this._result(
        isScam,
        verdict.confidence,
        verdict.reason,
        { category: verdict.category, raw: verdict }
      );
    } catch (err) {
      this.logger.error(`[${this.name}] API call failed`, err);
      return this._result(false, 0, `API error: ${err.message}`);
    }
  }

  // ── Provider adapters ──────────────────────────────────────────────────────

  async _callProvider(imageUrl) {
    switch (this.provider) {
      case "openai":    return this._callOpenAI(imageUrl);
      case "anthropic": return this._callAnthropic(imageUrl);
      default:
        throw new Error(`Unknown AI provider: "${this.provider}"`);
    }
  }

  async _callOpenAI(imageUrl) {
    const data = await httpsPost(
      "https://api.openai.com/v1/chat/completions",
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model:       this.model,
        max_tokens:  200,
        temperature: 0,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role:    "user",
            content: [
              { type: "image_url", image_url: { url: imageUrl, detail: "low" } },
              { type: "text",      text: "Is this image a scam?" },
            ],
          },
        ],
      }
    );
    return JSON.parse(data.choices[0].message.content);
  }

  async _callAnthropic(imageUrl) {
    const data = await httpsPost(
      "https://api.anthropic.com/v1/messages",
      {
        "x-api-key":         this.apiKey,
        "anthropic-version": "2023-06-01",
      },
      {
        model:      this.model || "claude-sonnet-4-20250514",
        max_tokens: 200,
        system:     SYSTEM_PROMPT,
        messages: [
          {
            role:    "user",
            content: [
              {
                type:   "image",
                source: { type: "url", url: imageUrl },
              },
              { type: "text", text: "Is this image a scam?" },
            ],
          },
        ],
      }
    );
    return JSON.parse(data.content[0].text);
  }
}

module.exports = { AIImageDetector };

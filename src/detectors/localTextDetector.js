/**
 * ScamGuard Bot — LocalTextDetector
 *
 * Analyses message text using a weighted heuristic scoring system.
 * No external API calls; runs entirely in-process.
 *
 * How the score is built
 * ──────────────────────
 * Each Rule has a weight (0–1). When a rule fires, its weight is added
 * to the running score. The final score is normalised to [0, 1].
 * If the score exceeds config.detection.local.textScoreThreshold the
 * message is flagged as a scam.
 *
 * Adding new rules
 * ────────────────
 * Add an entry to TEXT_RULES below. No other code needs to change.
 */

"use strict";

const { BaseDetector } = require("./baseDetector");

// ─── Rule definitions ─────────────────────────────────────────────────────────

/**
 * @typedef  {Object} Rule
 * @property {string}   name    — identifier shown in logs
 * @property {number}   weight  — contribution to the total score (0–1)
 * @property {Function} test    — (normalised: string) => boolean
 */

const TEXT_RULES = [
  // ── Crypto / investment bait ───────────────────────────────────────────────
  {
    name:   "crypto_keywords",
    weight: 0.25,
    test:   (t) =>
      /\b(bitcoin|btc|ethereum|eth|usdt|crypto|nft|token|wallet|blockchain|defi|airdrop|metamask)\b/i.test(t),
  },
  {
    name:   "guaranteed_profit",
    weight: 0.30,
    test:   (t) =>
      /\b(guaranteed|100%\s*profit|double your|triple your|risk[- ]?free|no[- ]?risk|free money)\b/i.test(t),
  },
  {
    name:   "suspicious_returns",
    weight: 0.20,
    test:   (t) =>
      /\b(\d{2,4}%\s*(profit|return|gain|roi)|x\d+\s*(return|profit)|make \$[\d,]+)\b/i.test(t),
  },

  // ── Urgency / social engineering ──────────────────────────────────────────
  {
    name:   "urgency_language",
    weight: 0.20,
    test:   (t) =>
      /\b(limited time|act now|don't miss|last chance|hurry|expires (today|soon)|claim now|today only)\b/i.test(t),
  },
  {
    name:   "suspicious_links",
    weight: 0.25,
    test:   (t) =>
      /https?:\/\/(?!discord\.com|discord\.gg|github\.com|wikipedia\.org)[\w.-]+\.\w{2,}\/?\S*/i.test(t),
  },
  {
    name:   "dm_solicitation",
    weight: 0.20,
    test:   (t) =>
      /\b(dm me|message me|contact me|slide into|send me a (dm|message)|telegram|whatsapp)\b/i.test(t),
  },

  // ── Giveaway / free stuff bait ────────────────────────────────────────────
  {
    name:   "giveaway_bait",
    weight: 0.20,
    test:   (t) =>
      /\b(giveaway|give away|free (bitcoin|eth|crypto|nft|gift card)|airdrop|drop your (wallet|address))\b/i.test(t),
  },
  {
    name:   "nitro_scam",
    weight: 0.35,
    test:   (t) =>
      /\b(free nitro|discord nitro|claim (your )?(free )?nitro|nitro giveaway)\b/i.test(t),
  },

  // ── Personal data fishing ─────────────────────────────────────────────────
  {
    name:   "credential_fishing",
    weight: 0.30,
    test:   (t) =>
      /\b(seed phrase|private key|recovery phrase|enter your password|verify your account|click (here|the link) to verify)\b/i.test(t),
  },

  // ── Stylistic tells ───────────────────────────────────────────────────────
  {
    name:   "excessive_caps",
    weight: 0.10,
    test:   (t) => {
      const letters = t.replace(/[^a-z]/gi, "");
      if (letters.length < 10) return false;
      const upper = t.replace(/[^A-Z]/g, "");
      return upper.length / letters.length > 0.6;
    },
  },
  {
    name:   "excessive_emoji",
    weight: 0.10,
    test:   (t) => {
      const emojiMatches = t.match(
        /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu
      ) || [];
      return emojiMatches.length > 8;
    },
  },
];

// ─── Maximum possible score (sum of all weights) ──────────────────────────────
const MAX_SCORE = TEXT_RULES.reduce((s, r) => s + r.weight, 0);

// ─── Detector class ───────────────────────────────────────────────────────────

class LocalTextDetector extends BaseDetector {
  constructor(config, logger) {
    super("LocalTextDetector", config, logger);
    this.threshold = config.detection.local.textScoreThreshold;
  }

  async init() {
    this.logger.info(`[${this.name}] Loaded ${TEXT_RULES.length} text rules. Threshold: ${this.threshold}`);
  }

  /**
   * @param   {string}           text — raw message content
   * @returns {Promise<DetectionResult>}
   */
  async analyze(text) {
    if (!text || typeof text !== "string") {
      return this._result(false, 0, "Empty or non-string input");
    }

    const normalised = text.toLowerCase().trim();
    const firedRules = [];
    let score        = 0;

    for (const rule of TEXT_RULES) {
      if (rule.test(normalised)) {
        score += rule.weight;
        firedRules.push(rule.name);
      }
    }

    const confidence = Math.min(1, score / MAX_SCORE);
    const isScam     = confidence >= this.threshold;

    this.logger.debug(`[${this.name}] score=${score.toFixed(2)} conf=${confidence.toFixed(2)} rules=[${firedRules.join(", ")}]`);

    return this._result(
      isScam,
      confidence,
      isScam
        ? `Scam signals detected: ${firedRules.join(", ")}`
        : "No significant scam signals found",
      { firedRules, rawScore: score }
    );
  }
}

module.exports = { LocalTextDetector };

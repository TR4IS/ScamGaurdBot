/**
 * ScamGuard Bot — Configuration
 *
 * All runtime settings are pulled from environment variables so that
 * no secrets ever live in source code. Sensible defaults are provided
 * for non-sensitive values.
 *
 * Detection modes
 * ───────────────
 *   "ai"    → Use OpenAI / Anthropic API calls for smarter detection.
 *   "local" → Pure JavaScript heuristics; no external API required.
 *
 * Set DETECTION_MODE=ai   in .env to enable AI-powered analysis.
 * Set DETECTION_MODE=local (default) for zero-dependency local mode.
 */

"use strict";

require("dotenv").config();

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Read an environment variable. Throws if it is missing and required.
 * @param {string}  key
 * @param {*}       [defaultValue]  — omit to make the var required
 * @returns {string}
 */
function env(key, defaultValue) {
  const value = process.env[key];
  if (value !== undefined) return value;
  if (defaultValue !== undefined) return defaultValue;
  throw new Error(`[Config] Missing required environment variable: ${key}`);
}

// ─── Config factory ───────────────────────────────────────────────────────────

function loadConfig() {
  const mode = env("DETECTION_MODE", "local");

  if (!["ai", "local"].includes(mode)) {
    throw new Error(
      `[Config] DETECTION_MODE must be "ai" or "local". Got: "${mode}"`
    );
  }

  return {
    discord: {
      token: env("DISCORD_TOKEN"),
      // Comma-separated channel IDs that the bot should ignore entirely
      ignoredChannels: env("IGNORED_CHANNELS", "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      // Comma-separated role IDs whose members are immune to deletion
      immuneRoles: env("IMMUNE_ROLES", "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    },

    detection: {
      // "ai" | "local"
      mode,

      // ── AI mode settings (only used when mode === "ai") ──────────────────
      ai: {
        provider: env("AI_PROVIDER", "openai"),          // "openai" | "anthropic"
        apiKey:   env("AI_API_KEY", ""),
        model:    env("AI_MODEL", "gpt-4o-mini"),
        // Confidence threshold [0-1] above which a message/image is flagged
        threshold: parseFloat(env("AI_THRESHOLD", "0.75")),
      },

      // ── Local mode settings (only used when mode === "local") ─────────────
      local: {
        // Image similarity: minimum % of pixels that must match a known scam
        imageSimilarityThreshold: parseFloat(
          env("IMAGE_SIMILARITY_THRESHOLD", "0.85")
        ),
        // Text: minimum score (0-1) before a message is flagged
        textScoreThreshold: parseFloat(env("TEXT_SCORE_THRESHOLD", "0.6")),
      },
    },

    paths: {
      scamImages: env("SCAM_IMAGES_DIR", "./scam_images"),
      logs:       env("LOGS_DIR", "./logs"),
    },

    actions: {
      // Delete the offending message automatically
      deleteMessage: env("ACTION_DELETE", "true") === "true",
      // Notify the channel after a deletion
      sendWarning: env("ACTION_SEND_WARNING", "true") === "true",
      // Timeout (mute) the offending member for N minutes (0 = disabled)
      timeoutMinutes: parseInt(env("ACTION_TIMEOUT_MINUTES", "0"), 10),
      // Log every action to the console / log files
      logActions: env("ACTION_LOG", "true") === "true",
    },
  };
}

module.exports = { loadConfig };

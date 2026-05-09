/**
 * ScamGuard Bot — MessageHandler
 *
 * Orchestrates text scam detection for incoming Discord messages.
 * Selects the correct detector based on config.detection.mode,
 * then executes the configured action pipeline on positive results.
 */

"use strict";

const { LocalTextDetector } = require("../detectors/localTextDetector");
const { AITextDetector }    = require("../detectors/aiTextDetector");
const { ActionRunner }      = require("../utils/actionRunner");

class MessageHandler {
  /**
   * @param {Object} config — full bot config
   * @param {Object} logger — Logger instance
   */
  constructor(config, logger) {
    this.config  = config;
    this.logger  = logger;
    this.actions = new ActionRunner(config, logger);

    this.detector =
      config.detection.mode === "ai"
        ? new AITextDetector(config, logger)
        : new LocalTextDetector(config, logger);
  }

  async init() {
    await this.detector.init();
    this.logger.info(`[MessageHandler] Using ${this.detector.name}`);
  }

  /**
   * Entry point called for every non-bot message.
   * @param {import('discord.js').Message} message
   */
  async handle(message) {
    // ── Pre-flight checks ────────────────────────────────────────────────────
    if (this._isIgnored(message)) return;

    const text = message.content?.trim();
    if (!text || text.length < 5) return; // nothing to analyse

    // ── Detect ───────────────────────────────────────────────────────────────
    let result;
    try {
      result = await this.detector.analyze(text);
    } catch (err) {
      this.logger.error("[MessageHandler] Detector threw unexpectedly", err);
      return;
    }

    // ── Act ──────────────────────────────────────────────────────────────────
    if (result.isScam) {
      this.logger.warn(
        `[MessageHandler] SCAM DETECTED | guild=${message.guild?.name} | author=${message.author.tag} | conf=${result.confidence.toFixed(2)} | reason=${result.reason}`
      );
      await this.actions.run(message, result, "text");
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  _isIgnored(message) {
    const { ignoredChannels, immuneRoles } = this.config.discord;

    if (ignoredChannels.includes(message.channel.id)) return true;

    const member = message.member;
    if (member && immuneRoles.some((id) => member.roles.cache.has(id))) {
      return true;
    }

    return false;
  }
}

module.exports = MessageHandler;

/**
 * ScamGuard Bot — ImageHandler
 *
 * Inspects every image attachment on incoming Discord messages.
 * Selects LocalImageDetector or AIImageDetector based on config,
 * then hands positive results to ActionRunner.
 */

"use strict";

const { LocalImageDetector } = require("../detectors/localImageDetector");
const { AIImageDetector }    = require("../detectors/aiImageDetector");
const { ActionRunner }       = require("../utils/actionRunner");

// Attachment content types we consider images
const IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

class ImageHandler {
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
        ? new AIImageDetector(config, logger)
        : new LocalImageDetector(config, logger);
  }

  async init() {
    await this.detector.init();
    this.logger.info(`[ImageHandler] Using ${this.detector.name}`);
  }

  /**
   * Entry point called for every non-bot message.
   * @param {import('discord.js').Message} message
   */
  async handle(message) {
    if (this._isIgnored(message)) return;

    // Collect all image attachments
    const imageAttachments = message.attachments.filter(
      (att) => att.contentType && IMAGE_TYPES.has(att.contentType.split(";")[0].trim())
    );

    if (imageAttachments.size === 0) return;

    // Analyse each image independently; act on the first scam found
    for (const [, attachment] of imageAttachments) {
      let result;
      try {
        result = await this.detector.analyze(attachment.url);
      } catch (err) {
        this.logger.error("[ImageHandler] Detector threw unexpectedly", err);
        continue;
      }

      if (result.isScam) {
        this.logger.warn(
          `[ImageHandler] SCAM IMAGE | guild=${message.guild?.name} | author=${message.author.tag} | file=${attachment.name} | conf=${result.confidence.toFixed(2)} | reason=${result.reason}`
        );
        await this.actions.run(message, result, "image");
        // One confirmed scam is enough — delete the whole message and stop
        return;
      }
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

module.exports = ImageHandler;

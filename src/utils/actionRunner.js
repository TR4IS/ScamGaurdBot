/**
 * ScamGuard Bot — ActionRunner
 *
 * Executes the configured action pipeline after a scam is detected.
 * All actions are independent; a failure in one does not abort the rest.
 *
 * Configured actions (see config.actions):
 *   deleteMessage  — delete the offending message
 *   sendWarning    — post an ephemeral warning in the channel
 *   timeoutMinutes — mute the member for N minutes (0 = disabled)
 *   logActions     — write a structured log entry
 */

"use strict";

const { EmbedBuilder } = require("discord.js");

class ActionRunner {
  /**
   * @param {Object} config — full bot config
   * @param {Object} logger — Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
  }

  /**
   * Run all enabled actions.
   * @param {import('discord.js').Message} message
   * @param {import('../detectors/baseDetector').DetectionResult} result
   * @param {"text"|"image"} type
   */
  async run(message, result, type) {
    const tasks = [];

    if (this.config.actions.deleteMessage) {
      tasks.push(this._delete(message, result));
    }

    if (this.config.actions.sendWarning) {
      tasks.push(this._warn(message, result, type));
    }

    if (this.config.actions.timeoutMinutes > 0) {
      tasks.push(this._timeout(message));
    }

    if (this.config.actions.logActions) {
      this._log(message, result, type);
    }

    await Promise.allSettled(tasks);
  }

  // ── Action implementations ─────────────────────────────────────────────────

  async _delete(message, result) {
    try {
      if (message.deletable) {
        await message.delete();
        this.logger.info(
          `[ActionRunner] Deleted message ${message.id} by ${message.author.tag}`
        );
      }
    } catch (err) {
      this.logger.warn("[ActionRunner] Could not delete message", err.message);
    }
  }

  async _warn(message, result, type) {
    const typeLabel = type === "image" ? "🖼️ Image" : "💬 Message";
    const embed = new EmbedBuilder()
      .setColor(0xff3333)
      .setTitle("🚨 ScamGuard — Scam Detected & Removed")
      .setDescription(
        `A suspicious ${typeLabel.toLowerCase()} was removed from this channel.`
      )
      .addFields(
        { name: "Reason",     value: result.reason,                                     inline: false },
        { name: "Confidence", value: `${(result.confidence * 100).toFixed(1)}%`,        inline: true  },
        { name: "Detector",   value: result.detectorName,                               inline: true  },
        { name: "Type",       value: typeLabel,                                          inline: true  }
      )
      .setFooter({ text: "If this was a mistake, please contact a moderator." })
      .setTimestamp();

    try {
      const warning = await message.channel.send({ embeds: [embed] });
      // Auto-delete the warning after 30 s so it doesn't clutter the channel
      setTimeout(() => warning.delete().catch(() => {}), 30_000);
    } catch (err) {
      this.logger.warn("[ActionRunner] Could not send warning", err.message);
    }
  }

  async _timeout(message) {
    const minutes = this.config.actions.timeoutMinutes;
    const ms      = minutes * 60 * 1_000;

    try {
      const member = message.member;
      if (member && member.moderatable) {
        await member.timeout(ms, "ScamGuard: automated scam detection");
        this.logger.info(
          `[ActionRunner] Timed out ${message.author.tag} for ${minutes} minute(s)`
        );
      }
    } catch (err) {
      this.logger.warn("[ActionRunner] Could not apply timeout", err.message);
    }
  }

  _log(message, result, type) {
    this.logger.info("[ActionRunner] ACTION LOG", {
      event:       "scam_detected",
      type,
      guildId:     message.guild?.id,
      guildName:   message.guild?.name,
      channelId:   message.channel.id,
      channelName: message.channel.name,
      authorId:    message.author.id,
      authorTag:   message.author.tag,
      messageId:   message.id,
      detector:    result.detectorName,
      confidence:  result.confidence,
      reason:      result.reason,
      timestamp:   new Date().toISOString(),
    });
  }
}

module.exports = { ActionRunner };

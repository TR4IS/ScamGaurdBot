/**
 * ScamGuard Bot — Logger
 *
 * Lightweight structured logger that writes to stdout and optionally
 * to a rotating daily log file. No heavy dependencies required.
 *
 * Usage:
 *   const logger = new Logger("ComponentName");
 *   logger.info("Message detected");
 *   logger.warn("Low confidence", { score: 0.5 });
 *   logger.error("Something broke", error);
 */

"use strict";

const fs   = require("fs");
const path = require("path");

// ─── ANSI colour codes (terminal only) ───────────────────────────────────────
const COLORS = {
  reset:  "\x1b[0m",
  grey:   "\x1b[90m",
  green:  "\x1b[32m",
  yellow: "\x1b[33m",
  red:    "\x1b[31m",
  cyan:   "\x1b[36m",
};

const LEVEL_META = {
  debug: { label: "DEBUG", color: COLORS.grey   },
  info:  { label: "INFO ", color: COLORS.green  },
  warn:  { label: "WARN ", color: COLORS.yellow },
  error: { label: "ERROR", color: COLORS.red    },
};

// ─── Logger class ─────────────────────────────────────────────────────────────

class Logger {
  /**
   * @param {string} namespace  — component name shown in every log line
   * @param {string} [logsDir]  — if provided, also writes to a daily log file
   */
  constructor(namespace, logsDir = null) {
    this.namespace = namespace;
    this.logsDir   = logsDir;

    if (logsDir) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  debug(msg, meta = null) { this._write("debug", msg, meta); }
  info (msg, meta = null) { this._write("info",  msg, meta); }
  warn (msg, meta = null) { this._write("warn",  msg, meta); }
  error(msg, meta = null) { this._write("error", msg, meta); }

  // ── Internal ───────────────────────────────────────────────────────────────

  _write(level, msg, meta) {
    const { label, color } = LEVEL_META[level];
    const now   = new Date();
    const ts    = now.toISOString();
    const ns    = this.namespace.padEnd(14);

    // Build the plain-text line (written to file / CI environments)
    const plain = `[${ts}] [${label}] [${ns}] ${msg}${
      meta ? " " + this._formatMeta(meta) : ""
    }`;

    // Coloured version for the terminal
    const coloured = `${COLORS.grey}[${ts}]${COLORS.reset} ${color}[${label}]${COLORS.reset} ${COLORS.cyan}[${ns}]${COLORS.reset} ${msg}${
      meta ? " " + this._formatMeta(meta) : ""
    }`;

    // Write to console
    if (level === "error") {
      process.stderr.write(coloured + "\n");
    } else {
      process.stdout.write(coloured + "\n");
    }

    // Write to file (plain text, no ANSI codes)
    if (this.logsDir) {
      const date     = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const filePath = path.join(this.logsDir, `scamguard-${date}.log`);
      fs.appendFileSync(filePath, plain + "\n");
    }
  }

  _formatMeta(meta) {
    if (meta instanceof Error) {
      return `\n  ${meta.stack || meta.message}`;
    }
    if (typeof meta === "object") {
      return JSON.stringify(meta);
    }
    return String(meta);
  }
}

module.exports = { Logger };

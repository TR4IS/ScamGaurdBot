/**
 * ScamGuard Bot — BaseDetector
 *
 * Abstract base class that every detector must extend.
 * Enforces a consistent interface so handlers can swap
 * detectors without knowing their implementation details.
 *
 * Subclasses MUST implement:
 *   async init()             — load resources, models, reference data
 *   async analyze(payload)   — return a DetectionResult
 */

"use strict";

// ─── DetectionResult value object ─────────────────────────────────────────────

/**
 * @typedef  {Object} DetectionResult
 * @property {boolean} isScam       — final verdict
 * @property {number}  confidence   — [0, 1]; 1 = certain scam
 * @property {string}  reason       — human-readable explanation
 * @property {string}  detectorName — which detector produced this result
 * @property {Object}  [meta]       — optional extra data (matched pattern, etc.)
 */

// ─── BaseDetector ─────────────────────────────────────────────────────────────

class BaseDetector {
  /**
   * @param {string} name    — detector identifier used in logs & results
   * @param {Object} config  — full bot config object
   * @param {Object} logger  — Logger instance
   */
  constructor(name, config, logger) {
    if (new.target === BaseDetector) {
      throw new TypeError("BaseDetector is abstract — do not instantiate directly.");
    }

    this.name   = name;
    this.config = config;
    this.logger = logger;
  }

  /**
   * Called once at startup. Load any heavy resources here
   * (file system reads, model loading, API warm-up pings, …).
   * @returns {Promise<void>}
   */
  async init() {
    throw new Error(`${this.name}.init() is not implemented.`);
  }

  /**
   * Analyse a payload and return a DetectionResult.
   * @param   {*}                      payload — detector-specific (text string, Buffer, …)
   * @returns {Promise<DetectionResult>}
   */
  async analyze(_payload) {
    throw new Error(`${this.name}.analyze() is not implemented.`);
  }

  // ── Helpers available to every subclass ───────────────────────────────────

  /**
   * Build a valid DetectionResult object.
   * @param {boolean} isScam
   * @param {number}  confidence
   * @param {string}  reason
   * @param {Object}  [meta]
   * @returns {DetectionResult}
   */
  _result(isScam, confidence, reason, meta = {}) {
    return {
      isScam,
      confidence: Math.min(1, Math.max(0, confidence)),
      reason,
      detectorName: this.name,
      meta,
    };
  }
}

module.exports = { BaseDetector };

/**
 * ScamGuard Bot — LocalImageDetector
 *
 * Compares incoming images against a folder of known scam images
 * using perceptual hashing (pHash). No external API required.
 *
 * How it works
 * ─────────────
 * 1. On startup, all images in scam_images/ are hashed and cached.
 * 2. When a Discord attachment arrives it is hashed too.
 * 3. Hamming distance between the hashes determines similarity.
 *    A small distance → images look nearly identical → flag as scam.
 *
 * Watching for new scam images
 * ─────────────────────────────
 * The detector uses fs.watch() so adding an image to scam_images/
 * automatically updates the cache — no restart required.
 *
 * Dependencies
 * ─────────────
 * jimp  — pure-JS image processing (no native binaries needed)
 */

"use strict";

const fs               = require("fs");
const path             = require("path");
const https            = require("https");
const http             = require("http");
const { BaseDetector } = require("./baseDetector");

// Lazily required so the bot still starts if jimp is not installed
// (the handler will log a clear error rather than crashing).
let Jimp;

// ─── pHash implementation ─────────────────────────────────────────────────────

/**
 * Compute a 64-bit perceptual hash of an image loaded by Jimp.
 * Returns a 64-character binary string (each char is '0' or '1').
 * @param {import('jimp')} image
 * @returns {string}
 */
function computePHash(image) {
  const SIZE = 32; // work image side length
  const DCT  = 8;  // top-left DCT block size

  // Step 1 — Resize to 32×32 greyscale
  const small = image
    .clone()
    .resize(SIZE, SIZE)
    .greyscale();

  // Step 2 — Build pixel matrix
  const pixels = [];
  for (let y = 0; y < SIZE; y++) {
    pixels[y] = [];
    for (let x = 0; x < SIZE; x++) {
      const { r } = Jimp.intToRGBA(small.getPixelColor(x, y));
      pixels[y][x] = r;
    }
  }

  // Step 3 — 2-D DCT (only the top-left 8×8 block matters)
  const dct = [];
  for (let u = 0; u < DCT; u++) {
    dct[u] = [];
    for (let v = 0; v < DCT; v++) {
      let sum = 0;
      for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
          sum +=
            pixels[y][x] *
            Math.cos(((2 * x + 1) * u * Math.PI) / (2 * SIZE)) *
            Math.cos(((2 * y + 1) * v * Math.PI) / (2 * SIZE));
        }
      }
      const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
      const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
      dct[u][v] = (2 / SIZE) * cu * cv * sum;
    }
  }

  // Step 4 — Flatten DCT block, skip DC term
  const flat = [];
  for (let u = 0; u < DCT; u++) {
    for (let v = 0; v < DCT; v++) {
      if (u === 0 && v === 0) continue; // skip DC
      flat.push(dct[u][v]);
    }
  }

  // Step 5 — Median threshold → binary hash
  const sorted = [...flat].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  return flat.map((v) => (v >= median ? "1" : "0")).join("");
}

/**
 * Hamming distance between two equal-length binary strings.
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function hammingDistance(a, b) {
  let dist = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) dist++;
  }
  return dist;
}

// ─── Image download helper ────────────────────────────────────────────────────

function downloadBuffer(url) {
  return new Promise((resolve, reject) => {
    const proto   = url.startsWith("https") ? https : http;
    const chunks  = [];
    proto.get(url, (res) => {
      res.on("data", (c) => chunks.push(c));
      res.on("end",  ()  => resolve(Buffer.concat(chunks)));
      res.on("error",    reject);
    }).on("error", reject);
  });
}

// ─── Detector class ───────────────────────────────────────────────────────────

class LocalImageDetector extends BaseDetector {
  constructor(config, logger) {
    super("LocalImageDetector", config, logger);

    this.scamImagesDir = config.paths.scamImages;
    this.threshold     = config.detection.local.imageSimilarityThreshold;

    /** @type {Map<string, string>} filename → pHash */
    this.hashCache = new Map();
  }

  async init() {
    // Require jimp lazily
    try {
      Jimp = require("jimp");
    } catch {
      throw new Error(
        "[LocalImageDetector] 'jimp' is not installed. Run: npm install jimp"
      );
    }

    // Ensure the folder exists
    fs.mkdirSync(this.scamImagesDir, { recursive: true });

    // Load initial hashes
    await this._reloadHashes();

    // Watch for additions / removals at runtime
    fs.watch(this.scamImagesDir, async (event, filename) => {
      if (!filename) return;
      this.logger.info(`[${this.name}] scam_images changed (${event}: ${filename}), reloading hashes…`);
      await this._reloadHashes();
    });

    this.logger.info(
      `[${this.name}] Ready with ${this.hashCache.size} reference image(s). Threshold: ${this.threshold}`
    );
  }

  /**
   * @param   {string}           imageUrl — Discord CDN URL of the attachment
   * @returns {Promise<DetectionResult>}
   */
  async analyze(imageUrl) {
    if (this.hashCache.size === 0) {
      return this._result(false, 0, "No reference scam images loaded yet");
    }

    let incomingHash;
    try {
      const buffer = await downloadBuffer(imageUrl);
      const img    = await Jimp.read(buffer);
      incomingHash = computePHash(img);
    } catch (err) {
      this.logger.warn(`[${this.name}] Could not process image: ${err.message}`);
      return this._result(false, 0, `Image processing failed: ${err.message}`);
    }

    let bestMatch = null;
    let minDist   = Infinity;
    const HASH_LEN = incomingHash.length;

    for (const [filename, refHash] of this.hashCache) {
      if (refHash.length !== HASH_LEN) continue;
      const dist = hammingDistance(incomingHash, refHash);
      if (dist < minDist) {
        minDist   = dist;
        bestMatch = filename;
      }
    }

    const similarity   = 1 - minDist / HASH_LEN;
    const isScam       = similarity >= this.threshold;

    this.logger.debug(
      `[${this.name}] best match: ${bestMatch} similarity=${similarity.toFixed(3)} dist=${minDist}`
    );

    return this._result(
      isScam,
      similarity,
      isScam
        ? `Image is ${(similarity * 100).toFixed(1)}% similar to known scam: ${bestMatch}`
        : `No close match found (best: ${bestMatch}, ${(similarity * 100).toFixed(1)}%)`,
      { bestMatch, similarity, hammingDistance: minDist }
    );
  }

  // ── Internals ──────────────────────────────────────────────────────────────

  async _reloadHashes() {
    this.hashCache.clear();

    const SUPPORTED = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif", ".bmp"]);

    let files;
    try {
      files = fs.readdirSync(this.scamImagesDir);
    } catch {
      return; // directory missing — will be created later
    }

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!SUPPORTED.has(ext)) continue;

      const filePath = path.join(this.scamImagesDir, file);
      try {
        const img  = await Jimp.read(filePath);
        const hash = computePHash(img);
        this.hashCache.set(file, hash);
        this.logger.debug(`[${this.name}] Hashed: ${file}`);
      } catch (err) {
        this.logger.warn(`[${this.name}] Could not hash ${file}: ${err.message}`);
      }
    }
  }
}

module.exports = { LocalImageDetector };

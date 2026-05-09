[![English](https://img.shields.io/badge/English-current-blue)](./README.md)
[![العربية](https://img.shields.io/badge/العربية-available-green)](./README.ar.md)

# ScamGuard Bot 🛡️

> Discord bot that automatically detects and removes scam messages and images from any server it joins.

---

## Features

| Feature | Local Mode | AI Mode |
|---|---|---|
| Text scam detection | ✅ Weighted heuristics (11 rules) | ✅ LLM-powered (GPT-4o / Claude) |
| Image scam detection | ✅ Perceptual hash (pHash) | ✅ Vision model analysis |
| No external API needed | ✅ | ❌ (requires API key) |
| Nuanced understanding | ⚠️ Rule-based | ✅ Context-aware |
| Runtime cost | Free | Per-token |
| Auto-delete messages | ✅ | ✅ |
| Channel warning embeds | ✅ | ✅ |
| Member timeout | ✅ | ✅ |
| Hot-reload scam images | ✅ | ✅ |
| Structured JSON logs | ✅ | ✅ |

---

## Quick Start

### 1. Clone & install

```bash
git clone https://github.com/your-org/scamguard-bot.git
cd scamguard-bot
npm install
```

### 2. Configure

```bash
cp .env.example .env
# Edit .env with your favourite editor
```

At minimum you need:

```
DISCORD_TOKEN=your_bot_token
DETECTION_MODE=local          # or "ai"
```

### 3. Add scam images

Drop any reference scam images into the `scam_images/` folder. The bot watches this folder at runtime — adding or removing images takes effect immediately without a restart.

```
scam_images/
  crypto_doubler.png
  fake_nitro.jpg
  phishing_qr.webp
```

### 4. Run

```bash
npm start          # production
npm run dev        # development (auto-restart on file changes)
```

---

## Project Structure

```
scamguard-bot/
├── src/
│   ├── index.js                     # Entry point — boots the bot
│   ├── config/
│   │   └── config.js                # All settings via env vars
│   ├── detectors/
│   │   ├── baseDetector.js          # Abstract base class
│   │   ├── localTextDetector.js     # Heuristic text analysis
│   │   ├── aiTextDetector.js        # LLM text analysis
│   │   ├── localImageDetector.js    # pHash image matching
│   │   └── aiImageDetector.js       # Vision model image analysis
│   ├── handlers/
│   │   ├── messageHandler.js        # Orchestrates text detection
│   │   └── imageHandler.js          # Orchestrates image detection
│   └── utils/
│       ├── logger.js                # Structured logger
│       └── actionRunner.js          # Delete / warn / timeout actions
├── scam_images/                     # Drop known scam images here
├── logs/                            # Auto-created daily log files
├── .env.example                     # Environment variable template
└── package.json
```

---

## Detection Modes

### Local Mode (default)

Set `DETECTION_MODE=local`. No internet connection or API key required.

**Text detection** — 11 weighted rules covering:
- Crypto / investment keywords
- Guaranteed profit language
- Suspicious URLs
- DM solicitation
- Giveaway / Nitro bait
- Credential phishing
- Stylistic tells (all-caps, excessive emoji)

Each rule has a weight. The final score is normalised to [0, 1]. Messages above `TEXT_SCORE_THRESHOLD` (default `0.6`) are deleted.

**Image detection** — Perceptual hashing (pHash):
1. All images in `scam_images/` are hashed at startup.
2. Incoming attachments are hashed the same way.
3. Hamming distance between hashes determines visual similarity.
4. Images above `IMAGE_SIMILARITY_THRESHOLD` (default `0.85`) are deleted.

### AI Mode

Set `DETECTION_MODE=ai` and provide `AI_API_KEY`.

Supported providers:

| Provider | Set `AI_PROVIDER=` | Recommended model |
|---|---|---|
| OpenAI | `openai` | `gpt-4o-mini` |
| Anthropic | `anthropic` | `claude-haiku-4-5-20251001` |

The LLM returns a structured JSON verdict (`isScam`, `confidence`, `category`, `reason`). Messages / images above `AI_THRESHOLD` (default `0.75`) are flagged.

---

## Configuration Reference

| Variable | Default | Description |
|---|---|---|
| `DISCORD_TOKEN` | **required** | Your bot token |
| `DETECTION_MODE` | `local` | `local` or `ai` |
| `IGNORED_CHANNELS` | `` | Comma-separated channel IDs to skip |
| `IMMUNE_ROLES` | `` | Comma-separated role IDs immune to deletions |
| `AI_PROVIDER` | `openai` | `openai` or `anthropic` |
| `AI_API_KEY` | `` | API key (AI mode only) |
| `AI_MODEL` | `gpt-4o-mini` | Model name |
| `AI_THRESHOLD` | `0.75` | Confidence cutoff for AI mode |
| `IMAGE_SIMILARITY_THRESHOLD` | `0.85` | pHash similarity cutoff |
| `TEXT_SCORE_THRESHOLD` | `0.60` | Heuristic score cutoff |
| `ACTION_DELETE` | `true` | Delete scam messages |
| `ACTION_SEND_WARNING` | `true` | Post a warning embed |
| `ACTION_TIMEOUT_MINUTES` | `0` | Mute member (0 = disabled) |
| `ACTION_LOG` | `true` | Write structured logs |

---

## Adding a New Text Rule (Local Mode)

Open `src/detectors/localTextDetector.js` and add an entry to `TEXT_RULES`:

```js
{
  name:   "your_rule_name",
  weight: 0.25,                    // 0–1, contribution to score
  test:   (t) => /your_regex/i.test(t),
},
```

No other code needs to change.

---

## Adding a New Detector

1. Create `src/detectors/myDetector.js` that extends `BaseDetector`.
2. Implement `async init()` and `async analyze(payload)`.
3. Return a `DetectionResult` using `this._result(isScam, confidence, reason, meta)`.
4. Plug it into `MessageHandler` or `ImageHandler` (or both).

---

## Discord Bot Permissions

The bot requires the following permissions in each server:

- **Read Messages / View Channels**
- **Send Messages** (for warning embeds)
- **Manage Messages** (to delete scam messages)
- **Moderate Members** (optional — only if `ACTION_TIMEOUT_MINUTES > 0`)
- **Message Content Intent** (enable in the Developer Portal)

---

## License

MIT © ScamGuard Contributors

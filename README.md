# ScamGuard Bot

[![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)](LICENSE)
[![Built with](https://img.shields.io/badge/Built%20with-Node.js-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org)

Discord bot that automatically detects and removes scam messages and images from any server.

---

## Features

| Feature | Local Mode | AI Mode |
|---|---|---|
| Text scam detection | Weighted heuristics (11 rules) | LLM-powered (GPT-4o / Claude) |
| Image scam detection | Perceptual hash (pHash) | Vision model analysis |
| No external API needed | Yes | No (requires API key) |
| Auto-delete messages | Yes | Yes |
| Channel warning embeds | Yes | Yes |
| Member timeout | Yes | Yes |
| Hot-reload scam images | Yes | Yes |
| Structured JSON logs | Yes | Yes |

---

## Quick Start

```bash
git clone https://github.com/TR4IS/ScamGaurdBot.git
cd ScamGaurdBot
npm install
```

Copy `.env.example` to `.env` and fill in at minimum:

```
DISCORD_TOKEN=your_bot_token
DETECTION_MODE=local
```

```bash
npm start
```

---

## Scam Images

Drop reference images into the `scam_images/` folder. The bot watches this folder at runtime — no restart needed.

---

## Detection Modes

**Local** (default) — no API key needed. Text is scored by 11 weighted rules (crypto keywords, phishing, giveaway bait, etc.). Images are matched by perceptual hash (pHash) against your `scam_images/` folder.

**AI** — set `DETECTION_MODE=ai` and provide `AI_API_KEY`. Supports OpenAI (`gpt-4o-mini`) and Anthropic (`claude-haiku-4-5-20251001`). Returns a structured verdict with confidence score.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `DISCORD_TOKEN` | required | Your bot token |
| `DETECTION_MODE` | `local` | `local` or `ai` |
| `IGNORED_CHANNELS` | — | Comma-separated channel IDs to skip |
| `IMMUNE_ROLES` | — | Comma-separated role IDs immune to deletions |
| `AI_PROVIDER` | `openai` | `openai` or `anthropic` |
| `AI_API_KEY` | — | API key (AI mode only) |
| `AI_MODEL` | `gpt-4o-mini` | Model name |
| `AI_THRESHOLD` | `0.75` | Confidence cutoff for AI mode |
| `IMAGE_SIMILARITY_THRESHOLD` | `0.85` | pHash similarity cutoff |
| `TEXT_SCORE_THRESHOLD` | `0.60` | Heuristic score cutoff |
| `ACTION_DELETE` | `true` | Delete scam messages |
| `ACTION_SEND_WARNING` | `true` | Post a warning embed |
| `ACTION_TIMEOUT_MINUTES` | `0` | Mute member (0 = disabled) |

---

## Discord Bot Permissions

- Read Messages / View Channels
- Send Messages
- Manage Messages
- Moderate Members (only if timeout is enabled)
- Message Content Intent (enable in the Developer Portal)

---

## Author

**TR4IS** — [github.com/TR4IS](https://github.com/TR4IS)

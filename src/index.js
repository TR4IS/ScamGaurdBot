/**
 * ScamGuard Bot — Entry Point
 * Initializes the Discord client and all subsystems.
 */

"use strict";

const { Client, GatewayIntentBits, Partials } = require("discord.js");
const { loadConfig }                           = require("./config/config");
const { Logger }                               = require("./utils/logger");
const MessageHandler                           = require("./handlers/messageHandler");
const ImageHandler                             = require("./handlers/imageHandler");

// ─── Bootstrap ───────────────────────────────────────────────────────────────

async function main() {
  const config = loadConfig();
  const logger = new Logger("Bot");

  // ── Discord client setup ──────────────────────────────────────────────────
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
    ],
    partials: [Partials.Message, Partials.Channel],
  });

  // ── Subsystem initialization ──────────────────────────────────────────────
  const messageHandler = new MessageHandler(config, logger);
  const imageHandler   = new ImageHandler(config, logger);

  await messageHandler.init();
  await imageHandler.init();

  // ── Event wiring ─────────────────────────────────────────────────────────
  client.once("ready", () => {
    logger.info(`ScamGuard online — logged in as ${client.user.tag}`);
    logger.info(`Detection mode: ${config.detection.mode.toUpperCase()}`);
  });

  client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    await messageHandler.handle(message);
    await imageHandler.handle(message);
  });

  client.on("error", (err) => logger.error("Discord client error", err));

  // ── Connect ───────────────────────────────────────────────────────────────
  await client.login(config.discord.token);
}

main().catch((err) => {
  console.error("[FATAL] Bot failed to start:", err);
  process.exit(1);
});

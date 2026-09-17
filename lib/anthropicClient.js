const Anthropic = require("@anthropic-ai/sdk");

const MODEL = "claude-haiku-4-5";

let client;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "Missing ANTHROPIC_API_KEY. Copy .env.example to .env and fill it in."
      );
    }
    client = new Anthropic();
  }
  return client;
}

module.exports = { getClient, MODEL };

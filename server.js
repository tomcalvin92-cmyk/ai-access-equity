// Local dev server only. In production this project deploys to Vercel,
// which serves index.html/styles.css/script.js as static files and turns
// everything under /api into serverless functions automatically — this
// file does the same thing locally with Express so `npm run dev` works
// without the Vercel CLI.
require("dotenv").config();
const express = require("express");
const path = require("path");

const guidanceHandler = require("./api/guidance");
const synthesizeIdeasHandler = require("./api/synthesize-ideas");

const app = express();
const PORT = process.env.PORT || 5173;

app.use(express.json());
app.use(express.static(__dirname));

app.post("/api/guidance", guidanceHandler);
app.post("/api/synthesize-ideas", synthesizeIdeasHandler);

app.listen(PORT, () => {
  console.log(`AI Access Equity running at http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY || !process.env.SUPABASE_URL) {
    console.warn(
      "Warning: .env is missing ANTHROPIC_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY — copy .env.example to .env and fill them in, or the /api routes will fail."
    );
  }
});

const { createClient } = require("@supabase/supabase-js");

// Server-side only: uses the service role key, which bypasses Row Level
// Security entirely. Never send this key to the browser — only the
// SUPABASE_ANON_KEY (used in config.js on the frontend) is safe there.
function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy .env.example to .env and fill them in."
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

module.exports = { getServiceClient };

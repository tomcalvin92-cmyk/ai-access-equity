const supabaseClient =
  window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL && window.APP_CONFIG.SUPABASE_ANON_KEY
    ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY)
    : null;

function setRing(ringId, valueId, pct) {
  const ring = document.getElementById(ringId);
  const value = document.getElementById(valueId);
  ring.style.setProperty("--pct", pct);
  value.textContent = `${pct}%`;
}

function renderBreakdown(containerId, rows, labelKey) {
  const container = document.getElementById(containerId);
  if (!rows || rows.length === 0) {
    container.innerHTML = '<p class="breakdown-empty">No data yet.</p>';
    return;
  }
  const max = Math.max(...rows.map((r) => r.n));
  container.innerHTML = rows
    .slice(0, 6)
    .map(
      (r) => `
      <div class="bar-row">
        <span class="bar-label">${r[labelKey]}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${(r.n / max) * 100}%"></div></div>
        <span class="bar-value">${r.n}</span>
      </div>`
    )
    .join("");
}

async function loadStats() {
  if (!supabaseClient) return;
  const { data: stats, error } = await supabaseClient.from("response_stats").select("*").single();
  if (error) {
    console.error("Failed to load stats:", error.message);
    return;
  }
  const total = stats.total_responses || 0;
  document.getElementById("dash-total").textContent = total;
  setRing("ring-no-access", "ring-no-access-value", total ? stats.pct_no_access ?? 0 : 0);
  setRing("ring-shadow", "ring-shadow-value", total ? stats.pct_shadow_ai ?? 0 : 0);

  const { count: ideaCount, error: ideaErr } = await supabaseClient
    .from("ideas")
    .select("id", { count: "exact", head: true });
  document.getElementById("dash-ideas").textContent = ideaErr ? "—" : (ideaCount ?? 0);

  const { data: sectors } = await supabaseClient.from("sector_breakdown").select("*");
  renderBreakdown("sector-breakdown", sectors, "sector");

  const { data: companySizes } = await supabaseClient.from("company_size_breakdown").select("*");
  renderBreakdown("company-breakdown", companySizes, "company_size");
}

async function loadClusters() {
  const list = document.getElementById("cluster-list");
  if (!supabaseClient) {
    list.innerHTML = '<li class="idea-empty">Not connected to a database yet.</li>';
    return;
  }

  const { data: clusters, error } = await supabaseClient
    .from("synthesized_ideas")
    .select("*")
    .order("supporting_idea_count", { ascending: false });

  if (error) {
    console.error("Failed to load synthesized ideas:", error.message);
    list.innerHTML = '<li class="idea-empty">Couldn’t load solution candidates.</li>';
    return;
  }

  list.innerHTML = "";
  if (!clusters || clusters.length === 0) {
    list.innerHTML = '<li class="idea-empty">No synthesis run yet — click "Run synthesis" once there are a few ideas submitted.</li>';
    return;
  }

  clusters.forEach((c) => {
    const li = document.createElement("li");
    li.className = "cluster-item";
    li.innerHTML = `
      <span class="cluster-tag ${c.tag}">${c.tag === "strong-support" ? "Strong support" : "Out of the box"}</span>
      <p>${c.summary}</p>
      <p class="cluster-count">${c.supporting_idea_count} supporting idea${c.supporting_idea_count === 1 ? "" : "s"}</p>
    `;
    list.appendChild(li);
  });
}

document.getElementById("synth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const secret = document.getElementById("admin-secret").value;
  const status = document.getElementById("synth-status");
  status.textContent = "Running synthesis…";

  try {
    const res = await fetch("/api/synthesize-ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Secret": secret },
    });
    const body = await res.json();
    if (!res.ok) {
      status.textContent = body.error || "Synthesis failed.";
      return;
    }
    if (body.skipped) {
      status.textContent = body.reason;
      return;
    }
    status.textContent = `Done — ${body.clusters.length} solution candidate${body.clusters.length === 1 ? "" : "s"} found.`;
    loadClusters();
  } catch (err) {
    console.error("synthesis request failed:", err);
    status.textContent = "Couldn't reach the synthesis service.";
  }
});

loadStats();
loadClusters();

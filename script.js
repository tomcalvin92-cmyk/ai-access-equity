// --- Supabase client ---------------------------------------------------
// Reads window.APP_CONFIG from config.js. Until that file has real values,
// every call below fails gracefully (logged, not thrown) so the page still
// renders — see README for how to fill in config.js and supabase/schema.sql.

const supabaseClient =
  window.APP_CONFIG && window.APP_CONFIG.SUPABASE_URL && window.APP_CONFIG.SUPABASE_ANON_KEY
    ? window.supabase.createClient(window.APP_CONFIG.SUPABASE_URL, window.APP_CONFIG.SUPABASE_ANON_KEY)
    : null;

if (!supabaseClient) {
  console.warn(
    "Supabase isn't configured yet — fill in config.js with your project URL and anon key (see README)."
  );
}

// --- Survey form: multi-step navigation -------------------------------------

(function initSurvey() {
  const form = document.getElementById("survey-form");
  const steps = Array.from(form.querySelectorAll("fieldset.step"));
  const total = steps.length;
  let current = 1;

  const btnBack = document.getElementById("btn-back");
  const btnNext = document.getElementById("btn-next");
  const btnSubmit = document.getElementById("btn-submit");
  const progressFill = document.getElementById("progress-fill");
  const stepCurrentEl = document.getElementById("step-current");
  document.getElementById("step-total").textContent = total;

  function render() {
    steps.forEach((s, i) => { s.hidden = (i + 1) !== current; });
    btnBack.hidden = current === 1;
    btnNext.hidden = current === total;
    btnSubmit.hidden = current !== total;
    progressFill.style.width = `${(current / total) * 100}%`;
    stepCurrentEl.textContent = current;
  }

  function stepValid(stepEl) {
    const fields = stepEl.querySelectorAll("select[required], textarea[required], input[required]");
    for (const f of fields) {
      if (f.type === "checkbox" ? !f.checked : !f.value) {
        f.reportValidity();
        return false;
      }
    }
    return true;
  }

  btnNext.addEventListener("click", () => {
    const currentEl = steps[current - 1];
    if (!stepValid(currentEl)) return;
    current = Math.min(total, current + 1);
    render();
  });
  btnBack.addEventListener("click", () => {
    current = Math.max(1, current - 1);
    render();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const lastEl = steps[total - 1];
    if (!stepValid(lastEl)) return;

    if (!supabaseClient) {
      alert("Survey isn't connected to a database yet — see README for setup.");
      return;
    }

    const raw = Object.fromEntries(new FormData(form).entries());
    // Generated client-side and inserted explicitly (rather than relying on
    // the column default + .select() to read it back) because there is no
    // anon SELECT policy on `responses` by design — nobody but the row's
    // own author should be able to read individual responses back, and
    // Postgres RLS runs an implicit SELECT-policy check on any RETURNING
    // clause, which `.select()` after insert would trigger.
    const id = crypto.randomUUID();
    const record = {
      id,
      age: raw.age,
      employment: raw.employment,
      sector: raw.sector,
      training_required: raw.training_required,
      hands_on_access: raw.hands_on_access,
      shadow_ai: raw.shadow_ai,
      confidence_impact: raw.confidence_impact ? parseInt(raw.confidence_impact, 10) : null,
      story: raw.story || null,
      help_needed: raw.help_needed,
      consent: raw.consent === "on",
    };

    btnSubmit.disabled = true;
    const { error } = await supabaseClient.from("responses").insert(record);
    btnSubmit.disabled = false;

    if (error) {
      console.error("Failed to save response:", error.message);
      alert("Something went wrong saving your response. Please try again.");
      return;
    }

    form.querySelectorAll("fieldset.step").forEach(s => s.hidden = true);
    document.querySelector(".form-nav").hidden = true;
    document.getElementById("survey-thanks").hidden = false;
    document.getElementById("progress-fill").style.width = "100%";

    updateStats();
    fetchGuidance(id, record);
  });

  render();
})();

async function fetchGuidance(id, record) {
  const guidanceBox = document.getElementById("survey-guidance");
  const guidanceText = document.getElementById("survey-guidance-text");
  guidanceBox.hidden = false;

  try {
    const res = await fetch("/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...record }),
    });
    const body = await res.json();
    guidanceText.textContent = res.ok
      ? body.guidance
      : "Couldn't generate personalized guidance right now — your response was still saved.";
  } catch (err) {
    console.error("guidance request failed:", err);
    guidanceText.textContent = "Couldn't reach the guidance service — your response was still saved.";
  }
}

// --- Ideas board -------------------------------------------------------------

(function initIdeas() {
  const form = document.getElementById("idea-form");
  const list = document.getElementById("idea-list");

  async function renderIdeas() {
    if (!supabaseClient) {
      list.innerHTML = '<li class="idea-empty">Ideas board isn’t connected to a database yet.</li>';
      return;
    }

    const { data: ideas, error } = await supabaseClient
      .from("ideas")
      .select("*")
      .order("votes", { ascending: false });

    if (error) {
      console.error("Failed to load ideas:", error.message);
      list.innerHTML = '<li class="idea-empty">Couldn’t load ideas right now.</li>';
      return;
    }

    list.innerHTML = "";
    if (!ideas || ideas.length === 0) {
      list.innerHTML = '<li class="idea-empty">No ideas yet — be the first.</li>';
    } else {
      ideas.forEach((idea) => {
        const li = document.createElement("li");
        li.className = "idea-item";
        const upvote = document.createElement("div");
        upvote.className = "idea-upvote";
        upvote.innerHTML = `<strong>${idea.votes}</strong>votes`;
        upvote.addEventListener("click", async () => {
          const { error: voteError } = await supabaseClient.rpc("increment_idea_vote", { idea_id: idea.id });
          if (voteError) {
            console.error("Failed to upvote:", voteError.message);
            return;
          }
          renderIdeas();
        });
        const p = document.createElement("p");
        p.textContent = idea.text;
        li.appendChild(upvote);
        li.appendChild(p);
        list.appendChild(li);
      });
    }

    document.getElementById("stat-ideas").textContent = ideas ? ideas.length : 0;
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = form.querySelector('input[name="idea"]');
    const text = input.value.trim();
    if (!text || !supabaseClient) return;

    const { error } = await supabaseClient.from("ideas").insert({ text });
    if (error) {
      console.error("Failed to submit idea:", error.message);
      alert("Couldn't submit that idea — please try again.");
      return;
    }
    input.value = "";
    renderIdeas();
  });

  renderIdeas();
  window.renderIdeas = renderIdeas;
})();

// --- Stats ---------------------------------------------------------------

function animateCount(el, target, duration = 900) {
  const start = 0;
  const startTime = performance.now();
  function tick(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    el.textContent = Math.round(start + (target - start) * progress);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

async function updateStats() {
  if (!supabaseClient) return;

  const { data: stats, error } = await supabaseClient
    .from("response_stats")
    .select("*")
    .single();

  if (error) {
    console.error("Failed to load stats:", error.message);
    return;
  }

  const total = stats.total_responses || 0;

  const heroNum = document.querySelector(".hero-stat-num");
  if (heroNum) animateCount(heroNum, total);

  const statTotal = document.getElementById("stat-total");
  if (statTotal) animateCount(statTotal, total);

  document.getElementById("stat-no-access").textContent =
    total ? `${stats.pct_no_access ?? 0}%` : "—";
  document.getElementById("stat-shadow").textContent =
    total ? `${stats.pct_shadow_ai ?? 0}%` : "—";
}

updateStats();

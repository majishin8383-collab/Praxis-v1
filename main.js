(() => {
  const STORAGE_KEY = "praxis_v1_data";

  const $ = (id) => document.getElementById(id);

  const state = {
    entries: [], // { id, type: "checkin"|"plan", createdAt, payload }
  };

  function nowISO() {
    return new Date().toISOString();
  }

  function prettyTime(iso) {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit"
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.entries)) state.entries = parsed.entries;
    } catch (e) {
      // ignore
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function addEntry(type, payload) {
    state.entries.unshift({
      id: crypto?.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(),
      type,
      createdAt: nowISO(),
      payload
    });
    save();
  }

  function setMsg(el, text) {
    el.textContent = text || "";
    if (!text) return;
    clearTimeout(setMsg._t);
    setMsg._t = setTimeout(() => { el.textContent = ""; }, 2500);
  }

  // Tabs
  function setActiveTab(key) {
    document.querySelectorAll(".tab").forEach(btn => {
      const on = btn.dataset.tab === key;
      btn.classList.toggle("is-active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    document.querySelectorAll(".panel").forEach(p => p.classList.remove("is-active"));
    const panel = $(`tab-${key}`);
    if (panel) panel.classList.add("is-active");

    if (key === "history") renderHistory();
  }

  function wireTabs() {
    document.querySelectorAll(".tab").forEach(btn => {
      btn.addEventListener("click", () => setActiveTab(btn.dataset.tab));
    });
  }

  // Check-in
  function wireCheckin() {
    $("saveCheckin").addEventListener("click", () => {
      const mood = Number($("mood").value);
      const notes = $("notes").value.trim();

      if (!Number.isFinite(mood) || mood < 0 || mood > 10) {
        setMsg($("checkinMsg"), "Mood must be a number from 0 to 10.");
        return;
      }
      if (!notes) {
        setMsg($("checkinMsg"), "Add a short note so this check-in is useful later.");
        return;
      }

      addEntry("checkin", { mood, notes });
      $("mood").value = "";
      $("notes").value = "";
      setMsg($("checkinMsg"), "Saved.");
    });

    $("quickPlan").addEventListener("click", () => {
      // light “guided” generation rules (not AI yet)
      const notes = $("notes").value.trim();
      const mood = $("mood").value.trim();

      // basic defaults
      $("theme").value = mood ? (Number(mood) <= 4 ? "Stability" : Number(mood) <= 7 ? "Momentum" : "Expansion") : "Stability";
      $("p1").value = notes ? "Stabilize: one thing that lowers stress today" : "";
      $("p2").value = "Build: one thing that improves your life direction";
      $("p3").value = "Maintain: one small responsibility to keep clean";
      $("step").value = "Open the task and do the first 2 minutes";
      $("timebox").value = "25";

      setActiveTab("plan");
      setMsg($("planMsg"), "Drafted a plan. Edit it to fit your reality, then save.");
    });
  }

  // Plan
  function wirePlan() {
    $("savePlan").addEventListener("click", () => {
      const theme = $("theme").value.trim();
      const p1 = $("p1").value.trim();
      const p2 = $("p2").value.trim();
      const p3 = $("p3").value.trim();
      const step = $("step").value.trim();
      const timebox = Number($("timebox").value);

      if (!p1 || !p2 || !p3 || !step) {
        setMsg($("planMsg"), "Fill in priorities 1–3 and the smallest next step.");
        return;
      }
      if (!Number.isFinite(timebox) || timebox < 5 || timebox > 180) {
        setMsg($("planMsg"), "Time box must be 5–180 minutes.");
        return;
      }

      addEntry("plan", { theme, priorities: [p1, p2, p3], step, timebox });
      setMsg($("planMsg"), "Saved.");
    });

    $("clearPlan").addEventListener("click", () => {
      ["theme","p1","p2","p3","step","timebox"].forEach(id => $(id).value = "");
      setMsg($("planMsg"), "Cleared.");
    });
  }

  // History
  function renderHistory() {
    const root = $("history");
    root.innerHTML = "";

    if (!state.entries.length) {
      root.innerHTML = `<div class="item"><div class="content muted">No entries yet. Save a check-in or plan.</div></div>`;
      return;
    }

    for (const e of state.entries.slice(0, 100)) {
      const typeLabel = e.type === "checkin" ? "Check-in" : "Plan";
      const badge = `<span class="badge">${typeLabel}</span>`;
      const when = prettyTime(e.createdAt);

      let content = "";
      if (e.type === "checkin") {
        content = `Mood: ${e.payload.mood}/10\n\n${e.payload.notes}`;
      } else {
        const t = e.payload.theme ? `Theme: ${e.payload.theme}\n\n` : "";
        const ps = (e.payload.priorities || []).map((p,i)=>`${i+1}. ${p}`).join("\n");
        content = `${t}${ps}\n\nSmallest step: ${e.payload.step}\nTime box: ${e.payload.timebox} min`;
      }

      const div = document.createElement("div");
      div.className = "item";
      div.innerHTML = `
        <div class="meta">
          <div>${badge}</div>
          <div>${when}</div>
        </div>
        <div class="content">${escapeHtml(content)}</div>
      `;
      root.appendChild(div);
    }
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function wireHistory() {
    $("refreshHistory").addEventListener("click", renderHistory);

    $("wipeAll").addEventListener("click", () => {
      const ok = confirm("Delete ALL saved Praxis v1 data on this device? This cannot be undone.");
      if (!ok) return;
      state.entries = [];
      save();
      renderHistory();
    });
  }

  // Export / Import
  function wireData() {
    $("exportBtn").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = `praxis-v1-export-${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      URL.revokeObjectURL(url);
      setMsg($("dataMsg"), "Exported.");
    });

    $("importFile").addEventListener("change", async (ev) => {
      const file = ev.target.files?.[0];
      if (!file) return;

      try {
        const text = await file.text();
        const parsed = JSON.parse(text);

        if (!parsed || !Array.isArray(parsed.entries)) {
          setMsg($("dataMsg"), "Invalid file. Expected a Praxis export JSON.");
          return;
        }

        // Merge: keep newest first, dedupe by id
        const merged = [...parsed.entries, ...state.entries];
        const seen = new Set();
        const cleaned = [];
        for (const e of merged) {
          if (!e || !e.id || seen.has(e.id)) continue;
          seen.add(e.id);
          cleaned.push(e);
        }
        // sort by createdAt desc when possible
        cleaned.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));

        state.entries = cleaned;
        save();
        setMsg($("dataMsg"), "Imported and merged.");
      } catch (err) {
        setMsg($("dataMsg"), "Could not import. Make sure it’s valid JSON.");
      } finally {
        ev.target.value = "";
      }
    });
  }

  function init() {
    $("year").textContent = String(new Date().getFullYear());
    load();
    wireTabs();
    wireCheckin();
    wirePlan();
    wireHistory();
    wireData();
    setActiveTab("checkin");
  }

  document.addEventListener("DOMContentLoaded", init);
})();

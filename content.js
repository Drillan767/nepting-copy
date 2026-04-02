/**
 * Nepting Copy Helper - Content Script
 * Runs on https://nepsa2.nepting.com/alladmin/
 *
 * Phase 1 (Observer 1): Watches document.body for a <table> to appear
 * Phase 2 (Observer 2): Watches the table for row selection (class count delta)
 * Resets on hashchange (SPA navigation between tabs)
 */

let tableObserver = null;
let bodyObserver  = null;
let baseline      = null;
let currentState  = "idle";   // "idle" | "waiting" | "ready"
let currentCSV    = null;

// ─── Utilities ────────────────────────────────────────────────────────────────

function computeBaseline(table) {
  const rows = Array.from(table.querySelectorAll("tr"));
  if (rows.length === 0) return null;
  return Math.min(...rows.map((r) => r.classList.length));
}

function findSelectedRow(table, base) {
  console.log({ base })
  return (
    Array.from(table.querySelectorAll("tr")).find(
      (r) => r.classList.length >= base + 2
    ) || null
  );
}

function rowToCSV(row) {
  return Array.from(row.querySelectorAll("td"))
    .map((td) => td.innerText.trim().replace(/,/g, " ")) // escape commas inside cells
    .join(",");
}

// ─── State setters ────────────────────────────────────────────────────────────

function setState(state, csv = null) {
  currentState = state;
  currentCSV   = csv;
}

// ─── Phase 2: Table observer ──────────────────────────────────────────────────

function startTableObserver(table) {
  if (tableObserver) tableObserver.disconnect();

  baseline = computeBaseline(table);
  setState("waiting");

  tableObserver = new MutationObserver(() => {

    baseline = computeBaseline(table);
    if (baseline === null) return;

    const selected = findSelectedRow(table, baseline);

    if (selected) {
      setState("ready", rowToCSV(selected));
    } else if (currentState !== "waiting") {
      setState("waiting");
    }
  });

  tableObserver.observe(table, {
    subtree: true,
    attributes: true,
    attributeFilter: ["class"],
    childList: true,
  });
}

// ─── Phase 1: Body observer — waits for <table> to appear ────────────────────

function startBodyObserver() {
  if (tableObserver) { tableObserver.disconnect(); tableObserver = null; }
  if (bodyObserver)  { bodyObserver.disconnect();  bodyObserver  = null; }
  baseline = null;
  setState("idle");

  const existing = document.querySelector("div:has(table > colgroup) + div table");
  if (existing) {
    startTableObserver(existing);
    return;
  }

  bodyObserver = new MutationObserver(() => {
    const table = document.querySelector("div:has(table > colgroup) + div table");
    if (table) {
      bodyObserver.disconnect();
      bodyObserver = null;
      startTableObserver(table);
    }
  });

  bodyObserver.observe(document.body, { childList: true, subtree: true });
}

// ─── Cmd+C shortcut ──────────────────────────────────────────────────────────

window.addEventListener("keydown", async (e) => {
  if (e.metaKey && e.key === "c" && currentState === "ready") {
    e.preventDefault();
    await navigator.clipboard.writeText(currentCSV);
    setState("waiting");
  }
});

// ─── SPA navigation ───────────────────────────────────────────────────────────

window.addEventListener("hashchange", () => {
  startBodyObserver();
});

// ─── Boot ─────────────────────────────────────────────────────────────────────

startBodyObserver();

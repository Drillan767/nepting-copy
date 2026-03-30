/**
 * Nepting Copy Helper - Popup Script
 *
 * Listens for messages from content.js:
 *   ROW_SELECTED  { csv: string }  → enable button, store CSV
 *   ROW_DESELECTED                 → disable button, clear CSV
 *
 * On button click → write stored CSV to clipboard
 */

const btn        = document.getElementById("copy-btn");
const dot        = document.getElementById("dot");
const statusText = document.getElementById("status-text");
const feedback   = document.getElementById("feedback");

let pendingCSV = null;
let feedbackTimer = null;

// ─── State helpers ────────────────────────────────────────────────────────────

function setReady(csv) {
  pendingCSV = csv;
  btn.disabled = false;
  dot.className = "dot ready";
  statusText.textContent = "Ligne choisie — Prêt à copier !";
}

function setIdle() {
  pendingCSV = null;
  btn.disabled = true;
  dot.className = "dot idle";
  statusText.textContent = "En attente de la sélection d'une ligne…";
  hideFeedback();
}

function setWaiting() {
  pendingCSV = null;
  btn.disabled = true;
  dot.className = "dot waiting";
  statusText.textContent = "Tableau trouvé — Sélectionnez une ligne…";
}

function showFeedback() {
  feedback.classList.add("visible");
  if (feedbackTimer) clearTimeout(feedbackTimer);
  feedbackTimer = setTimeout(hideFeedback, 2500);
}

function hideFeedback() {
  feedback.classList.remove("visible");
}

// ─── Message listener (from content.js) ──────────────────────────────────────

// Use chrome.runtime for Chrome; Firefox also supports this via the WebExtensions polyfill
const runtime = typeof browser !== "undefined" ? browser.runtime : chrome.runtime;

runtime.onMessage.addListener((message) => {
  if (message.type === "ROW_SELECTED") {
    setReady(message.csv);
  } else if (message.type === "ROW_DESELECTED") {
    setIdle();
  } else if (message.type === "TABLE_FOUND") {
    setWaiting();
  }
});

// ─── Copy button ──────────────────────────────────────────────────────────────

btn.addEventListener("click", async () => {
  if (!pendingCSV) return;

  await navigator.clipboard.writeText(pendingCSV);
  showFeedback();
  setWaiting();

  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (!tabs[0]) return;
    chrome.tabs.sendMessage(tabs[0].id, { type: "COPY_DONE" });
  });
});

// ─── On popup open: ask the active tab for current state ─────────────────────

// Query the active tab's content script to sync state when popup opens
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;
  chrome.tabs.sendMessage(tabs[0].id, { type: "GET_STATE" }, (response) => {
    if (chrome.runtime.lastError) return; // tab not ready yet
    if (!response) return;

    if (response.state === "ready")   setReady(response.csv);
    else if (response.state === "waiting") setWaiting();
    else setIdle();
  });
});

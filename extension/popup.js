"use strict";
const $u = document.getElementById("url");
const $s = document.getElementById("status");
function set(m, c) { $s.textContent = m || ""; $s.className = c || ""; }
function extractId(text) {
  if (!text) return null;
  let m = text.match(/(?:twitter\.com|x\.com|vxtwitter\.com|fxtwitter\.com|fixupx\.com)\/[^/]+\/status(?:es)?\/(\d{1,25})/i);
  if (m) return m[1];
  m = text.trim().match(/^(\d{1,25})$/);
  return m ? m[1] : null;
}
function run() {
  const id = extractId($u.value);
  if (!id) { set("no tweet ID in that text", "err"); return; }
  set("resolving " + id + " …");
  chrome.runtime.sendMessage(
    { type: "grab", id, includePhotos: document.getElementById("photos").checked },
    (r) => {
      if (r && r.ok) set("saved " + r.ok + " file" + (r.ok > 1 ? "s" : "") + " → Downloads/Magpie", "ok");
      else set(r && r.error ? r.error : "failed", "err");
    }
  );
}
document.getElementById("go").addEventListener("click", run);
$u.addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
$u.addEventListener("paste", (e) => {
  const t = (e.clipboardData || window.clipboardData).getData("text");
  if (extractId(t)) setTimeout(run, 50);
});
// prefill from the active tab if it's a tweet
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const u = tabs && tabs[0] && tabs[0].url;
  if (u && extractId(u)) $u.value = u;
});

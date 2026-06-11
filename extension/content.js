"use strict";

/* Magpie content script — adds a download button to the action bar of any
   tweet that contains a <video> (covers both videos and GIFs on x.com).
   If x.com markup changes and buttons stop appearing, the popup's
   paste-a-link mode still works. */

const SVG =
  '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="m7 11 5 5 5-5"/><path d="M5 21h14"/></svg>';

function tweetIdFor(article) {
  // permalink anchor inside the tweet (the timestamp link)
  const t = article.querySelector('a[href*="/status/"] time');
  const href = t ? t.closest("a").getAttribute("href") : "";
  let m = href.match(/\/status\/(\d+)/);
  if (m) return m[1];
  // detail page: main tweet has no timestamp link — fall back to the URL
  m = location.pathname.match(/\/status\/(\d+)/);
  return m ? m[1] : null;
}

function makeButton(article) {
  const btn = document.createElement("div");
  btn.className = "magpie-btn";
  btn.setAttribute("role", "button");
  btn.setAttribute("aria-label", "Download video (Magpie)");
  btn.title = "Download video (Magpie)";
  btn.innerHTML = SVG;
  btn.style.cssText =
    "display:flex;align-items:center;justify-content:center;" +
    "width:34px;height:34px;margin-left:4px;border-radius:50%;" +
    "color:#71767b;cursor:pointer;transition:color .15s,background .15s;";
  btn.addEventListener("mouseenter", () => {
    if (!btn.dataset.busy) {
      btn.style.color = "#e8b14e";
      btn.style.background = "rgba(232,177,78,.12)";
    }
  });
  btn.addEventListener("mouseleave", () => {
    if (!btn.dataset.busy) {
      btn.style.color = "#71767b";
      btn.style.background = "none";
    }
  });
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (btn.dataset.busy) return;
    const id = tweetIdFor(article);
    if (!id) {
      flash(btn, "✕", "#d98080");
      return;
    }
    btn.dataset.busy = "1";
    btn.style.color = "#e8b14e";
    btn.innerHTML = "…";
    chrome.runtime.sendMessage({ type: "grab", id }, (resp) => {
      delete btn.dataset.busy;
      if (resp && resp.ok) flash(btn, "✓", "#8fc98f");
      else {
        console.warn("Magpie:", resp && resp.error);
        flash(btn, "✕", "#d98080");
      }
    });
  });
  return btn;
}

function flash(btn, ch, color) {
  btn.textContent = ch;
  btn.style.color = color;
  setTimeout(() => {
    btn.innerHTML = SVG;
    btn.style.color = "#71767b";
    btn.style.background = "none";
  }, 1800);
}

function scan() {
  const tweets = document.querySelectorAll('article[data-testid="tweet"]:not([data-magpie])');
  for (const article of tweets) {
    if (!article.querySelector("video")) continue; // videos & GIFs only
    const bar = article.querySelector('[role="group"]');
    if (!bar) continue;
    article.setAttribute("data-magpie", "1");
    bar.appendChild(makeButton(article));
  }
}

const obs = new MutationObserver(() => {
  clearTimeout(obs._t);
  obs._t = setTimeout(scan, 250);
});
obs.observe(document.body, { childList: true, subtree: true });
scan();

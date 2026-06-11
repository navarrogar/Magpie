"use strict";

/* ---------- resolvers (same logic as magpie.html) ---------- */

async function getJSON(url) {
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}

function resFromUrl(u) {
  const m = u.match(/\/(\d{2,4})x(\d{2,4})\//);
  return m ? m[1] + "x" + m[2] : null;
}

async function resolveFx(id) {
  const d = await getJSON("https://api.fxtwitter.com/status/" + id);
  if (!d.tweet) throw new Error(d.message || "no tweet");
  const t = d.tweet;
  const items = [];
  const media = t.media || {};
  for (const v of media.videos || []) {
    const variants = (v.variants || [])
      .filter((x) => /mp4/i.test(x.content_type || "") && x.url)
      .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))
      .map((x) => ({ url: x.url, label: resFromUrl(x.url) || "mp4" }));
    if (!variants.length && v.url)
      variants.push({ url: v.url, label: v.width && v.height ? v.width + "x" + v.height : "mp4" });
    items.push({ kind: v.type === "gif" ? "gif" : "video", variants });
  }
  for (const p of media.photos || []) {
    items.push({
      kind: "photo",
      variants: [{ url: p.url + (p.url.includes("?") ? "&" : "?") + "name=orig", label: "orig" }]
    });
  }
  return { handle: t.author?.screen_name || "x", items };
}

async function resolveVx(id) {
  const d = await getJSON("https://api.vxtwitter.com/Twitter/status/" + id);
  if (!d.tweetID) throw new Error("no tweet");
  const items = [];
  for (const m of d.media_extended || []) {
    if (m.type === "video" || m.type === "gif") {
      items.push({
        kind: m.type,
        variants: [{ url: m.url, label: m.size ? m.size.width + "x" + m.size.height : "mp4" }]
      });
    } else if (m.type === "image") {
      items.push({
        kind: "photo",
        variants: [{ url: m.url + (m.url.includes("?") ? "&" : "?") + "name=orig", label: "orig" }]
      });
    }
  }
  return { handle: d.user_screen_name || "x", items };
}

async function resolve(id) {
  const errs = [];
  for (const fn of [resolveFx, resolveVx]) {
    try {
      return await fn(id);
    } catch (e) {
      errs.push(e.message);
    }
  }
  throw new Error(errs.join(" / "));
}

/* ---------- download ---------- */

async function grab(id, includePhotos) {
  const data = await resolve(id);
  let items = data.items;
  if (!includePhotos) items = items.filter((i) => i.kind !== "photo");
  if (!items.length) throw new Error("no downloadable media in this post");
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    const best = items[i].variants[0];
    const ext = items[i].kind === "photo" ? "jpg" : "mp4";
    const fname =
      "Magpie/" +
      data.handle +
      "_" +
      id +
      (items.length > 1 ? "_" + (i + 1) : "") +
      "_" +
      best.label.replace(/[^\w]/g, "") +
      "." +
      ext;
    await chrome.downloads.download({ url: best.url, filename: fname });
    n++;
  }
  return n;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.type === "grab") {
    grab(msg.id, !!msg.includePhotos)
      .then((n) => sendResponse({ ok: n }))
      .catch((e) => sendResponse({ error: e.message }));
    return true; // keep channel open for async response
  }
});

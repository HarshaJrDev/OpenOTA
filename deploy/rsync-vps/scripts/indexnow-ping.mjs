#!/usr/bin/env node
// OpenOTA — real, legitimate indexing-acceleration ping via the IndexNow protocol
// (https://www.indexnow.org). Bing, Yandex, and a handful of other engines participate; Google
// does NOT — there is no script, API, or trick that makes a page rank #1 on Google. Ranking is
// Google's algorithm, driven by real usage, real backlinks, and time; anything claiming otherwise
// is snake oil and can get a site penalized. What this script legitimately does: tell every
// participating engine "these URLs changed, go crawl them now" instead of waiting for their next
// scheduled crawl — a real, honest speed-up, nothing more.
//
// Verification: the key below must be published at https://openota.xyz/<key>.txt containing
// exactly the key (see apps/docs/public/<key>.txt) — that file is what proves to IndexNow that
// whoever is pinging actually controls the site.
//
// Run after every docs deploy: node deploy/rsync-vps/scripts/indexnow-ping.mjs

const HOST = "openota.xyz";
const KEY = "a0ddd4758cf258397aafa65bcaa29116";
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

// Real, current public pages — kept in sync with apps/docs/app/sitemap.ts by hand (small, static
// list; not worth generating dynamically for a handful of marketing pages).
const URLS = [
  "https://openota.xyz/",
  "https://openota.xyz/docs",
  "https://openota.xyz/features",
  "https://openota.xyz/pricing",
  "https://openota.xyz/download",
  "https://openota.xyz/about",
  "https://openota.xyz/contact",
  "https://openota.xyz/privacy",
  "https://openota.xyz/terms",
  "https://openota.xyz/cookies",
  "https://openota.xyz/disclaimer",
];

async function main() {
  // First, confirm the key file is actually live before telling IndexNow about it — a ping with
  // an unverifiable key is silently ignored by every participating engine anyway, so failing loud
  // here is more useful than a mysteriously-ignored ping.
  const keyCheck = await fetch(KEY_LOCATION).catch(() => null);
  if (!keyCheck || !keyCheck.ok) {
    console.error(`[indexnow] Key file not reachable at ${KEY_LOCATION} — aborting ping.`);
    process.exit(1);
  }

  const res = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList: URLS }),
  });

  // IndexNow returns 200/202 on success; it does not return per-URL detail — this is
  // fire-and-forget by design on their end too.
  if (res.ok) {
    console.log(`[indexnow] Pinged ${URLS.length} URLs — status ${res.status}`);
  } else {
    const body = await res.text();
    console.error(`[indexnow] Ping failed — status ${res.status}: ${body}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[indexnow] fatal:", err);
  process.exit(1);
});

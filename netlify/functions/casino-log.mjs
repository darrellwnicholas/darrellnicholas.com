import { getStore } from "@netlify/blobs";
import { CASINOS, SUPPORT } from "../lib/casinos.mjs";

const SKIP = "dnskip";

/**
 * Private stats for /casinos: who came to the page, who clicked through, and
 * which links get the clicks. Same token and same fail-closed rule as /e/v/log.
 *
 *   /e/c/log?token=…              the page
 *   /e/c/log?token=…&format=json  the same numbers as JSON
 *   /e/c/log?token=…&days=7       only the last 7 days (any number)
 *
 * Visitors come from the site-wide counter (site-visits): a visitor-day counts
 * when that day's record shows a /casinos page view. Clicks come from /go/<slug>
 * (casino-clicks). Both key on the same visitor cookie, so "clicked through"
 * means the same browser that viewed the page.
 */
export default async (req) => {
  const expected = process.env.SITE_STATS_TOKEN || process.env.DOWNLOAD_STATS_TOKEN;
  const url = new URL(req.url);
  if (!expected || url.searchParams.get("token") !== expected) {
    return new Response("Not found\n", { status: 404 });
  }

  const daysParam = parseInt(url.searchParams.get("days") || "", 10);
  const since = daysParam > 0
    ? new Date(Date.now() - (daysParam - 1) * 86400000).toISOString().slice(0, 10)
    : "0000-00-00";

  // ---- page visitors -------------------------------------------------------
  const visits = await readAll(getStore("site-visits"));
  const pageRows = visits
    .map((r) => ({
      ...r,
      vid: r.key.split("/")[1] || r.key,
      casinoViews: Object.entries(r.paths || {})
        .filter(([p]) => p.startsWith("/casinos"))
        .reduce((n, [, v]) => n + v, 0),
    }))
    .filter((r) => r.casinoViews > 0 && r.day >= since);

  // ---- clicks --------------------------------------------------------------
  const allClicks = (await readAll(getStore("casino-clicks")))
    .map((r) => ({ ...r, vid: r.key.split("/")[2] || r.key }))
    .filter((r) => r.day >= since);
  const clickRows = allClicks.filter((r) => !SUPPORT[r.slug]);
  const kofiRows = allClicks.filter((r) => r.slug === "kofi");
  const kofi = {
    clicks: sum(kofiRows, (r) => r.clicks),
    people: new Set(kofiRows.map((r) => r.vid)).size,
    fromSite: sum(kofiRows.filter((r) => r.src === "page"), (r) => r.clicks),
    qr: sum(kofiRows.filter((r) => r.src === "qr"), (r) => r.clicks),
    other: sum(kofiRows.filter((r) => r.src !== "page" && r.src !== "qr"), (r) => r.clicks),
    last: kofiRows.reduce((m, r) => (r.last > m ? r.last : m), ""),
  };

  const pageVisitors = new Set(pageRows.map((r) => r.vid));
  const clickers = new Set(clickRows.map((r) => r.vid));
  const clickedFromPage = new Set([...clickers].filter((v) => pageVisitors.has(v)));
  const totalClicks = sum(clickRows, (r) => r.clicks);

  // Per link: every casino listed, even with zero clicks, so dead ones show.
  const links = Object.entries(CASINOS).map(([slug, c]) => {
    const rows = clickRows.filter((r) => r.slug === slug);
    return {
      slug,
      name: c.name,
      clicks: sum(rows, (r) => r.clicks),
      people: new Set(rows.map((r) => r.vid)).size,
      fromPage: sum(rows.filter((r) => r.src === "page"), (r) => r.clicks),
      shared: sum(rows.filter((r) => r.src !== "page"), (r) => r.clicks),
      last: rows.reduce((m, r) => (r.last > m ? r.last : m), ""),
    };
  });
  // Links that were removed from the list but still have history.
  for (const slug of new Set(clickRows.map((r) => r.slug))) {
    if (CASINOS[slug]) continue;
    const rows = clickRows.filter((r) => r.slug === slug);
    links.push({
      slug, name: `${slug} (removed)`,
      clicks: sum(rows, (r) => r.clicks),
      people: new Set(rows.map((r) => r.vid)).size,
      fromPage: sum(rows.filter((r) => r.src === "page"), (r) => r.clicks),
      shared: sum(rows.filter((r) => r.src !== "page"), (r) => r.clicks),
      last: rows.reduce((m, r) => (r.last > m ? r.last : m), ""),
    });
  }
  links.sort((a, b) => b.clicks - a.clicks || b.people - a.people || a.name.localeCompare(b.name));

  // By day.
  const dayMap = new Map();
  const dayOf = (d) => {
    if (!dayMap.has(d)) dayMap.set(d, { day: d, visitors: new Set(), clickers: new Set(), clicks: 0 });
    return dayMap.get(d);
  };
  for (const r of pageRows) dayOf(r.day).visitors.add(r.vid);
  for (const r of clickRows) {
    const d = dayOf(r.day);
    d.clickers.add(r.vid);
    d.clicks += r.clicks || 0;
  }
  const days = [...dayMap.values()]
    .map((d) => ({ day: d.day, visitors: d.visitors.size, clickers: d.clickers.size, clicks: d.clicks }))
    .sort((a, b) => b.day.localeCompare(a.day));

  const totals = {
    pageVisitors: pageVisitors.size,
    pageViews: sum(pageRows, (r) => r.casinoViews),
    clickedThrough: clickedFromPage.size,
    clickThroughRate: pageVisitors.size ? Math.round((clickedFromPage.size / pageVisitors.size) * 100) : 0,
    allClickers: clickers.size,
    totalClicks,
  };

  if (url.searchParams.get("format") === "json") {
    return Response.json(
      { generatedAt: new Date().toISOString(), since: daysParam > 0 ? since : null, totals, links, days, kofi },
      { headers: skipCookie() }
    );
  }

  return new Response(page({ totals, links, days, kofi, daysParam, token: url.searchParams.get("token") }), {
    status: 200,
    headers: { "content-type": "text/html; charset=utf-8", ...skipCookie() },
  });
};

async function readAll(store) {
  const { blobs } = await store.list();
  return (
    await Promise.all(
      blobs.map(async (b) => {
        const row = await store.get(b.key, { type: "json" });
        return row ? { key: b.key, ...row } : null;
      })
    )
  ).filter(Boolean);
}

function sum(rows, f) {
  return rows.reduce((n, r) => n + (f(r) || 0), 0);
}

function skipCookie() {
  return {
    "set-cookie": `${SKIP}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
    "cache-control": "no-store",
  };
}

function page({ totals: t, links, days, kofi, daysParam, token }) {
  const peak = Math.max(1, ...links.map((l) => l.clicks));
  const tok = encodeURIComponent(token || "");
  const range = (n, label) =>
    `<a class="${(daysParam || 0) === n ? "on" : ""}" href="?token=${tok}${n ? `&days=${n}` : ""}">${label}</a>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Casino link stats</title>
<style>
  :root { color-scheme: dark; }
  body { margin: 0; padding: 2.5rem 1.25rem; background: #0D0F12; color: #F5F5F5;
    font: 17px/1.6 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif; }
  main { max-width: 48rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; letter-spacing: -0.02em; margin: 0 0 .75rem; }
  h2 { font-size: 1rem; letter-spacing: .02em; margin: 2.5rem 0 .5rem; }
  .note { color: #666B73; font-size: .9rem; margin: .4rem 0 0; }
  .range { display: flex; gap: .5rem; margin: 0 0 1.4rem; flex-wrap: wrap; }
  .range a { color: #9E9E9E; text-decoration: none; padding: .3rem .8rem; border-radius: 999px; border: 1px solid rgba(255,255,255,.12); font-size: .85rem; }
  .range a.on { background: #FFC233; color: #2A1E00; border-color: #FFC233; font-weight: 700; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: .9rem; }
  .tile { background: rgba(255,255,255,.04); border-radius: 14px; padding: 1rem 1.1rem; }
  .tile b { display: block; color: #FFC233; font-size: 2.1rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.15; }
  .tile span { color: #9E9E9E; font-size: .82rem; }
  table { width: 100%; border-collapse: collapse; margin-top: .5rem; font-size: .95rem; }
  th, td { text-align: left; padding: .55rem .5rem; border-bottom: 1px solid rgba(255,255,255,.09); }
  th { color: #666B73; font-weight: 500; text-transform: uppercase; letter-spacing: .08em; font-size: .7rem; }
  td { color: #C9CCD1; font-variant-numeric: tabular-nums; }
  .n { text-align: right; width: 4.8rem; }
  .bar { display: block; height: 6px; border-radius: 3px; background: #FFC233; opacity: .75; min-width: 2px; }
  .zero td { color: #555a63; }
  .empty { color: #666B73; text-align: center; padding: 2rem 0; }
</style>
</head>
<body>
<main>
  <h1>darrellnicholas.com/casinos &amp; Ko-fi</h1>
  <div class="range">${range(0, "All time")}${range(1, "Today")}${range(7, "7 days")}${range(30, "30 days")}</div>
  <div class="tiles">
    <div class="tile"><b>${t.pageVisitors}</b><span>unique visitors to the page</span></div>
    <div class="tile"><b>${t.clickedThrough}</b><span>of them clicked a link</span></div>
    <div class="tile"><b>${t.clickThroughRate}%</b><span>click-through rate</span></div>
    <div class="tile"><b>${t.totalClicks}</b><span>total link clicks</span></div>
    <div class="tile"><b>${t.allClickers}</b><span>unique people clicking (incl. shared links)</span></div>
  </div>
  <p class="note">Days are UTC. A visitor is one browser, and the count resets if they clear cookies. Your own visits and clicks stop counting once this page has loaded in your browser. Bots and link-preview crawlers aren't counted.</p>

  <h2>Clicks by casino</h2>
  <table>
    <thead><tr><th>Casino</th><th></th><th class="n">Clicks</th><th class="n">People</th><th class="n">From page</th><th class="n">Shared</th><th>Last click (UTC)</th></tr></thead>
    <tbody>
${links.map((l) => `<tr class="${l.clicks ? "" : "zero"}"><td>${esc(l.name)}</td><td style="width:22%"><span class="bar" style="width:${Math.round((l.clicks / peak) * 100)}%;${l.clicks ? "" : "opacity:0"}"></span></td><td class="n">${l.clicks}</td><td class="n">${l.people}</td><td class="n">${l.fromPage}</td><td class="n">${l.shared}</td><td>${l.last ? esc(l.last.slice(0, 16).replace("T", " ")) : "—"}</td></tr>`).join("\n")}
    </tbody>
  </table>
  <p class="note">"Shared" means the click came through a copied /go/ link posted somewhere else, or from a browser that sends no referrer.</p>

  <h2>Ko-fi "Buy me a coffee" button</h2>
  <div class="tiles">
    <div class="tile"><b>${kofi.clicks}</b><span>clicks to Ko-fi</span></div>
    <div class="tile"><b>${kofi.people}</b><span>unique people</span></div>
    <div class="tile"><b>${kofi.fromSite}</b><span>from the site</span></div>
    <div class="tile"><b>${kofi.qr}</b><span>QR code scans</span></div>
  </div>
  <p class="note">Clicks only, not donations; Ko-fi's dashboard shows who actually gave. Last click: ${kofi.last ? esc(kofi.last.slice(0, 16).replace("T", " ")) + " UTC" : "none yet"}.</p>

  <h2>By day</h2>
  <table>
    <thead><tr><th>Day</th><th class="n">Visitors</th><th class="n">Clickers</th><th class="n">Clicks</th></tr></thead>
    <tbody>
${days.length ? days.map((d) => `<tr><td>${esc(d.day)}</td><td class="n">${d.visitors}</td><td class="n">${d.clickers}</td><td class="n">${d.clicks}</td></tr>`).join("\n") : `<tr><td class="empty" colspan="4">Nobody yet.</td></tr>`}
    </tbody>
  </table>
</main>
</body>
</html>`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const config = { path: "/e/c/log" };

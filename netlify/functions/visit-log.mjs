import { getStore } from "@netlify/blobs";

const SKIP = "dnskip";

/**
 * The private window onto site traffic.
 *
 * Nothing about this is published: the site shows no number anywhere, and this
 * page fails closed — with no token configured it 404s rather than falling
 * open, the same way the download log does.
 *
 * Loading it also marks this browser as Darrell's, so his own reading of the
 * site stops being counted from here on.
 */
export default async (req) => {
  // One token for both logs, so there is nothing new to set up in Netlify.
  // SITE_STATS_TOKEN wins if it ever gets its own.
  const expected = process.env.SITE_STATS_TOKEN || process.env.DOWNLOAD_STATS_TOKEN;
  const url = new URL(req.url);

  if (!expected || url.searchParams.get("token") !== expected) {
    return new Response("Not found\n", { status: 404 });
  }

  const store = getStore("site-visits");

  // Deleting names every key explicitly. There is deliberately no "purge
  // everything" — a stray request must not be able to wipe the record.
  if (req.method === "POST") {
    const keys = (url.searchParams.get("purge") || "")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);

    if (!keys.length) {
      return Response.json({ error: "name the keys to purge" }, { status: 400 });
    }

    for (const key of keys) await store.delete(key);
    return Response.json({ deleted: keys, count: keys.length });
  }

  const { blobs } = await store.list();
  const rows = (
    await Promise.all(
      blobs.map(async (b) => {
        const row = await store.get(b.key, { type: "json" });
        if (!row) return null;
        // The key carries the visitor id; the record deliberately doesn't.
        return { key: b.key, vid: b.key.split("/")[1] || b.key, ...row };
      })
    )
  ).filter(Boolean);

  const today = new Date().toISOString().slice(0, 10);
  const people = new Set(rows.map((r) => r.vid));

  const days = tally(rows, (r) => r.day, (acc, r) => {
    acc.visitors += 1;
    acc.views += r.views || 1;
    if (r.new) acc.fresh += 1;
  });

  const refs = tally(rows, (r) => r.ref || "direct", (acc) => { acc.visitors += 1; });
  const entries = tally(rows, (r) => r.entry || "/", (acc, r) => {
    acc.visitors += 1;
    acc.views += r.views || 1;
  });
  const countries = tally(rows, (r) => r.country || "—", (acc) => { acc.visitors += 1; });

  const todayRow = days.find((d) => d.name === today);
  const mobile = rows.filter((r) => r.mobile).length;

  if (url.searchParams.get("format") === "json") {
    return Response.json(
      {
        generatedAt: new Date().toISOString(),
        note: "Days are UTC, which is what App Store Connect reports in too.",
        totals: {
          people: people.size,
          visitorDays: rows.length,
          views: rows.reduce((n, r) => n + (r.views || 1), 0),
          today: todayRow ? todayRow.visitors : 0,
          mobileShare: rows.length ? Math.round((mobile / rows.length) * 100) : 0,
        },
        days,
        referrers: refs,
        entryPages: entries,
        countries,
      },
      { headers: skipCookie() }
    );
  }

  const recent = days.slice(0, 30);
  const sevenDay = days.slice(0, 7).reduce((n, d) => n + d.visitors, 0);

  return new Response(
    page({
      people: people.size,
      today: todayRow ? todayRow.visitors : 0,
      sevenDay,
      views: rows.reduce((n, r) => n + (r.views || 1), 0),
      mobileShare: rows.length ? Math.round((mobile / rows.length) * 100) : 0,
      recent,
      refs: refs.slice(0, 12),
      entries: entries.slice(0, 12),
      countries: countries.slice(0, 12),
    }),
    {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8", ...skipCookie() },
    }
  );
};

function skipCookie() {
  return {
    "set-cookie": `${SKIP}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
    "cache-control": "no-store",
  };
}

function tally(rows, keyOf, add) {
  const map = new Map();
  for (const row of rows) {
    const name = keyOf(row);
    if (!map.has(name)) map.set(name, { name, visitors: 0, views: 0, fresh: 0 });
    add(map.get(name), row);
  }
  return [...map.values()].sort(
    (a, b) => b.visitors - a.visitors || String(b.name).localeCompare(String(a.name))
  );
}

function page(d) {
  const byDay = [...d.recent].sort((a, b) => String(b.name).localeCompare(String(a.name)));
  const peak = Math.max(1, ...byDay.map((r) => r.visitors));

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Site visits</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 2.5rem 1.25rem; background: #0D0F12; color: #F5F5F5;
    font: 17px/1.6 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  }
  main { max-width: 46rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; letter-spacing: -0.02em; margin: 0 0 1.5rem; }
  h2 { font-size: 1rem; letter-spacing: 0.02em; margin: 2.5rem 0 0.5rem; color: #F5F5F5; }
  .note { color: #666B73; font-size: 0.9rem; margin: 0.25rem 0 0; }
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr)); gap: 0.9rem; }
  .tile { background: rgba(255,255,255,0.04); border-radius: 14px; padding: 1rem 1.1rem; }
  .tile b { display: block; color: #FFC233; font-size: 2.1rem; font-weight: 700; font-variant-numeric: tabular-nums; line-height: 1.15; }
  .tile span { color: #9E9E9E; font-size: 0.82rem; }
  table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.95rem; }
  th, td { text-align: left; padding: 0.55rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.09); }
  th { color: #666B73; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.7rem; }
  td { color: #C9CCD1; font-variant-numeric: tabular-nums; }
  td.n, th.n { text-align: right; width: 5.5rem; }
  .bar { display: block; height: 6px; border-radius: 3px; background: #FFC233; opacity: 0.75; }
  .empty { color: #666B73; text-align: center; padding: 2.5rem 0; }
</style>
</head>
<body>
  <main>
    <h1>darrellnicholas.com</h1>

    <div class="tiles">
      <div class="tile"><b>${d.today}</b><span>visitors today</span></div>
      <div class="tile"><b>${d.sevenDay}</b><span>last 7 days</span></div>
      <div class="tile"><b>${d.people}</b><span>people, all time</span></div>
      <div class="tile"><b>${d.views}</b><span>page views</span></div>
      <div class="tile"><b>${d.mobileShare}%</b><span>on a phone</span></div>
    </div>
    <p class="note">Days are UTC — the same clock App Store Connect reports downloads on. Your own visits stopped being counted the moment this page loaded.</p>

    <h2>By day</h2>
    ${table(
      ["Day", "", "Visitors", "New", "Views"],
      byDay.map((r) => [
        esc(r.name),
        `<span class="bar" style="width:${Math.round((r.visitors / peak) * 100)}%"></span>`,
        r.visitors,
        r.fresh,
        r.views,
      ]),
      "Nobody has visited yet."
    )}

    <h2>Where they came from</h2>
    <p class="note">An app opening a link sends no referrer, so QuickSchedule arrivals land in “direct” along with bookmarks and typed addresses.</p>
    ${table(["Source", "Visitors"], d.refs.map((r) => [esc(r.name), r.visitors]), "Nothing yet.")}

    <h2>Page they landed on</h2>
    ${table(["Page", "Visitors", "Views"], d.entries.map((r) => [esc(r.name), r.visitors, r.views]), "Nothing yet.")}

    <h2>Country</h2>
    ${table(["Country", "Visitors"], d.countries.map((r) => [esc(r.name), r.visitors]), "Nothing yet.")}
  </main>
</body>
</html>`;
}

function table(headings, rows, emptyText) {
  // Numbers right-align; the first row decides which columns are numbers.
  const numeric = (i) => typeof rows[0]?.[i] === "number";
  const head = headings
    .map((h, i) => `<th${numeric(i) ? ' class="n"' : ""}>${esc(h)}</th>`)
    .join("");

  const body = rows.length
    ? rows
        .map(
          (cells) =>
            `<tr>${cells
              .map((c) => `<td${typeof c === "number" ? ' class="n"' : ""}>${c}</td>`)
              .join("")}</tr>`
        )
        .join("\n")
    : `<tr><td class="empty" colspan="${headings.length}">${esc(emptyText)}</td></tr>`;

  return `<table><thead><tr>${head}</tr></thead><tbody>\n${body}\n</tbody></table>`;
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export const config = { path: "/e/v/log" };

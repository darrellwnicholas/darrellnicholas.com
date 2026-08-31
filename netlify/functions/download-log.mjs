import { getStore } from "@netlify/blobs";

const CAP = 25;

/**
 * The private log.
 *
 * Not a folder on the site: everything under the publish directory is served to
 * the whole internet, so a "hidden" directory would only be hidden until
 * somebody guessed the name. The records live in Netlify Blobs, which nothing
 * but these functions can reach, and this page is the window onto them.
 *
 * Fails closed — with no token configured it refuses rather than falling open.
 */
export default async (req) => {
  const expected = process.env.DOWNLOAD_STATS_TOKEN;
  const url = new URL(req.url);

  if (!expected || url.searchParams.get("token") !== expected) {
    return new Response("Not found\n", { status: 404 });
  }

  const store = getStore("vector-downloads");
  const { blobs } = await store.list();
  const rows = (
    await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);

  rows.sort((a, b) => String(b.at).localeCompare(String(a.at)));

  if (url.searchParams.get("format") === "json") {
    return Response.json({ total: rows.length, cap: CAP, downloads: rows });
  }

  const body = rows.length
    ? rows
        .map(
          (r) => `<tr><td>${escapeHtml(r.at)}</td><td>${escapeHtml(
            r.country || "—"
          )}</td><td>${r.android ? "Android" : "other"}</td></tr>`
        )
        .join("\n")
    : `<tr><td colspan="3" class="empty">Nobody has downloaded it yet.</td></tr>`;

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Vector downloads</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; padding: 2.5rem 1.25rem; background: #0D0F12; color: #F5F5F5;
    font: 16px/1.6 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  }
  main { max-width: 40rem; margin: 0 auto; }
  h1 { font-size: 1.5rem; letter-spacing: -0.02em; margin: 0 0 0.35rem; }
  .count { color: #FFC233; font-size: 2.6rem; font-weight: 700; font-variant-numeric: tabular-nums; }
  .of { color: #666B73; font-size: 1rem; font-weight: 400; }
  table { width: 100%; border-collapse: collapse; margin-top: 1.75rem; font-size: 0.9rem; }
  th, td { text-align: left; padding: 0.6rem 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.09); }
  th { color: #666B73; font-weight: 500; text-transform: uppercase; letter-spacing: 0.08em; font-size: 0.7rem; }
  td { color: #9E9E9E; font-variant-numeric: tabular-nums; }
  .empty { color: #666B73; text-align: center; padding: 2rem 0; }
</style>
</head>
<body>
  <main>
    <h1>Vector test build</h1>
    <p class="count">${rows.length}<span class="of"> of ${CAP} places taken</span></p>
    <table>
      <thead><tr><th>When (UTC)</th><th>Country</th><th>Device</th></tr></thead>
      <tbody>
${body}
      </tbody>
    </table>
  </main>
</body>
</html>`,
    { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
  );
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export const config = { path: "/get/vector/log" };

import { getStore } from "@netlify/blobs";

// Names a browser so the same person reloading the page four times reads as
// one visitor, not four. A random id in a first-party cookie — there is no
// address, no fingerprint and nothing that survives the cookie being cleared.
const VISITOR = "dnv";

// Set by the log page. Darrell reading his own site all day would otherwise be
// most of the traffic, and the whole point of this is to count other people.
const SKIP = "dnskip";

// Crawlers mostly don't run scripts, so this catches the few that do rather
// than doing the heavy lifting.
const BOT = /bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget/i;

function cookie(req, name) {
  const jar = req.headers.get("cookie") || "";
  const hit = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(jar);
  return hit ? decodeURIComponent(hit[1]) : null;
}

// The host, not the URL. Enough to tell Google from Reddit from a link somebody
// posted, without keeping the search terms or the thread somebody came from.
function referrerHost(value) {
  if (!value) return "direct";
  try {
    const host = new URL(value).hostname.replace(/^www\./, "");
    return host === "darrellnicholas.com" ? "direct" : host;
  } catch {
    return "direct";
  }
}

function safePath(value) {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  return value.split("?")[0].split("#")[0].slice(0, 120);
}

/**
 * Counts a visit. Answers nothing and shows nothing — the number lives at
 * /e/v/log and nowhere else.
 *
 * One blob per visitor per day, keyed `YYYY-MM-DD/<visitor id>`. Two people
 * can never write the same key, so the view tally inside a record can be read
 * and incremented without the race that a single site-wide counter would have.
 * It also keeps the store proportional to real people rather than page loads,
 * and it means a day can be read back as "how many came" instead of only "how
 * many times a page was opened".
 */
export default async (req, context) => {
  // A visitor id is minted here rather than in the browser so that a person
  // with scripts blocked at least doesn't get a new identity every request.
  let vid = cookie(req, VISITOR);
  const isNew = !vid;
  if (!vid || !/^[a-z0-9-]{8,40}$/i.test(vid)) vid = crypto.randomUUID();

  const headers = {
    "cache-control": "no-store",
    "set-cookie": `${VISITOR}=${vid}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
  };

  const ua = req.headers.get("user-agent") || "";
  if (cookie(req, SKIP) === "1" || BOT.test(ua)) {
    return new Response(null, { status: 204, headers });
  }

  let body = {};
  try {
    body = await req.json();
  } catch {
    // A malformed beacon still counts as somebody arriving.
  }

  const path = safePath(body.p);
  const ref = referrerHost(body.r);
  const now = new Date();
  const at = now.toISOString();
  const day = at.slice(0, 10);

  try {
    const store = getStore("site-visits");
    const key = `${day}/${vid}`;
    const seen = (await store.get(key, { type: "json" })) || null;

    await store.setJSON(key, {
      day,
      first: seen?.first || at,
      last: at,
      views: (seen?.views || 0) + 1,
      // The page they landed on first that day — the one the link pointed at.
      entry: seen?.entry || path,
      paths: { ...(seen?.paths || {}), [path]: ((seen?.paths || {})[path] || 0) + 1 },
      // Where the first arrival of the day came from. An in-app link sends no
      // referrer, so app traffic reads as "direct" alongside bookmarks and
      // typed addresses; there is no way to separate them until the app itself
      // starts tagging the link.
      ref: seen?.ref || ref,
      country: seen?.country || context?.geo?.country?.code || null,
      // Not the user agent. Just enough to tell a phone from a desktop.
      mobile: seen?.mobile ?? /Mobile|Android|iPhone|iPad/i.test(ua),
      new: seen ? seen.new : isNew,
    });
  } catch (err) {
    // A broken counter must never be visible to somebody reading the site.
    console.error("visit counter failed:", err);
  }

  return new Response(null, { status: 204, headers });
};

export const config = { path: "/e/v" };

import { getStore } from "@netlify/blobs";
import { CASINOS, SUPPORT } from "../lib/casinos.mjs";

// Same cookies the site-wide visit counter uses, so a person who reads
// /casinos and then clicks a link is the same visitor in both records.
const VISITOR = "dnv";
const SKIP = "dnskip";
const BOT = /bot|crawl|spider|slurp|headless|preview|monitor|lighthouse|curl|wget|facebookexternalhit|discord|telegram|whatsapp|skype/i;

function cookie(req, name) {
  const jar = req.headers.get("cookie") || "";
  const hit = new RegExp(`(?:^|;\\s*)${name}=([^;]*)`).exec(jar);
  return hit ? decodeURIComponent(hit[1]) : null;
}

/**
 * /go/<slug> — counts a click on a casino (or support) link, then forwards to the referral URL.
 *
 * One blob per visitor per casino per day, keyed `YYYY-MM-DD/<slug>/<visitor>`.
 * That gives unique clickers per link per day for free, and the click tally
 * inside the record can't race because no two people share a key.
 *
 * `src` says whether the click came from the /casinos page itself or from a
 * copied link somebody shared elsewhere.
 */
export default async (req, context) => {
  const slug = String(context?.params?.slug || "").toLowerCase();
  const casino = CASINOS[slug] || SUPPORT[slug];

  if (!casino) {
    return new Response(null, { status: 302, headers: { location: "/casinos/" } });
  }

  let vid = cookie(req, VISITOR);
  if (!vid || !/^[a-z0-9-]{8,40}$/i.test(vid)) vid = crypto.randomUUID();

  const headers = {
    location: casino.url,
    "cache-control": "no-store",
    "referrer-policy": "no-referrer-when-downgrade",
    "set-cookie": `${VISITOR}=${vid}; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
  };

  const ua = req.headers.get("user-agent") || "";
  // Link-preview bots fetch shared links without anybody clicking. Darrell's
  // own browser is marked by the stats page. Neither should count.
  if (cookie(req, SKIP) === "1" || BOT.test(ua) || req.method === "HEAD") {
    return new Response(null, { status: 302, headers });
  }

  let src = "shared";
  // The printed/on-screen QR code carries ?qr=1 so scans show up separately.
  if (new URL(req.url).searchParams.get("qr") === "1") src = "qr";
  else try {
    const ref = new URL(req.headers.get("referer") || "");
    if (ref.hostname.replace(/^www\./, "") === "darrellnicholas.com" && (SUPPORT[slug] || ref.pathname.startsWith("/casinos"))) {
      src = "page";
    }
  } catch {
    // No referrer: a pasted link, an app, or a privacy setting. Counts as shared.
  }

  try {
    const at = new Date().toISOString();
    const day = at.slice(0, 10);
    const store = getStore("casino-clicks");
    const key = `${day}/${slug}/${vid}`;
    const seen = (await store.get(key, { type: "json" })) || null;
    await store.setJSON(key, {
      day,
      slug,
      first: seen?.first || at,
      last: at,
      clicks: (seen?.clicks || 0) + 1,
      src: seen?.src === "page" ? "page" : seen?.src === "qr" ? "qr" : src,
      country: seen?.country || context?.geo?.country?.code || null,
      mobile: seen?.mobile ?? /Mobile|Android|iPhone|iPad/i.test(ua),
    });
  } catch (err) {
    // A broken counter must never cost somebody the link.
    console.error("casino click counter failed:", err);
  }

  return new Response(null, { status: 302, headers });
};

export const config = { path: "/go/:slug" };

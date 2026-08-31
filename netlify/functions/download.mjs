import { getStore } from "@netlify/blobs";

// Unguessable on purpose: the file sits outside anything linked or indexed, so
// the only advertised way in is through this function.
const FILE = "/downloads/Vector-1.0-build3-495a9d7a27b35f7d.apk";

// How many testers the beta is open to.
const CAP = 25;

const SITE = "https://darrellnicholas.com";

// Marks a browser that has already been counted, so a tester who downloads
// twice doesn't burn two of the twenty-five — and so they keep their access
// once the beta is closed.
const COOKIE = "vbeta";

function fullPage() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Vector beta is full</title>
<style>
  :root { color-scheme: dark; }
  body {
    margin: 0; min-height: 100vh; display: flex; align-items: center;
    justify-content: center; padding: 2rem;
    background: #0D0F12; color: #F5F5F5;
    font: 16px/1.6 "IBM Plex Sans", "Segoe UI", system-ui, sans-serif;
  }
  main { max-width: 30rem; text-align: center; }
  h1 { font-size: 1.65rem; letter-spacing: -0.02em; margin: 0 0 1rem; }
  p { color: #9E9E9E; margin: 0 0 1.1rem; }
  a.cta {
    display: inline-block; margin-top: 0.6rem; padding: 0.9rem 1.6rem;
    background: #FFC233; color: #2A1E00; font-weight: 700;
    text-decoration: none; border-radius: 12px;
  }
  a.cta:focus-visible { outline: 3px solid #4DFF82; outline-offset: 3px; }
</style>
</head>
<body>
  <main>
    <h1>The beta is full</h1>
    <p>Vector's test build is limited to ${CAP} testers, and all of the places have been taken.</p>
    <p>If you were expecting to get in, or you would like a place anyway, get in touch and I will sort it out.</p>
    <a class="cta" href="${SITE}">Contact me at darrellnicholas.com</a>
  </main>
</body>
</html>`;
}

/**
 * Counts a download, then hands the request on to the real file.
 *
 * One blob per download rather than a single incrementing number: two people
 * tapping at once would otherwise read the same total and write it back, and
 * one of them would vanish. Separate keys can't collide, and they carry a
 * timestamp, which a bare count wouldn't.
 */
export default async (req, context) => {
  const store = getStore("vector-downloads");
  const counted = new RegExp(`(?:^|;\\s*)${COOKIE}=1`).test(
    req.headers.get("cookie") || ""
  );

  let taken = 0;
  if (!counted) {
    try {
      const { blobs } = await store.list();
      taken = blobs.length;
    } catch (err) {
      // Blobs being briefly unreachable shouldn't tell a real tester the beta
      // is closed. The cap is advisory; a handful of extra downloads during an
      // outage is the better failure.
      console.error("could not read the tally:", err);
    }

    if (taken >= CAP) {
      return new Response(fullPage(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }

    try {
      const at = new Date().toISOString();
      await store.setJSON(`${at}-${crypto.randomUUID()}`, {
        at,
        // Country, not address. Enough to tell a tester from a crawler without
        // keeping anything that identifies the person who tapped the link.
        country: context?.geo?.country?.code ?? null,
        android: /Android/i.test(req.headers.get("user-agent") || ""),
      });
    } catch (err) {
      // A broken counter must never cost somebody the download.
      console.error("download counter failed:", err);
    }
  }

  return new Response(null, {
    status: 302,
    headers: {
      location: new URL(FILE, req.url).toString(),
      "set-cookie": `${COOKIE}=1; Max-Age=31536000; Path=/; SameSite=Lax; Secure`,
    },
  });
};

export const config = { path: "/get/vector" };

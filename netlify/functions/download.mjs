import { getStore } from "@netlify/blobs";

// The build testers are sent to. Changing the file means changing this line.
const FILE = "/downloads/Vector-1.0-build3.apk";

/**
 * Counts a download, then hands the request on to the real file.
 *
 * One blob per download rather than a single incrementing number: two people
 * tapping at once would otherwise read the same total and write it back, and
 * one of them would vanish. Separate keys can't collide, and they carry a
 * timestamp, which a bare count wouldn't.
 */
export default async (req, context) => {
  try {
    const store = getStore("vector-downloads");
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

  return Response.redirect(new URL(FILE, req.url), 302);
};

export const config = { path: "/get/vector" };

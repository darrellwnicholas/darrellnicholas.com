import { getStore } from "@netlify/blobs";

/**
 * The tally. Behind a token because download times and countries are nobody
 * else's business — and with no token set it refuses outright rather than
 * defaulting to open.
 */
export default async (req) => {
  const expected = process.env.DOWNLOAD_STATS_TOKEN;
  const given = new URL(req.url).searchParams.get("token");

  if (!expected || given !== expected) {
    return new Response("Not found\n", { status: 404 });
  }

  const store = getStore("vector-downloads");
  const { blobs } = await store.list();
  const rows = (
    await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))
  ).filter(Boolean);

  rows.sort((a, b) => String(a.at).localeCompare(String(b.at)));

  return Response.json({
    total: rows.length,
    android: rows.filter((r) => r.android).length,
    downloads: rows,
  });
};

export const config = { path: "/get/vector/count" };

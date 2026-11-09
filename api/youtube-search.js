import { requireTrainer } from "./_lib/trainer.js";

const SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";

function decodeEntities(text) {
  return String(text || "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export default async function handler(req, res) {
  try {
    const trainer = await requireTrainer(req, res);
    if (!trainer) return;

    const apiKey = process.env.YOUTUBE_API_KEY;

    if (!apiKey) {
      return res.status(501).json({
        notConfigured: true,
        error: "YouTube search needs YOUTUBE_API_KEY set in Vercel.",
      });
    }

    const query = String(req.body?.query || "").trim().slice(0, 150);

    if (!query) return res.status(400).json({ error: "Enter a search first." });

    const params = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "8",
      safeSearch: "strict",
      q: query,
      key: apiKey,
    });

    const response = await fetch(`${SEARCH_URL}?${params}`);
    const data = await response.json();

    if (!response.ok) {
      console.error(data?.error);
      const quotaHit = data?.error?.errors?.some(
        (item) => item.reason === "quotaExceeded"
      );

      return res.status(502).json({
        error: quotaHit
          ? "YouTube's daily search limit was reached. It resets tomorrow."
          : "YouTube search is not available right now.",
      });
    }

    return res.status(200).json({
      results: (data.items || []).map((item) => ({
        videoId: item.id.videoId,
        title: decodeEntities(item.snippet.title),
        channel: decodeEntities(item.snippet.channelTitle),
        thumbnail: item.snippet.thumbnails?.medium?.url || "",
        url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
      })),
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "YouTube search failed." });
  }
}

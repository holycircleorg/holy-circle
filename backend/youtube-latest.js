import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
dotenv.config();

const router = express.Router();

const YT_API = process.env.YOUTUBE_API_KEY;
const CHANNEL_ID = "UCqcUPEiMbpAuFz1W00xFcCw"; // Holy Circle channel

router.get("/latest-youtube", async (req, res) => {
  try {
    if (!YT_API) {
      throw new Error("Missing YOUTUBE_API_KEY");
    }

    const url =
      `https://www.googleapis.com/youtube/v3/search` +
      `?key=${YT_API}` +
      `&channelId=${CHANNEL_ID}` +
      `&part=snippet,id` +
      `&order=date` +
      `&maxResults=10`;

    const response = await fetch(url);
    const data = await response.json();

    if (!data.items || !Array.isArray(data.items)) {
      console.error("YouTube API error payload:", data);
      return res.json([]); // 👈 ALWAYS return array
    }

    const formatted = data.items
      .filter((item) => item.id?.videoId)
      .map((item) => ({
        videoId: item.id.videoId,
        title: item.snippet.title,
        description: item.snippet.description,
        thumbnail: item.snippet.thumbnails?.high?.url || "",
        publishedAt: item.snippet.publishedAt,
      }));

    res.json(formatted); // 👈 ALWAYS array
  } catch (err) {
    console.error("YouTube route error:", err.message);
    res.json([]); // 👈 NEVER return object
  }
});


export default router;

// backend/services/youtube.js
import { google } from "googleapis";
import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const oauth2Client = new google.auth.OAuth2(
  process.env.YT_CLIENT_ID,
  process.env.YT_CLIENT_SECRET,
  process.env.YT_REDIRECT_URI // must match what you used in Google Cloud
);

oauth2Client.setCredentials({
  refresh_token: process.env.YT_REFRESH_TOKEN,
});

const youtube = google.youtube("v3");

export async function uploadVideoToYouTube({ filePath, title, description, scheduledAt }) {
  const isScheduled = !!scheduledAt;

  const requestBody = {
    snippet: {
      title,
      description,
      categoryId: "22", // People & Blogs (good default)
    },
    status: {
      privacyStatus: isScheduled ? "private" : "public",
      publishAt: isScheduled ? scheduledAt : undefined,
      selfDeclaredMadeForKids: false,
    },
  };

  const response = await youtube.videos.insert({
    auth: oauth2Client,
    part: "snippet,status",
    requestBody,
    media: {
      body: fs.createReadStream(filePath),
    },
  });

  const video = response.data;
  const videoId = video.id;
  const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

  return {
    id: videoId,
    url: youtubeUrl,
    status: video.status.privacyStatus,
    publishAt: video.status.publishAt || null,
  };
}

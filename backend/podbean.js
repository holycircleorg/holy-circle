import fetch from "node-fetch";
import FormData from "form-data";
import fs from "fs";

const PODBEAN_CLIENT_ID = process.env.PODBEAN_CLIENT_ID;
const PODBEAN_CLIENT_SECRET = process.env.PODBEAN_CLIENT_SECRET;

// STEP 1 — Get Access Token
async function getPodbeanToken() {
  const resp = await fetch("https://api.podbean.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: PODBEAN_CLIENT_ID,
      client_secret: PODBEAN_CLIENT_SECRET
    })
  });

  const data = await resp.json();
  if (!data.access_token) {
    throw new Error("Podbean token error: " + JSON.stringify(data));
  }

  return data.access_token;
}

// STEP 2 — Upload MP3 to Podbean
export async function uploadAudioToPodbean(filePath, title) {
  const token = await getPodbeanToken();

  const form = new FormData();
  form.append("filename", fs.createReadStream(filePath));
  form.append("title", title);

  const resp = await fetch("https://api.podbean.com/v1/files/upload", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form
  });

  const data = await resp.json();

  if (!data.file_key) {
    throw new Error("Podbean upload failed: " + JSON.stringify(data));
  }

  return data.file_key;
}

// STEP 3 — Publish an episode
export async function publishPodbeanEpisode({ title, description, file_key, publishTime }) {
  const token = await getPodbeanToken();

  const resp = await fetch("https://api.podbean.com/v1/episodes", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title,
      content: description || "",
      status: publishTime ? "scheduled" : "publish",
      media_key: file_key,
      publish_time: publishTime || undefined
    })
  });

  const data = await resp.json();

  if (!data.episode_id) {
    throw new Error("Podbean publishing failed: " + JSON.stringify(data));
  }

  return data;
}

const axios = require("axios");
const qs = require("qs");

async function getSpotifyAccessToken(code) {
  const authBuffer = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  const response = await axios.post(
    "https://accounts.spotify.com/api/token",
    qs.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: process.env.SPOTIFY_REDIRECT_URI,
    }),
    {
      headers: {
        Authorization: `Basic ${authBuffer}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
    }
  );
  return response.data;
}

async function refreshSpotifyToken(refreshToken) {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const authHeader = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");

  try {
    const { data } = await axios.post(
      "https://accounts.spotify.com/api/token",
      params,
      {
        headers: {
          Authorization: `Basic ${authHeader}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );
    return data.access_token;
  } catch (err) {
    console.error("Error refreshing token:", err.response?.data || err.message);
    throw new Error("Failed to refresh token");
  }
}



module.exports = { getSpotifyAccessToken, refreshSpotifyToken };

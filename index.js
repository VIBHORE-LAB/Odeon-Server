require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { ApolloServer } = require("apollo-server-express");
const axios = require("axios");

const typeDefs = require("./src/schema");
const resolvers = require("./src/resolvers");
const { getSpotifyAccessToken } = require("./src/spotify/auth");

const app = express();

app.use(cookieParser());
app.use(
  cors({
    origin: "*",
    credentials: true,
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 🔄 Refresh Token
async function refreshSpotifyToken(refreshToken) {
  const params = new URLSearchParams();
  params.append("grant_type", "refresh_token");
  params.append("refresh_token", refreshToken);

  const authHeader = Buffer.from(
    `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`,
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
      },
    );
    return data.access_token;
  } catch (err) {
    console.error("Error refreshing token:", err.response?.data || err.message);
    throw new Error("Failed to refresh token");
  }
}

// 🔐 Spotify Login
app.get("/login", (req, res) => {
  const scope = [
    "user-top-read",
    "user-read-recently-played",
    "user-read-private",
    "user-read-email",
    "user-follow-read",
    "playlist-read-private",
    "playlist-read-collaborative",
    "user-library-read",
    "user-read-playback-state",
    "user-modify-playback-state",
    "streaming",
  ].join(" ");

  const authURL = `https://accounts.spotify.com/authorize?response_type=code&client_id=${
    process.env.SPOTIFY_CLIENT_ID
  }&scope=${encodeURIComponent(scope)}&redirect_uri=${
    process.env.SPOTIFY_REDIRECT_URI
  }`;

  res.redirect(authURL);
});

// 🔁 Callback from Spotify
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const { access_token, refresh_token } = await getSpotifyAccessToken(code);

    const redirectURL = `${
      process.env.FRONTEND_URI || "http://localhost:3000"
    }/auth/callback?access=${access_token}&refresh=${refresh_token}`;

    console.log("Redirecting to:", redirectURL);
    res.redirect(redirectURL);
  } catch (err) {
    console.error("Error in /callback:", err.response?.data || err.message);
    res.status(500).send("Failed to authenticate with Spotify");
  }
});

const startServer = async () => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7)
        : null;
      const refreshToken = req.headers["x-refresh-token"] || null;
      if (!token && refreshToken) {
        try {
          token = await refreshSpotifyToken(refreshToken);
        } catch (err) {
          console.error("Failed to refresh token:", err.message);
        }
      }
      return { token, refreshToken };
    },
  });

  await server.start();
  server.applyMiddleware({ app, path: "/graphql", cors: false });

  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server ready at http://localhost:${PORT}/graphql`);
  });
};

startServer();

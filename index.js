require("dotenv").config();
const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { ApolloServer } = require("apollo-server-express");
const typeDefs = require("./src/schema");
const resolvers = require("./src/resolvers");
const { getSpotifyAccessToken } = require("./src/spotify/auth");

const app = express();
app.use(cookieParser());

app.use(
  cors({
    origin: process.env.FRONTEND_URI || "http://localhost:3000",
    credentials: true,
  })
);

// Login route
app.get("/login", (req, res) => {
  const scope = [
    "user-top-read",
    "user-read-recently-played",
    "user-read-private",
    "user-read-email",
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

// Callback route
app.get("/callback", async (req, res) => {
  try {
    const code = req.query.code;
    const { access_token, refresh_token } = await getSpotifyAccessToken(code);

    const redirectURL = `${
      process.env.FRONTEND_URI || "http://localhost:3000"
    }/auth/callback?access=${access_token}&refresh=${refresh_token}`;
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
        ? authHeader.replace("Bearer ", "")
        : null;
      return { token };
    },
  });

  await server.start();
  server.applyMiddleware({ app, path: "/graphql", cors: false });

  app.listen(4000, () => {
    console.log("🚀 Server ready at http://localhost:4000/graphql");
  });
};

startServer();

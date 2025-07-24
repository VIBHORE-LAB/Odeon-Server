const { refreshSpotifyToken } = require("../spotify/auth");
const {
  getUserProfile,
  getTopTracks,
  getAudioFeatures,
  getTopArtists,
} = require("../spotify/api");
const { ApolloError } = require("apollo-server-errors");
const { db } = require("../config/db");

const sanitize = (x) => JSON.parse(JSON.stringify(x));

/**
 * Wraps API calls to handle token refresh automatically
 */
async function withAutoRefresh(apiCall, accessToken, ...args) {
  try {
    return await apiCall(accessToken, ...args);
  } catch (err) {
    if (err?.response?.status === 401) {
      console.warn("Access token expired, refreshing...");
      const newToken = await refreshSpotifyToken(accessToken); // auto-refresh
      return await apiCall(newToken);
    }
    throw err;
  }
}

const resolvers = {
  Query: {
    me: async (_, __, { token }) => {
      if (!token) throw new ApolloError("Not authenticated", "UNAUTHENTICATED");
      try {
        const user = await withAutoRefresh(getUserProfile, token);

        await db.read();
        let existingUser = db.data.users.find((u) => u.id === user.id);

        if (!existingUser) {
          existingUser = {
            id: user.id,
            display_name: user.display_name,
            followers: user.followers,
            image: user.image,
            topTracks: [],
          };
          db.data.users.push(existingUser);
        } else {
          existingUser.display_name = user.display_name;
          existingUser.followers = user.followers;
          existingUser.image = user.image;
        }

        await db.write();

        return sanitize({
          display_name: user.display_name,
          followers: user.followers,
          image: user.image,
        });
      } catch (err) {
        console.error("Error in me resolver:", err);
        throw new ApolloError("Failed to fetch user profile", "INTERNAL_ERROR");
      }
    },

    topTracks: async (_, __, { token }) => {
      if (!token) throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const [tracks, user] = await Promise.all([
          withAutoRefresh(getTopTracks, token),
          withAutoRefresh(getUserProfile, token),
        ]);

        const mappedTracks = Array.isArray(tracks)
          ? tracks.map((track) => ({
              id: track.id,
              name: track.name,
              artists: track.artists, // Already mapped to names in getTopTracks
              album: track.album
                ? {
                    name: track.album.name || null,
                    release_date: track.album.release_date || null,
                    album_type: track.album.album_type || null,
                    images: Array.isArray(track.album.images)
                      ? track.album.images.map((img) => ({
                          url: img.url,
                          height: img.height || null,
                          width: img.width || null,
                        }))
                      : [],
                  }
                : null,
              external_urls: {
                spotify: track.external_urls?.spotify || "",
              },
            }))
          : [];

        await db.read();
        const existingUser = db.data.users.find((u) => u.id === user.id);
        if (existingUser) {
          existingUser.topTracks = mappedTracks;
          await db.write();
        }

        return sanitize(mappedTracks);
      } catch (err) {
        console.error("Error in topTracks resolver:", err);
        return [];
      }
    },

    analyzeTrack: async (_, { id }, { token }) => {
      if (!token) throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const features = await withAutoRefresh(
          async (tkn) => getAudioFeatures(tkn, id),
          token
        );

        if (!features) {
          throw new ApolloError("No audio features returned", "NOT_FOUND");
        }

        return {
          danceability: features.danceability,
          energy: features.energy,
          tempo: features.tempo,
          valence: features.valence,
          speechiness: features.speechiness,
          acousticness: features.acousticness,
          instrumentalness: features.instrumentalness,
          liveness: features.liveness,
          duration_ms: features.duration_ms,
        };
      } catch (err) {
        console.error("Error in analyzeTrack resolver:", err);
        throw new ApolloError("Failed to analyze track", "INTERNAL_ERROR");
      }
    },

    topArtists: async (
      _,
      { limit = 20, timeRange = "medium_term" },
      { token }
    ) => {
      if (!token) throw new ApolloError("Not authenticated", "UNAUTHENTICATED");
      try {
        return await getTopArtists(token, limit, timeRange);
      } catch (error) {
        console.error(
          "Error fetching top artists:",
          error.response?.data || error.message
        );
        throw new ApolloError("Failed to fetch top artists");
      }
    },
  },
};

module.exports = resolvers;

const { refreshSpotifyToken } = require("../spotify/auth");
const {
  getUserProfile,
  getTopTracks,
  getAudioFeatures,
  getTopArtists,
  getGenreStats,
  getLibraryTracksCount,
  getHoursListened,
  getArtistsDiscovered,
  getPlaylistsCountThisYear,
  getUserPlaylists,
  getFollowedArtists,
  getRandomTracks,
} = require("../spotify/api");
const { ApolloError } = require("apollo-server-errors");
const { db } = require("../config/db");

const sanitize = (x) => JSON.parse(JSON.stringify(x));
async function withAutoRefresh(apiCall, accessToken, refreshToken, ...args) {
  try {
    return { result: await apiCall(accessToken, ...args), token: accessToken };
  } catch (err) {
    if (err?.response?.status === 401) {
      const { access_token: newAccessToken } =
        await refreshSpotifyToken(refreshToken);
      return {
        result: await apiCall(newAccessToken, ...args),
        token: newAccessToken,
      };
    }
    throw err;
  }
}

const resolvers = {
  Query: {
    me: async (_, __, { token, refreshToken }) => {
      if (!token || !refreshToken)
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const { result: user } = await withAutoRefresh(
          getUserProfile,
          token,
          refreshToken,
        );

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
        throw new ApolloError("Failed to fetch user profile", "INTERNAL_ERROR");
      }
    },

    topTracks: async (
      _,
      { limit = 20, timeRange = "medium_term" },
      { token, refreshToken },
    ) => {
      if (!token || !refreshToken)
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const { result: user, token: freshToken } = await withAutoRefresh(
          getUserProfile,
          token,
          refreshToken,
        );
        const { result: tracks } = await withAutoRefresh(
          getTopTracks,
          freshToken,
          refreshToken,
          limit,
          timeRange,
        );


        const mappedTracks = Array.isArray(tracks)
          ? tracks.map((track) => ({
              id: track.id,
              name: track.name,
              artists: track.artists,
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
        return [];
      }
    },

    analyzeTrack: async (_, { id }, { token, refreshToken }) => {
      if (!token || !refreshToken)
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const features = await withAutoRefresh(
          (tkn) => getAudioFeatures(tkn, id),
          token,
          refreshToken,
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
        throw new ApolloError("Failed to analyze track", "INTERNAL_ERROR");
      }
    },

    topArtists: async (
      _,
      { limit = 20, timeRange = "medium_term" },
      { token, refreshToken },
    ) => {
      if (!token || !refreshToken)
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const { result: artists } = await withAutoRefresh(
          getTopArtists,
          token,
          refreshToken,
          limit,
          timeRange,
        );

        return artists;
      } catch (error) {
        console.error(
          "Error fetching top artists:",
          error.response?.data || error.message,
        );
        throw new ApolloError("Failed to fetch top artists");
      }
    },

    genreStats: async (
      _,
      { limit = 20, timeRange = "medium_term" },
      { token, refreshToken },
    ) => {
      if (!token || !refreshToken)
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const { result: genres } = await withAutoRefresh(
          (tkn) => getGenreStats(tkn, limit, timeRange),
          token,
          refreshToken,
        );

        return genres;
      } catch (error) {
        console.error(
          "Error fetching genre stats:",
          error.response?.data || error.message,
        );
        throw new ApolloError("Failed to fetch genre stats");
      }
    },
    playlistsStats: async (
      _,
      { limit = 20, timeRange = "medium_term" },
      { token, refreshToken },
    ) => {
      if (!token || !refreshToken) {
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");
      }

      try {
        const { result: playlistData } = await withAutoRefresh(
          (tkn) => getUserPlaylists(tkn, limit, 0),
          token,
          refreshToken,
        );
        return playlistData.items.map((playlist) => ({
          id: playlist.id,
          name: playlist.name,
          description: playlist.description,
          owner: playlist.owner?.display_name || "Unknown",
          totalTracks: playlist.tracks.total,
          public: playlist.public,
          images: playlist.images,
        }));
      } catch (error) {
        console.error(
          "Error fetching Playlists",
          error.response?.data || error.message,
        );
      }
    },

    followedArtists: async (_, { limit = 50 }, { token, refreshToken }) => {
      if (!token || !refreshToken) {
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");
      }

      try {
        const { result } = await withAutoRefresh(
          (tkn) => getFollowedArtists(tkn, limit),
          token,
          refreshToken,
        );

        return {
          total: result.artists.total,
          items: result.artists.items,
        };
      } catch (error) {
        console.error("Failed to fetch followed artists:", error);
        throw new ApolloError("Failed to fetch followed artists");
      }
    },

    randomRecommendedTracks: async (_, __, { token, refreshToken }) => {
      if (!token || !refreshToken) {
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");
      }

      try {
        const tracks = await withAutoRefresh(
          (tkn) => getRandomTracks(tkn),
          token,
          refreshToken,
        );
        const actualTracks = Array.isArray(tracks.result)
          ? tracks.result
          : tracks;

        if (!Array.isArray(actualTracks)) {
          console.error("Expected an array, but got:", actualTracks);
          throw new ApolloError(
            "Unexpected response format",
            "INVALID_TRACKS_RESPONSE",
          );
        }

        return actualTracks.map((track) => ({
          id: track.id,
          name: track.name,
          durationMs: track.duration_ms,
          previewUrl: track.preview_url,
          album: {
            name: track.album?.name || "Unknown Album",
            imageUrl: track.album?.images?.[0]?.url || null,
          },
          artists: Array.isArray(track.artists)
            ? track.artists.map((artist) => ({
                id: artist.id,
                name: artist.name,
              }))
            : [],
        }));
      } catch (error) {
        console.error("Error fetching random tracks:", error);
        throw new ApolloError("Failed to fetch tracks", "TRACKS_FETCH_FAILED");
      }
    },

    userStats: async (
      _,
      { year = new Date().getFullYear() },
      { token, refreshToken },
    ) => {
      if (!token || !refreshToken)
        throw new ApolloError("Not authenticated", "UNAUTHENTICATED");

      try {
        const { result: stats } = await withAutoRefresh(
          async (tkn) => {
            const [
              hoursListened,
              artistsDiscovered,
              songsInLibrary,
              playlistsCreated,
            ] = await Promise.all([
              getHoursListened(tkn),
              getArtistsDiscovered(tkn, year),
              getLibraryTracksCount(tkn),
              getPlaylistsCountThisYear(tkn, year),
            ]);

            return {
              hoursListened,
              artistsDiscovered,
              songsInLibrary,
              playlistsCreated,
            };
          },
          token,
          refreshToken,
        );

        return stats;
      } catch (error) {
        console.error(
          "Error fetching user stats:",
          error.response?.data || error.message,
        );
        throw new ApolloError("Failed to fetch user stats");
      }
    },
  },
};

module.exports = resolvers;

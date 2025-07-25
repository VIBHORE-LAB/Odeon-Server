const axios = require("axios");

const getUserProfile = async (token) => {
  try {
    const { data } = await axios.get("https://api.spotify.com/v1/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    return {
      id: data.id,
      display_name: data.display_name,
      followers: data.followers.total,
      image: data.images?.[0]?.url || "",
    };
  } catch (err) {
    console.error("Error fetching user profile:", err.response?.data || err);
    throw err;
  }
};

const getTopTracks = async (token,limit = 20, time_range) => {
  try {
    const { data } = await axios.get(
      `https://api.spotify.com/v1/me/top/tracks?limit=${limit}&time_range=${time_range}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    console.log("Spotify top tracks data:", data.items);

    return data.items.map((track) => ({
      id: track.id,
      name: track.name,
      artists: track.artists.map((artist) => artist.name),
      album: track.album
        ? {
            name: track.album.name || null,
            release_date: track.album.release_date || null,
            album_type: track.album.album_type || null,
            images: (track.album.images || []).map((image) => ({
              url: image.url,
              height: image.height || null,
              width: image.width || null,
            })),
          }
        : null,
      external_urls: {
        spotify: track.external_urls?.spotify || "",
      },
    }));
  } catch (err) {
    console.error("Error fetching top tracks:", err.response?.data || err);
    return [];
  }
};

const getAudioFeatures = async (token, trackId) => {
  try {
    console.log("DEBUG: getAudioFeatures() called with trackId:", trackId);
    console.log(
      "DEBUG: Authorization Token (first 20 chars):",
      token?.slice(0, 20)
    );

    const { data } = await axios.get(
      `https://api.spotify.com/v1/audio-features/${trackId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    console.log("DEBUG: audio_features response:", data);
    return data;
  } catch (err) {
    console.error(
      "ERROR: getAudioFeatures failed with response:",
      err.response?.data || err
    );
    throw err;
  }
};

const getTopArtists = async (token, limit = 20, time_range) => {
  const url = `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=${time_range}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.items;
};

const getGenreStats = async (token, limit = 20, time_range) => {
  const artists = await getTopArtists(token, limit, time_range);

  const genreCount = {};
  artists.forEach((artist) => {
    (artist.genres || []).forEach((genre) => {
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    });
  });

  return Object.entries(genreCount)
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count);
};


const getLibraryTracksCount = async (token) => {
  const { data } = await axios.get("https://api.spotify.com/v1/me/tracks?limit=1", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.total;
};

const getPlaylistsCountThisYear = async (token, year) => {
  const { data } = await axios.get("https://api.spotify.com/v1/me/playlists?limit=50", {
    headers: { Authorization: `Bearer ${token}` },
  });

  return data.items.filter((p) => p.owner.id && p.owner.id !== "spotify" && 
    new Date(p.snapshot_id).getFullYear() === year).length;
};

const getArtistsDiscovered = async (token, year) => {
  const { data } = await axios.get(
    "https://api.spotify.com/v1/me/top/artists?limit=50&time_range=long_term",
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  return data.items.length;
};

const getHoursListened = async (token) => {
  const { data } = await axios.get(
    "https://api.spotify.com/v1/me/player/recently-played?limit=50",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!data.items || data.items.length === 0) return 0;

  const totalMs = data.items.reduce(
    (sum, item) => sum + item.track.duration_ms,
    0
  );
  //appp
  const recentHours = totalMs / 1000 / 60 / 60;

  const dayOfYear = Math.floor(
    (new Date() - new Date(new Date().getFullYear(), 0, 0)) /
      (1000 * 60 * 60 * 24)
  );
  const estimatedYearHours = (recentHours * 365) / dayOfYear;

  return Math.floor(estimatedYearHours);
};





module.exports = {
  getUserProfile,
  getTopTracks,
  getAudioFeatures,
  getTopArtists,
  getGenreStats,
  getLibraryTracksCount,
  getHoursListened,
  getArtistsDiscovered,
  getPlaylistsCountThisYear,
};

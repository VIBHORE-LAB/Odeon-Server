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

const getTopTracks = async (token) => {
  try {
    const { data } = await axios.get(
      "https://api.spotify.com/v1/me/top/tracks?limit=20",
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

const getTopArtists = async (token,limit=20, time_range) =>{
  const url = `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=${time_range}`;
  const { data } = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.items;


}





module.exports = { getUserProfile, getTopTracks, getAudioFeatures,getTopArtists };

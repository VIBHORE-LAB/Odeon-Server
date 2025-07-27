const { gql } = require("apollo-server-express");

const typeDefs = gql`
  type User {
    display_name: String!
    followers: Int
    image: String
  }

  type AlbumImage {
    url: String!
    height: Int
    width: Int
  }

  type Album {
    name: String
    release_date: String
    album_type: String
    images: [AlbumImage!]!
  }

  type ExternalUrls {
    spotify: String!
  }

  type SimplifiedArtist {
    id: String!
    name: String!
  }

  type SimplifiedAlbum {
    name: String
    imageUrl: String
  }
  type RandomTrack {
    id: String!
    name: String!
    durationMs: Int
    previewUrl: String
    album: SimplifiedAlbum
    artists: [SimplifiedArtist!]!
  }

  type Track {
    id: String!
    name: String!
    artists: [String!]!
    album: Album
    external_urls: ExternalUrls!
    previewUrl: String
  }

  type ArtistImage {
    url: String!
    height: Int
    width: Int
  }

  type Artist {
    id: String!
    name: String!
    genres: [String!]!
    popularity: Int
    images: [ArtistImage!]!
    external_urls: ExternalUrls!
  }

  type AudioFeatures {
    danceability: Float
    energy: Float
    tempo: Float
    valence: Float
    speechiness: Float
    acousticness: Float
    instrumentalness: Float
    liveness: Float
    duration_ms: Int
  }

  type GenreStat {
    genre: String!
    count: Int!
  }

  type UserStat {
    hoursListened: Int!
    artistsDiscovered: Int!
    songsInLibrary: Int!
    playlistsCreated: Int!
  }
  type PlaylistImage {
    url: String!
    height: Int
    width: Int
  }

  type Playlist {
    id: String!
    name: String!
    description: String
    owner: String!
    totalTracks: Int!
    public: Boolean!
    images: [PlaylistImage!]!
  }

  type FollowedArtists {
    total: Int!
    items: [Artist!]!
  }

  type Query {
    me: User
    topTracks(limit: Int = 20, timeRange: String = "medium_term"): [Track!]!
    topArtists(limit: Int = 20, timeRange: String = "medium_term"): [Artist!]!
    analyzeTrack(id: String!): AudioFeatures
    genreStats(
      timeRange: String = "medium_term"
      limit: Int = 20
    ): [GenreStat!]!
    userStats(year: Int = 2025): UserStat!
    playlistsStats(limit: Int = 20, offset: Int = 0): [Playlist!]!
    followedArtists(limit: Int = 20, after: String): FollowedArtists!
    randomRecommendedTracks: [RandomTrack!]!
  }
`;

module.exports = typeDefs;

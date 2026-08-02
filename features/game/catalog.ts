import type { Song } from "./types";

// All tracks and melodies are fictional, original demo content.
export const SONGS: Song[] = [
  { id: "signal-bloom", title: "Signal Bloom", artist: "Mira Vale", artistId: "mira-vale", album: "Soft Circuit", year: 2025, genre: "Electronic", colors: ["#ff7a59", "#ffcc66"], notes: [261.63, 329.63, 392, 523.25, 392, 329.63, 293.66, 349.23] },
  { id: "afterglow-arcade", title: "Afterglow Arcade", artist: "Mira Vale", artistId: "mira-vale", album: "Soft Circuit", year: 2025, genre: "Electronic", colors: ["#fd5ca8", "#7958ff"], notes: [329.63, 392, 493.88, 440, 392, 329.63, 246.94, 293.66] },
  { id: "northbound", title: "Northbound", artist: "June Atlas", artistId: "june-atlas", album: "Paper Maps", year: 2022, genre: "Indie", colors: ["#68d7c2", "#246b72"], notes: [220, 277.18, 329.63, 369.99, 329.63, 277.18, 246.94, 220] },
  { id: "paper-satellites", title: "Paper Satellites", artist: "June Atlas", artistId: "june-atlas", album: "Paper Maps", year: 2022, genre: "Indie", colors: ["#ffc857", "#e9724c"], notes: [293.66, 369.99, 440, 369.99, 329.63, 293.66, 246.94, 277.18] },
  { id: "blue-hour", title: "Blue Hour", artist: "The Quiet Frames", artistId: "quiet-frames", album: "Light Leaks", year: 2020, genre: "Dream Pop", colors: ["#5595ff", "#7655d4"], notes: [196, 246.94, 293.66, 392, 369.99, 293.66, 246.94, 220] },
  { id: "light-leaks", title: "Light Leaks", artist: "The Quiet Frames", artistId: "quiet-frames", album: "Light Leaks", year: 2020, genre: "Dream Pop", colors: ["#94b9ff", "#df9ff8"], notes: [246.94, 293.66, 369.99, 493.88, 440, 369.99, 329.63, 293.66] },
  { id: "golden-static", title: "Golden Static", artist: "Onda Club", artistId: "onda-club", album: "Open Late", year: 2024, genre: "Dance", colors: ["#ffd166", "#ef476f"], notes: [261.63, 392, 329.63, 440, 392, 523.25, 493.88, 392] },
  { id: "open-late", title: "Open Late", artist: "Onda Club", artistId: "onda-club", album: "Open Late", year: 2024, genre: "Dance", colors: ["#f24c00", "#ffe156"], notes: [329.63, 493.88, 440, 392, 523.25, 440, 392, 329.63] },
  { id: "violet-taxi", title: "Violet Taxi", artist: "Cassette Harbor", artistId: "cassette-harbor", album: "Meter Running", year: 2019, genre: "Synthwave", colors: ["#bc5cff", "#ff4f9a"], notes: [220, 329.63, 440, 415.3, 329.63, 277.18, 329.63, 392] },
  { id: "meter-running", title: "Meter Running", artist: "Cassette Harbor", artistId: "cassette-harbor", album: "Meter Running", year: 2019, genre: "Synthwave", colors: ["#6c5ce7", "#00cec9"], notes: [277.18, 415.3, 369.99, 329.63, 493.88, 415.3, 369.99, 277.18] },
  { id: "little-weather", title: "Little Weather", artist: "Rue Clement", artistId: "rue-clement", album: "Porchlight", year: 2021, genre: "Folk", colors: ["#8bb174", "#d9ae94"], notes: [196, 220, 261.63, 293.66, 329.63, 293.66, 261.63, 220] },
  { id: "porchlight", title: "Porchlight", artist: "Rue Clement", artistId: "rue-clement", album: "Porchlight", year: 2021, genre: "Folk", colors: ["#dfb38c", "#6d8b74"], notes: [220, 261.63, 293.66, 349.23, 293.66, 261.63, 246.94, 196] },
  { id: "zero-gravity", title: "Zero Gravity", artist: "Nova Common", artistId: "nova-common", album: "Low Orbit", year: 2023, genre: "Pop", colors: ["#54d2d2", "#ffcb69"], notes: [293.66, 440, 392, 493.88, 440, 587.33, 493.88, 440] },
  { id: "low-orbit", title: "Low Orbit", artist: "Nova Common", artistId: "nova-common", album: "Low Orbit", year: 2023, genre: "Pop", colors: ["#735dff", "#37d5d3"], notes: [246.94, 369.99, 329.63, 440, 415.3, 493.88, 440, 369.99] },
  { id: "easy-distance", title: "Easy Distance", artist: "Hollow Weekend", artistId: "hollow-weekend", album: "Two Day Town", year: 2018, genre: "Alternative", colors: ["#afc97e", "#8c6a5d"], notes: [164.81, 220, 246.94, 293.66, 246.94, 220, 196, 164.81] },
  { id: "two-day-town", title: "Two Day Town", artist: "Hollow Weekend", artistId: "hollow-weekend", album: "Two Day Town", year: 2018, genre: "Alternative", colors: ["#d4a373", "#606c38"], notes: [196, 246.94, 293.66, 329.63, 293.66, 246.94, 220, 196] },
  { id: "new-moon-radio", title: "New Moon Radio", artist: "Elio Park", artistId: "elio-park", album: "Night Transit", year: 2026, genre: "R&B", colors: ["#4cc9f0", "#3a0ca3"], notes: [220, 277.18, 329.63, 415.3, 369.99, 329.63, 277.18, 246.94] },
  { id: "night-transit", title: "Night Transit", artist: "Elio Park", artistId: "elio-park", album: "Night Transit", year: 2026, genre: "R&B", colors: ["#4361ee", "#7209b7"], notes: [246.94, 311.13, 369.99, 466.16, 415.3, 369.99, 311.13, 277.18] },
  { id: "sugar-coast", title: "Sugar Coast", artist: "Palma", artistId: "palma", album: "Tidepool", year: 2024, genre: "Pop", colors: ["#ff9f1c", "#2ec4b6"], notes: [261.63, 329.63, 392, 440, 523.25, 440, 392, 329.63] },
  { id: "tidepool", title: "Tidepool", artist: "Palma", artistId: "palma", album: "Tidepool", year: 2024, genre: "Pop", colors: ["#00b4d8", "#ffb703"], notes: [293.66, 349.23, 440, 523.25, 493.88, 440, 349.23, 293.66] },
  { id: "soft-focus", title: "Soft Focus", artist: "Lumen Field", artistId: "lumen-field", album: "Still Life", year: 2017, genre: "Ambient", colors: ["#90e0ef", "#a8dadc"], notes: [174.61, 220, 261.63, 329.63, 261.63, 220, 196, 174.61] },
  { id: "still-life", title: "Still Life", artist: "Lumen Field", artistId: "lumen-field", album: "Still Life", year: 2017, genre: "Ambient", colors: ["#bde0fe", "#cdb4db"], notes: [196, 246.94, 293.66, 349.23, 293.66, 246.94, 220, 196] },
  { id: "borrowed-time", title: "Borrowed Time", artist: "Kite Theory", artistId: "kite-theory", album: "Good Measure", year: 2023, genre: "Rock", colors: ["#ef233c", "#2b2d42"], notes: [164.81, 246.94, 329.63, 293.66, 246.94, 220, 196, 164.81] },
  { id: "good-measure", title: "Good Measure", artist: "Kite Theory", artistId: "kite-theory", album: "Good Measure", year: 2023, genre: "Rock", colors: ["#f77f00", "#9d0208"], notes: [196, 293.66, 392, 349.23, 293.66, 261.63, 220, 196] },
];

export function normalize(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function searchSongs(query: string, limit = 10): Song[] {
  const q = normalize(query).slice(0, 100);
  if (q.length < 2) return [];
  return SONGS.map((song) => {
    const title = normalize(song.title);
    const artist = normalize(song.artist);
    const album = normalize(song.album);
    let score = 0;
    if (title === q) score += 100;
    if (title.startsWith(q)) score += 60;
    if (artist === q) score += 55;
    if (artist.startsWith(q)) score += 40;
    if (title.includes(q)) score += 30;
    if (artist.includes(q)) score += 25;
    if (album.includes(q)) score += 10;
    return { song, score };
  })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.song.title.localeCompare(b.song.title))
    .slice(0, limit)
    .map((entry) => entry.song);
}

export function getSong(id: string): Song {
  return SONGS.find((song) => song.id === id) ?? SONGS[0];
}


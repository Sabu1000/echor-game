# Build Specification: Six-Try Song Snippet Guessing Game

> A clean-room, build-ready specification for recreating the **gameplay and product behavior** of Songless/Heardle-style music guessing games. Use your own product name, logo, copy, visual assets, and properly licensed audio. This document does not reproduce the reference site's private source code.

## 1. Product Summary

Build a responsive web application in which a player must identify a mystery song in six attempts.

The round starts with only **0.1 seconds** of audio. Every incorrect guess or skip unlocks a longer version of the same song opening. The player searches a large music catalog by song title or artist, selects one result, and submits it.

The game should support:

- One shared **daily puzzle**.
- Six attempts.
- Progressively longer snippets.
- Search/autocomplete over a large song catalog.
- Four attempt results: skipped, wrong artist and song, right artist but wrong song, and correct song.
- Win/loss reveal screen.
- Spoiler-free result sharing.
- Anonymous local statistics.
- Optional sign-in and cloud-synced statistics.
- Optional unlimited and custom challenge modes.

## 2. Research Findings and Parity Target

The public Songless page describes the core loop as: listen to a snippet, guess the song, and unlock more audio after wrong answers. It also advertises sign-in for statistics and custom games.

Public screenshots and third-party descriptions consistently show:

- Six guess rows.
- A play button for the currently unlocked snippet.
- A search input accepting song title or artist.
- Skip/next and submit actions.
- A segmented timeline showing how much audio is unlocked.
- Red feedback for a wrong artist and song.
- Yellow feedback for the right artist but wrong song.
- Green feedback for the correct song.
- A daily game structure with shareable results.

The initial duration is publicly described as **0.1 seconds**. Reports agree on intermediate unlocks around **0.5, 1, 2, and 5 seconds**, but descriptions differ on the final duration. Therefore, duration progression must be configuration-driven rather than scattered through UI code.

Use this default parity configuration:

```ts
export const SNIPPET_LENGTHS_SECONDS = [0.1, 0.5, 1, 2, 5, 16] as const;
export const MAX_ATTEMPTS = SNIPPET_LENGTHS_SECONDS.length;
```

Before public launch, manually compare the live reference game's six timeline labels and change only this configuration if needed.

## 3. Important Legal and Product Constraint

The largest production risk is not the code; it is permission to stream copyrighted music.

Do **not** assume that a preview URL from a music service gives permission to build a standalone music game:

- Apple's iTunes Search API exposes 30-second preview URLs, but Apple's published terms say promotional content may be used to promote store content and not for independent entertainment value.
- Spotify currently marks track `preview_url` as nullable and deprecated, and its policy says preview clips cannot be offered as a standalone service.

For a public commercial launch, use one of these paths:

1. License the recordings and composition rights needed for this use.
2. Partner with labels, distributors, artists, or a music-licensing provider.
3. Use music uploaded by participating artists under explicit terms.
4. Use a catalog of royalty-free or public-domain music with verified rights.

For development, use original test tracks, Creative Commons tracks whose license permits the use, or synthetic audio. Do not ship copyrighted preview files merely because they are technically accessible.

## 4. Recommended Technology Stack

The specification is framework-independent, but this stack is practical:

- **Frontend:** Next.js with TypeScript and React.
- **Styling:** Tailwind CSS or CSS Modules.
- **Client state:** React reducer or Zustand.
- **Backend:** Next.js route handlers, Fastify, NestJS, or another TypeScript server.
- **Database:** PostgreSQL.
- **Search:** PostgreSQL full-text search plus `pg_trgm` initially; Meilisearch or Typesense at larger scale.
- **Audio storage:** S3-compatible object storage plus a CDN.
- **Audio processing:** FFmpeg worker or offline ingestion job.
- **Authentication:** Auth.js, Clerk, Supabase Auth, or another established provider.
- **Caching/rate limiting:** Redis-compatible service.
- **Analytics/errors:** privacy-conscious analytics plus Sentry or equivalent.

A single Next.js application with PostgreSQL and object storage is enough for the first production version.

## 5. Game Rules

### 5.1 Starting a round

1. Load today's puzzle for the selected mode.
2. Restore saved progress if the user already started it.
3. Display six empty attempt rows.
4. Unlock only snippet 1.
5. Do not reveal answer metadata, artwork, album, year, audio filename, or object-storage path.

### 5.2 Playing audio

- The player must press Play; audio must never autoplay on page load.
- The first attempt plays the first 0.1 seconds of the selected source segment.
- Pressing Play again replays the currently unlocked duration without costing an attempt.
- Only one playback may be active at a time.
- The play button becomes a stop button while audio is playing.
- The progress indicator animates only through the currently unlocked segment.

### 5.3 Making a guess

1. Player types at least two characters.
2. Search returns matching songs.
3. Each result shows `Song Title — Artist` and optionally year/album for disambiguation.
4. Player must select a catalog result; arbitrary text cannot be submitted.
5. Submit sends the selected internal song ID to the server.
6. The server evaluates the guess and returns only the attempt result and updated state.

### 5.4 Attempt result types

```ts
type AttemptResult =
  | "SKIPPED"
  | "WRONG"
  | "ARTIST_MATCH"
  | "CORRECT";
```

Rules:

- `CORRECT`: selected song ID equals the puzzle's answer song ID.
- `ARTIST_MATCH`: not the correct recording, but at least one canonical artist ID overlaps with the answer's accepted artist IDs.
- `WRONG`: no accepted artist overlap.
- `SKIPPED`: the player selected Skip rather than submitting a song.

Visual mapping:

- Skipped: neutral gray.
- Wrong artist and song: red.
- Right artist, wrong song: yellow.
- Correct: green.

Do not rely on string equality for artist matching. Store canonical artist IDs so punctuation, aliases, featured artists, and capitalization do not produce inconsistent results.

### 5.5 Progressing attempts

After `WRONG`, `ARTIST_MATCH`, or `SKIPPED`:

1. Permanently fill the current row with its result.
2. Increment the attempt index.
3. Unlock the next snippet duration.
4. Clear the selected guess and search query.
5. Return focus to the search input after the result animation.

After `CORRECT`:

1. End the round immediately.
2. Mark remaining rows unused.
3. Reveal answer metadata and artwork.
4. Save statistics once.
5. Display Share and Listen/learn-more actions.

After the sixth unsuccessful attempt:

1. End the round as a loss.
2. Reveal the answer.
3. Save statistics once.
4. Display Share and Listen/learn-more actions.

### 5.6 Duplicate guesses

Reject a song ID that the player already submitted in the same round.

Return a non-attempt-consuming validation error:

```json
{
  "code": "DUPLICATE_GUESS",
  "message": "You already guessed that song."
}
```

### 5.7 Skip

Skip consumes an attempt and unlocks the next snippet. Require a short confirmation only on the final attempt:

> Skip your last attempt and reveal the answer?

## 6. Game State Machine

```ts
type GamePhase =
  | "LOADING"
  | "READY"
  | "PLAYING"
  | "SUBMITTING"
  | "WON"
  | "LOST"
  | "ERROR";

interface ClientGameState {
  puzzleId: string;
  puzzleNumber: number;
  dateKey: string;
  mode: "DAILY" | "UNLIMITED" | "CUSTOM";
  phase: GamePhase;
  currentAttempt: number; // 0 through 5
  unlockedDurationSeconds: number;
  attempts: AttemptView[];
  selectedSong: SongSearchResult | null;
  searchQuery: string;
  answer?: RevealedAnswer; // returned only after win/loss
}

interface AttemptView {
  attemptNumber: number;
  guessedSong?: {
    id: string;
    title: string;
    artistDisplay: string;
  };
  result: AttemptResult;
}
```

Valid transitions:

```text
LOADING -> READY | ERROR
READY -> PLAYING | SUBMITTING
PLAYING -> READY
SUBMITTING -> READY | WON | LOST | ERROR
ERROR -> LOADING
WON and LOST are terminal for that puzzle.
```

Use a reducer or finite-state machine so double clicks cannot submit twice or advance two attempts.

## 7. Audio Architecture

### 7.1 Recommended production approach: pre-generated clips

For each puzzle song, create six separate clips during ingestion:

```text
song/{opaque-id}/clip-1.m4a   0.1s
song/{opaque-id}/clip-2.m4a   0.5s
song/{opaque-id}/clip-3.m4a   1.0s
song/{opaque-id}/clip-4.m4a   2.0s
song/{opaque-id}/clip-5.m4a   5.0s
song/{opaque-id}/clip-6.m4a  16.0s
```

Benefits:

- The browser never receives a longer clip before it is unlocked.
- A user cannot drag the playhead to hear future audio.
- Exact 100 ms playback is more reliable than pausing an HTML audio element with a JavaScript timer.
- CDN caching is straightforward.
- Mobile playback is more consistent.

Audio ingestion requirements:

- Normalize the source to a consistent sample rate and codec.
- Remove embedded metadata and cover art.
- Use opaque storage object names.
- Generate clips from a configurable `clip_start_seconds`; default `0`.
- Validate that the source is at least as long as the maximum clip.
- Apply only a very short 3–5 ms fade at cut boundaries if audible clicks occur.
- Loudness-normalize the catalog to a conservative target so one song is not dramatically louder than another.
- Store a checksum so duplicate files are detected.

Illustrative FFmpeg command for one duration:

```bash
ffmpeg -i input.wav \
  -ss 0 \
  -t 0.5 \
  -map_metadata -1 \
  -af "loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=0.495:d=0.005" \
  -c:a aac -b:a 192k \
  clip-2.m4a
```

Generate each clip independently from the lossless master rather than recursively clipping an already encoded file.

### 7.2 Prototype approach: Web Audio API

A prototype can fetch a complete authorized preview into an `AudioBuffer` and play only the unlocked duration:

```ts
let context: AudioContext | null = null;
let buffer: AudioBuffer | null = null;
let activeSource: AudioBufferSourceNode | null = null;

export async function loadAudio(url: string): Promise<void> {
  context ??= new AudioContext();
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) throw new Error("Audio request failed");
  const bytes = await response.arrayBuffer();
  buffer = await context.decodeAudioData(bytes);
}

export async function playSnippet(durationSeconds: number): Promise<void> {
  if (!context || !buffer) throw new Error("Audio is not ready");
  if (context.state === "suspended") await context.resume();

  activeSource?.stop();
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.connect(context.destination);
  activeSource = source;

  source.start(context.currentTime, 0, durationSeconds);
  source.addEventListener("ended", () => {
    if (activeSource === source) activeSource = null;
  });
}

export function stopSnippet(): void {
  activeSource?.stop();
  activeSource = null;
}
```

Web Audio is appropriate here because buffer playback supports precise start offset and duration scheduling. It still exposes the complete fetched preview to a technically skilled user, so it is not the preferred anti-cheat design.

### 7.3 Browser restrictions

Create or resume the audio context from the user's Play click. Browsers commonly block audible playback that begins before user interaction.

### 7.4 Audio endpoint

```http
GET /api/puzzles/:puzzleId/audio/:attemptNumber
```

Server checks:

- The puzzle exists and is published.
- The player's server-side state has unlocked the requested attempt.
- Attempt number is between 1 and 6.
- The signed URL expires quickly.
- Responses disable range access if your storage/CDN configuration makes future audio retrievable through byte-range manipulation.

Response:

```json
{
  "url": "https://cdn.example.com/a/opaque-token",
  "expiresAt": "2026-08-02T03:15:00Z",
  "durationSeconds": 1
}
```

Never place answer IDs, song titles, artist names, or recognizable filenames in the URL.

## 8. Song Catalog and Search

### 8.1 Core schema

```sql
create table artists (
  id uuid primary key,
  name text not null,
  normalized_name text not null,
  aliases text[] not null default '{}',
  created_at timestamptz not null default now()
);

create table songs (
  id uuid primary key,
  title text not null,
  normalized_title text not null,
  album text,
  release_year smallint,
  genre text,
  artwork_url text,
  external_url text,
  source_master_key text not null,
  clip_start_seconds numeric(8,3) not null default 0,
  active boolean not null default false,
  rights_status text not null check (
    rights_status in ('PENDING', 'CLEARED', 'EXPIRED', 'BLOCKED')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table song_artists (
  song_id uuid not null references songs(id) on delete cascade,
  artist_id uuid not null references artists(id) on delete cascade,
  role text not null check (role in ('PRIMARY', 'FEATURED', 'REMIXER')),
  position smallint not null default 0,
  primary key (song_id, artist_id, role)
);

create table song_aliases (
  id uuid primary key,
  song_id uuid not null references songs(id) on delete cascade,
  alias text not null,
  normalized_alias text not null
);
```

### 8.2 Normalization

For search only, normalize strings by:

- Unicode NFKD normalization.
- Lowercasing.
- Removing diacritics.
- Replacing `&` with `and`.
- Converting punctuation to spaces.
- Collapsing repeated whitespace.
- Optionally removing common version suffixes such as `remastered`, but preserve the original display text.

Do not use normalized strings to decide the correct answer. Correctness uses immutable song IDs.

### 8.3 Search endpoint

```http
GET /api/songs/search?q=blinding%20lights&limit=10
```

Only return songs allowed as guesses. The answer can be present in results; the search endpoint must not rank it higher merely because it is today's answer.

Suggested ranking:

1. Exact normalized title.
2. Title prefix.
3. Exact artist.
4. Artist prefix.
5. Alias match.
6. Token/trigram similarity.
7. Catalog popularity as a stable tie-breaker.

Response:

```json
{
  "results": [
    {
      "id": "uuid",
      "title": "Blinding Lights",
      "artistDisplay": "The Weeknd",
      "album": "After Hours",
      "releaseYear": 2020
    }
  ]
}
```

Requirements:

- Debounce requests by 150–250 ms.
- Abort stale requests with `AbortController`.
- Minimum query length: 2.
- Maximum query length: 100.
- Limit: 10–20 results.
- Rate-limit by IP/session.
- Keyboard controls: up, down, enter, escape.
- Screen-reader announcements for result count and current selection.

### 8.4 Large catalog behavior

For tens of thousands of songs, PostgreSQL trigram indexes are normally sufficient. For hundreds of thousands or multilingual typo-tolerant search, move the public search index to Meilisearch or Typesense while keeping PostgreSQL authoritative.

## 9. Puzzle Scheduling

### 9.1 Database schema

```sql
create table puzzles (
  id uuid primary key,
  puzzle_number bigint not null unique,
  date_key date,
  mode text not null check (mode in ('DAILY', 'UNLIMITED', 'CUSTOM')),
  song_id uuid not null references songs(id),
  snippet_lengths_seconds numeric[] not null,
  status text not null check (status in ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'RETIRED')),
  publish_at timestamptz,
  custom_slug text unique,
  created_by uuid,
  created_at timestamptz not null default now()
);

create unique index one_daily_puzzle_per_date
  on puzzles(date_key)
  where mode = 'DAILY';
```

### 9.2 Daily rollover

Use a documented timezone. UTC is the simplest global rule:

```ts
const dateKey = new Date().toISOString().slice(0, 10);
```

The database—not the browser clock—decides which puzzle is current. Return `nextPuzzleAt` so the UI can show a countdown.

### 9.3 Song selection rules

The admin scheduler should reject:

- Songs without `rights_status = 'CLEARED'`.
- Missing or invalid generated clips.
- A repeat within a configured cooldown period.
- Multiple recent songs by the same primary artist.
- Sources that fail playback checks in major target regions.

Optional balancing constraints:

- Genre distribution.
- Decade distribution.
- Difficulty tier.
- Explicit-content policy.
- Regional availability.

## 10. Server-Side Player Progress

Do not trust the browser's attempt number. Store authoritative progress in a signed anonymous session or database row.

```sql
create table game_sessions (
  id uuid primary key,
  user_id uuid,
  anonymous_token_hash text,
  puzzle_id uuid not null references puzzles(id),
  status text not null check (status in ('IN_PROGRESS', 'WON', 'LOST')),
  current_attempt smallint not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, puzzle_id)
);

create table guesses (
  id uuid primary key,
  game_session_id uuid not null references game_sessions(id) on delete cascade,
  attempt_number smallint not null,
  guessed_song_id uuid references songs(id),
  result text not null check (result in ('SKIPPED', 'WRONG', 'ARTIST_MATCH', 'CORRECT')),
  created_at timestamptz not null default now(),
  unique (game_session_id, attempt_number)
);
```

For anonymous users, set an `HttpOnly`, `Secure`, `SameSite=Lax` random session cookie. Hash the token in the database. Local storage can cache UI state, but the server remains authoritative.

## 11. API Contract

### 11.1 Load today's puzzle

```http
GET /api/puzzles/today
```

```json
{
  "puzzle": {
    "id": "opaque-puzzle-id",
    "number": 214,
    "dateKey": "2026-08-02",
    "mode": "DAILY",
    "maxAttempts": 6,
    "snippetLengthsSeconds": [0.1, 0.5, 1, 2, 5, 16],
    "nextPuzzleAt": "2026-08-03T00:00:00Z"
  },
  "game": {
    "status": "IN_PROGRESS",
    "currentAttempt": 0,
    "attempts": [],
    "unlockedDurationSeconds": 0.1
  }
}
```

Do not include the answer song ID before completion.

### 11.2 Submit a guess

```http
POST /api/games/:puzzleId/guess
Content-Type: application/json
Idempotency-Key: <uuid>
```

```json
{
  "songId": "selected-song-uuid"
}
```

Response after an incorrect second attempt:

```json
{
  "attempt": {
    "attemptNumber": 2,
    "result": "ARTIST_MATCH",
    "guessedSong": {
      "id": "selected-song-uuid",
      "title": "Another Song",
      "artistDisplay": "Same Artist"
    }
  },
  "game": {
    "status": "IN_PROGRESS",
    "currentAttempt": 2,
    "unlockedDurationSeconds": 1
  }
}
```

Response after completion:

```json
{
  "attempt": {
    "attemptNumber": 3,
    "result": "CORRECT",
    "guessedSong": {
      "id": "uuid",
      "title": "Correct Song",
      "artistDisplay": "Correct Artist"
    }
  },
  "game": {
    "status": "WON",
    "currentAttempt": 3,
    "completedAt": "2026-08-02T03:10:00Z"
  },
  "answer": {
    "title": "Correct Song",
    "artistDisplay": "Correct Artist",
    "album": "Album",
    "releaseYear": 2021,
    "artworkUrl": "https://...",
    "externalUrl": "https://licensed-destination.example/..."
  }
}
```

### 11.3 Skip

```http
POST /api/games/:puzzleId/skip
Idempotency-Key: <uuid>
```

The response shape is the same as a guess with `result = "SKIPPED"`.

### 11.4 Idempotency

Every guess and skip must include an idempotency key. Store the key and response for a short period or enforce a unique request record. A double click or retry must never consume two attempts.

### 11.5 Restore progress

Loading the puzzle returns the server's current attempts. This allows refresh, multiple tabs, and a second device for signed-in users without corrupting state.

## 12. UI Specification

### 12.1 Page hierarchy

```text
App shell
├── Header
│   ├── Menu
│   ├── Product wordmark
│   ├── Statistics
│   └── Help
├── Mode navigation (Daily / Unlimited / Custom)
├── Puzzle panel
│   ├── Date or puzzle number
│   ├── Six attempt rows
│   ├── Segmented snippet timeline
│   ├── Current duration label
│   ├── Play/stop button
│   ├── Search combobox
│   ├── Skip button
│   └── Submit button
├── Result panel or modal
└── Footer
```

### 12.2 Attempt rows

Each row has a fixed height to prevent layout shifts.

States:

- Future: empty, muted border.
- Current: emphasized border and attempt number.
- Skipped: gray fill, label `Skipped`.
- Wrong: red fill, selected song and artist.
- Artist match: yellow fill, selected song and artist.
- Correct: green fill, selected song and artist.
- Unused after win: remain empty/muted.

Animations must be 150–250 ms and disabled when `prefers-reduced-motion` is enabled.

### 12.3 Timeline

Render six proportional or equal-width segments with clear unlock state. Behavior matters more than exact segment width:

- Completed attempt segments show their result color.
- Current segment is highlighted.
- Future segments are muted.
- Labels may show `0.1`, `0.5`, `1`, `2`, `5`, and `16 sec` on larger screens.
- On small screens, show the current duration and hide some labels rather than overflowing.

### 12.4 Search combobox

Placeholder:

> Search by song title or artist

Behavior:

- Dropdown appears under the field.
- Highlight matching text when useful.
- Results display title first, artist second.
- Selecting a result populates the field and enables Submit.
- Typing after selecting clears the selection.
- Clicking outside closes the dropdown.
- Empty state: `No songs found`.
- Network state: compact spinner.

### 12.5 Buttons

- Play is the primary circular action.
- Submit is disabled until a catalog item is selected.
- Skip remains available while the round is active.
- All buttons require visible focus states and accessible labels.
- Use a minimum 44×44 CSS pixel touch target.

### 12.6 Result screen

After win/loss, show:

- Album artwork.
- Song title.
- Artist.
- Album/year if available.
- `You got it in N/6` or `Better luck tomorrow`.
- Share button.
- External listen/learn-more link.
- Countdown until next daily puzzle.
- Statistics summary.

Do not show artwork before completion because it leaks the answer.

### 12.7 Help modal

Explain with a small legend:

- Play the current snippet.
- Search and select a song.
- Submit or skip to unlock more audio.
- Red: wrong artist and song.
- Yellow: right artist, wrong song.
- Green: correct.

Open automatically on a user's first visit and persist `hasSeenHowToPlay` locally.

### 12.8 Responsive behavior

Support portrait mobile from 320 px wide. Do not require landscape for normal play. For unusually short or narrow embedded viewports where the controls truly cannot fit, show a rotate/resize overlay rather than a broken interface.

## 13. Visual Direction

Create an original visual identity rather than copying branding pixel-for-pixel.

A parity-friendly design system:

```css
:root {
  --background: #111315;
  --surface: #1a1d20;
  --surface-raised: #22262a;
  --text: #f7f7f7;
  --text-muted: #a9adb2;
  --border: #3b4046;
  --wrong: #dc2626;
  --artist-match: #eab308;
  --correct: #59c72f;
  --skip: #73777d;
  --focus: #8bdc65;
  --radius: 6px;
}
```

Typography:

- Clear sans serif for controls.
- Optional distinctive display face for the wordmark only.
- Use tabular numerals for timers and durations.

## 14. Statistics

Track:

```ts
interface PlayerStats {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  maxStreak: number;
  winDistribution: Record<1 | 2 | 3 | 4 | 5 | 6, number>;
  lastCompletedDateKey: string | null;
}
```

Streak rule:

- Win today's daily puzzle after winning the immediately previous daily puzzle: increment.
- Win after missing one or more daily dates: reset to 1.
- Lose today's puzzle: reset to 0.
- Reopening a completed puzzle must not update stats again.

Anonymous:

- Save a local copy for immediate UI rendering.
- Keep authoritative completion state server-side when possible.

Signed in:

- Sync stats to the account.
- On first sign-in, merge anonymous history using immutable puzzle IDs and completion records, not by adding aggregate counters.

## 15. Sharing

The shared text must not reveal the song:

```text
YourGame #214 3/6
🟥🟨🟩⬛⬛⬛
🔊 1.0s
https://yourgame.example
```

Suggested emoji mapping:

- `🟥` wrong.
- `🟨` artist match.
- `🟩` correct.
- `⬜` skipped.
- `⬛` unused.

Use `navigator.share()` when available, with clipboard fallback. Confirm `Results copied` in a non-blocking toast.

## 16. Unlimited Mode

Unlimited mode uses the same game engine but creates a random puzzle session.

Rules:

- Choose from active, rights-cleared songs.
- Exclude songs played by this user in the recent history window.
- Allow optional genre, decade, or artist filters.
- Start a new round immediately after the result screen.
- Unlimited games do not affect the daily streak.

Endpoint:

```http
POST /api/puzzles/unlimited
```

Request:

```json
{
  "genre": "Rock",
  "decade": "2000s"
}
```

## 17. Custom Challenge Mode

A signed-in creator can search the catalog, select one song, and create a private challenge URL.

Flow:

1. Open Custom Challenge.
2. Search the same catalog.
3. Select a song.
4. Optionally set expiration and a short message.
5. Create challenge.
6. Receive an opaque URL such as `/c/7nC4kP2q`.

Security:

- The slug must be random, not derived from song metadata.
- Do not expose song ID in page source.
- Rate-limit creation.
- Allow creators to delete their challenges.
- Do not include custom games in daily statistics.

## 18. Admin and Catalog Ingestion

Admin functions:

- Create/edit artists and songs.
- Upload a source master.
- Record rights owner, territory, start/end dates, and proof/contract reference.
- Choose clip start time.
- Generate and audition all six snippets.
- Mark a song active only after validation.
- Schedule daily puzzles.
- View playback failure rates by song/region/browser.
- Retire a song immediately.

Suggested rights fields:

```sql
alter table songs add column rights_owner text;
alter table songs add column rights_start_at timestamptz;
alter table songs add column rights_end_at timestamptz;
alter table songs add column allowed_territories text[];
alter table songs add column rights_reference text;
```

Ingestion pipeline:

```text
Upload master
  -> virus/file validation
  -> decode validation
  -> metadata stripping
  -> loudness analysis
  -> generate six clips
  -> waveform/duration checks
  -> upload clips to private storage
  -> human audition
  -> rights approval
  -> activate song
```

## 19. Anti-Cheat Design

No browser game can be perfectly cheat-proof, but avoid accidental answer leaks:

- Validate guesses on the server.
- Do not serialize answer metadata into HTML, React props, client bundles, analytics events, or local storage.
- Do not use the answer song ID in public audio URLs.
- Serve only the currently unlocked clip.
- Strip ID3 metadata and cover art.
- Disable public object-storage listing.
- Use short-lived signed URLs.
- Never return the full song catalog with a `correct` flag.
- Do not reveal whether a search result is today's answer through ranking, caching, response timing, or CSS classes.
- Rate-limit guess endpoints but allow normal retries.
- Use idempotency keys.

Do not spend excessive effort fighting deliberate DevTools users at the expense of ordinary-player reliability. The goal is to prevent obvious leaks and leaderboard abuse.

## 20. Accessibility

Required:

- Fully keyboard-operable game.
- Semantic buttons and form labels.
- ARIA combobox pattern for search.
- Do not communicate result only by color; include icons/text.
- High-contrast focus states.
- `aria-live="polite"` announcements such as `Wrong guess. One-second clip unlocked.`
- Reduced-motion support.
- Volume/mute control or respect system volume.
- Captions are not appropriate before reveal because they would expose lyrics, but provide text metadata after completion.
- Avoid flashing animations.

Example announcement strings:

```text
Playing 0.5-second snippet.
Wrong artist and song. Attempt 3 of 6 is now available.
Right artist, wrong song. Two-second snippet unlocked.
Correct. You solved today's song in 4 attempts.
```

## 21. Error Handling

### Audio fails to load

- Retry automatically once with a fresh signed URL.
- Show `Audio could not be loaded. Try again.`
- Do not consume an attempt.
- Log puzzle ID, clip number, browser, region, and error category—never the user's search text unless needed and disclosed.

### Search unavailable

- Show retry state.
- Do not allow arbitrary text submission.
- Preserve the query while retrying.

### Guess request times out

- Keep the UI in a recoverable state.
- Retry with the same idempotency key.
- Re-fetch puzzle state if the final result is uncertain.

### Puzzle has been retired

- Replace it with a fallback puzzle or mark the daily challenge unavailable.
- Never silently switch songs after a user has already heard a clip unless the original audio is legally or technically unavailable; explain the reset.

## 22. Security and Privacy

- Validate all UUIDs and request bodies with a schema library.
- Use CSRF protection for cookie-authenticated mutations.
- Use strict Content Security Policy.
- Do not allow arbitrary external audio URLs from admin forms.
- Scan uploaded files.
- Keep object storage private.
- Escape all catalog metadata.
- Rate-limit search, guess, skip, login, and custom creation.
- Avoid collecting precise location.
- Provide account deletion and data export where required.
- Set a retention period for anonymous session data.

## 23. Testing Plan

### Unit tests

- Title/artist normalization.
- Artist overlap logic.
- Duplicate guess rejection.
- Attempt advancement.
- Final-attempt win and loss.
- Streak calculations across date boundaries.
- Share-grid generation.
- Daily date calculation.

### API integration tests

- Answer is absent before completion.
- Correct answer is returned only after terminal state.
- Locked audio clips return 403.
- Repeated idempotency key returns the same result.
- Two simultaneous guesses consume at most one attempt.
- Refresh restores the exact state.
- Duplicate song does not consume an attempt.

### End-to-end tests

1. New user opens help modal.
2. Player replays 0.1-second clip multiple times.
3. Player searches with keyboard and selects a result.
4. Wrong guess turns row red and unlocks 0.5 seconds.
5. Same-artist guess turns row yellow.
6. Skip creates a gray row.
7. Correct guess ends round and reveals answer.
8. Six misses end in loss.
9. Refresh after attempt 3 restores progress.
10. Share result contains no title or artist.
11. Mobile portrait layout fits at 320 px.
12. Screen reader receives result announcements.

### Audio quality tests

- Clip 1 is audibly 100 ms on Chrome, Safari, and Firefox.
- No metadata reveals the answer.
- No clip starts with encoder silence.
- All clips start from the exact same source timestamp.
- Loudness is reasonably consistent.
- Replay does not overlap previous playback.

## 24. Acceptance Criteria

The MVP is complete when:

- A player can finish a daily puzzle in six or fewer attempts.
- First playback is exactly the configured 0.1-second clip.
- Each wrong guess or skip unlocks exactly one longer clip.
- Search supports both title and artist across the full active catalog.
- A selected song is required to submit.
- Red/yellow/green/gray feedback is correct and also described with text/icons.
- The server does not expose the answer before game completion.
- Refresh does not reset or duplicate progress.
- The same daily puzzle is returned to every player for the configured date.
- Statistics update exactly once.
- Shared results are spoiler-free.
- Audio files used in production have documented rights clearance.

## 25. Suggested Project Structure

```text
src/
├── app/
│   ├── page.tsx
│   ├── daily/page.tsx
│   ├── unlimited/page.tsx
│   ├── custom/page.tsx
│   ├── c/[slug]/page.tsx
│   └── api/
│       ├── puzzles/today/route.ts
│       ├── puzzles/unlimited/route.ts
│       ├── puzzles/[id]/audio/[attempt]/route.ts
│       ├── games/[id]/guess/route.ts
│       ├── games/[id]/skip/route.ts
│       ├── songs/search/route.ts
│       └── custom/route.ts
├── components/
│   ├── GameBoard.tsx
│   ├── AttemptRow.tsx
│   ├── AudioPlayer.tsx
│   ├── SnippetTimeline.tsx
│   ├── SongCombobox.tsx
│   ├── ResultModal.tsx
│   ├── StatsModal.tsx
│   └── HowToPlayModal.tsx
├── features/game/
│   ├── gameReducer.ts
│   ├── gameTypes.ts
│   ├── gameApi.ts
│   └── shareResult.ts
├── server/
│   ├── db.ts
│   ├── puzzleService.ts
│   ├── gameService.ts
│   ├── searchService.ts
│   ├── audioService.ts
│   └── statsService.ts
├── lib/
│   ├── normalize.ts
│   ├── validation.ts
│   ├── idempotency.ts
│   └── dates.ts
└── workers/
    └── audioIngestion.ts
```

## 26. Build Order

### Phase 1: playable vertical slice

- Seed 20 cleared/test songs.
- Build database schema.
- Pre-generate six clips per song.
- Build daily puzzle endpoint.
- Build audio player, rows, search, guess, and skip.
- Implement win/loss.

### Phase 2: production reliability

- Server-authoritative sessions.
- Signed audio URLs.
- Idempotency.
- Rate limiting.
- Restore after refresh.
- Error monitoring and audio health checks.

### Phase 3: retention

- Local/cloud stats.
- Streaks.
- Share output.
- Countdown.
- First-visit help.

### Phase 4: catalog growth

- Admin ingestion.
- Rights tracking.
- Search optimization.
- Scheduling and cooldown rules.

### Phase 5: expansion

- Unlimited mode.
- Genre/decade filters.
- Custom challenge links.
- Account sync.

## 27. One-Pass Coding-Agent Prompt

Copy the following into a coding agent after choosing your stack and audio source:

```text
Build a production-quality responsive song guessing web game from the attached specification.

Core behavior:
- Six attempts.
- Snippet durations are configured as [0.1, 0.5, 1, 2, 5, 16] seconds.
- The player can replay the current snippet without spending an attempt.
- A wrong guess or skip consumes one attempt and unlocks the next clip.
- Guess feedback values are SKIPPED, WRONG, ARTIST_MATCH, and CORRECT.
- Songs must be selected from an accessible autocomplete catalog that searches title and artist.
- Correctness and attempt progression are server-authoritative.
- Never send answer metadata to the browser before win/loss.
- Serve only the currently unlocked pre-generated audio clip through short-lived opaque URLs.
- Persist progress across refreshes.
- Add local anonymous stats, spoiler-free sharing, a help modal, and mobile/keyboard accessibility.

Use TypeScript throughout, validate API inputs, add idempotency to guess/skip mutations, include database migrations and seed data containing only placeholder/test audio, and add unit, integration, and end-to-end tests for the acceptance criteria. Do not copy the reference site's branding or proprietary assets.
```

## 28. Sources Consulted

- Songless public game page: <https://lessgames.com/songless>
- Public game directory description of Songless: <https://listdle.com/games/songless>
- Public Songless guide and gameplay summary: <https://seekdle.com/game/songless/>
- Apple iTunes Search API overview and usage terms: <https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/>
- Apple Search API result fields, including preview URLs: <https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/UnderstandingSearchResults.html>
- Spotify Web API reference and preview policy: <https://developer.spotify.com/documentation/web-api/reference/search>
- MDN Web Audio API best practices: <https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices>
- MDN `AudioBufferSourceNode.start()` timing/duration: <https://developer.mozilla.org/en-US/docs/Web/API/AudioBufferSourceNode/start>
- MDN autoplay guidance: <https://developer.mozilla.org/en-US/docs/Web/Media/Guides/Autoplay>

---

### Final implementation note

The observable game can be reproduced closely, but the reference site's private source code, exact database, licensing agreements, selection algorithm, and unpublished backend behavior cannot be determined from the public interface. The architecture above recreates the player-facing behavior while improving security, accessibility, and operational reliability.

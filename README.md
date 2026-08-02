# ECHOR

A responsive six-try daily song-snippet guessing game, recreated from the supplied product specification with an original visual identity and original browser-synthesized demo music.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vinext. Production validation:

```bash
npm test
npm run lint
npm run build
```

## Included

- Shared UTC daily puzzle with six progressive snippets: 0.1, 0.5, 1, 2, 5, and 16 seconds
- Searchable fictional song catalog with keyboard-accessible autocomplete
- Wrong, same-artist, skipped, and correct feedback
- Duplicate-guess prevention and final-skip confirmation
- Replay/stop, animated timeline, and volume control using Web Audio
- Refresh-safe anonymous progress and daily statistics
- Spoiler-free native sharing with clipboard fallback
- First-visit help, statistics, win/loss reveal, and next-puzzle countdown
- Unlimited rounds and device-local custom challenges
- Responsive layout down to 320 px and reduced-motion support

## Audio and persistence

The demo creates short original melodies in the browser with the Web Audio API; it includes no copyrighted recordings. Game progress, custom challenges, and anonymous statistics are stored on the current device. A public production version should replace this demo layer with licensed, pre-generated clips and server-authoritative sessions as described in the supplied specification.

## Automatic music import

The admin library is available at `/admin/music`. It includes Jamendo provider search, conservative license validation, single and bulk imports, a durable D1 queue, retryable failures, R2 clip storage, rights records, and a READY-only daily scheduler.

1. Copy `.env.example` to `.env` and add a Jamendo developer client ID.
2. Install FFmpeg and FFprobe on the machine that runs the processor.
3. Set the same `AUDIO_PROCESSOR_TOKEN` for the site and processor.
4. Start the processor with `npm run audio-worker`, then run the site with `npm run dev`.

The processor downloads each authorized source into a unique system temporary directory, strips metadata/artwork, loudness-normalizes, independently generates all six AAC clips, validates durations with FFprobe, returns the snippets for opaque R2 storage, and deletes the entire temporary directory in a `finally` block. Original source audio is never retained.

Hosted runtime configuration uses `DB` (D1) and `MUSIC_BUCKET` (R2), declared in `.openai/hosting.json`. Set `ADMIN_EMAILS` in production so only listed workspace users can call the admin APIs. The default license policy permits CC0 and attribution-only Creative Commons URLs while rejecting NC, ND, missing, and unknown licenses; legal review should approve any production policy changes.

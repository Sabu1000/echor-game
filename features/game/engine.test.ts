import assert from "node:assert/strict";
import test from "node:test";
import { SONGS, normalize, searchSongs } from "./catalog.ts";
import { createSession, evaluateGuess, isDuplicate, shareText, submitAttempt } from "./engine.ts";
import { JamendoProvider } from "../../server/music/providers/jamendo.ts";
import type { ProviderSong } from "../../server/music/types.ts";

test("search normalization handles punctuation and artist queries", () => {
  assert.equal(normalize("  Paper & Satellítes! "), "paper and satellites");
  assert.equal(searchSongs("June Atlas")[0]?.artist, "June Atlas");
});

test("guess evaluation distinguishes exact and same-artist guesses", () => {
  assert.equal(evaluateGuess(SONGS[0], SONGS[0]), "CORRECT");
  assert.equal(evaluateGuess(SONGS[0], SONGS[1]), "ARTIST_MATCH");
  assert.equal(evaluateGuess(SONGS[0], SONGS[2]), "WRONG");
});

test("attempt progression ends on six misses", () => {
  let session = createSession("UNLIMITED", "test", SONGS[0].id);
  for (let index = 0; index < 6; index += 1) session = submitAttempt(session, "WRONG", SONGS[index + 2].id);
  assert.equal(session.status, "LOST");
  assert.equal(session.attempts.length, 6);
});

test("duplicate detection and spoiler-free share grid", () => {
  let session = createSession("UNLIMITED", "test-two", SONGS[0].id);
  session = submitAttempt(session, "WRONG", SONGS[2].id);
  assert.equal(isDuplicate(session, SONGS[2].id), true);
  session = submitAttempt(session, "CORRECT", SONGS[0].id);
  const shared = shareText(session);
  assert.match(shared, /🟥🟩⬛⬛⬛⬛/u);
  assert.equal(shared.includes(SONGS[0].title), false);
});

test("Jamendo license gate rejects NC/ND and unavailable downloads", () => {
  const provider = new JamendoProvider("test-client", ["https://creativecommons.org/licenses/by/"]);
  const base: ProviderSong = {
    provider: "jamendo", providerSongId: "1", title: "Test", artist: "Artist", duration: 120,
    license: "CC BY 4.0", licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
    downloadUrl: "https://example.test/audio.mp3", downloadAllowed: true, providerResponse: {},
  };
  assert.equal(provider.validateLicense(base).allowed, true);
  assert.equal(provider.validateLicense({ ...base, licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/" }).allowed, false);
  assert.equal(provider.validateLicense({ ...base, licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/" }).allowed, false);
  assert.equal(provider.validateLicense({ ...base, downloadAllowed: false }).allowed, false);
});

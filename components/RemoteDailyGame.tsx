"use client";

import { useEffect, useId, useRef, useState } from "react";
import { SNIPPET_LENGTHS, type AttemptResult } from "@/features/game/types";
import { ArrowIcon, CalendarIcon, CheckIcon, HeadphonesIcon, PlayIcon, SearchIcon, ShareIcon, StopIcon, VolumeIcon } from "./Icons";

interface RemoteSong { id: string; title: string; artistDisplay: string; album?: string | null; releaseYear?: number | null; }
interface RemoteAttempt { attemptNumber: number; result: AttemptResult; guessedSong?: RemoteSong; }
interface RemoteGame { status: "IN_PROGRESS" | "WON" | "LOST"; currentAttempt: number; attempts: RemoteAttempt[]; unlockedDurationSeconds: number; completedAt?: string | null; }
interface RemoteAnswer { title: string; artistDisplay: string; album?: string | null; releaseYear?: number | null; genre?: string | null; artworkUrl?: string | null; }
export interface RemoteDailyPayload {
  scheduled: true;
  puzzle: { id: string; number: number; dateKey: string; mode: "DAILY"; maxAttempts: number; snippetLengthsSeconds: readonly number[]; nextPuzzleAt: string };
  game: RemoteGame;
  answer?: RemoteAnswer;
}

const LABELS: Record<AttemptResult, string> = { SKIPPED: "Skipped", WRONG: "Wrong artist & song", ARTIST_MATCH: "Right artist, wrong song", CORRECT: "Correct!" };
const SYMBOLS: Record<AttemptResult, string> = { SKIPPED: "—", WRONG: "×", ARTIST_MATCH: "≈", CORRECT: "✓" };
const EMOJI: Record<AttemptResult, string> = { SKIPPED: "⬜", WRONG: "🟥", ARTIST_MATCH: "🟨", CORRECT: "🟩" };

function countdown(): string {
  const now = new Date();
  const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  const remaining = Math.max(0, next - Date.now());
  return [Math.floor(remaining / 3_600_000), Math.floor((remaining % 3_600_000) / 60_000), Math.floor((remaining % 60_000) / 1000)].map((value) => String(value).padStart(2, "0")).join(":");
}

export default function RemoteDailyGame({ initial, onToast }: { initial: RemoteDailyPayload; onToast: (message: string) => void }) {
  const [payload, setPayload] = useState(initial);
  const [selected, setSelected] = useState<RemoteSong | null>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(.75);
  const [submitting, setSubmitting] = useState(false);
  const [clock, setClock] = useState(countdown());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const complete = payload.game.status !== "IN_PROGRESS";
  const duration = SNIPPET_LENGTHS[payload.game.currentAttempt];

  useEffect(() => {
    const timer = window.setInterval(() => setClock(countdown()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  }, []);

  function stop() {
    audioRef.current?.pause();
    audioRef.current = null;
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    setPlaying(false); setProgress(0);
  }

  async function play() {
    if (playing) { stop(); return; }
    const audio = new Audio(`/api/puzzles/${payload.puzzle.id}/audio/${payload.game.currentAttempt + 1}`);
    audio.volume = volume;
    audio.preload = "auto";
    audioRef.current = audio;
    audio.onended = stop;
    audio.onerror = () => { stop(); onToast("Audio could not be loaded. Try again."); };
    try {
      await audio.play();
      setPlaying(true);
      startedAtRef.current = performance.now();
      const animate = () => {
        const next = Math.min(100, ((performance.now() - startedAtRef.current) / (duration * 1000)) * 100);
        setProgress(next);
        if (next < 100) animationRef.current = requestAnimationFrame(animate);
      };
      animationRef.current = requestAnimationFrame(animate);
    } catch { stop(); onToast("Audio playback was blocked. Tap play again."); }
  }

  async function mutate(kind: "guess" | "skip") {
    if (submitting || complete || (kind === "guess" && !selected)) return;
    if (kind === "skip" && payload.game.currentAttempt === 5 && !window.confirm("Skip your last attempt and reveal the answer?")) return;
    stop(); setSubmitting(true);
    try {
      const response = await fetch(`/api/games/${payload.puzzle.id}/${kind}`, {
        method: "POST", credentials: "include",
        headers: { "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
        body: kind === "guess" ? JSON.stringify({ songId: selected?.id }) : undefined,
      });
      const result = await response.json() as { attempt?: RemoteAttempt; game?: RemoteGame; answer?: RemoteAnswer; message?: string; error?: string };
      if (!response.ok || !result.game) throw new Error(result.message || result.error || "Guess could not be submitted.");
      setPayload((current) => ({ ...current, game: result.game!, answer: result.answer ?? current.answer }));
      setSelected(null);
      const label = result.attempt ? LABELS[result.attempt.result] : "Attempt saved";
      onToast(result.game.status === "IN_PROGRESS" ? `${label}. ${result.game.unlockedDurationSeconds}-second clip unlocked.` : label);
    } catch (error) { onToast(error instanceof Error ? error.message : "Something went wrong."); }
    finally { setSubmitting(false); }
  }

  async function share() {
    const grid = payload.game.attempts.map((attempt) => EMOJI[attempt.result]).join("") + "⬛".repeat(6 - payload.game.attempts.length);
    const score = payload.game.status === "WON" ? `${payload.game.attempts.length}/6` : "X/6";
    const text = `ECHOR #${payload.puzzle.number} ${score}\n${grid}\n🔊 ${duration}s\n${location.origin}`;
    const sharingNavigator = navigator as Navigator & { share?: (data: ShareData) => Promise<void> };
    try {
      if (typeof sharingNavigator.share === "function") await sharingNavigator.share({ title: "ECHOR result", text });
      else await navigator.clipboard.writeText(text);
      onToast("Results ready to share");
    } catch { /* native share was cancelled */ }
  }

  const dateLabel = new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${payload.puzzle.dateKey}T12:00:00Z`));
  return <main className="game-page">
    <section className="puzzle-heading"><div><span className="eyebrow">TODAY&apos;S IMPORTED TRACK</span><h1>Name that song.</h1></div><div className="puzzle-meta"><span>#{payload.puzzle.number}</span><span className="meta-divider" /><span><CalendarIcon /> {dateLabel}</span></div></section>
    <section className="game-card" aria-label="Scheduled daily song guessing game">
      <div className="attempt-header"><span>YOUR GUESSES</span><span>{complete ? "ROUND COMPLETE" : `ATTEMPT ${payload.game.attempts.length + 1} OF 6`}</span></div>
      <div className="attempt-list">{Array.from({ length: 6 }, (_, index) => {
        const attempt = payload.game.attempts[index]; const current = !complete && index === payload.game.attempts.length;
        return <div key={index} className={`attempt-row ${attempt ? `result-${attempt.result.toLowerCase()}` : current ? "current" : "future"}`}><span className="attempt-number">{String(index + 1).padStart(2, "0")}</span>{attempt ? <><span className="result-symbol">{SYMBOLS[attempt.result]}</span><span className="attempt-copy"><strong>{attempt.guessedSong?.title ?? "Skipped"}</strong><small>{attempt.guessedSong?.artistDisplay ?? "No guess submitted"}</small></span><span className="attempt-result-label">{LABELS[attempt.result]}</span></> : <span className="empty-copy">{current ? "Listening now…" : "Locked"}</span>}</div>;
      })}</div>
      <div className="timeline-block"><div className="timeline-labels"><span>SNIPPET LENGTH</span><strong>{duration < 1 ? duration.toFixed(1) : duration.toFixed(0)} <small>SEC</small></strong></div><div className="timeline">{SNIPPET_LENGTHS.map((value, index) => { const attempt = payload.game.attempts[index]; const state = attempt ? `segment-${attempt.result.toLowerCase()}` : index === payload.game.currentAttempt ? "segment-current" : "segment-future"; return <div key={value} className={`timeline-segment ${state}`}><span>{value}s</span></div>; })}<div className="timeline-playhead" style={{ width: playing ? `${progress / 6}%` : 0, left: `${payload.game.currentAttempt * (100 / 6)}%` }} /></div></div>
      <div className="player-area"><button className={`play-button ${playing ? "playing" : ""}`} onClick={play} aria-label={playing ? "Stop snippet" : `Play ${duration} second snippet`}>{playing ? <StopIcon /> : <PlayIcon />}</button><div className="player-copy"><strong>{playing ? "Listening…" : "Tap to hear the clue"}</strong><span>Secured imported audio · replay anytime</span></div><label className="volume-control"><VolumeIcon /><span className="sr-only">Volume</span><input type="range" min="0" max="1" step=".05" value={volume} onChange={(event) => { const next = Number(event.target.value); setVolume(next); if (audioRef.current) audioRef.current.volume = next; }} /></label></div>
      {!complete ? <div className="guess-zone"><RemoteSearch selected={selected} onSelect={setSelected} /><div className="guess-actions"><button className="skip-button" disabled={submitting} onClick={() => mutate("skip")}>Skip <span>+ unlock more</span></button><button className="submit-button" disabled={!selected || submitting} onClick={() => mutate("guess")}>{submitting ? "Checking…" : "Submit guess"}<ArrowIcon /></button></div></div> : payload.answer && <RemoteResult answer={payload.answer} game={payload.game} clock={clock} onShare={share} />}
    </section>
    <p className="audio-disclaimer"><HeadphonesIcon /> Imported through the licensed music pipeline · Best with headphones</p>
  </main>;
}

function RemoteSearch({ selected, onSelect }: { selected: RemoteSong | null; onSelect: (song: RemoteSong | null) => void }) {
  const [query, setQuery] = useState(""); const [results, setResults] = useState<RemoteSong[]>([]); const [open, setOpen] = useState(false); const [loading, setLoading] = useState(false); const [active, setActive] = useState(0); const listId = useId();
  useEffect(() => {
    if (selected || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => { try { const response = await fetch(`/api/songs/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }); const body = await response.json() as { results: RemoteSong[] }; setResults(body.results); setOpen(true); setActive(0); } finally { setLoading(false); } }, 190);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, selected]);
  function choose(song: RemoteSong) { onSelect(song); setQuery(`${song.title} — ${song.artistDisplay}`); setOpen(false); }
  return <div className="combobox"><SearchIcon className="search-leading" /><input role="combobox" aria-expanded={open} aria-controls={listId} value={query} placeholder="Search imported songs by title or artist" onChange={(event) => { const value = event.target.value; setQuery(value); if (selected) onSelect(null); if (value.length < 2) { setOpen(false); setLoading(false); } else setLoading(true); }} onKeyDown={(event) => { if (event.key === "ArrowDown") { event.preventDefault(); setActive((value) => Math.min(results.length - 1, value + 1)); } if (event.key === "ArrowUp") { event.preventDefault(); setActive((value) => Math.max(0, value - 1)); } if (event.key === "Enter" && open && results[active]) { event.preventDefault(); choose(results[active]); } if (event.key === "Escape") setOpen(false); }} />{loading && <span className="search-spinner" />}{open && <div className="search-dropdown"><div className="search-caption">IMPORTED SONGS</div><ul id={listId} role="listbox">{results.map((song, index) => <li key={song.id} role="option" aria-selected={active === index} className={active === index ? "active" : ""} onMouseDown={(event) => event.preventDefault()} onMouseEnter={() => setActive(index)} onClick={() => choose(song)}><span className="result-art">♪</span><span><strong>{song.title}</strong><small>{song.artistDisplay} {song.releaseYear ? `· ${song.releaseYear}` : ""}</small></span></li>)}{results.length === 0 && <li className="search-empty">No imported songs found</li>}</ul></div>}</div>;
}

function RemoteResult({ answer, game, clock, onShare }: { answer: RemoteAnswer; game: RemoteGame; clock: string; onShare: () => void }) {
  const won = game.status === "WON";
  return <div className="result-panel"><div className="answer-art imported-art" style={answer.artworkUrl ? { backgroundImage: `url(${answer.artworkUrl})` } : undefined}><span className="vinyl-ring" /><span className="answer-note">♪</span></div><div className="answer-details"><span className="eyebrow">{won ? "YOU FOUND IT" : "TODAY'S TRACK"}</span><h2>{answer.title}</h2><p>{answer.artistDisplay}</p><small>{[answer.album, answer.releaseYear, answer.genre].filter(Boolean).join(" · ")}</small><div className="result-callout">{won ? `You got it in ${game.attempts.length}/6` : "Better luck tomorrow"}</div></div><div className="result-actions"><button className="share-button" onClick={onShare}><ShareIcon /> Share result</button><div className="next-drop"><span>NEW DAILY DROP IN</span><strong>{clock}</strong></div></div><div className="remote-complete"><CheckIcon /> Progress saved securely for this browser</div></div>;
}

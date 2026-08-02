"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getSong } from "@/features/game/catalog";
import {
  createSession,
  EMPTY_STATS,
  evaluateGuess,
  isDuplicate,
  shareText,
  submitAttempt,
  updateStats,
  utcDateKey,
} from "@/features/game/engine";
import { SNIPPET_LENGTHS, type AttemptResult, type GameMode, type GameSession, type PlayerStats, type Song } from "@/features/game/types";
import { SongCombobox } from "./SongCombobox";
import RemoteDailyGame, { type RemoteDailyPayload } from "./RemoteDailyGame";
import { ArrowIcon, CalendarIcon, ChartIcon, CheckIcon, ChevronIcon, CloseIcon, HeadphonesIcon, HelpIcon, MenuIcon, PlayIcon, SearchIcon, ShareIcon, SparkIcon, StopIcon, VolumeIcon } from "./Icons";

const RESULT_LABELS: Record<AttemptResult, string> = {
  SKIPPED: "Skipped",
  WRONG: "Wrong artist & song",
  ARTIST_MATCH: "Right artist, wrong song",
  CORRECT: "Correct!",
};

const SESSION_PREFIX = "echor-session-";
const STATS_KEY = "echor-stats-v1";

function safeRead<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function nextUtcMidnight(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
}

function formatCountdown(target: Date): string {
  const distance = Math.max(0, target.getTime() - Date.now());
  const hours = Math.floor(distance / 3_600_000);
  const minutes = Math.floor((distance % 3_600_000) / 60_000);
  const seconds = Math.floor((distance % 60_000) / 1000);
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function loadStoredSession(fresh: GameSession): GameSession {
  const stored = safeRead<GameSession | null>(`${SESSION_PREFIX}${fresh.puzzleId}`, null);
  return stored?.puzzleId === fresh.puzzleId ? stored : fresh;
}

function resultSymbol(result: AttemptResult): string {
  if (result === "CORRECT") return "✓";
  if (result === "ARTIST_MATCH") return "≈";
  if (result === "WRONG") return "×";
  return "—";
}

export default function SongGame() {
  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState<GameMode>("DAILY");
  const [session, setSession] = useState<GameSession | null>(null);
  const [selected, setSelected] = useState<Song | null>(null);
  const [modal, setModal] = useState<"help" | "stats" | "menu" | null>(null);
  const [toast, setToast] = useState("");
  const [focusSignal, setFocusSignal] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playProgress, setPlayProgress] = useState(0);
  const [volume, setVolume] = useState(0.65);
  const [countdown, setCountdown] = useState("--:--:--");
  const [stats, setStats] = useState<PlayerStats>(EMPTY_STATS);
  const [customSelected, setCustomSelected] = useState<Song | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [remoteDaily, setRemoteDaily] = useState<RemoteDailyPayload | null>(null);
  const [remoteChecked, setRemoteChecked] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const activeNodesRef = useRef<OscillatorNode[]>([]);
  const playTimerRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);
  const remotePuzzleIdRef = useRef<string | null>(null);

  const answer = session ? getSong(session.answerId) : null;
  const duration = session ? SNIPPET_LENGTHS[session.currentAttempt] : 0.1;
  const completed = session ? session.status !== "IN_PROGRESS" : false;

  useEffect(() => {
    queueMicrotask(() => {
      setMounted(true);
      setStats(safeRead(STATS_KEY, EMPTY_STATS));
      const params = new URLSearchParams(window.location.search);
      const challenge = params.get("challenge");
      if (challenge) {
        const custom = safeRead<{ answerId: string; message?: string } | null>(`echor-challenge-${challenge}`, null);
        if (custom) {
          const fresh = createSession("CUSTOM", challenge, custom.answerId, custom.message);
          setMode("CUSTOM");
          setSession(loadStoredSession(fresh));
        } else {
          setToast("This local challenge is not available in this browser.");
          const fresh = createSession("DAILY", utcDateKey());
          setSession(loadStoredSession(fresh));
        }
      } else {
        const fresh = createSession("DAILY", utcDateKey());
        setSession(loadStoredSession(fresh));
      }
      if (!window.localStorage.getItem("echor-seen-help")) {
        setModal("help");
        window.localStorage.setItem("echor-seen-help", "true");
      }
    });
  }, []);

  useEffect(() => {
    let active = true;
    const refreshDaily = async () => {
      try {
        const response = await fetch("/api/puzzles/today", { credentials: "include", cache: "no-store" });
        const payload = response.ok ? await response.json() as RemoteDailyPayload : null;
        if (!active) return;
        if (payload && remotePuzzleIdRef.current && remotePuzzleIdRef.current !== payload.puzzle.id) setToast("The daily song changed — your game has been reset.");
        remotePuzzleIdRef.current = payload?.puzzle.id ?? null;
        setRemoteDaily(payload);
        setRemoteChecked(true);
      } catch { if (active) setRemoteChecked(true); }
    };
    void refreshDaily();
    const timer = window.setInterval(refreshDaily, 5_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  useEffect(() => {
    if (!mounted || !session) return;
    window.localStorage.setItem(`${SESSION_PREFIX}${session.puzzleId}`, JSON.stringify(session));
    if (session.mode === "UNLIMITED") window.localStorage.setItem("echor-active-unlimited", session.puzzleId);
  }, [mounted, session]);

  useEffect(() => {
    const tick = () => setCountdown(formatCountdown(nextUtcMidnight()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const stopAudio = useCallback(() => {
    activeNodesRef.current.forEach((node) => {
      try { node.stop(); } catch { /* node already stopped */ }
    });
    activeNodesRef.current = [];
    if (playTimerRef.current) window.clearTimeout(playTimerRef.current);
    if (animationRef.current) window.cancelAnimationFrame(animationRef.current);
    setPlaying(false);
    setPlayProgress(0);
  }, []);

  useEffect(() => stopAudio, [stopAudio]);

  async function playSnippet() {
    if (!answer) return;
    if (playing) {
      stopAudio();
      return;
    }
    const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) {
      setToast("Audio is not supported in this browser.");
      return;
    }
    const context = audioContextRef.current ?? new AudioContextClass();
    audioContextRef.current = context;
    if (context.state === "suspended") await context.resume();
    const master = context.createGain();
    master.gain.value = volume * 0.22;
    master.connect(context.destination);
    const start = context.currentTime + 0.015;
    const beat = 0.34;
    const count = Math.ceil(duration / beat) + 1;
    const nodes: OscillatorNode[] = [];
    for (let index = 0; index < count; index += 1) {
      const noteStart = start + index * beat;
      const noteEnd = Math.min(start + duration, noteStart + beat * 0.9);
      if (noteStart >= start + duration) break;
      const osc = context.createOscillator();
      const envelope = context.createGain();
      osc.type = index % 3 === 0 ? "triangle" : "sine";
      osc.frequency.value = answer.notes[index % answer.notes.length];
      envelope.gain.setValueAtTime(0.0001, noteStart);
      envelope.gain.exponentialRampToValueAtTime(0.8, Math.min(noteStart + 0.012, noteEnd));
      envelope.gain.exponentialRampToValueAtTime(0.0001, Math.max(noteStart + 0.02, noteEnd));
      osc.connect(envelope);
      envelope.connect(master);
      osc.start(noteStart);
      osc.stop(noteEnd + 0.01);
      nodes.push(osc);
    }
    activeNodesRef.current = nodes;
    setPlaying(true);
    setPlayProgress(0);
    const startedAt = performance.now();
    const animate = () => {
      const elapsed = performance.now() - startedAt;
      setPlayProgress(Math.min(100, (elapsed / (duration * 1000)) * 100));
      if (elapsed < duration * 1000) animationRef.current = window.requestAnimationFrame(animate);
    };
    animationRef.current = window.requestAnimationFrame(animate);
    playTimerRef.current = window.setTimeout(stopAudio, duration * 1000 + 40);
  }

  function announceResult(result: AttemptResult, nextDuration: number) {
    if (result === "CORRECT") setToast(`Correct — solved in ${(session?.attempts.length ?? 0) + 1} attempts!`);
    else if ((session?.attempts.length ?? 0) >= 5) setToast("Round complete. The answer is revealed.");
    else setToast(`${RESULT_LABELS[result]}. ${nextDuration}-second snippet unlocked.`);
  }

  function submitGuess() {
    if (!session || !selected || !answer || completed) return;
    if (isDuplicate(session, selected.id)) {
      setToast("You already guessed that song.");
      return;
    }
    stopAudio();
    const result = evaluateGuess(answer, selected);
    const next = finalizeSession(submitAttempt(session, result, selected.id));
    setSession(next);
    setSelected(null);
    setFocusSignal((value) => value + 1);
    announceResult(result, SNIPPET_LENGTHS[Math.min(next.currentAttempt, 5)]);
  }

  function skipAttempt() {
    if (!session || completed) return;
    if (session.currentAttempt === 5 && !window.confirm("Skip your last attempt and reveal the answer?")) return;
    stopAudio();
    const next = finalizeSession(submitAttempt(session, "SKIPPED"));
    setSession(next);
    setSelected(null);
    setFocusSignal((value) => value + 1);
    announceResult("SKIPPED", SNIPPET_LENGTHS[Math.min(next.currentAttempt, 5)]);
  }

  function finalizeSession(next: GameSession): GameSession {
    if (next.status === "IN_PROGRESS" || next.statsSaved || next.mode !== "DAILY") return next;
    const nextStats = updateStats(stats, next);
    setStats(nextStats);
    window.localStorage.setItem(STATS_KEY, JSON.stringify(nextStats));
    return { ...next, statsSaved: true };
  }

  function switchMode(nextMode: GameMode) {
    stopAudio();
    setSelected(null);
    setMode(nextMode);
    setModal(null);
    if (nextMode === "DAILY") {
      const fresh = createSession("DAILY", utcDateKey());
      setSession(loadStoredSession(fresh));
      window.history.replaceState({}, "", window.location.pathname);
    } else if (nextMode === "UNLIMITED") {
      const activeId = window.localStorage.getItem("echor-active-unlimited");
      const stored = activeId ? safeRead<GameSession | null>(`${SESSION_PREFIX}${activeId}`, null) : null;
      setSession(stored ?? createSession("UNLIMITED", crypto.randomUUID()));
      window.history.replaceState({}, "", window.location.pathname);
    } else {
      setSession(null);
      setCustomSelected(null);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }

  function newUnlimitedRound() {
    stopAudio();
    setSelected(null);
    setSession(createSession("UNLIMITED", crypto.randomUUID()));
  }

  function createChallenge() {
    if (!customSelected) return;
    const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    window.localStorage.setItem(`echor-challenge-${slug}`, JSON.stringify({ answerId: customSelected.id, message: customMessage.trim().slice(0, 80) }));
    const next = createSession("CUSTOM", slug, customSelected.id, customMessage.trim().slice(0, 80));
    setSession(next);
    window.history.replaceState({}, "", `${window.location.pathname}?challenge=${slug}`);
    setToast("Challenge created — share the link with this device demo.");
  }

  async function share() {
    if (!session) return;
    const text = shareText(session);
    const usedNativeShare = "share" in navigator;
    try {
      if (usedNativeShare) await navigator.share({ title: "ECHOR result", text });
      else await navigator.clipboard.writeText(text);
      setToast(usedNativeShare ? "Share sheet opened" : "Results copied");
    } catch (error) {
      if ((error as DOMException).name !== "AbortError") {
        await navigator.clipboard.writeText(text);
        setToast("Results copied");
      }
    }
  }

  const winRate = stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
  const maxDistribution = Math.max(1, ...Object.values(stats.winDistribution));
  const currentAttemptLabel = session ? Math.min(session.attempts.length + 1, 6) : 1;
  const dateLabel = useMemo(() => new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(new Date(`${utcDateKey()}T12:00:00Z`)), []);

  if (!mounted) return <div className="loading-screen"><span className="brand-mark">E</span><p>Tuning today&apos;s track…</p></div>;

  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="icon-button" onClick={() => setModal("menu")} aria-label="Open menu"><MenuIcon /></button>
        <button className="wordmark" onClick={() => switchMode("DAILY")} aria-label="ECHOR home"><span className="wordmark-dot" />ECHOR</button>
        <div className="header-actions">
          <button className="icon-button" onClick={() => setModal("stats")} aria-label="View statistics"><ChartIcon /></button>
          <button className="icon-button" onClick={() => setModal("help")} aria-label="How to play"><HelpIcon /></button>
        </div>
      </header>

      <nav className="mode-tabs" aria-label="Game mode">
        {(["DAILY", "UNLIMITED", "CUSTOM"] as GameMode[]).map((item) => (
          <button key={item} className={mode === item ? "active" : ""} onClick={() => switchMode(item)}>{item === "DAILY" ? "Daily drop" : item.toLowerCase()}</button>
        ))}
      </nav>

      {mode === "DAILY" && !remoteChecked ? (
        <div className="loading-inline"><span className="brand-mark">E</span><p>Checking today&apos;s schedule…</p></div>
      ) : mode === "DAILY" && remoteDaily ? (
        <RemoteDailyGame key={remoteDaily.puzzle.id} initial={remoteDaily} onToast={setToast} />
      ) : mode === "CUSTOM" && !session ? (
        <main className="custom-page">
          <section className="custom-intro">
            <span className="eyebrow"><SparkIcon /> CUSTOM CHALLENGE</span>
            <h1>Pick the hook.<br />Stump a friend.</h1>
            <p>Choose any original track in the ECHOR demo catalog and create a private challenge for this browser.</p>
          </section>
          <section className="custom-card">
            <div className="step-badge">01</div>
            <h2>Choose a mystery track</h2>
            <p className="muted">Your selection stays hidden while the challenge is played.</p>
            <SongCombobox selected={customSelected} onSelect={setCustomSelected} placeholder="Search the demo catalog" />
            <label className="message-label">Add a message <span>optional</span>
              <input maxLength={80} value={customMessage} onChange={(event) => setCustomMessage(event.target.value)} placeholder="Think you know my taste?" />
            </label>
            <button className="primary-wide" disabled={!customSelected} onClick={createChallenge}>Create challenge <ArrowIcon /></button>
            <p className="local-note">Challenges are stored locally in this no-account demo.</p>
          </section>
        </main>
      ) : session && answer ? (
        <main className="game-page">
          <section className="puzzle-heading">
            <div>
              <span className="eyebrow">{mode === "DAILY" ? "TODAY'S MYSTERY TRACK" : mode === "UNLIMITED" ? "ENDLESS MIX" : "A FRIEND SENT THIS"}</span>
              <h1>{mode === "DAILY" ? "Name that song." : mode === "UNLIMITED" ? "Keep the needle moving." : "Can you name their pick?"}</h1>
              {session.customMessage && <p className="custom-message">“{session.customMessage}”</p>}
            </div>
            <div className="puzzle-meta"><span>#{session.puzzleNumber}</span><span className="meta-divider" /><span><CalendarIcon /> {mode === "DAILY" ? dateLabel : "Fresh round"}</span></div>
          </section>

          <section className="game-card" aria-label="Song guessing game">
            <div className="attempt-header"><span>YOUR GUESSES</span><span>{completed ? "ROUND COMPLETE" : `ATTEMPT ${currentAttemptLabel} OF 6`}</span></div>
            <div className="attempt-list">
              {Array.from({ length: 6 }, (_, index) => {
                const attempt = session.attempts[index];
                const song = attempt?.songId ? getSong(attempt.songId) : null;
                const current = !completed && index === session.attempts.length;
                return (
                  <div key={index} className={`attempt-row ${attempt ? `result-${attempt.result.toLowerCase()}` : current ? "current" : "future"}`}>
                    <span className="attempt-number">{String(index + 1).padStart(2, "0")}</span>
                    {attempt ? <>
                      <span className="result-symbol" aria-hidden="true">{resultSymbol(attempt.result)}</span>
                      <span className="attempt-copy"><strong>{song?.title ?? "Skipped"}</strong><small>{song?.artist ?? "No guess submitted"}</small></span>
                      <span className="attempt-result-label">{RESULT_LABELS[attempt.result]}</span>
                    </> : <span className="empty-copy">{current ? "Listening now…" : "Locked"}</span>}
                  </div>
                );
              })}
            </div>

            <div className="timeline-block">
              <div className="timeline-labels"><span>SNIPPET LENGTH</span><strong>{duration < 1 ? duration.toFixed(1) : duration.toFixed(0)} <small>SEC</small></strong></div>
              <div className="timeline" aria-label={`${duration} second snippet unlocked`}>
                {SNIPPET_LENGTHS.map((value, index) => {
                  const attempt = session.attempts[index];
                  const state = attempt ? `segment-${attempt.result.toLowerCase()}` : index === session.currentAttempt ? "segment-current" : index < session.currentAttempt ? "segment-past" : "segment-future";
                  return <div key={value} className={`timeline-segment ${state}`}><span>{value}s</span></div>;
                })}
                <div className="timeline-playhead" style={{ width: playing ? `${playProgress * (1 / 6)}%` : "0%", left: `${session.currentAttempt * (100 / 6)}%` }} />
              </div>
            </div>

            <div className="player-area">
              <button className={`play-button ${playing ? "playing" : ""}`} onClick={playSnippet} aria-label={playing ? "Stop snippet" : `Play ${duration} second snippet`}>
                {playing ? <StopIcon /> : <PlayIcon />}
              </button>
              <div className="player-copy"><strong>{playing ? "Listening…" : completed ? "Replay the final clip" : "Tap to hear the clue"}</strong><span>{playing ? `${duration} second snippet` : "Replay as many times as you like"}</span></div>
              <label className="volume-control"><VolumeIcon /><span className="sr-only">Volume</span><input type="range" min="0" max="1" step="0.05" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /></label>
            </div>

            {!completed ? (
              <div className="guess-zone">
                <SongCombobox key={session.puzzleId} selected={selected} onSelect={setSelected} autoFocusSignal={focusSignal} />
                <div className="guess-actions">
                  <button className="skip-button" onClick={skipAttempt}>Skip <span>+ unlock more</span></button>
                  <button className="submit-button" disabled={!selected} onClick={submitGuess}>Submit guess <ArrowIcon /></button>
                </div>
              </div>
            ) : (
              <ResultPanel session={session} answer={answer} stats={stats} countdown={countdown} onShare={share} onNewRound={mode === "UNLIMITED" ? newUnlimitedRound : undefined} />
            )}
          </section>

          <p className="audio-disclaimer"><HeadphonesIcon /> Best with headphones · Original demo melodies, safe to play</p>
        </main>
      ) : null}

      <footer><span>ECHOR — A DAILY LISTENING GAME</span><span>Original demo music · Built for curious ears</span></footer>

      {modal === "help" && <HelpModal onClose={() => setModal(null)} />}
      {modal === "stats" && <StatsModal stats={stats} maxDistribution={maxDistribution} winRate={winRate} countdown={countdown} onClose={() => setModal(null)} />}
      {modal === "menu" && <MenuModal mode={mode} onChoose={switchMode} onClose={() => setModal(null)} />}
      {toast && <div className="toast" role="status"><CheckIcon /> {toast}</div>}
      <div className="aria-announcer sr-only" aria-live="polite">{toast}</div>
    </div>
  );
}

function ResultPanel({ session, answer, stats, countdown, onShare, onNewRound }: { session: GameSession; answer: Song; stats: PlayerStats; countdown: string; onShare: () => void; onNewRound?: () => void }) {
  const won = session.status === "WON";
  return (
    <div className="result-panel">
      <div className="answer-art" style={{ background: `linear-gradient(145deg, ${answer.colors[0]}, ${answer.colors[1]})` }}>
        <span className="vinyl-ring" /><span className="answer-note">♪</span>
      </div>
      <div className="answer-details">
        <span className="eyebrow">{won ? "YOU FOUND IT" : "TODAY'S TRACK"}</span>
        <h2>{answer.title}</h2>
        <p>{answer.artist}</p>
        <small>{answer.album} · {answer.year} · {answer.genre}</small>
        <div className="result-callout">{won ? `You got it in ${session.attempts.length}/6` : "Better luck on the next one"}</div>
      </div>
      <div className="result-actions">
        <button className="share-button" onClick={onShare}><ShareIcon /> Share result</button>
        {onNewRound ? <button className="outline-button" onClick={onNewRound}>Next track <ArrowIcon /></button> : <div className="next-drop"><span>NEW DAILY DROP IN</span><strong>{countdown}</strong></div>}
      </div>
      <div className="mini-stats"><span><strong>{stats.gamesPlayed}</strong>played</span><span><strong>{stats.gamesWon}</strong>won</span><span><strong>{stats.currentStreak}</strong>streak</span></div>
    </div>
  );
}

function ModalShell({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const handle = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    document.addEventListener("keydown", handle);
    return () => document.removeEventListener("keydown", handle);
  }, [onClose]);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className={`modal ${wide ? "modal-wide" : ""}`} role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-top"><span className="modal-kicker">ECHOR</span><button className="icon-button" onClick={onClose} aria-label="Close dialog"><CloseIcon /></button></div><h2 id="modal-title">{title}</h2>{children}</section></div>;
}

function HelpModal({ onClose }: { onClose: () => void }) {
  return <ModalShell title="Hear it. Name it." onClose={onClose} wide>
    <p className="modal-lead">Identify the mystery track in six tries. Every miss gives you a little more music.</p>
    <div className="help-steps">
      <div><span className="help-icon"><PlayIcon /></span><strong>Listen closely</strong><p>Start with a blink-and-you&apos;ll-miss-it 0.1 second clue.</p></div>
      <div><span className="help-icon"><SearchIcon /></span><strong>Search &amp; select</strong><p>Find a track by title or artist, then lock in your guess.</p></div>
      <div><span className="help-icon"><SparkIcon /></span><strong>Unlock more</strong><p>Wrong guesses and skips reveal progressively longer snippets.</p></div>
    </div>
    <div className="legend"><div><i className="dot wrong" />Wrong song &amp; artist</div><div><i className="dot artist" />Right artist, wrong song</div><div><i className="dot correct" />Correct song</div><div><i className="dot skipped" />Skipped</div></div>
    <button className="primary-wide" onClick={onClose}>Start listening <HeadphonesIcon /></button>
  </ModalShell>;
}

function StatsModal({ stats, maxDistribution, winRate, countdown, onClose }: { stats: PlayerStats; maxDistribution: number; winRate: number; countdown: string; onClose: () => void }) {
  return <ModalShell title="Your listening stats" onClose={onClose}>
    <div className="stats-overview"><span><strong>{stats.gamesPlayed}</strong>Played</span><span><strong>{winRate}%</strong>Win rate</span><span><strong>{stats.currentStreak}</strong>Current streak</span><span><strong>{stats.maxStreak}</strong>Best streak</span></div>
    <h3 className="distribution-title">GUESS DISTRIBUTION</h3>
    <div className="distribution">{[1, 2, 3, 4, 5, 6].map((guess) => { const value = stats.winDistribution[String(guess)] ?? 0; return <div key={guess}><span>{guess}</span><div className="bar-track"><i style={{ width: `${Math.max(value ? 12 : 3, (value / maxDistribution) * 100)}%` }}>{value || ""}</i></div></div>; })}</div>
    <div className="stats-next"><span>NEXT DAILY DROP</span><strong>{countdown}</strong></div>
  </ModalShell>;
}

function MenuModal({ mode, onChoose, onClose }: { mode: GameMode; onChoose: (mode: GameMode) => void; onClose: () => void }) {
  return <ModalShell title="Choose your mix" onClose={onClose}>
    <div className="menu-list">
      <button className={mode === "DAILY" ? "active" : ""} onClick={() => onChoose("DAILY")}><CalendarIcon /><span><strong>Daily drop</strong><small>One shared song every day</small></span><ChevronIcon /></button>
      <button className={mode === "UNLIMITED" ? "active" : ""} onClick={() => onChoose("UNLIMITED")}><HeadphonesIcon /><span><strong>Unlimited</strong><small>Keep playing without limits</small></span><ChevronIcon /></button>
      <button className={mode === "CUSTOM" ? "active" : ""} onClick={() => onChoose("CUSTOM")}><SparkIcon /><span><strong>Custom challenge</strong><small>Choose a song for a friend</small></span><ChevronIcon /></button>
    </div>
    <Link className="admin-menu-link" href="/admin/music">Open admin music library <ArrowIcon /></Link>
    <p className="menu-footnote">This recreation uses fictional titles and browser-synthesized original melodies. No copyrighted recordings are included.</p>
  </ModalShell>;
}

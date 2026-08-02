"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowIcon, CheckIcon, CloseIcon, HeadphonesIcon, SearchIcon, SparkIcon } from "./Icons";

type AdminTab = "search" | "library" | "queue" | "scheduler" | "rights";
type ApiSong = { id: string; provider?: string; providerSongId?: string; provider_song_id?: string; title: string; artist: string; album?: string | null; genre?: string | null; duration: number; license: string; licenseUrl?: string; license_url?: string; artworkUrl?: string; artwork_url?: string; previewUrl?: string; downloadAllowed?: boolean; status?: string; failure_reason?: string | null; licenseDecision?: { allowed: boolean; reason: string } };
type Job = { id: string; song_id: string; title: string; artist: string; status: string; stage: string; progress: number; attempts: number; failure_reason?: string | null; updated_at: string };
type Puzzle = { id: string; date_key: string; puzzle_number: number; title: string; artist: string; status: string };

const TABS: { id: AdminTab; label: string }[] = [
  { id: "search", label: "Search providers" }, { id: "library", label: "Imported songs" }, { id: "queue", label: "Processing queue" }, { id: "scheduler", label: "Daily scheduler" }, { id: "rights", label: "Rights & licenses" },
];

function durationLabel(seconds: number) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }

async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const body = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(body.error || `Request failed with HTTP ${response.status}.`);
  return body;
}

export default function AdminMusicLibrary() {
  const [tab, setTab] = useState<AdminTab>("search");
  const [results, setResults] = useState<ApiSong[]>([]);
  const [songs, setSongs] = useState<ApiSong[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [puzzles, setPuzzles] = useState<Puzzle[]>([]);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [genre, setGenre] = useState("");
  const [artist, setArtist] = useState("");
  const [minimumLength, setMinimumLength] = useState(60);
  const [limit, setLimit] = useState(25);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkMaximum, setBulkMaximum] = useState(25);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleSong, setScheduleSong] = useState("");

  const loadAdminData = useCallback(async () => {
    try {
      const [library, queue, schedule] = await Promise.all([
        api<{ songs: ApiSong[] }>("/api/admin/music/library"),
        api<{ jobs: Job[] }>("/api/admin/music/jobs"),
        api<{ puzzles: Puzzle[] }>("/api/admin/music/schedule"),
      ]);
      setSongs(library.songs);
      setJobs(queue.jobs);
      setPuzzles(schedule.puzzles);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load the music library."); }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadAdminData(), 0);
    return () => window.clearTimeout(timer);
  }, [loadAdminData]);

  useEffect(() => {
    if (processing || !jobs.some((job) => job.status === "QUEUED")) return;
    const timer = window.setTimeout(async () => {
      setProcessing(true);
      try { await api("/api/admin/music/process", { method: "POST" }); }
      catch (caught) { setError(caught instanceof Error ? caught.message : "Queue processing failed."); }
      finally { setProcessing(false); await loadAdminData(); }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [jobs, processing, loadAdminData]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ provider: "jamendo", q: query, genre, artist, minimumLength: String(minimumLength), limit: String(limit) });
      const response = await api<{ results: ApiSong[] }>(`/api/admin/music/search?${params}`);
      setResults(response.results);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Provider search failed."); }
    finally { setLoading(false); }
  }

  async function importSong(song: ApiSong) {
    setError("");
    try {
      const result = await api<{ duplicate: boolean }>("/api/admin/music/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: song.provider, providerSongId: song.providerSongId }) });
      setNotice(result.duplicate ? "Already in your library — skipped duplicate." : `${song.title} was added to the processing queue.`);
      await loadAdminData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Import failed."); }
  }

  async function bulkImport() {
    setLoading(true); setError("");
    try {
      const result = await api<{ queued: number; duplicates: number; rejected: number }>("/api/admin/music/bulk", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: "jamendo", genre, maximumSongs: bulkMaximum, minimumLength }) });
      setNotice(`${result.queued} queued · ${result.duplicates} duplicates · ${result.rejected} license rejects`);
      setBulkOpen(false); setTab("queue"); await loadAdminData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Bulk import failed."); }
    finally { setLoading(false); }
  }

  async function retry(jobId: string) {
    try { await api(`/api/admin/music/jobs/${jobId}/retry`, { method: "POST" }); setNotice("Import requeued."); await loadAdminData(); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Retry failed."); }
  }

  async function schedule(event: React.FormEvent) {
    event.preventDefault();
    const replacing = puzzles.some((puzzle) => puzzle.date_key === scheduleDate);
    if (replacing && !window.confirm("Replace this date's daily song? Every player's progress for that puzzle will be permanently reset.")) return;
    try {
      const result = await api<{ replaced: boolean; resetSessions: number }>("/api/admin/music/schedule", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ dateKey: scheduleDate, songId: scheduleSong }) });
      setNotice(result.replaced ? `Daily song replaced. ${result.resetSessions} player session${result.resetSessions === 1 ? "" : "s"} reset.` : "Daily puzzle scheduled."); setScheduleDate(""); setScheduleSong(""); await loadAdminData();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Scheduling failed."); }
  }

  const readySongs = useMemo(() => songs.filter((song) => song.status === "READY"), [songs]);
  const stats = useMemo(() => ({ ready: readySongs.length, processing: songs.filter((song) => ["PENDING", "PROCESSING"].includes(song.status ?? "")).length, failed: songs.filter((song) => song.status === "FAILED").length }), [songs, readySongs]);

  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand"><span className="wordmark-dot" />ECHOR <small>ADMIN</small></Link>
      <div className="admin-section-label">MUSIC LIBRARY</div>
      <nav>{TABS.map((item, index) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span>{String(index + 1).padStart(2, "0")}</span>{item.label}</button>)}</nav>
      <div className="provider-health"><i /><span><strong>Jamendo</strong><small>Provider adapter</small></span></div>
      <Link href="/" className="back-to-game">← Back to game</Link>
    </aside>
    <main className="admin-main">
      <header className="admin-header"><div><span className="eyebrow">ADMIN / MUSIC LIBRARY</span><h1>{TABS.find((item) => item.id === tab)?.label}</h1></div><div className="library-stats"><span><strong>{stats.ready}</strong>Ready</span><span><strong>{stats.processing}</strong>Processing</span><span><strong>{stats.failed}</strong>Failed</span></div></header>
      {error && <div className="admin-alert error"><CloseIcon /><span>{error}</span><button onClick={() => setError("")}>Dismiss</button></div>}
      {notice && <div className="admin-alert success"><CheckIcon /><span>{notice}</span></div>}

      {tab === "search" && <>
        <form className="provider-search" onSubmit={search}>
          <div className="form-heading"><div><h2>Search Jamendo</h2><p>Only tracks passing the active rights policy can be imported.</p></div><button type="button" className="secondary-admin" onClick={() => setBulkOpen(true)}><SparkIcon /> Bulk import</button></div>
          <div className="admin-form-grid"><label className="span-2">Keyword<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="rock, cinematic, summer…" /></label><label>Genre<input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Electronic" /></label><label>Artist<input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Optional" /></label><label>Minimum length<input type="number" min="16" max="3600" value={minimumLength} onChange={(e) => setMinimumLength(Number(e.target.value))} /><small>seconds</small></label><label>Maximum results<select value={limit} onChange={(e) => setLimit(Number(e.target.value))}><option>10</option><option>25</option><option>50</option><option>100</option></select></label></div>
          <button className="admin-primary" disabled={loading}>{loading ? "Searching…" : <><SearchIcon /> Search provider</>}</button>
        </form>
        <section className="admin-content"><div className="content-title"><h2>Provider results</h2><span>{results.length} tracks</span></div><div className="provider-results">{results.length === 0 ? <EmptyState icon={<SearchIcon />} title="Search the provider catalog" copy="Use the filters above to find legally reviewable music without leaving ECHOR." /> : results.map((song) => <article key={song.providerSongId} className="provider-track"><div className="track-art" style={{ backgroundImage: song.artworkUrl ? `url(${song.artworkUrl})` : undefined }}>♪</div><div className="track-main"><strong>{song.title}</strong><span>{song.artist} {song.album ? `· ${song.album}` : ""}</span><small>{song.genre || "Uncategorized"} · {durationLabel(song.duration)}</small></div><div className="license-chip" data-allowed={song.licenseDecision?.allowed}>{song.license}</div>{song.previewUrl && <audio controls preload="none" src={song.previewUrl} aria-label={`Preview ${song.title}`} />}<button className="import-button" disabled={!song.licenseDecision?.allowed} title={song.licenseDecision?.reason} onClick={() => importSong(song)}>{song.licenseDecision?.allowed ? "Import" : "Rejected"}<ArrowIcon /></button></article>)}</div></section>
      </>}

      {tab === "library" && <section className="admin-content panel"><div className="content-title"><div><h2>Imported songs</h2><p>Opaque storage paths, processing state, and gameplay readiness.</p></div><button className="secondary-admin" onClick={loadAdminData}>Refresh</button></div><div className="admin-table"><div className="table-row table-head"><span>Track</span><span>Provider</span><span>License</span><span>Duration</span><span>Status</span></div>{songs.map((song) => <div className="table-row" key={song.id}><span><strong>{song.title}</strong><small>{song.artist}</small></span><span>{song.provider}<small>#{song.provider_song_id}</small></span><a href={song.license_url ?? "#"} target="_blank" rel="noreferrer">{song.license}</a><span>{durationLabel(song.duration)}</span><i className={`status-pill ${song.status?.toLowerCase()}`}>{song.status}</i></div>)}{songs.length === 0 && <EmptyState icon={<HeadphonesIcon />} title="No imported songs yet" copy="Search Jamendo or start a bulk import to build the library." />}</div></section>}

      {tab === "queue" && <section className="admin-content panel"><div className="content-title"><div><h2>Processing queue</h2><p>The queue persists in D1; this dashboard dispatches queued jobs to the FFmpeg worker.</p></div><span className={processing ? "queue-live active" : "queue-live"}><i />{processing ? "Worker active" : "Queue idle"}</span></div><div className="queue-list">{jobs.map((job) => <article key={job.id} className="queue-job"><div className={`queue-status ${job.status.toLowerCase()}`}>{job.status === "COMPLETED" ? <CheckIcon /> : job.status === "FAILED" ? <CloseIcon /> : <span className="search-spinner" />}</div><div className="queue-copy"><strong>{job.title}</strong><span>{job.artist} · attempt {job.attempts}</span><div className="progress-track"><i style={{ width: `${job.progress}%` }} /></div></div><div className="queue-stage"><strong>{job.stage.replaceAll("_", " ")}</strong><span>{job.progress}%</span></div>{job.status === "FAILED" && <button onClick={() => retry(job.id)}>Retry</button>}</article>)}{jobs.length === 0 && <EmptyState icon={<SparkIcon />} title="The queue is clear" copy="New imports will appear here with live processing stages." />}</div></section>}

      {tab === "scheduler" && <><section className="schedule-form panel"><div><span className="eyebrow">READY-ONLY GUARD</span><h2>Schedule or replace a daily puzzle</h2><p>Dates use UTC. Choosing an existing date replaces its song and resets every player for that puzzle.</p></div><form onSubmit={schedule}><label>Date<input type="date" required value={scheduleDate} onChange={(e) => setScheduleDate(e.target.value)} /></label><label>Ready song<select required value={scheduleSong} onChange={(e) => setScheduleSong(e.target.value)}><option value="">Choose a track</option>{readySongs.map((song) => <option key={song.id} value={song.id}>{song.title} — {song.artist}</option>)}</select></label><button className="admin-primary" disabled={!scheduleDate || !scheduleSong}>{puzzles.some((puzzle) => puzzle.date_key === scheduleDate) ? "Replace & reset" : "Schedule"} <ArrowIcon /></button></form></section><section className="admin-content panel"><div className="content-title"><h2>Scheduled puzzles</h2><span>{puzzles.length} dates</span></div><div className="schedule-list">{puzzles.map((puzzle) => <div key={puzzle.id}><time>{puzzle.date_key}</time><span><strong>{puzzle.title}</strong><small>{puzzle.artist}</small></span><b>#{puzzle.puzzle_number}</b><i className="status-pill ready">{puzzle.status}</i></div>)}{puzzles.length === 0 && <EmptyState icon={<SparkIcon />} title="Nothing scheduled" copy="Choose a READY song and a date above." />}</div></section></>}

      {tab === "rights" && <section className="admin-content panel"><div className="content-title"><div><h2>Rights & licenses</h2><p>Every imported track retains its provider license record and source response.</p></div><span>{songs.length} records</span></div><div className="rights-policy"><span className="policy-icon">✓</span><div><strong>Conservative import policy active</strong><p>Download permission is required. CC0 and attribution-only Creative Commons URLs are allowed by default; NC, ND, unknown, and missing licenses are rejected before download.</p></div></div><div className="rights-grid">{songs.map((song) => <article key={song.id}><div><strong>{song.title}</strong><span>{song.artist}</span></div><span className="license-chip" data-allowed="true">{song.license}</span><a href={song.license_url ?? "#"} target="_blank" rel="noreferrer">View license ↗</a><small>{song.provider} / {song.provider_song_id}</small></article>)}{songs.length === 0 && <EmptyState icon={<CheckIcon />} title="No rights records yet" copy="A rights record is created automatically with each import." />}</div></section>}
    </main>
    {bulkOpen && <div className="modal-backdrop"><section className="modal bulk-modal" role="dialog" aria-modal="true"><div className="modal-top"><span className="modal-kicker">BULK IMPORT</span><button className="icon-button" onClick={() => setBulkOpen(false)}><CloseIcon /></button></div><h2>Build a collection</h2><p className="modal-lead">Search Jamendo and queue every track that passes the active license policy. Duplicates are skipped automatically.</p><label>Genre<input value={genre} onChange={(e) => setGenre(e.target.value)} placeholder="Electronic" /></label><label>Maximum songs<input type="number" min="1" max="100" value={bulkMaximum} onChange={(e) => setBulkMaximum(Number(e.target.value))} /></label><label>Minimum length (seconds)<input type="number" min="16" value={minimumLength} onChange={(e) => setMinimumLength(Number(e.target.value))} /></label><button className="primary-wide" onClick={bulkImport} disabled={loading}>{loading ? "Preparing…" : "Start bulk import"}<ArrowIcon /></button></section></div>}
  </div>;
}

function EmptyState({ icon, title, copy }: { icon: React.ReactNode; title: string; copy: string }) {
  return <div className="empty-state"><span>{icon}</span><strong>{title}</strong><p>{copy}</p></div>;
}

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const port = Number(process.env.PORT || 8788);
const token = process.env.AUDIO_PROCESSOR_TOKEN;
const MAX_SOURCE_BYTES = 250 * 1024 * 1024;

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(body) });
  response.end(body);
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => { stderr = `${stderr}${chunk}`.slice(-8000); });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve() : reject(new Error(`${command} failed (${code}): ${stderr}`)));
  });
}

async function probeDuration(path) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", path]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => code === 0 ? resolve(Number(stdout.trim())) : reject(new Error(`ffprobe failed: ${stderr}`)));
  });
}

async function readBody(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1_000_000) throw new Error("Request body is too large.");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function processAudio(payload) {
  const { sourceUrl, clipStartSeconds = 0, durations, bitrate = "192k", fadeOutMilliseconds = 5 } = payload;
  if (!/^https:\/\//.test(sourceUrl || "")) throw new Error("sourceUrl must use HTTPS.");
  if (!Array.isArray(durations) || durations.length !== 6 || durations.some((value) => !Number.isFinite(value) || value <= 0 || value > 30)) throw new Error("Exactly six valid durations are required.");
  if (!Number.isFinite(clipStartSeconds) || clipStartSeconds < 0) throw new Error("clipStartSeconds must be non-negative.");

  const workingDirectory = await mkdtemp(join(tmpdir(), "music-import-"));
  const sourcePath = join(workingDirectory, "source-audio");
  try {
    const source = await fetch(sourceUrl, { redirect: "follow", signal: AbortSignal.timeout(90_000) });
    if (!source.ok || !source.body) throw new Error(`Source download returned HTTP ${source.status}.`);
    const declaredLength = Number(source.headers.get("content-length") || 0);
    if (declaredLength > MAX_SOURCE_BYTES) throw new Error("Source audio exceeds the 250 MB limit.");
    await pipeline(Readable.fromWeb(source.body), createWriteStream(sourcePath));
    if ((await stat(sourcePath)).size > MAX_SOURCE_BYTES) throw new Error("Source audio exceeds the 250 MB limit.");

    const clips = [];
    for (let index = 0; index < durations.length; index += 1) {
      const duration = Number(durations[index]);
      const outputPath = join(workingDirectory, `clip-${index + 1}.m4a`);
      const fadeSeconds = Math.min(fadeOutMilliseconds / 1000, duration / 4);
      const fadeStart = Math.max(0, duration - fadeSeconds);
      const audioFilter = `loudnorm=I=-16:TP=-1.5:LRA=11,afade=t=out:st=${fadeStart.toFixed(3)}:d=${fadeSeconds.toFixed(3)}`;
      await run("ffmpeg", [
        "-nostdin", "-hide_banner", "-loglevel", "error", "-y",
        "-ss", String(clipStartSeconds), "-i", sourcePath, "-t", String(duration),
        "-map", "0:a:0", "-map_metadata", "-1", "-map_chapters", "-1", "-vn",
        "-af", audioFilter, "-c:a", "aac", "-b:a", bitrate, "-ar", "44100", "-ac", "2",
        "-movflags", "+faststart", outputPath,
      ]);
      const measured = await probeDuration(outputPath);
      if (!Number.isFinite(measured) || Math.abs(measured - duration) > 0.08) throw new Error(`Clip ${index + 1} duration ${measured}s failed validation.`);
      clips.push({ index: index + 1, durationSeconds: duration, contentType: "audio/mp4", dataBase64: (await readFile(outputPath)).toString("base64") });
    }
    return { clips };
  } finally {
    await rm(workingDirectory, { recursive: true, force: true });
  }
}

if (!token) {
  console.error("AUDIO_PROCESSOR_TOKEN is required.");
  process.exit(1);
}

createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") return json(response, 200, { ok: true, ffmpeg: true });
  if (request.method !== "POST" || request.url !== "/process") return json(response, 404, { error: "Not found." });
  if (request.headers.authorization !== `Bearer ${token}`) return json(response, 401, { error: "Unauthorized." });
  try {
    json(response, 200, await processAudio(await readBody(request)));
  } catch (error) {
    json(response, 422, { error: error instanceof Error ? error.message : "Audio processing failed." });
  }
}).listen(port, "127.0.0.1", () => console.log(`Audio processor listening on http://127.0.0.1:${port}`));


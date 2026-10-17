"use client";

import { useEffect, useRef, useState } from "react";
import { encodeVideo, renderFinalPoster, renderVideoFrame, timeline, VIDEO_DURATIONS, type EncodeResult, type VideoInput } from "@/lib/poster/video";
import { posterSize } from "@/lib/poster/render";

export type VideoLabels = {
  duration: string;
  seconds: string;
  play: string;
  pause: string;
  generate: string;
  generating: string;
  download: string;
  save: string;
  saving: string;
  saved: string;
  outdated: string;
  webmNote: string;
  scenes: string;
  cancel: string;
  savedVideo: string;
};

type Props = {
  input: VideoInput | null;
  ready: boolean;
  labels: VideoLabels;
  savedVideoUrl: string | null;
  fileSlug: string;
  onSave: (blob: Blob, ext: string) => Promise<boolean>;
};

/** Aperçu animé + génération MP4 de la vidéo publicitaire, entièrement dans le navigateur. */
export default function VideoPanel({ input, ready, labels: L, savedVideoUrl, fileSlug, onSave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const posterRef = useRef<HTMLCanvasElement | null>(null);
  const inputRef = useRef<VideoInput | null>(input);
  const [duration, setDuration] = useState<number>(10);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState<number | null>(null);
  const [result, setResult] = useState<(EncodeResult & { url: string; forKey: string }) | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedNow, setSavedNow] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Signature du contenu : si elle change, la vidéo générée n'est plus à jour.
  const inputKey = input
    ? JSON.stringify({ ...input, photos: input.photos.length, logo: !!input.logo, photo: !!input.photo, duration })
    : "";

  useEffect(() => {
    inputRef.current = input;
    posterRef.current = input && ready ? renderFinalPoster(input) : null;
  }, [input, ready]);

  // Lecture en boucle de l'aperçu
  useEffect(() => {
    if (!ready || !playing) return;
    let raf = 0;
    const start = performance.now();
    const loop = (now: number) => {
      const inp = inputRef.current;
      if (inp && posterRef.current && canvasRef.current) {
        const t = (Math.max(0, now - start) / 1000) % duration;
        renderVideoFrame(canvasRef.current, inp, posterRef.current, t, duration);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [ready, playing, duration]);

  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  async function generate() {
    if (!input) return;
    setError("");
    setSavedNow(false);
    setProgress(0);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    try {
      const r = await encodeVideo(input, duration, setProgress, ctrl.signal);
      setResult((old) => {
        if (old) URL.revokeObjectURL(old.url);
        return { ...r, url: URL.createObjectURL(r.blob), forKey: inputKey };
      });
    } catch (e) {
      setError((e as Error).message || "La génération a échoué.");
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  }

  function download() {
    if (!result) return;
    const a = document.createElement("a");
    a.href = result.url;
    a.download = `${fileSlug}-${duration}s.${result.ext}`;
    a.click();
  }

  async function save() {
    if (!result) return;
    setSaving(true);
    const ok = await onSave(result.blob, result.ext);
    setSaving(false);
    setSavedNow(ok);
  }

  const size = input ? posterSize(input.format) : posterSize("square");
  const tl = timeline(duration);
  const outdated = result && result.forKey !== inputKey;

  return (
    <div className="space-y-4">
      <div className="mx-auto rounded-2xl bg-slate-900 p-3" style={{ maxWidth: input?.format === "story" ? 400 : 600 }}>
        <canvas ref={canvasRef} width={size.width} height={size.height} aria-label="Aperçu de la vidéo" className="block h-auto w-full rounded-lg bg-black" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
        <button onClick={() => setPlaying((p) => !p)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50">
          {playing ? `❚❚ ${L.pause}` : `▶ ${L.play}`}
        </button>
        <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5">
          <span className="text-slate-600">{L.duration}</span>
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="bg-transparent font-semibold" disabled={progress !== null}>
            {VIDEO_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} {L.seconds}
              </option>
            ))}
          </select>
        </label>
        {progress === null ? (
          <button onClick={generate} disabled={!ready || !input} className="rounded-lg bg-rose-600 px-4 py-2 font-semibold text-white hover:bg-rose-700 disabled:opacity-50">
            🎬 {L.generate}
          </button>
        ) : (
          <button onClick={() => abortRef.current?.abort()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 font-semibold">
            {L.cancel}
          </button>
        )}
      </div>

      <p className="text-center text-xs text-slate-500">
        {L.scenes
          .replace("{a}", String(tl.s1))
          .replace("{b}", String(tl.s2 - tl.s1))
          .replace("{c}", String(tl.end - tl.s2))}
      </p>

      {progress !== null && (
        <div className="mx-auto max-w-sm" role="status">
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full bg-rose-600 transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <p className="mt-1 text-center text-xs text-slate-600">
            {L.generating} {Math.round(progress * 100)} %
          </p>
        </div>
      )}
      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {result && (
        <div className="space-y-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
          <video src={result.url} controls playsInline className="mx-auto block max-h-[60vh] rounded-lg" />
          <p className="text-center text-xs text-slate-500">
            {result.ext.toUpperCase()} · {(result.blob.size / 1024 / 1024).toFixed(1)} Mo · {result.codec === "avc" ? "H.264" : result.codec.toUpperCase()}
          </p>
          {result.ext === "webm" && <p className="text-center text-xs text-amber-700">{L.webmNote}</p>}
          {outdated && <p className="text-center text-xs text-amber-700">{L.outdated}</p>}
          <div className="flex flex-wrap justify-center gap-2">
            <button onClick={download} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800">
              ⬇ {L.download}
            </button>
            <button onClick={save} disabled={saving} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50 disabled:opacity-50">
              {saving ? L.saving : L.save}
            </button>
          </div>
          {savedNow && <p className="text-center text-xs text-emerald-700">✓ {L.saved}</p>}
        </div>
      )}

      {savedVideoUrl && !result && (
        <p className="text-center text-sm">
          <a href={savedVideoUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
            ▶ {L.savedVideo}
          </a>
        </p>
      )}
    </div>
  );
}

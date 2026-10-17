// Vidéos publicitaires courtes, générées dans le navigateur à partir de la fiche affiche.
// Montage déterministe en 3 scènes (aucune IA, aucun service externe) :
//   1. Photos du produit en mouvement (effet « Ken Burns ») + titre
//   2. Révélation du prix
//   3. L'affiche finale, avec le contact
// Encodage MP4 (H.264) via WebCodecs + mediabunny ; repli WebM (VP9) si le navigateur ne sait pas faire de H.264.
import {
  bi, badge, contactZone, cover, drawLaid, header, lay, rr, titleStack,
  posterSize, renderPoster, type Img, type PosterInput,
} from "./render";
import { formatPrice, type TemplateId } from "./catalog";

export type VideoInput = PosterInput & { photos: Img[] };
export const VIDEO_DURATIONS = [10, 15] as const;
export const FPS = 30;
const FADE = 0.4;

const THEMES: Record<TemplateId, { bg: string; accent: string; ink: string; sub: string; pill: string }> = {
  auto: { bg: "#0d0d0f", accent: "#e11d2e", ink: "#ffffff", sub: "#c4c4cc", pill: "#25D366" },
  immo: { bg: "#0f2a44", accent: "#c9a24a", ink: "#f6f1e7", sub: "#e3d5b0", pill: "#25D366" },
  food: { bg: "#fff4e0", accent: "#e85d04", ink: "#3d1f00", sub: "#8a5a2b", pill: "#e85d04" },
  phone: { bg: "#14123d", accent: "#4cc9f0", ink: "#ffffff", sub: "#c9c6ff", pill: "#25D366" },
  shop: { bg: "#ffffff", accent: "#0e9f6e", ink: "#111827", sub: "#4b5563", pill: "#25D366" },
};

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (x: number) => 1 - Math.pow(1 - clamp(x), 3);
const easeBack = (x: number) => {
  const c = 1.7;
  const v = clamp(x) - 1;
  return 1 + (c + 1) * v * v * v + c * v * v;
};
/** Progression 0→1 d'une animation qui démarre à `start` et dure `dur` secondes. */
const anim = (t: number, start: number, dur = 0.6) => easeOut((t - start) / dur);

export function timeline(duration: number) {
  // 10 s : 4 + 2,5 + 3,5   |   15 s : 7 + 3 + 5
  const s1 = duration >= 15 ? 7 : 4;
  const s2 = s1 + (duration >= 15 ? 3 : 2.5);
  return { s1, s2, end: duration };
}

type Ctx = CanvasRenderingContext2D;

function scenePhotos(ctx: Ctx, inp: VideoInput, W: number, H: number, t: number, end: number) {
  const th = THEMES[inp.template] ?? THEMES.shop;
  const photos = inp.photos.slice(0, 3);
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, W, H);
  if (photos.length) {
    const seg = end / photos.length;
    const drawPhoto = (i: number, alpha: number) => {
      const local = clamp((t - i * seg) / seg);
      const s = 1.04 + 0.12 * local;
      const dx = (i % 2 ? -1 : 1) * 40 * (local - 0.5);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(W / 2 + dx, H / 2);
      ctx.scale(s, s);
      cover(ctx, photos[i], -W / 2, -H / 2, W, H);
      ctx.restore();
    };
    const i = Math.max(0, Math.min(photos.length - 1, Math.floor(Math.max(0, t) / seg)));
    drawPhoto(i, 1);
    const next = i + 1;
    const fadeStart = next * seg - 0.35;
    if (next < photos.length && t > fadeStart) drawPhoto(next, clamp((t - fadeStart) / 0.35));
  } else {
    // Pas de photo : fond du modèle avec un motif léger
    ctx.fillStyle = th.accent;
    ctx.globalAlpha = 0.12;
    for (let k = 0; k < 6; k++) {
      ctx.beginPath();
      ctx.arc(((k * 263 + t * 40) % (W + 400)) - 200, (k * 331) % H, 160 + k * 30, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  // voiles pour la lisibilité
  let g = ctx.createLinearGradient(0, 0, 0, 260);
  g.addColorStop(0, "rgba(0,0,0,.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 260);
  g = ctx.createLinearGradient(0, H * 0.45, 0, H);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, "rgba(0,0,0,.85)");
  ctx.fillStyle = g;
  ctx.fillRect(0, H * 0.45, W, H * 0.55);

  const rtl = inp.language === "ar";
  const al = rtl ? "right" : "left";
  const M = 64;
  header(ctx, inp, W, 56, al, "#ffffff", th.accent, true);

  const b = bi(inp.language, inp.texts.badgeFr, inp.texts.badgeAr).join(" · ");
  const bIn = anim(t, 0.2, 0.5);
  if (b && bIn > 0) {
    ctx.save();
    ctx.globalAlpha = bIn;
    ctx.translate((rtl ? -1 : 1) * (1 - bIn) * 80, 0);
    badge(ctx, b, rtl ? M : W - M, 72, rtl ? "left" : "right", th.accent, "#fff", 12);
    ctx.restore();
  }

  const story = H > W;
  const st = titleStack(ctx, inp, W - 2 * M, story ? 104 : 84, "#ffffff", "#e5e5ea", story ? 1.25 : 1);
  const y = H - (story ? 220 : 110) - st.h;
  const k = anim(t, 0.4, 0.8);
  ctx.save();
  ctx.globalAlpha = k;
  st.draw(rtl ? W - M : M, y + (1 - k) * 70, al);
  ctx.restore();
}

function scenePrice(ctx: Ctx, inp: VideoInput, W: number, H: number, t: number) {
  const th = THEMES[inp.template] ?? THEMES.shop;
  const story = H > W;
  const k0 = story ? 1.2 : 1;
  const cz = { pill: th.pill, pillInk: "#fff", info: th.sub, cta: th.ink };
  ctx.fillStyle = th.bg;
  ctx.fillRect(0, 0, W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.38, 20, W / 2, H * 0.38, W * 0.7);
  g.addColorStop(0, th.accent + "55");
  g.addColorStop(1, th.accent + "00");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Mise en page calculée depuis le bas : contact, puis textes, puis la photo prend le reste.
  const bottom = H - (story ? 120 : 56);
  const zoneTop = contactZone(ctx, inp, W, bottom, "center", cz, true, k0);
  const label = inp.language === "fr" ? "Prix" : inp.language === "ar" ? "السعر" : "Prix · السعر";
  const ll = lay(ctx, { text: label.toUpperCase(), size: story ? 46 : 36, weight: 700, color: th.sub, maxLines: 1, lh: 1.2 }, W - 128);
  const pl = inp.price != null
    ? lay(ctx, { text: formatPrice(inp.price, inp.currency), size: story ? 150 : 112, min: 60, weight: 800, color: th.accent, maxLines: 1, lh: 1.1 }, W - 128)
    : null;
  const tags = bi(inp.language, inp.texts.taglineFr, inp.texts.taglineAr).map((tx) =>
    lay(ctx, { text: tx, size: story ? 48 : 36, min: 24, weight: 600, color: th.ink, maxLines: story ? 2 : 1 }, W - 128),
  );
  const textH = ll.h + 10 + (pl ? pl.h + 16 : 0) + tags.reduce((s2, l) => s2 + l.h + 6, 0);
  const top = story ? 140 : 50;
  const gap = story ? 70 : 34;
  const photo = inp.photos[0];
  const avail = zoneTop - 30 - textH - gap - top;
  const r = photo ? Math.max(90, Math.min(story ? 330 : 230, avail / 2 - 12)) : 0;
  const cy = top + 12 + r;

  if (photo) {
    const p = easeBack(clamp(t / 0.6));
    ctx.save();
    ctx.translate(W / 2, cy);
    ctx.scale(0.75 + 0.25 * p, 0.75 + 0.25 * p);
    ctx.beginPath();
    ctx.arc(0, 0, r + 12, 0, Math.PI * 2);
    ctx.fillStyle = th.accent;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    cover(ctx, photo, -r, -r, 2 * r, 2 * r);
    ctx.restore();
  }

  // Bloc de texte centré verticalement entre la photo et le contact
  const blockTop = photo ? cy + r + 12 + gap : top;
  let y = Math.max(blockTop, Math.min(zoneTop - 30 - textH, blockTop + (zoneTop - 30 - textH - blockTop) / 2));
  ctx.globalAlpha = anim(t, 0.2, 0.4);
  drawLaid(ctx, ll, W / 2, y, "center");
  ctx.globalAlpha = 1;
  y += ll.h + 10;
  if (pl) {
    const p = easeBack(clamp((t - 0.35) / 0.55));
    ctx.save();
    ctx.globalAlpha = clamp((t - 0.35) / 0.2);
    ctx.translate(W / 2, y + pl.h / 2);
    ctx.scale(0.6 + 0.4 * p, 0.6 + 0.4 * p);
    drawLaid(ctx, pl, 0, -pl.h / 2, "center");
    ctx.restore();
    y += pl.h + 16;
  }
  tags.forEach((l, i) => {
    const k = anim(t, 0.7 + i * 0.15, 0.5);
    ctx.globalAlpha = k;
    drawLaid(ctx, l, W / 2, y + (1 - k) * 30, "center");
    y += l.h + 6;
  });
  ctx.globalAlpha = 1;
  const k = anim(t, 1.0, 0.5);
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(0, (1 - k) * 60);
  contactZone(ctx, inp, W, bottom, "center", cz, false, k0);
  ctx.restore();
}

function sceneFinal(ctx: Ctx, poster: HTMLCanvasElement, W: number, H: number, t: number, len: number) {
  const s = 1.06 - 0.06 * easeOut(t / Math.max(1, len * 0.6));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(s, s);
  ctx.drawImage(poster, -W / 2, -H / 2, W, H);
  ctx.restore();
}

/** Dessine l'image de la vidéo à l'instant `t` (secondes). `poster` = rendu final déjà calculé. */
export function renderVideoFrame(canvas: HTMLCanvasElement, inp: VideoInput, poster: HTMLCanvasElement, time: number, duration: number) {
  const t = Number.isFinite(time) ? Math.min(Math.max(0, time), duration) : 0;
  const { width: W, height: H } = posterSize(inp.format);
  if (canvas.width !== W) canvas.width = W;
  if (canvas.height !== H) canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  const tl = timeline(duration);
  const draw = (scene: 0 | 1 | 2, alpha: number) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    if (alpha < 1) {
      // couche intermédiaire pour un vrai fondu
      const off = document.createElement("canvas");
      off.width = W;
      off.height = H;
      const o = off.getContext("2d")!;
      drawSceneOn(o, scene);
      ctx.drawImage(off, 0, 0);
    } else drawSceneOn(ctx, scene);
    ctx.restore();
  };
  const drawSceneOn = (c: Ctx, scene: 0 | 1 | 2) => {
    if (scene === 0) scenePhotos(c, inp, W, H, t, tl.s1);
    else if (scene === 1) scenePrice(c, inp, W, H, t - tl.s1);
    else sceneFinal(c, poster, W, H, t - tl.s2, tl.end - tl.s2);
  };
  ctx.clearRect(0, 0, W, H);
  if (t < tl.s1) {
    draw(0, 1);
    if (t > tl.s1 - FADE) draw(1, (t - (tl.s1 - FADE)) / FADE);
  } else if (t < tl.s2) {
    draw(1, 1);
    if (t > tl.s2 - FADE) draw(2, (t - (tl.s2 - FADE)) / FADE);
  } else draw(2, 1);
}

/** Pré-calcule l'affiche finale (scène 3). */
export function renderFinalPoster(inp: PosterInput) {
  const c = document.createElement("canvas");
  renderPoster(c, inp);
  return c;
}

export type EncodeResult = { blob: Blob; ext: "mp4" | "webm"; mime: string; codec: string };

/** Débit choisi pour rester sous ~3,5 Mo (limite d'envoi Vercel de 4,5 Mo par requête). */
export function bitrateFor(duration: number) {
  return Math.min(5_000_000, Math.floor((3.2 * 8 * 1024 * 1024) / duration));
}

export async function encodeVideo(
  inp: VideoInput,
  duration: number,
  onProgress: (p: number) => void,
  signal?: AbortSignal,
): Promise<EncodeResult> {
  const mb = await import("mediabunny");
  const { width, height } = posterSize(inp.format);
  const bitrate = bitrateFor(duration);
  let ext: "mp4" | "webm" = "mp4";
  let codec: "avc" | "vp9" | "vp8" = "avc";
  if (!(await mb.canEncodeVideo("avc", { width, height, bitrate }))) {
    ext = "webm";
    codec = (await mb.canEncodeVideo("vp9", { width, height, bitrate })) ? "vp9" : "vp8";
    if (!(await mb.canEncodeVideo(codec, { width, height, bitrate }))) {
      throw new Error("Ce navigateur ne sait pas encoder de vidéo. Utilisez Chrome ou Edge récent.");
    }
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const poster = renderFinalPoster(inp);
  const output = new mb.Output({
    format: ext === "mp4" ? new mb.Mp4OutputFormat({ fastStart: "in-memory" }) : new mb.WebMOutputFormat(),
    target: new mb.BufferTarget(),
  });
  const source = new mb.CanvasSource(canvas, { codec, bitrate, keyFrameInterval: 2 });
  output.addVideoTrack(source, { frameRate: FPS });
  await output.start();
  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i++) {
    if (signal?.aborted) {
      await output.cancel();
      throw new Error("Génération annulée.");
    }
    renderVideoFrame(canvas, inp, poster, i / FPS, duration);
    await source.add(i / FPS, 1 / FPS);
    if (i % 10 === 0) onProgress(i / frames);
  }
  await output.finalize();
  onProgress(1);
  const buf = output.target.buffer!;
  const mime = ext === "mp4" ? "video/mp4" : "video/webm";
  return { blob: new Blob([buf], { type: mime }), ext, mime, codec };
}

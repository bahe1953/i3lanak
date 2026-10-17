// Rendu des affiches sur <canvas> (navigateur). Aucun service externe :
// l'image est dessinée localement puis exportée en PNG.
import { FORMATS, formatPrice, type FormatId, type PosterLanguage, type PosterTexts, type TemplateId } from "./catalog";

export type Img = HTMLImageElement | ImageBitmap | HTMLCanvasElement;

export type PosterInput = {
  template: TemplateId;
  format: FormatId;
  language: PosterLanguage;
  texts: PosterTexts;
  price: number | null;
  currency: string;
  merchantName: string;
  whatsapp: string;
  city: string;
  contactLine: string;
  photo: Img | null;
  logo: Img | null;
};

export const POSTER_FONT = 'Cairo, "Noto Sans Arabic", Arial, sans-serif';
export type Ctx = CanvasRenderingContext2D;
export type Align = "left" | "right" | "center";

const AR_RE = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const isAr = (s: string) => AR_RE.test(s);

// ---------------------------------------------------------------- texte

export function font(ctx: Ctx, weight: number, size: number) {
  ctx.font = `${weight} ${size}px ${POSTER_FONT}`;
}

export function wrap(ctx: Ctx, text: string, maxW: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (cur && ctx.measureText(next).width > maxW) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

export type Block = { text: string; size: number; min?: number; weight: number; color: string; maxLines?: number; lh?: number };
export type Laid = Block & { lines: string[]; fsize: number; lineH: number; h: number };

/** Réduit la taille jusqu'à ce que le texte tienne dans maxW sur maxLines lignes. */
export function lay(ctx: Ctx, b: Block, maxW: number): Laid {
  const maxLines = b.maxLines ?? 2;
  const min = b.min ?? Math.round(b.size * 0.6);
  let size = b.size;
  let lines: string[] = [];
  for (; size >= min; size -= 2) {
    font(ctx, b.weight, size);
    lines = wrap(ctx, b.text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  if (size < min) {
    size = min;
    font(ctx, b.weight, size);
    lines = wrap(ctx, b.text, maxW);
    if (lines.length > maxLines) {
      lines = lines.slice(0, maxLines);
      let last = lines[maxLines - 1];
      while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  const lineH = Math.round(size * (b.lh ?? (isAr(b.text) ? 1.45 : 1.22)));
  return { ...b, lines, fsize: size, lineH, h: lines.length * lineH };
}

export function drawLaid(ctx: Ctx, l: Laid, x: number, y: number, align: Align) {
  font(ctx, l.weight, l.fsize);
  ctx.fillStyle = l.color;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  l.lines.forEach((line, i) => {
    ctx.direction = isAr(line) ? "rtl" : "ltr";
    ctx.fillText(line, x, y + i * l.lineH + l.lineH / 2);
  });
  ctx.direction = "ltr";
}

/** Une ou deux langues selon le choix. */
export function bi(lang: PosterLanguage, fr?: string, ar?: string): string[] {
  const f = (fr ?? "").trim();
  const a = (ar ?? "").trim();
  if (lang === "fr") return f ? [f] : [];
  if (lang === "ar") return a ? [a] : f ? [f] : [];
  return f === a ? [f].filter(Boolean) : [f, a].filter(Boolean);
}

/** Pile de blocs : mesure puis dessine. */
export class Stack {
  items: { l: Laid; gap: number }[] = [];
  constructor(
    private ctx: Ctx,
    private maxW: number,
  ) {}
  add(b: Block, gap = 0) {
    if (b.text.trim()) this.items.push({ l: lay(this.ctx, b, this.maxW), gap });
    return this;
  }
  get h() {
    return this.items.reduce((s, it, i) => s + it.l.h + (i ? it.gap : 0), 0);
  }
  draw(x: number, y: number, align: Align) {
    let cy = y;
    this.items.forEach((it, i) => {
      if (i) cy += it.gap;
      drawLaid(this.ctx, it.l, x, cy, align);
      cy += it.l.h;
    });
    return cy;
  }
}

// ---------------------------------------------------------------- formes & images

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function dims(img: Img): [number, number] {
  return img instanceof HTMLImageElement ? [img.naturalWidth, img.naturalHeight] : [img.width, img.height];
}

export function cover(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number) {
  const [iw, ih] = dims(img);
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function contain(ctx: Ctx, img: Img, x: number, y: number, w: number, h: number) {
  const [iw, ih] = dims(img);
  const s = Math.min(w / iw, h / ih);
  ctx.drawImage(img, x + (w - iw * s) / 2, y + (h - ih * s) / 2, iw * s, ih * s);
}

/** Zone photo : la photo, ou un emplacement visible si elle manque. */
export function photoBox(ctx: Ctx, img: Img | null, x: number, y: number, w: number, h: number, r: number, empty: string, ink: string) {
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.clip();
  if (img) cover(ctx, img, x, y, w, h);
  else {
    ctx.fillStyle = empty;
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = ink;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 3;
    for (let i = -h; i < w; i += 46) {
      ctx.beginPath();
      ctx.moveTo(x + i, y + h);
      ctx.lineTo(x + i + h, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = ink;
    font(ctx, 700, 34);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Photo du produit · صورة المنتج", x + w / 2, y + h / 2);
  }
  ctx.restore();
}

export function logoDisc(ctx: Ctx, img: Img, cx: number, cy: number, r: number, ring: string) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.clip();
  contain(ctx, img, cx - r * 0.78, cy - r * 0.78, r * 1.56, r * 1.56);
  ctx.restore();
}

/** En-tête : logo + nom du commerçant. Renvoie le bas de l'en-tête. */
export function header(ctx: Ctx, inp: PosterInput, W: number, y: number, align: Align, color: string, ring: string, shadow = false) {
  const r = 50;
  const name = inp.merchantName.trim();
  if (!inp.logo && !name) return y;
  const m = 64;
  font(ctx, 700, 36);
  const nameW = name ? Math.min(ctx.measureText(name).width, W - 2 * m - 2 * r - 24) : 0;
  const total = (inp.logo ? 2 * r + (name ? 22 : 0) : 0) + nameW;
  let left = align === "center" ? (W - total) / 2 : align === "left" ? m : W - m - total;
  const cy = y + r;
  const logoFirst = align !== "right";
  if (shadow) {
    ctx.shadowColor = "rgba(0,0,0,.45)";
    ctx.shadowBlur = 18;
  }
  if (inp.logo && logoFirst) {
    logoDisc(ctx, inp.logo, left + r, cy, r, ring);
    left += 2 * r + 22;
  }
  if (name) {
    const l = lay(ctx, { text: name, size: 36, min: 24, weight: 700, color, maxLines: 1 }, nameW + 1);
    drawLaid(ctx, l, left, cy - l.h / 2, "left");
    left += nameW + 22;
  }
  if (inp.logo && !logoFirst) logoDisc(ctx, inp.logo, left + r, cy, r, ring);
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  return y + 2 * r;
}

/** Pastille WhatsApp + ligne ville/adresse. Dessine en partant du bas. Renvoie le haut. */
export function contactZone(
  ctx: Ctx,
  inp: PosterInput,
  W: number,
  bottom: number,
  align: Align,
  o: { pill: string; pillInk: string; info: string; cta: string },
  measureOnly = false,
  k = 1,
) {
  const m = 64;
  const info = [inp.city, inp.contactLine].map((s) => s.trim()).filter(Boolean).join("  ·  ");
  const ctaLines = bi(inp.language, inp.texts.ctaFr, inp.texts.ctaAr);
  const pillH = Math.round(92 * k);
  const infoL = info ? lay(ctx, { text: info, size: Math.round(30 * k), min: 20, weight: 600, color: o.info, maxLines: 1 }, W - 2 * m) : null;
  const ctaStack = new Stack(ctx, W - 2 * m);
  ctaLines.forEach((t, i) => ctaStack.add({ text: t, size: Math.round(34 * k), min: 22, weight: 700, color: o.cta, maxLines: 1 }, i ? 2 : 0));
  const hasPill = Boolean(inp.whatsapp.trim());
  const total = (infoL ? infoL.h + 14 : 0) + (hasPill ? pillH : 0) + (ctaStack.h ? ctaStack.h + 14 : 0);
  if (measureOnly) return bottom - total;

  let y = bottom;
  const ax = align === "center" ? W / 2 : align === "left" ? m : W - m;
  if (infoL) {
    y -= infoL.h;
    drawLaid(ctx, infoL, ax, y, align);
    y -= 14;
  }
  if (hasPill) {
    y -= pillH;
    const label = `WhatsApp  ${inp.whatsapp.trim()}`;
    const fs = Math.round(40 * k);
    font(ctx, 800, fs);
    const pw = Math.min(ctx.measureText(label).width + 100 * k, W - 2 * m);
    const px = align === "center" ? (W - pw) / 2 : align === "left" ? m : W - m - pw;
    rr(ctx, px, y, pw, pillH, pillH / 2);
    ctx.fillStyle = o.pill;
    ctx.fill();
    // petit pictogramme « bulle »
    ctx.beginPath();
    ctx.arc(px + 50 * k, y + pillH / 2, 18 * k, 0, Math.PI * 2);
    ctx.fillStyle = o.pillInk;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 50 * k, y + pillH / 2, 10 * k, 0, Math.PI * 2);
    ctx.fillStyle = o.pill;
    ctx.fill();
    const l = lay(ctx, { text: label, size: fs, min: 24, weight: 800, color: o.pillInk, maxLines: 1, lh: 1 }, pw - 100 * k);
    drawLaid(ctx, l, px + 80 * k, y + (pillH - l.h) / 2, "left");
  }
  if (ctaStack.h) {
    y -= ctaStack.h + 14;
    ctaStack.draw(ax, y, align);
  }
  return y;
}

export function badge(ctx: Ctx, text: string, x: number, y: number, anchor: "left" | "right", bg: string, ink: string, skew = 0) {
  if (!text.trim()) return;
  const l = lay(ctx, { text: text.toUpperCase(), size: 34, min: 24, weight: 800, color: ink, maxLines: 1, lh: 1 }, 420);
  font(ctx, 800, l.fsize);
  const w = ctx.measureText(l.lines[0]).width + 56;
  const h = 70;
  const bx = anchor === "left" ? x : x - w;
  ctx.save();
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(bx + skew, y);
  ctx.lineTo(bx + w + skew, y);
  ctx.lineTo(bx + w - skew, y + h);
  ctx.lineTo(bx - skew, y + h);
  ctx.closePath();
  if (!skew) rr(ctx, bx, y, w, h, h / 2);
  ctx.fill();
  drawLaid(ctx, l, bx + w / 2, y + (h - l.h) / 2, "center");
  ctx.restore();
}

/** Titre + accroche, mesurés ensemble. */
export function titleStack(ctx: Ctx, inp: PosterInput, maxW: number, big: number, color: string, sub: string, k = 1) {
  const st = new Stack(ctx, maxW);
  const heads = bi(inp.language, inp.texts.headlineFr, inp.texts.headlineAr);
  heads.forEach((t, i) => st.add({ text: t, size: i ? Math.round(big * 0.72) : big, weight: 800, color, maxLines: 2 }, i ? 4 : 0));
  bi(inp.language, inp.texts.taglineFr, inp.texts.taglineAr).forEach((t, i) =>
    st.add({ text: t, size: Math.round(38 * k), min: 24, weight: 500, color: sub, maxLines: 2 }, i ? 2 : Math.round(14 * k)),
  );
  return st;
}

// ---------------------------------------------------------------- modèles

type Layout = (ctx: Ctx, inp: PosterInput, W: number, H: number) => void;
const M = 64;

/**
 * Choisit l'échelle de texte la plus grande qui laisse à la photo sa hauteur minimale.
 * `space(k)` renvoie la hauteur disponible pour la photo à l'échelle k.
 */
function fitScale(story: boolean, minPhoto: number, space: (k: number) => number) {
  let k = story ? 1.3 : 1;
  const kMin = story ? 0.85 : 0.62;
  while (k > kMin && space(k) < minPhoto) k = Math.round((k - 0.04) * 100) / 100;
  return k;
}

const bText = (inp: PosterInput) => bi(inp.language, inp.texts.badgeFr, inp.texts.badgeAr).join(" · ");

const auto: Layout = (ctx, inp, W, H) => {
  const story = H > W;
  const rtl = inp.language === "ar";
  const al: Align = rtl ? "right" : "left";
  const ax = rtl ? W - M : M;
  const cz = { pill: "#25D366", pillInk: "#fff", info: "#a1a1aa", cta: "#fff" };
  ctx.fillStyle = "#0d0d0f";
  ctx.fillRect(0, 0, W, H);
  const bottom = H - (story ? 90 : 56);

  const measure = (k: number) => {
    const zoneTop = contactZone(ctx, inp, W, bottom, al, cz, true, k);
    const priceH = inp.price != null ? Math.round(118 * k) : 0;
    const st = titleStack(ctx, inp, W - 2 * M, Math.round(76 * k), "#ffffff", "#c4c4cc", k);
    const priceY = zoneTop - (priceH ? priceH + 36 * k : 0);
    const textY = priceY - (priceH ? 30 * k : 10) - st.h;
    return { priceH, st, priceY, textY };
  };
  const k = fitScale(story, story ? 820 : 420, (k) => measure(k).textY + 40);
  const { priceH, st, priceY, textY } = measure(k);
  const photoH = textY + 40;

  photoBox(ctx, inp.photo, 0, 0, W, photoH, 0, "#1f1f23", "#e11d2e");
  let g = ctx.createLinearGradient(0, photoH - 320, 0, photoH);
  g.addColorStop(0, "rgba(13,13,15,0)");
  g.addColorStop(1, "rgba(13,13,15,1)");
  ctx.fillStyle = g;
  ctx.fillRect(0, photoH - 320, W, 320);
  g = ctx.createLinearGradient(0, 0, 0, 220);
  g.addColorStop(0, "rgba(0,0,0,.6)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, 220);

  header(ctx, inp, W, 56, al, "#ffffff", "#e11d2e", true);
  badge(ctx, bText(inp), rtl ? M : W - M, 72, rtl ? "left" : "right", "#e11d2e", "#fff", 12);

  st.draw(ax, textY, al);
  if (priceH) {
    ctx.fillStyle = "#e11d2e";
    ctx.beginPath();
    ctx.moveTo(0, priceY + 14);
    ctx.lineTo(W, priceY);
    ctx.lineTo(W, priceY + priceH - 14);
    ctx.lineTo(0, priceY + priceH);
    ctx.closePath();
    ctx.fill();
    const l = lay(ctx, { text: formatPrice(inp.price, inp.currency), size: Math.round(80 * k), weight: 800, color: "#fff", maxLines: 1, lh: 1 }, W - 2 * M);
    drawLaid(ctx, l, ax, priceY + (priceH - l.h) / 2, al);
  }
  contactZone(ctx, inp, W, bottom, al, cz, false, k);
};

const immo: Layout = (ctx, inp, W, H) => {
  const story = H > W;
  const rtl = inp.language === "ar";
  const al: Align = rtl ? "right" : "left";
  const ax = rtl ? W - M - 20 : M + 20;
  const navy = "#0f2a44";
  const gold = "#c9a24a";
  const cz = { pill: "#25D366", pillInk: "#fff", info: "#d9cba6", cta: "#f6f1e7" };
  ctx.fillStyle = "#f6f1e7";
  ctx.fillRect(0, 0, W, H);

  const headBottom = header(ctx, inp, W, 40, al, navy, gold);
  if (inp.city.trim()) {
    const l = lay(ctx, { text: inp.city, size: 30, weight: 700, color: gold, maxLines: 1, lh: 1 }, 360);
    drawLaid(ctx, l, rtl ? M : W - M, 40 + 50 - l.h / 2, rtl ? "left" : "right");
  }
  const bottom = H - (story ? 90 : 52);
  const photoY = Math.max(headBottom, 40) + 28;

  const measure = (k: number) => {
    const zoneTop = contactZone(ctx, inp, W, bottom, al, cz, true, k);
    const st = titleStack(ctx, inp, W - 2 * M - 40, Math.round(64 * k), "#f6f1e7", "#e3d5b0", k);
    const priceH = inp.price != null ? Math.round(84 * k) : 0;
    const priceY = zoneTop - (priceH ? priceH + 26 * k : 0);
    const textY = priceY - (priceH ? 22 * k : 10) - st.h;
    const panelY = textY - 50 * k;
    return { st, priceH, priceY, textY, panelY, photoH: panelY - 20 - photoY };
  };
  const k = fitScale(story, story ? 700 : 300, (k) => measure(k).photoH);
  const { st, priceH, priceY, textY, panelY, photoH } = measure(k);

  ctx.fillStyle = navy;
  ctx.fillRect(0, panelY, W, H - panelY);
  ctx.fillStyle = gold;
  ctx.fillRect(M - 10, photoY - 10, W - 2 * M + 20, photoH + 20);
  photoBox(ctx, inp.photo, M, photoY, W - 2 * M, photoH, 0, "#e8dfcc", navy);
  badge(ctx, bText(inp), rtl ? W - M - 24 : M + 24, photoY + 24, rtl ? "right" : "left", gold, navy);

  st.draw(ax, textY, al);
  if (priceH) {
    ctx.fillStyle = gold;
    ctx.fillRect(rtl ? W - M - 20 - 120 : ax, priceY - 4, 120, 4);
    const l = lay(ctx, { text: formatPrice(inp.price, inp.currency), size: Math.round(70 * k), weight: 800, color: gold, maxLines: 1, lh: 1 }, W - 2 * M - 40);
    drawLaid(ctx, l, ax, priceY + (priceH - l.h) / 2 + 6, al);
  }
  contactZone(ctx, inp, W, bottom, al, cz, false, k);
};

const food: Layout = (ctx, inp, W, H) => {
  const story = H > W;
  const orange = "#e85d04";
  const brown = "#3d1f00";
  const cz = { pill: orange, pillInk: "#fff", info: "#8a5a2b", cta: brown };
  ctx.fillStyle = "#fff4e0";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "rgba(232,93,4,.10)";
  ctx.beginPath();
  ctx.arc(W - 40, 80, 300, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, H - 60, 260, 0, Math.PI * 2);
  ctx.fill();

  const headBottom = header(ctx, inp, W, 44, "center", brown, orange);
  const bottom = H - (story ? 90 : 50);
  const top = headBottom + (story ? 60 : 40);

  const measure = (k: number) => {
    const zoneTop = contactZone(ctx, inp, W, bottom, "center", cz, true, k);
    const st = titleStack(ctx, inp, W - 2 * M, Math.round(70 * k), brown, "#8a5a2b", k);
    const textY = zoneTop - 28 * k - st.h;
    return { st, textY, avail: textY - 50 - top };
  };
  const k = fitScale(story, story ? 760 : 400, (k) => measure(k).avail);
  const { st, textY, avail } = measure(k);
  const r = Math.max(110, Math.min(story ? 420 : 320, avail / 2 - 30));
  const cx = W / 2;
  const cy = top + avail / 2;

  ctx.setLineDash([18, 16]);
  ctx.lineWidth = 5;
  ctx.strokeStyle = orange;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 30, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  photoBox(ctx, inp.photo, cx - r, cy - r, 2 * r, 2 * r, 0, "#ffe2b8", orange);
  ctx.restore();
  ctx.lineWidth = 14;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();

  if (inp.price != null) {
    const pr = Math.round(Math.min(story ? 160 : 124, r * 0.5));
    const px = Math.min(W - pr - 24, cx + r * 0.8);
    const py = Math.max(top + pr * 0.4, cy - r * 0.62);
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(-0.2);
    ctx.fillStyle = orange;
    ctx.beginPath();
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const rad = i % 2 ? pr : pr * 0.92;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    const num = formatPrice(inp.price, "").trim();
    const nl = lay(ctx, { text: num, size: Math.round(pr * 0.44), min: 22, weight: 800, color: "#fff", maxLines: 1, lh: 1 }, pr * 1.6);
    drawLaid(ctx, nl, 0, -nl.h / 2 - pr * 0.11, "center");
    const cl = lay(ctx, { text: inp.currency, size: Math.round(pr * 0.24), weight: 700, color: "#ffe2b8", maxLines: 1, lh: 1 }, pr * 1.4);
    drawLaid(ctx, cl, 0, nl.h / 2 - 2, "center");
    ctx.restore();
  }
  badge(ctx, bText(inp), cx - r * 0.95, cy + r * 0.62, "left", brown, "#fff4e0");

  st.draw(W / 2, textY, "center");
  contactZone(ctx, inp, W, bottom, "center", cz, false, k);
};

const phone: Layout = (ctx, inp, W, H) => {
  const story = H > W;
  const cyan = "#4cc9f0";
  const cz = { pill: "#25D366", pillInk: "#fff", info: "#b8b5ff", cta: "#ffffff" };
  let g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#0b0b2b");
  g.addColorStop(1, "#3a0ca3");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  const headBottom = header(ctx, inp, W, 48, "center", "#ffffff", cyan);
  const bottom = H - (story ? 90 : 50);
  const top = headBottom + (story ? 70 : 36);

  const measure = (k: number) => {
    const zoneTop = contactZone(ctx, inp, W, bottom, "center", cz, true, k);
    const priceH = inp.price != null ? Math.round(96 * k) : 0;
    const priceY = zoneTop - (priceH ? priceH + 24 * k : 0);
    const st = titleStack(ctx, inp, W - 2 * M, Math.round(72 * k), "#ffffff", "#c9c6ff", k);
    const textY = priceY - 22 * k - st.h;
    return { priceH, priceY, st, textY, boxH: textY - 44 - top };
  };
  const k = fitScale(story, story ? 760 : 320, (k) => measure(k).boxH);
  const { priceH, priceY, st, textY, boxH } = measure(k);
  const bw = Math.min(story ? 860 : 680, boxH * 1.25);
  const bx = (W - bw) / 2;

  g = ctx.createRadialGradient(W / 2, top + boxH / 2, 20, W / 2, top + boxH / 2, bw * 0.85);
  g.addColorStop(0, "rgba(76,201,240,.55)");
  g.addColorStop(1, "rgba(76,201,240,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, top - 100, W, boxH + 200);
  ctx.shadowColor = "rgba(76,201,240,.7)";
  ctx.shadowBlur = 40;
  rr(ctx, bx, top, bw, boxH, 40);
  ctx.fillStyle = "#14123d";
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
  photoBox(ctx, inp.photo, bx, top, bw, boxH, 40, "#1d1a52", cyan);
  ctx.lineWidth = 4;
  ctx.strokeStyle = cyan;
  rr(ctx, bx, top, bw, boxH, 40);
  ctx.stroke();
  badge(ctx, bText(inp), bx + bw - 24, top + 24, "right", cyan, "#0b0b2b");

  st.draw(W / 2, textY, "center");
  if (priceH) {
    const l = lay(ctx, { text: formatPrice(inp.price, inp.currency), size: Math.round(86 * k), weight: 800, color: cyan, maxLines: 1, lh: 1 }, W - 2 * M);
    ctx.shadowColor = "rgba(76,201,240,.6)";
    ctx.shadowBlur = 24;
    drawLaid(ctx, l, W / 2, priceY + (priceH - l.h) / 2, "center");
    ctx.shadowBlur = 0;
    ctx.shadowColor = "transparent";
  }
  contactZone(ctx, inp, W, bottom, "center", cz, false, k);
};

const shop: Layout = (ctx, inp, W, H) => {
  const story = H > W;
  const rtl = inp.language === "ar";
  const al: Align = rtl ? "right" : "left";
  const ax = rtl ? W - M : M;
  const green = "#0e9f6e";
  const dark = "#111827";
  const cz = { pill: "#25D366", pillInk: "#fff", info: "#6b7280", cta: dark };
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#d1fae5";
  ctx.beginPath();
  ctx.arc(rtl ? 60 : W - 60, 40, 330, 0, Math.PI * 2);
  ctx.fill();

  const headBottom = header(ctx, inp, W, 44, al, dark, green);
  const bottom = H - (story ? 90 : 50);
  const top = headBottom + 28;

  const measure = (k: number) => {
    const zoneTop = contactZone(ctx, inp, W, bottom, al, cz, true, k);
    const priceH = inp.price != null ? Math.round(100 * k) : 0;
    const priceY = zoneTop - (priceH ? priceH + 28 * k : 0);
    const st = titleStack(ctx, inp, W - 2 * M, Math.round(70 * k), dark, "#4b5563", k);
    const textY = priceY - 24 * k - st.h;
    return { priceH, priceY, st, textY, ph: textY - 36 - top };
  };
  const k = fitScale(story, story ? 720 : 320, (k) => measure(k).ph);
  const { priceH, priceY, st, textY, ph } = measure(k);

  photoBox(ctx, inp.photo, M, top, W - 2 * M, ph, 36, "#ecfdf5", green);
  badge(ctx, bText(inp), rtl ? W - M - 24 : M + 24, top + 24, rtl ? "right" : "left", green, "#fff");

  st.draw(ax, textY, al);
  if (priceH) {
    const l = lay(ctx, { text: formatPrice(inp.price, inp.currency), size: Math.round(72 * k), weight: 800, color: "#fff", maxLines: 1, lh: 1 }, W - 2 * M - 120);
    font(ctx, 800, l.fsize);
    const tw = ctx.measureText(l.lines[0]).width + 110;
    const tx = rtl ? W - M - tw : M;
    ctx.fillStyle = green;
    ctx.beginPath();
    if (rtl) {
      ctx.moveTo(tx, priceY);
      ctx.lineTo(tx + tw - 40, priceY);
      ctx.lineTo(tx + tw, priceY + priceH / 2);
      ctx.lineTo(tx + tw - 40, priceY + priceH);
      ctx.lineTo(tx, priceY + priceH);
    } else {
      ctx.moveTo(tx + 40, priceY);
      ctx.lineTo(tx + tw, priceY);
      ctx.lineTo(tx + tw, priceY + priceH);
      ctx.lineTo(tx + 40, priceY + priceH);
      ctx.lineTo(tx, priceY + priceH / 2);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(rtl ? tx + tw - 34 : tx + 34, priceY + priceH / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    drawLaid(ctx, l, rtl ? tx + tw - 66 : tx + 66, priceY + (priceH - l.h) / 2, rtl ? "right" : "left");
  }
  contactZone(ctx, inp, W, bottom, al, cz, false, k);
};

const LAYOUTS: Record<TemplateId, Layout> = { auto, immo, food, phone, shop };

export function posterSize(format: FormatId) {
  return FORMATS[format] ?? FORMATS.square;
}

export function renderPoster(canvas: HTMLCanvasElement, inp: PosterInput) {
  const { width, height } = posterSize(inp.format);
  if (canvas.width !== width) canvas.width = width;
  if (canvas.height !== height) canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  (LAYOUTS[inp.template] ?? shop)(ctx, inp, width, height);
  ctx.restore();
}

/** Attend que la police Cairo soit chargée avant de dessiner (sinon texte arabe en police de secours). */
export async function ensurePosterFonts() {
  if (typeof document === "undefined" || !document.fonts) return;
  await Promise.all([400, 500, 600, 700, 800].map((w) => document.fonts.load(`${w} 40px Cairo`, "Aa عربي 123")));
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Image illisible : ${src}`));
    img.src = src;
  });
}

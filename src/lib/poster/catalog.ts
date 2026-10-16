// Catalogue de l'atelier : modèles par secteur, formats, et textes d'exemple.
// Module « pur » (sans dépendance navigateur ni base) : utilisé côté serveur et client.

export const TEMPLATE_IDS = ["auto", "immo", "food", "phone", "shop"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const FORMATS = {
  square: { width: 1080, height: 1080, labelFr: "Publication 1080×1080", labelAr: "منشور 1080×1080" },
  story: { width: 1080, height: 1920, labelFr: "Story 1080×1920", labelAr: "ستوري 1080×1920" },
} as const;
export type FormatId = keyof typeof FORMATS;

export const LANGUAGES = ["fr", "ar", "both"] as const;
export type PosterLanguage = (typeof LANGUAGES)[number];

export const POSTER_STATUSES = ["draft", "sent", "validated", "published"] as const;
export type PosterStatus = (typeof POSTER_STATUSES)[number];

export const TEXT_KEYS = ["headlineFr", "headlineAr", "taglineFr", "taglineAr", "ctaFr", "ctaAr", "badgeFr", "badgeAr"] as const;
export type TextKey = (typeof TEXT_KEYS)[number];
export type PosterTexts = Partial<Record<TextKey, string>>;

type Variants = { fr: string[]; ar: string[] };

export const TEMPLATES: Record<
  TemplateId,
  { nameFr: string; nameAr: string; swatch: [string, string]; tagline: Variants; badge: Variants }
> = {
  auto: {
    nameFr: "Voitures",
    nameAr: "سيارات",
    swatch: ["#0d0d0f", "#e11d2e"],
    tagline: {
      fr: ["Entretenue et prête à rouler", "Excellent état, papiers en règle", "Économique et fiable", "Climatisée, faible kilométrage"],
      ar: ["سيارة نظيفة وجاهزة للقيادة", "حالة ممتازة وأوراق كاملة", "اقتصادية وموثوقة", "مكيفة وبعداد منخفض"],
    },
    badge: { fr: ["À vendre", "Bonne affaire", "Occasion"], ar: ["للبيع", "فرصة", "مستعملة"] },
  },
  immo: {
    nameFr: "Immobilier",
    nameAr: "عقارات",
    swatch: ["#0f2a44", "#c9a24a"],
    tagline: {
      fr: ["Emplacement idéal, quartier calme", "Spacieux et lumineux", "Titre foncier disponible", "Prêt à habiter"],
      ar: ["موقع مثالي في حي هادئ", "واسع ومشمس", "سند الملكية متوفر", "جاهز للسكن"],
    },
    badge: { fr: ["À vendre", "À louer", "Exclusivité"], ar: ["للبيع", "للإيجار", "حصري"] },
  },
  food: {
    nameFr: "Alimentation",
    nameAr: "مواد غذائية",
    swatch: ["#fff4e0", "#e85d04"],
    tagline: {
      fr: ["Frais et préparé chaque jour", "Le goût authentique", "Livraison rapide à domicile", "Fait maison avec passion"],
      ar: ["طازج ويُحضَّر يوميًا", "المذاق الأصيل", "توصيل سريع إلى المنزل", "صُنع منزلي بحب"],
    },
    badge: { fr: ["Nouveau", "Promo", "Spécial"], ar: ["جديد", "عرض", "مميز"] },
  },
  phone: {
    nameFr: "Téléphones",
    nameAr: "هواتف",
    swatch: ["#1b0b4d", "#4cc9f0"],
    tagline: {
      fr: ["Neuf et garanti", "Original avec accessoires", "Le meilleur prix en ville", "Stock limité"],
      ar: ["جديد ومضمون", "أصلي مع ملحقاته", "أفضل سعر في المدينة", "كمية محدودة"],
    },
    badge: { fr: ["Nouveau", "Promo", "Original"], ar: ["جديد", "عرض خاص", "أصلي"] },
  },
  shop: {
    nameFr: "Commerce",
    nameAr: "تجارة عامة",
    swatch: ["#ffffff", "#0e9f6e"],
    tagline: {
      fr: ["Qualité garantie", "Nouvel arrivage", "Les meilleurs prix", "Satisfait ou échangé"],
      ar: ["جودة مضمونة", "وصول جديد", "أفضل الأسعار", "الاستبدال مضمون"],
    },
    badge: { fr: ["Nouveau", "Promo", "Disponible"], ar: ["جديد", "تخفيض", "متوفر"] },
  },
};

const CTA: Variants = {
  fr: ["Commandez sur WhatsApp", "Écrivez-nous sur WhatsApp", "Appelez-nous"],
  ar: ["اطلب عبر واتساب", "راسلنا على واتساب", "اتصل بنا"],
};

/**
 * Textes d'exemple tirés des modèles (aucun appel à l'IA).
 * `variant` permet de faire défiler les propositions.
 */
export function sampleTexts(template: TemplateId, productName: string, variant = 0, productNameAr?: string): PosterTexts {
  const t = TEMPLATES[template] ?? TEMPLATES.shop;
  const pick = (arr: string[]) => arr[((variant % arr.length) + arr.length) % arr.length];
  return {
    headlineFr: productName,
    headlineAr: productNameAr || productName,
    taglineFr: pick(t.tagline.fr),
    taglineAr: pick(t.tagline.ar),
    ctaFr: pick(CTA.fr),
    ctaAr: pick(CTA.ar),
    badgeFr: pick(t.badge.fr),
    badgeAr: pick(t.badge.ar),
  };
}

/** Devine le modèle à partir d'une catégorie libre saisie par le client. */
export function guessTemplate(category?: string | null): TemplateId {
  const c = (category ?? "").toLowerCase();
  if (/voiture|auto|véhicule|vehicule|car|سيار/.test(c)) return "auto";
  if (/immo|maison|villa|terrain|appart|location|عقار|منزل|أرض/.test(c)) return "immo";
  if (/alim|food|restau|cuisine|pâtiss|patiss|boulang|طعام|مطعم|غذ/.test(c)) return "food";
  if (/t[ée]l[ée]phone|phone|mobile|iphone|samsung|smartphone|هاتف|جوال/.test(c)) return "phone";
  return "shop";
}

/** Données fictives pour tester l'atelier rapidement (clairement marquées « exemple »). */
export const SAMPLE_DATA: Record<
  TemplateId,
  { merchantName: string; productName: string; productNameAr: string; price: number; city: string; whatsapp: string; contactLine: string }
> = {
  auto: { merchantName: "Auto Exemple", productName: "Toyota Hilux 2019", productNameAr: "تويوتا هيلوكس 2019", price: 1450000, city: "Nouakchott", whatsapp: "222 00 00 00 01", contactLine: "Tevragh Zeina, près du marché" },
  immo: { merchantName: "Immo Exemple", productName: "Villa 4 chambres", productNameAr: "فيلا 4 غرف", price: 9500000, city: "Nouakchott", whatsapp: "222 00 00 00 02", contactLine: "Visite sur rendez-vous" },
  food: { merchantName: "Pâtisserie Exemple", productName: "Gâteau d'anniversaire", productNameAr: "كعكة عيد ميلاد", price: 1200, city: "Nouadhibou", whatsapp: "222 00 00 00 03", contactLine: "Commande 24 h à l'avance" },
  phone: { merchantName: "Phone Exemple", productName: "Samsung Galaxy A55", productNameAr: "سامسونج غالاكسي A55", price: 14500, city: "Nouakchott", whatsapp: "222 00 00 00 04", contactLine: "Marché Capitale, boutique 12" },
  shop: { merchantName: "Boutique Exemple", productName: "Ensemble de cuisine", productNameAr: "طقم مطبخ", price: 3500, city: "Rosso", whatsapp: "222 00 00 00 05", contactLine: "Livraison possible" },
};

export function formatPrice(price: number | null | undefined, currency = "MRU") {
  if (price == null) return "";
  const n = Math.round(price)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return `${n} ${currency}`;
}

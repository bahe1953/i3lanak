// Données initiales : forfaits (si la table est vide) et compte administrateur.
// Usage : npm run db:seed   (lit DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD dans .env ou l'environnement)
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL manquante.");
  process.exit(1);
}
const client = new pg.Client({ connectionString: url });
await client.connect();

const PACKAGES = [
  {
    nameFr: "Pack Affiche + Diffusion", nameAr: "باقة أفيش + نشر", price: 1000, corrections: 1, sortOrder: 1,
    descFr: "Une affiche professionnelle, un texte publicitaire et une diffusion sur un réseau convenu.",
    descAr: "أفيش احترافي ونص إعلاني ونشر على شبكة واحدة متفق عليها.",
    featuresFr: ["1 affiche professionnelle", "1 texte publicitaire", "1 langue au choix", "Diffusion sur 1 réseau convenu", "1 correction", "Preuve de publication"],
    featuresAr: ["أفيش احترافي واحد", "نص إعلاني واحد", "لغة واحدة", "نشر على شبكة واحدة", "تعديل واحد", "إثبات النشر"],
    networks: ["facebook"], languages: ["fr"],
  },
  {
    nameFr: "Pack Vidéo + Diffusion", nameAr: "باقة فيديو + نشر", price: 2500, corrections: 2, sortOrder: 2,
    descFr: "Une affiche, une vidéo courte, un texte et une diffusion sur deux réseaux.",
    descAr: "أفيش وفيديو قصير ونص ونشر على شبكتين.",
    featuresFr: ["1 affiche", "1 vidéo promotionnelle courte", "1 texte publicitaire", "Diffusion sur 2 réseaux", "Corrections selon devis", "Preuves de publication"],
    featuresAr: ["أفيش واحد", "فيديو ترويجي قصير", "نص إعلاني", "نشر على شبكتين", "تعديلات حسب العرض", "إثباتات النشر"],
    networks: ["facebook", "instagram"], languages: ["fr", "ar"],
  },
  {
    nameFr: "Pack Campagne complète", nameAr: "باقة الحملة الكاملة", price: 5000, corrections: 3, sortOrder: 3,
    descFr: "Plusieurs affiches et vidéos, contenus FR/AR, calendrier de diffusion et rapport.",
    descAr: "عدة أفيشات وفيديوهات، محتوى بالفرنسية والعربية، جدول نشر وتقرير.",
    featuresFr: ["Plusieurs affiches et vidéos", "Contenus FR et AR", "Calendrier de diffusion", "Plusieurs réseaux", "Rapport de campagne"],
    featuresAr: ["عدة أفيشات وفيديوهات", "محتوى بالفرنسية والعربية", "جدول النشر", "عدة شبكات", "تقرير الحملة"],
    networks: ["facebook", "instagram", "tiktok"], languages: ["fr", "ar"],
  },
];

const { rows } = await client.query("select count(*)::int as c from packages");
if (rows[0].c === 0) {
  for (const p of PACKAGES) {
    await client.query(
      `insert into packages (name_fr, name_ar, description_fr, description_ar, price, features_fr, features_ar, networks, languages, corrections, sort_order)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [p.nameFr, p.nameAr, p.descFr, p.descAr, p.price, JSON.stringify(p.featuresFr), JSON.stringify(p.featuresAr),
       JSON.stringify(p.networks), JSON.stringify(p.languages), p.corrections, p.sortOrder],
    );
  }
  console.log(`✓ ${PACKAGES.length} forfaits créés`);
} else {
  console.log("• Forfaits déjà présents, inchangés");
}

const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD;
if (!email || !password) {
  console.log("• ADMIN_EMAIL / ADMIN_PASSWORD non définis : aucun compte admin créé");
} else if (password.length < 12) {
  console.error("✗ ADMIN_PASSWORD doit contenir au moins 12 caractères.");
  process.exitCode = 1;
} else {
  const existing = await client.query("select id, role from users where email = $1", [email]);
  if (existing.rowCount && existing.rows[0].role === "admin") {
    console.log(`• Le compte admin ${email} existe déjà, mot de passe inchangé`);
  } else if (existing.rowCount) {
    // Compte existant non admin (ex. créé via « Inscription ») : il devient admin avec le
    // mot de passe défini dans ADMIN_PASSWORD, et ses sessions ouvertes sont fermées.
    const id = existing.rows[0].id;
    const hash = await bcrypt.hash(password, 12);
    await client.query("update users set role = 'admin', password_hash = $2, updated_at = now() where id = $1", [id, hash]);
    await client.query("delete from sessions where user_id = $1", [id]);
    await client.query(
      "insert into audit_logs (user_id, action, entity_type, entity_id, details) values ($1, 'user.promote_admin', 'user', $1, '{}'::jsonb)",
      [id],
    );
    console.log(`✓ Le compte ${email} est passé administrateur (mot de passe = ADMIN_PASSWORD)`);
  } else {
    const hash = await bcrypt.hash(password, 12);
    await client.query(
      "insert into users (name, email, password_hash, role, locale) values ($1,$2,$3,'admin','fr')",
      ["Admin IT-RIM", email, hash],
    );
    console.log(`✓ Compte administrateur ${email} créé`);
  }
}
await client.end();

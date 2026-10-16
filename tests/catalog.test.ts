import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPrice, guessTemplate, sampleTexts, TEMPLATE_IDS, TEMPLATES } from "../src/lib/poster/catalog.ts";

test("formatPrice : séparateur de milliers et devise", () => {
  assert.equal(formatPrice(1450000, "MRU"), "1 450 000 MRU");
  assert.equal(formatPrice(950, "MRU"), "950 MRU");
  assert.equal(formatPrice(null), "");
});

test("guessTemplate : catégorie libre FR/AR vers modèle", () => {
  assert.equal(guessTemplate("Voiture d'occasion"), "auto");
  assert.equal(guessTemplate("سيارة"), "auto");
  assert.equal(guessTemplate("Terrain à vendre"), "immo");
  assert.equal(guessTemplate("Pâtisserie"), "food");
  assert.equal(guessTemplate("Téléphone"), "phone");
  assert.equal(guessTemplate(""), "shop");
  assert.equal(guessTemplate(null), "shop");
});

test("sampleTexts : toutes les clés remplies pour chaque modèle, et rotation", () => {
  for (const t of TEMPLATE_IDS) {
    const s = sampleTexts(t, "Produit");
    for (const k of ["headlineFr", "headlineAr", "taglineFr", "taglineAr", "ctaFr", "ctaAr", "badgeFr", "badgeAr"] as const) {
      assert.ok(s[k] && s[k]!.length > 0, `${t}.${k}`);
    }
    assert.match(s.taglineAr!, /[؀-ۿ]/, "accroche arabe en écriture arabe");
    const n = TEMPLATES[t].tagline.fr.length;
    assert.equal(sampleTexts(t, "x", n).taglineFr, s.taglineFr, "la rotation boucle");
    assert.notEqual(sampleTexts(t, "x", 1).taglineFr, s.taglineFr);
  }
});

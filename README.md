# I3LANAK — إعلانك · by IT-RIM Mauritanie

Agence publicitaire numérique pour les commerçants mauritaniens.
**Étape 1 : l'atelier de pub** — l'équipe IT-RIM crée les affiches des commerçants,
les exporte en PNG et suit leur statut jusqu'à la publication.

Stack : Next.js 16 · React 19 · TypeScript · Tailwind 4 · PostgreSQL (Drizzle) · Vercel Blob.

---

## Ce qui fonctionne

| Fonction | État |
|---|---|
| Atelier : fiche commerçant + produit, photos, logo | ✅ testé |
| 5 modèles (Voitures, Immobilier, Alimentation, Téléphones, Commerce) | ✅ testé |
| Formats publication 1080×1080 et story 1080×1920 | ✅ testé |
| Textes FR, AR (droite à gauche) ou les deux | ✅ testé |
| Export PNG haute qualité (dans le navigateur) | ✅ testé |
| Textes d'exemple par secteur (sans IA) + « Autre proposition » | ✅ testé |
| Rédaction par IA (OpenAI) | ⚙️ code prêt, **non testé** : nécessite `OPENAI_API_KEY` |
| Statuts Brouillon → Envoyée → Validée → Publiée (lien obligatoire) | ✅ testé |
| Liste, recherche par commerçant/produit, filtre de statut | ✅ testé |
| Créer une affiche depuis une commande client | ✅ testé |
| Connexion, rôles client / opérateur / admin, protection serveur | ✅ testé |
| Fichiers privés (Vercel Blob en accès privé, servis après contrôle) | ✅ testé en local ; Blob réel à vérifier au 1er déploiement |
| Vidéo, publication automatique sur les réseaux, paiement en ligne | ❌ prévu dans les étapes suivantes |

---

## Déployer sur Vercel (offres gratuites)

1. **Mettre le code sur GitHub** (dépôt privé), puis sur vercel.com : *Add New → Project* et importer le dépôt.
   Framework détecté : Next.js. Ne rien changer, **ne pas encore déployer** si on vous le propose, ou laisser échouer le 1er déploiement.
2. **Base de données** : dans le projet Vercel, onglet *Storage → Create Database → Neon (Postgres)*, offre gratuite,
   région la plus proche (Europe). Vercel ajoute automatiquement `DATABASE_URL`.
3. **Stockage des fichiers** : *Storage → Create → Blob*. Si Vercel propose un type d'accès, choisir **Private**
   (le code enregistre chaque fichier en accès privé). Vercel ajoute automatiquement `BLOB_READ_WRITE_TOKEN`.
   Après le 1er déploiement, envoyez une photo dans l'atelier pour vérifier que le stockage répond.
4. **Variables d'environnement** (*Settings → Environment Variables*) :
   - `ADMIN_EMAIL` et `ADMIN_PASSWORD` (12 caractères minimum)
   - `NEXT_PUBLIC_WHATSAPP_NUMBER` (ex. `22212345678`)
   - optionnel : `OPENAI_API_KEY`
5. **Déployer** (*Deployments → Redeploy*). Le script `vercel-build` applique automatiquement
   les migrations, crée les 3 forfaits et le compte admin (s'ils n'existent pas encore), puis construit le site.
   Un mot de passe admin de moins de 12 caractères fait échouer le déploiement avec un message clair.
6. Les redéploiements suivants ne modifient ni les forfaits ni le mot de passe admin existants.
7. **Créer les opérateurs** :
   ```bash
   npm run user:create -- --email ali@it-rim.net --name "Ali" --role operator --password "un-mot-de-passe-long"
   ```
8. Se connecter sur `https://<votre-projet>.vercel.app/login` → l'équipe arrive directement dans l'atelier.

> Le site doit être ouvert **directement** (son adresse Vercel ou votre domaine), pas dans une fenêtre
> intégrée d'un autre site : c'était la cause de l'erreur « Unauthorized » dans l'aperçu Arena.

---

## Développement local

```bash
cp .env.example .env          # puis renseigner DATABASE_URL (PostgreSQL local)
npm install
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
```
Sans `BLOB_READ_WRITE_TOKEN`, les fichiers sont stockés dans `.data/uploads` (privé, hors de `public/`).

## Commandes

| Commande | Rôle |
|---|---|
| `npm run dev` / `build` / `start` | développement / build / production |
| `npm run db:generate` | créer une migration après modification de `src/db/schema.ts` |
| `npm run db:migrate` | appliquer les migrations |
| `npm run db:seed` | forfaits + compte admin (sans écraser l'existant) |
| `npm run user:create` | créer un opérateur ou un admin |
| `npm run typecheck` · `lint` · `test` | vérifications |

## Sécurité (résumé)

- Mots de passe hachés (bcrypt), sessions en base, cookie `httpOnly`.
- Pas de compte admin par défaut : il est créé uniquement à partir des variables d'environnement.
- Pages de l'atelier, des commandes et de l'administration protégées **côté serveur**.
- Validation de toutes les entrées (zod) ; les fichiers sont vérifiés par leur contenu (JPEG/PNG/WebP, 4 Mo max).
- Fichiers privés : un client n'accède qu'à ses propres fichiers.
- Seul un administrateur valide un paiement ; journal d'audit des opérations sensibles.
- Limitation des tentatives de connexion, des envois de fichiers et des appels IA.

## Limites connues

- Vercel limite chaque requête à 4,5 Mo : les photos sont redimensionnées dans le navigateur avant l'envoi,
  et l'image finale enregistrée est un JPEG de qualité 92 (le téléchargement direct, lui, est en PNG).
- L'affiche utilise la photo principale (la première) ; les autres photos restent dans la fiche.
- Offre gratuite Neon : la base se met en veille après inactivité (premier chargement un peu plus lent).
- Les pages Conditions et Confidentialité contiennent un texte provisoire à faire rédiger.
- Sauvegardes : Neon garde un historique de restauration limité sur l'offre gratuite ; pour une copie,
  `pg_dump "$DATABASE_URL" > sauvegarde.sql` (restauration : `psql "$DATABASE_URL" < sauvegarde.sql`).

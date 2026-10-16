// Crée un membre de l'équipe IT-RIM (opérateur ou admin).
// Usage : npm run user:create -- --email ali@it-rim.net --name "Ali" --role operator --password "mot-de-passe-long"
import "dotenv/config";
import pg from "pg";
import bcrypt from "bcryptjs";

const args = Object.fromEntries(
  process.argv.slice(2).join(" ").split("--").filter(Boolean).map((a) => {
    const [k, ...v] = a.trim().split(" ");
    return [k, v.join(" ").replace(/^"|"$/g, "")];
  }),
);
const { email, name, role = "operator", password } = args;
if (!email || !name || !password) {
  console.error('Usage : npm run user:create -- --email x@y.mr --name "Nom" --role operator|admin --password "..."');
  process.exit(1);
}
if (!["operator", "admin"].includes(role)) { console.error("role : operator ou admin"); process.exit(1); }
if (password.length < 12) { console.error("Le mot de passe doit contenir au moins 12 caractères."); process.exit(1); }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const hash = await bcrypt.hash(password, 12);
const res = await client.query(
  `insert into users (name, email, password_hash, role) values ($1, $2, $3, $4)
   on conflict (email) do nothing returning id`,
  [name, email.trim().toLowerCase(), hash, role],
);
console.log(res.rowCount ? `✓ ${role} ${email} créé` : `• ${email} existe déjà, rien modifié`);
await client.end();

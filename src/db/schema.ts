import {
  pgTable,
  uuid,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["client", "operator", "admin"]);
export const planEnum = pgEnum("plan", ["free", "starter", "pro", "enterprise"]);
export const localeEnum = pgEnum("locale", ["fr", "ar"]);
export const orderStatusEnum = pgEnum("order_status", [
  "draft",
  "quote_sent",
  "awaiting_payment",
  "payment_to_verify",
  "paid",
  "in_production",
  "awaiting_client_validation",
  "ready_to_publish",
  "publishing",
  "completed",
  "delivered",
  "cancelled",
]);
export const paymentStatusEnum = pgEnum("payment_status", ["unpaid", "pending_verification", "paid", "refunded", "rejected"]);
export const paymentMethodEnum = pgEnum("payment_method", ["bankily", "masrvi", "sedad", "cash", "other"]);
export const renderStatusEnum = pgEnum("render_status", ["queued", "rendering", "done", "failed"]);
export const transactionTypeEnum = pgEnum("transaction_type", [
  "signup_bonus",
  "plan_upgrade",
  "credit_purchase",
  "render_usage",
  "refund",
]);
export const publicationStatusEnum = pgEnum("publication_status", ["planned", "published", "failed", "cancelled"]);
export const posterStatusEnum = pgEnum("poster_status", ["draft", "sent", "validated", "published"]);
export const documentTypeEnum = pgEnum("document_type", ["quote", "invoice", "receipt", "report"]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  phone: varchar("phone", { length: 40 }),
  company: varchar("company", { length: 160 }),
  role: roleEnum("role").notNull().default("client"),
  locale: localeEnum("locale").notNull().default("fr"),
  plan: planEnum("plan").notNull().default("free"),
  credits: integer("credits").notNull().default(10),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templates = pgTable("templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameFr: varchar("name_fr", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }),
  descriptionFr: text("description_fr"),
  descriptionAr: text("description_ar"),
  category: varchar("category", { length: 60 }).notNull().default("promo"),
  thumbnail: text("thumbnail"),
  defaultConfig: jsonb("default_config").notNull().default({}),
  isPremium: boolean("is_premium").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const packages = pgTable("packages", {
  id: uuid("id").defaultRandom().primaryKey(),
  nameFr: varchar("name_fr", { length: 120 }).notNull(),
  nameAr: varchar("name_ar", { length: 120 }),
  descFr: text("description_fr"),
  descAr: text("description_ar"),
  price: integer("price").notNull().default(0), // in MRU (whole units)
  currency: varchar("currency", { length: 8 }).notNull().default("MRU"),
  featuresFr: jsonb("features_fr").notNull().default([]),
  featuresAr: jsonb("features_ar").notNull().default([]),
  networks: jsonb("networks").notNull().default([]), // included networks
  languages: jsonb("languages").notNull().default([]), // fr, ar, both
  corrections: integer("corrections").notNull().default(1),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 160 }).notNull(),
  templateId: uuid("template_id").references(() => templates.id, { onDelete: "set null" }),
  config: jsonb("config").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const renders = pgTable("renders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  projectId: uuid("project_id").references(() => projects.id, { onDelete: "set null" }),
  title: varchar("title", { length: 160 }).notNull(),
  filePath: text("file_path").notNull(),
  format: varchar("format", { length: 20 }).notNull().default("webm"),
  duration: integer("duration").notNull().default(0),
  status: renderStatusEnum("status").notNull().default("done"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  type: transactionTypeEnum("type").notNull(),
  amountCents: integer("amount_cents").notNull().default(0),
  credits: integer("credits").notNull().default(0),
  description: text("description"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  packageId: uuid("package_id").references(() => packages.id, { onDelete: "set null" }),
  merchantName: varchar("merchant_name", { length: 160 }).notNull(),
  productName: varchar("product_name", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }),
  description: text("description"),
  sellingPrice: integer("selling_price"),
  currency: varchar("currency", { length: 8 }).default("MRU"),
  adLanguage: varchar("ad_language", { length: 10 }).notNull().default("fr"), // fr, ar, both
  targetCity: varchar("target_city", { length: 120 }),
  whatsapp: varchar("whatsapp", { length: 40 }),
  contactInfo: text("contact_info"),
  networks: jsonb("networks").notNull().default([]),
  objective: text("objective"),
  instructions: text("instructions"),
  status: orderStatusEnum("status").notNull().default("draft"),
  paymentStatus: paymentStatusEnum("payment_status").notNull().default("unpaid"),
  paymentMethod: paymentMethodEnum("payment_method"),
  paymentReference: varchar("payment_reference", { length: 120 }),
  paymentProofPath: text("payment_proof_path"),
  quotedPrice: integer("quoted_price"),
  finalPrice: integer("final_price"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderFiles = pgTable("order_files", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  kind: varchar("kind", { length: 40 }).notNull().default("photo"), // photo, logo
  filePath: text("file_path").notNull(),
  originalName: varchar("original_name", { length: 255 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const orderCosts = pgTable("order_costs", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" })
    .unique(),
  designCost: integer("design_cost").notNull().default(0),
  videoCost: integer("video_cost").notNull().default(0),
  voiceoverCost: integer("voiceover_cost").notNull().default(0),
  externalCost: integer("external_cost").notNull().default(0),
  diffusionCost: integer("diffusion_cost").notNull().default(0),
  sponsoredBudget: integer("sponsored_budget").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  estimatedWorkHours: integer("estimated_work_hours").notNull().default(0),
  actualWorkHours: integer("actual_work_hours").notNull().default(0),
  totalEstimatedCost: integer("total_estimated_cost").notNull().default(0),
  totalActualCost: integer("total_actual_cost").notNull().default(0),
  grossMarginEstimated: integer("gross_margin_estimated").notNull().default(0),
  grossMarginActual: integer("gross_margin_actual").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const publications = pgTable("publications", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  network: varchar("network", { length: 40 }).notNull(),
  plannedDate: timestamp("planned_date", { withTimezone: true }),
  actualDate: timestamp("actual_date", { withTimezone: true }),
  url: text("url"),
  proofPath: text("proof_path"),
  status: publicationStatusEnum("status").notNull().default("planned"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const documents = pgTable("documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  type: documentTypeEnum("type").notNull(),
  number: varchar("number", { length: 60 }),
  amount: integer("amount").notNull().default(0),
  filePath: text("file_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable("messages", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  authorRole: varchar("author_role", { length: 20 }).notNull().default("client"),
  body: text("body").notNull(),
  attachmentPath: text("attachment_path"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
  action: varchar("action", { length: 120 }).notNull(),
  entityType: varchar("entity_type", { length: 60 }),
  entityId: uuid("entity_id"),
  details: jsonb("details").default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// Atelier de pub : une affiche = un commerçant + un produit + un modèle.
export const posters = pgTable("posters", {
  id: uuid("id").defaultRandom().primaryKey(),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  orderId: uuid("order_id").references(() => orders.id, { onDelete: "set null" }),
  // Commerçant
  merchantName: varchar("merchant_name", { length: 160 }).notNull().default(""),
  whatsapp: varchar("whatsapp", { length: 40 }),
  city: varchar("city", { length: 120 }),
  contactLine: varchar("contact_line", { length: 200 }),
  logoKey: text("logo_key"),
  // Produit
  productName: varchar("product_name", { length: 160 }).notNull().default(""),
  description: text("description"),
  price: integer("price"),
  currency: varchar("currency", { length: 8 }).notNull().default("MRU"),
  photoKeys: jsonb("photo_keys").$type<string[]>().notNull().default([]),
  // Mise en page
  template: varchar("template", { length: 20 }).notNull().default("shop"),
  format: varchar("format", { length: 10 }).notNull().default("square"),
  language: varchar("language", { length: 10 }).notNull().default("fr"),
  texts: jsonb("texts").$type<Record<string, string>>().notNull().default({}),
  // Résultat et suivi
  imageKey: text("image_key"),
  status: posterStatusEnum("status").notNull().default("draft"),
  publicationUrl: text("publication_url"),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  validatedAt: timestamp("validated_at", { withTimezone: true }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

// Compteurs anti-abus (connexion, envois) : fonctionne aussi en serverless.
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
});

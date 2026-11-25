// server/_core/index.ts
import "dotenv/config";
import express2 from "express";
import { createServer } from "http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// shared/const.ts
var COOKIE_NAME = "webdev_app_session";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var AXIOS_TIMEOUT_MS = 3e4;
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";
var OAUTH_STATE_COOKIE = "__Host-oauth_state";
var decodeOAuthState = (state) => {
  let decoded;
  try {
    decoded = atob(state);
  } catch {
    return { redirectUri: "" };
  }
  try {
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed.redirectUri === "string") return parsed;
  } catch {
  }
  return { redirectUri: decoded };
};

// server/_core/oauth.ts
import { parse as parseCookieHeader2 } from "cookie";

// server/db.ts
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";

// drizzle/schema.ts
import { int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";
var users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull()
});
var products = mysqlTable("products", {
  slug: varchar("slug", { length: 128 }).primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  brand: varchar("brand", { length: 120 }).notNull(),
  gender: mysqlEnum("gender", ["men", "women"]).default("women").notNull(),
  description: text("description").notNull(),
  image: varchar("image", { length: 1e3 }).notNull(),
  price: int("price").notNull(),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});
var orders = mysqlTable("orders", {
  id: varchar("id", { length: 64 }).primaryKey(),
  customerName: varchar("customerName", { length: 180 }).notNull(),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  customerPhone: varchar("customerPhone", { length: 40 }).notNull(),
  address: varchar("address", { length: 1e3 }).notNull(),
  countryCode: varchar("countryCode", { length: 2 }).default("UA").notNull(),
  shippingMethod: mysqlEnum("shippingMethod", ["nova_poshta", "ukrposhta"]).notNull(),
  paymentMethod: mysqlEnum("paymentMethod", ["liqpay"]).default("liqpay").notNull(),
  paymentStatus: varchar("paymentStatus", { length: 64 }).default("pending").notNull(),
  status: mysqlEnum("status", ["pending_payment", "processing", "shipped", "cancelled"]).default("pending_payment").notNull(),
  currency: varchar("currency", { length: 3 }).default("UAH").notNull(),
  total: int("total").notNull(),
  items: json("items").$type().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull()
});

// shared/catalog.ts
var seedProducts = [
  { slug: "chanel-no5", name: "Chanel No. 5", brand: "Chanel", description: "A timeless floral-aldehydic composition, balancing bright citrus with soft rose, jasmine and a warm, powdery finish.", image: "/perfumes/chanel-no5.webp", price: 6500, gender: "women" },
  { slug: "aventus", name: "Aventus", brand: "Creed", description: "Fresh fruit and crisp woods lead into a confident, smoky blend with a smooth and enduring trail.", image: "/perfumes/aventus.webp", price: 12400, gender: "men" },
  { slug: "baccarat-rouge-540", name: "Baccarat Rouge 540", brand: "Francis Kurkdjian", description: "Airy saffron and luminous amberwood create a radiant, softly sweet signature with remarkable presence.", image: "/perfumes/baccarat-rouge-540.webp", price: 10600, gender: "women" },
  { slug: "black-orchid", name: "Black Orchid", brand: "Tom Ford", description: "A dark, opulent floral accord with rich spice, velvety petals and a deep, earthy base.", image: "/perfumes/black-orchid.webp", price: 7100, gender: "women" },
  { slug: "sauvage", name: "Sauvage", brand: "Dior", description: "Bracing bergamot and aromatic freshness meet mineral woods for a crisp, modern foug\xE8re character.", image: "/perfumes/sauvage.webp", price: 5400, gender: "men" },
  { slug: "jadore", name: "J\u2019adore", brand: "Dior", description: "A golden bouquet of ylang-ylang, rose and jasmine, polished into an elegant and radiant floral.", image: "/perfumes/jadore.webp", price: 6e3, gender: "women" },
  { slug: "flowerbomb", name: "Flowerbomb", brand: "Viktor&Rolf", description: "A generous floral explosion of jasmine and rose, softened by warm patchouli and a sweet, enveloping base.", image: "/perfumes/flowerbomb.webp", price: 5800, gender: "women" },
  { slug: "la-vie-est-belle", name: "La Vie Est Belle", brand: "Lanc\xF4me", description: "Iris and delicate florals unfold over a comforting gourmand accord of vanilla, praline and woods.", image: "/perfumes/la-vie-est-belle.webp", price: 5200, gender: "women" },
  { slug: "terre-dhermes", name: "Terre d\u2019Herm\xE8s", brand: "Herm\xE8s", description: "Bright orange and pepper meet dry cedar and mineral notes in a grounded, quietly distinctive woody scent.", image: "/perfumes/terre-dhermes.webp", price: 5800, gender: "men" },
  { slug: "shalimar", name: "Shalimar", brand: "Guerlain", description: "A legendary amber composition, where sparkling citrus gives way to smoky vanilla, incense and soft leather.", image: "/perfumes/shalimar.webp", price: 6200, gender: "women" },
  { slug: "black-opium", name: "Black Opium", brand: "Yves Saint Laurent", description: "Bright coffee and white flowers combine with vanilla for a vibrant, warm and addictive evening scent.", image: "/perfumes/black-opium.webp", price: 5600, gender: "women" },
  { slug: "libre", name: "Libre", brand: "Yves Saint Laurent", description: "Lavender and orange blossom meet a smooth vanilla warmth in a confident contrast of aromatic and floral notes.", image: "/perfumes/libre.webp", price: 5700, gender: "women" },
  { slug: "mitsouko", name: "Mitsouko", brand: "Guerlain", description: "A warm chypre composition with peach, spice and mossy woods, carrying a quietly mysterious vintage character.", image: "/perfumes/mitsouko.png", price: 0, gender: "women" },
  { slug: "habanita", name: "Habanita", brand: "Molinard", description: "A rich, powdery floral-woody fragrance with soft vanilla, florals and a deep, elegant trail.", image: "/perfumes/habanita.png", price: 0, gender: "women" },
  { slug: "luxoria", name: "Luxoria", brand: "Luxoria", description: "A luminous amber-woody composition with warm resins, polished woods and a darkly opulent finish.", image: "/perfumes/luxoria.jfif", price: 0, gender: "women" },
  { slug: "velixir", name: "Velixir", brand: "Velixir", description: "A cool, radiant composition of clean woods and mineral freshness with a smooth, modern signature.", image: "/perfumes/velixir.jfif", price: 0, gender: "women" },
  { slug: "angel", name: "Angel", brand: "Mugler", description: "A bold gourmand trail of praline, red fruits, vanilla and patchouli with a lasting, radiant character.", image: "/perfumes/angel.webp", price: 0, gender: "women" },
  { slug: "black-orchid-parfum", name: "Black Orchid Parfum", brand: "Tom Ford", description: "A dark, opulent floral-amber composition with rum, orchid, spice and a deep woody base.", image: "/perfumes/black-orchid-parfum.webp", price: 0, gender: "women" },
  { slug: "bleu-de-chanel", name: "Bleu de Chanel", brand: "Chanel", description: "A fresh aromatic-woody composition with citrus, incense, cedar and a clean, confident trail.", image: "/perfumes/bleu-de-chanel.webp", price: 0, gender: "men" },
  { slug: "daisy", name: "Daisy", brand: "Marc Jacobs", description: "A bright floral scent with soft violet, wild strawberry and jasmine over a gentle, airy base.", image: "/perfumes/daisy.webp", price: 0, gender: "women" },
  { slug: "fabulous", name: "Fabulous", brand: "Tom Ford", description: "A rich leather-amber composition with bitter almond, cashmere, tonka bean and warm woods.", image: "/perfumes/fabulous.webp", price: 0, gender: "men" },
  { slug: "for-her", name: "For Her", brand: "Narciso Rodriguez", description: "A refined musk-led floral with rose, peach and soft woods, elegant and quietly sensual.", image: "/perfumes/for-her.webp", price: 0, gender: "women" },
  { slug: "good-girl", name: "Good Girl", brand: "Carolina Herrera", description: "A luminous floral gourmand blending jasmine, almond, coffee and tonka over a warm cocoa finish.", image: "/perfumes/good-girl.webp", price: 0, gender: "women" },
  { slug: "hypnotic-poison", name: "Hypnotic Poison", brand: "Dior", description: "A captivating vanilla-amber fragrance with almond, jasmine and a smooth, enveloping woody base.", image: "/perfumes/hypnotic-poison.webp", price: 0, gender: "women" },
  { slug: "le-male", name: "Le Male", brand: "Jean Paul Gaultier", description: "A classic aromatic foug\xE8re built around lavender, mint, vanilla and warm woods.", image: "/perfumes/le-male.webp", price: 0, gender: "men" },
  { slug: "lost-cherry", name: "Lost Cherry", brand: "Tom Ford", description: "A vivid cherry-amber composition with cherry liqueur, bitter almond, rose and roasted tonka.", image: "/perfumes/lost-cherry.webp", price: 0, gender: "women" },
  { slug: "opium", name: "Opium", brand: "Yves Saint Laurent", description: "A warm spicy-amber fragrance with citrus, incense, florals and a rich, sensual finish.", image: "/perfumes/opium.webp", price: 0, gender: "women" }
];
var seedCatalogProducts = seedProducts.map((product) => ({ ...product, active: 1 }));

// server/_core/env.ts
var ENV = {
  get appId() {
    return process.env.MANUS_PROJECT_ID ?? "";
  },
  get cookieSecret() {
    return process.env.MANUS_JWT_SECRET ?? "";
  },
  get databaseUrl() {
    return process.env.DATABASE_URL ?? "";
  },
  get oAuthServerUrl() {
    return process.env.MANUS_OAUTH_API_URL ?? "";
  },
  // Preserve the legacy hint when supplied; otherwise roles remain application data.
  get ownerOpenId() {
    return process.env.OWNER_OPEN_ID ?? "";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
  get forgeApiUrl() {
    return process.env.MANUS_API_URL ?? "";
  },
  get forgeApiKey() {
    return process.env.MANUS_API_KEY ?? "";
  }
};

// server/db.ts
var _db = null;
var seedTask = null;
async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}
async function upsertUser(user) {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const values = { openId: user.openId };
  const updateSet = {};
  for (const field of ["name", "email", "loginMethod"]) {
    if (user[field] !== void 0) {
      const value = user[field] ?? null;
      values[field] = value;
      updateSet[field] = value;
    }
  }
  if (user.lastSignedIn !== void 0) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  } else {
    values.lastSignedIn = /* @__PURE__ */ new Date();
  }
  if (user.role !== void 0) {
    values.role = user.role;
    updateSet.role = user.role;
  }
  const configuredAdminEmail = (process.env.NUIT_ADMIN_EMAIL ?? "").trim().toLowerCase();
  if (user.openId === ENV.ownerOpenId || configuredAdminEmail && user.email?.trim().toLowerCase() === configuredAdminEmail) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = /* @__PURE__ */ new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
async function getUserByOpenId(openId) {
  const db = await getDb();
  if (!db) return void 0;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}
async function ensureSeedProducts() {
  if (!seedTask) {
    seedTask = (async () => {
      const db = await getDb();
      if (!db) return;
      const first = await db.select({ slug: products.slug }).from(products).limit(1);
      if (first.length > 0) return;
      await db.insert(products).values(seedProducts.map((product) => ({ ...product, active: 1 })));
    })().catch((error) => {
      seedTask = null;
      throw error;
    });
  }
  await seedTask;
}
async function listProducts(activeOnly = true) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await ensureSeedProducts();
  return activeOnly ? db.select().from(products).where(eq(products.active, 1)).orderBy(products.name) : db.select().from(products).orderBy(products.name);
}
async function saveProduct(product, originalSlug) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  if (originalSlug && originalSlug !== product.slug) {
    await db.update(products).set({
      slug: product.slug,
      name: product.name,
      brand: product.brand,
      gender: product.gender,
      description: product.description,
      image: product.image,
      price: product.price,
      active: product.active,
      updatedAt: /* @__PURE__ */ new Date()
    }).where(eq(products.slug, originalSlug));
    return;
  }
  await db.insert(products).values(product).onDuplicateKeyUpdate({ set: {
    name: product.name,
    brand: product.brand,
    gender: product.gender,
    description: product.description,
    image: product.image,
    price: product.price,
    active: product.active,
    updatedAt: /* @__PURE__ */ new Date()
  } });
}
async function createOrder(order) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.insert(orders).values(order);
}
async function getOrder(id) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  return order;
}
async function listOrders() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db.select().from(orders).orderBy(desc(orders.createdAt)).limit(500);
}
async function updateOrderStatus(id, status) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(orders).set({ status, updatedAt: /* @__PURE__ */ new Date() }).where(eq(orders.id, id));
}
async function updateLiqPayStatus(id, status, paid) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [current] = await db.select({ paymentStatus: orders.paymentStatus, status: orders.status }).from(orders).where(eq(orders.id, id)).limit(1);
  if (!current || current.paymentStatus === "success" && !paid) return;
  await db.update(orders).set({
    paymentStatus: status.slice(0, 64),
    ...paid && current.status === "pending_payment" ? { status: "processing" } : {},
    updatedAt: /* @__PURE__ */ new Date()
  }).where(eq(orders.id, id));
}
async function checkOrderAmount(id, amount, currency) {
  const db = await getDb();
  if (!db) return false;
  const [order] = await db.select({ total: orders.total, currency: orders.currency }).from(orders).where(and(eq(orders.id, id), eq(orders.currency, currency))).limit(1);
  return !!order && order.total === amount;
}

// server/_core/cookies.ts
function getSessionCookieOptions(_req) {
  return { httpOnly: true, path: "/", sameSite: "none", secure: true };
}

// shared/_core/errors.ts
var HttpError = class extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.name = "HttpError";
  }
};
var ForbiddenError = (msg) => new HttpError(403, msg);

// server/_core/sdk.ts
import axios from "axios";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
var isNonEmptyString = (value) => typeof value === "string" && value.length > 0;
var EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
var GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
var GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;
var OAuthService = class {
  constructor(client) {
    this.client = client;
    console.log("[OAuth] Initialized with baseURL:", ENV.oAuthServerUrl);
    if (!ENV.oAuthServerUrl) {
      console.error(
        "[OAuth] ERROR: MANUS_OAUTH_API_URL is not configured! Set MANUS_OAUTH_API_URL environment variable."
      );
    }
  }
  decodeState(state) {
    return decodeOAuthState(state).redirectUri;
  }
  async getTokenByCode(code, state) {
    const payload = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state)
    };
    const { data } = await this.client.post(
      EXCHANGE_TOKEN_PATH,
      payload
    );
    return data;
  }
  async getUserInfoByToken(token) {
    const { data } = await this.client.post(
      GET_USER_INFO_PATH,
      {
        accessToken: token.accessToken
      }
    );
    return data;
  }
};
var createOAuthHttpClient = () => axios.create({
  baseURL: ENV.oAuthServerUrl,
  timeout: AXIOS_TIMEOUT_MS
});
var SDKServer = class {
  client;
  oauthService;
  constructor(client = createOAuthHttpClient()) {
    this.client = client;
    this.oauthService = new OAuthService(this.client);
  }
  deriveLoginMethod(platforms, fallback) {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set(
      platforms.filter((p) => typeof p === "string")
    );
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE"))
      return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }
  /**
   * Exchange OAuth authorization code for access token
   * @example
   * const tokenResponse = await sdk.exchangeCodeForToken(code, state);
   */
  async exchangeCodeForToken(code, state) {
    return this.oauthService.getTokenByCode(code, state);
  }
  /**
   * Get user information using access token
   * @example
   * const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
   */
  async getUserInfo(accessToken) {
    const data = await this.oauthService.getUserInfoByToken({
      accessToken
    });
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  parseCookies(cookieHeader) {
    if (!cookieHeader) {
      return /* @__PURE__ */ new Map();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }
  getSessionSecret() {
    const secret = ENV.cookieSecret;
    if (!secret) throw new Error("MANUS_JWT_SECRET is unavailable");
    return new TextEncoder().encode(secret);
  }
  /**
   * Create a session token for a Manus user openId
   * @example
   * const sessionToken = await sdk.createSessionToken(userInfo.openId);
   */
  async createSessionToken(openId, options = {}) {
    return this.signSession(
      {
        openId,
        appId: ENV.appId,
        name: options.name || ""
      },
      options
    );
  }
  async signSession(payload, options = {}) {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1e3);
    const secretKey = this.getSessionSecret();
    return new SignJWT({
      openId: payload.openId,
      appId: payload.appId,
      name: payload.name
    }).setProtectedHeader({ alg: "HS256", typ: "JWT" }).setExpirationTime(expirationSeconds).sign(secretKey);
  }
  async verifySession(cookieValue) {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }
    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"]
      });
      const { openId, appId, name } = payload;
      if (!isNonEmptyString(openId) || (!isNonEmptyString(appId) || appId !== ENV.appId) || typeof name !== "string") {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }
      return {
        openId,
        appId,
        name
      };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }
  async getUserInfoWithJwt(jwtToken) {
    const payload = {
      jwtToken,
      projectId: ENV.appId
    };
    const { data } = await this.client.post(
      GET_USER_INFO_WITH_JWT_PATH,
      payload
    );
    const loginMethod = this.deriveLoginMethod(
      data?.platforms,
      data?.platform ?? data.platform ?? null
    );
    return {
      ...data,
      platform: loginMethod,
      loginMethod
    };
  }
  async authenticateRequest(req) {
    const cookies = this.parseCookies(req.headers.cookie);
    let sessionToken = cookies.get(COOKIE_NAME);
    if (!sessionToken && req.path.startsWith("/api/scheduled/")) {
      const ticket = cookies.get("app_session_id");
      const identity = await this.verifySession(ticket);
      if (identity?.openId.startsWith(CRON_OPEN_ID_PREFIX)) sessionToken = ticket;
    }
    if (!sessionToken) {
      const authHeader = req.headers.authorization;
      if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }
    const session = await this.verifySession(sessionToken);
    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }
    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }
    const sessionUserId = session.openId;
    const signedInAt = /* @__PURE__ */ new Date();
    let user = await getUserByOpenId(sessionUserId);
    if (!user) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt
        });
        user = await getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }
    if (!user) {
      throw ForbiddenError("User not found");
    }
    await upsertUser({
      openId: user.openId,
      lastSignedIn: signedInAt
    });
    return user;
  }
};
var CRON_OPEN_ID_PREFIX = "cron_";
function buildCronUser(userInfo) {
  const now = /* @__PURE__ */ new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Manus Scheduled Task",
    email: null,
    loginMethod: null,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? void 0,
    isCron: true
  };
}
var sdk = new SDKServer();

// server/_core/oauth.ts
function getQueryParam(req, key) {
  const value = req.query[key];
  return typeof value === "string" ? value : void 0;
}
function registerOAuthRoutes(app) {
  app.get("/api/oauth/callback", async (req, res) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");
    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }
    const { nonce } = decodeOAuthState(state);
    const expectedNonce = parseCookieHeader2(req.headers.cookie ?? "")[OAUTH_STATE_COOKIE];
    if (!nonce || nonce !== expectedNonce) {
      res.status(403).json({ error: "invalid oauth state" });
      return;
    }
    res.clearCookie(OAUTH_STATE_COOKIE, { path: "/", secure: true, sameSite: "none" });
    try {
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      if (!userInfo.openId) {
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }
      await upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: /* @__PURE__ */ new Date()
      });
      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS
      });
      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error instanceof Error ? error.message : "unknown error");
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}

// server/_core/publicConfig.ts
function publicPlatformConfig(env = process.env) {
  return {
    projectId: env.MANUS_PROJECT_ID ?? "",
    oauthPortalUrl: env.MANUS_OAUTH_PORTAL_URL ?? "",
    apiUrl: env.MANUS_API_URL ?? "",
    apiBrowserKey: env.MANUS_API_BROWSER_KEY ?? ""
  };
}
function publicPlatformScript(env = process.env) {
  const json2 = JSON.stringify(publicPlatformConfig(env)).replaceAll("<", "\\u003c");
  return `window.__MANUS_CONFIG__=${json2};`;
}

// server/routers.ts
import { randomUUID } from "node:crypto";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var publicProcedure = t.procedure;
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/liqpay.ts
import { createHash, timingSafeEqual } from "node:crypto";
var CHECKOUT_URL = "https://www.liqpay.ua/api/3/checkout";
var DEFAULT_PREVIEW_ORIGIN = "https://8328-ihh6yk5571mj7rnl89mc9-d5cf9a5a.us3.manus.computer";
var isTestKey = (value) => Boolean(value?.trim().startsWith("sandbox_"));
var configured = () => isTestKey(process.env.LIQPAY_PUBLIC_KEY) && isTestKey(process.env.LIQPAY_PRIVATE_KEY);
var publicOrigin = () => (process.env.NUIT_PUBLIC_URL || DEFAULT_PREVIEW_ORIGIN).trim().replace(/\/+$/, "");
function signatureFor(data, privateKey, algorithm = "sha3-256") {
  return createHash(algorithm).update(`${privateKey}${data}${privateKey}`, "utf8").digest("base64");
}
function liqpayReadiness() {
  return {
    configured: configured(),
    callbackConfigured: Boolean(publicOrigin()),
    testMode: true
  };
}
function createLiqPayCheckout(input) {
  const publicKey = process.env.LIQPAY_PUBLIC_KEY?.trim();
  const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim();
  const origin = publicOrigin();
  if (!publicKey || !privateKey || !isTestKey(publicKey) || !isTestKey(privateKey) || !origin) return null;
  const payload = {
    public_key: publicKey,
    version: 7,
    action: "pay",
    amount: input.amount.toFixed(2),
    currency: "UAH",
    description: input.description.slice(0, 255),
    order_id: input.orderId,
    language: "uk",
    server_url: `${origin}/api/liqpay/callback`,
    result_url: `${origin}/checkout/result?order=${encodeURIComponent(input.orderId)}`
  };
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
  return { url: CHECKOUT_URL, data, signature: signatureFor(data, privateKey) };
}
function verifyLiqPayCallback(data, signature) {
  const privateKey = process.env.LIQPAY_PRIVATE_KEY?.trim();
  if (!privateKey || !isTestKey(privateKey) || !data || !signature) return null;
  const received = Buffer.from(signature);
  const valid = ["sha3-256", "sha1"].some((algorithm) => {
    const expected = Buffer.from(signatureFor(data, privateKey, algorithm));
    return expected.length === received.length && timingSafeEqual(expected, received);
  });
  if (!valid) return null;
  try {
    const parsed = JSON.parse(Buffer.from(data, "base64").toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}
function liqpayPublicKeyMatches(value) {
  return typeof value === "string" && value === process.env.LIQPAY_PUBLIC_KEY?.trim();
}

// server/routers.ts
import { z } from "zod";

// server/supabase.ts
import { createClient } from "@supabase/supabase-js";
var supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
var supabaseAnonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
var supabaseServer = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
}) : null;

// server/routers.ts
var productInput = z.object({
  slug: z.string().trim().min(2).max(128).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  name: z.string().trim().min(2).max(180),
  brand: z.string().trim().min(1).max(120),
  gender: z.enum(["men", "women"]),
  description: z.string().trim().min(5).max(2e3),
  image: z.string().trim().min(1).max(1e3).refine((value) => value.startsWith("/perfumes/") || /^https:\/\//i.test(value), "Use a local product image or HTTPS image URL"),
  price: z.number().int().min(1).max(1e7),
  active: z.boolean()
});
var appRouter = router({
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = { path: "/", httpOnly: true, secure: true, sameSite: "none" };
      ctx.res.clearCookie("webdev_app_session", { ...cookieOptions, maxAge: -1 });
      return { success: true };
    })
  }),
  catalog: router({
    list: publicProcedure.query(async () => {
      if (supabaseServer) {
        const { data, error } = await supabaseServer.from("products").select("slug,name,brand,gender,description,image_url,price,in_stock").eq("in_stock", true).order("name");
        if (!error && data) {
          return data.map((product) => ({
            slug: product.slug,
            name: product.name,
            brand: product.brand,
            gender: product.gender,
            description: product.description,
            image: product.image_url,
            price: Number(product.price),
            active: 1
          }));
        }
        console.warn("[Catalog] Supabase unavailable; trying the existing database.", error);
      }
      try {
        const products2 = await listProducts(true);
        return products2.length ? products2 : seedCatalogProducts;
      } catch (error) {
        console.warn("[Catalog] Database unavailable; using original seed products.", error);
        return seedCatalogProducts;
      }
    })
  }),
  checkout: router({
    readiness: publicProcedure.query(() => liqpayReadiness()),
    createOrder: publicProcedure.input(z.object({
      name: z.string().trim().min(2).max(180),
      email: z.string().trim().email().max(320),
      phone: z.string().trim().min(7).max(40).regex(/^[+0-9() .-]+$/),
      address: z.string().trim().min(5).max(1e3),
      shippingMethod: z.enum(["nova_poshta", "ukrposhta"]),
      lines: z.array(z.object({ slug: z.string().min(2).max(128), quantity: z.number().int().min(1).max(99) })).min(1).max(50)
    })).mutation(async ({ input }) => {
      const catalog = await listProducts(true);
      const bySlug = new Map(catalog.map((product) => [product.slug, product]));
      const quantities = /* @__PURE__ */ new Map();
      for (const line of input.lines) quantities.set(line.slug, (quantities.get(line.slug) ?? 0) + line.quantity);
      if (Array.from(quantities.values()).some((quantity) => quantity > 99)) throw new Error("Please reduce item quantities before checkout.");
      const items = Array.from(quantities.entries()).map(([slug, quantity]) => {
        const product = bySlug.get(slug);
        if (!product) throw new Error("A product in your bag is no longer available.");
        return { slug, name: product.name, brand: product.brand, image: product.image, price: product.price, quantity };
      });
      const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      const id = randomUUID();
      await createOrder({
        id,
        customerName: input.name,
        customerEmail: input.email.toLowerCase(),
        customerPhone: input.phone,
        address: input.address,
        countryCode: "UA",
        shippingMethod: input.shippingMethod,
        paymentMethod: "liqpay",
        paymentStatus: "pending",
        status: "pending_payment",
        currency: "UAH",
        total,
        items
      });
      const checkout = createLiqPayCheckout({ orderId: id, amount: total, description: `Nuit Lumiere order ${id}` });
      return { id, total, currency: "UAH", checkout, paymentReady: Boolean(checkout) };
    }),
    status: publicProcedure.input(z.object({ orderId: z.string().uuid() })).query(async ({ input }) => {
      const order = await getOrder(input.orderId);
      if (!order) return null;
      return { id: order.id, total: order.total, currency: order.currency, status: order.status, paymentStatus: order.paymentStatus, updatedAt: order.updatedAt };
    })
  }),
  admin: router({
    me: adminProcedure.query(({ ctx }) => ({ id: ctx.user.id, name: ctx.user.name, email: ctx.user.email })),
    products: adminProcedure.query(async () => listProducts(false)),
    saveProduct: adminProcedure.input(productInput.extend({ originalSlug: z.string().trim().min(2).max(128).optional() })).mutation(async ({ input }) => {
      const { originalSlug, ...product } = input;
      await saveProduct({ ...product, active: product.active ? 1 : 0 }, originalSlug);
      return { success: true };
    }),
    orders: adminProcedure.query(async () => listOrders()),
    updateOrderStatus: adminProcedure.input(z.object({
      id: z.string().uuid(),
      status: z.enum(["processing", "shipped", "cancelled"])
    })).mutation(async ({ input }) => {
      await updateOrderStatus(input.id, input.status);
      return { success: true };
    })
  })
});

// server/_core/context.ts
async function createContext(opts) {
  let user = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    user = null;
  }
  return {
    req: opts.req,
    res: opts.res,
    user
  };
}

// server/_core/vite.ts
import express from "express";
import fs2 from "fs";
import { nanoid } from "nanoid";
import path2 from "path";
import { createServer as createViteServer } from "vite";

// vite.config.ts
import { jsxLocPlugin } from "@builder.io/vite-plugin-jsx-loc";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
var PROJECT_ROOT = import.meta.dirname;
var LOG_DIR = path.join(PROJECT_ROOT, ".manus-logs");
var MAX_LOG_SIZE_BYTES = 1 * 1024 * 1024;
var TRIM_TARGET_BYTES = Math.floor(MAX_LOG_SIZE_BYTES * 0.6);
function ensureLogDir() {
  if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
  }
}
function trimLogFile(logPath, maxSize) {
  try {
    if (!fs.existsSync(logPath) || fs.statSync(logPath).size <= maxSize) {
      return;
    }
    const lines = fs.readFileSync(logPath, "utf-8").split("\n");
    const keptLines = [];
    let keptBytes = 0;
    const targetSize = TRIM_TARGET_BYTES;
    for (let i = lines.length - 1; i >= 0; i--) {
      const lineBytes = Buffer.byteLength(`${lines[i]}
`, "utf-8");
      if (keptBytes + lineBytes > targetSize) break;
      keptLines.unshift(lines[i]);
      keptBytes += lineBytes;
    }
    fs.writeFileSync(logPath, keptLines.join("\n"), "utf-8");
  } catch {
  }
}
function writeToLogFile(source, entries) {
  if (entries.length === 0) return;
  ensureLogDir();
  const logPath = path.join(LOG_DIR, `${source}.log`);
  const lines = entries.map((entry) => {
    const ts = (/* @__PURE__ */ new Date()).toISOString();
    return `[${ts}] ${JSON.stringify(entry)}`;
  });
  fs.appendFileSync(logPath, `${lines.join("\n")}
`, "utf-8");
  trimLogFile(logPath, MAX_LOG_SIZE_BYTES);
}
function vitePluginManusDebugCollector() {
  return {
    name: "manus-debug-collector",
    transformIndexHtml(html) {
      if (process.env.NODE_ENV === "production") {
        return html;
      }
      return {
        html,
        tags: [
          {
            tag: "script",
            attrs: {
              src: "/__manus__/debug-collector.js"
            },
            injectTo: "head"
          }
        ]
      };
    },
    configureServer(server) {
      server.middlewares.use("/__manus__/logs", (req, res, next) => {
        if (req.method !== "POST") {
          return next();
        }
        const handlePayload = (payload) => {
          if (payload.consoleLogs?.length > 0) {
            writeToLogFile("browserConsole", payload.consoleLogs);
          }
          if (payload.networkRequests?.length > 0) {
            writeToLogFile("networkRequests", payload.networkRequests);
          }
          if (payload.sessionEvents?.length > 0) {
            writeToLogFile("sessionReplay", payload.sessionEvents);
          }
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        };
        const reqBody = req.body;
        if (reqBody && typeof reqBody === "object") {
          try {
            handlePayload(reqBody);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
          return;
        }
        let body = "";
        req.on("data", (chunk) => {
          body += chunk.toString();
        });
        req.on("end", () => {
          try {
            const payload = JSON.parse(body);
            handlePayload(payload);
          } catch (e) {
            res.writeHead(400, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ success: false, error: String(e) }));
          }
        });
      });
    }
  };
}
function vitePluginPublicPlatformConfig() {
  return {
    name: "manus-public-platform-config",
    configureServer(server) {
      server.middlewares.use("/api/platform/config.js", (_req, res) => {
        res.setHeader("Content-Type", "application/javascript");
        res.setHeader("Cache-Control", "no-store");
        res.end(publicPlatformScript());
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "api/platform/config.js", source: publicPlatformScript() });
    }
  };
}
var plugins = [vitePluginPublicPlatformConfig(), react(), tailwindcss(), jsxLocPlugin(), vitePluginManusDebugCollector()];
var vite_config_default = defineConfig({
  plugins,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  envDir: path.resolve(import.meta.dirname),
  root: path.resolve(import.meta.dirname, "client"),
  publicDir: path.resolve(import.meta.dirname, "client", "public"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    host: true,
    allowedHosts: [
      ".manuspre.computer",
      ".manus.computer",
      ".manus-asia.computer",
      ".manuscomputer.ai",
      ".manusvm.computer",
      "localhost",
      "127.0.0.1"
    ],
    fs: {
      strict: true,
      // Setting deny replaces Vite's defaults, so they are repeated here first. Then dotfiles, and the
      // browser debug logs: they can hold request data of the people testing the Preview.
      deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.*", "**/.manus-logs/**"]
    }
  }
});

// server/_core/vite.ts
async function setupVite(app, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    // Keep the file-serving limits of vite.config.ts; only the options above differ here.
    server: { ...vite_config_default.server, ...serverOptions },
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "../..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app) {
  const distPath = process.env.NODE_ENV === "development" ? path2.resolve(import.meta.dirname, "../..", "dist", "public") : path2.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    console.error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app.use(express.static(distPath));
  app.get("/404", (_req, res) => {
    res.status(404).sendFile(path2.resolve(distPath, "index.html"));
  });
  app.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/_core/index.ts
async function startServer() {
  const app = express2();
  const server = createServer(app);
  app.use(express2.json({ limit: "50mb" }));
  app.use(express2.urlencoded({ limit: "50mb", extended: true }));
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res.set("Cache-Control", "no-store").type("application/javascript").send(publicPlatformScript());
  });
  app.post("/api/liqpay/callback", async (req, res) => {
    const data = typeof req.body?.data === "string" ? req.body.data : "";
    const signature = typeof req.body?.signature === "string" ? req.body.signature : "";
    const payload = verifyLiqPayCallback(data, signature);
    if (!payload || !liqpayPublicKeyMatches(payload.public_key)) {
      res.status(400).json({ error: "Invalid LiqPay signature" });
      return;
    }
    const orderId = typeof payload.order_id === "string" ? payload.order_id : "";
    const status = typeof payload.status === "string" ? payload.status : "";
    const amount = Number(payload.amount);
    const currency = typeof payload.currency === "string" ? payload.currency : "";
    if (!orderId || !status || currency !== "UAH" || !Number.isFinite(amount) || !await checkOrderAmount(orderId, amount, currency)) {
      res.status(400).json({ error: "Callback does not match the stored order" });
      return;
    }
    await updateLiqPayStatus(orderId, status, status === "success");
    res.status(200).send("ok");
  });
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = Number(process.env.PORT || "3000");
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Invalid PORT");
  server.on("error", (error) => {
    console.error("Server failed:", error.message);
    process.exit(1);
  });
  server.listen(port, "0.0.0.0", () => console.log(`Server listening on port ${port}`));
}
startServer().catch((error) => {
  console.error(error);
  process.exit(1);
});

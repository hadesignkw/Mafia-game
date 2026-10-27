import { DurableObject } from "cloudflare:workers";

/* =========== الحسابات والرصيد =========== */
// الباقات: كل "لعبة" تنخصم لما تبدي لعبة جديدة (أون لاين أو غرفة القاضي)
export const PACKS = [
  { id: "p1", games: 1, price: 2, label: "لعبة وحدة" },
  { id: "p2", games: 2, price: 3.5, label: "لعبتين" },
  { id: "p5", games: 5, price: 5, label: "5 ألعاب" },
];
const SESSION_TTL = 90 * 24 * 3600e3; // الدخول يبقى ٩٠ يوم
const MAX_FAILS = 8, LOCK_MS = 15 * 60e3; // بعد ٨ محاولات غلط ينقفل الحساب ربع ساعة
const ITER = 100000; // أقصى عدد يسمح فيه كلاودفلير لـ PBKDF2

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
async function hashPass(pass, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITER }, key, 256));
}
function same(a, b) { // مقارنة بوقت ثابت
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const cleanEmail = (e) => String(e || "").trim().toLowerCase().slice(0, 120);
const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);

export class Acct extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS users (email TEXT PRIMARY KEY, salt TEXT NOT NULL, hash TEXT NOT NULL, credits INTEGER NOT NULL DEFAULT 0, fails INTEGER NOT NULL DEFAULT 0, locked_until INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, email TEXT NOT NULL, exp INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS ledger (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, delta INTEGER NOT NULL, reason TEXT NOT NULL, ref TEXT, at INTEGER NOT NULL);
      CREATE UNIQUE INDEX IF NOT EXISTS ledger_ref ON ledger(email, ref);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, email TEXT NOT NULL, pack TEXT NOT NULL, games INTEGER NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL, provider TEXT, provider_ref TEXT, created INTEGER NOT NULL, paid INTEGER);
    `);
    try { this.sql.exec("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch {} // الاسم (أضفناه بعدين)
  }

  one(q, ...a) { return this.sql.exec(q, ...a).toArray()[0] || null; }
  async newSession(email) {
    const token = rand(32);
    this.sql.exec("DELETE FROM sessions WHERE exp < ?", Date.now());
    this.sql.exec("INSERT INTO sessions (token, email, exp) VALUES (?, ?, ?)", token, email, Date.now() + SESSION_TTL);
    return token;
  }
  view(email) {
    const u = this.one("SELECT email, name, credits FROM users WHERE email = ?", email);
    return u ? { email: u.email, name: u.name || u.email.split("@")[0], credits: u.credits } : null;
  }

  async signup(email, pass, name) {
    email = cleanEmail(email); pass = String(pass || "");
    name = String(name || "").trim().replace(/\s+/g, " ").slice(0, 24);
    if (!name) return { error: "اكتب اسمك." };
    if (!okEmail(email)) return { error: "اكتب إيميل صحيح." };
    if (pass.length < 6) return { error: "كلمة السر لازم ٦ حروف أو أكثر." };
    if (pass.length > 200) return { error: "كلمة السر طويلة واجد." };
    if (this.one("SELECT 1 FROM users WHERE email = ?", email)) return { error: "هالإيميل مسجل من قبل، سجّل دخول." };
    const salt = rand(16), hash = await hashPass(pass, salt);
    if (this.one("SELECT 1 FROM users WHERE email = ?", email)) return { error: "هالإيميل مسجل من قبل، سجّل دخول." };
    this.sql.exec("INSERT INTO users (email, name, salt, hash, created) VALUES (?, ?, ?, ?, ?)", email, name, salt, hash, Date.now());
    return { token: await this.newSession(email), me: this.view(email) };
  }

  async login(email, pass) {
    email = cleanEmail(email); pass = String(pass || "");
    const u = this.one("SELECT * FROM users WHERE email = ?", email);
    const bad = { error: "الإيميل أو كلمة السر غلط." };
    if (!u) { await hashPass(pass, "x"); return bad; } // نفس الوقت عشان ما يبين إذا الإيميل موجود
    if (u.locked_until > Date.now()) return { error: "محاولات غلط واجد. جرّب بعد ربع ساعة." };
    const h = await hashPass(pass, u.salt);
    if (!same(h, u.hash)) {
      const f = u.fails + 1;
      this.sql.exec("UPDATE users SET fails = ?, locked_until = ? WHERE email = ?", f >= MAX_FAILS ? 0 : f, f >= MAX_FAILS ? Date.now() + LOCK_MS : 0, email);
      return bad;
    }
    this.sql.exec("UPDATE users SET fails = 0, locked_until = 0 WHERE email = ?", email);
    return { token: await this.newSession(email), me: this.view(email) };
  }

  emailFor(token) {
    if (!token || typeof token !== "string") return null;
    const r = this.one("SELECT email, exp FROM sessions WHERE token = ?", token);
    return r && r.exp > Date.now() ? r.email : null;
  }
  async me(token) { const e = this.emailFor(token); return e ? { me: this.view(e) } : { error: "سجّل دخول." }; }
  async logout(token) { this.sql.exec("DELETE FROM sessions WHERE token = ?", String(token || "")); return { ok: true }; }

  // الغرفة تسأل قبل لا تنفتح: عنده رصيد؟
  async check(token) {
    const e = this.emailFor(token);
    if (!e) return { error: "سجّل دخول عشان تفتح غرفة.", code: "login" };
    const v = this.view(e);
    if (!v || v.credits < 1) return { error: "رصيدك خلص. اشتري ألعاب عشان تفتح غرفة.", code: "credits" };
    return { email: e, credits: v.credits };
  }

  // تنخصم لعبة وحدة لما تبدي لعبة. نفس المرجع ما ينخصم مرتين
  async consume(email, ref) {
    const u = this.one("SELECT credits FROM users WHERE email = ?", email);
    if (!u) return { ok: false, error: "الحساب مو موجود." };
    if (this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ?", email, ref)) return { ok: true, credits: u.credits, dup: true };
    if (u.credits < 1) return { ok: false, credits: 0, error: "رصيد المضيف خلص، لازم يشتري ألعاب عشان تبدون." };
    this.sql.exec("UPDATE users SET credits = credits - 1 WHERE email = ?", email);
    this.sql.exec("INSERT INTO ledger (email, delta, reason, ref, at) VALUES (?, -1, 'game', ?, ?)", email, ref, Date.now());
    return { ok: true, credits: u.credits - 1 };
  }

  // يضيف رصيد (بعد ما ينجح الدفع). نفس المرجع ما ينضاف مرتين
  grant(email, games, reason, ref) {
    if (!this.one("SELECT 1 FROM users WHERE email = ?", email)) return { ok: false };
    if (ref && this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ?", email, ref)) return { ok: true, dup: true };
    this.sql.exec("UPDATE users SET credits = credits + ? WHERE email = ?", games, email);
    this.sql.exec("INSERT INTO ledger (email, delta, reason, ref, at) VALUES (?, ?, ?, ?, ?)", email, games, reason, ref || null, Date.now());
    return { ok: true, me: this.view(email) };
  }

  /* ---------- الشراء ---------- */
  // بوابة الدفع مطفية للحين: الطلب ينحفظ بس ما يروح لأي بوابة
  async order(token, packId) {
    const e = this.emailFor(token);
    if (!e) return { error: "سجّل دخول." };
    const p = PACKS.find((x) => x.id === packId);
    if (!p) return { error: "الباقة مو موجودة." };
    const id = rand(12);
    this.sql.exec("INSERT INTO orders (id, email, pack, games, amount, status, created) VALUES (?, ?, ?, ?, ?, 'new', ?)", id, e, p.id, p.games, p.price, Date.now());
    return { id, email: e, pack: p };
  }
  // يتنادى من البوابة لما الدفع ينجح (بعد التأكد منها)
  async markPaid(orderId, provider, providerRef) {
    const o = this.one("SELECT * FROM orders WHERE id = ?", orderId);
    if (!o) return { ok: false };
    if (o.status === "paid") return { ok: true, dup: true };
    this.sql.exec("UPDATE orders SET status = 'paid', provider = ?, provider_ref = ?, paid = ? WHERE id = ?", provider, providerRef, Date.now(), orderId);
    return this.grant(o.email, o.games, "purchase", "order:" + orderId);
  }
  async history(token) {
    const e = this.emailFor(token);
    if (!e) return { error: "سجّل دخول." };
    return { items: this.sql.exec("SELECT delta, reason, at FROM ledger WHERE email = ? ORDER BY id DESC LIMIT 30", e).toArray() };
  }
}

import { DurableObject } from "cloudflare:workers";

/* =========== الحسابات والرصيد =========== */
// الباقات: كل "لعبة" تنخصم لما تبدي لعبة جديدة (أون لاين أو غرفة القاضي)
export const PACKS = [
  { id: "p1", games: 1, price: 2, label: "لعبة وحدة" },
  { id: "p2", games: 2, price: 3.5, label: "لعبتين" },
  { id: "p5", games: 5, price: 5, label: "5 ألعاب" },
];
const SESSION_TTL = 90 * 24 * 3600e3; // الدخول يبقى ٩٠ يوم
const ITER = 100000; // أقصى عدد يسمح فيه كلاودفلير لـ PBKDF2
// حدود المحاولات (بدل قفل الحساب، عشان محد يقدر يقفل حساب غيره):
const LIMITS = {
  loginIp: { n: 30, ms: 15 * 60e3 }, // كل جهاز/شبكة: ٣٠ محاولة دخول بربع ساعة
  loginPair: { n: 8, ms: 15 * 60e3 }, // نفس الإيميل من نفس الشبكة: ٨ محاولات غلط بربع ساعة
  signupIp: { n: 5, ms: 3600e3 }, // ٥ حسابات جديدة بالساعة من نفس الشبكة
  orderEmail: { n: 20, ms: 3600e3 }, // ٢٠ طلب شراء بالساعة
};

const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const rand = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
// التشفير يصير بالـ Worker نفسه مو داخل الحسابات، عشان ضغط الدخول ما يبطّئ بداية الألعاب
export async function hashPass(pass, salt) {
  const key = await crypto.subtle.importKey("raw", enc.encode(pass), "PBKDF2", false, ["deriveBits"]);
  return hex(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: enc.encode(salt), iterations: ITER }, key, 256));
}
export const sha = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(String(s))));
export function same(a, b) { // مقارنة بوقت ثابت
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
export const cleanEmail = (e) => String(e || "").normalize("NFKC").trim().toLowerCase().slice(0, 120);
export const okEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e);
export const cleanName = (n) => String(n || "").normalize("NFKC").replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "").trim().replace(/\s+/g, " ").slice(0, 24);
const isTok = (t) => typeof t === "string" && /^[0-9a-f]{64}$/.test(t);

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
      CREATE TABLE IF NOT EXISTS throttle (k TEXT PRIMARY KEY, n INTEGER NOT NULL, reset INTEGER NOT NULL);
    `);
    try { this.sql.exec("ALTER TABLE users ADD COLUMN name TEXT NOT NULL DEFAULT ''"); } catch {} // الاسم (أضفناه بعدين)
  }

  one(q, ...a) { return this.sql.exec(q, ...a).toArray()[0] || null; }

  /* ---------- حدود المحاولات ---------- */
  // يرجع true إذا تعدى الحد. add=false: بس يشيّك
  hit(kind, key, add = true) {
    const L = LIMITS[kind], k = kind + ":" + key, now = Date.now();
    let r = this.one("SELECT n, reset FROM throttle WHERE k = ?", k);
    if (!r || r.reset <= now) r = { n: 0, reset: now + L.ms };
    if (r.n >= L.n) return true;
    if (add) this.sql.exec("INSERT OR REPLACE INTO throttle (k, n, reset) VALUES (?, ?, ?)", k, r.n + 1, r.reset);
    if (Math.random() < 0.02) this.sql.exec("DELETE FROM throttle WHERE reset <= ?", now);
    return false;
  }

  /* ---------- الجلسات (ننحفظ بصمة التوكن بس، مو التوكن نفسه) ---------- */
  async newSession(email) {
    const token = rand(32);
    this.sql.exec("DELETE FROM sessions WHERE exp < ?", Date.now());
    this.sql.exec("INSERT INTO sessions (token, email, exp) VALUES (?, ?, ?)", await sha(token), email, Date.now() + SESSION_TTL);
    return token;
  }
  async emailFor(token) {
    if (!isTok(token)) return null;
    const r = this.one("SELECT email, exp FROM sessions WHERE token = ?", await sha(token));
    return r && r.exp > Date.now() ? r.email : null;
  }
  view(email) {
    const u = this.one("SELECT email, name, credits FROM users WHERE email = ?", email);
    return u ? { email: u.email, name: u.name || u.email.split("@")[0], credits: u.credits } : null;
  }

  /* ---------- التسجيل والدخول ---------- */
  // الخطوة ١ بالتسجيل: نتأكد من الحد ومن إن الإيميل مو مسجل
  async signupCheck(email, ip) {
    if (this.hit("signupIp", ip, false)) return { error: "سويت حسابات واجد. جرّب بعد ساعة." };
    if (this.one("SELECT 1 FROM users WHERE email = ?", email)) return { error: "هالإيميل مسجل من قبل، سجّل دخول." };
    return { ok: true };
  }
  // الخطوة ٢: الـ Worker شفّر كلمة السر، وهني ننحفظ
  async signupSave(email, name, salt, hash, ip) {
    if (this.hit("signupIp", ip)) return { error: "سويت حسابات واجد. جرّب بعد ساعة." };
    if (this.one("SELECT 1 FROM users WHERE email = ?", email)) return { error: "هالإيميل مسجل من قبل، سجّل دخول." };
    this.sql.exec("INSERT INTO users (email, name, salt, hash, created) VALUES (?, ?, ?, ?, ?)", email, name, salt, hash, Date.now());
    return { token: await this.newSession(email), me: this.view(email) };
  }
  // الخطوة ١ بالدخول: نعطي الـ Worker الملح عشان يشفّر. إذا الإيميل مو موجود نعطي ملح ثابت عشان ما يبين
  async loginStart(email, ip) {
    if (this.hit("loginIp", ip)) return { error: "محاولات واجد. جرّب بعد ربع ساعة." };
    if (this.hit("loginPair", email + "|" + ip, false)) return { error: "محاولات غلط واجد. جرّب بعد ربع ساعة." };
    const u = this.one("SELECT salt FROM users WHERE email = ?", email);
    return { salt: u ? u.salt : (await sha("nouser|" + email)).slice(0, 32) };
  }
  // الخطوة ٢: نقارن
  async loginFinish(email, hash, ip) {
    const u = this.one("SELECT hash FROM users WHERE email = ?", email);
    if (!u || !same(hash, u.hash)) { this.hit("loginPair", email + "|" + ip); return { error: "الإيميل أو كلمة السر غلط." }; }
    return { token: await this.newSession(email), me: this.view(email) };
  }

  async me(token) { const e = await this.emailFor(token); return e ? { me: this.view(e) } : { error: "سجّل دخول." }; }
  async logout(token) { if (isTok(token)) this.sql.exec("DELETE FROM sessions WHERE token = ?", await sha(token)); return { ok: true }; }

  /* ---------- الرصيد ---------- */
  // الغرفة تسأل قبل لا تنفتح: عنده رصيد؟
  async check(token) {
    const e = await this.emailFor(token);
    if (!e) return { error: "سجّل دخول عشان تفتح غرفة.", code: "login" };
    const v = this.view(e);
    if (!v || v.credits < 1) return { error: "رصيدك خلص. اشتري ألعاب عشان تفتح غرفة.", code: "credits" };
    return { email: e, credits: v.credits };
  }

  // تنخصم لعبة وحدة لما تبدي لعبة. نفس المرجع ما ينخصم مرتين، والرصيد ما ينزل تحت الصفر
  async consume(email, ref) {
    const u = this.one("SELECT credits FROM users WHERE email = ?", email);
    if (!u) return { ok: false, error: "حساب صاحب الغرفة مو موجود." };
    // إذا نفس اللعبة انخصمت قبل ولا ترجّعت: ما تنخصم مرة ثانية. وإذا ترجّعت: تنخصم من جديد بمرجع جديد
    let k = ref;
    for (let n = 1; this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ?", email, k); n++) {
      if (!this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ?", email, "refund:" + k)) return { ok: true, credits: u.credits, dup: true, ref: k };
      k = ref + "#" + n;
    }
    if (u.credits < 1) return { ok: false, credits: 0, error: "رصيد المضيف خلص، لازم يشتري ألعاب عشان تبدون." };
    this.sql.exec("UPDATE users SET credits = credits - 1 WHERE email = ? AND credits >= 1", email);
    this.sql.exec("INSERT INTO ledger (email, delta, reason, ref, at) VALUES (?, -1, 'game', ?, ?)", email, k, Date.now());
    return { ok: true, credits: u.credits - 1, ref: k };
  }
  // ترجيع لعبة انخصمت بس اللعبة ما بدت. مرة وحدة بس لكل خصم
  async refund(email, ref) {
    if (!this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ? AND delta = -1", email, ref)) return { ok: false };
    if (this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ?", email, "refund:" + ref)) return { ok: true, dup: true };
    this.sql.exec("UPDATE users SET credits = credits + 1 WHERE email = ?", email);
    this.sql.exec("INSERT INTO ledger (email, delta, reason, ref, at) VALUES (?, 1, 'refund', ?, ?)", email, "refund:" + ref, Date.now());
    return { ok: true, me: this.view(email) };
  }

  // يضيف أو ينقص رصيد (بعد الدفع أو يدوي). لازم مرجع، ونفس المرجع ما يتكرر، والرصيد ما ينزل تحت الصفر
  grant(email, games, reason, ref) {
    games = Math.trunc(Number(games));
    if (!ref || !Number.isFinite(games) || !games) return { ok: false, error: "طلب غلط." };
    const u = this.one("SELECT credits FROM users WHERE email = ?", email);
    if (!u) return { ok: false, error: "الحساب مو موجود." };
    if (this.one("SELECT 1 FROM ledger WHERE email = ? AND ref = ?", email, ref)) return { ok: true, dup: true, me: this.view(email) };
    const delta = Math.max(games, -u.credits);
    this.sql.exec("UPDATE users SET credits = credits + ? WHERE email = ?", delta, email);
    this.sql.exec("INSERT INTO ledger (email, delta, reason, ref, at) VALUES (?, ?, ?, ?, ?)", email, delta, reason, ref, Date.now());
    return { ok: true, me: this.view(email) };
  }

  /* ---------- الشراء ---------- */
  // بوابة الدفع مطفية للحين: الطلب ينحفظ بس ما يروح لأي بوابة
  async order(token, packId) {
    const e = await this.emailFor(token);
    if (!e) return { error: "سجّل دخول." };
    const p = PACKS.find((x) => x.id === packId);
    if (!p) return { error: "الباقة مو موجودة." };
    if (this.hit("orderEmail", e)) return { error: "طلبات واجد، جرّب بعد شوي." };
    const id = rand(12);
    this.sql.exec("INSERT INTO orders (id, email, pack, games, amount, status, created) VALUES (?, ?, ?, ?, ?, 'new', ?)", id, e, p.id, p.games, p.price, Date.now());
    return { id, email: e, pack: p };
  }
  // يتنادى بعد ما نتأكد من البوابة نفسها إن الدفع نجح، وبنفس المبلغ والعملة
  async markPaid(orderId, provider, providerRef, amount, currency) {
    const o = this.one("SELECT * FROM orders WHERE id = ?", String(orderId || ""));
    if (!o) return { ok: false, error: "الطلب مو موجود." };
    if (o.status === "paid") return { ok: true, dup: true };
    if (currency !== "KWD" || Math.abs(Number(amount) - o.amount) > 0.0005) return { ok: false, error: "المبلغ ما يطابق الطلب." };
    this.sql.exec("UPDATE orders SET status = 'paid', provider = ?, provider_ref = ?, paid = ? WHERE id = ?", provider, providerRef, Date.now(), o.id);
    return this.grant(o.email, o.games, "purchase", "order:" + o.id);
  }
  async history(token) {
    const e = await this.emailFor(token);
    if (!e) return { error: "سجّل دخول." };
    return { items: this.sql.exec("SELECT delta, reason, at FROM ledger WHERE email = ? ORDER BY id DESC LIMIT 30", e).toArray() };
  }
}

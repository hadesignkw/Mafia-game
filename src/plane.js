import { DurableObject } from "cloudflare:workers";

/* =========== الطيارة: غرفة اللعبة (نسخة التجربة) ===========
   الفكرة: تلفون واحد (المضيف) يحسب الفيزياء: الركاب والأغراض وميلان الطيارة،
   ويرسل الحالة للكل. وكل لاعب يحرك شخصيته بتلفونه ويرسل مكانه، والسيرفر يجمع
   كل الأماكن ويرسلها للكل كل ١٠٠ ملي. السيرفر ما يحسب شي، بس يوزع.             */
const TTL = 6 * 3600e3;        // الغرفة تنمسح بعد ٦ ساعات بدون استخدام
const EMPTY_TTL = 30 * 60e3;   // غرفة ما دخلها أحد تنمسح بعد نص ساعة
const MAX_PLAYERS = 15;
const TICK = 100;              // كل كم ملي نوزع أماكن اللاعبين
const RATE = { n: 60, ms: 2000 };
const INVIS = /[\u0000-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯﻿]/g;
const clean = (v, max) => String(v || "").normalize("NFKC").replace(INVIS, "").trim().replace(/\s+/g, " ").slice(0, max);
const tok = () => crypto.randomUUID().replace(/-/g, "");
const sid = () => crypto.randomUUID().slice(0, 8);
const num = (v, lo, hi) => { v = Number(v); return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : 0; };
const LOOKS = ["captain", "steward", "stewardess", "guard", "mechanic", "cleaner"];

export class Plane extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;
    this.pos = Object.create(null); // آخر مكان لكل لاعب (ما ينحفظ، بس بالذاكرة)
    this.dirty = false;
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get("s")) || null; });
  }
  alive() { return !!this.s && Date.now() - (this.s.touched || 0) < TTL; }
  async exists() { return this.alive(); }

  async create(code) {
    if (this.alive()) return null;
    this.s = { code, createdAt: Date.now(), touched: Date.now(), players: {}, order: [], hostPid: null, started: false, seed: Math.floor(Math.random() * 1e9) };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + EMPTY_TTL);
    return { code };
  }
  async save() { this.s.touched = Date.now(); await this.ctx.storage.put("s", this.s); }

  async alarm() {
    if (!this.s) return;
    const socks = this.ctx.getWebSockets();
    if (!Object.keys(this.s.players).length && !socks.length && Date.now() - this.s.createdAt >= EMPTY_TTL - 1000) { this.s = null; await this.ctx.storage.deleteAll(); return; }
    if (Date.now() - this.s.touched < TTL) { await this.ctx.storage.setAlarm(this.s.touched + TTL + 60e3); return; }
    for (const ws of socks) try { ws.close(4000, "expired"); } catch {}
    this.s = null; await this.ctx.storage.deleteAll();
  }

  async fetch() {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({});
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  send(ws, o) { try { ws.send(typeof o === "string" ? o : JSON.stringify(o)); } catch {} }
  err(ws, text) { this.send(ws, { t: "error", text }); }
  socks() { return this.ctx.getWebSockets(); }
  on(pid) { return this.socks().some((w) => (w.deserializeAttachment() || {}).pid === pid); }
  hostWs() { const h = this.s && this.s.hostPid; if (!h) return null; return this.socks().find((w) => (w.deserializeAttachment() || {}).pid === h) || null; }
  roster() {
    const s = this.s;
    return s.order.filter((p) => s.players[p]).map((p) => ({ id: p, name: s.players[p].name, look: s.players[p].look, on: this.on(p) }));
  }
  // الكل يعرف منو موجود ومنو المضيف
  broadcastRoom() {
    const s = this.s; if (!s) return;
    const msg = JSON.stringify({ t: "room", code: s.code, host: s.hostPid, started: s.started, seed: s.seed, players: this.roster() });
    for (const w of this.socks()) if ((w.deserializeAttachment() || {}).pid) this.send(w, msg);
  }
  // المضيف لازم يكون متصل: إذا طلع، أول واحد متصل بعده يصير المضيف
  async ensureHost() {
    const s = this.s; if (!s) return;
    if (s.hostPid && this.on(s.hostPid)) return;
    const next = s.order.find((p) => s.players[p] && this.on(p)) || null;
    if (next !== s.hostPid) { s.hostPid = next; await this.save(); this.broadcastRoom(); }
  }
  // كل ١٠٠ ملي: نرسل أماكن كل اللاعبين دفعة وحدة
  flush() {
    this.flushAt = null;
    if (!this.dirty || !this.s) return;
    this.dirty = false;
    const msg = JSON.stringify({ t: "pos", p: this.pos });
    for (const w of this.socks()) if ((w.deserializeAttachment() || {}).pid) this.send(w, msg);
  }

  async webSocketMessage(ws, raw) {
    if (typeof raw !== "string" || raw.length > 12000) return;
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m !== "object" || Array.isArray(m) || m.t === "ping") return;
    const now = Date.now(), rl = (this.rl = this.rl || new WeakMap()), b = rl.get(ws) || { n: 0, t: now };
    if (now - b.t > RATE.ms) { b.n = 0; b.t = now; }
    if (++b.n > RATE.n) return; rl.set(ws, b);
    const s = this.s;
    if (!s || !this.alive()) return this.send(ws, { t: "gone", text: "الغرفة خلصت." });
    const a = ws.deserializeAttachment() || {};

    if (m.t === "join") {
      let pid = null;
      // رجوع بنفس الجهاز
      if (m.pid && m.token && s.players[m.pid] && s.players[m.pid].token === m.token) pid = m.pid;
      else {
        const name = clean(m.name, 16);
        if (!name) return this.err(ws, "اكتب اسمك.");
        if (s.order.filter((p) => s.players[p]).length >= MAX_PLAYERS) return this.err(ws, "العدد اكتمل، الطيارة فل.");
        if (Object.values(s.players).some((p) => p.name === name)) return this.err(ws, "الاسم مستخدم، اختار غيره.");
        pid = sid();
        s.players[pid] = { name, token: tok(), look: LOOKS.includes(m.look) ? m.look : LOOKS[s.order.length % LOOKS.length], at: Date.now() };
        s.order.push(pid);
      }
      ws.serializeAttachment({ pid });
      await this.save();
      this.send(ws, { t: "you", pid, token: s.players[pid].token, name: s.players[pid].name, look: s.players[pid].look });
      await this.ensureHost();
      this.broadcastRoom();
      // اللي يدخل متأخر: المضيف يرسل له الحالة كاملة
      const h = this.hostWs(); if (h && s.hostPid !== pid) this.send(h, { t: "need", pid });
      return;
    }
    if (!a.pid || !s.players[a.pid]) return this.err(ws, "ادخل أول.");
    const pid = a.pid;

    switch (m.t) {
      case "look": { // تغيير الشكل قبل البداية
        if (s.started || !LOOKS.includes(m.look)) return;
        s.players[pid].look = m.look; await this.save(); this.broadcastRoom(); return;
      }
      case "start": {
        if (pid !== s.hostPid) return this.err(ws, "المضيف هو اللي يبدي.");
        s.started = true; await this.save(); this.broadcastRoom(); return;
      }
      case "p": { // مكاني: [x,y,z,ry,anim]
        if (!Array.isArray(m.v) || m.v.length < 5) return;
        this.pos[pid] = [num(m.v[0], -50, 50), num(m.v[1], -20, 50), num(m.v[2], -50, 50), num(m.v[3], -10, 10), num(m.v[4], 0, 9)];
        this.dirty = true;
        if (!this.flushAt) { this.flushAt = setTimeout(() => this.flush(), TICK); }
        return;
      }
      case "act": { // مسك / رمي / قعود... تروح للمضيف وهو يقرر
        const h = this.hostWs(); if (!h) return;
        this.send(h, { t: "act", pid, a: clean(m.a, 12), d: Array.isArray(m.d) ? m.d.slice(0, 6).map((v) => num(v, -100, 100)) : null });
        return;
      }
      case "state": { // من المضيف بس: حالة الركاب والأغراض والطيارة
        if (pid !== s.hostPid) return;
        if (m.to) { // رد على «need»: لواحد بس
          for (const w of this.socks()) if ((w.deserializeAttachment() || {}).pid === m.to) this.send(w, raw);
          return;
        }
        for (const w of this.socks()) { const b2 = w.deserializeAttachment() || {}; if (b2.pid && b2.pid !== pid) this.send(w, raw); }
        return;
      }
      case "ev": { // حدث للكل (صوت أو رسالة): من المضيف بس
        if (pid !== s.hostPid) return;
        const out = JSON.stringify({ t: "ev", k: clean(m.k, 16), who: clean(m.who, 20), x: Array.isArray(m.x) ? m.x.slice(0, 4).map((v) => num(v, -100, 100)) : null });
        for (const w of this.socks()) if ((w.deserializeAttachment() || {}).pid) this.send(w, out);
        return;
      }
      case "say": { // جملة فوق راسي
        const text = clean(m.text, 40); if (!text) return;
        const out = JSON.stringify({ t: "say", pid, text });
        for (const w of this.socks()) if ((w.deserializeAttachment() || {}).pid) this.send(w, out);
        return;
      }
      case "kick": {
        if (pid !== s.hostPid || !s.players[m.pid] || m.pid === pid) return;
        delete s.players[m.pid]; delete this.pos[m.pid];
        for (const w of this.socks()) if ((w.deserializeAttachment() || {}).pid === m.pid) { this.send(w, { t: "gone", text: "المضيف طلعك من الطيارة." }); w.serializeAttachment({}); }
        await this.save(); this.broadcastRoom(); return;
      }
      case "leave": {
        delete s.players[pid]; delete this.pos[pid]; ws.serializeAttachment({});
        await this.save(); await this.ensureHost(); this.broadcastRoom(); return;
      }
    }
  }

  async webSocketClose(ws) {
    try { ws.close(1000); } catch {}
    const a = ws.deserializeAttachment() || {};
    if (a.pid) { delete this.pos[a.pid]; this.dirty = true; }
    await this.ensureHost();
    this.broadcastRoom();
  }
  async webSocketError(ws) { await this.webSocketClose(ws); }
}

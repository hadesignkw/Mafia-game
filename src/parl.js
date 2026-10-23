import { DurableObject } from "cloudflare:workers";

/* =========== تسجيل برلمان =========== */
// الحكم يسجل أصوات كل لاعب كل جولة. عدد الجولات بعدد اللاعبين.
// وضعين: يدوي (الحكم يسجل كل شي) أو اللاعبين يسجلون والحكم يعتمد.
const ROOM_TTL = 12 * 3600e3;
const MAX_PLAYERS = 30;
const MAX_AMT = 1e7;
const tok = () => crypto.randomUUID().replace(/-/g, "");
const sid = () => crypto.randomUUID().slice(0, 8);
const cleanName = (n) => String(n || "").trim().replace(/\s+/g, " ").slice(0, 24);
const num = (v) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? n : NaN; };

export class Parl extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get("s")) || null; });
  }

  alive() { return !!this.s && Date.now() - (this.s.touched || 0) < ROOM_TTL; }
  async exists() { return this.alive() ? { ok: true, mode: this.s.mode } : { ok: false }; }

  async create(code, mode) {
    if (this.alive()) return null;
    const judgeToken = tok();
    this.s = {
      code, judgeToken, mode: mode === "manual" ? "manual" : "players", createdAt: Date.now(), touched: Date.now(),
      players: {}, order: [], phase: "setup", rounds: [], cur: -1, pending: [], swapAsk: null,
      secret: null, archive: [], event: null, gameNo: 1,
    };
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL + 60e3);
    return { code, token: judgeToken, mode: this.s.mode };
  }

  async alarm() {
    if (this.s && Date.now() - (this.s.touched || 0) < ROOM_TTL) {
      await this.ctx.storage.setAlarm((this.s.touched || Date.now()) + ROOM_TTL + 60e3);
      return;
    }
    await this.wipe();
  }
  async wipe() {
    for (const ws of this.ctx.getWebSockets()) { this.send(ws, { t: "gone" }); try { ws.close(4000, "gone"); } catch {} }
    this.s = null;
    await this.ctx.storage.deleteAll();
  }
  async save() { this.s.touched = Date.now(); await this.ctx.storage.put("s", this.s); }

  async fetch() {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({});
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || m.t === "ping") return;
    if (!this.alive()) { this.send(ws, { t: "gone" }); return; }
    const att = ws.deserializeAttachment() || {};
    const s = this.s;

    if (m.t === "hello") {
      if (m.token && m.token === s.judgeToken) { ws.serializeAttachment({ judge: true }); return this.broadcast(); }
      const pid = Object.keys(s.players).find((id) => s.players[id].token && s.players[id].token === m.token);
      if (m.token && pid) { ws.serializeAttachment({ pid }); return this.broadcast(); }
      this.send(ws, { t: "need-name", mode: s.mode, phase: s.phase });
      return;
    }
    if (m.t === "join") {
      if (s.mode !== "players") return this.err(ws, "هالجلسة الحكم يسجل فيها بروحه.");
      const name = cleanName(m.name);
      if (!name) return this.err(ws, "اكتب اسمك.");
      if (s.phase !== "setup") return this.err(ws, "الجلسة بدت، انطر لين تخلص.");
      if (s.order.length >= MAX_PLAYERS) return this.err(ws, "الجلسة فلّت.");
      if (s.order.some((id) => s.players[id].name === name)) return this.err(ws, "هالاسم موجود، غيّره شوي.");
      const pid = sid(), token = tok();
      s.players[pid] = { name, token };
      s.order.push(pid);
      ws.serializeAttachment({ pid });
      this.send(ws, { t: "joined", token });
      await this.save();
      return this.broadcast();
    }

    let r;
    if (att.judge) r = await this.judgeCmd(m, ws);
    else if (att.pid && s.players[att.pid]) r = await this.playerCmd(att.pid, m, ws);
    else return;
    if (r === "wiped" || !this.s) return;
    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws) { try { ws.close(1000); } catch {} this.broadcast(ws); }
  async webSocketError(ws) { this.broadcast(ws); }
  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }
  err(ws, text) { this.send(ws, { t: "error", text }); }

  /* ---------- أدوات ---------- */
  nm(id) { return this.s.players[id]?.name || "لاعب"; }
  round() { return this.s.rounds[this.s.cur] || null; }
  roundOpen() { const r = this.round(); return this.s.phase === "play" && r && r.status === "open"; }
  // الجولة مفتوحة أو قاعدين نجمع مجاميع اللاعبين بعد ما خلصت
  roundLive() { const r = this.round(); return this.s.phase === "play" && r && (r.status === "open" || r.status === "counting"); }
  isDone(pid) { const r = this.round(); return !!(r && r.done && r.done[pid]); }
  // منو لازم يحط مجموعه الحين
  needs(pid) {
    const r = this.round(); if (!r || this.s.mode !== "players" || this.isDone(pid)) return false;
    if (r.status === "open") return r.resigned.includes(pid);
    if (r.status === "counting") return (r.need || []).includes(pid);
    return false;
  }
  isResigned(pid) { const r = this.round(); return !!(r && r.resigned.includes(pid)); }
  ev(type, extra = {}) { this.s.event = { id: sid(), at: Date.now(), type, ...extra }; }
  push(e) { const r = this.round(); e.id = sid(); e.at = Date.now(); r.ev.push(e); return e; }

  // نعيد حساب أصوات الجولة من أحداثها: الزيادة تنجمع، ومجموع البدل ينضاف لكل واحد من الاثنين
  live(r) {
    const sc = {};
    for (const id of this.s.order) sc[id] = 0;
    const cancelled = new Set(r.ev.filter((e) => e.k === "cancel").map((e) => e.target));
    for (const e of r.ev) {
      if (cancelled.has(e.id)) continue;
      if (e.k === "add") sc[e.pid] = (sc[e.pid] || 0) + e.amt;
      else if (e.k === "swap") { sc[e.a] = (sc[e.a] || 0) + e.total; sc[e.b] = (sc[e.b] || 0) + e.total; }
    }
    return sc;
  }
  roundScore(r) {
    if (r.final) return r.final;
    return this.live(r);
  }
  totals() {
    const t = {};
    for (const id of this.s.order) t[id] = 0;
    for (const r of this.s.rounds) { const sc = this.roundScore(r); for (const id in sc) t[id] = (t[id] || 0) + sc[id]; }
    return t;
  }

  /* ---------- أوامر الحكم ---------- */
  async judgeCmd(m, ws) {
    const s = this.s;
    const P = (id) => s.order.includes(id);
    switch (m.t) {
      case "addName": {
        if (s.phase !== "setup") return;
        const name = cleanName(m.name);
        if (!name) return this.err(ws, "اكتب الاسم.");
        if (s.order.length >= MAX_PLAYERS) return this.err(ws, "الجلسة فلّت.");
        if (s.order.some((id) => s.players[id].name === name)) return this.err(ws, "هالاسم موجود.");
        const pid = sid();
        s.players[pid] = { name, token: null };
        s.order.push(pid);
        return;
      }
      case "rename": {
        if (s.phase !== "setup" || !P(m.id)) return;
        const name = cleanName(m.name);
        if (!name) return this.err(ws, "اكتب الاسم.");
        if (s.order.some((id) => id !== m.id && s.players[id].name === name)) return this.err(ws, "هالاسم موجود.");
        s.players[m.id].name = name;
        return;
      }
      case "remove": {
        if (s.phase !== "setup" || !P(m.id)) return;
        s.order = s.order.filter((x) => x !== m.id);
        delete s.players[m.id];
        for (const w of this.ctx.getWebSockets()) {
          const a = w.deserializeAttachment();
          if (a && a.pid === m.id) { this.send(w, { t: "kicked" }); w.serializeAttachment({}); }
        }
        return;
      }
      case "move": {
        if (s.phase !== "setup" || !P(m.id)) return;
        const i = s.order.indexOf(m.id), j = i + (m.dir > 0 ? 1 : -1);
        if (j < 0 || j >= s.order.length) return;
        [s.order[i], s.order[j]] = [s.order[j], s.order[i]];
        return;
      }
      case "start": {
        if (s.phase !== "setup") return;
        if (s.order.length < 2) return this.err(ws, "تحتاج لاعبين اثنين على الأقل.");
        s.phase = "play"; s.rounds = []; s.cur = -1; s.pending = []; s.swapAsk = null; s.secret = null;
        s.startedAt = Date.now();
        this.openRound();
        return;
      }
      case "final": {
        // الحكم يحط مجموع لاعب بداله (تلفونه فيه مشكلة)
        if (!this.roundLive() || !P(m.id) || !this.needs(m.id)) return;
        const amt = num(m.amt);
        if (!Number.isFinite(amt) || amt < 0 || amt > MAX_AMT) return this.err(ws, "اكتب رقم صحيح.");
        s.pending = s.pending.filter((p) => !(p.kind === "final" && p.pid === m.id));
        this.recordFinal(m.id, amt, "judge", null, m.calc);
        return;
      }
      case "add": {
        if (!this.roundOpen() || !P(m.id)) return;
        if (this.isResigned(m.id)) return this.err(ws, `${this.nm(m.id)} مستقيل بهالجولة.`);
        const amt = num(m.amt);
        if (!amt || Math.abs(amt) > MAX_AMT) return this.err(ws, "اكتب رقم صحيح.");
        this.push({ k: "add", pid: m.id, amt, by: "judge", calc: String(m.calc || "").slice(0, 60) || null });
        return;
      }
      case "approve":
      case "reject": {
        const i = s.pending.findIndex((p) => p.id === m.id);
        if (i < 0) return;
        const p = s.pending[i];
        s.pending.splice(i, 1);
        if (!this.roundLive() || p.round !== s.cur) return;
        if (m.t === "reject") {
          this.push(p.kind === "swap" ? { k: "rej", kind: "swap", a: p.a, b: p.b, total: p.total, by: p.by } : { k: "rej", kind: "add", pid: p.pid, amt: p.amt });
          return;
        }
        if (p.kind === "swap") { if (!this.roundOpen()) return; return this.doSwap(p.a, p.b, p.total, ws, p.by); }
        const amt = m.amt != null && m.amt !== "" ? num(m.amt) : p.amt; // الحكم يقدر يعدل الرقم قبل لا يعتمده
        if (!Number.isFinite(amt) || amt < 0 || amt > MAX_AMT) return this.err(ws, "اكتب رقم صحيح.");
        if (!this.needs(p.pid)) return;
        this.recordFinal(p.pid, amt, "self", p.amt, p.calc);
        return;
      }
      case "swap": {
        if (!this.roundOpen()) return;
        return this.doSwap(m.a, m.b, num(m.total), ws, null);
      }
      case "swapAsk": {
        if (!this.roundOpen() || s.mode !== "players" || !P(m.a) || !P(m.b) || m.a === m.b) return;
        if (this.isResigned(m.a) || this.isResigned(m.b)) return this.err(ws, "واحد منهم مستقيل بهالجولة.");
        s.swapAsk = { a: m.a, b: m.b, round: s.cur, at: Date.now() };
        return;
      }
      case "swapAskCancel": s.swapAsk = null; return;
      case "cancel": {
        const r = this.round();
        if (!this.roundLive()) return;
        const e = r.ev.find((x) => x.id === m.id && (x.k === "add" || x.k === "swap"));
        if (!e || r.ev.some((x) => x.k === "cancel" && x.target === e.id)) return;
        if (e.k === "swap" && r.status !== "open") return;
        this.push({ k: "cancel", target: e.id });
        if (e.k === "add" && e.final && r.done) delete r.done[e.pid]; // يرجع يحط مجموعه من جديد
        return;
      }
      case "resign": {
        if (!this.roundOpen() || !P(m.id) || this.isResigned(m.id)) return;
        const r = this.round();
        r.resigned.push(m.id);
        this.push({ k: "resign", pid: m.id });
        s.pending = s.pending.filter((p) => !(p.kind === "final" && p.pid === m.id));
        if (s.swapAsk && (s.swapAsk.a === m.id || s.swapAsk.b === m.id)) s.swapAsk = null;
        this.ev("resign", { name: this.nm(m.id) });
        return;
      }
      case "end": {
        if (!this.roundOpen()) return;
        const kind = ["sort", "cards", "dissolve"].includes(m.kind) ? m.kind : null;
        if (!kind) return;
        const last = s.cur === s.order.length - 1;
        if (kind === "sort" && s.cur === 0) return this.err(ws, "الجولة الأولى ما فيها فرز.");
        if (kind === "dissolve" && (s.cur === 0 || last)) return this.err(ws, "الجولة الأولى والأخيرة ما فيها حل مجلس.");
        const r = this.round();
        // اللاعبين يحطون مجاميعهم: بالفرز وخلصة الكروت الكل، وبالحل بس المستقيلين اللي ما حطوا للحين
        const need = s.mode !== "players" ? [] : kind === "dissolve"
          ? r.resigned.filter((id) => !this.isDone(id))
          : s.order.filter((id) => !this.isDone(id));
        if (!need.length) return this.closeRound(kind);
        r.status = "counting"; r.endKind = kind; r.need = need; r.done = r.done || {};
        s.swapAsk = null; s.pending = s.pending.filter((p) => p.kind === "final");
        this.ev("count", { kind, no: r.no, last });
        return;
      }
      case "nextRound": {
        const r = this.round();
        if (s.phase !== "play" || !r || r.status !== "counting") return;
        if ((r.need || []).some((id) => !this.isDone(id))) return this.err(ws, "باقي ناس ما حطوا مجاميعهم.");
        return this.closeRound(r.endKind);
      }
      case "secret": {
        if (s.phase === "setup" || !P(m.id)) return;
        s.secret = m.id;
        this.ev("secret", { name: this.nm(m.id) });
        return;
      }
      case "secretClose": s.secret = null; return;
      case "again": {
        if (s.phase !== "over") return;
        this.archiveGame();
        s.phase = "setup"; s.rounds = []; s.cur = -1; s.pending = []; s.swapAsk = null; s.secret = null; s.gameNo = (s.gameNo || 1) + 1;
        this.ev("again");
        return;
      }
      case "finish": {
        // ينهي اللعبة قبل وقتها: الجولة المفتوحة تتسجل مثل الفرز
        if (s.phase !== "play") return;
        if (this.roundLive()) this.closeRound(this.round().endKind || "sort", true);
        this.over();
        return;
      }
      case "closeRoom": await this.wipe(); return "wiped";
    }
  }

  doSwap(a, b, total, ws, by) {
    const s = this.s;
    if (!s.order.includes(a) || !s.order.includes(b) || a === b) return;
    if (this.isResigned(a) || this.isResigned(b)) return this.err(ws, "واحد منهم مستقيل بهالجولة.");
    if (!Number.isFinite(total) || total < 0 || total > MAX_AMT) return this.err(ws, "اكتب مجموع البدل.");
    this.push({ k: "swap", a, b, total, by: by || "judge" });
    if (s.swapAsk && ((s.swapAsk.a === a && s.swapAsk.b === b) || (s.swapAsk.a === b && s.swapAsk.b === a))) s.swapAsk = null;
    s.pending = s.pending.filter((p) => !(p.kind === "swap" && ((p.a === a && p.b === b) || (p.a === b && p.b === a))));
    this.ev("swap", { a: this.nm(a), b: this.nm(b) });
  }

  recordFinal(pid, amt, by, asked, calc) {
    const r = this.round();
    this.push({ k: "add", pid, amt, by, final: true, asked: asked ?? null, calc: String(calc || "").slice(0, 60) || null });
    r.done = r.done || {}; r.done[pid] = true;
  }

  openRound() {
    const s = this.s;
    s.rounds.push({ no: s.rounds.length + 1, status: "open", resigned: [], ev: [], startedAt: Date.now() });
    s.cur = s.rounds.length - 1;
    s.pending = []; s.swapAsk = null;
    this.ev("round", { no: s.cur + 1, of: s.order.length });
  }

  closeRound(kind, silent = false) {
    const s = this.s, r = this.round();
    const counted = r.status === "counting"; // حركة النهاية طلعت أول ما خلصت الجولة، الحين بس نبدا اللي بعدها
    const sc = this.live(r);
    if (kind === "dissolve") for (const id in sc) if (!r.resigned.includes(id)) sc[id] = 0; // الحل يمسح الكل إلا المستقيلين
    r.final = sc;
    r.status = kind === "dissolve" ? "dissolved" : kind === "cards" ? "cards" : "sorted";
    r.endedAt = Date.now();
    s.pending = []; s.swapAsk = null;
    if (silent) return;
    if (counted) { if (s.cur >= s.order.length - 1) return this.over(); return this.openRound(); }
    if (s.cur >= s.order.length - 1) { this.ev(kind, { no: r.no, then: "over" }); return this.over(true); }
    this.openRound();
    this.ev(kind, { no: r.no, next: s.cur + 1, of: s.order.length });
  }

  over(keepEvent) {
    const s = this.s;
    s.phase = "over"; s.pending = []; s.swapAsk = null; s.endedAt = Date.now();
    if (!keepEvent) this.ev("over");
    else s.event.then = "over";
  }

  archiveGame() {
    const s = this.s;
    s.archive.push({
      id: sid(), no: s.gameNo || s.archive.length + 1, at: s.startedAt || Date.now(), endedAt: s.endedAt || Date.now(),
      players: s.order.map((id) => ({ id, name: this.nm(id) })), rounds: s.rounds, totals: this.totals(),
    });
    if (s.archive.length > 20) s.archive.shift();
  }

  /* ---------- أوامر اللاعب ---------- */
  async playerCmd(pid, m, ws) {
    const s = this.s;
    if (s.mode !== "players") return;
    switch (m.t) {
      case "submit": {
        if (!this.roundLive() || !this.needs(pid)) return this.err(ws, "مو وقت تحط مجموعك.");
        const amt = num(m.amt);
        if (!Number.isFinite(amt) || amt < 0 || amt > MAX_AMT) return this.err(ws, "اكتب رقم صحيح.");
        s.pending = s.pending.filter((p) => !(p.kind === "final" && p.pid === pid));
        s.pending.push({ id: sid(), kind: "final", pid, amt, calc: String(m.calc || "").slice(0, 60) || null, at: Date.now(), round: s.cur });
        this.send(ws, { t: "sent" });
        return;
      }
      case "unsubmit": {
        s.pending = s.pending.filter((p) => !(p.id === m.id && p.pid === pid));
        return;
      }
      case "swapTotal": {
        const a = s.swapAsk;
        if (!this.roundOpen() || !a || (a.a !== pid && a.b !== pid)) return;
        const total = num(m.total);
        if (!Number.isFinite(total) || total < 0 || total > MAX_AMT) return this.err(ws, "اكتب المجموع.");
        s.pending = s.pending.filter((p) => !(p.kind === "swap" && p.a === a.a && p.b === a.b));
        s.pending.push({ id: sid(), kind: "swap", a: a.a, b: a.b, total, by: pid, at: Date.now(), round: s.cur });
        s.swapAsk = null;
        this.send(ws, { t: "sent" });
        return;
      }
    }
  }

  /* ---------- اللي يوصل لكل واحد ---------- */
  onlineSet(skip) {
    const on = new Set();
    for (const w of this.ctx.getWebSockets()) { if (w === skip) continue; const a = w.deserializeAttachment(); if (a && a.pid) on.add(a.pid); }
    return on;
  }
  broadcast(skip) {
    if (!this.s) return;
    const on = this.onlineSet(skip);
    for (const w of this.ctx.getWebSockets()) {
      if (w === skip) continue;
      const a = w.deserializeAttachment() || {};
      if (!a.judge && !a.pid) continue;
      this.send(w, { t: "state", ...this.view(a, on) });
    }
  }

  // السجل كامل: كل الجولات بأحداثها وأصواتها
  record() {
    const s = this.s;
    return {
      rounds: s.rounds.map((r) => ({ no: r.no, status: r.status, resigned: r.resigned, ev: r.ev, score: this.roundScore(r), startedAt: r.startedAt, endedAt: r.endedAt || null })),
      totals: this.totals(),
    };
  }

  view(a, on) {
    const s = this.s;
    const r = this.round();
    const pub = {
      code: s.code, mode: s.mode, phase: s.phase, now: Date.now(), event: s.event, gameNo: s.gameNo || 1,
      round: r ? { no: r.no, of: s.order.length, status: r.status, resigned: r.resigned, endKind: r.endKind || null } : null,
      rounds: s.rounds.map((x) => ({ no: x.no, status: x.status })),
      players: s.order.map((id) => ({ id, name: this.nm(id), online: on.has(id), joined: !!s.players[id].token })),
      secretName: s.secret ? this.nm(s.secret) : null,
      archive: s.archive.map((g) => ({ ...g })),
    };
    if (s.phase === "over") pub.record = this.record();
    if (a.judge) {
      pub.judge = true;
      pub.record = this.record();
      pub.pending = s.pending;
      pub.swapAsk = s.swapAsk;
      pub.secret = s.secret;
      if (r && r.status === "counting") pub.counting = { need: r.need, done: r.done || {} };
      if (r && r.status === "open" && s.mode === "players") pub.resignNeed = r.resigned.filter((id) => !this.isDone(id));
      return pub;
    }
    const pid = a.pid;
    pub.me = { id: pid, name: this.nm(pid), resigned: !!(r && r.resigned.includes(pid)) };
    if (s.secret === pid) pub.record = this.record();
    // اللاعب ما يشوف أي أرقام (ولا أرقامه) إلا بالجلسة السرية. يوصله بس سؤال البدل
    if (r && s.phase === "play" && s.swapAsk && (s.swapAsk.a === pid || s.swapAsk.b === pid))
      pub.me.swapAsk = { with: this.nm(s.swapAsk.a === pid ? s.swapAsk.b : s.swapAsk.a) };
    // يطلع له «حط مجموع أصواتك» بس لما يستقيل أو تخلص الجولة
    if (r && s.phase === "play") {
      const waiting = s.pending.some((p) => p.kind === "final" && p.pid === pid);
      pub.me.ask = this.needs(pid) && !waiting;
      pub.me.waiting = waiting;
      pub.me.done = this.isDone(pid);
      pub.me.counting = r.status === "counting";
      if (r.status === "counting") pub.me.left = (r.need || []).filter((id) => !this.isDone(id)).length;
    }
    return pub;
  }
}

import { DurableObject } from "cloudflare:workers";
import { Parl } from "./parl.js";
export { Parl };

/* =========== قوانين اللعبة =========== */
const ROLE_N = {
  mafia: "مافيا", cop: "الشريييف 👮",
  doctor: "البيطري", sniper: "القناص", citizen: "فداوي",
};
const isM = (r) => r === "mafia";
const mafiaCount = (n) => 2 + Math.floor((n - 6) / 4); // ٦–٩:٢ · ١٠–١٣:٣ · ١٤–١٧:٤
const MIN_PLAYERS = 6;
const MAX_PLAYERS = 30;
const TALK = 40;
// أقصى عدد مافيا: لازم يبقى الشريف والبيطري والقناص، والمافيا أقل من الشعب
const maxMafia = (n, c = 1, d = 1) => Math.max(1, Math.min(n - (c + d + 1), Math.floor((n - 1) / 2)));
const DEF_SET = { mode: "default", mafia: 2, talk: TALK, cops: 1, docs: 1, cap: MAX_PLAYERS };
const STEPS0 = ["police", "mafia"]; // الليلة الأولى: الشريف يفتش، والمافيا يتعارفون ويختارون النصاب
const STEPS = ["mafia", "doctor", "police"];
const STEPS_ADV = ["all"]; // الإعدادات المتقدمة: بعد الليلة الأولى الكل يختار بنفس الوقت
// الأغلبية: إذا فيه اختيار واحد فايز يرجع، وإذا تعادل يرجع المتعادلين
function plurality(picks) {
  const t = {};
  for (const v of picks) if (v) t[v] = (t[v] || 0) + 1;
  const max = Math.max(0, ...Object.values(t));
  const top = Object.keys(t).filter((k) => t[k] === max);
  return { winner: max && top.length === 1 ? top[0] : null, tied: top.length > 1 ? top : [] };
}
const ROOM_TTL = 12 * 3600e3;
/* ---------- الأون لاين: القاضي الآلي ---------- */
const ON = { deal: 20, police: 45, doctor: 45, mafia: 60, all: 60, tieMore: 20, pre: 8, vote: 25, result: 8, sniper: 45, grace: 60 };
const HOST_CMDS = new Set(["settings", "start", "kick", "newGame"]);
const CHAT_MAX = 80; // الغرفة تنمسح بعد ١٢ ساعة بدون استخدام

const DEMO_NAMES = ["أحمد", "يوسف", "فهد", "ناصر", "بدر", "سالم", "مشعل", "عبدالله", "خالد", "سعود", "فيصل", "راشد", "حمد", "علي", "محمد"];
const tok = () => crypto.randomUUID().replace(/-/g, "");
const sid = () => crypto.randomUUID().slice(0, 8);
const json = (o, status = 200) =>
  new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

/* =========== المدخل =========== */
export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if ((url.pathname === "/api/create" || url.pathname === "/api/demo") && req.method === "POST") {
      // وضع التجربة: غرفة فيها لاعبين وهميين يتحكم فيهم القاضي من جهاز واحد
      const demo = url.pathname === "/api/demo" ? Math.min(15, Math.max(MIN_PLAYERS, parseInt(url.searchParams.get("n") || "8", 10) || 8)) : 0;
      for (let i = 0; i < 25; i++) {
        const code = String(1000 + Math.floor(Math.random() * 9000));
        const r = await env.ROOM.get(env.ROOM.idFromName(code)).create(code, demo, !demo && url.searchParams.get("online") === "1");
        if (r) return json(r);
      }
      return json({ error: "ما قدرت أفتح غرفة، جرّب مرة ثانية." }, 503);
    }
    if (url.pathname === "/api/exists") {
      const code = url.searchParams.get("code") || "";
      if (!/^\d{4}$/.test(code)) return json({ ok: false });
      return json({ ok: await env.ROOM.get(env.ROOM.idFromName(code)).exists() });
    }
    if (url.pathname === "/api/rtc" && req.method === "POST") {
      // الصوت بالأون لاين: الغرفة تتأكد منو يسمع منو، وبعدين تكلم كلاودفلير
      const code = url.searchParams.get("code") || "";
      if (!/^\d{4}$/.test(code)) return json({ error: "bad code" }, 400);
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    if (url.pathname === "/api/ws") {
      const code = url.searchParams.get("code") || "";
      if (!/^\d{4}$/.test(code)) return new Response("bad code", { status: 400 });
      if (req.headers.get("Upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
      return env.ROOM.get(env.ROOM.idFromName(code)).fetch(req);
    }
    /* ---------- تسجيل برلمان ---------- */
    if (url.pathname === "/api/parl/create" && req.method === "POST") {
      const mp = url.searchParams.get("mode"), mode = mp === "manual" ? "manual" : mp === "free" ? "free" : "players";
      const name = url.searchParams.get("name") || "";
      for (let i = 0; i < 25; i++) {
        const code = String(1000 + Math.floor(Math.random() * 9000));
        const r = await env.PARL.get(env.PARL.idFromName(code)).create(code, mode, name);
        if (r) return json(r);
      }
      return json({ error: "ما قدرت أفتح جلسة، جرّب مرة ثانية." }, 503);
    }
    if (url.pathname === "/api/parl/exists") {
      const code = url.searchParams.get("code") || "";
      if (!/^\d{4}$/.test(code)) return json({ ok: false });
      return json(await env.PARL.get(env.PARL.idFromName(code)).exists());
    }
    if (url.pathname === "/api/parl/ws") {
      const code = url.searchParams.get("code") || "";
      if (!/^\d{4}$/.test(code)) return new Response("bad code", { status: 400 });
      if (req.headers.get("Upgrade") !== "websocket") return new Response("websocket only", { status: 426 });
      return env.PARL.get(env.PARL.idFromName(code)).fetch(req);
    }
    if (url.pathname.startsWith("/api/")) return json({ error: "not found" }, 404);
    return env.ASSETS.fetch(req);
  },
};

/* =========== الغرفة =========== */
export class Room extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.s = null;
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get("s")) || null; });
  }

  alive() { return !!this.s && Date.now() - (this.s.touched || 0) < ROOM_TTL; }
  async exists() { return this.alive(); }

  async create(code, demo = 0, online = false) {
    if (this.alive()) return null;
    const judgeToken = tok();
    this.s = {
      code, judgeToken, createdAt: Date.now(), touched: Date.now(),
      settings: { ...DEF_SET }, players: {}, lobby: [], order: [], phase: "lobby", step: null, round: 0, gen: 0, canVote: false,
      alive: {}, roles: {}, fakeCop: null, notes: {}, night: blankNight(), votes: {}, voteOrder: [], voteTurn: 0,
      sniperPending: null, winner: null, announce: "", timer: null, event: null, log: [], demo: !!demo,
      online: !!online, hostPid: null, deadline: null, chats: { mafia: [], grave: [] }, offSince: {},
    };
    const players = [];
    for (let i = 0; i < demo; i++) {
      const pid = sid(), token = tok(), name = DEMO_NAMES[i];
      this.s.players[pid] = { name, token, at: Date.now() + i };
      this.s.lobby.push(pid);
      players.push({ id: pid, name, token });
    }
    await this.save();
    await this.ctx.storage.setAlarm(Date.now() + ROOM_TTL + 60e3);
    return { code, token: judgeToken, players };
  }

  async alarm() {
    if (this.s && this.s.online && this.s.deadline && Date.now() >= this.s.deadline - 80) {
      this.s.deadline = null;
      try { this.tick(); } catch (e) { console.log("tick", e && e.stack); }
      await this.save(); this.broadcast(); await this.schedule(); this.rtcEnforce();
      return;
    }
    if (this.s && Date.now() - (this.s.touched || 0) < ROOM_TTL) {
      await this.ctx.storage.setAlarm((this.s.touched || Date.now()) + ROOM_TTL + 60e3);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) try { ws.close(4000, "expired"); } catch {}
    this.s = null;
    await this.ctx.storage.deleteAll();
  }

  async save() { this.s.touched = Date.now(); await this.ctx.storage.put("s", this.s); }
  // المنبه: وقت الخطوة الجاية بالأون لاين، وإلا وقت مسح الغرفة
  async schedule() {
    if (!this.s) return;
    const ttl = (this.s.touched || Date.now()) + ROOM_TTL + 60e3;
    await this.ctx.storage.setAlarm(this.s.online && this.s.deadline ? Math.min(this.s.deadline, ttl) : ttl);
  }

  async fetch(req) {
    if (req && new URL(req.url).pathname === "/api/rtc") return this.rtc(req);
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
      const pid = Object.keys(s.players).find((id) => s.players[id].token === m.token);
      if (m.token && pid) { ws.serializeAttachment({ pid }); if (s.offSince && s.offSince[pid]) { delete s.offSince[pid]; if (s.online && s.phase !== "lobby") this.notice(`${this.nm(pid)} رجع للعبة`); } return this.broadcast(); }
      this.send(ws, { t: "need-name", phase: s.phase });
      return;
    }
    if (m.t === "join") {
      const name = String(m.name || "").trim().replace(/\s+/g, " ").slice(0, 24);
      if (!name) return this.err(ws, "اكتب اسمك.");
      if (s.phase !== "lobby") return this.err(ws, "اللعبة بدت، انطر لين تخلص الجولة.");
      if (s.lobby.length >= this.capFor()) return this.err(ws, "خلاص سكرنا، العدد اكتمل.");
      if (s.lobby.some((id) => s.players[id].name === name)) return this.err(ws, "هالاسم مستخدم، غيّره شوي.");
      const pid = sid(), token = tok();
      s.players[pid] = { name, token, at: Date.now() };
      s.lobby.push(pid);
      if (s.online && !s.hostPid) s.hostPid = pid; // أول واحد يدخل الغرفة الأون لاين هو المضيف
      ws.serializeAttachment({ pid });
      this.send(ws, { t: "joined", token });
      await this.save();
      return this.broadcast();
    }

    if (att.judge) await this.judgeCmd(m);
    else if (att.pid && s.online && att.pid === s.hostPid && HOST_CMDS.has(m.t)) await this.judgeCmd(m);
    else if (att.pid && s.players[att.pid]) await this.playerCmd(att.pid, m, ws);
    else return;
    if (!this.s) return; // الغرفة تسكّرت
    if (s.online) this.autoAdvance();
    await this.save();
    this.broadcast();
    await this.schedule();
    if (s.online) this.rtcEnforce();
  }

  async webSocketClose(ws) {
    try { ws.close(1000); } catch {}
    const a = ws.deserializeAttachment() || {}, s = this.s;
    if (s && s.online && a.pid && s.players[a.pid] && s.phase !== "lobby" && s.phase !== "over") {
      const still = [...this.ctx.getWebSockets()].some((w) => w !== ws && (w.deserializeAttachment() || {}).pid === a.pid);
      if (!still) { (s.offSince = s.offSince || {})[a.pid] = Date.now(); this.notice(`${this.nm(a.pid)} طلع من اللعبة، وممكن يغش 👀`); await this.save(); }
    }
    this.broadcast(ws);
  }
  async closeRoom(text) {
    for (const w of this.ctx.getWebSockets()) { this.send(w, { t: "gone", text }); try { w.close(1000, "closed"); } catch {} }
    this.s = null;
    await this.ctx.storage.deleteAll();
  }
  notice(text) { for (const w of this.ctx.getWebSockets()) this.send(w, { t: "notice", text }); }
  async webSocketError(ws) { this.broadcast(ws); }

  send(ws, o) { try { ws.send(JSON.stringify(o)); } catch {} }
  err(ws, text) { this.send(ws, { t: "error", text }); }

  /* ---------- من موجود الحين ---------- */
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

  view(a, on) {
    const s = this.s;
    const ids = s.phase === "lobby" ? s.lobby : s.order;
    const pub = {
      code: s.code, phase: s.phase, step: s.step, round: s.round, gen: s.gen, canVote: s.canVote,
      announce: s.announce, sniperPending: s.sniperPending, winner: s.winner, now: Date.now(),
      timer: s.timer, event: s.event, minPlayers: MIN_PLAYERS, stepDone: s.phase === "night" || s.phase === "night0" ? this.stepDone() : true, talked: s.phase === "day" ? s.talked || {} : {},
      players: ids.filter((id) => s.players[id]).map((id) => ({
        id, name: s.players[id].name, alive: s.phase === "lobby" ? true : !!s.alive[id], online: on.has(id),
      })),
    };
    if ((s.phase === "vote" || s.phase === "result") && (s.voteOrder || []).length)
      pub.vote = { order: s.voteOrder, turn: s.voteTurn, votes: s.votes, cur: this.curVoter() };
    pub.adv = s.phase === "lobby" ? !!this.sets().adv : this.adv();
    if (s.phase === "lobby" && !s.online) pub.ready = s.ready || {};
    if (s.online) {
      pub.online = true; pub.deadline = s.deadline; pub.hostId = s.hostPid;
      if (["day", "vote", "result"].includes(s.phase)) pub.copsUp = this.aliveIds().filter((i) => s.roles[i] === "cop" || this.isFake(i));
    }
    if (this.adv() && ["day", "vote", "result"].includes(s.phase) && s.suspect) pub.suspect = s.suspect;
    if (s.phase === "over" && (this.adv() || s.online)) pub.detectives = this.detectives();
    if (s.phase === "over") pub.best = this.best();
    if (s.phase === "over") pub.reveal = Object.fromEntries(s.order.map((id) => [id, { role: s.roles[id], fake: this.isFake(id) }]));
    if (a.judge) {
      pub.judge = {
        roles: s.roles, fakeCop: s.fakeCop, night: { ...s.night, queried: this.qmap(), save: this.smap() }, votes: s.votes, log: s.log.slice(-60),
        queriesLeft: s.order.filter((i) => s.roles[i] === "cop" && s.alive[i]).reduce((a, i) => a + Math.max(0, (s.queryMax || 0) - this.qUsed(i)), 0), queryMax: s.queryMax || 0,
        mafiaNext: s.lobby.length >= MIN_PLAYERS ? this.mafiaFor(s.lobby.length) : null,
        settings: this.sets(), cap: this.capFor(), talk: this.talkSec(), fakes: this.fakes(), fakeNeed: s.fakeNeed || 1,
        mafiaMax: maxMafia(Math.max(s.lobby.length, MIN_PLAYERS), this.copsFor(s.lobby.length), this.docsFor(s.lobby.length)),
        rolesMax: Math.max(1, Math.max(s.lobby.length, MIN_PLAYERS) - this.mafiaFor(Math.max(s.lobby.length, MIN_PLAYERS)) - 2),
        missing: this.adv() && (s.phase === "night" || s.phase === "night0") ? this.aliveIds().filter((i) => this.todo(i).length) : [],
        cops: Object.fromEntries(s.order.filter((i) => s.roles[i] === "cop").map((i) => [i, { left: Math.max(0, (s.queryMax || 0) - this.qUsed(i)), q: this.qmap()[i] || null }])),
      };
      return pub;
    }
    const pid = a.pid, role = s.roles[pid];
    pub.me = { id: pid, name: s.players[pid]?.name, inGame: s.order.includes(pid) && s.phase !== "lobby" };
    if (s.online && pid === s.hostPid) {
      pub.me.host = true;
      if (s.phase === "lobby") pub.hostJ = {
        settings: this.sets(), cap: this.capFor(), talk: this.talkSec(),
        mafiaNext: s.lobby.length >= MIN_PLAYERS ? this.mafiaFor(s.lobby.length) : null,
        mafiaMax: maxMafia(Math.max(s.lobby.length, MIN_PLAYERS), this.copsFor(s.lobby.length), this.docsFor(s.lobby.length)),
      };
    }
    if (s.online && s.players[pid]) {
      const allow = this.rtcAllowed(pid);
      pub.me.voice = { on: !!this.rtcCfg(), talk: this.rtcCanTalk(pid), mafia: this.rtcCanMafia(pid), hear: allow.map((k) => k.split(":")[0]), key: allow.join(",") };
    }
    if (role && pub.me.inGame) {
      Object.assign(pub.me, { role, fake: this.isFake(pid), notes: s.notes[pid] || [] });
      if (role === "cop") Object.assign(pub.me, { queriesLeft: Math.max(0, (s.queryMax || 0) - this.qUsed(pid)), queryMax: s.queryMax || 0, queryMafia: this.qmap()[pid] ? isM(s.roles[this.qmap()[pid]]) : null });
      if (isM(role)) Object.assign(pub.me, { fakesDone: s.fakesDone || [], fakeNeed: s.fakeNeed || 1, fakeJudge: s.phase === "night0" ? this.judgeFakes() : [] });
      const n = s.night;
      if (isM(role)) pub.me.team = s.order.filter((i) => isM(s.roles[i])).map((i) => ({
        id: i, role: s.roles[i], fake: this.isFake(i),
        pick: s.phase === "night0" ? (n.fake || {})[i] || null : s.phase === "night" ? n.sugg[i] || null : null,
        at: s.phase === "night" ? (n.suggAt || {})[i] || 0 : 0,
      }));
      pub.me.sel = {
        fakecop: isM(role) ? (n.fake || {})[pid] || null : null,
        kill: isM(role) ? n.sugg[pid] || null : null,
        save: role === "doctor" ? this.smap()[pid] || null : null,
        query: role === "cop" ? this.qmap()[pid] || null : null,
        vote: s.votes[pid] || null,
        guess: (n.guess || {})[pid] || null,
        fguess: (n.fguess || {})[pid] || null,
      };
      if (s.online && pub.me.inGame) {
        const ch = s.chats || {}, dead = !s.alive[pid];
        pub.me.chat = {};
        if (isM(role) || dead) pub.me.chat.mafia = { msgs: (ch.mafia || []).slice(-CHAT_MAX), write: isM(role) && !dead && (s.phase === "night" || s.phase === "night0") };
        if (dead) pub.me.chat.grave = { msgs: (ch.grave || []).slice(-CHAT_MAX), write: s.phase !== "over" };
        if (!this.adv() && (s.phase === "night" || s.phase === "night0") && !dead) pub.me.canGuess = true;
      }
      if (this.adv() && (s.phase === "night" || s.phase === "night0")) {
        pub.me.todo = this.todo(pid);
        pub.me.nightTop = { guess: this.top(n.guess), fguess: this.top(n.fguess) };
        if (role === "cop") { const q = this.qmap()[pid]; pub.me.lastQuery = q ? { id: q, mafia: isM(s.roles[q]) } : null; }
      }
    }
    return pub;
  }

  /* ---------- أدوات ---------- */
  nm(id) { return this.s.players[id]?.name || "لاعب"; }
  // إعدادات الغرفة: افتراضي أو مخصص من القاضي
  sets() { return this.s.settings || DEF_SET; }
  // عدد الشرطة والبياطرة (بالمخصص بس)، والشرطة ما يزيدون عن المافيا عشان النصابين
  // بالمخصص القاضي حر: الأعداد مثل ما حطها (الشرط الوحيد إن الأدوار ما تزيد عن اللاعبين)
  copsFor(n) { const c = this.sets(); return c.mode === "custom" ? Math.max(1, c.cops || 1) : 1; }
  docsFor(n) { const c = this.sets(); return c.mode === "custom" ? Math.max(1, c.docs || 1) : 1; }
  mafiaFor(n) { const c = this.sets(); return c.mode === "custom" ? Math.max(1, c.mafia || 1) : mafiaCount(n); }
  // عدد اللاعبين المسموح: بالمخصص القاضي يحدده، والباقي ٣٠
  capFor() { const c = this.sets(); return c.mode === "custom" ? Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, c.cap || MAX_PLAYERS)) : MAX_PLAYERS; }
  // النصابين: اللي تأكدوا + اللي المافيا مختارينه الحين
  fakes() { const s = this.s; return [...(s.fakesDone || []), s.fakeCop].filter(Boolean); }
  isFake(id) { return this.fakes().includes(id); }
  // النصابين اللي القاضي عيّنهم بدال المافيا (لما تعادلوا أو ما اختاروا)
  judgeFakes() { const s = this.s; return [...(s.fakesJudge || []), ...(s.night.fakeByJudge && s.fakeCop ? [s.fakeCop] : [])]; }
  qmap() { const q = this.s.night.queried; return q && typeof q === "object" ? q : {}; }
  smap() { const v = this.s.night.save; return v && typeof v === "object" ? v : {}; }
  qUsed(id) { const u = this.s.queriesUsed; return u && typeof u === "object" ? u[id] || 0 : 0; }
  talkSec() { const c = this.sets(); return c.mode === "custom" ? c.talk : TALK; }
  aliveIds() { return this.s.order.filter((i) => this.s.alive[i]); }
  /* ---------- الإعدادات المتقدمة ---------- */
  adv() { return !!this.s.advOn; }
  stepsFor(p) { return p === "night0" ? STEPS0 : this.adv() ? STEPS_ADV : STEPS; }
  isStep(k) { return this.s.step === k || this.s.step === "all"; }
  // شنو باقي على اللاعب يسويه بالخطوة الحالية (عشان كل الشاشات تمشي بنفس الطريقة)
  todo(pid) {
    const s = this.s, n = s.night, r = s.roles[pid], out = [];
    if (!this.adv() || !s.alive[pid] || !(s.phase === "night" || s.phase === "night0")) return out;
    const g = n.guess || {}, fg = n.fguess || {};
    if (s.phase === "night0") {
      if (s.step === "police") { if (r === "cop" && !this.qmap()[pid] && this.qUsed(pid) < (s.queryMax || 0)) out.push("query"); if (!g[pid]) out.push("guess"); }
      else if (s.step === "mafia") { if (isM(r)) { if (!this.stepDone()) out.push("fake"); } else if (!fg[pid]) out.push("fguess"); }
      return out;
    }
    if (isM(r) && !(n.kill && (n.killByJudge || n.sugg[pid] === n.kill))) out.push("kill");
    if (r === "doctor" && !this.smap()[pid]) out.push("save");
    if (r === "cop" && !this.qmap()[pid] && this.qUsed(pid) < (s.queryMax || 0)) out.push("query");
    if (!g[pid]) out.push("guess");
    return out;
  }
  // أكثر واحد مختار بخريطة تخمينات
  top(map) { const t = {}; for (const [a, b] of Object.entries(map || {})) if (this.s.alive[a] && this.s.alive[b]) t[b] = (t[b] || 0) + 1; const ids = Object.keys(t); if (!ids.length) return null; ids.sort((a, b) => t[b] - t[a]); return { id: ids[0], n: t[ids[0]] }; }
  // نقاط المحقق: تخمين صح على مافيا أو النصاب، للشعب بس، وما تبين إلا بنهاية اللعبة
  scoreNight() {
    const s = this.s, n = s.night;
    if (!this.adv() && !s.online) return;
    const pts = (s.dpts = s.dpts || {});
    for (const [a, b] of Object.entries(n.guess || {})) if (!isM(s.roles[a]) && isM(s.roles[b])) pts[a] = (pts[a] || 0) + 1;
    if (s.phase === "night0") for (const [a, b] of Object.entries(n.fguess || {})) if (!isM(s.roles[a]) && this.isFake(b)) pts[a] = (pts[a] || 0) + 1;
  }
  // خريطة شك الشعب للصبح: نسبة بس، بدون منو خمّن منو
  suspectMap() {
    const s = this.s, t = {}, g = s.night.guess || {};
    for (const b of Object.values(g)) if (s.alive[b] !== undefined) t[b] = (t[b] || 0) + 1;
    const total = Object.values(t).reduce((a, b) => a + b, 0);
    s.suspect = total ? { total, list: Object.entries(t).sort((a, b) => b[1] - a[1]).map(([id, c]) => ({ id, pct: Math.round((c / total) * 100) })) } : null;
  }
  // اللي انغتال الصبح ما يطلع بخريطة الشك، والنسب تنحسب من جديد
  filterSuspect(sp) {
    const s = this.s, raw = Object.entries(s.night.guess || {}).filter(([, b]) => s.alive[b]).map(([, b]) => b);
    if (!raw.length) return null;
    const t = {}; raw.forEach((b) => (t[b] = (t[b] || 0) + 1));
    return { total: raw.length, list: Object.entries(t).sort((a, b) => b[1] - a[1]).map(([id, c]) => ({ id, pct: Math.round((c / raw.length) * 100) })) };
  }
  detectives() {
    const s = this.s, p = s.dpts || {};
    return Object.entries(p).filter(([id, v]) => v > 0 && !isM(s.roles[id])).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id, v]) => ({ id, name: this.nm(id), pts: v }));
  }
  // منو دوره يصوّت الحين
  curVoter() {
    const s = this.s;
    if (s.phase !== "vote") return null;
    while (s.voteTurn < s.voteOrder.length && !s.alive[s.voteOrder[s.voteTurn]]) s.voteTurn++;
    return s.voteOrder[s.voteTurn] || null;
  }
  castVote(v, t) {
    const s = this.s;
    if (!v || v !== this.curVoter() || !s.alive[t] || t === v) return;
    s.votes[v] = t;
    s.voteTurn++;
    this.curVoter();
    if (s.online) { if (this.curVoter()) this.setDl(ON.vote); else s.deadline = Date.now() + 1500; }
    s.announce = this.curVoter() ? `دور ${this.nm(this.curVoter())} يصوّت.` : s.online ? "الكل صوّت، النتيجة طالعة." : "الكل صوّت. القاضي بيطلّع النتيجة.";
  }
  log(t) { this.s.log.push(t); if (this.s.log.length > 120) this.s.log.shift(); }
  ev(type, extra = {}) { this.s.event = { id: sid(), at: Date.now(), type, ...extra }; }
  note(id, t) { (this.s.notes[id] = this.s.notes[id] || []).push(t); }

  /* ---------- أوامر القاضي ---------- */
  async judgeCmd(m) {
    const s = this.s, id = m.id;
    switch (m.t) {
      case "kick":
        if (s.phase === "lobby" && s.players[id]) {
          s.lobby = s.lobby.filter((x) => x !== id); delete s.players[id]; if (s.ready) delete s.ready[id];
          for (const w of this.ctx.getWebSockets()) {
            const a = w.deserializeAttachment();
            if (a && a.pid === id) { this.send(w, { t: "kicked" }); w.serializeAttachment({}); }
          }
        }
        break;
      case "settings": // القاضي يغير الإعدادات قبل التوزيع
        if (s.phase === "lobby") {
          const mode = m.mode === "custom" ? "custom" : "default";
          const mafia = Math.max(1, Math.min(MAX_PLAYERS, parseInt(m.mafia, 10) || 2));
          const talk = Math.max(10, Math.min(300, Math.round((parseInt(m.talk, 10) || TALK) / 5) * 5));
          const cops = Math.max(1, Math.min(MAX_PLAYERS, parseInt(m.cops, 10) || 1));
          const docs = Math.max(1, Math.min(MAX_PLAYERS, parseInt(m.docs, 10) || 1));
          const cap = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, parseInt(m.cap, 10) || MAX_PLAYERS));
          s.settings = { mode, mafia, talk, cops, docs, cap, adv: !!(+m.adv) };
        }
        break;
      case "start": return this.start();
      case "begin":
        // القاضي يبدا اللعبة بعد ما شاف الكل أدوارهم، والكروت تنشال
        if (s.phase === "deal") { Object.assign(s, { phase: "night0", step: "police", announce: "الليلة الأولى بدت." }); this.ev("dusk"); }
        break;
      case "next": return this.next();
      case "night": return this.goNight();
      case "vote":
        if (s.phase === "day" && s.canVote && !s.sniperPending) {
          const o = this.aliveIds();
          for (let i = o.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
          s.votes = {}; s.voteOrder = o; s.voteTurn = 0; s.phase = "vote"; s.timer = null;
          s.announce = `التصويت بالدور. أول واحد: ${this.nm(o[0])}.`;
        }
        break;
      case "closeVote": if (s.phase === "vote" && !this.curVoter()) this.closeVote(); break; // لازم الكل يصوّت
      case "voteFor": if (s.phase === "vote") this.castVote(this.curVoter(), id); break; // القاضي يصوّت بدال اللي تلفونه فيه مشكلة
      case "talk":
        if (s.phase === "day" && s.alive[id] && !s.sniperPending) { s.timer = { pid: id, name: this.nm(id), endsAt: Date.now() + this.talkSec() * 1000, dur: this.talkSec(), id: sid() }; (s.talked = s.talked || {})[id] = true; s.announce = ""; }
        break;
      case "stopT": s.timer = null; break;
      case "restartT": if (s.timer && s.phase === "day") s.timer = { ...s.timer, endsAt: Date.now() + (s.timer.dur || this.talkSec()) * 1000, id: sid() }; break;
      case "closeFx": // القاضي يسكر صورة النتيجة عند الكل
        if (s.event) { s.event.closed = true; if (s.event.after) s.event.after.closed = true; }
        break;
      case "setFake":
        if (s.phase === "night0" && isM(s.roles[id]) && s.alive[id] && !(s.fakesDone || []).includes(id)) { s.fakeCop = id; s.night.fakeByJudge = true; this.log(`القاضي حط ${this.nm(id)} نصاب`); this.lockFake(); }
        break;
      case "killFor": // تلفونات المافيا فيها مشكلة: القاضي يختار منو ينغتال
        if (s.phase === "night" && this.isStep("mafia") && s.alive[id]) { s.night.kill = id; s.night.killByJudge = true; this.log(`القاضي اختار الاغتيال بدال المافيا: ${this.nm(id)}`); }
        break;
      case "saveFor":
        if (s.phase === "night" && this.isStep("doctor") && s.alive[id]) {
          const docs = this.aliveIds().filter((i) => s.roles[i] === "doctor"), sv = this.smap();
          const by = docs.includes(m.by) ? m.by : docs.find((i) => !sv[i]);
          if (by) { s.night.save = { ...sv, [by]: id }; this.log(`القاضي فزع بدال ${this.nm(by)}: ${this.nm(id)}`); }
        }
        break;
      case "queryFor": {
        const cops = this.aliveIds().filter((i) => s.roles[i] === "cop"), q = this.qmap();
        const cop = cops.includes(m.by) ? m.by : cops.find((i) => !q[i] && this.qUsed(i) < (s.queryMax || 0));
        if (cop) this.doQuery(cop, id); break;
      }
      case "pickKill":
        if (s.phase === "night" && this.isStep("mafia") && Object.values(s.night.sugg).includes(id)) { s.night.kill = id; s.night.killByJudge = true; }
        break;
      case "snipeFor": if (s.sniperPending && s.alive[id] && id !== s.sniperPending) this.resolveSnipe(s.sniperPending, id); break;
      case "newGame":
        Object.assign(s, { phase: "lobby", step: null, round: 0, timer: null, sniperPending: null, winner: null, announce: "", event: null, order: [], alive: {}, roles: {}, fakeCop: null, fakesDone: [], notes: {}, votes: {}, voteOrder: [], voteTurn: 0, night: blankNight(), advOn: false, dpts: {}, suspect: null, deadline: null, talkQ: [], chats: { mafia: [], grave: [] }, offSince: {} });
        break;
    }
  }

  start() {
    const s = this.s;
    const ids = s.lobby.filter((id) => s.players[id]);
    if (s.phase !== "lobby" || ids.length < MIN_PLAYERS) return;
    // بغرفة القاضي: ما تبدا لين الكل يدوس جاهز (التجربة ما تحتاج)
    if (!s.online && !s.demo && !ids.every((id) => (s.ready || {})[id])) return;
    const sh = [...ids];
    for (let i = sh.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [sh[i], sh[j]] = [sh[j], sh[i]]; }
    const n = ids.length, cu = this.sets().mode === "custom", roles = {};
    let m = this.mafiaFor(n), c = cu ? this.copsFor(n) : Math.min(this.copsFor(n), m), d = this.docsFor(n);
    // بالمخصص: إذا الأدوار أكثر من اللاعبين ما نوزع (القاضي يعدّل الأعداد)
    if (cu && m + c + d + 1 > n) return;
    while (m + c + d + 1 > n && d > 1) d--;
    while (m + c + d + 1 > n && c > 1) c--;
    sh.forEach((id, i) => { roles[id] = i < m ? "mafia" : i < m + c ? "cop" : i < m + c + d ? "doctor" : i === m + c + d ? "sniper" : "citizen"; });
    Object.assign(s, {
      gen: s.gen + 1, order: ids, roles, alive: Object.fromEntries(ids.map((i) => [i, true])),
      phase: "deal", step: null, round: 0, timer: null, sniperPending: null, winner: null, canVote: false,
      fakeCop: null, fakesDone: [], fakesJudge: [], fakeNeed: Math.min(c, m), advOn: !!this.sets().adv && !s.online, dpts: {}, suspect: null, notes: {}, votes: {}, voteOrder: [], voteTurn: 0, voteHist: [], night: blankNight(), log: [], queryMax: m, queriesUsed: {},
      announce: "كل واحد يقلب كرته ويشوف دوره.",
    });
    s.ready = {};
    this.ev("deal");
    if (s.online) { s.chats = { mafia: [], grave: [] }; s.offSince = {}; s.talkQ = []; this.setDl(ON.deal); }
    this.log(`بدت اللعبة: ${n} لاعبين، ${m} مافيا${c > 1 ? `، ${c} شرطة` : ""}${d > 1 ? `، ${d} بياطرة` : ""}`);
  }

  next(force = false) {
    const s = this.s;
    if (s.phase !== "night0" && s.phase !== "night") return;
    if (!force && !this.stepDone()) return;
    const steps = this.stepsFor(s.phase);
    const i = steps.indexOf(s.step);
    if (i < steps.length - 1) { s.step = steps[i + 1]; if (s.online) this.setDl(ON[s.step]); return; }
    this.scoreNight();
    if (s.phase === "night0") {
      // نخبر المافيا إذا القاضي عيّن النصاب عنهم
      for (const f of this.judgeFakes()) for (const mm of this.aliveIds().filter((i) => isM(s.roles[i])))
        this.note(mm, `${s.online ? "اللعبة اختارت عنكم" : "القاضي اختار عنكم"}: ${mm === f ? "أنت صرت النصاب" : `صار ${this.nm(f)} النصاب`}`);
      if (this.adv()) this.suspectMap();
      Object.assign(s, { phase: "day", step: null, round: 1, canVote: false, talked: {}, announce: "الصبح. الشرطة يرفعون إيدهم." });
      this.ev("dawn");
      if (s.online) this.dayStart();
      return;
    }
    if (this.adv()) this.suspectMap();
    this.resolveMorning();
    if (s.suspect) s.suspect = this.filterSuspect(s.suspect);
  }

  goNight() {
    const s = this.s;
    if (s.sniperPending) return;
    if (!(s.phase === "result" || (s.phase === "day" && !s.canVote))) return;
    Object.assign(s, { phase: "night", step: this.stepsFor("night")[0], suspect: null, timer: null, talkQ: [], votes: {}, voteOrder: [], voteTurn: 0, night: blankNight(), announce: "الليل بدا. كل واحد يتابع تلفونه." });
    this.ev("dusk");
    if (s.online) this.setDl(ON[s.step]);
  }

  eliminate(id, why) { this.s.alive[id] = false; this.log(`${this.nm(id)} طلع (${why}) ← ${ROLE_N[this.s.roles[id]]}`); }

  resolveMorning() {
    const s = this.s, k = s.night.kill, saved = Object.values(this.smap());
    let msg;
    if (!k) { msg = "المافيا ما عرفوا يغتالون أحد الليلة."; this.ev("nokill"); }
    else if (saved.includes(k)) { msg = "اغتيال شامط، البيطري موجووووود 🔥"; this.log(`البيطري لحّق على ${this.nm(k)}`); this.ev("saved"); }
    else {
      this.eliminate(k, "اغتيال");
      msg = `${s.roles[k] === "sniper" ? `ودّع ${this.nm(k)}` : `تم اغتيال ${this.nm(k)}`} وطلع من اللعبة. صيدة سهلة والبيطري مدوّج 😴`;
      const sniper = s.roles[k] === "sniper";
      if (sniper) { msg += ` ${this.nm(k)} قناص، بيسحب واحد وياه.`; s.sniperPending = k; }
      this.ev("kill", { who: this.nm(k), sniper });
    }
    Object.assign(s, { phase: "day", step: null, round: s.round + 1, canVote: true, talked: {}, announce: msg, timer: null });
    if (!s.sniperPending) this.checkWin();
    if (s.online && s.phase === "day") this.dayStart();
  }

  closeVote() {
    const s = this.s, t = {};
    (s.voteHist = s.voteHist || []).push({ ...s.votes });
    this.aliveIds().forEach((v) => { const x = s.votes[v]; if (x && s.alive[x]) t[x] = (t[x] || 0) + 1; });
    const max = Math.max(0, ...Object.values(t));
    const top = Object.keys(t).filter((k) => t[k] === max);
    let msg;
    if (max === 0) { msg = "ما أحد صوّت، التصويت ما ينحسب."; this.ev("tie", { none: true }); }
    else if (top.length > 1) { msg = "تعادلوا بالأصوات، التصويت ما ينحسب."; this.log("تعادل بالتصويت"); this.ev("tie"); }
    else {
      const o = top[0];
      this.eliminate(o, "تصويت");
      msg = `${this.nm(o)} طلع بالتصويت (${max} صوت).`;
      const sniper = s.roles[o] === "sniper";
      if (sniper) { msg += ` ${this.nm(o)} قناص، بيسحب واحد وياه.`; s.sniperPending = o; }
      this.ev("out", { who: this.nm(o), votes: max, sniper });
    }
    s.announce = msg;
    s.phase = "result";
    if (!s.sniperPending) this.checkWin();
    if (s.online && s.phase === "result") this.setDl(s.sniperPending ? ON.sniper : ON.result);
  }

  resolveSnipe(sn, t) {
    const s = this.s;
    this.eliminate(t, "سحبه القناص");
    this.note(sn, `سحبت ${this.nm(t)} وياك، دوره: ${ROLE_N[s.roles[t]]}${this.isFake(t) ? " (النصاب)" : ""}`);
    s.sniperPending = null;
    s.announce = (s.announce || "") + ` القناص سحب ${this.nm(t)} وياه.`;
    this.ev("snipe", { who: this.nm(t) });
    this.checkWin();
    if (s.online && s.phase === "day" && !s.timer) this.setDl(ON.pre);
    if (s.online && s.phase === "result") this.setDl(ON.result);
  }

  // أفضل لاعبين من الشعب: الأكثر تصويت صح على المافيا، وإذا تعادلوا الأقل غلط
  best() {
    const s = this.s, sc = {};
    for (const round of s.voteHist || []) for (const [v, t] of Object.entries(round)) {
      if (isM(s.roles[v]) || !s.roles[v]) continue;
      const x = (sc[v] = sc[v] || { ok: 0, bad: 0 });
      if (isM(s.roles[t])) x.ok++; else x.bad++;
    }
    return Object.entries(sc).filter(([, x]) => x.ok > 0)
      .sort((a, b) => b[1].ok - a[1].ok || a[1].bad - b[1].bad)
      .slice(0, 3).map(([id]) => ({ id, name: this.nm(id) }));
  }

  checkWin() {
    const s = this.s, al = this.aliveIds();
    const m = al.filter((i) => isM(s.roles[i])).length, t = al.length - m;
    let w = null;
    if (m === 0) w = "town"; else if (m >= t) w = "mafia";
    if (!w) return;
    Object.assign(s, { phase: "over", winner: w, timer: null, step: null, deadline: null });
    s.announce = w === "town" ? "الشعب فاز! صادوا كل المافيا." : "المافيا فازت! صاروا قد الشعب.";
    const prev = s.event;
    this.ev("win", { winner: w, after: prev && prev.type !== "win" ? prev : null });
    this.log(s.announce);
  }

  // تفتيشات الشريف كلها باللعبة بعدد المافيا، وحدة بالليلة
  doQuery(cop, t) {
    const s = this.s, n = s.night;
    if (!((s.phase === "night" || s.phase === "night0") && this.isStep("police") && s.alive[cop] && s.alive[t] && t !== cop && !this.qmap()[cop] && this.qUsed(cop) < (s.queryMax || 0))) return;
    n.queried = { ...this.qmap(), [cop]: t };
    s.queriesUsed = { ...(s.queriesUsed && typeof s.queriesUsed === "object" ? s.queriesUsed : {}), [cop]: this.qUsed(cop) + 1 };
    const ans = isM(s.roles[t]) ? "مافيا" : "شعب";
    this.note(cop, `${s.phase === "night0" ? "الليلة الأولى" : "الليلة " + s.round}: ${this.nm(t)} طلع ${ans}`);
    this.log(`${this.nm(cop)} (الشريف) فتّش عن ${this.nm(t)} ← ${ans}`);
  }

  // يثبت النصاب الحالي إذا باقي نصابين بعده
  lockFake() {
    const s = this.s, done = s.fakesDone || [];
    if (!s.fakeCop || done.length + 1 >= (s.fakeNeed || 1)) return;
    if (s.night.fakeByJudge) s.fakesJudge = [...(s.fakesJudge || []), s.fakeCop];
    s.fakesDone = [...done, s.fakeCop]; s.fakeCop = null; s.night.fake = {}; s.night.fakeByJudge = false;
  }

  /* =========== الصوت (كلاودفلير Realtime) =========== */
  rtcCfg() { const e = this.env || {}; return e.REALTIME_APP_ID && e.REALTIME_APP_TOKEN ? { id: e.REALTIME_APP_ID, token: e.REALTIME_APP_TOKEN } : null; }
  // يتكلم بالمايك العام: قبل اللعبة وبعدها الكل، ووسط اللعبة بس صاحب الدور
  rtcCanTalk(pid) {
    const s = this.s;
    if (!s.online) return false;
    if (s.phase === "lobby" || s.phase === "over") return true;
    return s.phase === "day" && !!s.timer && s.timer.pid === pid && !!s.alive[pid];
  }
  // مكالمة المافيا: بالليل بس، للمافيا الأحياء
  rtcCanMafia(pid) { const s = this.s; return !!s.online && (s.phase === "night" || s.phase === "night0") && isM(s.roles[pid]) && !!s.alive[pid]; }
  // منو يسمع منو: "pid:talk" أو "pid:mafia"
  rtcAllowed(pid) {
    const s = this.s, rtc = s.rtc || {}, out = [];
    if (!s.online || !s.players[pid]) return out;
    const has = (p, n) => rtc[p] && rtc[p].prod && rtc[p].live && (rtc[p].pub || []).includes(n);
    const ids = s.phase === "lobby" ? s.lobby : s.order;
    if (s.phase === "lobby" || s.phase === "over") { for (const p of ids) if (p !== pid && has(p, "talk")) out.push(p + ":talk"); return out; }
    if (s.phase === "day" && s.timer && s.timer.pid !== pid && has(s.timer.pid, "talk")) out.push(s.timer.pid + ":talk");
    if (s.phase === "night" || s.phase === "night0") {
      const dead = !s.alive[pid], meM = isM(s.roles[pid]) && !dead;
      if (meM || (dead && s.order.includes(pid))) for (const p of this.aliveIds()) if (p !== pid && isM(s.roles[p]) && has(p, "mafia")) out.push(p + ":mafia");
    }
    return out;
  }
  async sfu(path, method, body) {
    const c = this.rtcCfg();
    if (this.env && this.env.RTC_FAKE) { // للتجربة المحلية بس: ردود وهمية بدال كلاودفلير
      if (path.endsWith("/sessions/new")) return { sessionId: sid() + sid() };
      if (path.endsWith("/tracks/new")) return { requiresImmediateRenegotiation: !!(body.tracks || []).find((x) => x.location === "remote"), sessionDescription: { type: "offer", sdp: "fake" }, tracks: (body.tracks || []).map((x) => ({ ...x, mid: x.mid || String(Math.floor(Math.random() * 1e6)) })) };
      return { tracks: [], sessionDescription: { type: "answer", sdp: "fake" } };
    }
    const r = await fetch(`https://rtc.live.cloudflare.com/v1/apps/${encodeURIComponent(c.id)}${path}`, {
      method, headers: { Authorization: `Bearer ${c.token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined,
    });
    let j = {}; try { j = await r.json(); } catch {}
    if (!r.ok || j.errorCode) throw new Error(`sfu ${r.status} ${j.errorCode || ""} ${j.errorDescription || ""}`.trim());
    return j;
  }
  // يسكر اللي ما يحق له يسمعه (يصير بعد كل تغيير بالحالة، حتى لو التلفون ما طلب)
  async rtcPrune(pid) {
    const s = this.s, me = (s.rtc || {})[pid];
    if (!me || !me.cons || !(me.subs || []).length) return false;
    const allow = new Set(this.rtcAllowed(pid)), drop = me.subs.filter((x) => !allow.has(x.key) || (s.rtc[x.key.split(":")[0]] || {}).prod !== x.prod);
    if (!drop.length) return false;
    try { await this.sfu(`/sessions/${me.cons}/tracks/close`, "PUT", { force: true, tracks: drop.map((x) => ({ mid: x.mid })) }); } catch (e) { console.log("prune", e.message); }
    me.subs = me.subs.filter((x) => !drop.includes(x));
    return true;
  }
  rtcEnforce() {
    if (!this.rtcCfg() || !this.s || !this.s.rtc) return;
    const run = (async () => { let ch = false; for (const pid of Object.keys(this.s.rtc)) ch = (await this.rtcPrune(pid)) || ch; if (ch) await this.save(); })();
    this.ctx.waitUntil ? this.ctx.waitUntil(run) : run.catch(() => {});
  }
  async rtc(req) {
    const s = this.s;
    if (!s || !this.alive()) return json({ error: "gone" }, 410);
    if (!s.online) return json({ error: "not online" }, 400);
    if (!this.rtcCfg()) return json({ error: "voice off" }, 503);
    let m; try { m = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const pid = Object.keys(s.players).find((id) => s.players[id].token === m.token);
    if (!pid) return json({ error: "who" }, 403);
    const rtc = (s.rtc = s.rtc || {}), me = (rtc[pid] = rtc[pid] || {});
    try {
      if (m.op === "producer") {
        // تلفون اللاعب يرسل المايك: مسارين (العام والمافيا)، والتشغيل والكتم من التلفون نفسه
        const names = (m.tracks || []).map((x) => x.name).filter((n) => n === "talk" || n === "mafia");
        const sess = await this.sfu("/sessions/new", "POST");
        const r = await this.sfu(`/sessions/${sess.sessionId}/tracks/new`, "POST", {
          sessionDescription: m.offer, tracks: (m.tracks || []).filter((x) => names.includes(x.name)).map((x) => ({ location: "local", mid: x.mid, trackName: x.name })),
        });
        me.prod = sess.sessionId; me.pub = names; me.live = false; // يصير متاح للسماع بعد ما يتصل فعلاً
        await this.save();
        return json({ answer: r.sessionDescription });
      }
      if (m.op === "live") {
        if (!me.prod) return json({ error: "no producer" }, 409);
        me.live = true;
        await this.save(); this.broadcast();
        return json({ ok: true });
      }
      if (m.op === "consumer") {
        const sess = await this.sfu("/sessions/new", "POST");
        me.cons = sess.sessionId; me.subs = [];
        await this.save();
        return json({ ok: true });
      }
      if (m.op === "sync") {
        if (!me.cons) return json({ error: "no consumer" }, 409);
        await this.rtcPrune(pid);
        const have = new Set((me.subs || []).map((x) => x.key));
        const add = this.rtcAllowed(pid).filter((k) => !have.has(k));
        let offer = null;
        if (add.length) {
          const r = await this.sfu(`/sessions/${me.cons}/tracks/new`, "POST", {
            tracks: add.map((k) => { const [p, n] = k.split(":"); return { location: "remote", sessionId: rtc[p].prod, trackName: n }; }),
          });
          const byName = {};
          (r.tracks || []).forEach((x, i) => { if (x.mid && !x.errorCode) byName[i] = x.mid; });
          add.forEach((k, i) => { if (byName[i]) me.subs.push({ key: k, mid: byName[i], prod: rtc[k.split(":")[0]].prod }); });
          if (r.requiresImmediateRenegotiation) offer = r.sessionDescription;
        }
        await this.save();
        return json({ offer, subs: (me.subs || []).map((x) => ({ key: x.key, mid: x.mid })) });
      }
      if (m.op === "answer") {
        if (!me.cons) return json({ error: "no consumer" }, 409);
        await this.sfu(`/sessions/${me.cons}/renegotiate`, "PUT", { sessionDescription: m.answer });
        return json({ ok: true });
      }
      return json({ error: "op" }, 400);
    } catch (e) {
      console.log("rtc", m.op, e.message);
      return json({ error: e.message }, 502);
    }
  }

  /* =========== القاضي الآلي (الأون لاين) =========== */
  // ONLINE_SPEED: للتجربة المحلية بس (يسرّع الأوقات)، وبالموقع ما ينحط
  spd() { const v = this.env && +this.env.ONLINE_SPEED; return v > 0 ? v : 1; }
  setDl(sec) { this.s.deadline = Date.now() + sec * 1000 * this.spd(); }
  chat(pid, m) {
    const s = this.s, text = String(m.text || "").trim().slice(0, 300);
    if (!s.online || !text || !s.order.includes(pid)) return;
    const dead = !s.alive[pid], ch = (s.chats = s.chats || { mafia: [], grave: [] });
    const msg = { id: sid(), pid, name: this.nm(pid), text, at: Date.now() };
    if (m.ch === "mafia" && isM(s.roles[pid]) && !dead && (s.phase === "night" || s.phase === "night0")) { ch.mafia.push(msg); if (ch.mafia.length > CHAT_MAX) ch.mafia.shift(); }
    if (m.ch === "grave" && dead && s.phase !== "over") { ch.grave.push(msg); if (ch.grave.length > CHAT_MAX) ch.grave.shift(); }
  }
  // اللاعب اللي فاصل ومحتاجينه: ننطره لين تكمل دقيقة من فصلته
  graceFor(ids) {
    const s = this.s, on = this.onlineSet(), off = s.offSince || {};
    let until = 0;
    for (const i of ids) if (!on.has(i) && off[i]) until = Math.max(until, off[i] + ON.grace * 1000 * this.spd());
    return until > Date.now() ? until : 0;
  }
  pendingActors() {
    const s = this.s, n = s.night, al = this.aliveIds(), out = [];
    const step = s.step;
    const has = (k) => step === k || step === "all";
    if (has("police")) al.filter((i) => s.roles[i] === "cop" && !this.qmap()[i] && this.qUsed(i) < (s.queryMax || 0)).forEach((i) => out.push(i));
    if (has("doctor")) al.filter((i) => s.roles[i] === "doctor" && !this.smap()[i]).forEach((i) => out.push(i));
    if (has("mafia") && !(s.phase === "night0" ? this.stepDone() : n.kill)) al.filter((i) => isM(s.roles[i])).forEach((i) => out.push(i));
    return out;
  }
  // يتقدم بروحه أول ما الكل يخلص (عشان محد ينطر)
  autoAdvance() {
    const s = this.s;
    if ((s.phase === "night" || s.phase === "night0") && this.stepDone() && (!this.adv() || this.aliveIds().every((i) => !this.todo(i).length))) { s.deadline = Date.now() + 1500; }
    if (s.phase === "vote" && !this.curVoter() && s.deadline > Date.now() + 1500) s.deadline = Date.now() + 1500;
    if (s.phase === "result" && s.sniperPending === null && s.event && s.event.type === "snipe") { /* handled in resolveSnipe */ }
  }
  dayStart() {
    const s = this.s, al = this.aliveIds();
    const sh = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const cops = sh(al.filter((i) => s.roles[i] === "cop" || this.isFake(i)));
    s.talkQ = [...cops, ...sh(al.filter((i) => !cops.includes(i)))];
    s.timer = null;
    if (cops.length) s.announce = `${s.announce ? s.announce + " " : ""}الشرطة يتكلمون أول: ${cops.map((i) => this.nm(i)).join("، ")}.`;
    this.setDl(s.sniperPending ? ON.sniper : ON.pre);
  }
  startVoteAuto() {
    const s = this.s, o = this.aliveIds();
    for (let i = o.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [o[i], o[j]] = [o[j], o[i]]; }
    s.votes = {}; s.voteOrder = o; s.voteTurn = 0; s.phase = "vote"; s.timer = null;
    s.announce = `التصويت بالدور. أول واحد: ${this.nm(o[0])}.`;
    this.setDl(ON.vote);
  }
  tick() {
    const s = this.s;
    if (!s.online) return;
    switch (s.phase) {
      case "deal":
        Object.assign(s, { phase: "night0", step: "police", announce: "الليلة الأولى بدت." }); this.ev("dusk"); this.setDl(ON.police); return;
      case "night0": case "night": {
        // بالليل ما ننطر أحد يفصل: لو وقفنا عشانه، الكل بيعرف إن عنده دور
        const n = s.night;
        if (this.isStep("mafia") && s.phase === "night") {
          const r = plurality(this.aliveIds().filter((i) => isM(s.roles[i])).map((i) => n.sugg[i]));
          if (!n.kill && r.tied.length > 1) { s.announce = "المافيا تعادلوا، لازم يتفقون."; this.setDl(ON.tieMore); return; }
        }
        if (s.phase === "night0" && s.step === "mafia" && !this.stepDone()) {
          const mafia = this.aliveIds().filter((i) => isM(s.roles[i]));
          const r = plurality(mafia.map((i) => (n.fake || {})[i]));
          if (r.tied.length > 1) { this.setDl(ON.tieMore); return; }
          // ما اختاروا: اللعبة تختار النصاب (لازم يكون فيه نصاب)
          for (let guard = 0; !this.stepDone() && guard < 12; guard++) {
            const left = mafia.filter((i) => !(s.fakesDone || []).includes(i));
            if (!left.length) break;
            s.fakeCop = guard === 0 && r.winner && left.includes(r.winner) ? r.winner : left[crypto.getRandomValues(new Uint32Array(1))[0] % left.length];
            s.night.fakeByJudge = true; this.lockFake();
          }
        }
        this.next(true); return;
      }
      case "day": {
        if (s.sniperPending) { this.log(`القناص ${this.nm(s.sniperPending)} ما اختار`); s.sniperPending = null; this.checkWin(); if (s.phase !== "day") return; }
        s.timer = null;
        const q = (s.talkQ = (s.talkQ || []).filter((i) => s.alive[i]));
        if (q.length) {
          const id = q.shift(), dur = this.talkSec();
          s.timer = { pid: id, name: this.nm(id), endsAt: Date.now() + dur * 1000 * this.spd(), dur: dur * this.spd(), id: sid() };
          (s.talked = s.talked || {})[id] = true; s.announce = "";
          s.deadline = s.timer.endsAt; return;
        }
        if (s.canVote) this.startVoteAuto(); else this.goNight();
        return;
      }
      case "vote": {
        const cur = this.curVoter();
        if (cur) { if (this.graceFor([cur])) { s.deadline = this.graceFor([cur]); return; } s.voteTurn++; const nx = this.curVoter(); s.announce = nx ? `دور ${this.nm(nx)} يصوّت.` : "الكل صوّت."; if (nx) { this.setDl(ON.vote); return; } }
        this.closeVote(); return;
      }
      case "result":
        if (s.sniperPending) { this.log(`القناص ${this.nm(s.sniperPending)} ما اختار`); s.sniperPending = null; this.checkWin(); if (s.phase !== "result") return; }
        this.goNight(); return;
    }
  }

  // هل الخطوة الحالية خلصت؟ ما نروح للي بعدها إلا لما يختارون
  stepDone() {
    const s = this.s, n = s.night, al = this.aliveIds();
    const mafiaAlive = al.some((i) => isM(s.roles[i]));
    switch (s.step) {
      case "police": return al.filter((i) => s.roles[i] === "cop").every((i) => this.qUsed(i) >= (s.queryMax || 0) || !!this.qmap()[i]);
      case "mafia": return !mafiaAlive || (s.phase === "night0" ? this.fakes().length >= Math.min(s.fakeNeed || 1, al.filter((i) => isM(s.roles[i])).length) : !!n.kill);
      case "doctor": return al.filter((i) => s.roles[i] === "doctor").every((i) => !!this.smap()[i]);
      case "all": {
        const keep = s.step; let ok = true;
        for (const k of STEPS) { s.step = k; ok = ok && this.stepDone(); }
        s.step = keep; return ok;
      }
    }
    return true;
  }

  /* ---------- اختيارات اللاعبين ---------- */
  async playerCmd(pid, m, ws) {
    const s = this.s;
    if (m.t === "leave") {
      // المضيف طلع نهائي: الغرفة تسكر والكل يرجع للاستقبال
      if (s.online && pid === s.hostPid) { await this.closeRoom("المضيف طلع، والغرفة تسكّرت."); return; }
      if (s.phase === "lobby") { s.lobby = s.lobby.filter((x) => x !== pid); delete s.players[pid]; if (s.ready) delete s.ready[pid]; ws.serializeAttachment({}); }
      return;
    }
    if (m.t === "chat") return this.chat(pid, m);
    if (m.t === "ready") { if (s.phase === "lobby" && !s.online && s.lobby.includes(pid)) (s.ready = s.ready || {})[pid] = !!m.v; return; }
    if (m.t === "away") { if (s.online && m.v && s.phase !== "lobby" && s.phase !== "over" && s.order.includes(pid)) this.notice(`${this.nm(pid)} طلع من اللعبة، وممكن يغش 👀`); return; }
    if (m.t !== "act" || m.gen !== s.gen) return;
    const role = s.roles[pid], alive = s.alive[pid], t = m.id, tA = s.alive[t], n = s.night;
    switch (m.k) {
      case "fakecop":
        if (s.phase === "night0" && s.step === "mafia" && isM(role) && isM(s.roles[t]) && !(s.fakesDone || []).includes(t)) {
          n.fake = n.fake || {};
          n.fake[pid] = t;
          const r = plurality(this.aliveIds().filter((i) => isM(s.roles[i])).map((i) => n.fake[i]));
          if (r.winner) { s.fakeCop = r.winner; n.fakeByJudge = false; }
          else if (!(n.fakeByJudge && r.tied.includes(s.fakeCop))) { s.fakeCop = null; n.fakeByJudge = false; }
          // أكثر من نصاب: إذا الكل اختار وفيه فايز، يتثبت وينتقلون للنصاب اللي بعده
          if (s.fakeCop && this.aliveIds().filter((i) => isM(s.roles[i])).every((i) => n.fake[i])) this.lockFake();
        }
        break;
      case "kill":
        if (s.phase === "night" && this.isStep("mafia") && alive && isM(role) && tA && t !== pid) {
          if (n.sugg[pid] !== t) { n.sugg[pid] = t; (n.suggAt = n.suggAt || {})[pid] = Date.now(); }
          const r = plurality(this.aliveIds().filter((i) => isM(s.roles[i])).map((i) => n.sugg[i]));
          if (r.winner) { n.kill = r.winner; n.killByJudge = false; }
          else if (!(n.killByJudge && r.tied.includes(n.kill))) { n.kill = null; n.killByJudge = false; }
        }
        break;
      case "save":
        if (s.phase === "night" && this.isStep("doctor") && alive && role === "doctor" && tA) n.save = { ...this.smap(), [pid]: t };
        break;
      case "query":
        if (alive && role === "cop") this.doQuery(pid, t);
        break;
      case "guess": // تخمين: منو تشك إنه مافيا
        if (this.adv() && alive && tA && t !== pid && ((s.phase === "night" && s.step === "all") || (s.phase === "night0" && s.step === "police"))) (n.guess = n.guess || {})[pid] = t;
        else if (!this.adv() && s.online && alive && tA && t !== pid && (s.phase === "night" || s.phase === "night0")) (n.guess = n.guess || {})[pid] = t;
        break;
      case "done": // اللي يتكلم خلص قبل وقته
        if (s.online && s.phase === "day" && s.timer && s.timer.pid === pid) { s.timer = null; s.deadline = Date.now(); }
        break;
      case "fguess": // الليلة الأولى: منو تتوقع النصاب
        if (this.adv() && alive && tA && t !== pid && !isM(role) && s.phase === "night0" && s.step === "mafia") (n.fguess = n.fguess || {})[pid] = t;
        break;
      case "vote":
        if (s.phase === "vote" && alive) this.castVote(pid, t); // بالدور، والصوت ما يتغير
        break;
      case "snipe":
        if (s.sniperPending === pid && tA && t !== pid) this.resolveSnipe(pid, t);
        break;
    }
  }
}

function blankNight() { return { sugg: {}, suggAt: {}, fake: {}, kill: null, save: {}, queried: {}, guess: {}, fguess: {}, killByJudge: false, fakeByJudge: false }; }

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
const maxMafia = (n) => Math.max(1, Math.min(n - 3, Math.floor((n - 1) / 2)));
const DEF_SET = { mode: "default", mafia: 2, talk: TALK };
const STEPS0 = ["police", "mafia"]; // الليلة الأولى: الشريف يفتش، والمافيا يتعارفون ويختارون النصاب
const STEPS = ["mafia", "doctor", "police"];
// الأغلبية: إذا فيه اختيار واحد فايز يرجع، وإذا تعادل يرجع المتعادلين
function plurality(picks) {
  const t = {};
  for (const v of picks) if (v) t[v] = (t[v] || 0) + 1;
  const max = Math.max(0, ...Object.values(t));
  const top = Object.keys(t).filter((k) => t[k] === max);
  return { winner: max && top.length === 1 ? top[0] : null, tied: top.length > 1 ? top : [] };
}
const ROOM_TTL = 12 * 3600e3; // الغرفة تنمسح بعد ١٢ ساعة بدون استخدام

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
        const r = await env.ROOM.get(env.ROOM.idFromName(code)).create(code, demo);
        if (r) return json(r);
      }
      return json({ error: "ما قدرت أفتح غرفة، جرّب مرة ثانية." }, 503);
    }
    if (url.pathname === "/api/exists") {
      const code = url.searchParams.get("code") || "";
      if (!/^\d{4}$/.test(code)) return json({ ok: false });
      return json({ ok: await env.ROOM.get(env.ROOM.idFromName(code)).exists() });
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

  async create(code, demo = 0) {
    if (this.alive()) return null;
    const judgeToken = tok();
    this.s = {
      code, judgeToken, createdAt: Date.now(), touched: Date.now(),
      settings: { ...DEF_SET }, players: {}, lobby: [], order: [], phase: "lobby", step: null, round: 0, gen: 0, canVote: false,
      alive: {}, roles: {}, fakeCop: null, notes: {}, night: blankNight(), votes: {}, voteOrder: [], voteTurn: 0,
      sniperPending: null, winner: null, announce: "", timer: null, event: null, log: [], demo: !!demo,
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
    if (this.s && Date.now() - (this.s.touched || 0) < ROOM_TTL) {
      await this.ctx.storage.setAlarm((this.s.touched || Date.now()) + ROOM_TTL + 60e3);
      return;
    }
    for (const ws of this.ctx.getWebSockets()) try { ws.close(4000, "expired"); } catch {}
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
      const pid = Object.keys(s.players).find((id) => s.players[id].token === m.token);
      if (m.token && pid) { ws.serializeAttachment({ pid }); return this.broadcast(); }
      this.send(ws, { t: "need-name", phase: s.phase });
      return;
    }
    if (m.t === "join") {
      const name = String(m.name || "").trim().replace(/\s+/g, " ").slice(0, 24);
      if (!name) return this.err(ws, "اكتب اسمك.");
      if (s.phase !== "lobby") return this.err(ws, "اللعبة بدت، انطر لين تخلص الجولة.");
      if (s.lobby.length >= MAX_PLAYERS) return this.err(ws, "الغرفة فلّت.");
      if (s.lobby.some((id) => s.players[id].name === name)) return this.err(ws, "هالاسم مستخدم، غيّره شوي.");
      const pid = sid(), token = tok();
      s.players[pid] = { name, token, at: Date.now() };
      s.lobby.push(pid);
      ws.serializeAttachment({ pid });
      this.send(ws, { t: "joined", token });
      await this.save();
      return this.broadcast();
    }

    if (att.judge) await this.judgeCmd(m);
    else if (att.pid && s.players[att.pid]) await this.playerCmd(att.pid, m, ws);
    else return;
    await this.save();
    this.broadcast();
  }

  async webSocketClose(ws) { try { ws.close(1000); } catch {} this.broadcast(ws); }
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
    if (s.phase === "over") pub.best = this.best();
    if (s.phase === "over") pub.reveal = Object.fromEntries(s.order.map((id) => [id, { role: s.roles[id], fake: s.fakeCop === id }]));
    if (a.judge) {
      pub.judge = {
        roles: s.roles, fakeCop: s.fakeCop, night: s.night, votes: s.votes, log: s.log.slice(-60),
        queriesLeft: Math.max(0, (s.queryMax || 0) - (s.queriesUsed || 0)), queryMax: s.queryMax || 0,
        mafiaNext: s.lobby.length >= MIN_PLAYERS ? this.mafiaFor(s.lobby.length) : null,
        settings: this.sets(), mafiaMax: maxMafia(Math.max(s.lobby.length, MIN_PLAYERS)), talk: this.talkSec(),
      };
      return pub;
    }
    const pid = a.pid, role = s.roles[pid];
    pub.me = { id: pid, name: s.players[pid]?.name, inGame: s.order.includes(pid) && s.phase !== "lobby" };
    if (role && pub.me.inGame) {
      Object.assign(pub.me, { role, fake: s.fakeCop === pid, notes: s.notes[pid] || [] });
      if (role === "cop") Object.assign(pub.me, { queriesLeft: Math.max(0, (s.queryMax || 0) - (s.queriesUsed || 0)), queryMax: s.queryMax || 0, queryMafia: s.night.queried ? isM(s.roles[s.night.queried]) : null });
      const n = s.night;
      if (isM(role)) pub.me.team = s.order.filter((i) => isM(s.roles[i])).map((i) => ({
        id: i, role: s.roles[i], fake: s.fakeCop === i,
        pick: s.phase === "night0" ? (n.fake || {})[i] || null : s.phase === "night" ? n.sugg[i] || null : null,
        at: s.phase === "night" ? (n.suggAt || {})[i] || 0 : 0,
      }));
      pub.me.sel = {
        fakecop: isM(role) ? (n.fake || {})[pid] || null : null,
        kill: isM(role) ? n.sugg[pid] || null : null,
        save: role === "doctor" ? n.save : null,
        query: role === "cop" ? n.queried : null,
        vote: s.votes[pid] || null,
      };
    }
    return pub;
  }

  /* ---------- أدوات ---------- */
  nm(id) { return this.s.players[id]?.name || "لاعب"; }
  // إعدادات الغرفة: افتراضي أو مخصص من القاضي
  sets() { return this.s.settings || DEF_SET; }
  mafiaFor(n) { const c = this.sets(); return c.mode === "custom" ? Math.min(c.mafia, maxMafia(n)) : mafiaCount(n); }
  talkSec() { const c = this.sets(); return c.mode === "custom" ? c.talk : TALK; }
  aliveIds() { return this.s.order.filter((i) => this.s.alive[i]); }
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
    s.announce = this.curVoter() ? `دور ${this.nm(this.curVoter())} يصوّت.` : "الكل صوّت. القاضي بيطلّع النتيجة.";
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
          s.lobby = s.lobby.filter((x) => x !== id); delete s.players[id];
          for (const w of this.ctx.getWebSockets()) {
            const a = w.deserializeAttachment();
            if (a && a.pid === id) { this.send(w, { t: "kicked" }); w.serializeAttachment({}); }
          }
        }
        break;
      case "settings": // القاضي يغير الإعدادات قبل التوزيع
        if (s.phase === "lobby") {
          const mode = m.mode === "custom" ? "custom" : "default";
          const mafia = Math.max(1, Math.min(7, parseInt(m.mafia, 10) || 2));
          const talk = Math.max(10, Math.min(300, Math.round((parseInt(m.talk, 10) || TALK) / 5) * 5));
          s.settings = { mode, mafia, talk };
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
        if (s.phase === "night0" && isM(s.roles[id]) && s.alive[id]) { s.fakeCop = id; s.night.fakeByJudge = true; this.log(`القاضي حط ${this.nm(id)} نصاب`); }
        break;
      case "killFor": // تلفونات المافيا فيها مشكلة: القاضي يختار منو ينغتال
        if (s.phase === "night" && s.step === "mafia" && s.alive[id]) { s.night.kill = id; s.night.killByJudge = true; this.log(`القاضي اختار الاغتيال بدال المافيا: ${this.nm(id)}`); }
        break;
      case "saveFor":
        if (s.phase === "night" && s.step === "doctor" && s.alive[id]) { s.night.save = id; this.log(`القاضي اختار الفزعة بدال البيطري: ${this.nm(id)}`); }
        break;
      case "queryFor": { const cop = this.aliveIds().find((i) => s.roles[i] === "cop"); if (cop) this.doQuery(cop, id); break; }
      case "pickKill":
        if (s.phase === "night" && s.step === "mafia" && Object.values(s.night.sugg).includes(id)) { s.night.kill = id; s.night.killByJudge = true; }
        break;
      case "snipeFor": if (s.sniperPending && s.alive[id] && id !== s.sniperPending) this.resolveSnipe(s.sniperPending, id); break;
      case "newGame":
        Object.assign(s, { phase: "lobby", step: null, round: 0, timer: null, sniperPending: null, winner: null, announce: "", event: null, order: [], alive: {}, roles: {}, fakeCop: null, notes: {}, votes: {}, voteOrder: [], voteTurn: 0, night: blankNight() });
        break;
    }
  }

  start() {
    const s = this.s;
    const ids = s.lobby.filter((id) => s.players[id]);
    if (s.phase !== "lobby" || ids.length < MIN_PLAYERS) return;
    const sh = [...ids];
    for (let i = sh.length - 1; i > 0; i--) { const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1); [sh[i], sh[j]] = [sh[j], sh[i]]; }
    const m = this.mafiaFor(ids.length), roles = {};
    sh.forEach((id, i) => { roles[id] = i < m ? "mafia" : i === m ? "cop" : i === m + 1 ? "doctor" : i === m + 2 ? "sniper" : "citizen"; });
    Object.assign(s, {
      gen: s.gen + 1, order: ids, roles, alive: Object.fromEntries(ids.map((i) => [i, true])),
      phase: "deal", step: null, round: 0, timer: null, sniperPending: null, winner: null, canVote: false,
      fakeCop: null, notes: {}, votes: {}, voteOrder: [], voteTurn: 0, voteHist: [], night: blankNight(), log: [], queryMax: m, queriesUsed: 0,
      announce: "كل واحد يقلب كرته ويشوف دوره.",
    });
    this.ev("deal");
    this.log(`بدت اللعبة: ${ids.length} لاعبين، ${m} مافيا`);
  }

  next() {
    const s = this.s;
    if (s.phase !== "night0" && s.phase !== "night") return;
    if (!this.stepDone()) return;
    const steps = s.phase === "night0" ? STEPS0 : STEPS;
    const i = steps.indexOf(s.step);
    if (i < steps.length - 1) { s.step = steps[i + 1]; return; }
    if (s.phase === "night0") {
      Object.assign(s, { phase: "day", step: null, round: 1, canVote: false, talked: {}, announce: "الصبح. الشرطة يرفعون إيدهم." });
      this.ev("dawn");
      return;
    }
    this.resolveMorning();
  }

  goNight() {
    const s = this.s;
    if (s.sniperPending) return;
    if (!(s.phase === "result" || (s.phase === "day" && !s.canVote))) return;
    Object.assign(s, { phase: "night", step: "mafia", timer: null, votes: {}, voteOrder: [], voteTurn: 0, night: blankNight(), announce: "الليل بدا. كل واحد يتابع تلفونه." });
    this.ev("dusk");
  }

  eliminate(id, why) { this.s.alive[id] = false; this.log(`${this.nm(id)} طلع (${why}) ← ${ROLE_N[this.s.roles[id]]}`); }

  resolveMorning() {
    const s = this.s, k = s.night.kill, sv = s.night.save;
    let msg;
    if (!k) { msg = "المافيا ما عرفوا يغتالون أحد الليلة."; this.ev("nokill"); }
    else if (k === sv) { msg = "اغتيال شامط، البيطري موجووووود 🔥"; this.log(`البيطري لحّق على ${this.nm(k)}`); this.ev("saved"); }
    else {
      this.eliminate(k, "اغتيال");
      msg = `${s.roles[k] === "sniper" ? `ودّع ${this.nm(k)}` : `تم اغتيال ${this.nm(k)}`} وطلع من اللعبة. صيدة سهلة والبيطري مدوّج 😴`;
      const sniper = s.roles[k] === "sniper";
      if (sniper) { msg += ` ${this.nm(k)} قناص، بيسحب واحد وياه.`; s.sniperPending = k; }
      this.ev("kill", { who: this.nm(k), sniper });
    }
    Object.assign(s, { phase: "day", step: null, round: s.round + 1, canVote: true, talked: {}, announce: msg, timer: null });
    if (!s.sniperPending) this.checkWin();
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
  }

  resolveSnipe(sn, t) {
    const s = this.s;
    this.eliminate(t, "سحبه القناص");
    this.note(sn, `سحبت ${this.nm(t)} وياك، دوره: ${ROLE_N[s.roles[t]]}${s.fakeCop === t ? " (النصاب)" : ""}`);
    s.sniperPending = null;
    s.announce = (s.announce || "") + ` القناص سحب ${this.nm(t)} وياه.`;
    this.ev("snipe", { who: this.nm(t) });
    this.checkWin();
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
    Object.assign(s, { phase: "over", winner: w, timer: null, step: null });
    s.announce = w === "town" ? "الشعب فاز! صادوا كل المافيا." : "المافيا فازت! صاروا قد الشعب.";
    const prev = s.event;
    this.ev("win", { winner: w, after: prev && prev.type !== "win" ? prev : null });
    this.log(s.announce);
  }

  // تفتيشات الشريف كلها باللعبة بعدد المافيا، وحدة بالليلة
  doQuery(cop, t) {
    const s = this.s, n = s.night;
    if (!((s.phase === "night" || s.phase === "night0") && s.step === "police" && s.alive[cop] && s.alive[t] && t !== cop && !n.queried && (s.queriesUsed || 0) < (s.queryMax || 0))) return;
    n.queried = t;
    s.queriesUsed = (s.queriesUsed || 0) + 1;
    const ans = isM(s.roles[t]) ? "مافيا" : "شعب";
    this.note(cop, `${s.phase === "night0" ? "الليلة الأولى" : "الليلة " + s.round}: ${this.nm(t)} طلع ${ans}`);
    this.log(`الشريف فتّش عن ${this.nm(t)} ← ${ans}`);
  }

  // هل الخطوة الحالية خلصت؟ ما نروح للي بعدها إلا لما يختارون
  stepDone() {
    const s = this.s, n = s.night, al = this.aliveIds();
    const mafiaAlive = al.some((i) => isM(s.roles[i]));
    switch (s.step) {
      case "police": return !al.some((i) => s.roles[i] === "cop") || (s.queriesUsed || 0) >= (s.queryMax || 0) || !!n.queried;
      case "mafia": return !mafiaAlive || (s.phase === "night0" ? !!s.fakeCop : !!n.kill);
      case "doctor": return !al.some((i) => s.roles[i] === "doctor") || !!n.save;
    }
    return true;
  }

  /* ---------- اختيارات اللاعبين ---------- */
  async playerCmd(pid, m, ws) {
    const s = this.s;
    if (m.t === "leave") {
      if (s.phase === "lobby") { s.lobby = s.lobby.filter((x) => x !== pid); delete s.players[pid]; ws.serializeAttachment({}); }
      return;
    }
    if (m.t !== "act" || m.gen !== s.gen) return;
    const role = s.roles[pid], alive = s.alive[pid], t = m.id, tA = s.alive[t], n = s.night;
    switch (m.k) {
      case "fakecop":
        if (s.phase === "night0" && s.step === "mafia" && isM(role) && isM(s.roles[t])) {
          n.fake = n.fake || {};
          n.fake[pid] = t;
          const r = plurality(this.aliveIds().filter((i) => isM(s.roles[i])).map((i) => n.fake[i]));
          if (r.winner) { s.fakeCop = r.winner; n.fakeByJudge = false; }
          else if (!(n.fakeByJudge && r.tied.includes(s.fakeCop))) { s.fakeCop = null; n.fakeByJudge = false; }
        }
        break;
      case "kill":
        if (s.phase === "night" && s.step === "mafia" && alive && isM(role) && tA && t !== pid) {
          if (n.sugg[pid] !== t) { n.sugg[pid] = t; (n.suggAt = n.suggAt || {})[pid] = Date.now(); }
          const r = plurality(this.aliveIds().filter((i) => isM(s.roles[i])).map((i) => n.sugg[i]));
          if (r.winner) { n.kill = r.winner; n.killByJudge = false; }
          else if (!(n.killByJudge && r.tied.includes(n.kill))) { n.kill = null; n.killByJudge = false; }
        }
        break;
      case "save":
        if (s.phase === "night" && s.step === "doctor" && alive && role === "doctor" && tA) n.save = t;
        break;
      case "query":
        if (alive && role === "cop") this.doQuery(pid, t);
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

function blankNight() { return { sugg: {}, suggAt: {}, fake: {}, kill: null, save: null, queried: null, killByJudge: false, fakeByJudge: false }; }

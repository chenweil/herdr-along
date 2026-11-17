// Workspace spaces: stable colored avatars, worktrees under their checkout,
// grouped by machine when more than one is known. After a space's name, the repo
// its first terminal is in now, only where unusual: branch, ahead/behind.
// Each space carries its own agents under its row: program icon, name, machine
// when remote, and a state mark; a worktree's agents sit one level past its
// branch icon. Agents of no listed space (a machine away) gather under
// "Elsewhere". Click to switch, right-click for its menu, drag to reorder.

import { View, div, image, svg } from "gpui-kit";
import { v_flex, h_flex, ScrollHandle, InputState, Input } from "gpui-base";
import { spaces, machines, agents, terminals, focused, panes, run, openOverlay, exec, hc, theme, shared, setShared, setAgentOrder, watchFolder, window, layout, knownAgents } from "herdr";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// The sidebar's rail goes by its width, not a flag: dragging its edge narrows it too.
const narrow = () => (find(layout(), "sidebar")?.size?.px ?? Infinity) < 160;

function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

// Where a space is now: its first terminal's live folder, else where it was made.
// `ps`: panes(), read once by the caller (each read copies every pane).
function place(s, ps) {
  const tabs = new Set((s.tabs ?? []).map((c) => c.id));
  return ps.find((p) => tabs.has(p.tab) && p.cwd)?.cwd || s.folder;
}
const rowHeight = ({ tree }) => (tree ? 28 : 30);
const RAIL_CELL = 32;
// A space's name and its git tail never shrink below this, so a short one ("api")
// stays readable instead of turning into an ellipsis next to a long branch.
const SIDE_MIN = 48;
const railCell = (el) => h_flex().flex_none().justify_center().child(el);
const where = (s, ps) => JSON.stringify([s.machine ?? null, place(s, ps)]);
const base = (path) => path.replace(/\/+$/, "").split("/").pop();
// Changes made outside Herdr (an editor's save, a commit in another app): looked
// for this often, in repos the list shows, while the window is in front.
const FALLBACK = 60000;
// Places looked at together (two git runs each). All at once, a few hundred spaces
// run out of the app's open files (256 when started from the Dock on macOS) or
// past a machine core's 16 running execs, and those spaces wait for FALLBACK.
const AT_ONCE = 6;

// Both runs, finished: a place isn't done while one of its runs still holds a slot.
async function both(a, b) {
  const done = await Promise.allSettled([a, b]);
  const failed = done.find((d) => d.status === "rejected");
  if (failed) throw failed.reason;
  return done.map((d) => d.value);
}

// What a stored color name looks like on an avatar (the same in every mod
// that draws space avatars): one strong color per hue, light and dark alike.
const MARK = { ansi6: "#22a99a", ansi3: "#e3814f", ansi4: "#5b8def", ansi5: "#8b7cf6", ansi2: "#3fae6a", ansi1: "#d9649a" };

// Agents sort urgent-first inside their space; pinned ones always first.
const RANK = { blocked: 4, done: 3, working: 2, idle: 1 };
// An agent that reports no status (no OSC 7501) counts as idle: it is running,
// only its state is unknown. One shared rank keeps the list and the rail's
// mini marks in step.
const stateRank = (status) => (status == null ? RANK.idle : RANK[status] ?? 0);
// A sub-agent without a pane isn't in agents(): its raw word, error counting as
// blocked. It's never done: it reports to its parent, and the parent's done is the news.
const kidStatus = (k, listed) => {
  const s = listed.get(k.address) ?? k.status;
  return s === "error" ? "blocked" : s === "done" ? "idle" : s;
};
// Drop what an agent puts before its title: a status glyph or spinner and the
// separator after it ("✦  Working"), and Codex's blinking "[ ! ] " / "[ . ] " mark.
const clean = (s) => (s ?? "").replace(/^[^\p{L}\p{N}\p{Ps}\p{Pi}]+/u, "").replace(/^\[ [!.] \] /, "").trim();

// Custom names live in shared state (see along-pane): keyed by terminal
// address, so a renamed pane header and its agent row read the same name.
const NAMES = "along.names";
function nameMap() {
  const raw = shared(NAMES);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function customName(address) {
  return address ? (nameMap()[`t:${address}`] ?? "") : "";
}
function saveName(address, text) {
  if (!address) return;
  const all = nameMap();
  const cleanText = (text ?? "").trim();
  if (cleanText) all[`t:${address}`] = cleanText; else delete all[`t:${address}`];
  setShared(NAMES, all);
}

// A space speaks up only when something in it needs you.
export function glyph(status) {
  return status === "blocked" || status === "done" ? "●" : "·";
}

export function tone(t, status) {
  return t[status] ?? t.unknown;
}

export default class Spaces extends View {
  init(_props, cx) {
    this.git = {}; // where() -> { name, branch, ahead, behind, repo, linked }, null: not a repo
    this.checked = {}; // where() -> when it was last looked at
    this.unsure = new Set(); // where()s git couldn't answer for (a machine away)
    this.pending = new Set(); // where()s to look at next
    this.busy = {}; // pane -> an agent working or a program in front of its shell
    this.ready = {}; // machine -> its layout was readable at the last look
    this.at = {}; // space -> its where() at the last look
    this.watching = new Map(); // local repos' pending folder watches
    // Spaces made while this runs wait (at most a moment) for their git, so a
    // worktree appears under its repo instead of jumping there.
    this.shown = new Set(spaces().map((s) => s.id));
    this.born = {};
    this.pressed = null;
    this.over = null;
    // Sub-agent trees fold per parent agent, like the agents list did.
    this.agentFolded = new Set();
    this.bySpace = new Map(); // space id -> its top-level agents, sorted urgent-first
    this.orphans = []; // agents of spaces not in the list (a machine away)
    this.listed = new Map(); // agent address -> its raw status, for kidStatus
    this.shownAgent = null; // the focused agent's address, highlighted in its space
    this.scroll = ScrollHandle.new(); // the list's position: the active space is brought into view through it
    this.activeAt = -1; // the active space's place among the list's children (headers and rows), -1 when not drawn
    this.machines = [];
    // Right-clicking an agent row edits its name in place. Each edit gets its
    // own input state, so a blur from the row being replaced can't commit the
    // row that just took its place.
    this.handle = cx.focus_handle();
    this.renaming = null; // { address, input } while a row's name is edited
    try {
      this.reconnecting = JSON.parse(localStorage.getItem("machines.reconnecting") ?? "{}");
      if (!this.reconnecting || typeof this.reconnecting !== "object" || Array.isArray(this.reconnecting)) this.reconnecting = {};
      for (const state of Object.values(this.reconnecting)) state.busy = false;
    } catch { this.reconnecting = {}; }
    try { this.folded = new Set(JSON.parse(localStorage.getItem("machines.folded") ?? "[]")); } catch { this.folded = new Set(); }
    // Where each agent sat while it was live: a parked one (a float, "Send
    // back") has no pane, so agents() drops it and this is the only home left.
    try { this.homes = JSON.parse(localStorage.getItem("agent.homes") ?? "{}"); } catch { this.homes = {}; }
    if (!this.homes || typeof this.homes !== "object" || Array.isArray(this.homes)) this.homes = {};
    // The programs the app can start as agents (programs.json's `run` entries).
    // `program.agent` marks a terminal an agent started; a CLI added to
    // programs.json by hand is only known here, so a pane running one still
    // gets a row.
    this.agentPrograms = new Set();
    this.loadAgentPrograms(cx);
    this.refreshMachines(cx);
    cx.timer.every(15000, cx => this.refreshMachines(cx));
    // The table can change while the window is open (a new agent CLI added by
    // hand), so the list is read again now and then. The app answers from a
    // minute-long cache, so this rarely costs a shell.
    cx.timer.every(45000, cx => this.loadAgentPrograms(cx));
    // Refresh only when the refs could have changed (see `due`).
    cx.timer.every(250, (cx) => this.checkNew(cx));
  }

  loadAgentPrograms(cx) {
    cx.spawn(async (cx) => {
      try {
        const list = await knownAgents();
        this.agentPrograms = new Set(list.map((a) => a.key));
        cx.notify();
      } catch {}
    });
  }

  checkNew(cx) {
    const now = Date.now();
    const sp = spaces();
    for (const s of sp) if (!this.shown.has(s.id)) this.born[s.id] ??= now;
    const ps = panes();
    const due = this.due(now, sp, ps);
    if (due.size) this.refreshGit(due, cx);
    if (sp.some((s) => !this.shown.has(s.id)) || this.orderingDue(now)) cx.notify();
    // Rows under spaces follow agents and terminals, but nothing above re-rendered
    // when one started, ended, moved space or changed status: the list sat stale
    // (five shown four) until some other event notified. Render reads agents()
    // fresh, so only the trigger was missing. A signature catches each: address,
    // status/state, where it sits (its own space, or the tab its pane is in),
    // and how it sorts and reads (pinned, focused, seq).
    const tabSpace = new Map(sp.flatMap((s) => (s.tabs ?? []).map((tb) => [tb.id, s.id])));
    const seatOf = new Map(ps.filter((p) => p.terminal).map((p) => [p.terminal, tabSpace.get(p.tab) ?? ""]));
    const sig = [...agents(), ...terminals()]
      .map((a) => [a.address, a.status ?? a.state ?? "", seatOf.get(a.address) ?? a.space ?? a.parent ?? "", a.pinned, a.focused, a.seq])
      .sort().join("|");
    if (sig !== this.agentSig) { this.agentSig = sig; cx.notify(); }
  }

  // Places whose git could have changed: new ones (a new space, a cd), where a
  // command or an agent's turn just ended (a checkout, a commit, edits), those on
  // a machine that is back, and repos in view whose fallback is due.
  due(now, sp, ps) {
    // Moved there: what it knew of that place may be old.
    const at = {};
    for (const s of sp) at[s.id] = where(s, ps);
    const keys = new Set(Object.values(at).filter((k) => JSON.parse(k)[1]));
    for (const k of Object.keys(this.git)) if (!keys.has(k)) {
      delete this.git[k];
      delete this.checked[k];
      this.unsure.delete(k);
    }
    const repos = new Set(Object.values(this.git).filter(Boolean).map((g) => g.repo));
    for (const [repo, pending] of this.watching) if (!repos.has(JSON.stringify([null, repo]))) {
      this.watching.delete(repo);
      pending.cancel();
    }
    const due = new Set([...keys].filter((k) => !(k in this.git)));
    for (const [id, k] of Object.entries(at)) if (this.at[id] && this.at[id] !== k && keys.has(k)) due.add(k);
    this.at = at;
    const spaceOf = {};
    for (const s of sp) for (const t of s.tabs ?? []) spaceOf[t.id] = s;
    const busy = {};
    for (const p of ps) {
      if (!p.terminal || !spaceOf[p.tab]) continue;
      busy[p.pane] = p.status === "working" || !(p.program?.shell || p.program?.agent);
      if (this.busy[p.pane] && !busy[p.pane]) this.sameRepo(at[spaceOf[p.tab].id], keys).forEach((k) => due.add(k));
    }
    this.busy = busy;
    for (const m of machines()) {
      const ready = m.layout === "ready";
      if (ready && this.ready[m.name] === false) for (const k of keys) if (JSON.parse(k)[0] === m.name) due.add(k);
      this.ready[m.name] = ready;
    }
    if (window().active) {
      for (const k of keys) {
        const asks = this.git[k] || this.unsure.has(k);
        if (asks && !this.folded.has(JSON.parse(k)[0]) && now - (this.checked[k] ?? 0) > FALLBACK) due.add(k);
      }
    }
    return due;
  }

  // `key` and the other places in its repo (a commit there moves their ahead/behind).
  sameRepo(key, keys) {
    const repo = this.git[key]?.repo;
    return [key, ...(repo ? [...keys].filter((k) => this.git[k]?.repo === repo) : [])];
  }

  refreshMachines(cx) {
    cx.spawn(async cx => {
      try { const r = await hc(["machine", "ls", "--json"]); if (r.code === 0) this.machines = (JSON.parse(r.stdout).machines ?? []).filter((m) => !m.temporary); } catch {}
      cx.notify();
    });
  }

  rebuilt(machine) {
    return machine?.state === "unreachable" && /^a different core answers there \("[^"]+"\)$/.test(machine.why ?? "");
  }

  reconnect(machine, cx) {
    const name = machine.name;
    if (this.reconnecting[name]?.busy) return;
    const state = this.reconnecting[name] ??= { machine, removed: false };
    state.busy = true;
    state.error = null;
    localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
    cx.notify();
    cx.spawn(async cx => {
      try {
        const ask = async args => {
          const r = await hc([...args, "--json"]);
          if (r.code !== 0) {
            let error;
            try { error = JSON.parse(r.stdout || r.stderr).error?.message; } catch {}
            throw new Error(error || r.stderr || r.stdout || "Couldn't connect.");
          }
        };
        if (!state.removed) {
          await ask(["machine", "rm", name]);
          state.removed = true;
          localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
        }
        const args = ["machine", "add"];
        if (machine.via) args.push("--via", machine.target);
        else args.push(machine.target);
        args.push("--name", name);
        if (machine.session) args.push("--session", machine.session);
        if (machine.temporary) args.push("--temp");
        await ask(args);
        this.folded.delete(name);
        localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
        delete this.reconnecting[name];
      } catch (e) {
        state.error = String(e.message ?? e);
        state.busy = false;
      }
      localStorage.setItem("machines.reconnecting", JSON.stringify(this.reconnecting));
      this.refreshMachines(cx);
      cx.notify();
    });
  }

  // One look at a time, each place once however often it was asked for meanwhile.
  refreshGit(keys, cx) {
    for (const k of keys) this.pending.add(k);
    if (this.refreshing) return;
    this.refreshing = true;
    cx.spawn(async (cx) => {
      while (this.pending.size) {
        const keys = [...this.pending];
        this.pending.clear();
        let next = 0;
        await Promise.all(Array.from({ length: Math.min(AT_ONCE, keys.length) }, async () => {
          while (next < keys.length) await this.check(keys[next++], cx);
        }));
      }
      this.refreshing = false;
      cx.notify();
    });
  }

  // One place's git: branch, ahead/behind, its repo.
  async check(key, cx) {
    const [on, cwd] = JSON.parse(key);
    this.checked[key] = Date.now();
    this.unsure.delete(key);
    try {
      // Ref-only reads avoid scanning the worktree or waking its index watch.
      // Two reads: a folder name may itself contain a newline.
      const [r, common] = await both(
        exec("git", ["rev-parse", "--path-format=absolute", "--show-toplevel"], { cwd, on }),
        exec("git", ["rev-parse", "--path-format=absolute", "--git-common-dir"], { cwd, on }),
      );
      if (r.code !== 0 || common.code !== 0) {
        // Only git's own "no" is remembered as no repo; anything else is asked again.
        if (!/not a git repository/i.test(r.code !== 0 ? r.stderr : common.stderr)) {
          this.unsure.add(key);
          this.git[key] ??= null;
        } else this.git[key] = null;
        return;
      }
      // The repo's own .git folder names it; a worktree's top differs from it.
      const top = r.stdout.replace(/\n$/, ""), repo = common.stdout.replace(/\n$/, "");
      const [branch, counts] = await both(
        exec("git", ["symbolic-ref", "-q", "HEAD"], { cwd, on }),
        exec("git", ["rev-list", "--left-right", "--count", "HEAD...@{upstream}"], { cwd, on }),
      );
      const name = repo.endsWith("/.git") ? base(repo.slice(0, -5)) : base(repo).replace(/\.git$/, "");
      const [ahead, behind] = counts.code === 0 ? counts.stdout.trim().split(/\s+/).map(Number) : [0, 0];
      const info = { name, branch: branch.code === 0 ? branch.stdout.trim().replace(/^refs\/heads\//, "") : "(detached)", ahead, behind, repo: JSON.stringify([on, repo]), linked: repo !== `${top}/.git` };
      this.git[key] = info;
      if (!on) this.watch(repo, cx);
    } catch {
      // Couldn't ask (the machine is away): keep what it showed, look again later.
      this.git[key] ??= null;
      this.unsure.add(key);
    }
  }

  watch(repo, cx) {
    if (this.watching.has(repo)) return;
    const pending = watchFolder(repo);
    this.watching.set(repo, pending);
    cx.spawn(async (cx) => {
      let current = pending;
      try {
        for (;;) {
          await current;
          if (this.watching.get(repo) !== current) return;
          const mine = JSON.stringify([null, repo]);
          const keys = Object.keys(this.git).filter((k) => this.git[k]?.repo === mine);
          if (!keys.length) break;
          this.refreshGit(keys, cx);
          current = watchFolder(repo);
          this.watching.set(repo, current);
        }
      } catch {}
      if (this.watching.get(repo) === current) this.watching.delete(repo);
    });
  }

  // The agent's icon from the app's program table: a one-color glyph or a picture.
  agentIcon(p, size, color) {
    if (!p?.icon) return null;
    return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
  }

  // A small state mark: spinner while working, a red ! when blocked, a dot when
  // done, an open ring when idle. Compact, so it fits under a space's row.
  agentStatus(t, a) {
    // No status: an agent program that doesn't report (no OSC 7501).
    if (a.status == null) return div().size(7).mx(3).flex_none().rounded(4).bg(t.dim + "66");
    if (a.status === "working") return svg("mods/workspace-chrome/spinner.svg").size(12).mx(1).flex_none().text_color(t.working).spin(900);
    if (a.status === "blocked") return div().size(14).flex_none().rounded(4).bg(t.blocked + "26").text_size(10.5).font_bold().text_color(t.blocked).flex().items_center().justify_center().child("!");
    if (a.status === "done") return div().size(7).mx(3).flex_none().rounded(4).bg(t[a.status] ?? t.ansi2);
    return div().size(7).mx(3).flex_none().rounded(4).border(1.5).border_color(t.idle ?? t.dim);
  }

  // Live sub-agents of `addr`, depth first, each with the tree lines in front of it.
  subTree(all, addr, lead = []) {
    const kids = all.filter((k) => k.parent === addr && k.state === "live");
    return kids.flatMap((k, i) => {
      const last = i === kids.length - 1;
      return [
        { t: k, lines: [...lead, last ? "└" : "├"] },
        ...this.subTree(all, k.address, [...lead, last ? "" : "│"]),
      ];
    });
  }

  subRow(t, s, pl) {
    const k = s.t;
    const st = kidStatus(k, this.listed);
    const pic = this.agentIcon(k.program, 12, t.foreground);
    const on = this.shownAgent === k.address;
    return h_flex()
      .id(`ag-sub-${k.address}`)
      .pl(pl)
      .pr(8)
      .h(22)
      .flex_none()
      .gap(0)
      .items_center()
      .rounded(6)
      .text_size(11.5)
      .when(on, (el) => el.bg(t.raised))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => (this.listed.has(k.address) ? run("pane.focus", { terminal: k.address }) : run("terminal.peek", { terminal: k.address })))
      .children(s.lines.map(l => div().self_start().mt(-4).w(9).h(15).mr(4).flex_none()
        .when(Boolean(l), el => el.border_l(1.5).border_color(t.input))
        .when(l === "└" || l === "├", el => el.border_b(1.5).rounded_bl(6))))
      .when(Boolean(pic), el => el.child(div().mr(7).child(pic)))
      .child(div().flex_1().min_w(0).truncate().text_color(on ? t.foreground : t.muted).child(k.name || k.template || k.program?.name || k.address.split("/").pop()))
      .child(this.agentStatus(t, { status: st }));
  }

  // One agent under its space's row. `tree`: the space is a worktree, whose row
  // already sits at pl 22 past its branch icon, so its agents go deeper; a main
  // checkout's row sits at pl 8, so its agents go to 32.
  agentRow(t, a, tree, name) {
    const pic = this.agentIcon(a.program, 14, t.foreground);
    const on = this.shownAgent === a.address || Boolean(a.focused);
    const machine = a.address.includes("/") ? a.address.split("/")[0] : null;
    const subs = a.kids?.length ?? 0;
    return h_flex()
      .id(`ag-${a.address}`)
      .pl(tree ? 46 : 32)
      .pr(8)
      .h(24)
      .flex_none()
      .rounded(6)
      .items_center()
      .gap(7)
      .text_size(12)
      .when(on, (el) => el.bg(t.selected))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => (a.parked ? run("terminal.keep", { terminal: a.address }) : run("pane.focus", { pane: a.pane })))
      .on_mouse_down("right", (_e, cx) => {
        cx.stop_propagation();
        this.beginRename(a, cx);
      })
      .when(Boolean(pic), el => el.child(div().id(`ag-fold-${a.address}`)
        .when(subs > 0, el => el.on_click((_e, cx) => {
          cx.stop_propagation();
          this.agentFolded.has(a.address) ? this.agentFolded.delete(a.address) : this.agentFolded.add(a.address);
          cx.notify();
        }))
        .child(pic)))
      .when(this.renaming?.address === a.address, el => el.child(div()
        .flex_1()
        .min_w(0)
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(Input.new(this.renaming.input)
          .h(20)
          .px(4)
          .rounded(4)
          .border(1)
          .border_color(t.accent)
          .bg(t.background)
          .text_size(12)
          .text_color(t.foreground))))
      .when(this.renaming?.address !== a.address, el => el.child(div().flex_1().min_w(0).truncate().text_color((a.status == null || a.status === "idle") && !on ? t.muted : t.foreground).tooltip("Right-click to rename").child(name ?? a.rowName)))
      .when(Boolean(machine), el => el.child(div().flex_none().text_size(10).text_color(t.dim).child(machine)))
      .when(Boolean(a.parked), el => el.child(div().flex_none().text_size(11).text_color(t.dim).tooltip("Floated · click to bring it back").child("⤢")))
      .when(subs > 0 && this.agentFolded.has(a.address), el => el.child(div().flex_none().text_size(10.5).text_color(t.dim).child(String(subs))))
      .child(this.agentStatus(t, a));
  }

  // The rows under one space's row: each agent, then its live sub-agents unless folded.
  agentRows(w, tree, t) {
    const list = this.bySpace.get(w.id);
    if (!list?.length) return [];
    const pl = tree ? 64 : 50;
    const rows = [];
    for (const a of list) {
      rows.push(this.agentRow(t, a, tree));
      if (!this.agentFolded.has(a.address)) for (const s of a.kids ?? []) rows.push(this.subRow(t, s, pl));
    }
    return rows;
  }

  beginRename(a, cx) {
    const input = InputState.new({ value: customName(a.address) || a.rowName || "", placeholder: "Agent name" });
    this.renaming = { address: a.address, input };
    input.on("submit", (_e, cx) => this.commitRename(cx));
    input.on("blur", (_e, cx) => { if (this.renaming?.input === input) this.commitRename(cx); });
    cx.notify();
    input.focus();
  }

  commitRename(cx) {
    const r = this.renaming;
    if (!r) return;
    saveName(r.address, r.input.value());
    this.renaming = null;
    cx.notify();
  }

  cancelRename(cx) {
    this.renaming = null;
    cx.notify();
  }

  menu(w) {
    // A popup is as tall as its items; height is only the most.
    openOverlay({ mod: "menu", kind: "popup", width: 200, height: 260, props: { tab: "space", target: { id: w.id } } });
  }

  orderingDue(now) {
    return this.ordering && now - this.ordering.at >= 1000
      && this.ordering.machines.every(name => machines().some(m => m.name === name && m.layout === "ready"));
  }

  // Spaces in order, each worktree space moved under its main checkout's.
  ordered() {
    const sp = spaces(), ps = panes();
    const ready = (w) => this.shown.has(w.id) || where(w, ps) in this.git || Date.now() - (this.born[w.id] ??= Date.now()) > 1500;
    for (const w of sp) if (!this.shown.has(w.id) && ready(w)) this.shown.add(w.id);
    const list = sp.map((w, i) => ({ w, i, g: this.git[where(w, ps)] ?? null }));
    const mains = new Set(list.filter((r) => r.g && !r.g.linked).map((r) => r.g.repo));
    const nested = (r) => r.g?.linked && mains.has(r.g.repo);
    const out = [];
    const placed = new Set(); // repos whose worktrees are listed (under the first of its spaces)
    for (const r of list) {
      if (nested(r)) continue;
      out.push({ ...r, tree: null });
      if (!r.g || r.g.linked || placed.has(r.g.repo)) continue;
      placed.add(r.g.repo);
      const kids = list.filter((k) => nested(k) && k.g.repo === r.g.repo);
      kids.forEach((k, n) => out.push({ ...k, tree: n === kids.length - 1 ? "└─" : "├─" }));
    }
    // Simulate the batch so later indexes include earlier moves. An attempted
    // write can lose a sync conflict: allow the echo to settle before retrying.
    const order = sp.map(w => w.id);
    const target = out.map(r => r.w.id);
    const key = JSON.stringify([order, target, machines()]);
    if (order.every((id, i) => id === target[i])) {
      this.ordering = null;
    } else if (this.ordering?.key !== key || this.orderingDue(Date.now())) {
      const moved = new Set();
      this.ordering = { key, at: Date.now(), machines: [] };
      for (let i = 0; i < out.length; i++) {
        const from = order.indexOf(out[i].w.id);
        if (from === i) continue;
        run("space.move", { id: out[i].w.id, index: i + 1 });
        moved.add(out[i].w.machine ?? null);
        order.splice(i, 0, order.splice(from, 1)[0]);
      }
      this.ordering.machines = [...moved];
    }
    return out.filter(r => this.shown.has(r.w.id));
  }

  // The rows, under a header per machine once one isn't this computer.
  grouped(t, collapsed) {
    const rows = this.ordered();
    // Each space's row, then its agents; a worktree row keeps its place after
    // the main checkout's agents and carries its own agents one level deeper.
    const draw = (r) => (collapsed ? [this.compact(r, t)] : [this.row(r, t), ...this.agentRows(r.w, r.tree, t)]);
    // Where the active space's row lands among the children this returns: the list scrolls by its direct
    // children, and machine headers, login notes and loading rows count too.
    this.activeAt = -1;
    let before = 0;
    const remote = [...new Set([...rows.map(r => r.w.machine).filter(Boolean), ...this.machines.map(m => m.name), ...Object.keys(this.reconnecting)])].sort();
    const loading = m => {
      const layout = machines().find(k => k.name === m)?.layout;
      return layout === "loading" || (!layout && this.machines.some(k => k.name === m && k.state === "connected"))
        || spaces().some(s => (s.machine ?? null) === m && !this.shown.has(s.id));
    };
    const loadingRow = m => h_flex().id(`machine-loading-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).items_center().when(collapsed, el => el.justify_center()).text_size(12).text_color(t.dim).child(collapsed ? "…" : "Loading…");
    if (!remote.length) {
      if (loading(null) && !rows.length) return [loadingRow(null)];
      this.activeAt = rows.findIndex(r => r.w.active);
      return rows.flatMap(draw);
    }
    const machineNames = [null, ...remote];
    const list = machineNames.flatMap((m) => {
      const mine = rows.filter((r) => (r.w.machine ?? null) === m);
      const repair = this.reconnecting[m];
      const machine = this.machines.find(k => k.name === m) ?? repair?.machine;
      const connected = !m || machine?.state === "connected";
      const rebuilt = this.rebuilt(machine) || !!repair;
      const login = machine?.state === "needs_login" ? `hc machine login ${m}` : null;
      const folded = this.folded.has(m);
      const icon = svg(`mods/workspace-chrome/${m ? "server" : "monitor"}.svg`).size(13).flex_none();
      const badge = div().absolute().right(-3).bottom(-2).size(6).rounded(3).border_1().border_color(t.chrome).bg(connected ? t.ansi2 : t.dim);
      const head = h_flex().id(`machine-${m ?? "local"}`).h(26).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().text_size(11).text_color(t.dim)
        .when(collapsed, el => el.mt(4).w(RAIL_CELL).justify_center().rounded(6).tooltip(login ? `${m} needs a login: run ${login}. Click for Copy.` : m ? `${m} · ${connected ? "connected" : (machine?.state ?? "asleep").replace(/_/g, " ")}` : "This computer"))
        .cursor_pointer().hover(s => s.bg(t.hover))
        .on_click((_e, cx) => {
          if (collapsed && login) { run("app.settings", { section: "machines" }); return; }
          folded ? this.folded.delete(m) : this.folded.add(m);
          localStorage.setItem("machines.folded", JSON.stringify([...this.folded]));
          cx.notify();
        })
        .when(machine?.keeps_running_after_logout === false, el => el.child(div().id(`machine-logout-${m}`)
          .flex_none().text_color(t.blocked).tooltip("Agents stop when you disconnect. Click for the fix.")
          .on_click((_e, cx) => { cx.stop_propagation(); openOverlay({ mod: "machine-add", kind: "dialog", width: 560 }); }).child("⚠")))
        .when(!collapsed, el => el.child(icon))
        .when(collapsed, el => el.child(div().relative().flex_none().child(icon).when(Boolean(m), el => el.child(badge))))
        .when(!collapsed, el => el.child(div().flex_1().truncate().child(m ?? "This computer"))
          .when(!connected && !rebuilt && !login, el => el.child(div().flex_none().child((machine?.state ?? "asleep").replace(/_/g, " "))))
          .when(rebuilt, el => el.child(h_flex().flex_none().gap(3).items_center()
            .child(div().max_w(140).truncate().child(repair?.error || "rebuilt ·"))
            .child(div().id(`machine-connect-${m}`).text_color(repair?.error ? t.blocked : t.muted)
              .hover(s => s.text_color(t.foreground))
              .tooltip(repair?.error || "This machine was rebuilt or replaced. Click to connect to the new one.")
              .on_click((_e, cx) => { cx.stop_propagation(); this.reconnect(machine, cx); })
              .child(repair?.busy ? "Connecting…" : "Connect"))))
          .when(connected, el => el.child(div().id(`machine-add-${m ?? "local"}`).flex_none().px(4).rounded(4).hover(s => s.bg(t.hover).text_color(t.foreground))
            .on_click((_e, cx) => { cx.stop_propagation(); run("space.new", { machine: m ?? "" }); }).child("+")))
          .child(div().size(6).rounded(3).flex_none().bg(connected ? t.ansi2 : t.dim))
          .child(svg(`mods/workspace-chrome/chevron-${folded ? "right" : "down"}.svg`).size(11).flex_none()));
      const empty = h_flex().id(`machine-new-${m ?? "local"}`).h(28).flex_none().px(collapsed ? 0 : 8).gap(7).items_center().rounded(7)
        .text_size(12).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
        .on_click(() => run("space.new", { machine: m ?? "" }))
        .when(collapsed, el => el.w(RAIL_CELL).rounded(6).justify_center().tooltip(`New space on ${m ?? "this computer"}`)
          .child(h_flex().size(18).rounded(5).border_1().border_color(t.dim).items_center().justify_center()
            .child(svg("mods/workspace-chrome/plus.svg").size(10))))
        .when(!collapsed, el => el.child(svg("mods/workspace-chrome/plus.svg").size(12)).child("New space there"));
      if (!collapsed && rebuilt) { before += 1; return [head]; }
      const cell = collapsed ? railCell : (el) => el;
      const guidance = !collapsed && login ? [v_flex().px(8).pb(6).gap(3).flex_none()
        .child(div().text_size(11).text_color(t.blocked).child("needs a login: run"))
        .child(h_flex().gap(5).items_center()
          .child(div().flex_1().min_w(0).truncate().tooltip(login).text_size(11).text_color(t.muted).child(login))
          .child(div().id(`machine-login-copy-${m}`).flex_none().px(5).py(2).rounded(4)
            .text_size(11).text_color(t.foreground).bg(t.raised).cursor_pointer().hover(s => s.bg(t.hover))
            .on_click((_e, cx) => { cx.stop_propagation(); cx.write_to_clipboard(login); this.copiedLogin = login; cx.notify(); })
            .child(this.copiedLogin === login ? "Copied" : "Copy")))] : [];
      const items = [cell(head), ...guidance, ...(folded ? [] : mine.length ? mine.flatMap(draw) : [loading(m) ? loadingRow(m) : cell(empty)])];
      const first = folded ? -1 : mine.findIndex(r => r.w.active);
      if (first >= 0) this.activeAt = before + 1 + guidance.length + first;
      before += items.length;
      return items;
    });
    // Agents of no listed space: a machine away, or a space that closed under
    // them. Gathered at the end, each still named by its space.
    if (!collapsed && this.orphans.length) {
      const head = h_flex().id("agents-elsewhere").px(8).pt(8).h(26).flex_none().items_center().text_size(11).text_color(t.dim).child("Elsewhere");
      list.push(head, ...this.orphans.map(a => this.agentRow(t, a, false, `${a.space_name ? `${a.space_name} · ` : ""}${a.rowName}`)));
    }
    return list;
  }

  // Only what's unusual, after the name: "herdr \u00b7 spike \u21912 \u21931". The repo or
  // branch goes when the name already says it (a worktree is named after its branch),
  // and master/main go: nearly every space is on one. When the row is full, it
  // and the name both start from their text's width and give way in proportion.
  gitTail(g, tree, name, t) {
    const raw = g.branch ?? "detached";
    const same = (a) => a.toLowerCase() === name.toLowerCase();
    const branch = same(raw) || raw === "master" || raw === "main" ? "" : raw;
    const repo = tree || same(g.name) ? "" : g.name;
    const where = [repo, branch].filter(Boolean).join(" \u00b7 ");
    return h_flex()
      .flex_auto()
      .min_w(where ? SIDE_MIN : 0)
      .gap(5)
      .justify_end()
      .items_center()
      .text_size(11.5)
      .text_color(t.dim)
      .when(Boolean(where), (el) => el.child(div().min_w(0).truncate().child(where)))
      .when(g.ahead > 0, (el) => el.child(div().flex_none().text_color(t.ansi2).child(`\u2191${g.ahead}`)))
      .when(g.behind > 0, (el) => el.child(div().flex_none().text_color(t.ansi1).child(`\u2193${g.behind}`)));
  }

  row({ w, i, g, tree }, t) {
    const on = w.active;
    const fromIndex = this.pressed === null ? -1 : spaces().findIndex(s => s.id === this.pressed);
    const colors = shared("space.colors") ?? {};
    const color = colors[w.id] ?? "ansi6";
    const fill = color.startsWith("#") ? color : (MARK[color] ?? t[color]);
    return v_flex()
      .relative()
      .id(`space-${w.id}`)
      .px(8)
      .h(rowHeight({ tree }))
      .flex_none()
      .justify_center()
      .rounded(8)
      .when(on, (el) => el.bg(t.selected))
      .when(!on, (el) => el.hover((s) => s.bg(t.hover)))
      .when(this.pressed === w.id && this.over !== w.id, (el) => el.opacity(0.5))
      .when(this.pressed !== null && this.over === w.id && this.pressed !== w.id, (el) => el.child(
        div().absolute().left(0).right(0).h(2).bg(t.accent)
          .when(fromIndex < i, line => line.bottom(0))
          .when(fromIndex > i, line => line.top(0)),
      ))
      .on_mouse_down("left", () => {
        this.pressed = w.id;
        this.over = w.id;
      })
      .on_mouse_move((_e, cx) => {
        const source = spaces().find(s => s.id === this.pressed);
        const over = source && (source.machine ?? null) === (w.machine ?? null) ? w.id : null;
        if (this.pressed !== null && this.over !== over) {
          this.over = over;
          cx.notify();
        }
      })
      .on_mouse_up("left", (_e, cx) => {
        const from = this.pressed;
        const over = this.over;
        this.pressed = null;
        this.over = null;
        if (from !== null && over === w.id && from !== w.id) {
          const index = spaces().findIndex(s => s.id === w.id);
          if (index !== -1) run("space.move", { id: from, index: index + 1 });
        } else if (from === w.id) run("space.select", { id: w.id });
        cx.notify();
      })
      .on_mouse_down("right", () => this.menu(w))
      .child(
        h_flex()
          .gap(9)
          .items_center()
          .when(Boolean(tree), el => el.pl(22).child(svg("mods/workspace-chrome/branch.svg").size(13).flex_none().text_color(t.dim)))
          .when(!tree, el => el.child(h_flex().size(18).flex_none().rounded(5).bg(fill).items_center().justify_center().text_size(10.5).font_bold().text_color("#ffffff").child([...w.name][0]?.toUpperCase() ?? "?")))
          .child(div().flex_initial().min_w(SIDE_MIN).truncate().text_color(t.foreground).child(w.name))
          .child(g ? this.gitTail(g, tree, w.name, t) : div().flex_1()),
      );
  }

  compact({ w, i }, t) {
    // The rail has no room for agent rows: the space's cell carries a strip of
    // mini marks at its bottom instead, at most eight in two rows of four,
    // urgent ones first (a blocked agent shows even when more sit behind it).
    // Idle dots are dim; working spins; done is a dot in the theme's done color.
    const ags = [...(this.bySpace.get(w.id) ?? [])].sort((x, y) => stateRank(y.status) - stateRank(x.status));
    const marks = ags.slice(0, 8).map((a) => a.status === "working"
      ? svg("mods/workspace-chrome/spinner.svg").size(8).flex_none().text_color(t.working).spin(900)
      : div().size(5).flex_none().rounded(2.5).bg(a.status === "idle" ? t.dim : (t[a.status] ?? t.dim)));
    const rows = [];
    for (let n = 0; n < marks.length; n += 4) rows.push(marks.slice(n, n + 4));
    return railCell(v_flex()
      .id(`space-${w.id}`)
      .w(RAIL_CELL)
      .h(rows.length > 1 ? 34 : 26)
      .rounded(6)
      .when(w.active, (el) => el.bg(t.selected))
      .when(!w.active, (el) => el.hover((s) => s.bg(t.hover)))
      .on_click(() => run("space.select", { id: w.id }))
      .child(h_flex()
        .flex_1()
        .relative()
        .items_center()
        .justify_center()
        .child(div().text_color(w.active ? t.foreground : t.muted).child(String(i + 1)))
        .child(div().absolute().right(5).text_color(tone(t, w.status)).child(glyph(w.status))))
      .when(rows.length > 0, (el) => el.child(v_flex()
        .flex_none()
        .pb(3)
        .gap(2)
        .items_center()
        .children(rows.map((row) => h_flex().flex_none().gap(2).items_center().justify_center().children(row))))));
  }

  render() {
    const t = theme();
    const collapsed = narrow();
    const palette = ["ansi6", "ansi3", "ansi4", "ansi5", "ansi2", "ansi1"];
    const sp = spaces();
    const ids = new Set(sp.map(p => p.id));
    const kept = Object.fromEntries(Object.entries(shared("space.colors") ?? {}).filter(([id]) => ids.has(id)));
    let changed = Object.keys(kept).length !== Object.keys(shared("space.colors") ?? {}).length;
    for (const p of sp) {
      if (kept[p.id] || p.name === "~") continue;
      const uses = c => Object.values(kept).filter(v => v === c).length;
      kept[p.id] = palette.reduce((best, c) => uses(c) < uses(best) ? c : best);
      changed = true;
    }
    if (changed) setShared("space.colors", kept);
    // Agents by space, each render: top-level agents under their space's row,
    // sub-agents kept in their parent's tree (agentRows). Pinned ones first,
    // then urgent-first, most recent change breaking ties. Each agent carries
    // its kids and row name here, so the row methods stay cheap.
    const ags = [...agents()];
    const all = terminals();
    this.shownAgent = focused()?.agent;
    const tabNames = new Map(sp.flatMap(s => s.tabs).map(tb => [tb.id, tb.name]));
    const tabSpace = new Map(sp.flatMap(s => s.tabs.map(tb => [tb.id, s])));
    // A parked agent's terminal has no pane, so agents() drops it and it would
    // vanish from its space. The float bar records the source space and tab in
    // along.floats.origins while it floats (dismissed with the window), and
    // agent.homes remembers where every live agent sat: recover parked agents
    // from either, so they stay in the list until brought back.
    const homes = this.homes;
    for (const a of ags) {
      if (!a.space) continue;
      if (homes[a.address]?.space !== a.space) homes[a.address] = { space: a.space, name: a.space_name ?? "" };
    }
    const origins = shared("along.floats.origins") ?? {};
    const shown = new Set(ags.map((a) => a.address));
    const paneByTerminal = new Map(panes().filter((p) => p.terminal).map((p) => [p.terminal, p]));
    for (const tr of all) {
      // Finished programs and sub-agents (drawn in their parent's tree) stay out.
      if (shown.has(tr.address) || tr.state === "finished" || tr.parent) continue;
      // An agent program that reports no status (no OSC 7501) still gets a row
      // while it has a pane: it is running, only its state is unknown. A terminal
      // with neither is no agent; one with no pane and no status is not shown.
      const pane = paneByTerminal.get(tr.address);
      const agentProgram = tr.program?.agent || this.agentPrograms.has(tr.program?.key);
      if (!tr.status && !(agentProgram && pane)) continue;
      // Where its pane lives, when it has one; else where it was parked from.
      const here = pane ? tabSpace.get(pane.tab) : null;
      const o = origins[tr.address];
      const home = o?.space ? { space: o.space, name: o.spaceName ?? "" } : homes[tr.address];
      ags.push({
        address: tr.address,
        pane: pane?.pane ?? null,
        space: here?.id ?? home?.space ?? null,
        space_name: here?.name ?? home?.name ?? "",
        tab: pane?.tab ?? o?.tab,
        tab_name: pane ? tabNames.get(pane.tab) ?? "" : o?.tabName ?? "",
        // An empty word is no status: the row shows a plain dim mark.
        status: tr.status || null,
        app: tr.app ?? pane?.app ?? null,
        program: tr.program ?? pane?.program,
        title: tr.title ?? pane?.title ?? tr.name ?? "",
        seq: 0,
        pinned: Boolean(tr.labels?.["herdr.pinned"]),
        focused: Boolean(pane?.focused),
        parked: !pane,
      });
    }
    // Homes of terminals that are gone are dead weight.
    const known = new Set(all.map((tr) => tr.address));
    const saved = JSON.stringify(homes);
    for (const addr of Object.keys(homes)) if (!known.has(addr)) delete homes[addr];
    if (JSON.stringify(homes) !== saved) localStorage.setItem("agent.homes", JSON.stringify(homes));
    this.listed = new Map(ags.map((a) => [a.address, a.status]));
    const nested = new Set();
    for (const a of ags) for (const s of this.subTree(all, a.address)) nested.add(s.t.address);
    const nameOf = (a) => clean(a.title) || tabNames.get(a.tab) || a.program?.name || a.address.split("/").pop();
    this.bySpace = new Map();
    this.orphans = [];
    for (const a of ags) {
      // A kept sub-agent (one with a pane) is in agents() too: where its
      // parent's tree shows it, it gets no row of its own, unless pinned.
      if (!a.pinned && nested.has(a.address)) continue;
      a.kids = this.subTree(all, a.address);
      a.rowName = customName(a.address) || nameOf(a);
      if (ids.has(a.space)) {
        if (!this.bySpace.has(a.space)) this.bySpace.set(a.space, []);
        this.bySpace.get(a.space).push(a);
      } else this.orphans.push(a);
    }
    const rank = (a) => (a.pinned ? 5 : stateRank(a.status));
    const byUrgency = (x, y) => rank(y) - rank(x) || y.seq - x.seq;
    for (const l of this.bySpace.values()) l.sort(byUrgency);
    this.orphans.sort(byUrgency);
    setAgentOrder([...sp.flatMap(s => this.bySpace.get(s.id) ?? []), ...this.orphans].map(a => a.address));
    const list = this.grouped(t, collapsed);
    // Bring the active space into view when it, or its place in the list, changes; a row already in view stays put.
    const active = sp.find(p => p.active)?.id;
    if (active !== this.revealed || this.activeAt !== this.revealedAt) {
      this.revealed = active;
      this.revealedAt = this.activeAt;
      if (this.activeAt >= 0) this.scroll.scroll_to_item(this.activeAt);
    }
    return v_flex().size_full().min_h(0).bg(t.chrome).text_size(13)
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (this.renaming && e.key === "escape") {
          cx.stop_propagation();
          this.cancelRename(cx);
        }
      })
      .child(h_flex().h(31).pl(16).pr(10).items_center().justify_between().text_size(11.5).text_color(t.dim)
        .when(collapsed, el => el.pl(0).pr(0).gap(3).justify_center())
        .when(!collapsed, el => el.child("Spaces"))
        .when(collapsed, el => el.child(div().id("sidebar-expand").size(26).flex_none().flex().items_center().justify_center().rounded(6)
          .text_size(13).text_color(t.dim).hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click(toggleSidebar).child("»")))
        .child(div().id("space-new").size(26).flex_none().flex().items_center().justify_center().rounded(6).hover(s => s.bg(t.hover).text_color(t.foreground))
          .on_click(() => run("space.new")).child(svg("mods/workspace-chrome/plus.svg").size(14))))
      .child(v_flex().flex_1().min_h(0).px(collapsed ? 0 : 8).pb(14).overflow_y_scrollbar().mode("always").track_scroll(this.scroll)
        // A block above (another mod's) growing, or the window resizing, shrinks this list and can push the active space out.
        .on_size_change((_size, cx) => { if (this.activeAt >= 0) { this.scroll.scroll_to_item(this.activeAt); cx.notify(); } })
        .on_mouse_up("left", (_e, cx) => { this.pressed = null; cx.notify(); })
        .children(list));
  }
}

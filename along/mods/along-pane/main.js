// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "along-pane" } } } }
// Along's fork of the shipped pane mod: the same split, zoom and close
// buttons, plus a Float button — it parks the pane's terminal (the terminal
// keeps running without a pane) and opens a draggable floating window that
// holds it, with the along-float bar on top. Props: { pane, terminal }.
// When the pane is too narrow, the buttons fold into one 「⋯」 menu: a full
// row of them would sit under the app's top-center grip and be unclickable.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, Popover, InputState, Input } from "gpui-base";
import { panes, props, run, openOverlay, closeOverlay, theme, home, layout, spaces, focused, shared, setShared, notify } from "herdr";

// 头部宽度小于这个值就把按钮收进一个「⋯」菜单：按钮条太宽时会撞上
// app 画在 pane 顶边中央的拖拽把手（grip），窄 pane 里点不到按钮。
const NARROW = 320;

// 状态色与 along-spaces 一致：报错红、需要人橙、完成绿、空闲灰、工作中蓝。
// 名字的颜色跟着状态变，一眼能看出哪个 pane 在等你。
const STATE = {
  error: "#e5484d",
  blocked: "#e3814f",
  done: "#3fae6a",
  idle: "#8f8f8f",
  working: "#4ade80",
};
const stateColor = (status) => STATE[status] ?? STATE.idle;

// Along keeps its own names for panes and agents: the core has no name for a
// pane, so the name lives in shared state, where every mod sees it. The key
// is the terminal's address (a pane with no terminal keys on the pane itself),
// so the pane header, the agents list and the float bar name one thing.
const NAMES = "along.names";
function nameMap() {
  const raw = shared(NAMES);
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
}
function nameKey(pane) {
  return pane.terminal ? `t:${pane.terminal}` : `p:${pane.pane}`;
}
function customName(key) {
  return key ? (nameMap()[key] ?? "") : "";
}
function saveName(key, text) {
  if (!key) return;
  const all = nameMap();
  const clean = (text ?? "").trim();
  if (clean) all[key] = clean; else delete all[key];
  setShared(NAMES, all);
}

// Match the first visible tab frame, including the active child of a stack.
function paneFrame(node) {
  if (!node || node.hidden) return null;
  if (node.content?.tab && node.content.pane) return node.content.pane;
  let children = node.children ?? [];
  if (node.type === "stack") {
    const visible = children.filter(child => !child.hidden);
    children = [visible.find(child => child.id === node.active) ?? visible[0]];
  }
  for (const child of children) {
    const frame = paneFrame(child);
    if (frame) return frame;
  }
  return null;
}

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

function folder(cwd) {
  if (!cwd) return "";
  const h = home();
  return cwd === h ? "~" : cwd.startsWith(h + "/") ? "~" + cwd.slice(h.length) : cwd;
}

function paneName(p) {
  return ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
}

export default class Pane extends View {
  init(_props, cx) {
    this.hovered = false; this.width = 0; this.menu = false;
    // Clicking the header's name edits it in place. The input is kept on the
    // view: InputState.new needs a live host call, so it can't be made in render.
    this.editing = false;
    this.handle = cx.focus_handle();
    this.input = InputState.new({ placeholder: "Pane name" });
    this.input.on("submit", (_e, cx) => this.commitName(cx));
    this.input.on("blur", (_e, cx) => { if (this.editing) this.commitName(cx, false); });
  }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
  }

  beginName(p, cx) {
    this.editing = true;
    this.input.set_value(customName(nameKey(p)) || paneName(p));
    cx.notify();
    this.input.focus();
  }

  commitName(cx, refocus = true) {
    if (!this.editing) return;
    const p = this.me();
    this.editing = false;
    if (p) saveName(nameKey(p), this.input.value());
    cx.notify();
    // Enter commits and hands the keyboard back to the pane, so typing goes
    // to the terminal again instead of the input. A blur commits too, but
    // leaves focus where the click put it (another pane's name, say).
    if (refocus && p) run("pane.focus", { pane: p.pane });
  }

  cancelName(cx) {
    this.editing = false;
    this.input.set_value("");
    cx.notify();
    const p = this.me();
    if (p) run("pane.focus", { pane: p.pane });
  }

  button(t, id, icon, onClick) {
    return div()
      .id(id)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click((_e, cx) => {
        cx.stop_propagation();
        onClick(cx);
      })
      .child(svg(`mods/along-pane/${icon}.svg`).size(14));
  }

  // 窄 pane 时的「⋯」按钮：所有动作收进一个弹出菜单。
  more(t, pane, p) {
    const trigger = div()
      .id(`ph-m-${pane}`)
      .p(3)
      .rounded(4)
      .text_color(t.dim)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .child(svg("mods/along-pane/more.svg").size(14));
    return Popover.new(`ph-pop-${pane}`)
      .trigger(trigger)
      .content(this.menuContent(t, pane, p))
      .open(this.menu)
      .on_open_change((open, cx) => { this.menu = open; cx.notify(); });
  }

  menuContent(t, pane, p) {
    const item = (id, icon, label, onClick) =>
      div()
        .id(id)
        .flex()
        .items_center()
        .gap(8)
        .px(8)
        .py(4)
        .rounded(4)
        .text_color(t.foreground)
        .hover((s) => s.bg(t.hover))
        .on_click((_e, cx) => {
          cx.stop_propagation();
          onClick(cx);
          this.menu = false;
          cx.notify();
        })
        .child(svg(`mods/along-pane/${icon}.svg`).size(14).flex_none())
        .child(div().text_size(12).child(label));
    return v_flex()
      .p(4)
      .gap(2)
      .w(150)
      .bg(t.surface)
      .border_b(1)
      .border_color(t.border)
      .rounded(6)
      .shadow_md()
      .child(item(`pm-f-${pane}`, "float", "Float", (cx) => this.float(p, cx)))
      .child(item(`pm-r-${pane}`, "split-right", "Split right", () => run("pane.split", { direction: "right", pane })))
      .child(item(`pm-d-${pane}`, "split-down", "Split down", () => run("pane.split", { direction: "down", pane })))
      .child(item(`pm-z-${pane}`, p.zoomed ? "unzoom" : "zoom", p.zoomed ? "Unzoom" : "Zoom", () => run("pane.zoom", { pane })))
      .child(item(`pm-x-${pane}`, "close", "Close", () => run("pane.close", { pane })));
  }

  // 头部宽度（= pane 宽度）不够放一排按钮时，折叠成「⋯」。
  narrow() {
    return this.width > 0 && this.width < NARROW;
  }

  // 把这个 pane 飘起来。初始化期间先标记 pending，悬浮窗按钮会禁用；
  // 只有 terminal.park 确认完成后才解除 pending，避免窗口刚打开就被送回。
  float(p, cx) {
    const terminal = p.terminal;
    if (!terminal) return;
    const pending = shared("along.floats.pending") && typeof shared("along.floats.pending") === "object"
      ? shared("along.floats.pending")
      : {};
    pending[terminal] = true;
    setShared("along.floats.pending", pending);
    cx.spawn(async (task) => {
      let overlay = null;
      try {
        overlay = openOverlay({
          kind: "window",
          key: `along-float-${terminal}`,
          width: 640,
          height: 440,
          layout: {
            id: "along-float",
            type: "column",
            children: [
              { id: "along-float-bar", type: "block", size: { px: 34 }, content: { mod: "along-float", props: { terminal } } },
              { id: "along-float-term", type: "block", weight: 1, content: { terminal } }
            ]
          }
        });
        const space = spaces().find((s) => (s.tabs ?? []).some((t) => t.id === p.tab));
        const tab = space?.tabs?.find((t) => t.id === p.tab);
        if (space && tab) {
          const settle = async (pred, tries = 20) => {
            for (let i = 0; i < tries; i++) {
              await task.sleep(25);
              const f = focused();
              if (pred(f)) return f;
            }
            throw new Error("pane focus did not settle");
          };
          let neighbors = {};
          try {
            await run("pane.focus", { pane: p.pane });
            await settle((f) => f?.pane === p.pane);
            const probe = async (dir) => {
              await run("pane.go", { direction: dir });
              const moved = await settle((f) => f?.pane && f.pane !== p.pane && f.tab === p.tab).catch(() => null);
              await run("pane.focus", { pane: p.pane });
              await settle((f) => f?.pane === p.pane);
              return moved?.pane ?? null;
            };
            for (const dir of ["left", "up", "right", "down"]) neighbors[dir] = await probe(dir);
          } catch {
            neighbors = { left: null, up: null, right: null, down: null };
          }
          const origins = /** @type {Record<string, object>} */ (shared("along.floats.origins") ?? {});
          origins[terminal] = { space: space.id, tab: tab.id, spaceName: space.name, tabName: tab.name, neighbors };
          setShared("along.floats.origins", origins);
        }
        run("terminal.park", { terminal });
        for (let i = 0; i < 30 && panes().some((x) => x.terminal === terminal); i++) await task.sleep(100);
        if (panes().some((x) => x.terminal === terminal)) throw new Error("terminal.park did not complete");
      } catch (e) {
        if (overlay) closeOverlay(overlay);
        notify({ title: "Float failed", body: String(e?.message ?? e) });
      } finally {
        const state = shared("along.floats.pending") && typeof shared("along.floats.pending") === "object"
          ? shared("along.floats.pending")
          : {};
        delete state[terminal];
        setShared("along.floats.pending", state);
      }
    });
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const key = nameKey(p);
    const name = customName(key) || paneName(p);
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
    // 有状态就用状态色，没有（普通程序）就保持原色。
    const nameTone = st ? stateColor(st) : t.foreground;
    const pane = p.pane;
    const bottom = paneFrame(layout())?.header?.position === "bottom";
    return h_flex()
      .id(`pane-head-${pane}`)
      .size_full()
      .px(10)
      .gap(8)
      .items_center()
      .bg(t.background)
      .when(bottom, el => el.border_t(1))
      .when(!bottom, el => el.border_b(1))
      .border_color(t.border)
      .text_size(12)
      .on_hover((hovered, cx) => { this.hovered = hovered; cx.notify(); })
      .track_focus(this.handle)
      .on_key_down((e, cx) => {
        if (this.editing && e.key === "escape") {
          cx.stop_propagation();
          this.cancelName(cx);
        }
      })
      .on_mouse_move((e, cx) => {
        // 头部宽度就是 pane 宽度：窄了才把按钮折叠起来。
        const w = e.bounds?.width ?? 0;
        if (w && Math.abs(w - this.width) > 0.5) {
          this.width = w;
          cx.notify();
        }
      })
      .on_click(() => {
        // 记录用户最后点击的主布局 pane，悬浮窗的方向按钮以它为落点。
        const targets = shared("along.floats.targets") && typeof shared("along.floats.targets") === "object"
          ? shared("along.floats.targets")
          : {};
        targets[p.tab] = { pane, at: Date.now() };
        setShared("along.floats.targets", targets);
        run("pane.focus", { pane });
      })
      .when(Boolean(pic), (el) => el.child(pic))
      .when(this.editing, el => el.child(div()
        .id(`ph-n-${pane}`)
        .w(180)
        .flex_none()
        .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
        .child(Input.new(this.input)
          .h(20)
          .px(4)
          .rounded(4)
          .border(1)
          .border_color(t.accent)
          .bg(t.background)
          .text_size(12)
          .text_color(t.foreground))))
      .when(!this.editing, el => el.child(div()
        .id(`ph-n-${pane}`)
        .flex_none()
        .truncate()
        .max_w(260)
        .font_medium()
        .text_color(nameTone)
        .cursor_text()
        .tooltip("Click to rename")
        .on_click((_e, cx) => {
          cx.stop_propagation();
          this.beginName(p, cx);
        })
        .child(name)))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(stateColor("working")).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(stateColor("blocked") + "26").text_size(10.5).font_semibold().text_color(stateColor("blocked")).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(stateColor("done"))))
      .when(this.hovered || this.menu, el => el
        .when(this.narrow(), el2 => el2.child(this.more(t, pane, p)))
        .when(!this.narrow(), el2 => el2
          .when(Boolean(p.terminal), el3 => el3.child(this.button(t, `ph-f-${pane}`, "float", (cx) => this.float(p, cx))))
          .child(this.button(t, `ph-r-${pane}`, "split-right", () => run("pane.split", { direction: "right", pane })))
          .child(this.button(t, `ph-d-${pane}`, "split-down", () => run("pane.split", { direction: "down", pane })))
          .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", () => run("pane.zoom", { pane })))
          .child(this.button(t, `ph-x-${pane}`, "close", () => run("pane.close", { pane })))));
  }
}

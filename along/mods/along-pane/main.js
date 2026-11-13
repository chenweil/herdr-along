// A pane's header, for layouts that frame their panes:
//   { "tab": "active", "pane": { "header": { "content": { "mod": "along-pane" } } } }
// Along's fork of the shipped pane mod: the same split, zoom and close
// buttons, plus a Float button — it parks the pane's terminal (the terminal
// keeps running without a pane) and opens a draggable floating window that
// holds it, with the along-float bar on top. Props: { pane, terminal }.
// When the pane is too narrow, the buttons fold into one 「⋯」 menu: a full
// row of them would sit under the app's top-center grip and be unclickable.

import { View, div, svg, image } from "gpui-kit";
import { h_flex, v_flex, Popover } from "gpui-base";
import { panes, props, run, openOverlay, theme, home, layout, spaces, focused, shared, setShared } from "herdr";

// 头部宽度小于这个值就把按钮收进一个「⋯」菜单：按钮条太宽时会撞上
// app 画在 pane 顶边中央的拖拽把手（grip），窄 pane 里点不到按钮。
const NARROW = 320;

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

export default class Pane extends View {
  init() { this.hovered = false; this.width = 0; this.menu = false; }

  me() {
    return panes().find((p) => p.pane === props()?.pane);
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
        onClick();
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
          onClick();
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
      .child(item(`pm-f-${pane}`, "float", "Float", () => this.float(p)))
      .child(item(`pm-r-${pane}`, "split-right", "Split right", () => run("pane.split", { direction: "right", pane })))
      .child(item(`pm-d-${pane}`, "split-down", "Split down", () => run("pane.split", { direction: "down", pane })))
      .child(item(`pm-z-${pane}`, p.zoomed ? "unzoom" : "zoom", p.zoomed ? "Unzoom" : "Zoom", () => run("pane.zoom", { pane })))
      .child(item(`pm-x-${pane}`, "close", "Close", () => run("pane.close", { pane })));
  }

  // 头部宽度（= pane 宽度）不够放一排按钮时，折叠成「⋯」。
  narrow() {
    return this.width > 0 && this.width < NARROW;
  }

  // 把这个 pane 飘起来：park 让终端脱离布局（继续运行），
  // 再开一个可拖动的悬浮窗口装住它，顶栏是 along-float。
  // 先记住它来自哪个 space/tab，再逐个 await pane.go 探四周邻居
  // （命令是返回后才应用，不 await 读到的还是旧焦点），
  // send back 时按原方位 split 回去。
  async float(p) {
    const terminal = p.terminal;
    if (!terminal) return;
    const space = spaces().find((s) => (s.tabs ?? []).some((t) => t.id === p.tab));
    const tab = space?.tabs?.find((t) => t.id === p.tab);
    if (space && tab) {
      let neighbors = null;
      try {
        await run("pane.focus", { pane: p.pane });
        const probe = async (dir) => {
          await run("pane.go", { direction: dir });
          const f = focused();
          return f?.pane && f.pane !== p.pane && f.tab === p.tab ? f.pane : null;
        };
        neighbors = {};
        for (const dir of ["left", "up", "right", "down"]) {
          neighbors[dir] = await probe(dir);
          await run("pane.focus", { pane: p.pane });
        }
      } catch {
        neighbors = null;
      }
      if (neighbors) {
        const origins = /** @type {Record<string, {space: string, tab: string, neighbors: Record<string, string | null>}>} */ (shared("along.floats.origins") ?? {});
        origins[terminal] = { space: space.id, tab: tab.id, neighbors };
        setShared("along.floats.origins", origins);
      }
    }
    openOverlay({
      kind: "window",
      key: `along-float-${terminal}`,
      width: 640,
      height: 440,
      layout: {
        id: "along-float",
        type: "column",
        children: [
          {
            id: "along-float-bar",
            type: "block",
            size: { px: 34 },
            content: { mod: "along-float", props: { terminal } }
          },
          {
            id: "along-float-term",
            type: "block",
            weight: 1,
            content: { terminal }
          }
        ]
      }
    });
    run("terminal.park", { terminal });
  }

  render(cx) {
    const t = theme();
    const p = this.me();
    if (!p) return div();
    const name = ((p.program?.agent || p.program?.shell) && p.program.name) || p.title || p.program?.name || "shell";
    const pic = icon(p.program, 14, t.dim);
    const st = p.status;
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
      .on_mouse_move((e, cx) => {
        // 头部宽度就是 pane 宽度：窄了才把按钮折叠起来。
        const w = e.bounds?.width ?? 0;
        if (w && Math.abs(w - this.width) > 0.5) {
          this.width = w;
          setShared("along.debug.pane_width", w);
          cx.notify();
        }
      })
      .on_click(() => run("pane.focus", { pane }))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().flex_none().truncate().max_w(260).font_medium().text_color(t.foreground).child(name))
      .child(div().flex_1().truncate().text_color(t.dim).child(folder(p.cwd)))
      .when(st === "working", el => el.child(svg("mods/workspace-chrome/spinner.svg").size(12).flex_none().text_color(t.working).spin(900)))
      .when(st === "blocked", el => el.child(div().flex_none().px(6).h(18).flex().items_center().rounded(5).bg(t.blocked + "26").text_size(10.5).font_semibold().text_color(t.blocked).child("Needs you")))
      .when(st === "done", el => el.child(div().size(7).flex_none().rounded(4).bg(t.done)))
      .when(this.hovered || this.menu, el => el
        .when(this.narrow(), el2 => el2.child(this.more(t, pane, p)))
        .when(!this.narrow(), el2 => el2
          .when(Boolean(p.terminal), el3 => el3.child(this.button(t, `ph-f-${pane}`, "float", () => this.float(p))))
          .child(this.button(t, `ph-r-${pane}`, "split-right", () => run("pane.split", { direction: "right", pane })))
          .child(this.button(t, `ph-d-${pane}`, "split-down", () => run("pane.split", { direction: "down", pane })))
          .child(this.button(t, `ph-z-${pane}`, p.zoomed ? "unzoom" : "zoom", () => run("pane.zoom", { pane })))
          .child(this.button(t, `ph-x-${pane}`, "close", () => run("pane.close", { pane })))));
  }
}

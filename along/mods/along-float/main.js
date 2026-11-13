// The bar on top of a floated pane (the window overlay along-pane's Float
// button opens after parking the terminal): who it is and how it's doing,
// ↙ sends the terminal back into the layout, ✕ closes the window (the
// terminal keeps running parked; the agents list can bring it back).
// Props: { terminal, overlay }. Presses on the bar drag the window; the
// buttons stop them.

import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, terminals, panes, spaces, run, theme, props, closeOverlay, shared, setShared } from "herdr";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const WORDS = { working: "working", blocked: "needs you", done: "finished", idle: "idle" };

function icon(p, size, color) {
  if (!p?.icon) return null;
  return p.tint ? svg(p.icon).size(size).flex_none().text_color(color) : image(p.icon).w(size).h(size).flex_none();
}

export default class Float extends View {
  term() {
    return terminals().find((t) => t.address === props()?.terminal);
  }

  status() {
    const addr = props()?.terminal;
    return agents().find((a) => a.address === addr)?.status ?? this.term()?.status ?? null;
  }

  button(t, id, label, onClick) {
    return div()
      .id(id)
      .px(8)
      .py(2)
      .rounded(5)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(onClick)
      .child(label);
  }

  // 送回布局：优先回到 float 之前的原 space/tab，并按 float 时探到的
  // 邻居方位 split（左邻→它右边，上邻→它下面，只剩右/下邻→镜像落到它旁边）；
  // 记录的邻居都不在了就紧挨焦点 pane；原 tab 不在就回原 space 的新 tab。
  back() {
    const { terminal, overlay } = props() ?? {};
    const home = panes().some((p) => p.terminal === terminal);
    if (home) {
      run("pane.focus", { terminal });
    } else {
      const origins = /** @type {Record<string, {space: string, tab: string, neighbors: Record<string, string | null>}>} */ (shared("along.floats.origins") ?? {});
      const origin = origins[terminal];
      const space = origin && spaces().find((s) => s.id === origin.space);
      const tab = space?.tabs?.find((t) => t.id === origin.tab);
      if (space && tab) {
        run("space.select", { id: space.id });
        run("tab.select", { id: tab.id });
        this.restore(terminal, origin, tab);
      } else if (space) {
        run("space.select", { id: space.id });
        run("terminal.keep", { terminal, place: "tab" });
      } else {
        run("terminal.keep", { terminal });
      }
    }
    const origins = /** @type {Record<string, {space: string, tab: string, neighbors: Record<string, string | null>}>} */ (shared("along.floats.origins") ?? {});
    if (origins[terminal]) {
      delete origins[terminal];
      setShared("along.floats.origins", origins);
    }
    closeOverlay(overlay);
  }

  // 在原 tab 里挑一个还活着的记录邻居，从它那边 split：
  // 左邻→在它右边 split；上邻→在它下面 split；只剩右/下邻的，
  // 落在镜像侧（同样紧挨着）。都没有就紧挨焦点 pane；tab 空了回新 tab。
  restore(terminal, origin, tab) {
    const here = new Set(panes().filter((x) => x.tab === tab.id).map((x) => x.pane));
    if (here.size === 0) {
      run("terminal.keep", { terminal, place: "tab" });
      return;
    }
    const plan = [["left", "right"], ["up", "down"], ["right", "right"], ["down", "down"]];
    for (const [side, place] of plan) {
      const neighbor = origin?.neighbors?.[side];
      if (neighbor && here.has(neighbor)) {
        run("pane.focus", { pane: neighbor });
        run("terminal.keep", { terminal, place });
        return;
      }
    }
    run("terminal.keep", { terminal, place: "right" });
  }

  render() {
    const t = theme();
    const { terminal, overlay } = props() ?? {};
    const k = this.term();
    const st = this.status();
    const pic = icon(k?.program, 14, t.foreground);
    const home = panes().some((p) => p.terminal === terminal);
    const glyph = st === "working" ? "⠋" : st === "idle" ? "○" : st ? "●" : "·";
    return h_flex()
      .size_full()
      .px(12)
      .gap(8)
      .items_center()
      .bg(t.surface)
      .border_b(1)
      .border_color(t.border)
      .text_size(12)
      .child(div().w(12).flex_none().text_color(t[st] ?? t.dim).when(st === "working", (el) => el.frames(SPIN, 90)).child(glyph))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().truncate().font_semibold().text_color(t.foreground).child(k?.name || k?.template || k?.program?.name || terminal || ""))
      .when(Boolean(st), (el) => el.child(div().flex_none().text_color(t[st] ?? t.dim).child(WORDS[st] ?? st)))
      .child(div().flex_1())
      .child(
        this.button(t, "keep", home ? "↙ go to" : "↙ send back", () => this.back()),
      )
      .child(this.button(t, "close", "✕", () => closeOverlay(overlay)));
  }
}

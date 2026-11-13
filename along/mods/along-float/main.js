// The bar on top of a floated pane (the window overlay along-pane's Float
// button opens after parking the terminal): who it is and how it's doing,
// ↙ sends the terminal back into the layout, ✕ closes the window (the
// terminal keeps running parked; the agents list can bring it back).
// Props: { terminal, overlay }. Presses on the bar drag the window; the
// buttons stop them.

import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, terminals, panes, run, theme, props, closeOverlay } from "herdr";

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
        this.button(t, "keep", home ? "↙ go to" : "↙ send back", () => {
          run(home ? "pane.focus" : "terminal.keep", { terminal });
          closeOverlay(overlay);
        }),
      )
      .child(this.button(t, "close", "✕", () => closeOverlay(overlay)));
  }
}

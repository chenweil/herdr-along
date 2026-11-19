// The pane right-click menu: Herdr's pane items with Along's icons.
// The layout root chooses it with "terminal_menu": "along-pane-menu"; the
// app opens it only for terminal right-clicks, so other menus keep the
// shipped `menu` mod. ↑/↓ move, Enter runs, Esc closes. An item is
// [label, command, args, icon].

import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { run, props, closeOverlay, theme, keys, terminals, panes } from "herdr";

function items(p) {
  const tg = p?.target ?? {};
  // A kept sub-agent can go back under its parent, still running.
  const all = terminals();
  const term = all.find((t) => t.address === tg.terminal);
  const parent = term?.parent && all.find((t) => t.address === term.parent);
  // Once they go to the program, Shift+right-click still opens this menu.
  const toProgram = term?.labels?.["herdr.right-click"] === "program";
  // A terminal shown outside a tab (a layout terminal block, a window) has
  // no pane to split, zoom or close: its pane is the block's id.
  const inTab = panes().some((pane) => pane.pane === tg.pane);
  const zoomed = panes().find((pane) => pane.pane === tg.pane)?.zoomed;
  return [
    ...(inTab
      ? [
          ["Split right", "pane.split", { direction: "right", pane: tg.pane }, "split-right"],
          ["Split down", "pane.split", { direction: "down", pane: tg.pane }, "split-down"],
          [zoomed ? "Unzoom" : "Zoom", "pane.zoom", { pane: tg.pane }, zoomed ? "unzoom" : "zoom"],
        ]
      : []),
    ...(term
      ? [
          toProgram
            ? ["Use Herdr right-click menu", "terminal.right_click", { terminal: term.address, to: "menu" }, "terminal"]
            : ["Send right-clicks to pane", "terminal.right_click", { terminal: term.address, to: "program" }, "terminal"],
        ]
      : []),
    ...(parent ? [[`Send back to ${parent.name || parent.address}`, "terminal.park", { terminal: term.address }, "terminal"]] : []),
    ...(inTab ? [["Close pane", "pane.close", { pane: tg.pane }, "close"]] : []),
  ];
}

// Split, zoom and close are the pane header's own icons; the rest come from
// the workspace's icon set.
const PANE_ICONS = new Set(["split-right", "split-down", "zoom", "unzoom", "close"]);
function iconPath(name) {
  return PANE_ICONS.has(name) ? `mods/along-pane/${name}.svg` : `mods/workspace-chrome/${name}.svg`;
}

// The key bound to a command, for the hint on the right.
function shortcut(name, args) {
  // `pane.split:right` binds pane.split with { direction: "right" }.
  const value = args && Object.values(args)[0];
  const k = keys().find((b) => b.section === "global" && (b.action === name || b.action === `${name}:${value}`));
  return k ? k.keys : "";
}

export default class PaneMenu extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  choose(i, cx) {
    const it = items(props())[i];
    if (!it) return;
    closeOverlay(props()?.overlay);
    run(it[1], it[2]);
  }

  render(cx) {
    const t = theme();
    const list = items(props());
    return v_flex()
      .id("along-pane-menu")
      .track_focus(this.handle)
      .w_full()
      .min_h(0)
      .p(5)
      .bg(t.popover)
      .text_size(12.8)
      .on_key_down((e, cx) => {
        if (!list.length) return;
        if (e.key === "down") this.at = (this.at + 1) % list.length;
        else if (e.key === "up") this.at = (this.at + list.length - 1) % list.length;
        else if (e.key === "enter") this.choose(this.at, cx);
        else if (e.key === "escape") closeOverlay(props().overlay);
        else return;
        cx.notify();
      })
      .children(
        list.map((it, i) =>
          v_flex()
            .when(i > 0 && it[1].endsWith(".close"), (el) => el.child(div().mx(7).my(4).h(1).bg(t.border)))
            .child(h_flex()
              .id(`along-pane-menu-${i}`)
              .h(31)
              .px(8)
              .gap(9)
              .rounded(7)
              .items_center()
              .justify_between()
              .text_color(t.foreground)
              .when(i === this.at, (el) => el.bg(t.selected))
              .hover((s) => s.bg(t.hover))
              .on_click((_e, cx) => this.choose(i, cx))
              .child(svg(iconPath(it[3])).size(14).flex_none().text_color(t.muted))
              .child(div().flex_1().truncate().child(it[0]))
              .child(div().flex_none().text_size(11).text_color(t.dim).child(shortcut(it[1], it[2])))),
        ),
      );
  }
}

// Along's fork of the shipped workspace-chrome: the brand row gains a Settings
// button to the left of the search button (with the update-ready dot). The
// footer branch is gone — Along's Add machine lives in the tab bar, next to
// Machines. Everything else matches the shipped mod.

import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { theme, run, window, shared, setShared, updates, layout, openOverlay } from "herdr";

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
// 品牌行要放得下名字和右侧三个按钮（设置、搜索、折叠）；比这窄时名字被挤、
// 按钮也会被裁，所以三个按钮收进一个 "⋯" 菜单。
const BAR_MIN = 236;

// To the rail (on macOS wide enough for the traffic lights), or back to the width it had.
function toggleSidebar() {
  const width = find(layout(), "sidebar")?.size?.px;
  if (!narrow()) setShared("sidebar.width", width);
  // Mods edited before the rail went by width still read the flag.
  setShared("sidebar.collapsed", !narrow());
  run("layout.resize", { id: "sidebar", px: narrow() ? (shared("sidebar.width") ?? 268) : window()?.platform === "macos" ? 76 : 44 });
}

export default class AlongChrome extends View {
  // label 是画出来的东西（图标或「⋯」），name 是读屏软件念的名字。
  button(id, label, name, action) {
    const t = theme();
    return div().id(id).size(26).flex_none().flex().items_center().justify_center().rounded(6).role("button").accessibility_label(name).text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(action).child(label);
  }
  render() {
    const t = theme();
    const collapsed = narrow();
    const width = find(layout(), "sidebar")?.size?.px ?? Infinity;
    const tight = !collapsed && width < BAR_MIN;
    const ready = div().size(6).rounded_full().bg(t.accent);
    const settings = div().id("settings").relative().size(26).flex_none().flex().items_center().justify_center().rounded(6).role("button").accessibility_label("Settings").text_color(t.muted).hover(s => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation()).on_click(() => run("app.settings"))
      .child(svg("mods/workspace-chrome/settings.svg").size(15))
      .when(Boolean(updates().app.ready), el => el.child(ready.absolute().top(5).right(6)));
    // 窄时把三个按钮收起来，留一个 "⋯"：菜单项和按钮一一对应。
    const to = window()?.platform === "macos" ? 76 : 44;
    const more = this.button("bar-more", div().text_size(15).child("⋯"), "More actions", () => {
      setShared("sidebar.width", width);
      openOverlay({
        mod: "along-menu",
        kind: "popup",
        width: 220,
        height: 120,
        props: { target: { actions: [
          { label: "Settings", icon: "mods/workspace-chrome/settings.svg", run: { name: "app.settings" } },
          { label: "Search", icon: "mods/workspace-chrome/search.svg", run: { name: "mod.open", args: { name: "picker" } } },
          { label: "Hide sidebar", icon: "mods/workspace-chrome/sidebar.svg", run: { name: "layout.resize", args: { id: "sidebar", px: to } } },
        ] } },
      });
    });
    return h_flex().size_full().bg(t.chrome).pl(collapsed ? 6 : 14).pr(10).gap(4).items_center().text_size(13.5)
      .when(window()?.platform === "macos" && !window()?.fullscreen && !collapsed, el => el.pl(76))
      .when(!collapsed, el => el.child(h_flex().flex_1().min_w(0).gap(8).items_center().child(image("frame/welcome/herdr.png").size(20).rounded(5)).child(div().font_semibold().truncate().text_color(t.foreground).child("Herdr"))))
      .when(!collapsed && !tight, el => el.child(settings))
      .when(!collapsed && !tight, el => el.child(this.button("search", svg("mods/workspace-chrome/search.svg").size(15), "Search", () => run("mod.open", { name: "picker" }))))
      .when(tight, el => el.child(more))
      // On the macOS rail the traffic lights fill the row; the agents list's » unfolds it.
      .when(!tight && !(collapsed && window()?.platform === "macos"), el => el.child(this.button("sidebar-toggle", svg("mods/workspace-chrome/sidebar.svg").size(15), collapsed ? "Show sidebar" : "Hide sidebar", toggleSidebar)));
  }
}

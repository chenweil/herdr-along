import { View, div, svg } from "gpui-kit";
import { v_flex, h_flex } from "gpui-base";
import { props, closeOverlay, theme, run } from "herdr";

function items() {
  const target = props()?.target ?? {};
  // 动作菜单（如侧栏顶部的 "⋯"）：三项按顺序给，点了执行 run。
  if (Array.isArray(target.actions)) {
    return target.actions.filter((a) => a?.label).map((a) => ({ label: a.label, icon: a.icon, run: a.run }));
  }
  const rows = [
    ["Copy Path", target.path],
    ["Copy Relative Path", target.relative],
    ["Copy Name", target.name],
  ];
  return rows
    .filter((it, i, all) => it[1] && all.findIndex((other) => other[1] === it[1]) === i)
    .map(([label, value]) => ({ label, value, copy: true }));
}

export default class CopyMenu extends View {
  init(_props, cx) {
    this.at = 0;
    this.handle = cx.focus_handle();
    this.handle.focus();
  }

  choose(i, cx) {
    const item = items()[i];
    if (!item) return;
    closeOverlay(props()?.overlay);
    if (item.run) run(item.run.name, item.run.args ?? {});
    else cx.write_to_clipboard(item.value);
  }

  render(cx) {
    const t = theme(), list = items();
    return v_flex()
      .id("along-menu")
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
        else if (e.key === "escape") closeOverlay(props()?.overlay);
        else return;
        cx.notify();
      })
      .children(list.map((item, i) =>
        h_flex()
          .id(`along-menu-${i}`)
          .h(31)
          .px(8)
          .gap(9)
          .rounded(7)
          .items_center()
          .text_color(t.foreground)
          .when(i === this.at, (el) => el.bg(t.selected))
          .hover((s) => s.bg(t.hover))
          .on_click((_e, cx) => this.choose(i, cx))
          .child(svg(item.icon ?? "mods/along-menu/copy.svg").size(14).flex_none().text_color(t.muted))
          .child(div().flex_1().child(item.label))
      ));
  }
}

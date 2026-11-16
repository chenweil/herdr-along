// The bar on top of a floated pane (the window overlay along-pane's Float
// button opens after parking the terminal): who it is and how it's doing,
// the ↙ arrow sends the terminal back into the layout, ✕ closes the window
// (the terminal keeps running parked; the agents list can bring it back).
// Props: { terminal, overlay }. Presses on the bar drag the window; the
// buttons stop them.

import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, terminals, panes, spaces, focused, run, theme, props, closeOverlay, shared, setShared, notify } from "herdr";

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

  // 图标按钮：iconName 为 mods/along-float/ 下的 svg 名
  button(t, id, label, onClick, iconName) {
    const el = h_flex()
      .id(id)
      .px(8)
      .py(2)
      .gap(5)
      .items_center()
      .rounded(5)
      .text_color(t.muted)
      .cursor_pointer()
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click(onClick);
    if (iconName) el.child(svg(`mods/along-float/${iconName}.svg`).size(12).flex_none());
    return el.child(label);
  }

  // 按用户最后点击的主布局 pane 和指定方向落回。
  // Herdr 当前没有悬浮窗坐标 API，所以不能从拖动位置自动推断目标。
  async restoreAt(task, terminal, target, direction) {
    const settle = async (pred, tries = 20) => {
      for (let i = 0; i < tries; i++) {
        await task.sleep(25);
        const f = focused();
        if (pred(f)) return f;
      }
      return null;
    };
    run("pane.focus", { pane: target.pane });
    await settle((f) => f?.pane === target.pane);
    const place = direction === "left" ? "right" : direction === "up" ? "down" : direction;
    run("terminal.keep", { terminal, place });
    if (direction === "left" || direction === "up") {
      for (let i = 0; i < 20; i++) {
        await task.sleep(100);
        const returned = panes().find((p) => p.terminal === terminal);
        if (!returned) continue;
        run("pane.focus", { pane: returned.pane });
        await settle((f) => f?.pane === returned.pane);
        run("pane.swap", { direction });
        return;
      }
    }
  }

  // 送回布局：优先使用用户点击的目标 pane；没有目标时才按 float 来源兜底。
  // 方向按钮对应目标 pane 的四个边，不再依赖当前焦点猜测。
  // split：左邻→它右边，上邻→它下面；只有右/下邻的先 split 到镜像侧，
  // 等 keep 在后台建好新 pane 后再 pane.swap 换回原侧。邻居都不在了就
  // 紧挨焦点 pane；原 tab 不在就回原 space 的新 tab。
  // 命令是异步应用的：每步都轮询 focused()/panes() 直到反映变化。
  back(cx, direction = "right") {
    if (this.backing) return;
    const { terminal, overlay } = props() ?? {};
    if (!terminal) return;
    this.backing = true;
    cx.spawn(async (task) => {
      try {
        const settle = async (pred, tries = 12) => {
          for (let i = 0; i < tries; i++) {
            await task.sleep(25);
            const f = focused();
            if (pred(f)) return f;
          }
          return null;
        };
        const home = panes().some((p) => p.terminal === terminal);
        if (home) {
          run("pane.focus", { terminal });
          this.done(terminal, overlay);
          return;
        }
        const origins = /** @type {Record<string, {space: string, tab: string, spaceName: string, tabName: string, neighbors: Record<string, string | null>}>} */ (shared("along.floats.origins") ?? {});
        const origin = origins[terminal];
        // space/tab 的 id 在窗口重启后会变：先按 id 找，再按名字兑底。
        const match = (list, id, name) =>
          list.find((x) => x.id === id) ?? (name ? list.find((x) => x.name === name) : null);
        const space = origin && match(spaces(), origin.space, origin.spaceName);
        const tab = space && origin && match(space.tabs ?? [], origin.tab, origin.tabName);
        if (!space) {
          // 原 space 没了（记录已失效）：落到当前 space 的新 tab，并清掉记录。
          run("terminal.keep", { terminal, place: "tab" });
          this.done(terminal, overlay);
          return;
        }
        run("space.select", { id: space.id });
        if (!tab) {
          run("terminal.keep", { terminal, place: "tab" });
          this.done(terminal, overlay);
          return;
        }
        run("tab.select", { id: tab.id });
        await settle((f) => f?.tab === tab.id);
        const here = new Set(panes().filter((x) => x.tab === tab.id).map((x) => x.pane));
        if (here.size === 0) {
          run("terminal.keep", { terminal, place: "tab" });
          this.done(terminal, overlay);
          return;
        }
        const picked = shared("along.floats.target");
        const target = picked && panes().find((p) => p.pane === picked.pane && p.tab === tab.id);
        if (target) {
          await this.restoreAt(task, terminal, target, direction);
          this.done(terminal, overlay);
          return;
        }
        const plan = [["left", "right", null], ["up", "down", null], ["right", "right", "left"], ["down", "down", "up"]];
        let handled = false;
        for (const [side, place, swapBack] of plan) {
          const neighbor = origin?.neighbors?.[side];
          if (!neighbor || !here.has(neighbor)) continue;
          run("pane.focus", { pane: neighbor });
          await settle((f) => f?.pane === neighbor);
          run("terminal.keep", { terminal, place });
          if (swapBack) {
            // keep 在后台完成：等终端拿到新 pane，再 swap 换回原侧。
            for (let i = 0; i < 20 && !panes().some((x) => x.terminal === terminal); i++) {
              await task.sleep(100);
            }
            const p2 = panes().find((x) => x.terminal === terminal);
            if (p2) {
              run("pane.focus", { pane: p2.pane });
              await settle((f) => f?.pane === p2.pane);
              run("pane.swap", { direction: swapBack });
            }
          }
          handled = true;
          break;
        }
        if (!handled) run("terminal.keep", { terminal, place: "right" });
        this.done(terminal, overlay);
      } catch (e) {
        // 失败不清窗（还能重试），报告原因，并解锁按钮。
        notify({ title: "Send back failed", body: String(e?.message ?? e) });
      } finally {
        this.backing = false;
      }
    });
  }

  // 清掉记录并关窗。
  done(terminal, overlay) {
    const origins = /** @type {Record<string, {space: string, tab: string, neighbors: Record<string, string | null>}>} */ (shared("along.floats.origins") ?? {});
    if (origins[terminal]) {
      delete origins[terminal];
      setShared("along.floats.origins", origins);
    }
    closeOverlay(overlay);
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
      .child(div().text_color(t.dim).text_size(11).child("落到当前 Pane："))
      .child(this.button(t, "back-left", "←", (_e, cx) => this.back(cx, "left")).tooltip("落到目标 pane 左侧"))
      .child(this.button(t, "back-right", "→", (_e, cx) => this.back(cx, "right")).tooltip("落到目标 pane 右侧"))
      .child(this.button(t, "back-up", "↑", (_e, cx) => this.back(cx, "up")).tooltip("落到目标 pane 上方"))
      .child(this.button(t, "back-down", "↓", (_e, cx) => this.back(cx, "down")).tooltip("落到目标 pane 下方"))
      .child(this.button(t, "keep", home ? "go to" : "send back", (_e, cx) => this.back(cx), "back")
        .tooltip(home ? "Go to the terminal in the layout" : "使用默认位置送回布局"))
      .child(this.button(t, "close", "✕", () => closeOverlay(overlay)));
  }
}

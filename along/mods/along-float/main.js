// The bar on top of a floated pane (the window overlay along-pane's Float
// button opens after parking the terminal): who it is and how it's doing,
// the drop icon and four direction buttons send the terminal back into the layout, ✕ closes the window
// (the terminal keeps running parked; the agents list can bring it back).
// Props: { terminal, overlay }. Presses on the bar drag the window; the
// buttons stop them.

import { View, div, image, svg } from "gpui-kit";
import { h_flex } from "gpui-base";
import { agents, terminals, panes, spaces, focused, run, theme, props, closeOverlay, shared, setShared, notify } from "herdr";

const SPIN = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const WORDS = { working: "working", blocked: "needs you", done: "finished", idle: "idle" };

// 状态色与 along-spaces/along-pane 一致：都是红绿灯三色。浮动条的名字和标记都用它，
// 跟左侧列表里同一 pane 的颜色对上。
// 深色主题用饱和原色；浅色主题（白底）用同色相的深墨——亮色在白底上只有 1.7:1。
const STATE = {
  dark:  { working: "#4ade80", blocked: "#e3814f", done: "#3fae6a", idle: "#9b9b9b", error: "#ff5f66" },
  light: { working: "#146b30", blocked: "#855700", done: "#2a7a2e", idle: "#636a74", error: "#c62a2a" },
};

// 背景亮不亮决定用哪一套色。
const onLight = (hex) => {
  const h = (hex ?? "").replace("#", "").slice(0, 6);
  if (h.length < 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (r + g + b) / 3 > 140;
};

let lastBg = null;
let lastState = STATE.dark;
const stateColor = (t, status) => {
  if (t.background !== lastBg) {
    lastBg = t.background;
    lastState = onLight(t.background) ? STATE.light : STATE.dark;
  }
  return lastState[status] ?? lastState.idle;
};

// A name given to the pane or its agent row (along.names), so the float bar
// reads the same as both.
function customName(address) {
  const all = shared("along.names");
  return address && all && typeof all === "object" && !Array.isArray(all) ? all[`t:${address}`] ?? "" : "";
}

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

  clearPending(terminal) {
    const state = shared("along.floats.pending");
    if (!state || typeof state !== "object" || !state[terminal]) return;
    const next = { ...state };
    delete next[terminal];
    setShared("along.floats.pending", next);
  }

  pending() {
    const terminal = props()?.terminal;
    const state = shared("along.floats.pending");
    if (!state || typeof state !== "object" || !state[terminal]) return false;
    if (!panes().some((p) => p.terminal === terminal)) {
      this.clearPending(terminal);
      return false;
    }
    return true;
  }

  // 图标按钮：iconName 为 mods/along-float/ 下的 svg 名。label 是画出来的字
  // （方向键就是「←」这种没有含义的符号），name 才是读屏软件念的名字。
  button(t, id, label, name, onClick, iconName, disabled = false) {
    const el = h_flex()
      .id(id)
      .px(8)
      .py(2)
      .gap(5)
      .items_center()
      .rounded(5)
      .role("button")
      .accessibility_label(name)
      .text_color(disabled ? t.dim : t.muted)
      .opacity(disabled ? 0.45 : 1)
      .cursor_pointer()
      .disabled(disabled)
      .hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
      .on_click((_e, cx) => { if (!disabled) onClick(_e, cx); });
    if (iconName) el.child(svg(`mods/along-float/${iconName}.svg`).size(12).flex_none());
    return el.child(label);
  }

  // 按用户当前聚焦/最近点击的主布局 pane 和指定方向落回。
  // Herdr 当前没有稳定的悬浮窗坐标 API，所以不从拖动位置自动推断目标。
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
    if (!await settle((f) => f?.pane === target.pane)) throw new Error("target pane focus did not settle");
    const place = direction === "left" ? "right" : direction === "up" ? "down" : direction;
    run("terminal.keep", { terminal, place });
    let returned = null;
    for (let i = 0; i < 30; i++) {
      await task.sleep(100);
      returned = panes().find((p) => p.terminal === terminal);
      if (returned) break;
    }
    if (!returned) throw new Error("terminal.keep did not create a pane");
    if (direction === "left" || direction === "up") {
      run("pane.focus", { pane: returned.pane });
      if (!await settle((f) => f?.pane === returned.pane)) throw new Error("returned pane focus did not settle");
      run("pane.swap", { direction });
    }
  }

  // 送回布局：优先使用本次操作前聚焦的目标 pane，再用按 tab 保存的目标，
  // 最后按 float 来源兜底。方向按钮对应目标 pane 的四个边。
  // split：左邻→它右边，上邻→它下面；只有右/下邻的先 split 到镜像侧，
  // 等 keep 在后台建好新 pane 后再 pane.swap 换回原侧。邻居都不在了就
  // 紧挨焦点 pane；原 tab 不在就回原 space 的新 tab。
  // 命令是异步应用的：每步都轮询 focused()/panes() 直到反映变化。
  back(cx, direction = "right") {
    if (this.backing || this.pending()) return;
    const { terminal, overlay } = props() ?? {};
    if (!terminal) return;
    this.backing = true;
    cx.spawn(async (task) => {
      try {
        const initialFocus = focused();
        const settle = async (pred, tries = 12) => {
          for (let i = 0; i < tries; i++) {
            await task.sleep(25);
            const f = focused();
            if (pred(f)) return f;
          }
          return null;
        };
        const waitForPane = async (tries = 30) => {
          for (let i = 0; i < tries; i++) {
            await task.sleep(100);
            const returned = panes().find((p) => p.terminal === terminal);
            if (returned) return returned;
          }
          throw new Error("terminal.keep did not create a pane");
        };
        const waitForTabPanes = async (tabId, tries = 20) => {
          for (let i = 0; i < tries; i++) {
            await task.sleep(25);
            const current = panes().filter((p) => p.tab === tabId);
            if (current.length) return current;
          }
          return [];
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
          // 原 space 没了：确认新 tab 已创建后再关窗。
          run("terminal.keep", { terminal, place: "tab" });
          await waitForPane();
          this.done(terminal, overlay);
          return;
        }
        run("space.select", { id: space.id });
        if (!tab) {
          run("terminal.keep", { terminal, place: "tab" });
          await waitForPane();
          this.done(terminal, overlay);
          return;
        }
        run("tab.select", { id: tab.id });
        if (!await settle((f) => f?.space === space.id && f?.tab === tab.id)) {
          throw new Error("origin tab did not settle");
        }
        const tabPanes = await waitForTabPanes(tab.id);
        if (tabPanes.length === 0) {
          run("terminal.keep", { terminal, place: "tab" });
          await waitForPane();
          this.done(terminal, overlay);
          return;
        }
        // 优先使用当前真正聚焦的主布局 pane。点击终端内容区也会聚焦
        // pane，但不会经过 along-pane 的 header click，因此不能只依赖 shared。
        const focusedTarget = initialFocus?.tab === tab.id && initialFocus.pane
          ? tabPanes.find((p) => p.pane === initialFocus.pane)
          : null;
        const targetMap = shared("along.floats.targets");
        const picked = targetMap && typeof targetMap === "object" ? targetMap[tab.id] : null;
        const rememberedTarget = picked && tabPanes.find((p) => p.pane === picked.pane);
        const target = focusedTarget ?? rememberedTarget;
        if (picked && !rememberedTarget) {
          const nextTargets = { ...(targetMap ?? {}) };
          delete nextTargets[tab.id];
          setShared("along.floats.targets", nextTargets);
        }
        if (target) {
          try {
            await this.restoreAt(task, terminal, target, direction);
            this.done(terminal, overlay);
            return;
          } catch {
            // 目标 pane 可能刚被关闭；继续尝试来源邻居，不把终端落到旧焦点。
          }
        }
        const plan = {
          left: ["left", "up", "right", "down"],
          up: ["up", "left", "right", "down"],
          right: ["right", "left", "up", "down"],
          down: ["down", "left", "up", "right"]
        }[direction] ?? ["right", "left", "up", "down"];
        let restored = false;
        for (const side of plan) {
          const neighbor = origin?.neighbors?.[side];
          if (!neighbor || !tabPanes.some((p) => p.pane === neighbor)) continue;
          try {
            await this.restoreAt(task, terminal, { pane: neighbor }, side);
            restored = true;
            break;
          } catch {
            // 一个旧邻居失效时，继续尝试下一个方向。
          }
        }
        if (!restored) {
          // 没有目标和有效来源邻居时，明确落到新 tab，而不是猜一个右侧 pane。
          run("terminal.keep", { terminal, place: "tab" });
          let returned = null;
          for (let i = 0; i < 30; i++) {
            await task.sleep(100);
            returned = panes().find((p) => p.terminal === terminal);
            if (returned) break;
          }
          if (!returned) throw new Error("terminal.keep did not create a fallback tab");
        }
        this.done(terminal, overlay);
      } catch (e) {
        // 失败不清窗（还能重试），报告原因，并解锁按钮。
        notify({ title: "Could not return the float", body: String(e?.message ?? e) });
      } finally {
        this.backing = false;
      }
    });
  }

  // 成功落回：清掉来源记录并关窗。
  done(terminal, overlay) {
    this.clearPending(terminal);
    const origins = /** @type {Record<string, {tab?: string}>} */ (shared("along.floats.origins") ?? {});
    const origin = origins[terminal];
    if (origin) {
      delete origins[terminal];
      setShared("along.floats.origins", origins);
      const targets = /** @type {Record<string, object>} */ (shared("along.floats.targets") ?? {});
      if (origin.tab && targets[origin.tab]) {
        delete targets[origin.tab];
        setShared("along.floats.targets", targets);
      }
    }
    closeOverlay(overlay);
  }

  // 关闭浮窗意味着放弃这次来源恢复；终端仍 parked，可从 agents 列表找回。
  dismiss(terminal, overlay) {
    this.clearPending(terminal);
    const origins = /** @type {Record<string, object>} */ (shared("along.floats.origins") ?? {});
    if (origins[terminal]) {
      delete origins[terminal];
      setShared("along.floats.origins", origins);
    }
    closeOverlay(overlay);
  }

  cleanupOrigins() {
    const live = new Set(terminals().map((t) => t.address));
    const origins = /** @type {Record<string, object>} */ (shared("along.floats.origins") ?? {});
    let changed = false;
    for (const terminal of Object.keys(origins)) {
      if (!live.has(terminal)) {
        delete origins[terminal];
        changed = true;
      }
    }
    if (changed) setShared("along.floats.origins", origins);
  }

  render() {
    this.cleanupOrigins();
    const t = theme();
    const { terminal, overlay } = props() ?? {};
    const k = this.term();
    const st = this.status();
    const pic = icon(k?.program, 14, t.foreground);
    const pending = this.pending();
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
      .child(div().w(12).flex_none().text_color(st ? stateColor(t, st) : t.dim).when(st === "working", (el) => el.frames(SPIN, 90)).child(glyph))
      .when(Boolean(pic), (el) => el.child(pic))
      .child(div().truncate().font_semibold().text_color(st ? stateColor(t, st) : t.foreground).child(customName(terminal) || k?.name || k?.template || k?.program?.name || terminal || ""))
      .when(Boolean(st), (el) => el.child(div().flex_none().text_color(stateColor(t, st)).child(WORDS[st] ?? st)))
      .child(div().flex_1())
      .child(this.button(t, "drop", "", "Return to the focused pane", (_e, cx) => this.back(cx), "back", pending)
        .tooltip(pending ? "Preparing the float" : "Return to the focused pane, or the source pane if there is none"))
      .child(this.button(t, "back-left", "←", "Return to the left of the focused pane", (_e, cx) => this.back(cx, "left"), null, pending).tooltip("Return to the left of the target pane; the source pane if there is none"))
      .child(this.button(t, "back-right", "→", "Return to the right of the focused pane", (_e, cx) => this.back(cx, "right"), null, pending).tooltip("Return to the right of the target pane; the source pane if there is none"))
      .child(this.button(t, "back-up", "↑", "Return above the focused pane", (_e, cx) => this.back(cx, "up"), null, pending).tooltip("Return above the target pane; the source pane if there is none"))
      .child(this.button(t, "back-down", "↓", "Return below the focused pane", (_e, cx) => this.back(cx, "down"), null, pending).tooltip("Return below the target pane; the source pane if there is none"))
      .child(this.button(t, "close", "✕", "Close the float", () => this.dismiss(terminal, overlay)));
  }
}

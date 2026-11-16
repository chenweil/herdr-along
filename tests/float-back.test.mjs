// 保留真实模块导入，执行点击后的异步分支，防止漏导入被初始化检查漏掉。
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { SourceTextModule, SyntheticModule } from 'node:vm';

for (const side of ['left', 'up', 'right', 'down']) {
  test(`send back：${side} 邻居分支可执行且无未定义变量`, async () => {
    const commands = [];
    const failures = [];
    let kept = false;
    let closed = false;
    let selected = false;
    let stalePaneSnapshot = true;
    // 先处于别的 tab；tab.select 后才聚焦来源 tab，确保本用例走 fallback 邻居分支。
    let focus = { space: 'other-space', tab: 'other-tab', pane: null };
    const origins = {
      terminal: { space: 'space', tab: 'tab', neighbors: { [side]: 'neighbor' } }
    };
    const api = {
      agents: () => [],
      terminals: () => [],
      panes: () => {
        if (selected && stalePaneSnapshot) {
          stalePaneSnapshot = false;
          return [];
        }
        return [
          { pane: 'neighbor', tab: 'tab', terminal: 'other' },
          ...(kept ? [{ pane: 'returned', tab: 'tab', terminal: 'terminal' }] : [])
        ];
      },
      spaces: () => [{ id: 'space', tabs: [{ id: 'tab' }] }],
      focused: () => focus,
      run: (name, args) => {
        commands.push({ name, args });
        if (name === 'terminal.keep') kept = true;
        if (name === 'tab.select') {
          selected = true;
          focus = { space: 'space', tab: 'tab', pane: 'neighbor' };
        }
        if (name === 'pane.focus') focus = { space: 'space', tab: 'tab', pane: args.pane };
      },
      theme: () => ({}),
      props: () => ({ terminal: 'terminal', overlay: 'overlay' }),
      closeOverlay: () => { closed = true; },
      shared: (key) => key === 'along.floats.origins' ? origins : key === 'along.floats.pending' ? {} : {},
      setShared: () => {},
      notify: (value) => failures.push(value)
    };
    const modules = {
      herdr: api,
      'gpui-kit': { View: class {}, div() {}, image() {}, svg() {} },
      'gpui-base': { h_flex() {} }
    };
    const source = await readFile(new URL('../along/mods/along-float/main.js', import.meta.url), 'utf8');
    const mod = new SourceTextModule(source);
    await mod.link((specifier) => {
      const exports = modules[specifier];
      assert.ok(exports, `未知依赖：${specifier}`);
      return new SyntheticModule(Object.keys(exports), function () {
        for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
      });
    });
    await mod.evaluate();
    const instance = new mod.namespace.default();
    let pending;
    instance.back({
      spawn(body) { pending = body({ sleep: async () => {} }); }
    }, side);
    await pending;
    assert.deepEqual(failures, [], '点击分支不应报告错误');
    assert.equal(kept, true, '应执行 terminal.keep');
    assert.equal(closed, true, '成功后应关闭浮窗');
    assert.equal(instance.backing, false, '按钮应解除锁定');
    const keep = commands.find((c) => c.name === 'terminal.keep');
    assert.equal(keep.args.place, side === 'up' || side === 'down' ? 'down' : 'right');
  });
}

test('stale pending is cleared after the floated terminal leaves the pane list', async () => {
  const state = { terminal: true };
  let saved;
  const api = {
    agents: () => [],
    terminals: () => [{ address: 'terminal' }],
    panes: () => [],
    spaces: () => [],
    focused: () => null,
    run: () => {},
    theme: () => ({}),
    props: () => ({ terminal: 'terminal' }),
    closeOverlay: () => {},
    shared: (key) => key === 'along.floats.pending' ? state : {},
    setShared: (key, value) => { saved = { key, value }; },
    notify: () => {}
  };
  const modules = {
    herdr: api,
    'gpui-kit': { View: class {}, div() {}, image() {}, svg() {} },
    'gpui-base': { h_flex() {} }
  };
  const source = await readFile(new URL('../along/mods/along-float/main.js', import.meta.url), 'utf8');
  const mod = new SourceTextModule(source);
  await mod.link((specifier) => new SyntheticModule(Object.keys(modules[specifier]), function () {
    for (const [key, value] of Object.entries(modules[specifier])) this.setExport(key, value);
  }));
  await mod.evaluate();
  const instance = new mod.namespace.default();

  assert.equal(instance.pending(), false);
  assert.deepEqual(saved, { key: 'along.floats.pending', value: {} });

  state.terminal = true;
  saved = undefined;
  instance.done('terminal', 'overlay');
  assert.deepEqual(saved, { key: 'along.floats.pending', value: {} });
});

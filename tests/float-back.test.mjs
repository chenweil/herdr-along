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
    let focus = { tab: 'tab', pane: 'neighbor' };
    const origins = {
      terminal: { space: 'space', tab: 'tab', neighbors: { [side]: 'neighbor' } }
    };
    const api = {
      agents: () => [],
      terminals: () => [],
      panes: () => [
        { pane: 'neighbor', tab: 'tab', terminal: 'other' },
        ...(kept ? [{ pane: 'returned', tab: 'tab', terminal: 'terminal' }] : [])
      ],
      spaces: () => [{ id: 'space', tabs: [{ id: 'tab' }] }],
      focused: () => focus,
      run: (name, args) => {
        commands.push({ name, args });
        if (name === 'terminal.keep') kept = true;
        if (name === 'pane.focus') focus = { tab: 'tab', pane: args.pane };
      },
      theme: () => ({}),
      props: () => ({ terminal: 'terminal', overlay: 'overlay' }),
      closeOverlay: () => { closed = true; },
      shared: () => origins,
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

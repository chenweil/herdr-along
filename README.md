# Along

A right-click menu for Herdr's Files and Changes panels: copy a file's
absolute path, its path relative to the panel folder or the repository root,
or just its name. A Machines button in the same headers lists the machines
herdr-core knows and enables or disables them.

Two packages, one repo:

| Folder | Kind | What it is |
| --- | --- | --- |
| [`along/`](along/) | layout | The whole window: Herdr's `main` layout with the Files and Changes panels replaced by Along's copies. Start here. |
| [`along-panels/`](along-panels/) | mod | The same four mods without a layout, for a window you already arranged. Files docks on the right; Changes is there for you to place. |

Each folder has its own `RECIPE.md` (the brief another agent builds it from)
and `preview.png`. Neither folder is installed by Herdr automatically.

## Install

Tell your agent:

```
Read ~/.config/herdr-app/AGENTS.md, then add this layout:
https://github.com/chenweil/herdr-along/tree/main/along
```

or, for the panels alone:

```
Read ~/.config/herdr-app/AGENTS.md, then add this mod:
https://github.com/chenweil/herdr-along/tree/main/along-panels
```

By hand: copy `along/layouts/along.json` into `~/.config/herdr-app/layouts/`
and each folder in `along/mods/` into `~/.config/herdr-app/mods/`, then
restart Herdr and switch to the `along` layout. For the panels alone, copy
`along-panels/mods/` into `~/.config/herdr-app/mods/` instead and add a block
that shows `along-files` to your layout.

## What it runs

These mods are trusted code, not sandboxed. They run local programs and read
files:

- `sh` or `powershell` to list a folder, and `git` for the repository root,
  status and diffs.
- `hc` (herdr-core) for the Machines dialog, which can remove a machine from
  herdr-core and add it back.
- `readTextFile` for the previews, inside the focused pane's folder.
- **The Changes panel commits.** Its Commit button runs `git add -A` and
  `git commit -m <message>` in the repository root.

Nothing here uses the network.

## License

Along is MIT licensed; see [LICENSE](LICENSE). `along-files` and
`along-changes` are copies of Herdr's shipped `files` and `changes` panels,
which are Apache 2.0 licensed; see [NOTICE](NOTICE) for attribution. The rest
(including `along-menu`, `along-machines` and both layouts) is original MIT
work.

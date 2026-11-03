# Along

A right-click menu for Herdr's Files and Changes panels: copy a file's
absolute path, its path relative to the panel folder or the repository root,
or just its name. A Machines button lists the machines herdr-core knows and
enables or disables them.

Two packages, one repo:

| Folder | Kind | Version | What it is |
| --- | --- | --- | --- |
| [`along/`](along/) | layout | 0.3.0 | The whole window: Herdr's `main` layout with Along's Files, Changes and tab bar. Machines sits in the top bar. Start here. |
| [`along-panels/`](along-panels/) | mod | 0.3.0 | Four mods without a layout, for a window you already arranged. Files and Changes carry their own Machines button. Files docks on the right; Changes is there for you to place. |

Each folder has its own `RECIPE.md` (the brief another agent builds it from)
`preview.png`, `VERSION` and `CHANGELOG.md`. Neither folder is installed by
Herdr automatically.

## Versions

Each package has a `VERSION` file and a `CHANGELOG.md`. When a package
changes, bump both together and add the entry to the top of its changelog.
`along/` and `along-panels/` carry the same version for the same change.

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

Along is Apache-2.0 licensed; see [LICENSE](LICENSE). `along-files` and
`along-changes` are modified copies of Herdr's shipped `files` and `changes`
panels, which are Apache 2.0 licensed; see [NOTICE](NOTICE) for attribution.

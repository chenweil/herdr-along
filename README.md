# Along

Along adds practical file and machine tools to Herdr. Its sidebar puts each
space's agents under the space's own row, one list with a state mark per
agent. The list keeps itself up to date: an agent that starts, ends, moves
space or changes state redraws on its own, and an agent program that reports
no status still gets a row. Panes and agent rows can be renamed in place.
Its panels add
right-click path copying to Files and Changes plus a Machines button. That
dialog lists herdr-core machines and enables or disables them, and its heading
carries "+ Add machine" for adding a new one. The full layout also adds
explicit pane floating and left/right/up/down controls for returning a float
to the workspace.

Two packages, one repo:

| Folder | Kind | Version | What it is |
| --- | --- | --- | --- |
| [`along/`](along/) | layout | 0.4.6 | The complete Along window: Files, Changes, Machines, explicit pane floating controls and pane renaming. Start here. |
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

Choose `along/` when you want the complete layout. Choose `along-panels/` when
you already have a layout and only want the Files, Changes and Machines tools.

## What it runs

These mods are trusted code, not sandboxed. They run local programs and read
files:

- `sh` or `powershell` to list a folder, and `git` for the repository root,
  status and diffs.
- `hc` (herdr-core) for the Machines dialog, which can remove a machine from
  herdr-core and add it back, and for "+ Add machine" in its heading
  (`hc machine add`, then `hc machine ls` every two seconds while the dialog is
  open).
- `readTextFile` for the previews, inside the focused pane's folder.
- **The Changes panel commits.** Its Commit button runs `git add -A` and
  `git commit -m <message>` in the repository root.

Nothing here uses the network.

## License

Along is Apache-2.0 licensed; see [LICENSE](LICENSE). `along-files` and
`along-changes` are modified copies of Herdr's shipped `files` and `changes`
panels, which are Apache 2.0 licensed; see [NOTICE](NOTICE) for attribution.

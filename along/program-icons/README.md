# Program icons for CodeBuddy and MiniMax Code

Two PNGs for Herdr's program table. Herdr has no built-in entry for either
program, so both used to show the generic `icons/agent.svg`.

`programs.json` is per-machine user config: merge these entries, never copy a
whole file over the one you already have.

## Install

```sh
sh along/program-icons/install.sh
```

It copies the two PNGs into `my-icons/`, merges the two entries into
`programs.json` (creating either if the machine has none) and backs up
`programs.json` first. Running it twice is safe: it replaces only these two
entries and leaves every other program alone. It reads `HERDR_APP_HOME` when
set, so a second window's home works too.

## By hand

1. Copy the two PNGs into `~/.config/herdr-app/my-icons/`. Not `icons/`:
   Herdr writes that folder itself and updates may rewrite it.
2. Merge this into `programs.json`, inside `programs`:

```json
"codebuddy": { "name": "CodeBuddy", "icon": "my-icons/codebuddy.png", "tint": false,
               "run": ["codebuddy"], "match": ["codebuddy-code"] },
"mcode":     { "name": "MiniMax Code", "icon": "my-icons/minimax-code.png", "tint": false,
               "run": ["mcode"], "match": ["mcode", "minimax-code"] }
```

`tint: false` because both are pictures, not one-color glyphs. The entries
apply live; `herdr-app status` should still report `errors: []`.

## Where the art comes from

- `codebuddy.png`: the mark out of `CodeBuddy CN.app`'s own icon
  (`Contents/Resources/CodeBuddy CN.icns`), trimmed of its outer margin and
  scaled to 128px. Purple tile, white cat.
- `minimax-code.png`: the mark inside `MiniMax Inside Code.app`
  (`app.asar` → `out/assets/logo/agentLogo.png`), with its alpha used as a
  mask over a blue→cyan gradient. The original fades to near-white at the
  bottom, which disappears at the 14px the sidebar draws; the gradient keeps
  the whole jellyfish readable on light and dark themes.

Both are 128px square with transparency, which is what `image()` wants.

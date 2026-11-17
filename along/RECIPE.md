# Along

Along adds right-click path copying to Herdr's Files and Changes panels, a
Machines button for herdr-core machines (with adding built into its dialog),
and explicit controls for floating a pane and returning it to the workspace,
and names for panes and their agents. Its sidebar puts each space's agents
under the space's own row, one list with a state mark per agent.

![Along](preview.png)

Version 0.4.7. See [CHANGELOG.md](CHANGELOG.md) for what changed.

This file is the brief: enough to build Along from an empty folder. The
files next to it are one build of it. If they don't work on your Herdr, or you
want it different, build it again from here.

## What you see

Herdr's default window, with Along's Files and Changes path menu, Machines
button, and Float controls and click-to-rename names in pane headers.

- **The window.** No title bar. A 268px sidebar on the left: a 46px brand
  block, then one spaces list (at least 90px) that carries each space's agents
  under its row. When the
  sidebar is collapsed, its expand button comes first in the
  compact spaces rail, before the new-space button. A tab bar 42px tall with
  the terminal tabs, a `+`, and Files,
  Changes and Machines buttons at the right, then the pane area, then a
  28px status bar.
  On the right, a panel column 368px wide (min 280, max 900), hidden until a
  panel is opened, holding Files and Changes as a stack with Files in front.
  Terminals get 14px of horizontal and 12px of vertical padding, and panes
  are 10px-radius cards with a 1px border that turns into the accent color
  when focused.
- **The Files panel.** A rounded 10px card on the theme background with a 1px
  border and 13px text. Header 42px: "Files" in semibold and the shown
  folder's name right-aligned in dim 12px. Rows are 28px, indented 18px per
  depth: a 12px chevron for a folder (12px of blank for a file), a 14px
  folder or file icon, the name, and, when git reports one, a status letter —
  `A` green, `D` and `U` red, `M` in the blocked color.
- **The Changes panel.** The same card. Header 42px: "Changes" in semibold,
  a bordered "N files" chip in 10px, then the total additions in green and
  deletions in red, both 11px. The changed-file list is at most 200px tall
  with 28px rows: the status letter in a 14px column, the directory prefix in
  dim text, the file name, and that file's own `+`/`−` counts. Below it the
  selected file's unified diff, 11px monospace on 20px rows, with a vertical
  scrollbar and horizontal scrolling; diff lines are never wrapped.
- **The commit bar.** At the bottom of Changes, a 32px rounded message input
  and a 32px "Commit" button. The button is filled with the theme's solid
  color only when the message is non-empty and no other git work is running.
- **The right-click menu.** A 210px popup with 5px padding on the theme's
  popover color and 12.8px text. Rows are 31px high with a 14px copy icon:
  "Copy Path", "Copy Relative Path", "Copy Name". A row whose value is empty
  or repeats an earlier row is dropped, so the menu can show fewer than three.
- **The Machines dialog.** 460×380, popover color, 12px padding, 13px text. A
  heading row "Machines" with "enable / disable" in dim 11px and a "+ Add
  machine" button that opens the machine-add dialog, then one 36px
  row per machine: a 7px dot (green when enabled, dim when disabled), the
  machine name, a second line with its state or "disabled" in dim 11px, and a
  "Disable" or "Enable" button in 11px.

## How it behaves

- Right-clicking any row in Files or Changes opens the menu for that row. In
  Files it works on folders and files; in Changes on changed files.
- "Copy Path" is absolute (`/home/me/project/src/main.js`, or
  `C:\work\project\src\main.js` on Windows). "Copy Relative Path" is relative
  to the folder the Files panel is showing, and in Changes relative to the
  repository root. "Copy Name" is the last path segment. The chosen value goes
  to the system clipboard and the menu closes.
- The menu takes focus when it opens, so keys go to it and not to the
  terminal behind it. Up and Down move the highlight, Enter copies, Escape
  closes. When it closes, typing reaches the terminal again.
- Path separators follow the platform: `/` on macOS and Linux, `\` on
  Windows, so a copied relative path pastes into that platform's shell.
- Files follows the focused pane's folder, reloads every 10 seconds and when
  the folder changes on disk, and remembers which folders are expanded per
  space. Clicking a folder expands it, clicking a file shows a read-only
  preview with syntax coloring, and "←" goes back to the list.
- Changes lists the repository's uncommitted files and shows the selected
  file's diff. Clicking a row opens its diff, clicking it again closes it.
- "Machines" opens the dialog from the tab bar. It reads the machines
  herdr-core knows with `hc machine ls --json`, again every two seconds while
  the dialog is open, so a machine added through the heading's "+ Add
  machine" entry appears on its own. "Disable" removes the machine
  with `hc machine rm` and keeps its profile in shared state; "Enable" adds it
  back with `hc machine add` and the saved target and session. The row shows
  "Working…" while the command runs.
- Nothing animates. The spaces list is the shipped `spaces` mod plus the
  agents list folded into it: every space's row is followed by its own
  agents.

## Spaces and agents in one list

- Each space's row is followed by its agents: the program icon (it folds the
  agent's sub-agent tree when clicked), the agent's name (its own title, else
  the tab's), the machine name when remote, and a small state mark — a
  spinner while working, a red `!` when blocked, a dot when done, a dot when
  the agent errored, an open ring when idle. An agent program that reports no
  status (no OSC 7501) gets a plain dim mark: it is running, only its state is
  unknown.
  Clicking a row focuses the agent's pane; clicking an icon
  of a sub-agent without a pane peeks at it.
- **State colours.** Every mark and every name uses one fixed palette rather
  than the theme's keys, so a state reads the same in light and dark: working
  `#4ade80`, done `#3fae6a`, blocked `#e3814f`, error `#e5484d`, idle
  `#8f8f8f`. The pane header's name, the agent row's name and the float bar's
  name all take their state's colour, and focusing a row does not replace it:
  focus is the row's background only. The same palette is copied into
  `along-pane`, `along-spaces` and `along-float` (each mod loads on its own).
- **Tree lines.** A 1px `border` line drops from the space row's icon centre
  through a 4px gap and down the left of its agent rows, with a short
  horizontal stub into each row's icon; the last row ends it. The gap keeps
  the space's rounded background from touching the first agent's.
- The list keeps itself: an agent that starts, ends, moves to another space
  or changes state redraws the rows under its space without waiting for
  something else to change. The focused agent's row is highlighted.
- An agent is listed under the space its own pane is in; a floated one
  (a float, "Send back") keeps the space it was parked from.
- A name given to a pane or an agent row reads the same in both places and
  in the float bar. A click on the pane header's name, or a right-click on
  an agent row, edits it in place: Enter saves, Escape cancels, clicking
  away keeps the text. Names live in `shared("along.names")`, keyed by the
  terminal's address (`t:<address>`) or the pane (`p:<pane>`); clearing one
  restores the automatic name.
- Indentation follows the space's own: a main checkout's row sits at 8px so
  its agents go to 32px and their sub-agents to 50px; a worktree's row sits
  at 22px past its branch icon, so its agents go to 46px and their
  sub-agents to 64px. A worktree row keeps its place after the main
  checkout's agents and carries its own agents one level deeper.
- Agents sort pinned-first, then urgent-first (blocked, done, working, idle),
  the most recent change breaking ties. Agents of no listed space (a machine
  away, or a space that closed under them) gather at the end under
  "Elsewhere", each named by its space. The collapsed rail shows spaces
  only, as before. The standalone agents list is gone: the layout no longer
  mounts `along-agents`, and the priority/grouped sort menu went with it.

## Built from

- **The layout**, `layouts/along.json`: a copy of the shipped `main` tree with
  `titlebar: "none"`, `traffic_lights: [12, 16]`, `terminal_padding:
  [14, 12]` and a 1px `border` divider. Its right column is `hidden: true`,
  368px, min 280, max 900, and holds a `stack` with `active: "files"` and two
  blocks, `content: { mod: "along-files" }` and `content: { mod:
  "along-changes" }`. The tab bar points at `along-tabs` and the pane header
  at `along-pane` instead of the shipped mods. Everything else points at
  shipped mods:
  `along-chrome` (brand), `along-spaces` (spaces with their agents), `pane`,
  `workspace-status`.
- **Ten mods**, all `"place": "none"` so only the layout decides where they
  show:
  - `along-chrome/` — the shipped `workspace-chrome` mod with a Settings
    button in the brand row, left of the search button; it carries the
    update-ready dot the footer's Settings row used to show. There is no
    footer: adding a machine lives in the Machines dialog now. Below 236px of
    sidebar (but above the 160px rail) the three buttons fold into one `⋯`
    that opens `along-menu` with the same three actions.
  - `along-pane/` — the shipped `pane` header mod plus a Float button and an
    in-place rename input: the name it shows is `shared("along.names")`'s
    entry for the pane, else the program's or the terminal's own. It probes
    the pane's neighbors with `pane.focus` + `pane.go` (left, up,
    right, down), records them with the source space and tab in
    `shared("along.floats.origins")`, then parks the pane's terminal with
    `terminal.park` (the terminal keeps running without a pane) and opens a
    `kind: "window"` overlay whose layout holds the along-float bar and a
    `{ terminal }` block. Main-pane clicks record the current target by tab
    in `shared("along.floats.targets")`. Herdr does not expose a reliable
    dragged-overlay rectangle or all pane rectangles, so Along deliberately
    does not infer a drop target from the float's visual position.
  - `along-float/` — the floating window's bar, a copy of the shipped
    `peek` bar. Shows the program icon, the custom name (else its own) and
    agent status; the four
    direction buttons return the terminal beside the currently focused pane
    (then the per-tab remembered target, then the recorded source neighbor
    as fallback). The direction is explicit because the overlay's visual
    position is not exposed reliably by the mod API. The drop icon is a
    default-right action, and every return waits for `terminal.keep` to
    create a pane before closing the overlay. "✕" leaves the terminal
    parked and discards its float origin.
  - `along-files/` — the shipped `files` mod plus `openOverlay`, the
    `windows`/`joiner` path helpers, a `rowMenu(path, entry)` method, an
    `.on_mouse_down("right", …)` on each row, and its own asset paths
    (`mods/along-files/…`).
  - `along-changes/` — the shipped `changes` mod with the same additions,
    its relative path measured from the repository root.
  - `along-tabs/` — the shipped `tabs` mod with a "Machines" button added
    after the Files and Changes buttons.
  - `along-menu/` — the popup. Reads `props().target` (`path`, `relative`,
    `name`) and `props().overlay`, writes with `cx.write_to_clipboard`, closes
    with `closeOverlay`. Given `props().target.actions` instead (a list of
    `{ label, icon, run }`), it draws those and runs the chosen one: the
    brand row's `⋯` uses this.
  - `along-machines/` — the dialog. Reads with `exec("hc", ["machine", "ls",
    "--json"])`, writes with `hc machine rm` and `hc machine add`, and keeps
    disabled profiles in shared state under `along.machines.disabled`. It
    migrates profiles from older per-overlay stores on first open.
  - `along-spaces/` — the shipped `spaces` mod with the sidebar expand button
    at the start of the compact rail, and the agents list folded in: each
    space's row is followed by its agents (see "Spaces and agents in one
    list"). It reads `agents()`, `terminals()`, `focused()` and
    `knownAgents()`, sorts with the agents list's urgency ranking, and
    calls `setAgentOrder` in the spaces' order so keyboard navigation keeps
    working. `knownAgents()` is what tells it which programs the app can
    start as agents (the `run` entries in programs.json), so an agent CLI
    added by hand gets a row even when it reports no status.
  - `along-agents/` — the shipped `agents` mod without the expand button that
    used to sit at the bottom of the compact rail. No longer mounted by the
    layout; kept in the repo for reference and possible return.
- **Data:** `spaces()`, `panes()` and `focused()` for the folder and the
  remote machine, `agents()` and `terminals()` for the agents under each
  space, `knownAgents()` for the programs the app can start as agents,
  `theme()` for every color, `settings()` for the preview
  font, `window()` for the platform.
- **Commands and programs:** `openOverlay` and `closeOverlay`; `exec("sh")`
  or `exec("powershell")` to list a folder; `exec("git")` for the root,
  status, diffs, `add` and `commit`; `exec("hc")` for machines;
  `readTextFile` for previews; `watchFolder` for live refresh.
- **Art:** four SVGs in `along-files/` (chevron down, chevron right, file,
  folder) and one copy icon in `along-menu/`. They are the shipped panels'
  icons.

## Watch out

- **The Changes panel writes to your repository.** Its Commit button runs
  `git add -A` and then `git commit -m <message>` in the repository root, so
  it stages everything, not only the rows you looked at. Drop the commit bar
  if you don't want that.
- The Machines dialog runs `hc` and can remove machines from herdr-core. A
  disabled machine's spaces disappear from the window until it is enabled
  again; its terminals keep running in the core.
- These are copies of the shipped `files`, `changes` and `tabs` mods, so they
  do not follow upstream fixes. When Herdr updates, re-copy
  `defaults/mods/files/`, `defaults/mods/changes/` and `defaults/mods/tabs/`
  and re-apply the right-click and Machines additions. This copy was synced
  against herdr-app 0.1.11.
- The `mods/along-files/…` asset paths, the `mod` names in the layout and the
  `mod` names in the `openOverlay` calls all name the same five folders.
  Renaming any of them means changing all of them.
- The Files panel caps at 500 entries per folder and 5,000 overall; Changes
  caps at 1,000 changed files. A preview is limited to 400,000 characters, and
  a file containing a NUL byte is reported as binary.
- Remote (SSH) machines list folders, run git and read previews through
  `hc`, so the same menu works there; only the path separator rule still
  follows the local platform.
- The panels are read-only apart from the commit bar. There is no create,
  rename, delete or drag.

## Done when

- `herdr-app check mods/along-files`, `mods/along-changes`, `mods/along-menu`,
  `mods/along-machines`, `mods/along-tabs`, `mods/along-pane`, `mods/along-float`,
  `mods/along-spaces` and `mods/along-chrome` pass.
- Switching to `along` (`ctrl-shift-l`, or `layout.switch along`) shows the
  sidebar, the tab bar with Machines next to Files and Changes, the terminals
  and the right panel with Files in front.
- Right-clicking a file row in Files opens the menu; each item puts the right
  string on the clipboard, and "Copy Relative Path" starts at the shown
  folder.
- Right-clicking a changed file in Changes copies paths relative to the
  repository root.
- Up, Down, Enter and Escape work in the menu, and the terminal receives keys
  again once it closes.
- "Machines" opens the dialog; Disable takes a machine out of `hc machine ls`
  and Enable brings it back with its target.
- Hovering a pane header shows the Float button; clicking it removes the
  pane from the layout and opens a draggable floating window holding the
  same terminal, with the along-float bar on top. While it is preparing,
  the drop controls are disabled. Click a main-layout pane to focus the
  desired target, then use `←`, `→`, `↑` or `↓` to split the terminal beside
  that target. If no target is available, the chosen direction is tried
  against the recorded source neighbors; if those are unavailable, a new
  tab is used. The drop icon is the default-right action. Every return waits
  for `terminal.keep` to create the pane before closing the window. `✕`
  leaves the terminal parked and discards the source record; the agents
  list can bring it back. The overlay position is remembered only by the
  host window; Along does not use it to infer a drop target.
- Switching to another layout and back keeps the panels, and Files still
  follows the focused pane's folder.
- An agent that starts, finishes or changes state shows up under its space
  without touching the window, and a pane running an agent program that
  reports no status gets a row with a dim mark.

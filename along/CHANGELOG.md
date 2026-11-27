# Changelog

Earlier builds did not carry a version number; this log starts at 0.3.0.

## 0.4.16 - 2026-11-28

- The Machines dialog joins the muted rule: "enable / disable", a machine's
  state and "No saved machines" were drawn in `dim` (2.6:1 to 3.5:1) and take
  `muted` now, and its dot for a disabled machine matches the sidebar's. A
  machine's state also reads as words there — `needs_login` shows as
  `needs login`, the same as the sidebar's machine row.
- Icon-only controls announce a name. A control that draws only an icon now
  carries `role("button")` and an `accessibility_label`: the pane header's
  Float, Split right, Split down, Zoom/Unzoom and Close and its `⋯`, the float
  bar's drop icon, four arrows and `✕`, the brand row's Settings, Search, `⋯`
  and sidebar toggle, the tab bar's `+` and window buttons and a tab's `✕`,
  the Files panel's `←`, the sidebar's New space, Expand sidebar and fold
  arrows, and a machine's `⚠` and `+`. A space's "needs you" badge is
  announced as "2 need you" instead of "2". The float bar's tooltips and its
  failure notice say the same thing in English now, like the rest of the
  window. A selected space or
  agent row reports itself as a selected option. The pane header's buttons are
  built only while the header is hovered, so they are in the tree only then —
  the hover reveal is unchanged.
- A space's avatar colour no longer repeats a state colour. `ansi3` was
  exactly the blocked orange and `ansi2` exactly the done green, so an
  orange avatar, an orange "needs you" badge and an orange blocked agent
  were the same colour on one space row. `ansi3` is now ochre `#c08a2e` and
  `ansi2` olive `#6f9e2f` — the nearest state colour is 49 and 78 away in
  RGB — and the letter in the tile keeps its dark ink at 5.9:1 and 5.6:1.
  The colours stay the space's own: they do not follow the theme.

## 0.4.15 - 2026-11-27

- Key text in the sidebar, the pane header, the float bar and the two panels
  takes the theme's `muted` colour instead of `dim`: a section heading, a
  label, a count, a machine name, a folder path and a diff's line numbers were
  all drawn at 2.6:1 to 3.5:1 on the surface they sat on, under AA's 4.5:1.
  `muted` gives 4.8:1 to 6.6:1. `dim` is kept where nothing is meant to be
  read — a disabled button's label and the editor's syntax colours.
- The traffic-light palette is retuned so an agent's name, which is written in
  its state colour, clears AA. On a dark surface error `#e5484d` becomes
  `#ff5f66` and idle `#8f8f8f` becomes `#9b9b9b`; on a light surface
  working `#1a7f37` becomes `#146b30`, done `#2e7d32` becomes `#2a7a2e`,
  blocked `#9a6700` becomes `#855700` and idle `#6e7781` becomes
  `#636a74`. On a light surface the darker hues still sit at 4.0:1 to 4.2:1
  on the selected row.
- A letter in a space's avatar is drawn in dark ink (`#15181d`) instead of
  white, which sat at 2.8:1 on the saturated avatar colours.

## 0.4.14 - 2026-11-27

- Agents that reported `blocked` or `error` gather at the top of the
  sidebar under a "Needs you" heading, each row named by its space, so an
  agent waiting in another space shows up without opening that space. The
  space that holds them carries the number as a badge in the blocked
  colour. The list under each space is unchanged: the agent still sits
  where it belongs.

## 0.4.13 - 2026-11-27

- The Changes panel's Commit button stages the paths it lists (`git add --
  <paths>`, a hundred at a time) instead of `git add -A`, so the commit
  carries the changes the panel showed rather than every change in the
  worktree, and the button says how many files it will commit.

## 0.4.12 - 2026-11-27

- Agent states keep the traffic-light palette — working `#4ade80`, done
  `#3fae6a`, blocked `#e3814f`, error `#e5484d`, idle `#8f8f8f` — and add
  the same hues as dark ink for a light surface (working `#1a7f37`, done
  `#2e7d32`, blocked `#9a6700`, error `#c62a2a`, idle `#6e7781`), because
  the bright hues sat at 1.7 to 2.8:1 on white. The background's own brightness
  picks the set, so the palette holds in every theme.

## 0.4.11 - 2026-11-25

- `program-icons/` gives CodeBuddy and MiniMax Code their own mark in Herdr's
  program table: the CodeBuddy app's purple tile with the white cat, and
  MiniMax Code's blue jellyfish flattened to a gradient so it stays readable
  at the 14px the sidebar draws. Herdr ships no entry for either program, so
  both showed the generic `agent.svg`.
- `program-icons/install.sh` copies the two PNGs into `my-icons/` (not
  `icons/`, which Herdr writes itself) and merges two entries into
  `programs.json`, backing the file up first. It creates both on a machine
  that has neither and replaces only those two entries when run again. The
  layout and the mods never reference them, so leaving the folder out changes
  nothing.

## 0.4.10 - 2026-11-25

- The collapsed rail no longer draws a rounded background block behind a
  space's number: the selected and hover backgrounds are gone, and the
  number's colour alone says which space is active. The agent state marks
  under the number stay.

## 0.4.9 - 2026-11-19

- The pane right-click menu now draws the pane header's icons: Split right
  is a framed pane cut vertically, Split down cut horizontally, and Zoom is
  the header's outward arrows (Unzoom once the pane is zoomed). Along ships
  the menu as `along-pane-menu` and points the layout's `terminal_menu` at
  it; at 280px wide, "Send right-clicks to pane" no longer truncates.

## 0.4.8 - 2026-11-18

- A floated pane's window now carries the focused pane's selected border:
  a 1px accent outline with the pane card's 10px radius around the float
  bar and terminal, so a float reads as the selected pane rather than a
  plain window.

## 0.4.7 - 2026-11-18

- State colours: one fixed palette for every mark and every name, in the
  sidebar, the pane header and the float bar. Working `#4ade80`, done
  `#3fae6a`, blocked `#e3814f`, error `#e5484d`, idle `#8f8f8f`. A state now
  reads the same in light and dark themes, and focusing an agent row no
  longer replaces its colour: focus is the row's background only.
- `error` gets its own mark and colour. It used to fall through to the idle
  ring, and a sub-agent's error was folded into `blocked`, so a failure read
  as orange. Both read red now, and error sorts above blocked.
- Agent rows hang off their space with tree lines: a vertical line from the
  space's icon centre through a gap, a short stub into each row's icon, and
  the last row closing it. The gap keeps the space's rounded background from
  touching the first agent's, and the agent row's own highlight is narrower
  than the space's.
- The brand row folds its Settings, Search and Hide buttons into one `⋯` when
  the sidebar is narrower than 236px, so a dragged-in sidebar no longer clips
  them. Above 160px it is the `⋯`; below that the rail takes over as before.

## 0.4.6 - 2026-11-18

- Panes can be renamed. A click on the name in a pane header turns it into
  an input: Enter saves, Escape cancels, and clicking away keeps what was
  typed. The name lives in shared state keyed by the terminal, so the pane
  header, the agent list and the float bar all read the same name and it
  survives a restart.
- Agent rows in the sidebar show that name too, and a right-click on a row
  opens the same input in place. Clearing the name restores the automatic
  one (the agent's title, else the program's name).

## 0.4.5 - 2026-11-17

- The spaces list redraws itself when its agents change. An agent that
  starts, ends, moves to another space or changes state had no trigger, so
  the list sat stale (five rows for six agents) until something else
  notified. A signature over the agents and the terminals now catches
  those, with the pane's space and the focus in it, so the rows follow
  along.
- A pane running an agent program that reports no status gets a row too.
  The programs the app can start as agents (the `run` entries in
  programs.json) are read when the window opens and again now and then, so
  an agent CLI added by hand shows up next to the built-in ones. Its mark
  is a plain dim dot: it is running, only its state is unknown.
- An agent is listed under the space its own pane is in, not under the
  one it was started in; a floated one keeps the space it was parked
  from. The focused agent's row is highlighted.

## 0.4.4 - 2026-11-16

- Spaces and agents are one list now. Each space's row is followed by its own
  agents: program icon (folds the sub-agent tree), name, machine when remote,
  and a state mark — spinner while working, red `!` when blocked, dot when
  done, ring when idle. The sidebar's separate Agents section is gone from
  the layout, and with it the priority/grouped sort menu.
- Indentation follows the space's own level: a main checkout's agents sit at
  32px, a worktree's at 46px (one level past its branch icon), sub-agents one
  step deeper again (50px / 64px). A worktree keeps its place after the main
  checkout's agents and carries its own agents one level deeper.
- Agents sort pinned-first, then urgent-first, most recent change breaking
  ties; `setAgentOrder` is called in the spaces' order so keyboard navigation
  keeps working. Agents of no listed space gather at the end under
  "Elsewhere". The collapsed rail shows spaces only.

## 0.4.3 - 2026-11-16

- The footer is gone. The Machines button now carries machine adding too:
  its dialog gains a "+ Add machine" entry in the heading that opens the
  machine-add dialog, and it re-reads the machine list every two seconds
  while open, so a machine added while it is open appears on its own.

## 0.4.2 - 2026-11-16

- Settings moved from the sidebar footer to the brand row: a gear button sits
  to the left of the search button and carries the update-ready dot. The new
  `along-chrome` mod forks the shipped `workspace-chrome`; the footer keeps
  only "Add machine".

## 0.4.1 - 2026-11-16

- The sidebar expand button now appears at the top of the collapsed rail,
  before the new-space button.

## 0.4.0 - 2026-11-13

- The float drop design is explicit rather than coordinate-based. Herdr's
  mod API does not expose a reliable dragged-overlay rectangle or all pane
  rectangles, so Along records the currently focused/last-clicked pane and
  uses explicit left/right/up/down controls. This avoids restoring beside a
  stale or guessed pane.

- Floating panes now use an explicit drop target: clicking a main-layout
  pane records it, and the float bar provides left, right, up and down
  buttons to return beside that target. The old source-neighbor behavior
  remains as a fallback. Herdr's current mod API does not expose a dragged
  window's screen rectangle, so the mod cannot infer the target from the
  float's visual position.

- Pane headers (now the along-pane fork of the shipped pane mod) gain a
  Float button: it parks the pane's terminal (it keeps running without a
  pane) and opens a draggable floating window that holds it, topped by the
  new along-float bar. "↙ send back" puts the terminal back into the
  layout — into the space and tab it was floated from, at its old spot:
  floating awaits `pane.go` probes in all four directions and records the
  neighbors; send back splits off the nearest surviving one in the recorded
  direction (left neighbor → split right of it, upper neighbor → split below
  it; with only a right or lower neighbor it splits mirrored and then
  `pane.swap`s back to the old side once the kept pane exists), or, when
  that tab is gone, a new tab in that space. Every step polls until the
  command has actually applied (commands land after `run` returns, so the
  old code read stale focus and always split right). The float takes the
  keyboard when it opens. "✕" closes
  the window and leaves the terminal parked. Floats remember where they
  were dropped and reopen with the layout.

- Float preparation recovers from stale shared pending markers and waits for
  the source tab's pane list to settle before choosing a return path.

## 0.3.0 - 2026-11-04

- The Machines button now sits in the top bar next to Files and Changes,
  instead of in each panel header.
- Disabled machines stay in the list across dialog opens, and toggling two
  machines at the same time no longer drops one of their saved profiles.
- Along now states its version in `VERSION` and records changes here.

# Changelog

Earlier builds did not carry a version number; this log starts at 0.3.0.

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

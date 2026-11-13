# Changelog

Earlier builds did not carry a version number; this log starts at 0.3.0.

## 0.4.0 - 2026-11-13

- Pane headers (now the along-pane fork of the shipped pane mod) gain a
  Float button: it parks the pane's terminal (it keeps running without a
  pane) and opens a draggable floating window that holds it, topped by the
  new along-float bar. "↙ send back" puts the terminal back into the
  layout; "✕" closes the window and leaves the terminal parked. Floats
  remember where they were dropped and reopen with the layout.

## 0.3.0 - 2026-11-04

- The Machines button now sits in the top bar next to Files and Changes,
  instead of in each panel header.
- Disabled machines stay in the list across dialog opens, and toggling two
  machines at the same time no longer drops one of their saved profiles.
- Along now states its version in `VERSION` and records changes here.

# Agent status for CLIs that don't report it

Herdr learns an agent's state (working, blocked, done, idle) from one place:
the program itself writes an **OSC 7501** escape sequence to its terminal.
`herdr-core` parses it, `agents()` and `terminals()` expose it as `status` and
`app`, and Along only draws it. A program that never reports gets a plain dim
dot in the sidebar and no spinner.

Some agent CLIs report it themselves (Pi, Codex, Claude Code). Others are
Claude-Code-compatible but stay silent, so this folder carries the hooks that
make them report.

| Folder | What it is |
| --- | --- |
| [`codebuddy/`](codebuddy/) | Hooks that report CodeBuddy Code's state to Herdr |

The protocol, for writing another one:

```
ESC ] 7501 ; state=working[:app=<name>][:kind=permission][:msg=<base64>] ST
```

`state` is one of `idle`, `working`, `done`, `blocked`, `error`, `clear`.
`app` names the program (letters, digits, `. + _ -`, at most 32) and shows in
the sidebar as the agent's own name. `clear` drops the status. No handshake is
needed: report whenever the state changes.

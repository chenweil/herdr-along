# CodeBuddy status for Herdr

CodeBuddy Code (Tencent's Claude-Code-compatible CLI) runs fine in Herdr, but
Along showed its agents with a plain dim dot and no spinner. Herdr takes an
agent's state from OSC 7501, and CodeBuddy never sends it. These hooks send it.

## Install

```
sh agents/codebuddy/install.sh
```

It copies `herdr-status.sh` to `~/.codebuddy/hooks/`, backs up
`~/.codebuddy/settings.json`, and merges `hooks.json` into it, replacing only
entries that reference `herdr-status.sh`. Then restart CodeBuddy in each pane:
it reads hooks when it starts and does not reload them.

Check it with `hc ls`: a live CodeBuddy terminal gains a `status` word, and
Along's row swaps the dim dot for a spinner, `!` or a dot as the state changes.

## What it reports

| Hook event | Reported | Why |
| --- | --- | --- |
| `SessionStart` | `idle` | an open prompt, nothing running |
| `UserPromptSubmit` | `working` | a turn just started |
| `PreToolUse`, `PostToolUse` | `working` | still mid-turn between tools |
| `PreCompact` | `working` | compaction is work too |
| `PermissionRequest` | `blocked` (`kind=permission`) | a dialog waits for the person |
| `Stop` | `done` | turn ended, Herdr turns this into `idle` once you look |
| `StopFailure` | `error` | the turn failed |
| `SessionEnd` | `clear` | drop the status and the row |

`Notification` is deliberately **not** hooked: CodeBuddy fires it when it is
merely waiting for input, which would turn an idle agent orange.

## How it works

`herdr-status.sh` writes one escape sequence to the pane's terminal:

```
ESC ] 7501 ; state=working:app=codebuddy ST
```

`app=codebuddy` also makes the agent's own name win over the detected program.
The script writes to `/dev/tty` and falls back to the parent process's tty
(`ps -o tty= -p $PPID`) when the hook ran without a controlling terminal.
Terminals that don't know OSC 7501 ignore it, so the hooks are harmless
outside Herdr.

The same shape works for any Claude-Code-compatible CLI: change `app=codebuddy`,
point the hooks at the script, and keep a script per program.

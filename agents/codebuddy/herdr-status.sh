#!/bin/sh
# 让 CodeBuddy 向 Herdr 上报 agent 运行状态(OSC 7501)。
# Herdr 只从 OSC 7501 读状态,CodeBuddy 自己不发,所以侧栏只剩一个暗点、没有转圈。
# 用法: herdr-status.sh <idle|working|done|blocked|error|clear> [kind]

state="$1"
kind="$2"

# hook 的 stdin 是 JSON;是管道就排空,是 tty 就别碰(会挂住)。
if [ ! -t 0 ]; then
  cat >/dev/null 2>&1 || true
fi

case "$state" in
  idle|working|done|blocked|error|clear) ;;
  *) exit 0 ;;
esac

payload="state=$state:app=codebuddy"
if [ "$state" = "blocked" ] && [ -n "$kind" ]; then
  payload="$payload:kind=$kind"
fi
seq=$(printf '\033]7501;%s\033\\' "$payload")

# 优先写自己的控制终端;被 setsid 断开了就退回父进程的 tty。
if ! printf '%s' "$seq" >/dev/tty 2>/dev/null; then
  parent_tty=$(ps -o tty= -p "$PPID" 2>/dev/null | tr -d ' ')
  if [ -n "$parent_tty" ] && [ "$parent_tty" != "?" ]; then
    printf '%s' "$seq" > "/dev/$parent_tty" 2>/dev/null || true
  fi
fi

exit 0

#!/bin/sh
# 给 CodeBuddy 和 MiniMax Code 装上各自的图标:两张 PNG 落到 my-icons/,
# 两条条目合进 programs.json。重复跑安全:只覆盖这两条,其它程序原样保留。
# 没有 my-icons/ 或 programs.json 的机器上也能直接跑(会新建)。
set -eu

here=$(cd "$(dirname "$0")" && pwd)
if [ -z "${HOME:-}" ]; then
  echo "HOME is not set" >&2
  exit 1
fi

home=${HERDR_APP_HOME:-$HOME/.config/herdr-app}
icons="$home/my-icons"
programs="$home/programs.json"

mkdir -p "$icons"
cp "$here/codebuddy.png" "$icons/codebuddy.png"
cp "$here/minimax-code.png" "$icons/minimax-code.png"

stamp=$(date +%Y%m%d-%H%M%S)
if [ -f "$programs" ]; then
  cp "$programs" "$programs.bak-along-$stamp"
fi

python3 - "$programs" <<'PY'
import json
import os
import sys

path = sys.argv[1]
data = {}
if os.path.exists(path):
    with open(path, encoding="utf-8") as handle:
        text = handle.read().strip()
    if text:
        data = json.loads(text)

programs = data.setdefault("programs", {})
programs["codebuddy"] = {
    "name": "CodeBuddy",
    "icon": "my-icons/codebuddy.png",
    "tint": False,
    "run": ["codebuddy"],
    "match": ["codebuddy-code"],
}
programs["mcode"] = {
    "name": "MiniMax Code",
    "icon": "my-icons/minimax-code.png",
    "tint": False,
    "run": ["mcode"],
    "match": ["mcode", "minimax-code"],
}

os.makedirs(os.path.dirname(path), exist_ok=True)
with open(path, "w", encoding="utf-8") as handle:
    handle.write(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
PY

echo "icons:    $icons/codebuddy.png, $icons/minimax-code.png"
echo "programs: $programs"
echo "Herdr applies programs.json live; no restart needed."

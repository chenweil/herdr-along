#!/bin/sh
# 安装 CodeBuddy 的状态上报:脚本落到 ~/.codebuddy/hooks/,hooks 合进 settings.json。
# 重复跑安全:只替换引用 herdr-status.sh 的条目,自己加的其它 hook 原样保留。
set -eu

here=$(cd "$(dirname "$0")" && pwd)
if [ -z "${HOME:-}" ]; then
  echo "HOME is not set" >&2
  exit 1
fi

buddy="$HOME/.codebuddy"
settings="$buddy/settings.json"

mkdir -p "$buddy/hooks"
cp "$here/herdr-status.sh" "$buddy/hooks/herdr-status.sh"
chmod +x "$buddy/hooks/herdr-status.sh"

stamp=$(date +%Y%m%d-%H%M%S)
if [ -f "$settings" ]; then
  cp "$settings" "$settings.bak-along-$stamp"
else
  printf '{}\n' > "$settings"
fi

python3 - "$settings" "$here/hooks.json" <<'PY'
import json
import sys

settings_path, hooks_path = sys.argv[1], sys.argv[2]
with open(settings_path, encoding="utf-8") as handle:
    settings = json.load(handle)
with open(hooks_path, encoding="utf-8") as handle:
    ours = json.load(handle)["hooks"]

merged = settings.get("hooks") or {}
for event, entries in ours.items():
    kept = [
        entry
        for entry in merged.get(event) or []
        if "herdr-status.sh" not in json.dumps(entry)
    ]
    merged[event] = kept + entries
settings["hooks"] = merged

with open(settings_path, "w", encoding="utf-8") as handle:
    handle.write(json.dumps(settings, indent=2, ensure_ascii=False) + "\n")
PY

echo "script:  $buddy/hooks/herdr-status.sh"
echo "settings: $settings (backup: $settings.bak-along-$stamp)"
echo "Now restart CodeBuddy in each pane: it reads hooks at start."

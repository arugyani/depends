#!/usr/bin/env bash
# Install the Depends plugin into one of your local Obsidian vaults.
#
# Usage:
#   scripts/install.sh vaults              List all known vaults.
#   scripts/install.sh vaults verbose      Interactive picker, then install.
#   scripts/install.sh install <name|path> Install directly to a vault.
#
# Vault list is read from Obsidian's own registry (obsidian.json).

set -euo pipefail

PLUGIN_ID="depends"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

case "$(uname)" in
  Darwin) OBS_JSON="$HOME/Library/Application Support/obsidian/obsidian.json" ;;
  Linux)  OBS_JSON="${XDG_CONFIG_HOME:-$HOME/.config}/obsidian/obsidian.json" ;;
  *)      echo "unsupported platform: $(uname)" >&2; exit 1 ;;
esac

if [[ ! -f "$OBS_JSON" ]]; then
  echo "obsidian.json not found at: $OBS_JSON" >&2
  echo "is Obsidian installed and has it been opened at least once?" >&2
  exit 1
fi

# Print "name<TAB>path" for each vault, sorted by most-recently-used (descending).
list_vaults() {
  python3 - "$OBS_JSON" <<'PY'
import json, os, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
vaults = data.get("vaults", {})
rows = []
for _id, info in vaults.items():
    p = info.get("path", "")
    if not p:
        continue
    rows.append((info.get("ts", 0), os.path.basename(p.rstrip("/")) or p, p))
rows.sort(key=lambda r: r[0], reverse=True)
for _ts, name, path in rows:
    print(f"{name}\t{path}")
PY
}

build_if_needed() {
  local main_js="$ROOT/main.js"
  if [[ ! -f "$main_js" ]] || \
     [[ "$ROOT/src/main.ts" -nt "$main_js" ]] || \
     [[ "$ROOT/manifest.json" -nt "$main_js" ]]; then
    echo "==> building plugin"
    (cd "$ROOT" && npm run build)
  fi
}

install_to_path() {
  local vault_path="$1"
  if [[ ! -d "$vault_path" ]]; then
    echo "vault path does not exist: $vault_path" >&2; exit 1
  fi
  local dest="$vault_path/.obsidian/plugins/$PLUGIN_ID"
  mkdir -p "$dest"
  cp "$ROOT/main.js" "$dest/main.js"
  cp "$ROOT/manifest.json" "$dest/manifest.json"
  [[ -f "$ROOT/versions.json" ]] && cp "$ROOT/versions.json" "$dest/versions.json"
  echo "==> installed to $dest"
  echo "    enable it in Obsidian under Settings -> Community plugins."
}

resolve_by_name() {
  local name="$1"
  list_vaults | awk -F'\t' -v n="$name" '$1 == n { print $2; exit }'
}

interactive_pick() {
  local lines=()
  while IFS= read -r line; do lines+=("$line"); done < <(list_vaults)
  if [[ "${#lines[@]}" -eq 0 ]]; then
    echo "no vaults registered" >&2; exit 1
  fi
  echo "Vaults (most recent first):" >&2
  local i
  for i in "${!lines[@]}"; do
    local name="${lines[$i]%%$'\t'*}"
    local path="${lines[$i]#*$'\t'}"
    printf "  %2d) %s  (%s)\n" "$((i+1))" "$name" "$path" >&2
  done
  printf "Select vault [1-%d]: " "${#lines[@]}" >&2
  local choice
  read -r choice
  if ! [[ "$choice" =~ ^[0-9]+$ ]] || (( choice < 1 || choice > ${#lines[@]} )); then
    echo "invalid selection" >&2; exit 1
  fi
  echo "${lines[$((choice-1))]#*$'\t'}"
}

cmd="${1:-vaults}"; shift || true

case "$cmd" in
  vaults)
    sub="${1:-}"
    if [[ "$sub" == "verbose" || "$sub" == "--verbose" || "$sub" == "-v" ]]; then
      vault_path="$(interactive_pick)"
      build_if_needed
      install_to_path "$vault_path"
    else
      list_vaults | awk -F'\t' '{ printf "%-30s  %s\n", $1, $2 }'
    fi
    ;;
  install)
    target="${1:-}"
    if [[ -z "$target" ]]; then
      vault_path="$(interactive_pick)"
    elif [[ -d "$target" && -d "$target/.obsidian" || -d "$target" && "$target" == */* ]]; then
      vault_path="$target"
    else
      vault_path="$(resolve_by_name "$target")"
      if [[ -z "$vault_path" ]]; then
        echo "no vault named '$target'. try: $0 vaults" >&2; exit 1
      fi
    fi
    build_if_needed
    install_to_path "$vault_path"
    ;;
  -h|--help|help)
    sed -n '2,9p' "$0"
    ;;
  *)
    echo "unknown command: $cmd" >&2
    sed -n '2,9p' "$0" >&2
    exit 1
    ;;
esac

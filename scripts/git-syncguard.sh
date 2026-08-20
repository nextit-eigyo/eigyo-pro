#!/usr/bin/env bash
# EIGYO PRO 多PC安全ガード (PreToolUse: Edit|Write|MultiEdit|Bash)
# 「index.html の編集」または「git commit / git push」の直前に、
# ローカル main が origin/main より遅れていたらブロックし、先に git pull --ff-only を促す。
# → 他PCの作業を巻き戻す事故を防止。対象以外(メモリ/scratchpad等)は一切止めない。
# 失敗・不明・オフライン時は ALLOW(フェイルオープン)。behind 確定時のみ deny。
input=$(cat 2>/dev/null || true)

# 対象判定: file_path が index.html、または command が git commit/push を含む時だけガード
fp=$(printf '%s' "$input" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
cmd=$(printf '%s' "$input" | sed -n 's/.*"command"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -1)
guard=0
case "$fp"  in *index.html*) guard=1;; esac
case "$cmd" in *"git commit"*|*"git push"*) guard=1;; esac
[ "$guard" = 0 ] && exit 0

# プロジェクトディレクトリへ移動(バックスラッシュ形式にも対応・失敗時は現cwd)
DIR="${CLAUDE_PROJECT_DIR:-}"
if [ -n "$DIR" ] && ! cd "$DIR" 2>/dev/null; then
  cd "$(printf '%s' "$DIR" | sed 's#\\#/#g')" 2>/dev/null || true
fi
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0

# fetch はネットワーク負荷を避けるため 90秒に1回まで
stamp="${TMPDIR:-${TMP:-/tmp}}/eigyo_syncguard_stamp"
now=$(date +%s 2>/dev/null || echo 0)
last=0; [ -f "$stamp" ] && last=$(cat "$stamp" 2>/dev/null || echo 0)
case "$now" in ''|*[!0-9]*) now=0;; esac
case "$last" in ''|*[!0-9]*) last=0;; esac
if [ "$now" = 0 ] || [ "$((now - last))" -ge 90 ]; then
  git fetch -q origin main 2>/dev/null || true
  [ "$now" != 0 ] && echo "$now" > "$stamp" 2>/dev/null || true
fi

behind=$(git rev-list --count main..origin/main 2>/dev/null || echo 0)
case "$behind" in ''|*[!0-9]*) behind=0;; esac
if [ "$behind" -gt 0 ]; then
  printf '{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"⚠️ ローカル main が origin/main より %s コミット遅れています。他PCの作業を巻き戻さないよう、まず `git pull --ff-only origin main` で最新化してから続けてください（EIGYO PRO 多PC安全ガード）。"}}\n' "$behind"
fi
exit 0

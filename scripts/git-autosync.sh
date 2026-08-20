#!/usr/bin/env bash
# EIGYO PRO 多PC安全同期 (SessionStart)
# セッション開始時に origin/main を取得し、ff-only で安全に最新化する。
# ・遅れていて fast-forward 可能かつクリーン → 自動 pull(破壊なし)
# ・分岐 or 未コミット変更で ff 不可 → 取り込まず警告のみ(手動対応を促す)
DIR="${CLAUDE_PROJECT_DIR:-}"
if [ -n "$DIR" ] && ! cd "$DIR" 2>/dev/null; then
  cd "$(printf '%s' "$DIR" | sed 's#\\#/#g')" 2>/dev/null || true
fi
git rev-parse --is-inside-work-tree >/dev/null 2>&1 || exit 0
git fetch -q origin main 2>/dev/null || exit 0

behind=$(git rev-list --count main..origin/main 2>/dev/null || echo 0)
ahead=$(git rev-list --count origin/main..main 2>/dev/null || echo 0)
case "$behind" in ''|*[!0-9]*) behind=0;; esac
case "$ahead" in ''|*[!0-9]*) ahead=0;; esac
[ "$behind" -eq 0 ] && exit 0

if [ "$ahead" -eq 0 ]; then
  if git pull --ff-only origin main >/dev/null 2>&1; then
    printf '{"systemMessage":"🔄 EIGYO PRO: 他PCの更新 %s 件を自動取得しました (git pull --ff-only)。最新版で作業できます。"}\n' "$behind"
  else
    printf '{"systemMessage":"⚠️ EIGYO PRO: 他PCの更新 %s 件がありますが自動取得できませんでした(未コミット変更等)。編集前に手動で `git pull --ff-only origin main` を実行してください。"}\n' "$behind"
  fi
else
  printf '{"systemMessage":"⚠️ EIGYO PRO: ローカルと origin が分岐しています (遅れ=%s / 先行=%s)。編集前に手動で統合してください(git pull --rebase 等)。"}\n' "$behind" "$ahead"
fi
exit 0

#!/usr/bin/env bash
# 启动控制台。首次启动会建库并造演示数据；已有实例时不会重复启动。
#   ./start.sh           默认 8787，数据库已存在则直接启动
#   ./start.sh 9000      指定端口
#   ./start.sh --reset   重建数据库与演示数据（会停掉已有实例）
set -e
cd "$(dirname "$0")"
PORT=8787; RESET=0
for a in "$@"; do
  case "$a" in
    --reset) RESET=1 ;;
    [0-9]*) PORT="$a" ;;
  esac
done

RUNNING="$(lsof -ti tcp:"$PORT" 2>/dev/null | tr "\n" " " | sed "s/ *$//" || true)"
if [ -n "$RUNNING" ]; then
  if [ "$RESET" = "1" ]; then
    echo "停止已有实例, pid: $RUNNING"; kill $RUNNING; sleep 1
  else
    echo "已有服务在 $PORT 运行, pid: $RUNNING"
    echo "控制台： http://127.0.0.1:$PORT"
    echo "如需重建演示数据：./start.sh --reset"
    exit 0
  fi
fi

EMPTY=0
if [ -f data.db ]; then
  EMPTY="$(python3 -c "
import sqlite3
try:
    c = sqlite3.connect('data.db')
    n = c.execute('SELECT COUNT(*) FROM intersection').fetchone()[0]
    print(0 if n else 1)
except Exception:
    print(1)
" 2>/dev/null || echo 1)"
  [ "$EMPTY" = "1" ] && echo "检测到数据库为空（可能刚被测试或脚本重置），正在重建演示数据…"
fi

if [ "$RESET" = "1" ] || [ ! -f data.db ] || [ "$EMPTY" = "1" ]; then
  echo "初始化数据库与演示数据…"
  python3 main.py demo >/dev/null
  python3 - <<'PY'
from v2xplat import config_plane as cp
s = cp.build("ops.demo"); cp.push("ops.demo", s["id"])
print("已生成一份待确认快照，可在“发布与灰度”页演示确认与回滚")
PY
fi

echo "控制台： http://127.0.0.1:$PORT"
( sleep 1; command -v open >/dev/null && open "http://127.0.0.1:$PORT" ) &
exec python3 main.py serve "$PORT"

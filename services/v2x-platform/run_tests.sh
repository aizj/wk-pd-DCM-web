#!/bin/bash
# 跑测试：用独立的库文件，避免清掉正在运行的服务所用的 data.db。
cd "$(dirname "$0")"
export V2X_DB="$(mktemp -t v2xtest).db"
trap 'rm -f "$V2X_DB"*' EXIT
python3 -m unittest discover -s tests "$@" 2>&1 | grep -v "^seeded"

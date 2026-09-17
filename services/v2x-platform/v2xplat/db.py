"""SQLite 访问层：零依赖，连接按线程隔离。"""
import sqlite3, os, threading, json, hashlib, time
from datetime import datetime, timezone

_local = threading.local()
DB_PATH = os.environ.get("V2X_DB", os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data.db"))
SCHEMA = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds")


def conn() -> sqlite3.Connection:
    c = getattr(_local, "c", None)
    if c is None:
        c = sqlite3.connect(DB_PATH, timeout=10)
        c.row_factory = sqlite3.Row
        c.execute("PRAGMA foreign_keys=ON")
        c.execute("PRAGMA busy_timeout=10000")
        try:                      # WAL 提升并发；只读挂载等场景失败时退回默认日志模式
            c.execute("PRAGMA journal_mode=WAL")
        except sqlite3.OperationalError:
            pass
        _local.c = c
    return c


def init(reset: bool = False) -> None:
    """建表（幂等）。reset=True 会删库重建，仅用于演示与测试。

    注意：reset 会删除正在被其它进程使用的库文件，启动前请先停掉已有服务。
    """
    if reset:
        close()
        for suffix in ("", "-wal", "-shm"):
            p = DB_PATH + suffix
            if os.path.exists(p):
                os.remove(p)
    with open(SCHEMA, encoding="utf-8") as f:
        script = f.read()
    for attempt in range(3):
        try:
            conn().executescript(script)
            conn().commit()
            return
        except sqlite3.OperationalError as e:
            close()
            if attempt == 2:
                raise sqlite3.OperationalError(
                    f"{e}；若已有服务实例在运行，请先停掉（lsof -ti tcp:8787 | xargs kill）") from e
            time.sleep(0.4)


def close() -> None:
    c = getattr(_local, "c", None)
    if c is not None:
        c.close()
        _local.c = None


def q(sql: str, *args) -> list:
    return [dict(r) for r in conn().execute(sql, args).fetchall()]


def q1(sql: str, *args):
    rows = q(sql, *args)
    return rows[0] if rows else None


def x(sql: str, *args) -> None:
    conn().execute(sql, args)
    conn().commit()


def audit(actor: str, action: str, obj: str, detail: dict) -> str:
    """写一条审计，哈希链接上一条（AU-1.2）。"""
    prev = q1("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1")
    prev_hash = prev["hash"] if prev else "0" * 64
    ts = now()
    payload = json.dumps(detail, ensure_ascii=False, sort_keys=True)
    h = hashlib.sha256(f"{prev_hash}|{ts}|{actor}|{action}|{obj}|{payload}".encode()).hexdigest()
    x("INSERT INTO audit_log (ts,actor,action,obj,detail,prev_hash,hash) VALUES (?,?,?,?,?,?,?)",
      ts, actor, action, obj, payload, prev_hash, h)
    return h


def audit_verify() -> bool:
    """重算整条链，任何一条被改过都会被发现。"""
    prev_hash = "0" * 64
    for r in q("SELECT * FROM audit_log ORDER BY seq"):
        h = hashlib.sha256(f"{prev_hash}|{r['ts']}|{r['actor']}|{r['action']}|{r['obj']}|{r['detail']}".encode()).hexdigest()
        if h != r["hash"] or r["prev_hash"] != prev_hash:
            return False
        prev_hash = h
    return True

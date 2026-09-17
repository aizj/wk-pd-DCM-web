"""AU-4 留存与销毁：策略、到期清理、销毁证明。"""
import uuid
from datetime import datetime, timedelta, timezone
from . import db

POLICIES = [
    ("audit_log", 180, "《网络安全法》第二十一条：网络日志不少于六个月"),
    ("receipt_agg", 365, "与发布记录一致，用于对账与争议处置"),
    ("snapshot", 365, "配置追溯与事故调取"),
    ("receipt_anomaly", 365, "异常回传证据"),
]
TABLE_TS = {"audit_log": "ts", "receipt_agg": "hour", "snapshot": "created_at", "receipt_anomaly": "ts"}


def seed() -> None:
    for c, d, b in POLICIES:
        db.x("INSERT OR IGNORE INTO retention_policy (category,days,basis) VALUES (?,?,?)", c, d, b)


def policies() -> list:
    seed()
    rows = db.q("SELECT * FROM retention_policy ORDER BY category")
    for r in rows:
        ts = TABLE_TS[r["category"]]
        cut = (datetime.now(timezone.utc) - timedelta(days=r["days"])).isoformat()
        r["rows_total"] = db.q1(f"SELECT COUNT(*) c FROM {r['category']}")["c"]
        r["rows_expired"] = db.q1(f"SELECT COUNT(*) c FROM {r['category']} WHERE {ts} < ?", cut)["c"]
    return rows


def set_policy(actor: str, category: str, days: int) -> dict:
    cur = db.q1("SELECT * FROM retention_policy WHERE category=?", category)
    if not cur:
        raise KeyError(category)
    if category == "audit_log" and days < 180:
        raise ValueError("审计日志留存不得少于 180 天（《网络安全法》第二十一条）")
    db.x("UPDATE retention_policy SET days=? WHERE category=?", days, category)
    db.audit(actor, "RETENTION_SET", category, {"from": cur["days"], "to": days})
    return db.q1("SELECT * FROM retention_policy WHERE category=?", category)


def purge(actor: str, category: str) -> dict:
    """到期清理并出具销毁证明（AU-4.2、AU-4.3）。审计日志本身只清理超期部分。"""
    seed()
    p = db.q1("SELECT * FROM retention_policy WHERE category=?", category)
    if not p:
        raise KeyError(category)
    ts = TABLE_TS[category]
    cut = (datetime.now(timezone.utc) - timedelta(days=p["days"])).isoformat()
    n = db.q1(f"SELECT COUNT(*) c FROM {category} WHERE {ts} < ?", cut)["c"]
    db.x(f"DELETE FROM {category} WHERE {ts} < ?", cut)
    cert = "CERT-" + uuid.uuid4().hex[:8].upper()
    db.x("INSERT INTO purge_log (id,category,rows_removed,cert_no,ts,operator) VALUES (?,?,?,?,?,?)",
         "PG-" + uuid.uuid4().hex[:6].upper(), category, n, cert, db.now(), actor)
    db.audit(actor, "RETENTION_PURGE", category, {"rows": n, "cert": cert, "cutoff": cut[:10]})
    return {"category": category, "removed": n, "cert_no": cert, "cutoff": cut[:10]}


def certificates() -> list:
    return db.q("SELECT * FROM purge_log ORDER BY ts DESC")

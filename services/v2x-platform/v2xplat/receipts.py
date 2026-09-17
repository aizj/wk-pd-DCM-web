"""EV-1 回执接收与统计：聚合、抽样、异常即时回传。

口径沿用总体方案 15.7：
  有效送达率 = 车端校验通过数 / 合格数；显示率 = 实际显示数 / 校验通过数；
  无法核验率 = 缺少最终状态的比例，不得计为成功。
禁止字段（VIN、车牌、账号、位置轨迹）整批拒收。
"""
from . import db

FORBIDDEN = {"vin", "plate", "account", "phone", "imei", "lat", "lon", "trace", "track"}
STATUSES = ["VALIDATED", "PRESENTED", "SUPPRESSED", "UNVERIFIABLE"]


class Rejected(ValueError):
    pass


def ingest(actor: str, sub_id: str, hour: str, rows: list) -> dict:
    """rows: [{intersection_id, status, reason_code, cnt}]，按小时聚合。"""
    for r in rows:
        bad = FORBIDDEN & {k.lower() for k in r.keys()}
        if bad:
            db.audit(actor, "RECEIPT_REJECT", sub_id, {"reason": "含禁止字段", "fields": sorted(bad)})
            raise Rejected(f"回执含禁止字段 {sorted(bad)}，整批拒收（位置最小化）")
        if r["status"] not in STATUSES:
            raise Rejected(f"未知回执状态 {r['status']}")
    for r in rows:
        db.x("INSERT INTO receipt_agg (sub_id,hour,intersection_id,status,reason_code,cnt)"
             " VALUES (?,?,?,?,?,?) ON CONFLICT(sub_id,hour,intersection_id,status,reason_code)"
             " DO UPDATE SET cnt=cnt+excluded.cnt",
             sub_id, hour, r["intersection_id"], r["status"], r.get("reason_code"), int(r["cnt"]))
    db.audit(actor, "RECEIPT_INGEST", sub_id, {"hour": hour, "rows": len(rows)})
    return stats(sub_id)


def anomaly(actor: str, sub_id: str, kind: str, detail: str) -> dict:
    """异常即时回传：疑似 D1、验签失败、视觉冲突、撤销后仍显示。自动建工单草稿。"""
    db.x("INSERT INTO receipt_anomaly (sub_id,kind,detail,ts) VALUES (?,?,?,?)", sub_id, kind, detail, db.now())
    db.audit(actor, "RECEIPT_ANOMALY", sub_id, {"kind": kind, "detail": detail})
    from . import ops_center
    t = ops_center.create_ticket("system", "ANOMALY", f"回执异常：{kind}", "平台数据运营",
                                 priority="D1" if kind == "SUSPECT_D1" else "D2", sub_id=sub_id)
    return {"anomaly": kind, "ticket": t["id"]}


def stats(sub_id: str = None) -> dict:
    where, args = ("WHERE sub_id=?", (sub_id,)) if sub_id else ("", ())
    rows = db.q(f"SELECT status, reason_code, SUM(cnt) c FROM receipt_agg {where} GROUP BY status, reason_code", *args)
    by_status, by_reason = {}, {}
    for r in rows:
        by_status[r["status"]] = by_status.get(r["status"], 0) + r["c"]
        if r["reason_code"]:
            by_reason[r["reason_code"]] = by_reason.get(r["reason_code"], 0) + r["c"]
    qualified = sum(by_status.values())
    validated = by_status.get("VALIDATED", 0) + by_status.get("PRESENTED", 0)
    presented = by_status.get("PRESENTED", 0)
    pct = lambda a, b: round(100.0 * a / b, 1) if b else 0.0
    return {"qualified": qualified, "validated": validated, "presented": presented,
            "delivery_rate": pct(validated, qualified), "display_rate": pct(presented, validated),
            "unverifiable_rate": pct(by_status.get("UNVERIFIABLE", 0), qualified),
            "by_status": by_status, "by_reason": by_reason,
            "anomalies": db.q("SELECT * FROM receipt_anomaly ORDER BY ts DESC LIMIT 20")}

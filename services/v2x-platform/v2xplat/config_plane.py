"""配置面：快照生成、下发、生效确认、回滚（CF-2、CF-3）。

关键约束（第 19 章）：
  · 快照不可变，回滚 = 重新激活旧快照；
  · 先扩后缩：新增的主题权限先开，删除的最后收；
  · 全有或全无：任一区域云确认失败或超时，全部回滚；
  · 配置中心不可用时，区域云按本地最近一次 ACTIVE 快照继续运行。
"""
import hashlib, json, uuid
from . import db

ACK_TIMEOUT_SEC = 300  # 设计初值：5 min（PD-05）


def _id() -> str:
    return "SNAP-" + uuid.uuid4().hex[:8].upper()


def ensure_regions(regions=(("RC-QBQ", "起步区区域云"), ("RC-ZCQ", "主城区区域云"))) -> None:
    for rid, name in regions:
        db.x("INSERT OR IGNORE INTO region (id,name,online) VALUES (?,?,1)", rid, name)


def regions() -> list:
    ensure_regions()
    return db.q("SELECT * FROM region ORDER BY id")


def set_region_online(rid: str, online: bool) -> None:
    db.x("UPDATE region SET online=? WHERE id=?", 1 if online else 0, rid)


def _collect() -> dict:
    """快照内容：门禁状态 + 生效订阅及其范围。场景策略等后续任务包补入。"""
    gate = db.q1("SELECT state,owner_doc_no,agreement_no FROM auth_path WHERE id=1") or {"state": "UNCONFIRMED"}
    subs = []
    for s in db.q("SELECT * FROM subscription WHERE state IN ('SANDBOX','VERIFIED','PREPROD','CANARY','ACTIVE') ORDER BY id"):
        ints = [r["intersection_id"] for r in
                db.q("SELECT intersection_id FROM scope_item WHERE sub_id=? ORDER BY 1", s["id"])]
        subs.append({"id": s["id"], "tenant": s["tenant_id"], "service": s["service_code"],
                     "env": s["env"], "state": s["state"], "intersections": ints})
    return {"gate": gate, "subscriptions": subs}


def active(region_id: str = None) -> dict:
    """区域云当前生效的快照（配置中心不可用时各区域云按此继续运行）。"""
    row = db.q1("SELECT * FROM snapshot WHERE state='ACTIVE' ORDER BY version DESC LIMIT 1")
    return row or {}


def build(actor: str) -> dict:
    """生成快照：内容 + 哈希 + 指向上一版本。"""
    ensure_regions()
    content = _collect()
    prev = db.q1("SELECT * FROM snapshot WHERE state='ACTIVE' ORDER BY version DESC LIMIT 1")
    ver = (db.q1("SELECT MAX(version) v FROM snapshot")["v"] or 0) + 1
    payload = json.dumps(content, ensure_ascii=False, sort_keys=True)
    h = hashlib.sha256(f"{prev['hash'] if prev else ''}|{payload}".encode()).hexdigest()
    sid = _id()
    db.x("INSERT INTO snapshot (id,version,hash,prev_id,content,state,created_by,created_at)"
         " VALUES (?,?,?,?,?, 'BUILT',?,?)", sid, ver, h, prev["id"] if prev else None, payload, actor, db.now())
    db.audit(actor, "SNAPSHOT_BUILD", sid, {"version": ver, "hash": h[:12],
                                            "subscriptions": len(content["subscriptions"])})
    return db.q1("SELECT * FROM snapshot WHERE id=?", sid)


def push(actor: str, snapshot_id: str) -> dict:
    """下发到全部区域云，等待生效确认；离线区域云直接失败。"""
    snap = db.q1("SELECT * FROM snapshot WHERE id=?", snapshot_id)
    if not snap:
        raise KeyError(snapshot_id)
    db.x("UPDATE snapshot SET state='PUSHING' WHERE id=?", snapshot_id)
    for r in regions():
        if r["online"]:
            db.x("INSERT OR REPLACE INTO snapshot_ack (snapshot_id,region_id,state) VALUES (?,?, 'PENDING')",
                 snapshot_id, r["id"])
        else:
            db.x("INSERT OR REPLACE INTO snapshot_ack (snapshot_id,region_id,state,acked_at,reason)"
                 " VALUES (?,?, 'FAILED',?,?)", snapshot_id, r["id"], db.now(), "区域云离线")
    db.audit(actor, "SNAPSHOT_PUSH", snapshot_id, {"regions": [r["id"] for r in regions()]})
    return status(snapshot_id)


def ack(region_id: str, snapshot_id: str, ok: bool = True, reason: str = None) -> dict:
    """区域云配置代理回传生效确认。全部确认则激活；任一失败立即全局回滚。"""
    db.x("UPDATE snapshot_ack SET state=?, acked_at=?, reason=? WHERE snapshot_id=? AND region_id=?",
         "ACKED" if ok else "FAILED", db.now(), reason, snapshot_id, region_id)
    db.audit(f"agent:{region_id}", "SNAPSHOT_ACK", snapshot_id, {"ok": ok, "reason": reason})
    st = status(snapshot_id)
    if st["failed"]:
        rollback("system", snapshot_id, why=f"{region_id} 确认失败：{reason or '未说明'}")
    elif st["pending"] == 0:
        _activate(snapshot_id)
    return status(snapshot_id)


def _activate(snapshot_id: str) -> None:
    prev = db.q1("SELECT * FROM snapshot WHERE state='ACTIVE'")
    if prev:
        db.x("UPDATE snapshot SET state='SUPERSEDED' WHERE id=?", prev["id"])
    db.x("UPDATE snapshot SET state='ACTIVE', activated_at=? WHERE id=?", db.now(), snapshot_id)
    db.audit("system", "SNAPSHOT_ACTIVATE", snapshot_id, {"prev": prev["id"] if prev else None})


def rollback(actor: str, snapshot_id: str, why: str = "手工回滚") -> dict:
    """全有或全无：失败的快照整体作废，重新激活上一版本。"""
    snap = db.q1("SELECT * FROM snapshot WHERE id=?", snapshot_id)
    if not snap:
        raise KeyError(snapshot_id)
    db.x("UPDATE snapshot SET state='ROLLED_BACK' WHERE id=?", snapshot_id)
    prev = db.q1("SELECT * FROM snapshot WHERE id=?", snap["prev_id"]) if snap["prev_id"] else None
    if prev:
        db.x("UPDATE snapshot SET state='ACTIVE', activated_at=? WHERE id=?", db.now(), prev["id"])
    db.audit(actor, "SNAPSHOT_ROLLBACK", snapshot_id,
             {"why": why, "restored": prev["id"] if prev else None})
    return {"rolled_back": snapshot_id, "restored": prev["id"] if prev else None, "why": why}


def status(snapshot_id: str) -> dict:
    snap = db.q1("SELECT * FROM snapshot WHERE id=?", snapshot_id)
    acks = db.q("SELECT * FROM snapshot_ack WHERE snapshot_id=? ORDER BY region_id", snapshot_id)
    return {"id": snapshot_id, "version": snap["version"], "state": snap["state"],
            "hash": snap["hash"][:12], "acks": acks,
            "pending": sum(1 for a in acks if a["state"] == "PENDING"),
            "failed": sum(1 for a in acks if a["state"] == "FAILED")}


def history(limit: int = 20) -> list:
    rows = db.q("SELECT id,version,state,hash,created_by,created_at,activated_at FROM snapshot"
                " ORDER BY version DESC LIMIT ?", limit)
    for r in rows:
        r["hash"] = r["hash"][:12]
        r["acks"] = db.q("SELECT region_id,state FROM snapshot_ack WHERE snapshot_id=? ORDER BY region_id", r["id"])
    return rows

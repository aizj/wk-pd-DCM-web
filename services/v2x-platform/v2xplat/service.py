"""业务服务层：授权、门禁、订阅生命周期。对应 GR-1、GR-2、SB-1、SB-3。"""
import uuid
from typing import List
from . import db, rules

STATES = ["DRAFT", "SUBMITTED", "REVIEW", "REJECTED", "SANDBOX", "VERIFIED",
          "PREPROD", "CANARY", "ACTIVE", "SUSPENDED", "TERMINATED"]
ENV_OF_STATE = {"SANDBOX": "sandbox", "VERIFIED": "sandbox", "PREPROD": "preprod",
                "CANARY": "prod", "ACTIVE": "prod"}


class Denied(Exception):
    def __init__(self, findings):
        self.findings = findings
        super().__init__("blocked by rules")


def _id(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"


# ---------- 授权（GR-1） ----------
def create_grant(actor: str, doc_no: str, grantor: str, purpose: str, data_items: str,
                 valid_from: str, valid_to: str, intersections: List[str]) -> str:
    gid = _id("GRANT")
    db.x("INSERT INTO grant_obj (id,doc_no,grantor,purpose,data_items,valid_from,valid_to,version,created_at)"
         " VALUES (?,?,?,?,?,?,?,1,?)", gid, doc_no, grantor, purpose, data_items, valid_from, valid_to, db.now())
    set_whitelist(actor, gid, intersections, bump=False)
    db.audit(actor, "GRANT_CREATE", gid, {"doc_no": doc_no, "intersections": len(intersections)})
    return gid


def set_whitelist(actor: str, grant_id: str, intersections: List[str], bump: bool = True) -> dict:
    """白名单只增版本，不覆盖历史（GR-1.2）。返回与上一版本的差异。"""
    g = db.q1("SELECT * FROM grant_obj WHERE id=?", grant_id)
    if not g:
        raise KeyError(grant_id)
    old_v = g["version"]
    old = {r["intersection_id"] for r in db.q(
        "SELECT intersection_id FROM grant_scope WHERE grant_id=? AND version=?", grant_id, old_v)}
    new_v = old_v + 1 if bump else old_v
    unknown = [i for i in intersections
               if not db.q1("SELECT 1 FROM intersection WHERE id=?", i)]
    if unknown:
        raise ValueError(f"主数据中不存在的路口: {unknown[:10]}")
    for i in intersections:
        db.x("INSERT OR IGNORE INTO grant_scope (grant_id,version,intersection_id) VALUES (?,?,?)",
             grant_id, new_v, i)
    if bump:
        db.x("UPDATE grant_obj SET version=? WHERE id=?", new_v, grant_id)
    diff = {"added": sorted(set(intersections) - old), "removed": sorted(old - set(intersections)),
            "version": new_v}
    db.audit(actor, "GRANT_WHITELIST", grant_id, diff)
    return diff


def shrink_impact(grant_id: str, keep: List[str]) -> dict:
    """授权收缩影响分析（GR-1.4）：哪些订阅、多少路口会掉。"""
    removed = [r["intersection_id"] for r in db.q(
        "SELECT intersection_id FROM grant_scope WHERE grant_id=? AND version="
        "(SELECT version FROM grant_obj WHERE id=?)", grant_id, grant_id)
        if r["intersection_id"] not in set(keep)]
    affected = db.q(
        "SELECT s.id, s.tenant_id, COUNT(*) AS n FROM subscription s JOIN scope_item i ON i.sub_id=s.id"
        " WHERE s.grant_id=? AND i.intersection_id IN (%s) GROUP BY s.id" % ",".join("?" * len(removed)),
        grant_id, *removed) if removed else []
    return {"removed": removed, "affected_subscriptions": affected}


# ---------- 门禁（GR-2 / R-00） ----------
def get_gate() -> dict:
    return db.q1("SELECT * FROM auth_path WHERE id=1") or {
        "state": "UNCONFIRMED", "owner_doc_no": None, "partner": None,
        "agreement_no": None, "agreement_valid_to": None, "updated_at": None}


def set_gate(actor: str, reviewer: str, state: str, owner_doc_no: str = None,
             partner: str = None, agreement_no: str = None, agreement_valid_to: str = None) -> dict:
    if actor == reviewer:
        raise ValueError("门禁状态需双人复核，录入人与复核人不得相同（AU-3.1）")
    db.x("INSERT INTO auth_path (id,state,owner_doc_no,partner,agreement_no,agreement_valid_to,"
         "updated_by,reviewed_by,updated_at) VALUES (1,?,?,?,?,?,?,?,?)"
         " ON CONFLICT(id) DO UPDATE SET state=excluded.state,owner_doc_no=excluded.owner_doc_no,"
         "partner=excluded.partner,agreement_no=excluded.agreement_no,"
         "agreement_valid_to=excluded.agreement_valid_to,updated_by=excluded.updated_by,"
         "reviewed_by=excluded.reviewed_by,updated_at=excluded.updated_at",
         state, owner_doc_no, partner, agreement_no, agreement_valid_to, actor, reviewer, db.now())
    db.audit(actor, "GATE_SET", "auth_path", {"state": state, "doc_no": owner_doc_no,
                                              "partner": partner, "reviewed_by": reviewer})
    return get_gate()


def gate_checklist(tenant_id: str) -> dict:
    """门禁清单：卡在哪一项、谁负责（GR-2.4）。"""
    g = get_gate()
    t = db.q1("SELECT * FROM tenant WHERE id=?", tenant_id)
    items = [
        {"item": "授权路径已确认", "ok": g["state"] in ("OPERATOR_AUTHORIZED", "PARTNER_AUTHORIZED"),
         "owner": "业主会同市大数据局", "detail": g["state"]},
        {"item": "授权运营协议已登记", "ok": g["state"] != "PARTNER_AUTHORIZED" or bool(g.get("agreement_no")),
         "owner": "平台商务", "detail": g.get("agreement_no") or "—"},
        {"item": "租户资质有效", "ok": bool(t) and t["status"] == "ACTIVE",
         "owner": "平台运营", "detail": t["status"] if t else "未入驻"},
    ]
    return {"passed": all(i["ok"] for i in items), "items": items}


# ---------- 订阅（SB-1、SB-3） ----------
def create_subscription(actor: str, tenant_id: str, service_code: str, grant_id: str,
                        intersections: List[str], valid_until: str = None) -> dict:
    sid = _id("SUB")
    db.x("INSERT INTO subscription (id,tenant_id,service_code,grant_id,env,state,valid_until,created_at)"
         " VALUES (?,?,?,?,'sandbox','DRAFT',?,?)", sid, tenant_id, service_code, grant_id, valid_until, db.now())
    for i in intersections:
        db.x("INSERT OR IGNORE INTO scope_item (sub_id,intersection_id,source) VALUES (?,?,'manual')", sid, i)
    db.audit(actor, "SUB_CREATE", sid, {"tenant": tenant_id, "service": service_code, "n": len(intersections)})
    return get_subscription(sid)


def get_subscription(sub_id: str) -> dict:
    s = db.q1("SELECT * FROM subscription WHERE id=?", sub_id)
    if not s:
        raise KeyError(sub_id)
    s["intersections"] = [r["intersection_id"] for r in
                          db.q("SELECT intersection_id FROM scope_item WHERE sub_id=? ORDER BY 1", sub_id)]
    return s


def preview(sub_id: str, target_env: str = None) -> dict:
    """可交付范围预览（SB-2.4）：算得出什么、被什么规则挡住。"""
    s = get_subscription(sub_id)
    fs = rules.evaluate(s, s["intersections"], target_env)
    excluded = {o for f in fs for o in f.objects}
    deliverable = [i for i in s["intersections"] if i not in excluded]
    by_quality = {}
    for i in deliverable:
        row = db.q1("SELECT quality FROM intersection WHERE id=?", i)
        by_quality[row["quality"]] = by_quality.get(row["quality"], 0) + 1
    return {"subscription": sub_id, "requested": len(s["intersections"]),
            "deliverable": len(deliverable), "by_quality": by_quality,
            "findings": [f.as_dict() for f in fs], "blocked": rules.blocked(fs)}


def transition(actor: str, sub_id: str, to_state: str) -> dict:
    """状态迁移，迁移前跑规则终检（CF-1.4）。"""
    s = get_subscription(sub_id)
    if to_state not in STATES:
        raise ValueError(f"未知状态 {to_state}")
    target_env = ENV_OF_STATE.get(to_state)
    fs = rules.evaluate(s, s["intersections"], target_env)
    if rules.blocked(fs):
        db.audit(actor, "SUB_TRANSITION_DENIED", sub_id,
                 {"to": to_state, "findings": [f.as_dict() for f in fs]})
        raise Denied([f.as_dict() for f in fs])
    g = db.q1("SELECT valid_to FROM grant_obj WHERE id=?", s["grant_id"])
    if g and s.get("valid_until") and s["valid_until"] > g["valid_to"]:
        db.x("UPDATE subscription SET valid_until=? WHERE id=?", g["valid_to"], sub_id)
        db.audit(actor, "SUB_VALIDITY_TRUNCATED", sub_id,
                 {"from": s["valid_until"], "to": g["valid_to"], "rule": "R-03"})
    db.x("UPDATE subscription SET state=?, env=COALESCE(?,env), version=version+1 WHERE id=?",
         to_state, target_env, sub_id)
    db.audit(actor, "SUB_TRANSITION", sub_id, {"from": s["state"], "to": to_state})
    return get_subscription(sub_id)

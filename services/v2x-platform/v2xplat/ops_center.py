"""OP-3 暂停指令、NT-4 工单与派单。"""
import uuid
from . import db

SLA = {"D1": 0.5, "D2": 72, "D3": 24}   # 小时：D1 30 min 下线，D2 3 个工作日，D3 1 个工作日


def _id(p): return f"{p}-{uuid.uuid4().hex[:6].upper()}"


# ---------- OP-3 暂停 ----------
def issue_suspend(actor: str, scope_type: str, scope_ref: str, kind: str = "SPECIAL_DUTY",
                  note: str = None) -> dict:
    """特勤、安全事件或授权收缩导致的暂停。对车企统一显示原因码“维护”。"""
    sid = _id("SUS")
    db.x("INSERT INTO suspend_order (id,scope_type,scope_ref,kind,note,state,issued_by,issued_at)"
         " VALUES (?,?,?,?,?, 'ACTIVE',?,?)", sid, scope_type, scope_ref, kind, note, actor, db.now())
    db.audit(actor, "SUSPEND_ISSUE", sid, {"scope": f"{scope_type}:{scope_ref}", "kind": kind})
    return db.q1("SELECT * FROM suspend_order WHERE id=?", sid)


def lift_suspend(actor: str, sid: str) -> dict:
    db.x("UPDATE suspend_order SET state='LIFTED', lifted_at=? WHERE id=?", db.now(), sid)
    db.audit(actor, "SUSPEND_LIFT", sid, {})
    return db.q1("SELECT * FROM suspend_order WHERE id=?", sid)


def suspensions(active_only: bool = False) -> list:
    sql = "SELECT * FROM suspend_order" + (" WHERE state='ACTIVE'" if active_only else "") + " ORDER BY issued_at DESC"
    return db.q(sql)


def is_suspended(intersection_id: str) -> bool:
    i = db.q1("SELECT * FROM intersection WHERE id=?", intersection_id)
    if not i:
        return False
    for s in db.q("SELECT * FROM suspend_order WHERE state='ACTIVE'"):
        if (s["scope_type"] == "city"
                or (s["scope_type"] == "district" and s["scope_ref"] == i["district"])
                or (s["scope_type"] == "corridor" and s["scope_ref"] == i["corridor"])
                or (s["scope_type"] == "intersection" and s["scope_ref"] == intersection_id)):
            return True
    return False


# ---------- NT-4 工单 ----------
def create_ticket(actor: str, kind: str, title: str, target: str, priority: str = "D3",
                  intersection_id: str = None, sub_id: str = None) -> dict:
    tid = _id("TK")
    db.x("INSERT INTO ticket (id,kind,title,target,intersection_id,sub_id,priority,state,sla_hours,"
         "created_by,created_at) VALUES (?,?,?,?,?,?,?, 'OPEN',?,?,?)",
         tid, kind, title, target, intersection_id, sub_id, priority, SLA.get(priority, 24), actor, db.now())
    db.audit(actor, "TICKET_CREATE", tid, {"kind": kind, "target": target, "priority": priority})
    return db.q1("SELECT * FROM ticket WHERE id=?", tid)


def dispatch(actor: str, tid: str) -> dict:
    db.x("UPDATE ticket SET state='DISPATCHED' WHERE id=?", tid)
    t = db.q1("SELECT * FROM ticket WHERE id=?", tid)
    db.audit(actor, "TICKET_DISPATCH", tid, {"target": t["target"], "sla_hours": t["sla_hours"]})
    return t


def close_ticket(actor: str, tid: str, conclusion: str) -> dict:
    db.x("UPDATE ticket SET state='CLOSED', closed_at=?, conclusion=? WHERE id=?", db.now(), conclusion, tid)
    db.audit(actor, "TICKET_CLOSE", tid, {"conclusion": conclusion})
    return db.q1("SELECT * FROM ticket WHERE id=?", tid)


def tickets() -> list:
    return db.q("SELECT * FROM ticket ORDER BY created_at DESC")

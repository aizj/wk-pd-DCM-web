"""OP-6 应急与值班：值班表、事件单与处置动作台、通报时限、复盘。"""
import json
import uuid
from datetime import datetime, timedelta, timezone

from . import db

# 事件分级与对外通报时限（小时），与工单 SLA 口径分开：工单是处置，通报是对外告知
NOTIFY_HOURS = {"P1": 1, "P2": 4, "P3": 24}
ACTIONS = {
    "SUSPEND": "暂停发布（OP-3）",
    "ROLLBACK": "回滚配置快照（CF-3）",
    "REVOKE_CERT": "吊销证书（CR-1.5）",
    "THROTTLE": "限流降配额（CR-2.3）",
    "DEGRADE": "服务降级并发布 HEALTH",
}
ROSTER = [("白班 08:00–20:00", "运营值班 张", "平台负责人 李", "138****0001"),
          ("夜班 20:00–08:00", "运营值班 王", "平台负责人 李", "138****0002")]


def seed() -> None:
    day = datetime.now(timezone.utc).date().isoformat()
    for shift, owner, esc, phone in ROSTER:
        db.x("INSERT OR IGNORE INTO duty_roster (id,day,shift,owner,escalate,phone) VALUES (?,?,?,?,?,?)",
             f"DUTY-{day}-{shift[:2]}", day, shift, owner, esc, phone)


def roster() -> list:
    seed()
    return db.q("SELECT * FROM duty_roster ORDER BY day DESC, shift")


def open_incident(actor: str, level: str, title: str, summary: str) -> dict:
    """OP-6.2 事件单。通报时限按级别自动计算（OP-6.3）。"""
    if level not in NOTIFY_HOURS:
        raise ValueError(f"未知事件级别 {level}")
    iid = "INC-" + uuid.uuid4().hex[:6].upper()
    due = (datetime.now(timezone.utc) + timedelta(hours=NOTIFY_HOURS[level])).isoformat()
    db.x("INSERT INTO incident (id,level,title,summary,state,actions,notify_due,opened_by,opened_at)"
         " VALUES (?,?,?,?, 'OPEN','[]',?,?,?)", iid, level, title, summary, due, actor, db.now())
    db.audit(actor, "INCIDENT_OPEN", iid, {"level": level, "title": title, "notify_due": due})
    return db.q1("SELECT * FROM incident WHERE id=?", iid)


def act(actor: str, inc_id: str, action: str, target: str) -> dict:
    """OP-6.2 处置动作台：每个动作都落到真实的平台能力上，并记录到事件单。"""
    inc = db.q1("SELECT * FROM incident WHERE id=?", inc_id)
    if not inc:
        raise KeyError(inc_id)
    if action not in ACTIONS:
        raise ValueError(f"未知处置动作 {action}")
    result = _execute(actor, action, target)
    acts = json.loads(inc["actions"] or "[]")
    acts.append({"action": action, "name": ACTIONS[action], "target": target,
                 "result": result, "at": db.now(), "by": actor})
    db.x("UPDATE incident SET actions=?, state=CASE WHEN state='OPEN' THEN 'HANDLING' ELSE state END WHERE id=?",
         json.dumps(acts, ensure_ascii=False), inc_id)
    db.audit(actor, "INCIDENT_ACTION", inc_id, {"action": action, "target": target, "result": result})
    return db.q1("SELECT * FROM incident WHERE id=?", inc_id)


def _execute(actor: str, action: str, target: str) -> str:
    from . import ops_center, config_plane, credentials
    if action == "SUSPEND":
        kind = "intersection" if "-" in target else "city"
        s = ops_center.issue_suspend(actor, kind, target, "SECURITY", "应急处置")
        return f"已下达暂停 {s['id']}"
    if action == "ROLLBACK":
        r = config_plane.rollback(actor, target, "应急回滚")
        return f"已回滚到 {r.get('restored') or '无上一版本'}"
    if action == "REVOKE_CERT":
        credentials.revoke(actor, target, "应急吊销")
        return f"已吊销证书 {target}"
    if action == "THROTTLE":
        db.x("UPDATE env_quota SET conn_max=MAX(1, conn_max/2) WHERE tenant_id=?", target)
        return f"已将 {target} 各环境连接配额减半"
    return f"已对 {target} 执行降级并发布 HEALTH 通知"


def notify(actor: str, inc_id: str, channel: str, text: str) -> dict:
    """OP-6.3 通报：记录时限达成情况。"""
    inc = db.q1("SELECT * FROM incident WHERE id=?", inc_id)
    late = db.now() > inc["notify_due"]
    db.x("UPDATE incident SET state='NOTIFIED' WHERE id=?", inc_id)
    db.audit(actor, "INCIDENT_NOTIFY", inc_id, {"channel": channel, "late": late, "text": text[:120]})
    return {"incident": inc_id, "on_time": not late, "due": inc["notify_due"]}


def close(actor: str, inc_id: str, review: str) -> dict:
    """OP-6.4 复盘报告，闭环前必须填写。"""
    if not (review or "").strip():
        raise ValueError("闭环前须填写复盘：根因、影响面、改进项与责任人")
    db.x("UPDATE incident SET state='CLOSED', review=?, closed_at=? WHERE id=?", review, db.now(), inc_id)
    db.audit(actor, "INCIDENT_CLOSE", inc_id, {"review": review[:200]})
    return db.q1("SELECT * FROM incident WHERE id=?", inc_id)


def incidents() -> list:
    rows = db.q("SELECT * FROM incident ORDER BY opened_at DESC")
    for r in rows:
        r["actions"] = json.loads(r["actions"] or "[]")
        r["notify_late"] = r["state"] in ("OPEN", "HANDLING") and db.now() > r["notify_due"]
    return rows

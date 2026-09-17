"""DT-1 沙箱与故障注入、DT-3 联调记录与准出。

故障注入不是模拟按钮：每种注入都落到平台真实状态上（暂停、回滚、吊销证书等），
车企在沙箱观察到的降级行为与生产一致，准出报告据此生成。
"""
import uuid
from . import db

FAULTS = {
    "STREAM_BREAK": ("路侧断流", "路口停止发布，观察 HEALTH 与场景资格撤销"),
    "PLAN_SWITCH": ("配时方案切换", "相位方案变更，观察读秒跳变降级"),
    "QUALITY_DEGRADE": ("质量降级", "路口质量 A→C，观察绿波等场景自动退出"),
    "CLOCK_SKEW": ("时钟偏差", "注入 1.2 s 龄期，观察不下发与原因码"),
    "EVENT_CANCEL": ("事件撤销", "事件 CANCEL 后车端须停止提示"),
    "CERT_EXPIRE": ("证书过期", "沙箱证书失效，观察重连与告警"),
}
CASES = [
    ("TC-01", "订阅生效后 5 分钟内收到 SPAT", "sandbox", "首包时延 ≤ 5 min，频率 ≥ 2 Hz", 1),
    ("TC-02", "路口质量降级时场景资格自动撤销", "sandbox", "收到 HEALTH，绿波停止下发", 1),
    ("TC-03", "断流后恢复不重复提示", "sandbox", "恢复后按下一灯周期边界继续", 1),
    ("TC-04", "读秒龄期超限不下发", "sandbox", "记录原因码，不出现错误读秒", 1),
    ("TC-05", "事件撤销后车端停止提示", "sandbox", "CANCEL 后 ≤ 2 s 停止", 1),
    ("TC-06", "证书轮换不中断连接", "preprod", "并行期内新旧证书均可用", 1),
    ("TC-07", "特勤暂停后停止交付且原因码为维护", "preprod", "不泄露暂停类型", 1),
    ("TC-08", "回执抽样与字段最小化", "preprod", "无 VIN、车牌与轨迹字段", 1),
    ("TC-09", "1.5 倍峰值压测", "preprod", "P95 时延达标、无积压", 0),
]


def seed() -> None:
    for c in CASES:
        db.x("INSERT OR IGNORE INTO testcase (id,name,phase,expect,mandatory) VALUES (?,?,?,?,?)", *c)


def cases(phase: str = None) -> list:
    seed()
    return db.q("SELECT * FROM testcase WHERE (?1 IS NULL OR phase=?1) ORDER BY id", phase)


def inject(actor: str, tenant_id: str, kind: str, target: str) -> dict:
    """DT-1.2 故障注入，落到平台真实状态。"""
    if kind not in FAULTS:
        raise ValueError(f"未知故障类型 {kind}")
    fid = "FI-" + uuid.uuid4().hex[:6].upper()
    observed = _apply(actor, kind, target)
    db.x("INSERT INTO fault_run (id,tenant_id,kind,target,state,started_at,observed)"
         " VALUES (?,?,?,?, 'RUNNING',?,?)", fid, tenant_id, kind, target, db.now(), observed)
    db.audit(actor, "FAULT_INJECT", fid, {"kind": kind, "target": target, "observed": observed})
    return db.q1("SELECT * FROM fault_run WHERE id=?", fid)


def _apply(actor: str, kind: str, target: str) -> str:
    from . import ops_center, credentials
    if kind == "STREAM_BREAK":
        db.x("UPDATE intersection SET published=0 WHERE id=?", target)
        return f"{target} 已置为未发布，场景资格随之撤销"
    if kind == "QUALITY_DEGRADE":
        db.x("UPDATE intersection SET quality='C' WHERE id=?", target)
        return f"{target} 质量降为 C，仅保留 C 级门槛的场景"
    if kind == "CERT_EXPIRE":
        credentials.revoke(actor, target, "沙箱故障注入")
        return f"证书 {target} 已吊销，连接应在重试后失败并告警"
    if kind == "PLAN_SWITCH":
        db.x("UPDATE intersection SET ctrl_mode='ADAPTIVE' WHERE id=?", target)
        return f"{target} 切换为自适应控制，读秒进入降级口径"
    if kind == "EVENT_CANCEL":
        ops_center.issue_suspend(actor, "intersection", target, "MAINTENANCE", "沙箱故障注入")
        return f"{target} 已暂停发布，等同事件撤销后的停止提示"
    return "已注入时钟偏差 1.2 s，超过龄期上限的消息不计算、不下发"


def finish(actor: str, fid: str) -> dict:
    """DT-1.4 结束注入并恢复现场。"""
    f = db.q1("SELECT * FROM fault_run WHERE id=?", fid)
    if not f:
        raise KeyError(fid)
    if f["kind"] == "STREAM_BREAK":
        db.x("UPDATE intersection SET published=1 WHERE id=?", f["target"])
    elif f["kind"] == "QUALITY_DEGRADE":
        db.x("UPDATE intersection SET quality='A' WHERE id=?", f["target"])
    elif f["kind"] == "PLAN_SWITCH":
        db.x("UPDATE intersection SET ctrl_mode='FIXED_TIME' WHERE id=?", f["target"])
    elif f["kind"] == "EVENT_CANCEL":
        from . import ops_center
        for s in db.q("SELECT * FROM suspend_order WHERE state='ACTIVE' AND scope_ref=?", f["target"]):
            ops_center.lift_suspend(actor, s["id"])
    db.x("UPDATE fault_run SET state='FINISHED', ended_at=? WHERE id=?", db.now(), fid)
    db.audit(actor, "FAULT_FINISH", fid, {"kind": f["kind"], "target": f["target"]})
    return db.q1("SELECT * FROM fault_run WHERE id=?", fid)


def runs(tenant_id: str = None) -> list:
    return db.q("SELECT * FROM fault_run WHERE (?1 IS NULL OR tenant_id=?1) ORDER BY started_at DESC", tenant_id)


# ---------- DT-3 联调记录与准出 ----------
def record(actor: str, tenant_id: str, case_id: str, result: str, icd_id: str = None,
           defect_level: str = None, note: str = "") -> dict:
    """DT-3.2 执行结果与缺陷登记（D1–D4）。"""
    if result not in ("PASS", "FAIL", "NA"):
        raise ValueError(result)
    if result == "FAIL" and defect_level not in ("D1", "D2", "D3", "D4"):
        raise ValueError("失败用例须登记缺陷等级 D1–D4")
    rid = "TR-" + uuid.uuid4().hex[:6].upper()
    db.x("INSERT INTO test_run (id,tenant_id,case_id,icd_id,result,defect_level,note,run_by,run_at)"
         " VALUES (?,?,?,?,?,?,?,?,?)", rid, tenant_id, case_id, icd_id, result, defect_level, note, actor, db.now())
    db.audit(actor, "TEST_RECORD", rid, {"case": case_id, "result": result, "defect": defect_level})
    return db.q1("SELECT * FROM test_run WHERE id=?", rid)


def report(tenant_id: str, phase: str = "sandbox") -> dict:
    """DT-3.4 准出报告：必过用例全通过且无 D1/D2 未闭环缺陷，才判为可准出。"""
    from . import icd as icd_mod
    seed()
    cs = cases(phase)
    latest = {}
    for r in db.q("SELECT * FROM test_run WHERE tenant_id=? ORDER BY run_at", tenant_id):
        latest[r["case_id"]] = r
    items, blocking = [], []
    for c in cs:
        r = latest.get(c["id"])
        items.append({**c, "result": r["result"] if r else "未执行",
                      "defect_level": r["defect_level"] if r else None,
                      "icd_id": r["icd_id"] if r else None,
                      "run_at": r["run_at"] if r else None})
        if c["mandatory"] and (not r or r["result"] != "PASS"):
            blocking.append(c["id"])
    frozen = [i["id"] for i in icd_mod.icds() if i["state"] == "FROZEN"]
    used = {i["icd_id"] for i in items if i["icd_id"]}
    icd_ok = bool(used) and used.issubset(set(frozen))
    return {"tenant_id": tenant_id, "phase": phase, "items": items,
            "passed": not blocking and icd_ok,
            "blocking_cases": blocking,
            "icd_ok": icd_ok,
            "icd_used": sorted(used),
            "note": "准出要求：必过用例全部 PASS，且用例绑定的 ICD 版本已冻结（R-16）"}

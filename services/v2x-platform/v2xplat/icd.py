"""AD-1 服务版本、AD-2 ICD 版本与冻结。

R-16：联调准出、预生产与生产的订阅，其服务版本绑定的 ICD 必须为“冻结”状态；
沙箱可用“评审中”版本并标注。冻结后不可再改内容，只能废弃并新开版本。
"""
import uuid
from . import db

STATES = ("DRAFT", "REVIEW", "FROZEN", "DEPRECATED")
NEXT = {"DRAFT": ("REVIEW",), "REVIEW": ("FROZEN", "DRAFT"), "FROZEN": ("DEPRECATED",), "DEPRECATED": ()}
SEED = [
    ("ICD-1.0", "1.0", "数据上车接口控制文件 V1.0", "FROZEN", "OpenAPI", "icd/v1.0/openapi.yaml",
     "首版：SPAT、MAP、HEALTH、拥堵事件", "—"),
    ("ICD-1.1", "1.1", "数据上车接口控制文件 V1.1", "REVIEW", "AsyncAPI", "icd/v1.1/asyncapi.yaml",
     "新增异常停车事件、回执抽样字段", "向后兼容：新增字段可选，旧客户端忽略即可"),
]


class IcdError(ValueError):
    def __init__(self, rule, msg):
        super().__init__(msg)
        self.rule = rule


def seed() -> None:
    for row in SEED:
        db.x("INSERT OR IGNORE INTO icd (id,version,title,state,spec_kind,spec_ref,changes,compat,created_at,"
             "frozen_at,frozen_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
             *row, db.now(), db.now() if row[3] == "FROZEN" else None, "arch.li" if row[3] == "FROZEN" else None)
    for code in [r["code"] for r in db.q("SELECT code FROM service_def")]:
        db.x("INSERT OR IGNORE INTO service_version (service_code,version,icd_id,state,released_at)"
             " VALUES (?, '1.0', 'ICD-1.0', 'RELEASED', ?)", code, db.now())


def icds() -> list:
    seed()
    rows = db.q("SELECT * FROM icd ORDER BY version")
    for r in rows:
        r["acks"] = db.q("SELECT * FROM icd_ack WHERE icd_id=? ORDER BY acked_at", r["id"])
        r["services"] = [x["service_code"] for x in db.q("SELECT service_code FROM service_version WHERE icd_id=?", r["id"])]
    return rows


def upload(actor: str, version: str, title: str, spec_kind: str, spec_ref: str, changes: str = "") -> dict:
    """AD-2.1 上传 ICD 文档与接口定义，初始为草稿。"""
    if db.q1("SELECT 1 FROM icd WHERE version=?", version):
        raise IcdError("AD-2.1", f"ICD 版本 {version} 已存在，冻结版本不可覆盖，请新开版本号")
    iid = "ICD-" + version
    db.x("INSERT INTO icd (id,version,title,state,spec_kind,spec_ref,changes,compat,created_at)"
         " VALUES (?,?,?, 'DRAFT',?,?,?,?,?)", iid, version, title, spec_kind, spec_ref, changes, "", db.now())
    db.audit(actor, "ICD_UPLOAD", iid, {"version": version, "kind": spec_kind})
    return db.q1("SELECT * FROM icd WHERE id=?", iid)


def set_state(actor: str, icd_id: str, state: str, compat: str = None) -> dict:
    """AD-2.2 状态机：草稿 → 评审中 → 冻结 → 废弃。冻结须填写兼容性说明（AD-2.4）。"""
    c = db.q1("SELECT * FROM icd WHERE id=?", icd_id)
    if not c:
        raise KeyError(icd_id)
    if state not in NEXT.get(c["state"], ()):
        raise IcdError("AD-2.2", f"{c['state']} 不能直接迁移到 {state}；冻结版本只能废弃后另开版本")
    if state == "FROZEN" and not (compat or c["compat"]):
        raise IcdError("AD-2.4", "冻结前须填写与上一版本的差异与兼容性说明")
    db.x("UPDATE icd SET state=?, compat=COALESCE(?,compat), frozen_at=?, frozen_by=? WHERE id=?",
         state, compat, db.now() if state == "FROZEN" else c["frozen_at"],
         actor if state == "FROZEN" else c["frozen_by"], icd_id)
    db.audit(actor, "ICD_STATE", icd_id, {"from": c["state"], "to": state})
    return db.q1("SELECT * FROM icd WHERE id=?", icd_id)


def ack(actor: str, icd_id: str, tenant_id: str) -> dict:
    """AD-2.5 车企确认记录：确认后方可在准出报告中引用该版本。"""
    c = db.q1("SELECT * FROM icd WHERE id=?", icd_id)
    if not c:
        raise KeyError(icd_id)
    if c["state"] not in ("FROZEN", "REVIEW"):
        raise IcdError("AD-2.5", "只能确认评审中或已冻结的 ICD 版本")
    db.x("INSERT OR REPLACE INTO icd_ack (icd_id,tenant_id,acked_by,acked_at) VALUES (?,?,?,?)",
         icd_id, tenant_id, actor, db.now())
    db.audit(actor, "ICD_ACK", icd_id, {"tenant": tenant_id})
    return {"icd": icd_id, "tenant": tenant_id}


def bind(actor: str, service_code: str, version: str, icd_id: str, state: str = "PREVIEW") -> dict:
    """AD-2.3 服务版本绑定 ICD。R-16 前移：未冻结的 ICD 不得绑定到已发布的服务版本。"""
    doc = db.q1("SELECT * FROM icd WHERE id=?", icd_id)
    if not doc:
        raise KeyError(icd_id)
    if state == "RELEASED" and doc["state"] != "FROZEN":
        raise IcdError("R-16", f"{icd_id} 状态为 {doc['state']}，未冻结的 ICD 不能绑定到已发布的服务版本")
    db.x("INSERT OR REPLACE INTO service_version (service_code,version,icd_id,state,released_at)"
         " VALUES (?,?,?,?,?)", service_code, version, icd_id, state,
         db.now() if state == "RELEASED" else None)
    db.audit(actor, "SERVICE_VERSION_BIND", f"{service_code}@{version}", {"icd": icd_id, "state": state})
    return db.q1("SELECT * FROM service_version WHERE service_code=? AND version=?", service_code, version)


def service_versions(service_code: str = None) -> list:
    seed()
    return db.q("SELECT sv.*, i.state icd_state, i.version icd_version FROM service_version sv"
                " JOIN icd i ON i.id=sv.icd_id WHERE (?1 IS NULL OR sv.service_code=?1)"
                " ORDER BY sv.service_code, sv.version", service_code)


def icd_for(service_code: str) -> dict:
    """订阅所用服务当前绑定的 ICD（取已发布版本，其次预览版本）。"""
    seed()
    rows = service_versions(service_code)
    rel = sorted([r for r in rows if r["state"] == "RELEASED"], key=lambda r: r["version"], reverse=True)
    prev = sorted([r for r in rows if r["state"] == "PREVIEW"], key=lambda r: r["version"], reverse=True)
    pick = (rel or prev or [None])[0]
    return db.q1("SELECT * FROM icd WHERE id=?", pick["icd_id"]) if pick else None

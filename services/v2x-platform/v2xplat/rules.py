"""护栏规则引擎（第 12 章 R-xx）。

本切片实现 R-00、R-01、R-03、R-09、R-16、R-21、OP-3 与订阅状态迁移前置检查；
其余规则留占位，按任务包 T-09 补全。规则结果统一为 (code, level, message, objects)。
"""
from dataclasses import dataclass, field
from typing import List
from . import db

BLOCK, WARN, PASS = "BLOCK", "WARN", "PASS"


@dataclass
class Finding:
    rule: str
    level: str
    message: str
    objects: List[str] = field(default_factory=list)

    def as_dict(self) -> dict:
        return {"rule": self.rule, "level": self.level, "message": self.message, "objects": self.objects}


def _gate_state() -> dict:
    return db.q1("SELECT * FROM auth_path WHERE id=1") or {"state": "UNCONFIRMED"}


def check_r00(sub: dict, target_env: str) -> List[Finding]:
    """R-00 对外提供门禁：外部主体进入 prod / preprod 须授权路径已确认。"""
    if target_env == "sandbox":
        return []
    tenant = db.q1("SELECT * FROM tenant WHERE id=?", sub["tenant_id"])
    if tenant and tenant["kind"] == "TEST_FLEET" and target_env == "preprod":
        return []  # 示范 / 测试车按测试数据使用协议，可进预生产
    g = _gate_state()
    if g["state"] in ("OPERATOR_AUTHORIZED", "PARTNER_AUTHORIZED"):
        if g["state"] == "PARTNER_AUTHORIZED" and not g.get("agreement_no"):
            return [Finding("R-00", BLOCK, "合作授权机构未登记授权运营协议编号")]
        return []
    return [Finding("R-00", BLOCK,
                    f"授权路径状态为 {g['state']}，不得向车企或图商提供数据（DEC-08）")]


def check_r01(sub: dict, intersections: List[str]) -> List[Finding]:
    """R-01 订阅范围 ⊆ 授权白名单。"""
    ok = {r["intersection_id"] for r in db.q(
        "SELECT intersection_id FROM grant_scope WHERE grant_id=? AND version="
        "(SELECT version FROM grant_obj WHERE id=?)", sub["grant_id"], sub["grant_id"])}
    bad = [i for i in intersections if i not in ok]
    return [Finding("R-01", BLOCK, f"{len(bad)} 个路口不在授权白名单内", bad[:20])] if bad else []


def check_r03(sub: dict) -> List[Finding]:
    """R-03 订阅有效期 ≤ 授权有效期。"""
    g = db.q1("SELECT valid_to FROM grant_obj WHERE id=?", sub["grant_id"])
    if g and sub.get("valid_until") and sub["valid_until"] > g["valid_to"]:
        return [Finding("R-03", WARN, f"订阅有效期超出授权，已截断至 {g['valid_to']}")]
    return []


def check_r21(intersections: List[str]) -> List[Finding]:
    """R-21 启用范围 ⊆ 已发布路口。"""
    if not intersections:
        return []
    marks = ",".join("?" * len(intersections))
    pub = {r["id"] for r in db.q(f"SELECT id FROM intersection WHERE published=1 AND id IN ({marks})", *intersections)}
    bad = [i for i in intersections if i not in pub]
    return [Finding("R-21", BLOCK, f"{len(bad)} 个路口未发布", bad[:20])] if bad else []


def check_suspended(intersections):
    """OP-3：被暂停的路口不可交付，对外原因码统一为“维护”。"""
    from . import ops_center
    bad = [i for i in intersections if ops_center.is_suspended(i)]
    return [Finding("OP-3", BLOCK, f"{len(bad)} 个路口处于暂停发布状态（维护）", bad[:20])] if bad else []


def check_r09(sub: dict, target_env: str) -> List[Finding]:
    """R-09 生产环境订阅必须关联有效正式协议与生产证书。"""
    if target_env != "prod":
        return []
    from . import credentials
    fs = []
    if not credentials.active(sub["tenant_id"], "prod"):
        fs.append(Finding("R-09", BLOCK, "租户在生产环境没有有效证书（未签发、已过期或已吊销）"))
    q = db.q1("SELECT * FROM env_quota WHERE tenant_id=? AND env='prod'", sub["tenant_id"])
    if not q or not q["opened"]:
        fs.append(Finding("R-09", BLOCK, "生产环境尚未开通（需有效生产证书 + 已审批的出口 IP 白名单）"))
    g = _gate_state()
    if not g.get("agreement_no") and g["state"] == "PARTNER_AUTHORIZED":
        fs.append(Finding("R-09", BLOCK, "未登记正式授权运营协议编号"))
    return fs


def check_r16(sub: dict, target_env: str) -> List[Finding]:
    """R-16 预生产与生产订阅所用服务版本绑定的 ICD 必须已冻结；沙箱可用评审中版本。"""
    from . import icd as icd_mod
    doc = icd_mod.icd_for(sub["service_code"])
    if not doc:
        if target_env in ("preprod", "prod"):
            return [Finding("R-16", BLOCK, f"服务 {sub['service_code']} 未绑定 ICD 版本")]
        return []
    if target_env in ("preprod", "prod") and doc["state"] != "FROZEN":
        return [Finding("R-16", BLOCK,
                        f"{sub['service_code']} 绑定的 {doc['id']} 状态为 {doc['state']}，"
                        f"进入 {target_env} 前须冻结 ICD")]
    if target_env == "sandbox" and doc["state"] == "REVIEW":
        return [Finding("R-16", WARN, f"沙箱使用评审中的 {doc['id']}，冻结前接口可能变更")]
    return []


def evaluate(sub: dict, intersections: List[str], target_env: str = None) -> List[Finding]:
    fs: List[Finding] = []
    fs += check_r01(sub, intersections)
    fs += check_r21(intersections)
    fs += check_suspended(intersections)
    fs += check_r03(sub)
    if target_env:
        fs += check_r00(sub, target_env)
        fs += check_r09(sub, target_env)
        fs += check_r16(sub, target_env)
    return fs


def blocked(findings: List[Finding]) -> bool:
    return any(f.level == BLOCK for f in findings)

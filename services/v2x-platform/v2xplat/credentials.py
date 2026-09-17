"""CR-1 证书生命周期、CR-2 环境与网络准入。

证书分环境签发（沙箱 / 预生产 / 生产），R-09 要求生产订阅必须持有有效生产证书。
本实现不做真实 CA：校验 CSR 形态、生成序列号与指纹，重点是状态机与门禁联动。
"""
import hashlib
import re
import uuid
from datetime import datetime, timedelta, timezone

from . import db

ENVS = ("sandbox", "preprod", "prod")
VALID_DAYS = {"sandbox": 90, "preprod": 180, "prod": 365}
DEFAULT_QUOTA = {"sandbox": (2, 200_000), "preprod": (4, 2_000_000), "prod": (16, 20_000_000)}
WARN_DAYS = (30, 7)                       # CR-1.3 到期提醒档位
PEM_RE = re.compile(r"-----BEGIN CERTIFICATE REQUEST-----(.+?)-----END CERTIFICATE REQUEST-----", re.S)


class CertError(ValueError):
    def __init__(self, rule, msg):
        super().__init__(msg)
        self.rule = rule


def _now():
    return datetime.now(timezone.utc)


def parse_csr(pem: str) -> dict:
    """CR-1.1 CSR 形态校验：PEM 包裹、载荷非空、CN 可解析。"""
    m = PEM_RE.search(pem or "")
    if not m:
        raise CertError("CR-1.1", "CSR 必须是 PEM 格式的证书请求（BEGIN/END CERTIFICATE REQUEST）")
    body = re.sub(r"\s+", "", m.group(1))
    if len(body) < 64:
        raise CertError("CR-1.1", "CSR 载荷过短，疑似截断")
    cn = re.search(r"CN=([A-Za-z0-9._-]+)", pem)
    return {"cn": cn.group(1) if cn else "unknown.oem.jinan",
            "fingerprint": hashlib.sha256(body.encode()).hexdigest()[:32]}


def issue(actor: str, tenant_id: str, env: str, csr_pem: str, replaces: str = None) -> dict:
    """CR-1.2 分环境签发；CR-1.4 指定 replaces 时进入轮换并行期。"""
    if env not in ENVS:
        raise CertError("CR-1.2", f"未知环境 {env}")
    info = parse_csr(csr_pem)
    cid = "CERT-" + uuid.uuid4().hex[:8].upper()
    not_after = (_now() + timedelta(days=VALID_DAYS[env])).date().isoformat()
    db.x("INSERT INTO cert (id,tenant_id,env,cn,serial,fingerprint,state,issued_at,not_after,replaces,issued_by)"
         " VALUES (?,?,?,?,?,?,'ISSUED',?,?,?,?)",
         cid, tenant_id, env, info["cn"], uuid.uuid4().hex[:16].upper(), info["fingerprint"],
         db.now(), not_after, replaces, actor)
    if replaces:
        db.x("UPDATE cert SET state='ROTATING' WHERE id=? AND state='ISSUED'", replaces)
    db.audit(actor, "CERT_ISSUE", cid, {"tenant": tenant_id, "env": env, "cn": info["cn"],
                                        "not_after": not_after, "replaces": replaces})
    return db.q1("SELECT * FROM cert WHERE id=?", cid)


def revoke(actor: str, cert_id: str, reason: str) -> dict:
    """CR-1.5 紧急吊销：立即生效，相关环境的订阅随即失去 R-09 依据。"""
    c = db.q1("SELECT * FROM cert WHERE id=?", cert_id)
    if not c:
        raise KeyError(cert_id)
    db.x("UPDATE cert SET state='REVOKED', revoked_at=?, revoke_reason=? WHERE id=?", db.now(), reason, cert_id)
    db.audit(actor, "CERT_REVOKE", cert_id, {"tenant": c["tenant_id"], "env": c["env"], "reason": reason})
    return db.q1("SELECT * FROM cert WHERE id=?", cert_id)


def certs(tenant_id: str = None) -> list:
    rows = db.q("SELECT * FROM cert WHERE (?1 IS NULL OR tenant_id=?1) ORDER BY env, issued_at DESC", tenant_id)
    today = _now().date()
    for r in rows:
        left = (datetime.fromisoformat(r["not_after"]).date() - today).days
        r["days_left"] = left
        if r["state"] in ("ISSUED", "ROTATING") and left < 0:
            db.x("UPDATE cert SET state='EXPIRED' WHERE id=?", r["id"])
            r["state"] = "EXPIRED"
        r["warn"] = next((d for d in WARN_DAYS if 0 <= left <= d), None)   # CR-1.3
    return rows


def active(tenant_id: str, env: str) -> dict:
    """该租户在该环境下当前可用的证书（含轮换并行期内的旧证书）。"""
    for c in certs(tenant_id):
        if c["env"] == env and c["state"] in ("ISSUED", "ROTATING") and c["days_left"] >= 0:
            return c
    return None


def expiring(days: int = 30) -> list:
    """CR-1.3 到期提醒清单。"""
    return [c for c in certs() if c["state"] in ("ISSUED", "ROTATING") and 0 <= c["days_left"] <= days]


# ---------- CR-2 环境与网络准入 ----------
def request_ip(actor: str, tenant_id: str, env: str, cidr: str, purpose: str) -> dict:
    """CR-2.1 出口 IP 白名单申请，需运营审批后生效（E-28 变更须报备）。"""
    if not re.fullmatch(r"(\d{1,3}\.){3}\d{1,3}(/\d{1,2})?", cidr or ""):
        raise CertError("CR-2.1", "出口 IP 须为 IPv4 地址或 CIDR，例如 203.0.113.8/32")
    rid = "IP-" + uuid.uuid4().hex[:6].upper()
    db.x("INSERT INTO ip_allow (id,tenant_id,env,cidr,purpose,state,applied_by,applied_at)"
         " VALUES (?,?,?,?,?, 'PENDING',?,?)", rid, tenant_id, env, cidr, purpose, actor, db.now())
    db.audit(actor, "IP_ALLOW_APPLY", rid, {"tenant": tenant_id, "env": env, "cidr": cidr})
    return db.q1("SELECT * FROM ip_allow WHERE id=?", rid)


def approve_ip(actor: str, rid: str) -> dict:
    r = db.q1("SELECT * FROM ip_allow WHERE id=?", rid)
    if not r:
        raise KeyError(rid)
    if r["applied_by"] == actor:
        raise CertError("CR-2.1", "网络准入变更须双人复核，申请人不得自审")
    db.x("UPDATE ip_allow SET state='ACTIVE', approved_by=?, approved_at=? WHERE id=?", actor, db.now(), rid)
    db.audit(actor, "IP_ALLOW_APPROVE", rid, {"cidr": r["cidr"], "env": r["env"]})
    return db.q1("SELECT * FROM ip_allow WHERE id=?", rid)


def ip_list(tenant_id: str = None) -> list:
    return db.q("SELECT * FROM ip_allow WHERE (?1 IS NULL OR tenant_id=?1) ORDER BY applied_at DESC", tenant_id)


def seed_quota(tenant_id: str) -> None:
    for env, (conn, msg) in DEFAULT_QUOTA.items():
        db.x("INSERT OR IGNORE INTO env_quota (tenant_id,env,conn_max,conn_used,msg_quota,opened)"
             " VALUES (?,?,?,0,?,?)", tenant_id, env, conn, msg, 1 if env == "sandbox" else 0)


def env_status(tenant_id: str) -> list:
    """CR-2.2 环境开通状态、CR-2.3 连接实例数与配额。"""
    seed_quota(tenant_id)
    rows = db.q("SELECT * FROM env_quota WHERE tenant_id=? ORDER BY env", tenant_id)
    order = {"sandbox": 0, "preprod": 1, "prod": 2}
    for r in rows:
        c = active(tenant_id, r["env"])
        r["cert"] = c["id"] if c else None
        r["cert_days_left"] = c["days_left"] if c else None
        r["ip_active"] = len([x for x in ip_list(tenant_id) if x["env"] == r["env"] and x["state"] == "ACTIVE"])
        r["ready"] = bool(r["opened"] and c and r["ip_active"])
    return sorted(rows, key=lambda r: order.get(r["env"], 9))


def open_env(actor: str, tenant_id: str, env: str) -> dict:
    """CR-2.2 环境开通。生产环境须先有有效生产证书与已生效的出口 IP（R-09 前置）。"""
    seed_quota(tenant_id)
    if env == "prod":
        if not active(tenant_id, "prod"):
            raise CertError("R-09", "生产环境开通前须先签发生产证书")
        if not [x for x in ip_list(tenant_id) if x["env"] == "prod" and x["state"] == "ACTIVE"]:
            raise CertError("CR-2.1", "生产环境开通前须有已审批生效的出口 IP 白名单")
    db.x("UPDATE env_quota SET opened=1 WHERE tenant_id=? AND env=?", tenant_id, env)
    db.audit(actor, "ENV_OPEN", f"{tenant_id}:{env}", {})
    return db.q1("SELECT * FROM env_quota WHERE tenant_id=? AND env=?", tenant_id, env)

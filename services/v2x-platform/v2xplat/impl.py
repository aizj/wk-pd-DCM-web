"""实现登记表：功能点 → 实现函数。

生成的骨架只负责“有位置”，真正的实现登记在这里。
status: DONE 已完成；PARTIAL 有实现但未覆盖全部要求（备注写清差在哪）。
未登记的功能点视为 TODO，调用时抛 NotImplementedYet。
"""
from . import (service, db, config_plane as cp, scenes, ops_center, receipts, retention,
               catalog_svc, profiles, credentials, icd, debug, duty, sandbox)
from .base import DONE, PARTIAL

REGISTRY = {
    # ---- GR 授权与合规 ----
    "GR-1.1": {"fn": service.create_grant, "status": DONE},
    "GR-1.2": {"fn": service.set_whitelist, "status": DONE},
    "GR-1.4": {"fn": service.shrink_impact, "status": DONE},
    "GR-2.1": {"fn": service.set_gate, "status": DONE},
    "GR-2.3": {"fn": lambda **kw: service.gate_checklist(kw["tenant_id"])["passed"], "status": DONE},
    "GR-2.4": {"fn": lambda **kw: service.gate_checklist(kw["tenant_id"]), "status": DONE},
    # ---- SB 订阅管理 ----
    "SB-1.1": {"fn": service.create_subscription, "status": DONE},
    "SB-1.3": {"fn": service.create_subscription, "status": PARTIAL,
               "note": "已绑定服务、授权、环境；车型画像待 TN-2 接入"},
    "SB-2.4": {"fn": lambda **kw: service.preview(kw["sub_id"], kw.get("target_env")), "status": DONE},
    # ---- CF 配置与发布 ----
    "CF-1.2": {"fn": lambda **kw: [f.as_dict() for f in _evaluate(kw)], "status": PARTIAL,
               "note": "已实现 R-00、R-01、R-03、R-21；其余规则待 T-09"},
    "CF-1.4": {"fn": lambda **kw: service.transition(kw["actor"], kw["sub_id"], kw["to_state"]),
               "status": PARTIAL, "note": "生效前终检已接入状态迁移"},
    # ---- CF 配置与发布 ----
    "CF-2.1": {"fn": lambda **kw: cp.build(kw["actor"]), "status": PARTIAL,
               "note": "已合并门禁与订阅范围；L4/L5 分层与场景策略待 SC 接入"},
    "CF-2.2": {"fn": lambda **kw: cp.build(kw["actor"]), "status": DONE},
    "CF-2.3": {"fn": lambda **kw: cp.push(kw["actor"], kw["snapshot_id"]), "status": DONE},
    "CF-2.4": {"fn": lambda **kw: cp.ack(kw["region_id"], kw["snapshot_id"], kw.get("ok", True), kw.get("reason")),
               "status": PARTIAL, "note": "确认与失败回滚已实现；超时自动回滚待定时任务"},
    "CF-2.5": {"fn": lambda **kw: cp.active(kw.get("region_id")), "status": PARTIAL,
               "note": "已按最近 ACTIVE 快照运行；本地保留 3 个版本待区域云代理实现"},
    "CF-3.4": {"fn": lambda **kw: cp.rollback(kw["actor"], kw["snapshot_id"], kw.get("why", "手工回滚")),
               "status": DONE},
    # ---- CT 服务目录 ----
    "CT-1.1": {"fn": lambda **kw: catalog_svc.services(), "status": DONE},
    "CT-1.2": {"fn": lambda **kw: catalog_svc.services(), "status": PARTIAL, "note": "详情六类信息中的覆盖与质量待接入"},
    # ---- TN 车型能力画像 ----
    "TN-2.1": {"fn": profiles.create, "status": DONE},
    "TN-2.2": {"fn": lambda **kw: profiles.derive(kw), "status": DONE},
    # ---- SC 场景策略与参数 ----
    "SC-1.1": {"fn": lambda **kw: scenes.scenes(), "status": DONE},
    "SC-1.2": {"fn": lambda **kw: scenes.scenes(), "status": DONE},
    "SC-2.1": {"fn": scenes.set_policy, "status": DONE},
    "SC-2.2": {"fn": scenes.set_policy, "status": DONE},
    "SC-2.4": {"fn": lambda **kw: scenes.enabled_at(kw["scene_code"], kw["intersection"]), "status": DONE},
    "SC-2.5": {"fn": lambda **kw: scenes.deliverable(kw["scene_code"], kw["intersections"]), "status": DONE},
    "SC-3.1": {"fn": scenes.set_param, "status": DONE},
    "SC-3.2": {"fn": scenes.set_param, "status": PARTIAL, "note": "按粒度覆盖当前为全市级，路段级覆盖待补"},
    "SC-5.1": {"fn": scenes.set_sub_scene, "status": DONE},
    "SC-5.2": {"fn": scenes.set_sub_scene, "status": PARTIAL, "note": "等级与距离过滤已存储，发布路由裁剪待接入"},
    "SC-5.4": {"fn": scenes.set_sub_scene, "status": DONE},
    # ---- OP 运行 ----
    "OP-2.2": {"fn": lambda **kw: scenes.eligible_at(kw["scene_code"], kw["intersection"]), "status": DONE},
    "OP-3.1": {"fn": ops_center.issue_suspend, "status": DONE},
    "OP-3.3": {"fn": ops_center.lift_suspend, "status": DONE},
    "OP-3.5": {"fn": lambda **kw: ops_center.is_suspended(kw["intersection_id"]), "status": DONE},
    # ---- NT-4 工单 ----
    "NT-4.1": {"fn": ops_center.create_ticket, "status": DONE},
    "NT-4.2": {"fn": ops_center.dispatch, "status": DONE},
    "NT-4.4": {"fn": ops_center.close_ticket, "status": DONE},
    "NT-4.5": {"fn": lambda **kw: ops_center.tickets(), "status": DONE},
    # ---- EV-1 回执 ----
    "EV-1.2": {"fn": receipts.ingest, "status": DONE},
    "EV-1.4": {"fn": receipts.anomaly, "status": DONE},
    "EV-1.6": {"fn": lambda **kw: receipts.stats(kw.get("sub_id")), "status": DONE},
    # ---- AU-4 留存与销毁 ----
    "AU-4.1": {"fn": retention.set_policy, "status": DONE},
    "AU-4.2": {"fn": retention.purge, "status": DONE},
    "AU-4.3": {"fn": lambda **kw: retention.certificates(), "status": DONE},
    "AU-4.5": {"fn": lambda **kw: retention.policies(), "status": DONE},
    # ---- CR 凭证与环境 ----
    "CR-1.1": {"fn": lambda **kw: credentials.parse_csr(kw["csr"]), "status": DONE},
    "CR-1.2": {"fn": credentials.issue, "status": DONE},
    "CR-1.3": {"fn": lambda **kw: credentials.expiring(kw.get("days", 30)), "status": DONE},
    "CR-1.4": {"fn": credentials.issue, "status": PARTIAL, "note": "并行期已支持，旧证书自动停用时点待定"},
    "CR-1.5": {"fn": credentials.revoke, "status": DONE},
    "CR-1.6": {"fn": lambda **kw: credentials.active(kw["tenant_id"], kw["env"]), "status": DONE},
    "CR-2.1": {"fn": credentials.request_ip, "status": DONE},
    "CR-2.2": {"fn": lambda **kw: credentials.env_status(kw["tenant_id"]), "status": DONE},
    "CR-2.3": {"fn": lambda **kw: credentials.env_status(kw["tenant_id"]), "status": PARTIAL,
               "note": "配额已建模，实时连接数需网关上报"},
    # ---- AD 服务与 ICD 版本 ----
    "AD-1.1": {"fn": lambda **kw: catalog_svc.services(), "status": DONE},
    "AD-1.2": {"fn": icd.bind, "status": DONE},
    "AD-2.1": {"fn": icd.upload, "status": DONE},
    "AD-2.2": {"fn": icd.set_state, "status": DONE},
    "AD-2.3": {"fn": icd.bind, "status": DONE},
    "AD-2.4": {"fn": lambda **kw: icd.icds(), "status": DONE},
    "AD-2.5": {"fn": icd.ack, "status": DONE},
    # ---- DT 联调 ----
    "DT-1.2": {"fn": sandbox.inject, "status": DONE},
    "DT-1.4": {"fn": lambda **kw: sandbox.runs(kw.get("tenant_id")), "status": DONE},
    "DT-2.1": {"fn": debug.diagnose, "status": DONE},
    "DT-2.3": {"fn": debug.diagnose, "status": PARTIAL, "note": "traceId 取自审计链，逐条消息追踪待网关接入"},
    "DT-3.1": {"fn": lambda **kw: sandbox.cases(kw.get("phase")), "status": DONE},
    "DT-3.2": {"fn": sandbox.record, "status": DONE},
    "DT-3.3": {"fn": sandbox.record, "status": DONE},
    "DT-3.4": {"fn": lambda **kw: sandbox.report(kw["tenant_id"], kw.get("phase", "sandbox")), "status": DONE},
    # ---- OP-6 值班与应急 ----
    "OP-6.1": {"fn": lambda **kw: duty.roster(), "status": DONE},
    "OP-6.2": {"fn": duty.act, "status": DONE},
    "OP-6.3": {"fn": duty.notify, "status": DONE},
    "OP-6.4": {"fn": duty.close, "status": DONE},
    # ---- AU 审计与安全 ----
    "AU-1.1": {"fn": db.audit, "status": DONE},
    "AU-1.2": {"fn": lambda **kw: db.audit_verify(), "status": DONE},
    "AU-2.1": {"fn": lambda **kw: db.q("SELECT * FROM audit_log ORDER BY seq DESC LIMIT 100"), "status": DONE},
    "AU-3.1": {"fn": lambda **kw: service.set_gate(kw["actor"], kw["reviewer"], kw["state"]),
               "status": PARTIAL, "note": "双人复核已覆盖门禁；其余高风险操作待接入"},
}


def _evaluate(kw):
    from . import rules
    sub = service.get_subscription(kw["sub_id"])
    return rules.evaluate(sub, sub["intersections"], kw.get("target_env"))

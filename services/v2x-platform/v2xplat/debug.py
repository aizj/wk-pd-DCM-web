"""DT-2 订阅调试器：“为什么没收到”五项判定。

把散落在门禁、授权、暂停、场景资格、证书与 ICD 里的判定汇总成一次可解释的诊断，
每一条都给出规则编号与下一步动作，避免车企与平台互相甩锅。
"""
from . import db, rules, scenes, ops_center, credentials, icd, service

CHECKS = ("订阅与环境", "授权与门禁", "路口可交付", "场景已启用", "接入与证书")


def _row(name, ok, detail, rule=None, action=None):
    return {"check": name, "ok": bool(ok), "detail": detail, "rule": rule, "action": action}


def diagnose(sub_id: str, intersection_id: str = None, scene_code: str = "SPAT") -> dict:
    """五项判定。intersection_id 为空时取订阅范围内第一个路口。"""
    s = service.get_subscription(sub_id)
    ints = s["intersections"]
    iid = intersection_id or (ints[0] if ints else None)
    i = db.q1("SELECT * FROM intersection WHERE id=?", iid) if iid else None
    out = []

    # 1 订阅与环境
    live = s["state"] in ("ACTIVE", "PREPROD", "SANDBOX")
    out.append(_row("订阅与环境", live,
                    f"订阅状态 {s['state']}，环境 {s['env']}，版本 v{s['version']}",
                    None if live else "SB-4",
                    None if live else "订阅未处于可交付状态，请先完成审核与迁移"))

    # 2 授权与门禁（R-00 / R-01 / R-03）
    fs = rules.check_r00(s, s["env"]) + rules.check_r01(s, ints) + rules.check_r03(s)
    blockers = [f for f in fs if f.level == rules.BLOCK]
    out.append(_row("授权与门禁", not blockers,
                    "；".join(f.message for f in fs) or "授权路径已确认，订阅范围在白名单内",
                    blockers[0].rule if blockers else None,
                    "联系平台运营确认授权路径或收缩订阅范围" if blockers else None))

    # 3 路口可交付（R-21 / OP-3）
    if not i:
        out.append(_row("路口可交付", False, "订阅范围内没有路口", "R-01", "先在订阅编辑器中添加路口"))
    else:
        susp = ops_center.is_suspended(iid)
        pub = bool(i["published"])
        ok = pub and not susp
        out.append(_row("路口可交付", ok,
                        f"{iid} {i['name']}：{'已发布' if pub else '未发布'}，质量 {i['quality']}"
                        + ("，当前处于维护状态" if susp else ""),
                        None if ok else ("OP-3" if susp else "R-21"),
                        None if ok else ("该路口维护中，恢复后按下一灯周期边界自动恢复交付"
                                         if susp else "该路口尚未发布，等待路侧验收")))

    # 4 场景已启用与资格（R-05 / R-21）。只报本项自己的原因，路口级原因留给第 3 项，避免重复归因。
    if i:
        sc = db.q1("SELECT * FROM scene WHERE code=?", scene_code)
        if not sc:
            out.append(_row("场景已启用", False, f"未知场景 {scene_code}", "SC-1", "在服务目录中确认场景编码"))
        else:
            en = scenes.enabled_at(scene_code, i)
            quality_ok = scenes.QUALITY_ORDER[i["quality"]] >= scenes.QUALITY_ORDER[sc["quality_req"]]
            cfg = db.q1("SELECT * FROM sub_scene WHERE sub_id=? AND scene_code=?", sub_id, scene_code)
            sub_on = bool(cfg["enabled"]) if cfg else True
            ok = en and quality_ok and sub_on
            why, rule, action = [], None, None
            if not en:
                why.append("平台未在该路口启用该场景")
                rule, action = "R-21", "在“场景策略与下发”中按全市、行政区、走廊或路口启用"
            if not quality_ok:
                why.append(f"路口质量 {i['quality']} 未达 {scene_code} 要求的 {sc['quality_req']} 级")
                rule, action = "R-05", "资格随质量实时计算，质量恢复后自动重新可达"
            if not sub_on:
                why.append("本订阅已自行关闭该场景")
                rule, action = "SC-5", "在“场景订阅与预警配置”中重新开启"
            out.append(_row("场景已启用", ok,
                            "；".join(why) or f"{scene_code} 在该路口已启用，质量门槛 {sc['quality_req']} 级可达",
                            rule, action))

    # 5 接入与证书（R-09 / R-16）
    cert = credentials.active(s["tenant_id"], s["env"])
    doc = icd.icd_for(s["service_code"])
    icd_ok = bool(doc) and (doc["state"] == "FROZEN" or s["env"] == "sandbox")
    ok = bool(cert) and icd_ok
    detail = (f"证书 {cert['id']}（剩余 {cert['days_left']} 天）" if cert else f"{s['env']} 环境没有有效证书")
    detail += f"；ICD {doc['id']} {doc['state']}" if doc else "；服务未绑定 ICD"
    out.append(_row("接入与证书", ok, detail,
                    None if ok else ("R-09" if not cert else "R-16"),
                    None if ok else ("在“凭证与环境”签发或轮换证书" if not cert else "等待 ICD 冻结后再迁移")))

    first = next((r for r in out if not r["ok"]), None)
    return {"sub_id": sub_id, "intersection_id": iid, "scene": scene_code, "checks": out,
            "verdict": "可以收到" if not first else f"收不到：{first['check']}未通过",
            "blocking_rule": first["rule"] if first else None,
            "trace_id": db.q1("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1")["hash"][:16]
            if db.q1("SELECT 1 FROM audit_log LIMIT 1") else None}

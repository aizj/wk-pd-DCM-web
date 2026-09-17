#!/usr/bin/env python3
"""入口：init / seed / serve / demo"""
import sys
from v2xplat import api, db, seed, service, catalog_svc, scenes, icd, credentials as cr, retention


def demo():
    """按默认分支（门禁未确认）跑一遍：
    ① 超授权范围的订阅在提交时就被 R-01 挡住；
    ② 合规订阅能进沙箱，但进不了生产（R-00）；
    ③ 门禁确认后仍被 R-09 挡住，补齐证书与环境开通才放行；④ 审计链可验证。"""
    db.init(reset=True)
    seed.run()
    catalog_svc.seed(); scenes.seed(); icd.seed(); retention.seed()
    ints = [r["id"] for r in db.q("SELECT id FROM intersection WHERE published=1 ORDER BY id LIMIT 12")]
    gid = service.create_grant("ops.wang", "济公交管〔2026〕18 号", "济南市公安局交警支队",
                               "数据上车信息服务", "灯态,剩余时间,控制模式,管控事件",
                               "2026-10-01", "2027-09-30", ints[:10])
    print(f"授权 {gid}：白名单 10 个路口")

    over = service.create_subscription("oem.li", "OEM01", "V2X.SPAT", gid, ints, "2027-12-31")
    p = service.preview(over["id"])
    print(f"① 超范围订阅 {over['id']}：请求 {p['requested']}，可交付 {p['deliverable']}，"
          f"被拦规则 {[f['rule'] for f in p['findings'] if f['level']=='BLOCK']}")
    try:
        service.transition("ops.wang", over["id"], "SANDBOX")
    except service.Denied as e:
        print(f"   提交被拒：{e.findings[0]['message']}")

    sub = service.create_subscription("oem.li", "OEM01", "V2X.SPAT", gid, ints[:10], "2027-12-31")
    service.transition("ops.wang", sub["id"], "SANDBOX")
    print(f"② 合规订阅 {sub['id']} → SANDBOX")
    try:
        service.transition("ops.wang", sub["id"], "ACTIVE")
    except service.Denied as e:
        blk = [f for f in e.findings if f["level"] == "BLOCK"]
        print(f"   → ACTIVE 被拒：{blk[0]['rule']} {blk[0]['message']}")

    service.set_gate("ops.wang", "sec.zhao", "OPERATOR_AUTHORIZED", owner_doc_no="济数据局复〔2026〕7 号")
    print(f"③ 门禁置为 {service.get_gate()['state']}，清单通过：{service.gate_checklist('OEM01')['passed']}")
    try:
        service.transition("ops.wang", sub["id"], "ACTIVE")
    except service.Denied as e:
        blk = [f for f in e.findings if f["level"] == "BLOCK"]
        print(f"   仍被拒：{blk[0]['rule']} {blk[0]['message']}")

    csr = ("-----BEGIN CERTIFICATE REQUEST-----\nCN=oem01.v2x.jinan\n" + "A" * 200
           + "\n-----END CERTIFICATE REQUEST-----")
    for env in ("sandbox", "prod"):
        cr.issue("ops.wang", "OEM01", env, csr)
    ipr = cr.request_ip("oem.li", "OEM01", "prod", "203.0.113.8/32", "生产出口")
    cr.approve_ip("ops.wang", ipr["id"])
    cr.open_env("ops.wang", "OEM01", "prod")
    print("④ 已签发沙箱与生产证书、审批出口 IP、开通生产环境")
    print(f"   → {service.transition('ops.wang', sub['id'], 'ACTIVE')['state']}（env=prod）")
    print(f"⑤ 审计 {db.q1('SELECT COUNT(*) c FROM audit_log')['c']} 条，链校验：{db.audit_verify()}")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd == "init":
        db.init(reset="--reset" in sys.argv)
        print("db ready")
    elif cmd == "seed":
        db.init()
        seed.run()
    elif cmd == "demo":
        demo()
    else:
        api.serve(int(sys.argv[2]) if len(sys.argv) > 2 else 8787)

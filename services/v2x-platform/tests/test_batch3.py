"""第三批模块单元测试：证书与环境、ICD 冻结、订阅诊断、应急处置、故障注入与准出。"""
import unittest

from v2xplat import (db, seed, credentials as cr, icd, debug, duty, sandbox,
                     catalog_svc, scenes, service, rules, ops_center)

CSR = ("-----BEGIN CERTIFICATE REQUEST-----\nCN=oem01.v2x.jinan\n" + "A" * 200
       + "\n-----END CERTIFICATE REQUEST-----")


class Batch3(unittest.TestCase):
    def setUp(self):
        db.init(reset=True)
        seed.run()
        catalog_svc.seed()
        scenes.seed()
        icd.seed()
        sandbox.seed()
        ints = [r["id"] for r in db.q("SELECT id FROM intersection WHERE published=1 ORDER BY id LIMIT 10")]
        self.gid = service.create_grant("ops", "济公交管〔2026〕18 号", "交警支队", "数据上车信息服务",
                                        "灯态", "2026-10-01", "2027-09-30", ints)
        self.sub = service.create_subscription("oem", "OEM01", "V2X.SPAT", self.gid, ints, "2027-09-30")
        self.iid = ints[0]
        service.set_gate("ops", "sec", "OPERATOR_AUTHORIZED", owner_doc_no="济数据局复〔2026〕7 号")

    # ---- CR-1.1 CSR 校验 ----
    def test_csr_validation(self):
        with self.assertRaises(cr.CertError):
            cr.parse_csr("not a csr")
        with self.assertRaises(cr.CertError):
            cr.parse_csr("-----BEGIN CERTIFICATE REQUEST-----\nAAA\n-----END CERTIFICATE REQUEST-----")
        self.assertEqual(cr.parse_csr(CSR)["cn"], "oem01.v2x.jinan")

    # ---- CR-1.5 吊销后立即失效 ----
    def test_revoke_invalidates(self):
        c = cr.issue("ops", "OEM01", "prod", CSR)
        self.assertTrue(cr.active("OEM01", "prod"))
        cr.revoke("sec", c["id"], "密钥泄露")
        self.assertIsNone(cr.active("OEM01", "prod"))

    # ---- CR-1.4 轮换并行期：新旧证书都可用 ----
    def test_rotation_parallel(self):
        old = cr.issue("ops", "OEM01", "sandbox", CSR)
        cr.issue("ops", "OEM01", "sandbox", CSR, replaces=old["id"])
        states = {c["id"]: c["state"] for c in cr.certs("OEM01")}
        self.assertEqual(states[old["id"]], "ROTATING", "旧证书应进入轮换并行期而不是立即失效")
        self.assertIsNotNone(cr.active("OEM01", "sandbox"))

    # ---- CR-2.1 双人复核 ----
    def test_ip_needs_second_person(self):
        r = cr.request_ip("oem.dev", "OEM01", "prod", "203.0.113.8/32", "生产出口")
        with self.assertRaises(cr.CertError):
            cr.approve_ip("oem.dev", r["id"])
        self.assertEqual(cr.approve_ip("ops.admin", r["id"])["state"], "ACTIVE")
        with self.assertRaises(cr.CertError):
            cr.request_ip("oem.dev", "OEM01", "prod", "不是IP", "x")

    # ---- R-09：无证书 / 环境未开通不得进生产 ----
    def test_r09_blocks_production(self):
        with self.assertRaises(service.Denied) as cm:
            service.transition("ops", self.sub["id"], "ACTIVE")
        self.assertIn("R-09", [f["rule"] for f in cm.exception.findings])
        cr.issue("ops", "OEM01", "prod", CSR)
        r = cr.request_ip("oem.dev", "OEM01", "prod", "203.0.113.8/32", "生产出口")
        cr.approve_ip("ops.admin", r["id"])
        cr.open_env("ops", "OEM01", "prod")
        self.assertEqual(service.transition("ops", self.sub["id"], "ACTIVE")["state"], "ACTIVE")

    def test_open_prod_env_requires_cert(self):
        with self.assertRaises(cr.CertError) as cm:
            cr.open_env("ops", "OEM01", "prod")
        self.assertEqual(cm.exception.rule, "R-09")

    # ---- AD-2.2 / R-16：ICD 冻结 ----
    def test_icd_state_machine(self):
        with self.assertRaises(icd.IcdError):
            icd.set_state("arch", "ICD-1.0", "REVIEW")           # 冻结后不可回退
        n = icd.upload("arch", "9.0", "ICD V9.0", "OpenAPI", "icd/v9/openapi.yaml", "重构")
        icd.set_state("arch", n["id"], "REVIEW")
        with self.assertRaises(icd.IcdError) as cm:
            icd.set_state("arch", n["id"], "FROZEN")             # 缺兼容说明
        self.assertEqual(cm.exception.rule, "AD-2.4")
        self.assertEqual(icd.set_state("arch", n["id"], "FROZEN", "不兼容：字段重命名")["state"], "FROZEN")
        with self.assertRaises(icd.IcdError):
            icd.upload("arch", "9.0", "重复", "OpenAPI", "x")

    def test_r16_blocks_preprod_on_unfrozen_icd(self):
        with self.assertRaises(icd.IcdError) as cm:
            icd.bind("arch", "V2X.EVENT.ROADWORK", "2.0", "ICD-1.1", "RELEASED")   # ICD-1.1 为 REVIEW
        self.assertEqual(cm.exception.rule, "R-16")
        # 用一个尚未进入服务目录的新服务，避免被种子里 1.0 的已发布绑定覆盖
        icd.bind("arch", "V2X.TRIAL", "2.0", "ICD-1.1", "PREVIEW")
        sub = {"service_code": "V2X.TRIAL"}
        self.assertEqual([f.rule for f in rules.check_r16(sub, "preprod")], ["R-16"])
        self.assertEqual(rules.check_r16(sub, "sandbox")[0].level, rules.WARN,
                         "沙箱可用评审中版本，但须标注")

    # ---- DT-2 五项判定 ----
    def test_diagnose_attributes_correctly(self):
        cr.issue("ops", "OEM01", "sandbox", CSR)
        service.transition("ops", self.sub["id"], "SANDBOX")
        d = debug.diagnose(self.sub["id"], self.iid)
        self.assertEqual(len(d["checks"]), 5)
        self.assertEqual(d["verdict"], "可以收到", d["checks"])
        # 暂停只归因到“路口可交付”，不牵连场景项
        ops_center.issue_suspend("gov", "intersection", self.iid, "SPECIAL_DUTY")
        d2 = debug.diagnose(self.sub["id"], self.iid)
        by = {c["check"]: c for c in d2["checks"]}
        self.assertFalse(by["路口可交付"]["ok"])
        self.assertEqual(by["路口可交付"]["rule"], "OP-3")
        self.assertTrue(by["场景已启用"]["ok"], "路口暂停不应误报为场景或质量问题")

    def test_diagnose_quality_gate(self):
        cr.issue("ops", "OEM01", "sandbox", CSR)
        service.transition("ops", self.sub["id"], "SANDBOX")
        db.x("UPDATE intersection SET quality='B' WHERE id=?", self.iid)
        c = {x["check"]: x for x in debug.diagnose(self.sub["id"], self.iid, "GLOSA")["checks"]}["场景已启用"]
        self.assertFalse(c["ok"])
        self.assertEqual(c["rule"], "R-05")
        self.assertIn("未达", c["detail"])

    # ---- OP-6 应急 ----
    def test_incident_flow(self):
        inc = duty.open_incident("duty", "P1", "路侧断流", "光缆故障")
        self.assertTrue(inc["notify_due"] > inc["opened_at"])
        after = duty.act("duty", inc["id"], "SUSPEND", self.iid)
        self.assertEqual(after["state"], "HANDLING")
        self.assertTrue(ops_center.is_suspended(self.iid), "处置动作须落到真实平台状态")
        self.assertTrue(duty.notify("duty", inc["id"], "短信", "已暂停")["on_time"])
        with self.assertRaises(ValueError):
            duty.close("duty", inc["id"], "   ")
        self.assertEqual(duty.close("duty", inc["id"], "根因：光缆挖断；改进：双路由")["state"], "CLOSED")

    # ---- DT-1 故障注入可恢复 ----
    def test_fault_injection_round_trip(self):
        f = sandbox.inject("oem", "OEM01", "QUALITY_DEGRADE", self.iid)
        self.assertEqual(db.q1("SELECT quality FROM intersection WHERE id=?", self.iid)["quality"], "C")
        sandbox.finish("oem", f["id"])
        self.assertEqual(db.q1("SELECT quality FROM intersection WHERE id=?", self.iid)["quality"], "A",
                         "结束注入须恢复现场")
        self.assertEqual(db.q1("SELECT state FROM fault_run WHERE id=?", f["id"])["state"], "FINISHED")

    def test_stream_break_recovers_publish(self):
        f = sandbox.inject("oem", "OEM01", "STREAM_BREAK", self.iid)
        self.assertEqual(db.q1("SELECT published FROM intersection WHERE id=?", self.iid)["published"], 0)
        sandbox.finish("oem", f["id"])
        self.assertEqual(db.q1("SELECT published FROM intersection WHERE id=?", self.iid)["published"], 1)

    # ---- DT-3 准出 ----
    def test_exit_report(self):
        r = sandbox.report("OEM01")
        self.assertFalse(r["passed"])
        self.assertTrue(r["blocking_cases"])
        for c in sandbox.cases("sandbox"):
            sandbox.record("oem", "OEM01", c["id"], "PASS", "ICD-1.0")
        r2 = sandbox.report("OEM01")
        self.assertTrue(r2["passed"])
        self.assertEqual(r2["icd_used"], ["ICD-1.0"])

    def test_exit_report_blocked_by_unfrozen_icd(self):
        for c in sandbox.cases("sandbox"):
            sandbox.record("oem", "OEM01", c["id"], "PASS", "ICD-1.1")   # REVIEW 状态
        r = sandbox.report("OEM01")
        self.assertFalse(r["passed"])
        self.assertFalse(r["icd_ok"])

    def test_failed_case_needs_defect_level(self):
        with self.assertRaises(ValueError):
            sandbox.record("oem", "OEM01", "TC-01", "FAIL")
        self.assertEqual(sandbox.record("oem", "OEM01", "TC-01", "FAIL", "ICD-1.0", "D2")["defect_level"], "D2")


if __name__ == "__main__":
    unittest.main()

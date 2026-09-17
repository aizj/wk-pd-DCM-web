"""P0-S4 切片测试：门禁、白名单、有效期、审计链、状态迁移。"""
import os, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["V2X_DB"] = os.path.join(tempfile.mkdtemp(), "test.db")

from v2xplat import db, seed, service, rules, icd, catalog_svc  # noqa: E402
from v2xplat import credentials as cr  # noqa: E402

CSR = ("-----BEGIN CERTIFICATE REQUEST-----\nCN=oem01.v2x.jinan\n" + "A" * 200
       + "\n-----END CERTIFICATE REQUEST-----")


def ready_for_prod(tenant="OEM01"):
    """R-09 前置：生产证书 + 已审批出口 IP + 环境开通。"""
    cr.issue("ops", tenant, "prod", CSR)
    r = cr.request_ip("oem.dev", tenant, "prod", "203.0.113.8/32", "生产出口")
    cr.approve_ip("ops.admin", r["id"])
    cr.open_env("ops", tenant, "prod")


class Base(unittest.TestCase):
    def setUp(self):
        db.init(reset=True)
        seed.run()
        catalog_svc.seed()
        icd.seed()
        self.ints = [r["id"] for r in db.q("SELECT id FROM intersection WHERE published=1 ORDER BY id LIMIT 12")]
        self.unpub = db.q1("SELECT id FROM intersection WHERE published=0")["id"]
        self.gid = service.create_grant("ops", "DOC-1", "交警支队", "数据上车", "灯态",
                                        "2026-10-01", "2027-09-30", self.ints[:10])

    def sub(self, ints=None, tenant="OEM01", valid_until=None):
        return service.create_subscription("oem", tenant, "V2X.SPAT", self.gid,
                                           ints if ints is not None else self.ints[:10], valid_until)


class TestGate(Base):
    def test_default_branch_blocks_production(self):
        """默认分支：授权路径未确认时，车企订阅进不了生产（R-00）。"""
        s = self.sub()
        service.transition("ops", s["id"], "SANDBOX")
        with self.assertRaises(service.Denied) as cm:
            service.transition("ops", s["id"], "ACTIVE")
        self.assertIn("R-00", [f["rule"] for f in cm.exception.findings])
        self.assertEqual(service.get_subscription(s["id"])["state"], "SANDBOX")

    def test_denial_is_audited(self):
        s = self.sub()
        with self.assertRaises(service.Denied):
            service.transition("ops", s["id"], "ACTIVE")
        actions = [r["action"] for r in db.q("SELECT action FROM audit_log")]
        self.assertIn("SUB_TRANSITION_DENIED", actions)

    def test_gate_confirmed_allows_production(self):
        service.set_gate("ops", "sec", "OPERATOR_AUTHORIZED", owner_doc_no="DOC-GATE")
        ready_for_prod()
        s = self.sub()
        service.transition("ops", s["id"], "SANDBOX")
        got = service.transition("ops", s["id"], "ACTIVE")
        self.assertEqual(got["state"], "ACTIVE")
        self.assertEqual(got["env"], "prod")

    def test_partner_without_agreement_blocked(self):
        service.set_gate("ops", "sec", "PARTNER_AUTHORIZED", partner="某授权运营机构")
        s = self.sub()
        with self.assertRaises(service.Denied):
            service.transition("ops", s["id"], "ACTIVE")

    def test_gate_requires_two_persons(self):
        with self.assertRaises(ValueError):
            service.set_gate("ops", "ops", "OPERATOR_AUTHORIZED")

    def test_test_fleet_can_enter_preprod(self):
        """示范车按测试数据使用协议可进预生产，量产车企不行。"""
        s = self.sub(tenant="FLEET01")
        service.transition("ops", s["id"], "SANDBOX")
        self.assertEqual(service.transition("ops", s["id"], "PREPROD")["state"], "PREPROD")
        s2 = self.sub(tenant="OEM01")
        service.transition("ops", s2["id"], "SANDBOX")
        with self.assertRaises(service.Denied):
            service.transition("ops", s2["id"], "PREPROD")

    def test_checklist_shows_blocker(self):
        cl = service.gate_checklist("OEM01")
        self.assertFalse(cl["passed"])
        self.assertEqual(cl["items"][0]["owner"], "业主会同市大数据局")


class TestScope(Base):
    def test_outside_whitelist_blocked(self):
        s = self.sub(ints=self.ints[:12])  # 10 在白名单内，2 在外
        fs = rules.evaluate(s, s["intersections"], "sandbox")
        r01 = [f for f in fs if f.rule == "R-01"]
        self.assertTrue(r01 and r01[0].level == rules.BLOCK)
        self.assertEqual(len(r01[0].objects), 2)

    def test_unpublished_blocked(self):
        service.set_whitelist("ops", self.gid, self.ints[:10] + [self.unpub])
        s = self.sub(ints=[self.unpub])
        fs = rules.evaluate(s, s["intersections"], "sandbox")
        self.assertIn("R-21", [f.rule for f in fs])

    def test_preview_counts_deliverable(self):
        s = self.sub(ints=self.ints[:12])
        p = service.preview(s["id"])
        self.assertEqual(p["requested"], 12)
        self.assertEqual(p["deliverable"], 10)
        self.assertTrue(p["blocked"])
        self.assertTrue(sum(p["by_quality"].values()) == 10)

    def test_valid_until_beyond_grant_warns(self):
        s = self.sub(valid_until="2030-01-01")
        fs = rules.evaluate(s, s["intersections"], "sandbox")
        self.assertIn("R-03", [f.rule for f in fs])
        self.assertFalse(rules.blocked(fs))

    def test_whitelist_version_and_diff(self):
        diff = service.set_whitelist("ops", self.gid, self.ints[:8])
        self.assertEqual(diff["version"], 2)
        self.assertEqual(len(diff["removed"]), 2)

    def test_unknown_intersection_rejected(self):
        with self.assertRaises(ValueError):
            service.set_whitelist("ops", self.gid, ["370102-9999"])

    def test_shrink_impact_lists_subscriptions(self):
        s = self.sub(ints=self.ints[:10])
        impact = service.shrink_impact(self.gid, self.ints[:6])
        self.assertEqual(len(impact["removed"]), 4)
        self.assertEqual(impact["affected_subscriptions"][0]["id"], s["id"])


class TestAudit(Base):
    def test_chain_verifies(self):
        self.sub()
        self.assertTrue(db.audit_verify())

    def test_tamper_detected(self):
        self.sub()
        db.x("UPDATE audit_log SET detail='{\"tampered\":true}' WHERE seq=1")
        self.assertFalse(db.audit_verify())


if __name__ == "__main__":
    unittest.main(verbosity=2)


class TestValidityTruncation(Base):
    def test_valid_until_truncated_on_transition(self):
        """R-03 承诺“截断至授权到期日”，迁移时必须真的截断并留痕。"""
        s = self.sub(valid_until="2030-01-01")
        service.transition("ops", s["id"], "SANDBOX")
        self.assertEqual(service.get_subscription(s["id"])["valid_until"], "2027-09-30")
        self.assertIn("SUB_VALIDITY_TRUNCATED", [r["action"] for r in db.q("SELECT action FROM audit_log")])

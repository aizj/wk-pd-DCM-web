"""第二批模块单元测试：服务目录、画像、场景策略、暂停、工单、回执、留存。"""
import unittest

from v2xplat import (db, seed, scenes, ops_center, receipts, retention,
                     catalog_svc, profiles, rules)

I1, I2 = "370102-0001", "370102-0002"


class Batch2(unittest.TestCase):
    def setUp(self):
        db.init(reset=True)
        seed.run()
        catalog_svc.seed()
        scenes.seed()
        retention.seed()

    def _i(self, iid):
        return db.q1("SELECT * FROM intersection WHERE id=?", iid)

    # ---- SC-2：场景策略按粒度优先级合并 ----
    def test_scene_priority_merge(self):
        self.assertFalse(scenes.enabled_at("GREEN_START", self._i(I1)),
                         "绿灯起步提醒默认全市关闭（设计文档 13.3）")
        self.assertTrue(scenes.enabled_at("GLOSA", self._i(I1)), "其余场景默认全市开启")
        scenes.set_policy("ops", "GLOSA", "intersection", I1, "DISABLE")
        self.assertFalse(scenes.enabled_at("GLOSA", self._i(I1)), "路口级须覆盖全市级")
        self.assertTrue(scenes.enabled_at("GLOSA", self._i(I2)), "同级其他路口不受影响")

    # ---- R-17：参数越界 ----
    def test_param_out_of_range(self):
        with self.assertRaises(scenes.ParamError) as cm:
            scenes.set_param("ops", "SPAT", "age_limit_s", "9")
        self.assertEqual(cm.exception.rule, "R-17")

    # ---- R-18：只可收紧 ----
    def test_param_only_tighten(self):
        with self.assertRaises(scenes.ParamError) as cm:
            scenes.set_param("ops", "ABNORMAL_STOP", "confidence", "87")  # 置信度下限调低即放宽
        self.assertEqual(cm.exception.rule, "R-18")
        got = scenes.set_param("ops", "ABNORMAL_STOP", "confidence", "93")  # 调高即收紧
        self.assertEqual(float(got["value"]), 93)

    # ---- OP-3：暂停联动可交付范围与规则拦截 ----
    def test_suspend_blocks_delivery(self):
        self.assertIn(I1, scenes.deliverable("SPAT", [I1, I2]))
        sid = ops_center.issue_suspend("gov", "intersection", I1, "SPECIAL_DUTY", "演练")["id"]
        self.assertTrue(ops_center.is_suspended(I1))
        self.assertNotIn(I1, scenes.deliverable("SPAT", [I1, I2]), "暂停路口不得交付")
        f = rules.check_suspended([I1])
        self.assertEqual(f[0].rule, "OP-3")
        self.assertIn("维护", f[0].message, "对外原因码须统一为维护")
        ops_center.lift_suspend("gov", sid)
        self.assertFalse(ops_center.is_suspended(I1))

    def test_suspend_scope_cascades(self):
        d = self._i(I1)["district"]
        ops_center.issue_suspend("gov", "district", d, "SECURITY")
        self.assertTrue(ops_center.is_suspended(I1), "区级暂停须级联到辖内路口")

    # ---- EV-1：回执禁止字段整批拒收 ----
    def test_receipt_forbidden_fields(self):
        ok = receipts.ingest("oem", "SUB-T", "2026091610",
                             [{"intersection_id": I1, "status": "PRESENTED", "cnt": 100}])
        self.assertEqual(ok["presented"], 100)
        with self.assertRaises(receipts.Rejected):
            receipts.ingest("oem", "SUB-T", "2026091611",
                            [{"intersection_id": I1, "status": "PRESENTED", "cnt": 5, "vin": "LSGxxxx"}])
        self.assertEqual(receipts.stats("SUB-T")["presented"], 100, "被拒批次不得落库")

    def test_receipt_unknown_status(self):
        with self.assertRaises(receipts.Rejected):
            receipts.ingest("oem", "SUB-T", "2026091610",
                            [{"intersection_id": I1, "status": "OK", "cnt": 1}])

    def test_receipt_anomaly_opens_ticket(self):
        before = len(ops_center.tickets())
        r = receipts.anomaly("oem", "SUB-T", "SUSPECT_D1", "疑似红灯读秒错误")
        self.assertEqual(len(ops_center.tickets()), before + 1, "异常回执须自动建工单")
        t = db.q1("SELECT * FROM ticket WHERE id=?", r["ticket"])
        self.assertEqual(t["priority"], "D1", "疑似 D1 须按最高优先级建单")

    # ---- NT-4：工单 SLA 与状态流转 ----
    def test_ticket_flow_and_sla(self):
        t = ops_center.create_ticket("ops", "QUALITY", "路口质量降级", "运维一组", "D1", I1)
        self.assertEqual(t["sla_hours"], ops_center.SLA["D1"])
        self.assertEqual(ops_center.dispatch("ops", t["id"])["state"], "DISPATCHED")
        self.assertEqual(ops_center.close_ticket("ops", t["id"], "已复位")["state"], "CLOSED")

    # ---- AU-4：留存下限与销毁证明 ----
    def test_retention_floor(self):
        with self.assertRaises(ValueError):
            retention.set_policy("ops", "audit_log", 30)
        self.assertEqual(retention.set_policy("ops", "audit_log", 365)["days"], 365)
        cert = retention.purge("ops", "receipt_agg")
        self.assertTrue(cert["cert_no"].startswith("CERT-"))
        self.assertTrue(retention.certificates(), "销毁须留证明")

    # ---- TN-2：画像推导 ----
    def test_profile_derive(self):
        low = profiles.derive({"nav": "NONE", "ota": True})
        self.assertEqual(low["display_tier"], "V4")
        self.assertEqual(low["match_max"], "M1")
        hi = profiles.derive({"nav": "LANE", "hud": "AR", "positioning": "RTK", "ota": True, "pc5": True})
        self.assertEqual(hi["display_tier"], "V1")
        self.assertEqual(hi["match_max"], "M3")
        self.assertEqual(hi["level_max"], "S2")
        self.assertEqual(profiles.derive({"nav": "LANE", "ota": False})["display_tier"], "V6",
                         "不支持 OTA 的车型须落到 V6")

    # ---- SC-5：租户只能收紧 ----
    def test_sub_scene_cannot_enable_unavailable(self):
        with self.assertRaises(scenes.ParamError) as cm:
            scenes.set_sub_scene("oem", "SUB-X", "GLOSA", True)
        self.assertEqual(cm.exception.rule, "R-17")

    # ---- CT-1：服务目录 ----
    def test_service_catalog(self):
        svcs = catalog_svc.services()
        self.assertGreaterEqual(len(svcs), 8)
        self.assertTrue(all(s["code"] and s["level"] for s in svcs))


if __name__ == "__main__":
    unittest.main()

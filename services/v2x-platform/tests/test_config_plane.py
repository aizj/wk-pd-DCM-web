"""配置面测试：不可变、全有或全无、回滚、配置中心不可用时仍按旧快照运行。"""
import os, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ["V2X_DB"] = os.path.join(tempfile.mkdtemp(), "cfg.db")

from v2xplat import db, seed, service, config_plane as cp, icd, catalog_svc  # noqa: E402


class Base(unittest.TestCase):
    def setUp(self):
        db.init(reset=True)
        seed.run()
        catalog_svc.seed()
        icd.seed()
        self.ints = [r["id"] for r in db.q("SELECT id FROM intersection WHERE published=1 ORDER BY id LIMIT 10")]
        self.gid = service.create_grant("ops", "D1", "交警", "上车", "灯态", "2026-10-01", "2027-09-30", self.ints)
        s = service.create_subscription("oem", "OEM01", "V2X.SPAT", self.gid, self.ints)
        service.transition("ops", s["id"], "SANDBOX")
        self.sub_id = s["id"]

    def activate(self):
        snap = cp.build("ops")
        cp.push("ops", snap["id"])
        for r in cp.regions():
            cp.ack(r["id"], snap["id"], True)
        return snap


class TestSnapshot(Base):
    def test_all_regions_ack_activates(self):
        snap = self.activate()
        self.assertEqual(cp.status(snap["id"])["state"], "ACTIVE")
        self.assertEqual(cp.active()["id"], snap["id"])

    def test_one_region_fails_rolls_back_all(self):
        v1 = self.activate()
        v2 = cp.build("ops")
        cp.push("ops", v2["id"])
        cp.ack("RC-QBQ", v2["id"], True)
        cp.ack("RC-ZCQ", v2["id"], False, "哈希校验失败")
        self.assertEqual(cp.status(v2["id"])["state"], "ROLLED_BACK")
        self.assertEqual(cp.active()["id"], v1["id"], "失败后必须回到上一版本")

    def test_offline_region_blocks_activation(self):
        v1 = self.activate()
        cp.set_region_online("RC-ZCQ", False)
        v2 = cp.build("ops")
        cp.push("ops", v2["id"])
        self.assertEqual(cp.status(v2["id"])["failed"], 1)
        cp.ack("RC-QBQ", v2["id"], True)
        self.assertEqual(cp.active()["id"], v1["id"])

    def test_snapshot_is_immutable_and_chained(self):
        v1 = self.activate()
        v2 = cp.build("ops")
        self.assertEqual(v2["prev_id"], v1["id"])
        self.assertNotEqual(v2["hash"], v1["hash"])
        row = db.q1("SELECT content FROM snapshot WHERE id=?", v1["id"])
        self.assertIn(self.sub_id, row["content"])

    def test_manual_rollback_restores_previous(self):
        v1 = self.activate()
        s2 = service.create_subscription("oem", "OEM01", "V2X.EVENT.CONGESTION", self.gid, self.ints)
        service.transition("ops", s2["id"], "SANDBOX")
        v2 = self.activate()
        self.assertEqual(cp.active()["id"], v2["id"])
        out = cp.rollback("ops", v2["id"], why="灰度指标不达标")
        self.assertEqual(out["restored"], v1["id"])
        self.assertEqual(cp.active()["id"], v1["id"])

    def test_content_reflects_gate_and_scope(self):
        import json
        snap = self.activate()
        content = json.loads(db.q1("SELECT content FROM snapshot WHERE id=?", snap["id"])["content"])
        self.assertEqual(content["gate"]["state"], "UNCONFIRMED")
        self.assertEqual(len(content["subscriptions"][0]["intersections"]), 10)

    def test_every_step_is_audited(self):
        snap = self.activate()
        cp.rollback("ops", snap["id"])
        acts = [r["action"] for r in db.q("SELECT action FROM audit_log")]
        for a in ("SNAPSHOT_BUILD", "SNAPSHOT_PUSH", "SNAPSHOT_ACK", "SNAPSHOT_ACTIVATE", "SNAPSHOT_ROLLBACK"):
            self.assertIn(a, acts)
        self.assertTrue(db.audit_verify())


if __name__ == "__main__":
    unittest.main(verbosity=2)

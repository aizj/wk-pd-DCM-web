"""功能骨架测试：骨架必须与设计文档的功能结构一一对应。"""
import json, os, sys, tempfile, unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault("V2X_DB", os.path.join(tempfile.mkdtemp(), "scaffold.db"))

from v2xplat import registry, impl, base, db  # noqa: E402

CAT = json.load(open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                                  "v2xplat", "catalog.json"), encoding="utf-8"))


class TestScaffold(unittest.TestCase):
    def test_counts_match_catalog(self):
        s = registry.stats()
        self.assertEqual(s["subsystems"], len(CAT["subsystems"]))
        self.assertEqual(s["modules"], len(CAT["modules"]))
        self.assertEqual(s["points"], sum(len(m["points"]) for m in CAT["modules"]))

    def test_every_module_has_class(self):
        for m in CAT["modules"]:
            self.assertIsNotNone(registry.module(m["id"]), m["id"])

    def test_every_point_has_method(self):
        missing = []
        for m in CAT["modules"]:
            have = {p["id"] for p in registry.module(m["id"]).points()}
            missing += [p["id"] for p in m["points"] if p["id"] not in have]
        self.assertEqual(missing, [])

    def test_point_ids_unique(self):
        ids = [p["id"] for m in CAT["modules"] for p in m["points"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_registered_impl_points_exist(self):
        known = {p["id"] for m in CAT["modules"] for p in m["points"]}
        self.assertEqual([k for k in impl.REGISTRY if k not in known], [])

    def test_todo_point_raises_with_plan(self):
        with self.assertRaises(base.NotImplementedYet) as cm:
            registry.call("DP-1.1")
        self.assertIn("P2", str(cm.exception))

    def test_implemented_point_callable(self):
        db.init(reset=True)
        self.assertTrue(registry.call("AU-1.2"))

    def test_phase_values_valid(self):
        for m in CAT["modules"]:
            self.assertTrue(m["phase"].startswith(("P0", "P1", "P2")), f'{m["id"]}: {m["phase"]}')


if __name__ == "__main__":
    unittest.main(verbosity=2)

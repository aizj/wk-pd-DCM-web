"""功能注册表：把生成的骨架、catalog.json 与实现登记合到一起。"""
import json, os, inspect
from . import base, modules as _mods

CAT = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "catalog.json"), encoding="utf-8"))
_INSTANCES = {}


def _load():
    if _INSTANCES:
        return _INSTANCES
    for name in _mods.__all__:
        mod = getattr(_mods, name)
        for _, cls in inspect.getmembers(mod, inspect.isclass):
            if issubclass(cls, base.Module) and cls is not base.Module:
                _INSTANCES[cls.id] = cls()
    return _INSTANCES


def module(mid: str) -> base.Module:
    return _load()[mid]


def call(point_id: str, **kw):
    """按功能点编号调用，未实现的抛 NotImplementedYet。"""
    mid = point_id.rsplit(".", 1)[0]
    m = module(mid)
    return m.dispatch(point_id, kw)


def tree() -> list:
    """完整功能树 + 实现状态，供控制台“功能地图”使用。"""
    inst = _load()
    out = []
    for sub in CAT["subsystems"]:
        mods = []
        for m in sub["modules"]:
            pts = inst[m["id"]].points() if m["id"] in inst else []
            mods.append({**{k: m[k] for k in ("id", "name", "users", "phase", "req")},
                         "points": pts,
                         "done": sum(1 for p in pts if p["status"] == base.DONE),
                         "partial": sum(1 for p in pts if p["status"] == base.PARTIAL),
                         "total": len(pts)})
        out.append({**{k: sub[k] for k in ("id", "name", "duty", "users", "deploy", "phase")},
                    "modules": mods,
                    "done": sum(x["done"] for x in mods),
                    "partial": sum(x["partial"] for x in mods),
                    "total": sum(x["total"] for x in mods)})
    return out


def stats() -> dict:
    t = tree()
    return {"subsystems": len(t), "modules": sum(len(s["modules"]) for s in t),
            "points": sum(s["total"] for s in t),
            "done": sum(s["done"] for s in t), "partial": sum(s["partial"] for s in t),
            "p0_points": sum(m["total"] for s in t for m in s["modules"] if m["phase"].startswith("P0"))}

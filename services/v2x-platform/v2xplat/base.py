"""功能骨架基类：模块与功能点。

每个功能点有三种状态：
  DONE    已实现，调用会走到 impl.py 登记的实现
  PARTIAL 部分实现（占位，登记时标注）
  TODO    仅有骨架，调用抛 NotImplementedError 并带上文档指引
"""
from typing import Callable, Dict

DONE, PARTIAL, TODO = "DONE", "PARTIAL", "TODO"
_POINTS: Dict[str, dict] = {}


def point(pid: str, desc: str):
    """装饰器：把功能点登记到全局清单，并在调用时转发到实现。"""
    def deco(fn: Callable):
        fn.point_id = pid
        fn.point_desc = desc
        _POINTS[pid] = {"id": pid, "desc": desc, "method": fn.__name__}
        def wrapper(self, **kw):
            return self.dispatch(pid, kw)
        wrapper.point_id = pid
        wrapper.point_desc = desc
        wrapper.__name__ = fn.__name__
        wrapper.__doc__ = fn.__doc__
        return wrapper
    return deco


class NotImplementedYet(NotImplementedError):
    def __init__(self, pid: str, desc: str, phase: str):
        super().__init__(f"{pid} {desc}（计划版本 {phase}，尚未实现）")
        self.point_id = pid


class Module:
    id = ""
    name = ""
    subsystem = ""
    phase = ""
    requirements = ""

    def points(self) -> list:
        out = []
        for attr in dir(type(self)):
            fn = getattr(type(self), attr, None)
            pid = getattr(fn, "point_id", None)
            if pid and pid.startswith(self.id + "."):
                out.append({"id": pid, "desc": fn.point_desc, "method": attr,
                            "status": status_of(pid)})
        return sorted(out, key=lambda p: p["id"])

    def dispatch(self, pid: str, kw: dict):
        from . import impl
        entry = impl.REGISTRY.get(pid)
        if entry and entry.get("fn"):
            return entry["fn"](**kw)
        raise NotImplementedYet(pid, _POINTS.get(pid, {}).get("desc", ""), self.phase)

    def run(self, kw):  # 供生成代码调用，实际分发在 dispatch
        raise NotImplementedYet(self.id, self.name, self.phase)


def status_of(pid: str) -> str:
    from . import impl
    e = impl.REGISTRY.get(pid)
    if not e:
        return TODO
    return e.get("status", DONE)

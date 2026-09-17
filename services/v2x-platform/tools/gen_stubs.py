#!/usr/bin/env python3
"""按 catalog.json 生成功能骨架：每个子系统一个模块文件，每个功能模块一个类，
每个功能点一个方法。已实现的功能点在 v2xplat/impl.py 中登记，生成器不覆盖实现。
重复运行是幂等的：整个 modules/ 目录由本脚本生成。
"""
import json, os, re, shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, "v2xplat", "catalog.json")
OUT = os.path.join(ROOT, "v2xplat", "modules")
HEADER = '"""本文件由 tools/gen_stubs.py 依据 catalog.json 生成，请勿手改。\n实现登记在 v2xplat/impl.py。"""\nfrom ..base import Module, point\n\n\n'


def meth(pid: str) -> str:
    return pid.lower().replace("-", "_").replace(".", "_")


def main() -> None:
    cat = json.load(open(CAT, encoding="utf-8"))
    if os.path.isdir(OUT):
        shutil.rmtree(OUT)
    os.makedirs(OUT)
    names = []
    for sub in cat["subsystems"]:
        sid = sub["id"]
        lines = [HEADER.rstrip("\n"), ""]
        for m in sub["modules"]:
            cls = "M" + m["id"].replace("-", "_")
            lines += [
                f'class {cls}(Module):',
                f'    """{m["id"]} {m["name"]}｜用户：{m["users"]}｜版本：{m["phase"]}｜需求：{m["req"]}"""',
                f'    id = "{m["id"]}"',
                f'    name = "{m["name"]}"',
                f'    subsystem = "{sid}"',
                f'    phase = "{m["phase"]}"',
                f'    requirements = "{m["req"]}"',
                "",
            ]
            for p in m["points"]:
                desc = p["desc"].replace('"', "'")
                lines += [
                    f'    @point("{p["id"]}", "{desc}")',
                    f'    def {meth(p["id"])}(self, **kw):',
                    f'        """{p["id"]} {desc}"""',
                    "        return self.run(kw)",
                    "",
                ]
            lines.append("")
        path = os.path.join(OUT, f"{sid.lower()}.py")
        open(path, "w", encoding="utf-8").write("\n".join(lines).rstrip() + "\n")
        names.append(sid.lower())
    init = ['"""子系统包，由 tools/gen_stubs.py 生成。"""', ""]
    init += [f"from . import {n}  # noqa: F401" for n in sorted(names)]
    init += ["", "__all__ = [" + ", ".join(f'"{n}"' for n in sorted(names)) + "]", ""]
    open(os.path.join(OUT, "__init__.py"), "w", encoding="utf-8").write("\n".join(init))
    n_pts = sum(len(m["points"]) for m in cat["modules"])
    print(f"生成 {len(names)} 个子系统文件，{len(cat['modules'])} 个模块类，{n_pts} 个功能点方法")


if __name__ == "__main__":
    main()

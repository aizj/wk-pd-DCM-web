#!/usr/bin/env python3
"""从设计文档（附录所在的 HTML）解析功能结构，生成 catalog.json。

解析第 17 章“功能结构清单”的两张表：
  L1 子系统总览  -> 子系统编号、名称、职责、用户、部署、起始版本
  L2 模块与功能点 -> 模块编号、名称、功能点列表、用户、版本、需求
这样代码骨架与文档同源，文档改了重跑即可。
"""
import json, re, sys, os, html

TAG = re.compile(r"<[^>]+>")


def text(s: str) -> str:
    return html.unescape(TAG.sub("", s)).replace(" ", " ").strip()


def cells(row: str):
    return [text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", row, re.S)]


def parse(doc: str) -> dict:
    start = doc.index('<section id=' + chr(34) + 'q15' + chr(34) + '>')
    sec = doc[start:]
    sec = sec[:sec.index("</section>")]
    tables = re.findall(r"<table>(.*?)</table>", sec, re.S)
    subs, modules = {}, []
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", tables[0], re.S):
        c = cells(row)
        if len(c) == 6 and re.fullmatch(r"[A-Z]{2}", c[0]):
            subs[c[0]] = {"id": c[0], "name": c[1], "duty": c[2], "users": c[3],
                          "deploy": c[4], "phase": c[5], "modules": []}
    for row in re.findall(r"<tr[^>]*>(.*?)</tr>", tables[-1], re.S):
        if 'class="grp"' in row:
            continue
        c = cells(row)
        if len(c) != 5:
            continue
        m = re.match(r"([A-Z]{2}-\d)\s+(.*)", c[0])
        if not m:
            continue
        mid, mname = m.group(1), m.group(2)
        points = []
        for part in re.split(r"[；;]", c[1]):
            pm = re.match(r"\s*([A-Z]{2}-\d\.\d)\s+(.*)", part.strip())
            if pm:
                points.append({"id": pm.group(1), "desc": pm.group(2).strip()})
        modules.append({"id": mid, "sub": mid.split("-")[0], "name": mname,
                        "users": c[2], "phase": c[3], "req": c[4], "points": points})
    for m in modules:
        if m["sub"] in subs:
            subs[m["sub"]]["modules"].append(m)
    return {"subsystems": list(subs.values()), "modules": modules}


if __name__ == "__main__":
    doc_path = sys.argv[1]
    out = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "v2xplat", "catalog.json")
    cat = parse(open(doc_path, encoding="utf-8").read())
    json.dump(cat, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    n_pts = sum(len(m["points"]) for m in cat["modules"])
    print(f"子系统 {len(cat['subsystems'])}，模块 {len(cat['modules'])}，功能点 {n_pts} -> {out}")

"""示例数据：济南首批候选路口（示意，非真实坐标与编号）。"""
from . import db

DISTRICTS = [("370102", "历下区"), ("370103", "市中区"), ("370104", "槐荫区"), ("370105", "天桥区")]
CORRIDORS = ["经十路", "泺源大街", "北园大街", "旅游路"]


def run() -> None:
    n = 0
    for di, (code, name) in enumerate(DISTRICTS):
        for k in range(1, 8):
            iid = f"{code}-{k:04d}"
            corridor = CORRIDORS[(di + k) % len(CORRIDORS)]
            ctrl = ["FIXED_TIME", "FIXED_TIME", "ACTUATED", "ADAPTIVE"][k % 4]
            quality = {"FIXED_TIME": "A", "ACTUATED": "B", "ADAPTIVE": "B"}[ctrl]
            published = 1 if k <= 5 else 0
            db.x("INSERT OR REPLACE INTO intersection (id,name,district,corridor,road_class,ctrl_mode,published,quality)"
                 " VALUES (?,?,?,?,?,?,?,?)",
                 iid, f"{name}{corridor}{k}号路口", name, corridor, "主干路", ctrl, published,
                 quality if published else "X")
            n += 1
    db.x("INSERT OR REPLACE INTO tenant (id,name,kind,status,created_at) VALUES (?,?,?,?,?)",
         "OEM01", "示例车企 A", "OEM", "ACTIVE", db.now())
    db.x("INSERT OR REPLACE INTO tenant (id,name,kind,status,created_at) VALUES (?,?,?,?,?)",
         "FLEET01", "示范车队", "TEST_FLEET", "ACTIVE", db.now())
    print(f"seeded {n} intersections, 2 tenants")

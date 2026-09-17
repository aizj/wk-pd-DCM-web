"""TN-2 车型能力画像与资格推导（展示档位 V1–V6、匹配上限 M1–M3、服务等级上限）。"""
import uuid
from . import db


def derive(p: dict) -> dict:
    """按总体方案第 07、08 章规则推导。V1–V6 为项目内部 Profile，非行业标准。"""
    lane = bool(p.get("lane_cam"))
    rtk = p.get("positioning") == "RTK"
    nav, hud = p.get("nav", "NONE"), p.get("hud", "NONE")
    if nav == "NONE":
        tier = "V4"                                   # 无地图：轻量路口包 + 仪表
    elif hud == "AR" and (rtk or lane) and nav == "LANE":
        tier = "V1"
    elif nav in ("LANE", "SD") and p.get("layer_api"):
        tier = "V2"
    else:
        tier = "V3"
    if p.get("small_cluster"):
        tier = "V5"
    if not p.get("ota"):
        tier = "V6"
    match = "M3" if (rtk or lane) else ("M2" if nav != "NONE" else "M1")
    level = "S2" if p.get("pc5") else "S1"
    return {"display_tier": tier, "match_max": match, "level_max": level}


def create(actor: str, tenant_id: str, model: str, year: str, **p) -> dict:
    d = derive(p)
    pid = f"VP-{tenant_id}-{model}-{year}".replace(" ", "")
    db.x("INSERT OR REPLACE INTO vehicle_profile (id,tenant_id,model,year,tbox,pc5,positioning,nav,hud,"
         "lane_cam,display_tier,match_max,level_max,version,created_at)"
         " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,"
         "COALESCE((SELECT version+1 FROM vehicle_profile WHERE id=?),1),?)",
         pid, tenant_id, model, year, p.get("tbox", "4G"), 1 if p.get("pc5") else 0,
         p.get("positioning", "GNSS"), p.get("nav", "SD"), p.get("hud", "NONE"),
         1 if p.get("lane_cam") else 0, d["display_tier"], d["match_max"], d["level_max"], pid, db.now())
    db.audit(actor, "PROFILE_SUBMIT", pid, {**d, "model": model, "year": year})
    return db.q1("SELECT * FROM vehicle_profile WHERE id=?", pid)


def listing(tenant_id: str = None) -> list:
    if tenant_id:
        return db.q("SELECT * FROM vehicle_profile WHERE tenant_id=? ORDER BY id", tenant_id)
    return db.q("SELECT * FROM vehicle_profile ORDER BY id")

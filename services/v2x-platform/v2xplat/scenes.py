"""SC 场景策略与参数：场景定义、配置项、启用范围、参数调整、订阅过滤。

默认值取自总体方案 V2.7 第 06 章；允许范围为设计初值。
护栏：R-17 允许范围、R-18 只可收紧、R-21 启用范围 ⊆ 已发布 ∩ 资格可达。
"""
import json, uuid
from . import db

# code, 名称, 服务等级, 计算位置, 质量要求, 阶段
SCENES = [
    ("SPAT", "信号灯灯态与读秒", "S0", "车端", "C", "P0"),
    ("GREEN_END", "绿灯即将结束", "S1", "车端", "B", "P0"),
    ("GREEN_START", "绿灯起步提醒", "S1", "车端", "C", "P1"),
    ("RLVW_TIP", "闯红灯风险提醒", "S1", "车端", "A", "P1"),
    ("GLOSA", "绿波车速引导", "S1", "车端", "A", "P1"),
    ("CONGESTION", "前方拥堵信息", "S0", "平台", "C", "P0"),
    ("ABNORMAL_STOP", "异常停车", "S1", "平台", "C", "P1"),
    ("VRU_RISKZONE", "路口风险区提示", "S0", "平台", "C", "P2"),
]
# scene, key, 名称, 类别 D/W/P, 默认, min, max, 只可收紧, 方向, 粒度, 审批
PARAMS = [
    ("SPAT", "age_limit_s", "读秒可下发的数据龄期上限", "D", "3", 1, 3, 1, "down", "全市", "算法 + 安全"),
    ("SPAT", "jump_degrade_s", "单周期跳变降级阈值", "D", "2", 1, 2, 1, "down", "路口", "算法"),
    ("GREEN_START", "standstill_s", "自车静止时长", "W", "2", 2, 5, 0, "up", "全市", "算法"),
    ("GREEN_START", "window_end_s", "绿灯亮起后下发窗口上限", "W", "10", 5, 15, 0, "up", "全市", "算法 + 安全"),
    ("GREEN_START", "lead_gap_m", "前车驶离判定距离", "W", "3", 2, 5, 0, "up", "车型档位", "算法"),
    ("GREEN_END", "arrive_limit_s", "触发到达时间上限", "W", "8", 5, 10, 0, "up", "道路等级", "算法"),
    ("RLVW_TIP", "reaction_s", "反应时间 t_r", "W", "1.0", 0.8, 1.5, 0, "up", "车型档位", "算法 + 安全"),
    ("RLVW_TIP", "comfort_decel", "舒适减速度 a_c", "W", "3.0", 2.0, 3.5, 0, "up", "车型档位", "算法 + 安全"),
    ("GLOSA", "tail_margin_s", "绿灯尾部裕度下限", "D", "1.5", 1.5, 4, 1, "up", "路口", "算法 + 安全"),
    ("GLOSA", "v_low_kmh", "最低建议车速", "D", "20", 15, 30, 0, "up", "道路等级", "算法"),
    ("CONGESTION", "window_min", "统计周期（分钟）", "D", "1", 1, 5, 0, "up", "区域云", "算法"),
    ("CONGESTION", "periods", "连续达到中度及以上的周期数", "D", "2", 2, 3, 0, "up", "道路等级", "算法"),
    ("CONGESTION", "ahead_km", "提示距离（公里）", "P", "2", 0.5, 3, 0, "up", "道路等级", "运营"),
    ("ABNORMAL_STOP", "still_s", "静止持续时长", "D", "30", 20, 60, 0, "up", "道路等级", "算法"),
    ("ABNORMAL_STOP", "confidence", "单源确认置信度下限", "D", "90", 85, 95, 1, "up", "全市", "算法 + 安全"),
    ("ABNORMAL_STOP", "ahead_m", "提示距离（米）", "P", "300", 150, 500, 0, "up", "道路等级", "运营"),
    ("VRU_RISKZONE", "vru_count", "风险区发布阈值（人/分钟）", "D", "5", 3, 20, 0, "up", "路口", "算法"),
]
QUALITY_ORDER = {"A": 3, "B": 2, "C": 1, "X": 0}


class ParamError(ValueError):
    def __init__(self, rule, msg):
        super().__init__(msg)
        self.rule = rule


def seed() -> None:
    for s in SCENES:
        db.x("INSERT OR IGNORE INTO scene (code,name,level,compute,quality_req,phase) VALUES (?,?,?,?,?,?)", *s)
    for p in PARAMS:
        db.x("INSERT OR IGNORE INTO scene_param (scene_code,key,label,category,value,dflt,vmin,vmax,"
             "only_tighten,direction,grain,approval) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
             p[0], p[1], p[2], p[3], p[4], p[4], p[5], p[6], p[7], p[8], p[9], p[10])
    # 默认策略：起步提醒默认关闭（设计文档 13.3），其余全市开启
    if not db.q1("SELECT 1 FROM scene_policy LIMIT 1"):
        for s in SCENES:
            act = "DISABLE" if s[0] == "GREEN_START" else "ENABLE"
            db.x("INSERT INTO scene_policy (id,scene_code,scope_type,scope_ref,action,time_rule,created_by,created_at)"
                 " VALUES (?,?, 'city','ALL',?,NULL,'system',?)", "POL-" + uuid.uuid4().hex[:6].upper(), s[0], act, db.now())


def scenes() -> list:
    seed()
    rows = db.q("SELECT * FROM scene ORDER BY phase, code")
    for r in rows:
        r["params"] = db.q("SELECT * FROM scene_param WHERE scene_code=? ORDER BY category, key", r["code"])
        r["policies"] = db.q("SELECT * FROM scene_policy WHERE scene_code=? ORDER BY created_at", r["code"])
    return rows


def set_param(actor: str, scene_code: str, key: str, value: str) -> dict:
    """R-17 允许范围；R-18 只可收紧。"""
    p = db.q1("SELECT * FROM scene_param WHERE scene_code=? AND key=?", scene_code, key)
    if not p:
        raise KeyError(f"{scene_code}.{key}")
    try:
        v = float(value)
    except ValueError:
        raise ParamError("R-17", "参数值必须为数值")
    if p["vmin"] is not None and (v < p["vmin"] or v > p["vmax"]):
        raise ParamError("R-17", f"{p['label']} 必须在 {p['vmin']}–{p['vmax']} 之间（R-17）")
    if p["only_tighten"]:
        cur = float(p["value"])
        loosen = v > cur if p["direction"] == "down" else v < cur
        if loosen:
            raise ParamError("R-18", f"{p['label']} 标记为只可收紧，不得向放宽方向修改（R-18）")
    db.x("UPDATE scene_param SET value=? WHERE scene_code=? AND key=?", str(v), scene_code, key)
    db.audit(actor, "SCENE_PARAM_SET", f"{scene_code}.{key}", {"from": p["value"], "to": str(v), "category": p["category"]})
    return db.q1("SELECT * FROM scene_param WHERE scene_code=? AND key=?", scene_code, key)


def set_policy(actor: str, scene_code: str, scope_type: str, scope_ref: str, action: str,
               time_rule: str = None) -> dict:
    """启用范围：路口 / 走廊 / 行政区 / 全市；越具体越优先（13.5）。"""
    if scope_type == "intersection":
        row = db.q1("SELECT published FROM intersection WHERE id=?", scope_ref)
        if not row:
            raise ParamError("R-21", f"路口 {scope_ref} 不在主数据中")
        if action == "ENABLE" and not row["published"]:
            raise ParamError("R-21", f"路口 {scope_ref} 未发布，不能启用场景（R-21）")
    pid = "POL-" + uuid.uuid4().hex[:6].upper()
    db.x("INSERT INTO scene_policy (id,scene_code,scope_type,scope_ref,action,time_rule,created_by,created_at)"
         " VALUES (?,?,?,?,?,?,?,?)", pid, scene_code, scope_type, scope_ref, action, time_rule, actor, db.now())
    db.audit(actor, "SCENE_POLICY_SET", pid, {"scene": scene_code, "scope": f"{scope_type}:{scope_ref}", "action": action})
    return db.q1("SELECT * FROM scene_policy WHERE id=?", pid)


_PRIORITY = {"intersection": 4, "corridor": 3, "district": 2, "city": 1}


def enabled_at(scene_code: str, intersection: dict) -> bool:
    """按优先级合并策略：越具体越优先，同级以“关闭”为准。"""
    best, rank = None, -1
    for p in db.q("SELECT * FROM scene_policy WHERE scene_code=? ORDER BY created_at", scene_code):
        ref_ok = (p["scope_type"] == "city"
                  or (p["scope_type"] == "district" and p["scope_ref"] == intersection["district"])
                  or (p["scope_type"] == "corridor" and p["scope_ref"] == intersection["corridor"])
                  or (p["scope_type"] == "intersection" and p["scope_ref"] == intersection["id"]))
        if not ref_ok:
            continue
        r = _PRIORITY[p["scope_type"]]
        if r > rank or (r == rank and p["action"] == "DISABLE"):
            best, rank = p, r
    return bool(best and best["action"] == "ENABLE")


def eligible_at(scene_code: str, intersection: dict) -> bool:
    """场景资格：质量达标 + 已发布 + 未被暂停（R-05、R-21）。"""
    from . import ops_center
    sc = db.q1("SELECT * FROM scene WHERE code=?", scene_code)
    if not sc or not intersection["published"]:
        return False
    if ops_center.is_suspended(intersection["id"]):
        return False
    return QUALITY_ORDER[intersection["quality"]] >= QUALITY_ORDER[sc["quality_req"]]


def deliverable(scene_code: str, intersections: list) -> list:
    """某场景在给定路口集合中实际可交付的路口。"""
    seed()
    out = []
    for iid in intersections:
        i = db.q1("SELECT * FROM intersection WHERE id=?", iid)
        if i and enabled_at(scene_code, i) and eligible_at(scene_code, i):
            out.append(iid)
    return out


def sub_scenes(sub_id: str) -> list:
    """订阅的场景开关与过滤（SC-5）。未配置时按城市启用与资格默认开启。"""
    seed()
    s = db.q1("SELECT * FROM subscription WHERE id=?", sub_id)
    ints = [r["intersection_id"] for r in db.q("SELECT intersection_id FROM scope_item WHERE sub_id=?", sub_id)]
    out = []
    for sc in db.q("SELECT * FROM scene ORDER BY phase, code"):
        cfg = db.q1("SELECT * FROM sub_scene WHERE sub_id=? AND scene_code=?", sub_id, sc["code"])
        d = deliverable(sc["code"], ints)
        out.append({"scene": sc["code"], "name": sc["name"], "level": sc["level"], "compute": sc["compute"],
                    "quality_req": sc["quality_req"], "phase": sc["phase"],
                    "enabled": bool(cfg["enabled"]) if cfg else True,
                    "min_level": (cfg or {}).get("min_level"), "ahead_m": (cfg or {}).get("ahead_m"),
                    "deliverable": len(d), "requested": len(ints)})
    return out


def set_sub_scene(actor: str, sub_id: str, scene_code: str, enabled: bool,
                  min_level: str = None, ahead_m: int = None) -> dict:
    """租户只能收紧：不能开启城市未启用或资格不可达的场景（R-17）。"""
    seed()
    ints = [r["intersection_id"] for r in db.q("SELECT intersection_id FROM scope_item WHERE sub_id=?", sub_id)]
    if enabled and not deliverable(scene_code, ints):
        raise ParamError("R-17", f"{scene_code} 在本订阅范围内没有可交付路口（城市未启用或资格不可达），不能开启")
    db.x("INSERT OR REPLACE INTO sub_scene (sub_id,scene_code,enabled,min_level,ahead_m) VALUES (?,?,?,?,?)",
         sub_id, scene_code, 1 if enabled else 0, min_level, ahead_m)
    db.audit(actor, "SUB_SCENE_SET", sub_id, {"scene": scene_code, "enabled": enabled,
                                              "min_level": min_level, "ahead_m": ahead_m})
    return {"sub_id": sub_id, "scene": scene_code, "enabled": enabled}

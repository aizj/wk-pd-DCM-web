"""CT-1 服务目录：可订阅、可计量的交付单元定义。"""
from . import db

SEED = [
    ("V2X.SPAT", "信号灯灯态与读秒", "S0", "C", "PC5 / Uu", "T-BOX 行驶中长连接；M1", "路口会话数", "P0"),
    ("V2X.HEALTH", "路口健康与场景资格", "—", "X", "Uu", "随 SPAT 附带，不可退订", "—", "P0"),
    ("V2X.MAP", "MAP 与映射底表", "S0", "X", "HTTPS", "—", "—", "P0"),
    ("V2X.EVENT.CONGESTION", "前方拥堵信息", "S0", "C", "Uu / PC5", "T-BOX", "事件修订数", "P0"),
    ("V2X.EVENT.ABNORMAL_STOP", "异常停车", "S1", "C", "Uu / PC5", "T-BOX", "事件修订数", "P1"),
    ("V2X.EVENT.ROADWORK", "施工、管制与限速", "S0", "C", "Uu / PC5", "T-BOX", "事件修订数", "P1"),
    ("V2X.RISKZONE", "路口风险区提示", "S0", "C", "Uu", "T-BOX", "事件修订数", "P2"),
    ("V2X.EDGE.UUB", "低时延包（Uu-B）", "S2", "A", "Uu-B", "5G + 专用 DNN + 实测达标", "片区 × 月", "P1"),
]


def seed() -> None:
    for row in SEED:
        db.x("INSERT OR IGNORE INTO service_def (code,name,level,quality_min,channel,min_capability,unit,phase)"
             " VALUES (?,?,?,?,?,?,?,?)", *row)


def services() -> list:
    seed()
    return db.q("SELECT * FROM service_def ORDER BY phase, code")

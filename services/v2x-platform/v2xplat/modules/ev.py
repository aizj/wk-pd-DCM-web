"""本文件由 tools/gen_stubs.py 依据 catalog.json 生成，请勿手改。
实现登记在 v2xplat/impl.py。"""
from ..base import Module, point

class MEV_1(Module):
    """EV-1 回执接收与策略｜用户：车企、运营｜版本：P0｜需求：RQ-14"""
    id = "EV-1"
    name = "回执接收与策略"
    subsystem = "EV"
    phase = "P0"
    requirements = "RQ-14"

    @point("EV-1.1", "回执策略配置（聚合粒度、抽样率、异常即时回传类型）")
    def ev_1_1(self, **kw):
        """EV-1.1 回执策略配置（聚合粒度、抽样率、异常即时回传类型）"""
        return self.run(kw)

    @point("EV-1.2", "聚合回执接收（路口 × 小时 × 状态 × 原因码）")
    def ev_1_2(self, **kw):
        """EV-1.2 聚合回执接收（路口 × 小时 × 状态 × 原因码）"""
        return self.run(kw)

    @point("EV-1.3", "抽样逐条回执接收")
    def ev_1_3(self, **kw):
        """EV-1.3 抽样逐条回执接收"""
        return self.run(kw)

    @point("EV-1.4", "异常即时回传接收与告警")
    def ev_1_4(self, **kw):
        """EV-1.4 异常即时回传接收与告警"""
        return self.run(kw)

    @point("EV-1.5", "示范车逐条回执")
    def ev_1_5(self, **kw):
        """EV-1.5 示范车逐条回执"""
        return self.run(kw)

    @point("EV-1.6", "回执缺失检测（无法核验率）")
    def ev_1_6(self, **kw):
        """EV-1.6 回执缺失检测（无法核验率）"""
        return self.run(kw)


class MEV_2(Module):
    """EV-2 计量采集｜用户：系统｜版本：P1｜需求：RQ-20"""
    id = "EV-2"
    name = "计量采集"
    subsystem = "EV"
    phase = "P1"
    requirements = "RQ-20"

    @point("EV-2.1", "合格数（路口会话、事件修订）")
    def ev_2_1(self, **kw):
        """EV-2.1 合格数（路口会话、事件修订）"""
        return self.run(kw)

    @point("EV-2.2", "消息量")
    def ev_2_2(self, **kw):
        """EV-2.2 消息量"""
        return self.run(kw)

    @point("EV-2.3", "车企上报服务车辆数")
    def ev_2_3(self, **kw):
        """EV-2.3 车企上报服务车辆数"""
        return self.run(kw)

    @point("EV-2.4", "按订阅版本归档")
    def ev_2_4(self, **kw):
        """EV-2.4 按订阅版本归档"""
        return self.run(kw)


class MEV_3(Module):
    """EV-3 对账与月报｜用户：商务、运营｜版本：P1｜需求：RQ-20"""
    id = "EV-3"
    name = "对账与月报"
    subsystem = "EV"
    phase = "P1"
    requirements = "RQ-20"

    @point("EV-3.1", "自动对账（合格数 vs 车端校验通过数）")
    def ev_3_1(self, **kw):
        """EV-3.1 自动对账（合格数 vs 车端校验通过数）"""
        return self.run(kw)

    @point("EV-3.2", "差异下钻（时段、路口、原因码）")
    def ev_3_2(self, **kw):
        """EV-3.2 差异下钻（时段、路口、原因码）"""
        return self.run(kw)

    @point("EV-3.3", "差异处理与确认")
    def ev_3_3(self, **kw):
        """EV-3.3 差异处理与确认"""
        return self.run(kw)

    @point("EV-3.4", "月报生成与抄送")
    def ev_3_4(self, **kw):
        """EV-3.4 月报生成与抄送"""
        return self.run(kw)


class MEV_4(Module):
    """EV-4 结算｜用户：商务｜版本：P2｜需求：RQ-26"""
    id = "EV-4"
    name = "结算"
    subsystem = "EV"
    phase = "P2"
    requirements = "RQ-26"

    @point("EV-4.1", "价格与套餐（仅已登记服务）")
    def ev_4_1(self, **kw):
        """EV-4.1 价格与套餐（仅已登记服务）"""
        return self.run(kw)

    @point("EV-4.2", "计量不计价模式")
    def ev_4_2(self, **kw):
        """EV-4.2 计量不计价模式"""
        return self.run(kw)

    @point("EV-4.3", "结算单生成与确认")
    def ev_4_3(self, **kw):
        """EV-4.3 结算单生成与确认"""
        return self.run(kw)


class MEV_5(Module):
    """EV-5 争议与审计支持｜用户：商务、安全｜版本：P1｜需求：RQ-46"""
    id = "EV-5"
    name = "争议与审计支持"
    subsystem = "EV"
    phase = "P1"
    requirements = "RQ-46"

    @point("EV-5.1", "对账差异争议升级")
    def ev_5_1(self, **kw):
        """EV-5.1 对账差异争议升级"""
        return self.run(kw)

    @point("EV-5.2", "证据包导出（发布记录、回执、配置快照、参数版本）")
    def ev_5_2(self, **kw):
        """EV-5.2 证据包导出（发布记录、回执、配置快照、参数版本）"""
        return self.run(kw)

    @point("EV-5.3", "第三方审计只读视图")
    def ev_5_3(self, **kw):
        """EV-5.3 第三方审计只读视图"""
        return self.run(kw)

    @point("EV-5.4", "争议结论归档")
    def ev_5_4(self, **kw):
        """EV-5.4 争议结论归档"""
        return self.run(kw)

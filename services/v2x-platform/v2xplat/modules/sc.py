"""本文件由 tools/gen_stubs.py 依据 catalog.json 生成，请勿手改。
实现登记在 v2xplat/impl.py。"""
from ..base import Module, point

class MSC_1(Module):
    """SC-1 场景与配置项定义｜用户：平台架构、算法｜版本：P0｜需求：RQ-32"""
    id = "SC-1"
    name = "场景与配置项定义"
    subsystem = "SC"
    phase = "P0"
    requirements = "RQ-32"

    @point("SC-1.1", "场景定义（服务等级、平台算法、计算位置、适用模式）")
    def sc_1_1(self, **kw):
        """SC-1.1 场景定义（服务等级、平台算法、计算位置、适用模式）"""
        return self.run(kw)

    @point("SC-1.2", "配置项定义（类别 D / W / P、默认值、允许范围、只可收紧标记、粒度、审批级别）")
    def sc_1_2(self, **kw):
        """SC-1.2 配置项定义（类别 D / W / P、默认值、允许范围、只可收紧标记、粒度、审批级别）"""
        return self.run(kw)

    @point("SC-1.3", "不可配置禁止规则登记（R-20）")
    def sc_1_3(self, **kw):
        """SC-1.3 不可配置禁止规则登记（R-20）"""
        return self.run(kw)


class MSC_2(Module):
    """SC-2 启用范围与时段｜用户：平台运营｜版本：P0｜需求：RQ-33"""
    id = "SC-2"
    name = "启用范围与时段"
    subsystem = "SC"
    phase = "P0"
    requirements = "RQ-33"

    @point("SC-2.1", "地图或清单选择空间对象（区域云至进口道）")
    def sc_2_1(self, **kw):
        """SC-2.1 地图或清单选择空间对象（区域云至进口道）"""
        return self.run(kw)

    @point("SC-2.2", "开启 / 关闭 / 覆盖参数")
    def sc_2_2(self, **kw):
        """SC-2.2 开启 / 关闭 / 覆盖参数"""
        return self.run(kw)

    @point("SC-2.3", "时段与临时生效期")
    def sc_2_3(self, **kw):
        """SC-2.3 时段与临时生效期"""
        return self.run(kw)

    @point("SC-2.4", "优先级合并与冲突提示")
    def sc_2_4(self, **kw):
        """SC-2.4 优先级合并与冲突提示"""
        return self.run(kw)

    @point("SC-2.5", "生效预览（受影响路口、资格可达、交警暂停叠加）")
    def sc_2_5(self, **kw):
        """SC-2.5 生效预览（受影响路口、资格可达、交警暂停叠加）"""
        return self.run(kw)


class MSC_3(Module):
    """SC-3 数据算法参数｜用户：算法负责人｜版本：P0｜需求：RQ-34"""
    id = "SC-3"
    name = "数据算法参数"
    subsystem = "SC"
    phase = "P0"
    requirements = "RQ-34"

    @point("SC-3.1", "按算法编辑 D 类参数（质量评级、场景资格、建议车速带、拥堵、异常停车、队尾、感知与风险区）")
    def sc_3_1(self, **kw):
        """SC-3.1 按算法编辑 D 类参数（质量评级、场景资格、建议车速带、拥堵、异常停车、队尾、感知与风险区）"""
        return self.run(kw)

    @point("SC-3.2", "按区域云、道路等级、路段、进口道覆盖")
    def sc_3_2(self, **kw):
        """SC-3.2 按区域云、道路等级、路段、进口道覆盖"""
        return self.run(kw)

    @point("SC-3.3", "算法配置快照下发区域云 / 边缘云")
    def sc_3_3(self, **kw):
        """SC-3.3 算法配置快照下发区域云 / 边缘云"""
        return self.run(kw)

    @point("SC-3.4", "在途事件按旧参数完成生命周期")
    def sc_3_4(self, **kw):
        """SC-3.4 在途事件按旧参数完成生命周期"""
        return self.run(kw)


class MSC_4(Module):
    """SC-4 平台计算预警参数｜用户：算法负责人｜版本：P1｜需求：RQ-35"""
    id = "SC-4"
    name = "平台计算预警参数"
    subsystem = "SC"
    phase = "P1"
    requirements = "RQ-35"

    @point("SC-4.1", "W 类参数编辑")
    def sc_4_1(self, **kw):
        """SC-4.1 W 类参数编辑"""
        return self.run(kw)

    @point("SC-4.2", "按计算位置限定可计算预警（区域云仅提示类，R-20）")
    def sc_4_2(self, **kw):
        """SC-4.2 按计算位置限定可计算预警（区域云仅提示类，R-20）"""
        return self.run(kw)

    @point("SC-4.3", "车辆状态接入与龄期校验")
    def sc_4_3(self, **kw):
        """SC-4.3 车辆状态接入与龄期校验"""
        return self.run(kw)

    @point("SC-4.4", "预警计算配置快照")
    def sc_4_4(self, **kw):
        """SC-4.4 预警计算配置快照"""
        return self.run(kw)

    @point("SC-4.5", "预警有效期与撤销条件")
    def sc_4_5(self, **kw):
        """SC-4.5 预警有效期与撤销条件"""
        return self.run(kw)


class MSC_5(Module):
    """SC-5 下发策略与订阅过滤｜用户：运营、车企｜版本：P0（SC-5.6 P1）｜需求：RQ-36"""
    id = "SC-5"
    name = "下发策略与订阅过滤"
    subsystem = "SC"
    phase = "P0（SC-5.6 P1）"
    requirements = "RQ-36"

    @point("SC-5.1", "下发对象")
    def sc_5_1(self, **kw):
        """SC-5.1 下发对象"""
        return self.run(kw)

    @point("SC-5.2", "事件空间范围（瓦片与上游提示距离）")
    def sc_5_2(self, **kw):
        """SC-5.2 事件空间范围（瓦片与上游提示距离）"""
        return self.run(kw)

    @point("SC-5.3", "频率与有效期")
    def sc_5_3(self, **kw):
        """SC-5.3 频率与有效期"""
        return self.run(kw)

    @point("SC-5.4", "去重与冷却")
    def sc_5_4(self, **kw):
        """SC-5.4 去重与冷却"""
        return self.run(kw)

    @point("SC-5.5", "租户场景订阅、事件等级、质量下限与提示距离收紧")
    def sc_5_5(self, **kw):
        """SC-5.5 租户场景订阅、事件等级、质量下限与提示距离收紧"""
        return self.run(kw)

    @point("SC-5.6", "车辆功能订阅过滤（直连 / 模式 B）")
    def sc_5_6(self, **kw):
        """SC-5.6 车辆功能订阅过滤（直连 / 模式 B）"""
        return self.run(kw)

    @point("SC-5.7", "写入场景策略与订阅快照")
    def sc_5_7(self, **kw):
        """SC-5.7 写入场景策略与订阅快照"""
        return self.run(kw)


class MSC_6(Module):
    """SC-6 变更验证与发布｜用户：算法、安全、运营｜版本：P0（SC-6.2 P1）｜需求：RQ-37"""
    id = "SC-6"
    name = "变更验证与发布"
    subsystem = "SC"
    phase = "P0（SC-6.2 P1）"
    requirements = "RQ-37"

    @point("SC-6.1", "参数与策略变更单")
    def sc_6_1(self, **kw):
        """SC-6.1 参数与策略变更单"""
        return self.run(kw)

    @point("SC-6.2", "历史回放对比")
    def sc_6_2(self, **kw):
        """SC-6.2 历史回放对比"""
        return self.run(kw)

    @point("SC-6.3", "安全评审（R-19）")
    def sc_6_3(self, **kw):
        """SC-6.3 安全评审（R-19）"""
        return self.run(kw)

    @point("SC-6.4", "灰度与对照区")
    def sc_6_4(self, **kw):
        """SC-6.4 灰度与对照区"""
        return self.run(kw)

    @point("SC-6.5", "回滚到上一版本")
    def sc_6_5(self, **kw):
        """SC-6.5 回滚到上一版本"""
        return self.run(kw)


class MSC_7(Module):
    """SC-7 效果监控与自动保护｜用户：算法、运营｜版本：P1｜需求：RQ-37"""
    id = "SC-7"
    name = "效果监控与自动保护"
    subsystem = "SC"
    phase = "P1"
    requirements = "RQ-37"

    @point("SC-7.1", "发布量、触发率、误报反馈、关闭率、提前量看板")
    def sc_7_1(self, **kw):
        """SC-7.1 发布量、触发率、误报反馈、关闭率、提前量看板"""
        return self.run(kw)

    @point("SC-7.2", "车辆状态龄期与未下发比例")
    def sc_7_2(self, **kw):
        """SC-7.2 车辆状态龄期与未下发比例"""
        return self.run(kw)

    @point("SC-7.3", "偏离基线告警")
    def sc_7_3(self, **kw):
        """SC-7.3 偏离基线告警"""
        return self.run(kw)

    @point("SC-7.4", "7 天内变更自动回滚")
    def sc_7_4(self, **kw):
        """SC-7.4 7 天内变更自动回滚"""
        return self.run(kw)

    @point("SC-7.5", "单路口误报自动降级与质检工单")
    def sc_7_5(self, **kw):
        """SC-7.5 单路口误报自动降级与质检工单"""
        return self.run(kw)

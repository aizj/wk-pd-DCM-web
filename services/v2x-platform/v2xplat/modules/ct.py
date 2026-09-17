"""本文件由 tools/gen_stubs.py 依据 catalog.json 生成，请勿手改。
实现登记在 v2xplat/impl.py。"""
from ..base import Module, point

class MCT_1(Module):
    """CT-1 服务目录｜用户：车企产品｜版本：P0｜需求：RQ-07"""
    id = "CT-1"
    name = "服务目录"
    subsystem = "CT"
    phase = "P0"
    requirements = "RQ-07"

    @point("CT-1.1", "服务列表与筛选（服务包、等级、城市）")
    def ct_1_1(self, **kw):
        """CT-1.1 服务列表与筛选（服务包、等级、城市）"""
        return self.run(kw)

    @point("CT-1.2", "服务详情六类信息（第 10 章）")
    def ct_1_2(self, **kw):
        """CT-1.2 服务详情六类信息（第 10 章）"""
        return self.run(kw)

    @point("CT-1.3", "版本与废弃计划")
    def ct_1_3(self, **kw):
        """CT-1.3 版本与废弃计划"""
        return self.run(kw)

    @point("CT-1.4", "数据源标注（统一出口 / 过渡数据源，CD-07）")
    def ct_1_4(self, **kw):
        """CT-1.4 数据源标注（统一出口 / 过渡数据源，CD-07）"""
        return self.run(kw)

    @point("CT-1.5", "加入订阅草稿")
    def ct_1_5(self, **kw):
        """CT-1.5 加入订阅草稿"""
        return self.run(kw)


class MCT_2(Module):
    """CT-2 覆盖地图｜用户：车企产品｜版本：P0（CT-2.4 P1）｜需求：RQ-07"""
    id = "CT-2"
    name = "覆盖地图"
    subsystem = "CT"
    phase = "P0（CT-2.4 P1）"
    requirements = "RQ-07"

    @point("CT-2.1", "发布路口与质量等级着色")
    def ct_2_1(self, **kw):
        """CT-2.1 发布路口与质量等级着色"""
        return self.run(kw)

    @point("CT-2.2", "RSU 覆盖图层")
    def ct_2_2(self, **kw):
        """CT-2.2 RSU 覆盖图层"""
        return self.run(kw)

    @point("CT-2.3", "走廊、片区图层")
    def ct_2_3(self, **kw):
        """CT-2.3 走廊、片区图层"""
        return self.run(kw)

    @point("CT-2.4", "框选生成路口清单")
    def ct_2_4(self, **kw):
        """CT-2.4 框选生成路口清单"""
        return self.run(kw)

    @point("CT-2.5", "坐标合规处理与说明")
    def ct_2_5(self, **kw):
        """CT-2.5 坐标合规处理与说明"""
        return self.run(kw)


class MCT_3(Module):
    """CT-3 质量报告与样例｜用户：车企产品、工程师｜版本：P1｜需求：RQ-07"""
    id = "CT-3"
    name = "质量报告与样例"
    subsystem = "CT"
    phase = "P1"
    requirements = "RQ-07"

    @point("CT-3.1", "城市质量月报下载")
    def ct_3_1(self, **kw):
        """CT-3.1 城市质量月报下载"""
        return self.run(kw)

    @point("CT-3.2", "消息样例（正确 / 过期 / 撤销）")
    def ct_3_2(self, **kw):
        """CT-3.2 消息样例（正确 / 过期 / 撤销）"""
        return self.run(kw)

    @point("CT-3.3", "流量与消息量估算器")
    def ct_3_3(self, **kw):
        """CT-3.3 流量与消息量估算器"""
        return self.run(kw)

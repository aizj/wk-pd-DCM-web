"""本文件由 tools/gen_stubs.py 依据 catalog.json 生成，请勿手改。
实现登记在 v2xplat/impl.py。"""
from ..base import Module, point

class MDP_1(Module):
    """DP-1 目录与申请｜用户：车企、第三方｜版本：P2｜需求：RQ-27"""
    id = "DP-1"
    name = "目录与申请"
    subsystem = "DP"
    phase = "P2"
    requirements = "RQ-27"

    @point("DP-1.1", "数据产品目录（登记编号）")
    def dp_1_1(self, **kw):
        """DP-1.1 数据产品目录（登记编号）"""
        return self.run(kw)

    @point("DP-1.2", "场景授权申请")
    def dp_1_2(self, **kw):
        """DP-1.2 场景授权申请"""
        return self.run(kw)

    @point("DP-1.3", "审批与协议")
    def dp_1_3(self, **kw):
        """DP-1.3 审批与协议"""
        return self.run(kw)


class MDP_2(Module):
    """DP-2 交付｜用户：车企、第三方｜版本：P2｜需求：RQ-27"""
    id = "DP-2"
    name = "交付"
    subsystem = "DP"
    phase = "P2"
    requirements = "RQ-27"

    @point("DP-2.1", "批量下载与流式订阅（IF-45）")
    def dp_2_1(self, **kw):
        """DP-2.1 批量下载与流式订阅（IF-45）"""
        return self.run(kw)

    @point("DP-2.2", "使用记录与水印")
    def dp_2_2(self, **kw):
        """DP-2.2 使用记录与水印"""
        return self.run(kw)

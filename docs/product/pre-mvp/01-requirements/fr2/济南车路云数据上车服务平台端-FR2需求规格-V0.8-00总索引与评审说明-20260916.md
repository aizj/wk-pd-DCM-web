# 济南车路云数据上车服务平台端 FR-2 需求规格

> 文档版本：V0.8 研发落地评审稿  
> 编制日期：2026-09-16  
> 适用范围：服务订阅申请、预检、审批、实例、Revision、运行兴趣与退出  
> 上位输入：V0.1～V0.3 产品规划与功能深化、V0.4～V0.5 FR-1 规格、V0.6 产品说明书、V0.7 研发启动审查  
> 编制方法：requirements-spec-generator 四层需求法  
> 研发边界：仅覆盖平台端产品与系统需求；不授权修改移动端、车端、OEM 系统或既有平台代码。  
> 文档边界：本套文档不替代授权文件、法律意见、Project Profile、ICD、OpenAPI/AsyncAPI、DVP&R、架构设计、OEM 量产准出或生产发布审批。

---

## 1. 本轮结论

FR-2 的核心不是“给服务加一个订阅开关”，而是把 FR-1 已授予的最小权利，转化为某个 OEM 应用在明确车型、时空、通道、质量、反馈、期限和退出边界下的长期可执行契约，并安全承接 FR-3 配置、FR-4 测试发布控制和 FR-5 运行证据。

本轮形成以下关键结论：

1. `ServiceEntitlementRevision` 只回答“有没有权利”，`SubscriptionRevision` 回答“长期准备如何使用”，`RuntimeInterestPolicy` 回答“长期由谁判断相关性”，`RuntimeSession` 仅表达获准的短时会话，这些对象不得合并；
2. FR-2 只接受 `ACTIVE + ENABLED` 且关键依赖 `CURRENT` 的权益，不授予或扩大权利；
3. 申请获批只代表准入决定，`APPROVED ≠ READY ≠ ACTIVE`，也不等于配置、发布、运行或车辆使用成功；
4. 预检执行状态、业务结果和结果有效性分别建模，`STALE` 不再与 `PASS/BLOCKED` 混用；
5. PC5、Uu-A、Uu-T、Uu-B 采用分型契约，不能用一套逐车订阅表单假设四种通道同构；
6. 任何生产语义变化创建新 Revision，正式 Revision 不可原位覆盖；
7. 暂停、运行抑制、到期、撤销、终止和 Revision 替代分别表达；
8. 控制请求被网关接受不等于停发已完成，车辆/HMI/算法结果只按实际证据等级表达；
9. 迟到批准、激活、恢复或旧 Revision 回执不能覆盖更高 Revision、撤销、到期或终止事实；
10. S1 只建设 PG12 内嵌的五层只读运行诊断，完整跨域订阅调试器保留为 P1。

| 启动对象 | 当前结论 | 允许范围 | 进入下一门槛 |
|---|---|---|---|
| FR-2 四层需求文档 | READY FOR REVIEW（待联合签认） | 产品、架构、安全、UX 和测试联合评审 | 评审意见关闭、当前切片签认并版本冻结后才可转 PASS |
| S1 信息架构、原型、Schema/Mock 草案 | Conditional Go | 以“单服务 Uu-A”作为待签认建议基线推进，不得写成项目事实 | M0/U01、S1/U02、字段字典差异、权限映射和契约签认 |
| FR-2 业务及有状态核心编码 | NO-GO（当前） | 可做不产生业务决定的 Spike、Schema/Mock 草案、契约验证和测试夹具 | 目标 StoryId 逐条通过 DoR，且 DevelopmentStartDecision 明确仓库/分支/环境/禁改项/验收人后才按故事放行 |
| S2/S3/P1 能力开发 | NO-GO | 仅保留扩展点和禁用态 | 对应切片重新评审并满足独立 DoR |
| 生产准出 | NO-GO | 沙箱/联调证据不得外推生产 | DVP&R、安全、性能、OEM/外部依赖和发布审批全部通过 |

## 2. 交付物导航

| 序号 | 文件 | 评审问题 | 数量 |
|---|---|---|---:|
| 00 | 本文：总索引与评审说明 | 范围、状态、追溯、切片和开工门禁是否正确 | 1 份 |
| 01 | `V0.8-01用户故事` | 用户为什么需要、业务结果是否独立有价值 | 8 条用户故事、24 条验收 |
| 02 | `V0.8-02产品功能需求` | 产品必须提供哪些订阅能力和业务规则 | 13 项功能需求、65 条验收 |
| 03 | `V0.8-03常规研发需求` | 后端、状态、规则、事件和跨 FR 如何可靠处理 | 10 项研发需求、50 条验收 |
| 04 | `V0.8-04产品研发需求清单` | 前端页面、字段、交互、六态和验收如何交付 | 15 项页面/组件研发需求 |

## 3. 第一性原理与范围边界

### 3.1 FR-2 的业务公式

```text
可提交的订阅范围
= ACTIVE+ENABLED EntitlementRevision
∩ PUBLISHED ServiceOfferingVersion / ServiceVersion
∩ CURRENT VehicleCapabilityProfile / Compatibility
∩ 有效协议、ApplicationClient、Endpoint、Credential
∩ ServiceVersion允许的Coverage / Channel / Quality / Feedback
∩ Project Profile、用途、环境、期限和数据最小化规则
```

任一必要事实为 `DENY / BLOCKED / STALE / EXPIRED / INVALIDATED / INCONCLUSIVE / UNKNOWN` 时，生产准入默认阻断；系统应显示具体事实、证据、Owner 和下一动作，不能将空值解释为允许。

### 3.2 FR-2 起点和终点

| 边界 | 输入/输出 | 责任说明 |
|---|---|---|
| 起点 | FR-1 输出的有效 EntitlementRevision、Offering/ServiceVersion、Capability/Compatibility、结构化条件、Coverage 和期限 | FR-2 只消费和引用，不扩大或改写权利、能力事实 |
| 核心产物 | 不可变 SubscriptionRequestRevision、SubscriptionRevision、实例、预检、审批、控制和影响事实 | FR-2 是长期订阅契约和生命周期 Owner |
| FR-3 交接 | 获批 Revision、作用域、通道、质量/反馈约束、条件和有效时点 | FR-3 解析 EffectiveConfigSnapshot；FR-2 不计算最终配置值 |
| FR-4 交接 | 激活、暂停、恢复、切换、终止请求 | FR-4 管理 Qualification、Release、Node/Control 执行事实；FR-2 不伪造成功 |
| FR-5 交接 | 契约期望、FeedbackProfile、EvidenceTarget、关联 ID | FR-5 管理质量、健康、交付证据、RuntimeIncident/RuntimeWorkItem；证据不反写契约 |
| 终点 | 可追溯的订阅全生命周期与安全退出 | 只有必要作用域完成或取得有权例外，业务事件才能收口 |

### 3.3 本轮不进入范围

- FR-1 的授权决定、服务权益授予、OEM 能力确认和兼容结论改写；
- FR-3 的参数注册、安全包络、策略编排和最终配置计算；
- FR-4 的沙箱执行、配置包编译签名、节点发布、回滚和紧急控制实现；
- FR-5 的数据质量引擎、事件投递、车端回执、效果归因和对账实现；
- 车端 HMI、车辆控制算法、OEM 域逐车选择和量产软件；
- 商业定价、账单、结算和跨城市权益互认；
- 完整 PG25 跨域调试器、复杂批量订阅和 Uu-B 规模化运营。

## 4. 核心对象与唯一事实 Owner

| 对象 | 业务含义 | 唯一事实 Owner | 关键不变量 |
|---|---|---|---|
| SubscriptionRequest | 一次订阅申请的稳定身份 | FR-2 | 与生效 Subscription 分离 |
| SubscriptionRequestRevision | 草稿/正式申请某次内容快照 | FR-2 | 正式提交后不可变 |
| PrecheckInputSnapshot | 一次预检固定输入和规则版本 | FR-2 | 结果可重放；变化标记旧结果 STALE |
| PrecheckRun / Finding | 预检执行和逐项结果 | FR-2 | runStatus、outcome、validity 分离 |
| ApprovalCase / Decision | 准入审批与会签事实 | FR-2 | 决定引用固定申请；审批不改申请 |
| ExecutionCondition | 激活前提、持续义务或范围限制 | FR-2 | 由审批决定显式生成，不得扩大 Entitlement |
| ServiceSubscription | 长期订阅关系稳定身份 | FR-2 | 保存 currentApprovedRevisionId、targetRevisionId；仅当必要实例收敛时形成 currentEffectiveRevisionId，不用单一指针掩盖混跑 |
| SubscriptionRevision | 获批的长期/计划可执行契约 | FR-2 | 生产语义变化新建 Revision |
| SubscriptionInstance | 某应用×服务谱系×环境×原子 Coverage×通道的执行实例 | FR-2 | instanceKeyHash 固定身份、effectiveRevisionId 表达实际版本；身份键变化创建 successorInstance，不承载发布/健康/交付证据 |
| ControlRequest | 暂停、恢复、终止的业务意图、目标和 operationEpoch | FR-2 | 只表达请求与汇总，不伪造执行事实 |
| ControlExecutionReceipt | 控制对原子目标的真实执行结果 | FR-4 | FR-2 只保存 receiptRef/只读投影；ACK 不等于完成，operationEpoch 隔离旧回执 |
| RuntimeInterestPolicy / Session | 长期相关性模式和获准短时会话 | FR-2 | 不扩大长期权利；PC5 不建立逐车网络会话 |
| SubscriptionRemediationCase | 准入、补正、依赖变化、切换或退出的订阅处置 | FR-2 | 与 FR-5 RuntimeIncident/RuntimeWorkItem 分离；工作台只联合投影 |
| SubscriptionImpactSnapshot / ExitChecklist | 订阅变化影响和退出闭环 | FR-2 | PG03-I 只保存只读投影与深链，不双写；UNKNOWN 单列，未收口不得完成 |

外部只读引用包括 FR-1 的 Entitlement/Offering/Service/Capability/Compatibility，FR-3 的 EffectiveConfigSnapshot，FR-4 的 Qualification/Release/Node/Control 结果，FR-5 的 RuntimeHealth/DeliveryEvidence/RuntimeIncident/RuntimeWorkItem。

## 5. 状态单一事实源

### 5.1 FR-2 状态族

| 状态族 | 枚举 | 表达什么 | 禁止替代 |
|---|---|---|---|
| RequestRevision lifecycle | DRAFT、SUBMITTED、IN_REVIEW、NEEDS_INFO、APPROVED、CONDITIONALLY_APPROVED、REJECTED、WITHDRAWN、ABANDONED、REQUEST_EXPIRED、SUPERSEDED | 申请 Revision 的流程；ABANDONED 仅用于未提交草稿 | 预检、实例、发布 |
| Precheck runStatus | QUEUED、RUNNING、COMPLETED、FAILED、CANCELLED、TIMED_OUT | 规则任务是否执行完成 | 业务结论 |
| Precheck outcome | PASS、PASS_WITH_CONDITIONS、BLOCKED、INCONCLUSIVE | 输入是否符合准入规则 | 执行状态、有效性 |
| Precheck validity | CURRENT、STALE、EXPIRED、INVALIDATED | 结果现在能否继续使用 | PASS/BLOCKED |
| ApprovalCase | PENDING、IN_REVIEW、APPROVED、CONDITIONALLY_APPROVED、RETURNED、REJECTED、CANCELLED、EXPIRED | 审批流程与决定 | 订阅激活 |
| Instance lifecycle | PENDING_ACTIVATION、ACTIVE、EXPIRING、EXPIRED、REVOKED、TERMINATED、SUPERSEDED | 实例生命周期；发布资格只由 activationReadiness 表达 | 控制、发布、健康、activationReadiness |
| controlStatus | ENABLED、PAUSE_REQUESTED、PAUSED、RESUME_REQUESTED、STOP_REQUESTED、STOPPED | 当前控制请求与执行结果；硬门禁由 activationReadiness 表达 | 生命周期、运行健康、激活资格 |
| activationReadiness | NOT_EVALUATED、EVALUATING、READY、BLOCKED、STALE | 配置、测试、条件和依赖是否支持激活 | 发布结果 |
| RuntimeSession | CREATED、ACTIVE、EXPIRING、CLOSED、TIMED_OUT、REVOKED | 短时会话生命周期 | 匹配、投递、健康 |
| ExecutionCondition | PENDING、SATISFIED、VIOLATED、EXPIRED、WAIVED | 审批决定形成的激活前提、持续义务或限制 | 预检候选条件、审批状态 |
| SubscriptionChange | DRAFT、IN_REVIEW、APPROVED、REJECTED、CANCELLED | 变更/续期/迁移计划流程 | SubscriptionRevision、CutoverPlan |
| SubscriptionImpactSnapshot status | CALCULATING、EXECUTABLE、HAS_UNKNOWN、CLOSED | 固定影响计算能否用于处置与是否收口 | 订阅生命周期 |
| SubscriptionImpactSnapshot validity | CURRENT、STALE、EXPIRED、INVALIDATED | 影响快照基线现在能否继续使用 | status、UNKNOWN 结论 |
| CutoverPlan | PLANNED、EXECUTING、PARTIAL、ROLLING_BACK、SUCCEEDED、ROLLED_BACK、FAILED、CANCELLED | 新旧 Revision 按作用域切换及回滚结果 | Instance lifecycle、FR-4 Release |
| ControlRequest | REQUESTED、EXECUTING、PARTIAL、SUCCEEDED、FAILED、UNKNOWN | 一次暂停、恢复或终止请求的执行汇总 | controlStatus、FR-4 回执 |
| ExitChecklist | OPEN、IN_PROGRESS、PENDING_VERIFY、COMPLETED | 权限、端点、凭证、会话、发布和证据退出收口 | 请求 ACK、实例终态 |
| SubscriptionRemediationCase | OPEN、IN_PROGRESS、PENDING_VERIFY、COMPLETED、CANCELLED | FR-2 准入、变化、切换和退出处置 | FR-5 RuntimeWorkItem |

### 5.2 外部事实不得并入 FR-2

| 外部事实 | Owner | FR-2 只做什么 |
|---|---|---|
| EffectiveConfigSnapshot validity | FR-3 | 引用 ID/Hash/有效性，作为激活门禁 |
| QualificationRun | FR-4 | 引用测试结果和有效期，不生成 PASSED |
| ReleaseOrder / NodeApplication | FR-4 | 展示逐作用域事实，不生成含糊 PARTIALLY_ACTIVE |
| RuntimeHealth | FR-5/运行域 | 展示 HEALTHY/DEGRADED/PAUSED/FAILED/UNKNOWN，不改契约 |
| DeliveryEvidence | FR-5 | 展示 R0—R6/RX 与核验状态，不推断更深层事实 |

本状态表是 FR-2 的研发级单一口径，覆盖 V0.1～V0.6 中将预检失败、STALE、沙箱、灰度或健康混入订阅长状态链的示例性表达。任何修改须进入版本化状态字典并同步界面、API、事件、审计和测试。

完整转换守卫以 V0.8-03 的 FR2-RD-02 为唯一研发基线；状态同名不代表语义相同，实例只有在 `activationReadiness=READY` 且 FR-4 对该原子实例返回当前 operationEpoch 的成功执行事实后，才能由 `PENDING_ACTIVATION` 进入 `ACTIVE`。

## 6. 通道分型

| 通道 | FR-2 订阅语义 | 必需契约 | 禁止误解 |
|---|---|---|---|
| Uu-A | OEM Application 对区域服务流的 B2B 长期订阅 | Endpoint/Topic/Profile、配额、反馈、证书引用 | 城市不默认逐 VIN 管理或逐车实时选流 |
| PC5 | 指定 Coverage 内的广播发布策略 | RSU/Coverage、消息 Profile、频率、优先级、证书与时效 | 不是逐车网络订阅；车辆本地决定相关性 |
| Uu-T | 测试车/工程车短时会话 | 测试任务、轮换伪名、路线/围栏、短有效期和详细追踪 | 不代表量产架构或长期逐车关系 |
| Uu-B | OEM 授权边缘应用的局部订阅/会话 | OEM 应用、MEC、运营商/UPF、局部主题、回执和工程条件 | 未经 M0/OEM/运营商确认不作为 S1 默认能力 |

## 7. 四层追溯矩阵

| 用户故事 | 产品功能需求 | 常规研发需求 | 页面交付 | 主要跨 FR |
|---|---|---|---|---|
| US-FR2-01 形成订阅契约 | FR2-FR-01、FR2-FR-02、FR2-FR-03、FR2-FR-04、FR2-FR-06 | FR2-RD-01、FR2-RD-03、FR2-RD-04、FR2-RD-05 | FR2-P01、FR2-P02、FR2-P03 | FR-1 输入；FR-3 约束准备 |
| US-FR2-02 可解释预检 | FR2-FR-01、FR2-FR-02、FR2-FR-03、FR2-FR-05、FR2-FR-06、FR2-FR-13 | FR2-RD-03、FR2-RD-04、FR2-RD-06、FR2-RD-10 | FR2-P04、FR2-P05、FR2-P06、FR2-P14 | FR-1/3/4 事实读取 |
| US-FR2-03 可追责审批 | FR2-FR-05、FR2-FR-07、FR2-FR-08 | FR2-RD-02、FR2-RD-05、FR2-RD-06、FR2-RD-10 | FR2-P07、FR2-P08 | FR-1 权益上限；FR-4 测试要求 |
| US-FR2-04 确认激活资格 | FR2-FR-04、FR2-FR-05、FR2-FR-07、FR2-FR-08、FR2-FR-09、FR2-FR-13 | FR2-RD-02、FR2-RD-03、FR2-RD-06、FR2-RD-10 | FR2-P04、FR2-P09、FR2-P10、FR2-P14 | FR-3 配置；FR-4 资格/发布；FR-5 证据 |
| US-FR2-05 变更续期迁移 | FR2-FR-02、FR2-FR-03、FR2-FR-06、FR2-FR-09、FR2-FR-10 | FR2-RD-01、FR2-RD-02、FR2-RD-06、FR2-RD-07、FR2-RD-08 | FR2-P09、FR2-P10、FR2-P11、FR2-P12 | FR-1 重检；FR-3/4 新版本 |
| US-FR2-06 安全退出 | FR2-FR-09、FR2-FR-11、FR2-FR-13 | FR2-RD-02、FR2-RD-05、FR2-RD-06、FR2-RD-07、FR2-RD-08、FR2-RD-10 | FR2-P09、FR2-P10、FR2-P13、FR2-P14、FR2-P15 | FR-1 撤权；FR-4 控制；FR-5 工单证据 |
| US-FR2-07 运行兴趣会话 | FR2-FR-04、FR2-FR-12 | FR2-RD-02、FR2-RD-04、FR2-RD-09、FR2-RD-10 | FR2-P02、FR2-P10；完整会话页为 P1 扩展 | FR-4 匹配/运行；FR-5 证据 |
| US-FR2-08 变化与迟到收口 | FR2-FR-08、FR2-FR-09、FR2-FR-10、FR2-FR-11、FR2-FR-13 | FR2-RD-02、FR2-RD-03、FR2-RD-06、FR2-RD-07、FR2-RD-08、FR2-RD-10 | FR2-P04、FR2-P09、FR2-P10、FR2-P11、FR2-P12、FR2-P13、FR2-P14、FR2-P15 | FR-1～FR-5 |

### 7.1 V0.6 页面映射

| V0.8 交付单元 | V0.6 页面 | 形态 |
|---|---|---|
| FR2-P01～P03 | PG10 订阅申请向导 | 列表前置页＋向导＋提交步骤/弹窗 |
| FR2-P04～P08 | PG11 订阅预检与审批 | 预检子路由、Finding 抽屉、补正、审批子路由、决定弹窗 |
| FR2-P09～P14 | PG12 订阅运营与实例详情 | 列表前置页＋详情页签＋Revision/变更/退出/诊断子路由 |
| FR2-P15 | PG01 我的工作台 | 订阅待办与风险组件 |

PG11 的预检执行权限与审批决定权限必须分离；可复用同一只读组件，但不得通过一个页面权限自动获得两类动作。

### 7.2 动作级权限基线

下表定义稳定 `permissionCode` 和最小职责边界；具体人员、组织角色和委托关系由 M0 审批矩阵映射。前端的隐藏/禁用仅用于用户反馈，服务端必须再次执行 RBAC＋ABAC＋对象状态＋SoD 校验，并返回稳定 `denyReason`。

| 动作 | permissionCode | 建议责任角色 | Tenant/Environment/Object 范围 | 状态与 SoD 守卫 | 审计等级 |
|---|---|---|---|---|---|
| 查询/查看申请 | FR2.REQUEST.READ | 申请人、订阅运营、审批、审计 | 有权租户/环境/RequestRevision | 字段级 ABAC 与脱敏 | 受控读审计 |
| 创建订阅申请 | FR2.REQUEST.CREATE | OEM/TSP 申请人；有明确委托的城市运营 | 本租户、本应用、指定环境、有效权益 | 不得越权代理 | 标准写审计 |
| 编辑草稿 | FR2.REQUEST.EDIT | 申请人/获授权协作者 | 当前 DraftRevision | 正式 Revision 只读；ETag 一致 | 标准写审计 |
| 放弃未提交草稿 | FR2.REQUEST.ABANDON | 申请人/草稿 Owner | DRAFT RequestRevision | 从未提交；reasonCode 必填；不删除审计 | 高风险审计 |
| 提交申请 | FR2.REQUEST.SUBMIT | 申请人或有权代理人 | 当前 RequestRevision | CURRENT 预检、无硬阻断；不得自批 | 高风险审计 |
| 撤回已提交申请 | FR2.REQUEST.WITHDRAW | 申请人/有权代理人 | SUBMITTED/IN_REVIEW/NEEDS_INFO 且无最终决定 | reasonCode 必填；不用于 DRAFT | 高风险审计 |
| 导出申请/预检摘要 | FR2.REQUEST.EXPORT | 申请人、订阅运营、审批、审计 | 当前有权查询结果或固定 Revision | 用途、脱敏、水印和范围必填 | 敏感访问审计 |
| 查看预检/规则证据 | FR2.PRECHECK.READ | 申请、运营、审批、测试、审计 | 有权 RequestRevision/PrecheckRun/Finding | 证据正文再做字段级 ABAC | 受控读审计 |
| 执行预检 | FR2.PRECHECK.EXECUTE | 申请、运营、测试角色 | 有权 RequestRevision | 与审批决定权限分离 | 标准写审计 |
| 取消预检任务 | FR2.PRECHECK.CANCEL | 发起人、订阅运营、测试负责人 | QUEUED/RUNNING 且任务允许取消 | 不修改申请和旧结果 | 标准写审计 |
| 申请受控证据权限 | FR2.EVIDENCE.ACCESS_REQUEST | 已有规则元数据查看权的人员 | 指定 evidenceRef 和业务用途 | 不自动授予；进入有权审批 | 敏感访问审计 |
| 管理订阅补正 | FR2.REMEDIATION.MANAGE | 订阅运营、责任 Owner、验证人 | SubscriptionRemediationCase | 处理人与验证人按风险分离 | 标准写审计 |
| 验证订阅补正 | FR2.REMEDIATION.VERIFY | 独立验证人、测试或规则 Owner | PENDING_VERIFY Case | 不能验证本人处理结果；复检/证据满足规则 | 高风险审计 |
| 查看审批材料/链路 | FR2.APPROVAL.READ | 当前节点、会签、审计和获准申请人 | 固定 ApprovalCase/RequestRevision | 只读、字段脱敏 | 受控读审计 |
| 作出审批决定 | FR2.APPROVAL.DECIDE | 当前审批/会签节点有权人 | 固定 ApprovalCase/Revision | 申请人、编辑人与最终决定人 SoD | 高风险审计＋签认 |
| 审批改派/升级会签 | FR2.APPROVAL.REASSIGN | 当前节点 Owner/审批管理员 | 活动 ApprovalCase | 接收人有权；不得静默减签；期限必填 | 高风险审计 |
| 提交条件履行证据 | FR2.CONDITION.EVIDENCE.SUBMIT | ExecutionCondition Owner/获授权协作人 | 指定 ExecutionCondition | PENDING/VIOLATED/EXPIRED；证据类型、引用、hash 和用途完整 | 标准写审计 |
| 核验条件履行 | FR2.CONDITION.VERIFY | 独立核验人/规则 Owner | PENDING/VIOLATED ExecutionCondition | 不得核验本人提交结果；证据满足 evidenceRule | 高风险审计＋签认 |
| 确认条件违反 | FR2.CONDITION.BREACH.CONFIRM | 条件 Owner/合规/安全 | PENDING/SATISFIED ExecutionCondition | 违反事实、作用域、breachAction 和证据完整；与被评价方 SoD | 最高风险审计＋签认 |
| 豁免可豁免条件 | FR2.CONDITION.WAIVE | 明确授权的合规/安全角色 | 指定 ExecutionCondition | 不可豁免门禁永不开放；双人复核 | 最高风险审计 |
| 查看订阅/实例 | FR2.SUBSCRIPTION.READ | OEM 接入、运营、配置发布、运行保障、审计 | 有权 Subscription/Instance/Revision | 外部事实和证据按来源权限脱敏 | 受控读审计 |
| 导出订阅/证据 | FR2.SUBSCRIPTION.EXPORT | 运营、审计或有权 OEM | 权限内字段和数据时间范围 | 用途、脱敏模板、水印和保留期必填 | 敏感访问审计 |
| 比较 Revision | FR2.REVISION.COMPARE | OEM 接入、运营、审批、审计 | 两个均有权的不可变 Revision | 敏感字段可遮蔽但保留变化类别 | 受控读审计 |
| 查看影响快照 | FR2.IMPACT.READ | 订阅运营、相关 Owner、审计 | 有权 SubscriptionImpactSnapshot | UNKNOWN 与受限对象不泄露正文 | 受控读审计 |
| 发起变更/续期/迁移 | FR2.SUBSCRIPTION.CHANGE | OEM/TSP 申请人、订阅运营 | 当前已批准 Revision | 新 Revision；不得原位改写 | 高风险审计 |
| 准备控制影响/草稿 | FR2.CONTROL.PLAN | 订阅运营、合规、运行保障 | 有权 Subscription/Instance | 只生成 ImpactSnapshot/草稿，不执行控制 | 标准写审计 |
| 暂停 | FR2.CONTROL.PAUSE | 订阅运营/值班角色 | 最小原子实例作用域 | 普通流程审批；Break-glass 仅预授权止损 | 最高风险审计 |
| 恢复 | FR2.CONTROL.RESUME | 有权恢复批准人与执行人 | 已暂停实例 | 新依据、根因关闭、恢复测试；职责分离 | 最高风险审计＋签认 |
| 终止 | FR2.CONTROL.TERMINATE | 业务/合规有权人 | 订阅或原子实例 | 影响预览、退出清单、双重确认 | 最高风险审计＋签认 |
| 管理退出清单 | FR2.EXIT.MANAGE | 订阅运营/资源 Owner | 指定 ExitChecklist 及有权资源 | 影响快照有效；共享资源默认只解绑当前订阅 | 高风险审计 |
| 核验退出收口 | FR2.EXIT.VERIFY | 独立核验人/审计 | PENDING_VERIFY ExitChecklist | 处理人与核验人 SoD；所有必要项证据可核验 | 最高风险审计＋签认 |
| 运行五层诊断 | FR2.DIAGNOSIS.READ | OEM 接入、订阅运营、运行保障 | 有权订阅、时间、区域和通道 | 只读；不推导车辆/HMI/算法事实 | 受控读审计 |
| 创建运行工单 | FR2.RUNTIME_WORKITEM.CREATE | OEM 接入、订阅运营、运行保障 | 有权诊断输入 | 调用 FR-5 权威接口；FR-2 只保存引用 | 标准写审计 |
| 查看审计 | FR2.AUDIT.READ | 审计、合规、获准业务 Owner | 指定对象与时间范围 | 敏感字段脱敏；不可修改 | 敏感访问审计 |
| 查看工作台/关注 | FR2.WORKBENCH.READ | 各业务角色 | 本人或有权范围的联合投影 | 已读/关注不改变源对象完成状态 | 轻量操作审计 |
| 转交 FR-2 处置 | FR2.TASK.REASSIGN | 当前 Owner/FR-2 管理员 | 本租户、本环境的 SubscriptionRemediationCase | 接收人有权且委托未过期；FR-5 任务必须回源转交 | 标准写审计 |

每个页面动作必须声明 `permissionCode、visibleWhen、enabledWhen、denyReason、confirmationLevel、auditLevel`；无查看权不泄露对象存在性，有查看权但无动作权时保留只读上下文并解释申请权限或联系 Owner 的路径。

## 8. 版本切片

### 8.1 FR2-S1：单服务 Uu-A 最小闭环

待 U01/U02 签认的建议实例：一个已获权的信号灯提醒或 GLOSA ServiceVersion＋一家 OEM＋一个 ApplicationClient＋一个 OEM_CONFIRMED 能力组＋一个区域 Coverage＋一个 Uu-A 目标契约。签认前仅用沙箱/联调 fixture 验证“目标生产语义”；真实生产激活须另行通过 DVP&R、安全、OEM 及发布审批。

```text
ACTIVE+ENABLED EntitlementRevision
→ 创建订阅草稿
→ 车型/Coverage/Uu-A端点/质量/反馈/期限
→ 五层预检 CURRENT+PASS
→ 提交不可变 RequestRevision
→ 职责分离审批
→ SubscriptionRevision 获批并创建 SubscriptionInstance PENDING_ACTIVATION
→ FR-3 EffectiveConfigSnapshot CURRENT
→ FR-4 Qualification PASSED且有效
→ 发起灰度发布并读取逐目标结果
→ PG12 展示真实状态与五层只读诊断
→ 执行一次暂停/恢复或终止演练并完成证据收口
```

S1 不要求复杂批量订阅、完整 PG25、Uu-B、跨区域 Campaign 或效果归因；但不得删除状态分离、撤权优先、迟到事件、UNKNOWN、权限审计和退出闭环。

### 8.2 后续切片

| 切片 | 新增价值 | 不得放松的门禁 |
|---|---|---|
| S2 | 变更、续期、服务/空间版本迁移、新旧 Revision 切换 | Diff、SubscriptionImpactSnapshot、重检、回退与旧版本收口 |
| S3 | PC5 广播与 Uu-T 测试短会话 | 通道分型、伪名/期限、车辆本地相关性和证据边界 |
| S4 | 多 OEM、多区域、批量申请与复杂迁移 | 租户隔离、原子作用域、部分执行和 UNKNOWN |
| P1 | Uu-B 试点、完整 PG25 调试器、复杂运行兴趣 | OEM/运营商条件、隐私、安全和跨域契约 |

### 8.3 Release / Slice 单一事实源

下表为待 U01/U02 联合签认的切片建议基线。签认后，`S1` 表示本轮必须达到 DoD；`S1-F` 表示只交付支持 Uu-A 的模型、契约或禁用态骨架，完整能力以后续切片为准；`S2/S3/P1` 表示不进入 S1 DoD。页面可展示后续能力及启用前置条件，但服务端同样必须拒绝未启用能力，且不得把禁用态误算为功能已交付。

| 用户故事 | Release / Slice | S1 交付边界 |
|---|---|---|
| US-FR2-01 | S1 | 单服务 Uu-A 订阅契约 |
| US-FR2-02 | S1 | 五层准入预检和补正 |
| US-FR2-03 | S1 | 职责分离审批和条件 |
| US-FR2-04 | S1 | 待激活、资格和真实状态 |
| US-FR2-05 | S2 | S1 仅建立不可变 Revision/后继关系基础，不验收完整迁移 |
| US-FR2-06 | S1 | 至少完成一次精确暂停/恢复或终止演练 |
| US-FR2-07 | S1-F＋S3＋P1 | S1 仅声明 Uu-A matchingOwner；PC5/Uu-T 在 S3，Uu-B 在 P1 |
| US-FR2-08 | S1 | 上游变化、迟到/重复事件和部分结果保护 |

| 产品功能需求 | Release / Slice | S1 交付边界 |
|---|---|---|
| FR2-FR-01～03 | S1 | 候选、Revision、车型/时空范围 |
| FR2-FR-04 | S1＋S3＋P1 | S1 实现 Uu-A；PC5/Uu-T 为 S3，Uu-B 为 P1 |
| FR2-FR-05～09 | S1 | 预检、提交、审批、实例和单一事实 |
| FR2-FR-10 | S2 | S1 仅保留后继 Revision 与 Diff 基础 |
| FR2-FR-11 | S1 | 精确控制和退出最小闭环 |
| FR2-FR-12 | S1-F＋S3＋P1 | S1 仅 Uu-A 策略/责任声明，不建设平台逐车匹配或短会话 |
| FR2-FR-13 | S1 | 变化影响、PG12 五层只读诊断和度量 |

| 常规研发需求 | Release / Slice | S1 交付边界 |
|---|---|---|
| FR2-RD-01～06 | S1 | 聚合、状态、预检、Uu-A 范围、权限和跨 FR 编排 |
| FR2-RD-07 | S1＋S2 | S1 交付暂停/恢复或终止；变更/续期/迁移切换在 S2 |
| FR2-RD-08 | S1 | Outbox、幂等、迟到和受控重放 |
| FR2-RD-09 | S1-F＋S3＋P1 | S1 只发布/记录 Uu-A 责任策略；短会话在 S3，Uu-B 在 P1 |
| FR2-RD-10 | S1 | 契约、审计、可观测性与恢复基础 |

| 页面交付 | Release / Slice | S1 交付边界 |
|---|---|---|
| FR2-P01～P08 | S1 | Uu-A 申请、预检、补正和审批；其他通道仅禁用态说明 |
| FR2-P09～P10 | S1 | 原子实例列表和同一 Revision 事实详情；Uu-A 策略只读 |
| FR2-P11 | S1-F＋S2 | S1 支持申请/基础 Revision 对比；完整迁移影响在 S2 |
| FR2-P12 | S2 | 不进入 S1 DoD |
| FR2-P13～P15 | S1 | 精确控制、最小诊断和工作台闭环 |

### 8.4 跨切片需求的 AC 级边界

| 需求 / AC | Release / Slice | S1 处理 |
|---|---|---|
| FR2-RD-07 AC1～AC3（变更差异、续期、切换） | S2 | 仅保留对象、事件和禁用契约，不进入 S1 DoD |
| FR2-RD-07 AC4～AC5（退出真实结果与严格收口） | S1 | 进入 S1 DoD，至少完成一次精确暂停/恢复或终止演练 |
| FR2-RD-09 AC1 | S1-F＋S3＋P1 | S1 只验收 Uu-A matchingOwner=建议 OEM 域的契约骨架；PC5/Uu-T 在 S3，Uu-B 在 P1 |
| FR2-RD-09 AC2～AC4（短会话、最小化与到期关闭） | S3 | S1 不建 RuntimeSession 业务入口，后端也必须拒绝调用 |
| FR2-RD-09 AC5 | S1-F＋S3＋P1 | S1 只验收 Uu-A 外部匹配结果引用与交付证据分离；其他通道按后续切片 |

未进入当前切片的 AC 必须同时在前端、API、事件消费和定时任务入口保持不可用；只隐藏按钮不算切片隔离。

## 9. 政策与标准基线

| 依据 | 截至 2026-09-16 状态 | 对 FR-2 的使用方式 | 官方来源 |
|---|---|---|---|
| 智能网联汽车“车路云一体化”应用试点 | 试点期 2024—2026 | 订阅需支持跨主体、规模化应用与可验证闭环；不把展示链路当量产闭环 | [五部门试点通知](https://ythxxfb.miit.gov.cn/ythzxfwpt/hlwmh/tzgg/xzxk/clsczr/art/2024/art_0fc5e3e8d8bd42a4a5c788b09999c44b.html) |
| 公共数据资源授权运营实施规范（试行） | 2025-03-01 起施行 | 若涉及公共数据授权运营，订阅不得超出有权主体确定的用途、范围、期限、安全和退出边界 | [国家数据局](https://www.nda.gov.cn/sjj/xxgk/zc/xzgfxwj/0120/20250120175648588490013_pc.html) |
| 济南市公共数据授权运营办法 | 2023-12-01 起施行 | 主体、运营、使用、监督与退出以济南真实授权文件为准，平台不代替有权主体作法律决定 | [济南市政府令第286号](https://www.jinan.gov.cn/api-gateway/jpaas-jpolicy-web-server/front/info/detail?iid=111435_7325) |
| 汽车数据安全管理若干规定（试行） | 现行 | 车型、位置、反馈、逐车数据等按必要性、目的和最小化控制；不默认保存逐 VIN 和全量实时位置 | [国家网信办等五部门](https://www.cac.gov.cn/2021-08/20/c_1631049984897667.htm) |
| 网络数据安全管理条例 | 2025-01-01 起施行 | 订阅全生命周期、委托/共同处理、重要数据、安全事件、访问和审计进入横向门禁 | [国务院条例](https://www.cac.gov.cn/2024-09/30/c_1729384452307680.htm) |
| GB/T 46998-2025《道路交通管理车路协同系统信息交互接口规范》 | 现行，2026-07-01 实施 | 作为道路交通管理车路协同信息交互 Project Profile 输入；具体项目 ICD 仍需冻结 | [全国标准信息公共服务平台](https://std.samr.gov.cn/gb/search/gbDetailed?id=473EBB99D791455EE06397BE0A0ABB9A) |
| GB/T 44286.1-2024《合作式智能运输系统应用集 第1部分：车辆辅助驾驶应用集》 | 现行，2025-03-01 实施 | 信号灯、绿波、拥堵、VRU、异常停车等辅助驾驶类服务的场景、性能和数据交互 Profile 输入 | [全国标准信息公共服务平台](https://std.samr.gov.cn/gb/search/gbDetailed?id=nFojQwfWTWA%3D&mode=p) |
| GB/T 44286.2-2024《合作式智能运输系统应用集 第2部分：车辆协同驾驶应用集》 | 现行，2025-03-01 实施 | 仅映射真正的协同驾驶应用，不作为所有告警场景或通用车云接口的统称 | [全国标准信息公共服务平台](https://std.samr.gov.cn/gb/search/gbDetailed?id=208E903AB72979F3E06397BE0A0AB2B9) |
| GB/T 44417-2024《车路协同系统智能路侧协同控制设备技术要求和测试方法》 | 现行，2025-03-01 实施 | 作为智能路侧协同控制设备能力与测试输入，不泛化到全部路侧设备，也不替代信号控制机发布接口或端到端验收 | [全国标准信息公共服务平台](https://std.samr.gov.cn/gb/search/gbDetailed?id=208E903AB66A79F3E06397BE0A0AB2B9) |
| GB/T 45315-2025《基于 LTE-V2X 直连通信的车载信息交互系统技术要求及试验方法》 | 现行，2025-02-28 实施 | S3 PC5/LTE-V2X 直连场景的车载能力与试验输入；不作为 Uu-A、Uu-B、Uu-T 通用接口标准 | [全国标准信息公共服务平台](https://std.samr.gov.cn/gb/search/gbDetailed?id=2FF37940EB79D753E06397BE0A0A413F) |
| GA/T 2151-2024《道路交通车路协同信息服务通用技术要求》 | 现行，2025-01-01 实施 | 道路交通车路协同信息服务通用要求进入 Project Profile | [全国标准信息公共服务平台](https://std.samr.gov.cn/hb/search/stdHBDetailed?id=29ABD5EFA3EC9CE1E06397BE0A0A2756) |
| GA/T 1743-2020《道路交通信号控制机信息发布接口规范》 | 现行，2021-03-01 实施 | 信号灯服务核验信号控制机发布通信、格式和内容；仍需项目冻结 Movement/车道映射、时效和失效语义 | [全国标准信息公共服务平台](https://std.samr.gov.cn/hb/search/stdHBDetailed?id=B62CEA48F6BF3753E05397BE0A0A1046) |

标准“现行”不表示所有条款自动成为项目验收口径。具体采用条款、偏差、扩展、冲突和迁移规则必须进入 Project Profile；本文不是法律适用结论。

## 10. 指标与验收边界

| 类型 | 指标 | 口径 | 目标/状态 |
|---|---|---|---|
| 核心 | 首次可执行订阅达成率 | 首次提交后在办理 SLA 内形成满足激活门禁的 Revision 数 ÷ 首次提交数 | M0 建基线后签认 |
| 效率 | 申请端到端周期 | 首次提交至审批决定/`activationReadiness=READY` 的 P50/P90；两段分别统计，等待补正时间单列 | 待测 |
| 质量 | 预检可行动率 | 非通过 Finding 中含规则、事实、证据、Owner、下一动作和复检条件的比例 | 100% |
| 安全 | 无有效权益生产订阅数 | Entitlement 非 ACTIVE+ENABLED 但进入生产激活的数量 | 0 |
| 安全 | 越范围订阅/发布数 | Subscription/Release 超出有效交集的数量 | 0 |
| 一致性 | 状态/原因码不一致缺陷数 | 页面、API、事件、审计、测试对同一事实口径不一致 | 0 |
| 退出 | 退出未收口对象数 | 到期/撤销/终止后无成功、失败处置或有权例外的必要目标数 | 0 |
| 证据 | 错误越级证明数 | ACK 或网关结果被表述为车辆/HMI/算法已完成的数量 | 0 |
| 透明度 | UNKNOWN/UNVERIFIABLE 可解释率 | 未知事实有范围、原因、Owner 和下一动作的比例 | 100% |

## 11. 进入开发前必须拍板

### 11.1 治理配置单一事实源

S1 不新建通用规则管理后台，但下列配置必须在代码实现前具有可校验、可回滚的版本和明确 Owner。PG02/PG23 只按表中规则提供只读或受控管理入口，业务页面不得复制枚举或临时改规则。

| 配置对象 | 唯一事实源 / 展示入口 | Owner | 冻结与变更方式 |
|---|---|---|---|
| PrecheckRuleSetVersion | FR-2 规则仓库；PG02 只读展示采用版本 | 产品规则 Owner＋测试 | 评审签认、Schema/规则测试、版本发布；已被审批引用的版本不可覆盖 |
| ApprovalMatrixVersion | PG23 权限与审批策略域；P07/P08 固定引用 | 业务＋合规＋安全 | M0 签认、双人复核、灰度生效和可回滚；不得静默减签 |
| SoDPolicyVersion / BreakGlassPolicyVersion | PG23 权限策略域 | 安全＋合规 | 高风险变更专项评审；例外必须有范围、期限和事后复核 |
| StateDictionaryVersion / ReasonCodeVersion | 契约与Schema仓库；PG02/PG23 只读展示 | 产品＋架构＋测试 | API、事件、界面、审计和测试同步升级；兼容性检查通过后发布 |
| LifecyclePolicyVersion | Project Profile（PG02） | 产品运营＋合规 | 冻结业务时区、临期窗口、`validTo` 语义、定时频率和迟到任务规则 |
| FieldClassificationVersion / RetentionPolicyVersion | PG23 数据生命周期策略域 | 数据安全＋合规 | 字段级分类、最小化、接收方、保留/删除和访问规则评审签认 |

生命周期时间统一使用 UTC 存储、项目业务时区展示；订阅有效区间采用 `[validFrom, validTo)`，`validTo` 到达即失效。续期申请已提交不自动延长旧 Revision；只有新 Revision 在 `validTo` 前完成生效，才阻止旧实例按时到期。临期窗口和定时扫描频率由 LifecyclePolicyVersion 冻结，迟到定时事件按 revisionId＋operationEpoch 幂等忽略并保留审计。

### 11.2 项目决策项

| 决策项 | 建议 Owner | 未确认影响 | 研发门禁 |
|---|---|---|---|
| S1 首服务、OEM、ApplicationClient、能力组、区域、环境和 Uu-A 通道 | 产品＋服务 Owner＋OEM | 无法形成贯穿 fixture | 阻断 S1 业务开发与联调 |
| 城市运营是否可代理 OEM 建草稿/提交及委托规则 | 业务＋合规＋OEM | 申请责任不清 | 阻断代理操作 |
| Request、Instance、control 和 readiness 状态字典/迁移 | 产品＋架构＋测试 | 前后端状态冲突 | 阻断状态相关开发 |
| 审批矩阵、SoD、条件类型与不可豁免硬门禁 | 合规＋安全＋业务 | 越权或条件无法执行 | 阻断审批开发 |
| Coverage 类型、空间版本、时区、节假日和 ODD 规则 | 空间/服务 Owner＋OEM | 范围无法计算 | 阻断范围验收 |
| Uu-A 端点/Topic/Profile、认证、配额、反馈和证据目标 | 架构＋集成＋OEM | 只能做空壳表单 | 阻断通道联调 |
| FR-3/4/5 对象、事件、完成边界、SLA 与补偿 | 架构＋各 FR Owner | ACTIVE/暂停/证据无法判定 | 阻断端到端验收 |
| P95/P99、峰值、超时、重试、RTO/RPO、留存 | 架构＋运维＋安全 | NFR 无法验收 | 可做 Spike，阻断生产准出 |
| 高风险场景 DVP&R、测试有效期和恢复规则 | 测试＋安全＋OEM | 不具备生产资格 | 阻断高风险激活 |
| 代码仓库、分支、技术栈和仅平台端授权 | 项目＋研发负责人 | 修改范围不明确 | 阻断任何代码变更 |

## 12. FR-2 Definition of Ready

每条进入开发的故事必须同时满足：

- 已签认 DevelopmentStartDecision，明确仓库、分支、技术栈、环境、首批 StoryId/适用 AC、Mock 边界、禁改项和验收人；
- 本故事适用的 M0/U01 决策与 S1/U02 对象链已有结论、依据、Owner、生效日和签认引用，不得用文档建议值代替；
- S1 对象实例和固定 Revision/ID 已建立，所有样本明确标记 fixture 而非真实决定；
- 四层追溯已通过自动或可重复校验，不存在孤立用户故事、功能需求、研发需求、页面交付或相互矛盾的关联声明；
- 上游 FR-1 权益、服务、能力、空间、协议和接入对象可读取且责任人明确；
- 状态、转换、组合、reasonCode 和用户文案使用同一版本化字典；
- 每个跨域对象已签认唯一 Owner、权威 API/事件、只读投影、状态转换守卫和完成边界；
- 页面字段、动作、权限、六态、深链和返回上下文均已冻结；
- OpenAPI/AsyncAPI、Mock、ViewModel、ETag、幂等和异步任务契约可校验；
- 正常、越权、并发、重复、迟到、过期、撤销、部分成功、UNKNOWN 测试夹具齐备；
- FR-3/FR-4/FR-5 的模拟或真实依赖具有明确完成边界，HTTP 200/ACK 不替代业务终态；
- 涉及车辆、位置、路线、围栏、会话、证据或导出的字段已完成字段级分类、必要性、精度、接收方、保留、删除和访问策略签认；
- 未决项不会改变本故事对象、状态、权限、契约或验收；
- DevelopmentStartDecision 已授权目标故事的平台端代码范围，移动端、车端和 OEM 系统保持零改动。

## 13. FR-2 Definition of Done

每条故事只有同时满足以下条件，才可标记为研发完成：

- 签认切片内适用的用户故事 AC、产品功能 AC、常规研发 AC 和页面验收结果已建立测试追溯，正常、异常、权限、并发和六态用例全部通过；后续切片入口已在前后端共同关闭；
- 状态、转换、组合、reasonCode、字段枚举和用户文案来自同一版本化基线，前端、后端、事件、Mock、审计和自动化测试不存在口径差异；
- 正式 Revision 不可变、乐观并发、幂等、重复/乱序/迟到事件、超时、部分成功、UNKNOWN、补偿和受控重放均有自动化或可重复验证证据；
- 多租户隔离、RBAC＋ABAC、职责分离、敏感字段脱敏、导出审计和高风险动作复核通过安全测试；
- FR-1 输入门禁以及 FR-3/FR-4/FR-5 的 Mock、契约测试或已批准集成测试通过，且 HTTP 200、任务接受和事件 ACK 未被当作业务终态；
- P01～P15 中属于该故事的字段、动作、权限、深链、返回上下文及 Loading、Empty、Error、Partial、No Permission、Conflict 六态均有可重复页面验收证据；
- 日志、指标、链路追踪、审计、告警、死信和业务对账能够按 subscriptionId、revisionId、operationEpoch 和 traceId 关联；
- 性能、容量、超时、重试、留存、RTO/RPO 只按已签认 M0 基线验收；尚未签认时必须保持未决，不得写成已达标；
- 文档、OpenAPI/AsyncAPI、状态字典、测试夹具、迁移说明和变更记录已同步，相关 Owner 完成产品、研发和测试签认；
- 实现仅修改已授权的平台端范围，移动端、车端和 OEM 系统保持零改动；任何跨边界依赖均以接口、Mock 或对方确认的证据验收。

达到 DoD 只表示该故事在指定环境和证据范围内完成，不自动代表 DVP&R、OEM 量产准出、全区域生产发布或车辆/HMI/算法效果已经成立。

## 14. 推荐研发顺序

1. 冻结本文件第 5 节状态字典、第 6 节通道分型和第 11 节 S1 决策；
2. 建立 FR2-RD-01/02/05/08/10：Revision、状态、权限、事件和契约基础；
3. 交付 P01～P08：申请、预检、补正和职责分离审批；
4. 建立 FR2-RD-06/07：FR-3/4/5 激活和退出编排；
5. 在 S1 交付 P09、P10、P13～P15 及 P11 的 S1-F 能力：实例事实、退出、诊断、工作台和基础 Revision 对比；P12 与 P11 的完整迁移能力留到 S2；
6. 用一条 S1 fixture 完成申请→预检→审批→待激活→配置→测试→灰度→证据→暂停/恢复或终止演练；
7. S1 验收后先交付 S2 的 P11/P12 完整变更迁移，再扩 PC5/Uu-T、多 OEM/多区域和 P1 调试器。

本套 V0.8 完成了 V0.7 的 FR-2 文档阻断补齐，但不自动关闭 M0 决策、真实 S1 实例、API/Mock、环境、DVP&R 和代码授权门禁。只有对应故事满足 DoR，才可从“文档评审”转为“研发已授权”。

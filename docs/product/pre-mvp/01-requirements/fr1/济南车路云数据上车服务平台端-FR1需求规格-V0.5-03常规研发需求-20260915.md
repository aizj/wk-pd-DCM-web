# FR-1 常规研发需求

> 文档版本：V0.5  
> 本文只表达 HOW：服务端、规则执行、状态、版本、事件、权限、审计和跨 FR 集成要求。页面交付项见 V0.5-04。

---

## 研发需求：RD-01 版本化事实注册与不可变快照

关联功能需求：FR-01、FR-02、FR-05、FR-06、FR-07、FR-09、FR-11、FR-12

### 需求描述

建设统一的版本化事实能力，为 ProjectProfile、ProvisionAuthority、DataProduct、QualityPolicy、ServiceVersion、ServiceOffering、VehicleCapability、EntitlementRequest 和 ServiceEntitlement 保存稳定业务标识、不可变版本、内容摘要、替代关系及证据引用。

当可变草稿被提交、批准、发布、确认或生效时，系统应根据对象类型固化不可变快照并生成内容哈希；当已固化内容需要变化时，系统应创建新版本或新修订，不得覆盖原记录。所有写入需使用版本号或 ETag 防止静默覆盖。

### 数据与状态

| 对象类别 | 草稿/流程状态 | 固化状态 | 版本规则 |
|---|---|---|---|
| ProjectProfile | DRAFT、IN_REVIEW | FROZEN、SUPERSEDED | 冻结后不可修改 |
| ProvisionAuthority | DRAFT、SUBMITTED、IN_REVIEW | ACTIVE、SUSPENDED、EXPIRED、REVOKED、SUPERSEDED | 范围或证据变化新 Revision |
| Data/Quality/Service/Offering | DRAFT、VALIDATING、IN_REVIEW | PUBLISHED/APPROVED、DEPRECATED、RETIRED | 发布后新 Version |
| VehicleCapability | DRAFT、SUBMITTED | OEM_CONFIRMED、SUPERSEDED、EXPIRED、WITHDRAWN | OEM 确认后不可修改 |
| EntitlementRequest | DRAFT、SUBMITTED、IN_REVIEW | APPROVED、CONDITIONALLY_APPROVED、REJECTED、WITHDRAWN | 提交后变化新 Revision |
| ServiceEntitlement | PENDING_ACTIVATION | ACTIVE、SUSPENDED、EXPIRED、REVOKED、TERMINATED、SUPERSEDED | 范围/条件变化新 Revision |

### 验收标准

#### AC1：不可变快照

当对象进入固化状态时，系统应保存完整内容、版本、内容哈希、操作者、时间和上游引用，后续更新不得改变原哈希。

#### AC2：并发写入

当两个操作者基于同一旧 ETag 保存草稿时，系统应只接受第一个有效写入，并向后一个返回版本冲突和差异依据。

#### AC3：新版本替代

当已固化对象需要变化时，系统应创建新版本并记录 `supersedes/supersededBy`，旧版本仍可读取。

#### AC4：引用固定

当下游对象引用上游事实时，系统应保存具体版本或修订，不得仅保存可能漂移的业务主标识。

#### AC5：历史保留

当对象退役、撤回或撤销时，系统应禁止新增业务引用但保留历史事实和审计访问能力。

## 研发需求：RD-02 数据提供权规则评估引擎

关联功能需求：FR-02、FR-03、FR-07、FR-11、FR-12

### 需求描述

建设可版本化、可重放的数据提供权评估能力，按主体、接收对象、用途、服务/数据/字段、区域、环境、时间、派生、再提供和附加条件逐维计算允许交集。

当 ServiceVersion 送审、Offering 上架、权益预检/审批或数据提供依据变化时，系统应根据固定输入版本、规则版本和评估时点生成不可变 AuthorityEvaluation，并返回总体结果、逐维事实、证据、原因码、Owner、下一动作和可允许交集。

### 数据与状态

| 数据/状态 | 取值或要求 | 说明 |
|---|---|---|
| evaluationResult | ALLOW、ALLOW_WITH_CONDITIONS、DENY、INCONCLUSIVE | 与对象生命周期分离 |
| inputSnapshot | request、authority revisions、ruleVersion、evaluatedAt | 支持确定性重放 |
| dimensionResult | expected、actual、evidence、result、reasonCode | 逐维可解释 |
| allowedIntersection | 结构化最小交集 | 空值不可代表全部 |
| evaluationValidity | CURRENT、STALE、EXPIRED、INVALIDATED | 上游变化后保留旧结果 |

### 验收标准

#### AC1：确定性

当输入快照、规则版本和评估时点相同时，系统应生成相同总体结论、逐维结果和内容哈希。

#### AC2：默认阻断

当任一强制维度无法核验时，系统应返回 INCONCLUSIVE，并拒绝生产准入，不得转换为警告后放行。

#### AC3：多依据冲突

当候选依据互相冲突或无法形成完整交集时，系统应返回冲突原因和来源，不得自动拼接为允许范围。

#### AC4：条件承接

当结果为 ALLOW_WITH_CONDITIONS 时，系统应校验所有机器可执行条件均被目标 Offering 或 EntitlementRevision 承接，否则返回阻断。

#### AC5：结果保护

当人工请求直接更改 DENY/INCONCLUSIVE 结果时，系统应拒绝；仅在事实、证据或规则产生新版本后允许重新评估。

## 研发需求：RD-03 依赖图、影响快照与退出编排

关联功能需求：FR-04、FR-08、FR-12

### 需求描述

建设跨 ProjectProfile、ProvisionAuthority、DataProduct、ServiceVersion、Offering、VehicleCapability、CompatibilityAssessment、ServiceEntitlement 以及 FR-2/FR-4 对象的版本化依赖图与影响编排能力。

当授权、服务、能力或权益到期、收窄、暂停、撤销、弃用、退役或被替代时，系统应根据当时依赖版本计算影响范围，冻结 ImpactAssessmentSnapshot，创建处置任务，并通过下游回执持续更新闭环状态。紧急撤权应优先发送最小范围停发请求。

### 数据与状态

| 对象 | 关键数据 | 状态 |
|---|---|---|
| DependencyEdge | sourceRef、targetRef、relationType、validity | ACTIVE、STALE、UNKNOWN |
| ImpactAssessmentSnapshot | triggerRef、diff、knownTargets、unknownTargets、calculatedAt、hash | CALCULATING、READY、BLOCKED_BY_UNKNOWN、FROZEN |
| ClosureTask | targetRef、action、owner、deadline、receipt | OPEN、IN_PROGRESS、SUCCEEDED、FAILED、WAIVED |
| ClosureCase | impactSnapshotRef、requiredCount、openCount、unknownCount | OPEN、PARTIAL、COMPLETED、ESCALATED |

### 验收标准

#### AC1：影响快照

当高风险变化被提交执行时，系统应先生成包含已知对象、未知依赖、计算版本和内容哈希的冻结快照。

#### AC2：精确停发

当紧急撤权生效时，系统应向 FR-4 发送可计算的服务、权益、Coverage、环境和生效时点，不得只发送“全部停止”。

#### AC3：未知依赖

当依赖图存在 UNKNOWN 时，系统应将高风险操作置为阻断或按已批准失败安全策略执行，并创建人工核查任务。

#### AC4：闭环判定

当通知已送达但必处置对象仍无成功回执时，系统应保持 ClosureCase 未完成并按超时策略升级。

#### AC5：恢复编排

当新的有效依据允许恢复时，系统应创建独立恢复决定与任务，校验不得由原紧急执行人单独完成，并保留撤权链路。

## 研发需求：RD-04 数据产品血缘、质量与备源控制

关联功能需求：FR-05、FR-06

### 需求描述

建设 DataProductVersion、DataFeedAuthorization、Schema/Semantic Profile、LineageGraph、QualityPolicyVersion、QualityAssessment 和 FallbackPlan 的服务端管理与校验能力。

当数据产品送审或服务运行资格被检查时，系统应验证来源依据、Schema/语义、血缘、分类和质量策略；当实时质量不满足时，系统应根据固定策略输出抑制、降级或切换建议。只有独立通过授权、语义和质量校验的备源才能进入切换候选。

### 数据与状态

| 对象 | 关键数据 | 状态/结果 |
|---|---|---|
| DataProductVersion | sourceRefs、schemaHash、semanticRef、lineageHash、class、policyRef | DRAFT、VALIDATING、PUBLISHED、INVALIDATED、RETIRED |
| QualityPolicyVersion | metric、unit、window、thresholdBasis、unknownAction、degradeAction、recoveryRule | DRAFT、IN_REVIEW、APPROVED、SUPERSEDED |
| QualityAssessment | policyVersionRef、observedFacts、window、result | PASS、FAIL、UNKNOWN、STALE |
| FallbackCandidate | sourceRef、authorityResult、semanticResult、qualityResult、priority | ELIGIBLE、INELIGIBLE、STALE |

### 验收标准

#### AC1：发布校验

当数据产品送审时，系统应同时校验来源依据、Schema/语义、血缘、分类和质量策略，任一硬门禁缺失则拒绝发布。

#### AC2：字段级血缘

当请求追溯某个输出字段时，系统应返回其原始来源、处理步骤、算法/地图版本和授权引用。

#### AC3：策略与事实分离

当实时质量变化时，系统应创建新的 QualityAssessment，不得更改已批准 QualityPolicyVersion。

#### AC4：备源切换

当主源不可用时，系统应仅选择 ELIGIBLE 备源；若无合格备源，则输出已批准的抑制或降级动作。

#### AC5：未知质量

当测量数据、时钟或空间映射不足时，系统应生成 UNKNOWN，并执行策略规定的失败安全动作。

## 研发需求：RD-05 服务契约、Offering 与生命周期处理

关联功能需求：FR-06、FR-07、FR-08

### 需求描述

建设 ServiceProduct、ServiceVersion、SceneCapabilityVersion、OutputProductVersion、CapabilityRequirementProfileVersion、ServiceOfferingVersion 和 ServiceBundleVersion 的聚合校验与生命周期能力。

当服务或 Offering 送审时，系统应根据 ProjectProfile 校验 13 类最小契约、依赖关系、循环引用、版本兼容、数据提供权和治理等级门禁；当服务弃用或退役时，系统应计算存量关系并执行迁移/退出门禁。

### 数据与状态

| 对象 | 生命周期 | 独立控制/规则 |
|---|---|---|
| ServiceVersion | DRAFT、VALIDATING、IN_REVIEW、APPROVED、PUBLISHED、DEPRECATED、RETIRED | governanceLevel、contractCompleteness、dependencyValidity |
| ServiceOfferingVersion | DRAFT、IN_REVIEW、PUBLISHED、SUSPENDED、DEPRECATED、RETIRED | catalogVisibility、eligibilityResult |
| ServiceBundleVersion | DRAFT、VALIDATING、PUBLISHED、DEPRECATED、RETIRED | ATOMIC、PARTIAL_ALLOWED |
| MigrationPlan | PLANNED、ACTIVE、COMPLETED、BLOCKED、CANCELLED | replacementRef、deadline、exceptionPolicy |

### 验收标准

#### AC1：契约校验

当 ServiceVersion 送审时，系统应校验 13 类最小契约、引用版本和治理等级门禁，并返回所有阻断项及 Owner。

#### AC2：循环与冲突

当服务依赖形成循环或版本范围冲突时，系统应拒绝发布并返回完整冲突链。

#### AC3：Offering 范围

当 Offering 超出服务契约或数据提供权时，系统应拒绝上架并返回越界维度与可允许交集。

#### AC4：退役门禁

当 ServiceVersion 仍有未处置 Offering、权益、订阅或运行对象时，系统应拒绝 RETIRED 转换。

#### AC5：组合履约

当 Bundle 被申请时，系统应按必选/可选和 ATOMIC/PARTIAL_ALLOWED 规则逐项计算，返回组件级结果而非单一笼统成功。

## 研发需求：RD-06 OEM 能力摄入与兼容评估处理

关联功能需求：FR-09、FR-10

### 需求描述

建设 OEM 能力模板、受控导入、范围冲突检查、OEM 有权确认、能力版本有效性、兼容评估和 GapFinding 处理能力。城市租户不得写入 OEM 事实域。

当能力版本被确认或服务要求、ProjectProfile、能力证据发生变化时，系统应运行或失效对应 CompatibilityAssessment；评估需固化输入快照，逐项比较 hard/soft 要求，并将差距分配给 OEM、服务、Profile 或联合测试责任方。

### 数据与状态

| 对象 | 状态/结果 | 说明 |
|---|---|---|
| VehicleCapabilityProfileVersion | DRAFT、SUBMITTED、OEM_CONFIRMED、SUPERSEDED、EXPIRED、WITHDRAWN | OEM 事实域不可由城市改写 |
| CompatibilityAssessment.runStatus | QUEUED、RUNNING、COMPLETED、FAILED、CANCELLED | 与业务结论分离 |
| CompatibilityAssessment.result | COMPATIBLE、CONDITIONAL、INCOMPATIBLE、INCONCLUSIVE | hard UNKNOWN 不得 COMPATIBLE |
| CompatibilityAssessment.validity | CURRENT、STALE、EXPIRED、INVALIDATED | 输入变化后保留旧结果 |
| GapFinding | OPEN、IN_PROGRESS、RESOLVED、ACCEPTED_WITH_AUTHORITY、REJECTED、EXPIRED | 必须有 Owner 和复检 |

### 验收标准

#### AC1：租户与事实域隔离

当城市角色尝试写入 OEM 能力事实时，系统应在服务端拒绝并记录审计，不依赖前端隐藏控制。

#### AC2：范围冲突

当两个能力版本对同一车型/软件范围重叠且无明确优先级时，系统应阻断确认并返回冲突范围。

#### AC3：确定性评估

当输入版本和规则版本相同时，系统应生成相同逐项结果、总体结论、Gap 和内容哈希。

#### AC4：硬性未知

当任一 hard 要求为 UNKNOWN 或证据失效时，系统应返回 INCONCLUSIVE 并创建阻断性 Gap。

#### AC5：输入变化

当服务要求、能力版本、Profile 或证据被替代/撤回/到期时，系统应把相关结果置为 STALE 并生成复检范围。

## 研发需求：RD-07 权益申请、审批与激活状态处理

关联功能需求：FR-11、FR-12、FR-04、FR-08

### 需求描述

建设 EntitlementRequest、ApprovalCase、ServiceEntitlement、EntitlementRevision 和 EntitlementCondition 的状态机与交集固化能力，并向 FR-2 提供唯一可用权益事实。

当申请提交时，系统应固化申请修订并预检；当审批决定发生时，系统应重新校验依赖、计算最终交集并生成权益修订。条件批准需区分限制、激活前提与持续义务，只有生命周期为 ACTIVE、控制状态为 ENABLED 且依赖当前有效时才可交给 FR-2。

### 数据与状态

| 对象 | 状态 | 关键约束 |
|---|---|---|
| EntitlementRequest | DRAFT、SUBMITTED、IN_REVIEW、NEEDS_INFO、APPROVED、CONDITIONALLY_APPROVED、REJECTED、WITHDRAWN、REQUEST_EXPIRED | 提交后变化新 Revision |
| ServiceEntitlement.lifecycle | PENDING_ACTIVATION、ACTIVE、EXPIRING、SUSPENDED、EXPIRED、REVOKED、TERMINATED、SUPERSEDED | 与 controlStatus 分离 |
| ServiceEntitlement.controlStatus | ENABLED、PAUSED、BLOCKED | 表达当前能否继续使用 |
| EntitlementCondition | PENDING、SATISFIED、BREACHED、EXPIRED、CANCELLED | 类型为限制、激活前提、持续义务 |
| DependencyValidity | CURRENT、STALE、INVALID | 任一关键依赖非 CURRENT 不得新激活 |

### 验收标准

#### AC1：提交快照

当申请提交时，系统应固化应用、环境、Offering、用途、Coverage、能力、期限、数量和证据摘要，后续修改生成新 Revision。

#### AC2：交集固化

当审批决定通过时，系统应将申请、Offering、数据提供权、协议和兼容结果的最小交集固化为 EntitlementRevision。

#### AC3：部分批准

当最终交集小于申请范围时，系统应等待申请方确认新 Request Revision；未确认不得生成 ACTIVE 权益。

#### AC4：条件激活

当任一激活前提为 PENDING/EXPIRED 时，系统应保持 PENDING_ACTIVATION 且拒绝 FR-2 的生产使用请求。

#### AC5：暂停与撤销

当权益被暂停、撤销、到期或条件违约时，系统应更新控制状态、生成新修订或终态事件，并触发 FR-2/FR-4 最小范围收口。

## 研发需求：RD-08 统一权限、职责分离与证据审计

关联功能需求：FR-01、FR-02、FR-05、FR-06、FR-09、FR-11、FR-12

### 需求描述

建设服务端统一 RBAC+ABAC、租户隔离、职责分离、紧急预授权、敏感证据访问和不可抵赖审计能力。权限判断至少考虑租户、主体/应用、环境、服务/Offering、数据分类、Coverage、治理等级、动作风险和委托有效期。

当用户执行创建、提交、批准、确认、导出、收窄、撤销、退役或恢复等动作时，系统应进行对象级授权和 SoD 校验；当读取或导出敏感证据时，系统应按目的、分类和范围执行脱敏、水印、审批与审计。

### 数据与状态

| 对象 | 关键数据 | 约束 |
|---|---|---|
| AccessDecision | subject、tenant、action、resource、scope、purpose、policyVersion、result | DENY 默认，不信任客户端判断 |
| Delegation | grantor、grantee、scope、validFrom/To、reason | 到期自动失效 |
| SoDException | conflictingRoles、approver、scope、expiry、mitigation | 不允许永久默认例外 |
| BreakGlassCase | actor、preAuthorizedScope、reason、action、secondReview、restoreApprover | 只可止损，不可扩大权利 |
| AuditRecord | actor、action、objectVersion、before/after hash、time、result、reason、traceId | 追加写、分级读取 |

### 验收标准

#### AC1：对象级越权

当用户越过租户、对象、环境、Coverage 或治理等级范围时，系统应拒绝请求并生成不含敏感正文的审计记录。

#### AC2：职责冲突

当同一自然人尝试完成需要分离的经办与最终批准且无有效 SoDException 时，系统应拒绝。

#### AC3：紧急止损

当预授权值班人执行 Break-glass 时，系统应限制为最小止损范围、通知第二复核人，并禁止其单独恢复或授予新权利。

#### AC4：敏感证据

当无相应用途和数据分类权限的用户读取或导出证据时，系统应拒绝；合法导出应带脱敏、水印和审计。

#### AC5：审计故障

当高风险动作的审计写入失败时，系统应按风险策略阻断或进入受控降级，不得无记录完成动作。

## 研发需求：RD-09 领域事件、幂等、顺序与跨 FR 交接

关联功能需求：FR-03、FR-04、FR-05、FR-08、FR-09、FR-10、FR-11、FR-12

### 需求描述

建设 FR-1 领域事件、Outbox 可靠发布、消费幂等、同对象版本顺序、迟到事件抑制、重试/死信和跨 FR 交接契约。每个事件携带事件标识、聚合标识、版本、发生/生效时间、内容摘要、原因和追踪标识。

当授权、数据产品、服务、Offering、能力、兼容或权益发生有效变化时，系统应在业务提交与事件记录一致的前提下发布事件；当重复、乱序或迟到事件到达时，消费方应根据聚合版本和有效时点保证撤销、失效和更高版本优先。

### 数据与状态

| 类别 | 关键事件 | 顺序/失败安全要求 |
|---|---|---|
| 规则与授权 | ProjectProfileFrozen、ProvisionAuthorityEffective/Narrowed/Revoked/Expired | 撤销与更高 Revision 优先 |
| 数据与服务 | DataProductPublished/Invalidated、ServiceVersionPublished/Deprecated/Retired、OfferingPublished/Suspended/Retired | 失效不删除历史，目录按版本失效 |
| 能力与兼容 | CapabilityConfirmed/Superseded/Expired/Withdrawn、CompatibilityCompleted/Stale | 只有 OEM 源可确认，输入变化后旧结论失效 |
| 权益 | EntitlementRequested/Granted/Activated/Suspended/Revoked/Expired | 撤销优先于迟到批准，按 Revision 幂等 |
| 影响闭环 | ImpactClosureIncomplete/Completed | 必处置项未完成不得发 Completed |

### 验收标准

#### AC1：原子记录

当业务状态成功提交时，系统应同时形成待发布事件记录；若业务提交失败，则不得产生可消费的成功事件。

#### AC2：重复请求

当相同幂等键重复提交、批准、确认或撤销时，系统应返回同一业务结果且只产生一次有效状态变化。

#### AC3：迟到批准

当撤销已生效后收到旧批准或旧确认事件时，系统应忽略业务变化、保留技术审计并返回被更高版本替代的原因。

#### AC4：失败重试

当事件投递或消费失败时，系统应按策略重试并在超过阈值后进入死信/人工处置，不得将未送达视为闭环。

#### AC5：FR-2/FR-4 交接

当 FR-2 请求生产使用时，系统应只返回 ACTIVE+ENABLED、关键依赖 CURRENT 的 EntitlementRevision；当权益失效时，应向 FR-4 提供精确范围、生效时点和原因并接收处置回执。


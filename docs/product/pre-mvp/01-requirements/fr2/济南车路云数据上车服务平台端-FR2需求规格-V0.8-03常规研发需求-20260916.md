# FR-2 常规研发需求

> 文档版本：V0.8  
> 本文用于后端、规则、集成、安全和测试拆单。需求描述侧重系统处理、对象、状态、事件、幂等和跨 FR 协作；页面字段与交互见 V0.8-04。  
> 状态基线：本文件对 FR-2 的详细状态拆分优先于 V0.1～V0.6 中的产品级示例；`APPROVED ≠ READY ≠ ACTIVE`，预检执行、业务结论和有效性必须分开。
> Release/Slice：以 V0.8-00 第 8.3～8.4 节为唯一事实源；S1/Uu-A 是待 U01/U02 签认的建议基线，跨切片研发需求按 AC 级边界验收。
> 开工边界：本文不构成代码授权；只有目标 StoryId/适用 AC 通过 DoR 且 DevelopmentStartDecision 签认后才可编码。移动端、车端和 OEM 系统零改动，跨 FR 只通过接口、Mock、只读投影或已确认事实协作。

---

## 研发需求：FR2-RD-01 订阅聚合、不可变 Revision 与并发幂等

关联功能需求：FR2-FR-01、FR2-FR-02、FR2-FR-06、FR2-FR-09、FR2-FR-10。

### 需求描述

本研发需求实现 SubscriptionRequest、ServiceSubscription、SubscriptionRevision 和 SubscriptionInstance 的稳定标识、不可变版本、并发保护与幂等处理，覆盖草稿保存、正式提交、后继修订、续期、迁移、替代和历史引用。当申请人保存草稿时，系统应根据租户、对象权限和版本令牌更新当前可编辑草稿，并返回新的版本令牌；当申请人提交、审批形成契约或运营人员创建生产语义变更时，系统应固定全部输入引用、规范化范围、内容哈希和来源关系，生成不可变 Revision，并通过幂等键保证重复请求只产生一个业务结果。任何正式 Revision 均不得原位修改或被最后写入覆盖。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 状态/版本规则 | 外部交互 / 边界 |
|---|---|---|---|---|
| SubscriptionRequest | requestId、tenantId、applicationClientId | 稳定 ID；仅当前草稿可编辑 | 一个 Request 可有多个 RequestRevision | 不代表已获批订阅 |
| SubscriptionRequestRevision | revision、baseRevision、payloadHash、etag | 提交后不可变 | DRAFT 修订可保存；正式修订只读 | 引用固定 PrecheckRun |
| ServiceSubscription | subscriptionId、currentApprovedRevisionId、targetRevisionId、currentEffectiveRevisionId | 稳定关系；最后一项仅在必要实例收敛时有值 | 混跑期间不得用单一指针代表全部实例 | 不保存发布/车辆事实 |
| SubscriptionRevision | revision、effectiveScopeHash、approvedAt、validFrom、validTo、contentHash | 获批后不可变 | 不设置可与实例生命周期混淆的通用 status/validity | 引用 FR-1 权益和 FR-3/4 结果 |
| SubscriptionInstance | instanceId、instanceKeyHash、effectiveRevisionId、applicationClientId、serviceVersionId、environment、atomicScopeHash、channelType、supersededByInstanceId | instanceKeyHash 固定身份；effectiveRevisionId 可按成功切换推进 | 不使用一个实例表达跨区或跨通道部分成功 | 执行事实来自 FR-4 |
| IdempotencyRecord | actor、operation、idempotencyKey、requestHash、resultRef | 同键同内容返回原结果 | 同键不同内容拒绝并审计 | 保存期限按 M0 基线 |

* 规范化范围必须固定类型、空间版本、方向、时段、通道、用途和排序，避免同义输入绕过重复识别。
* `payloadHash` 相同不替代权限校验；每次读取和操作仍按当前主体与作用域授权。
* 同一 aggregateRevision 出现不同 payloadHash 时进入争议处置，不采用最后写入覆盖。
* `currentApprovedRevisionId` 表示最新获批契约，`effectiveRevisionId` 表示每个实例实际执行版本；只有全部必要实例完成切换或取得有权例外，才更新订阅级 `currentEffectiveRevisionId`。混跑期间以 `MIXED_REVISION_VIEW` 作为界面标签而非业务状态，并逐实例展示剩余作用域。
* `instanceKeyHash = tenant＋applicationClient＋serviceVersion lineage＋environment＋atomicCoverage＋channel`。新旧 Revision 的 key 相同则保留 instanceId 并只在 FR-4 成功后推进 effectiveRevisionId；key 变化则创建 successorInstance，旧实例仅在后继 ACTIVE 且旧作用域收口后进入 SUPERSEDED。两种路径不得混用。

### 验收标准

#### AC1：正式修订版不可变

在申请已提交或订阅修订版已批准的前置条件下，  
当任何角色尝试原位修改正式内容时，  
系统应产生拒绝结果并指向创建后继 Revision 的路径，  
并满足原内容、哈希、引用和审计记录保持不变的要求。

#### AC2：乐观并发保护

在两个操作者基于同一旧草稿版本处理的前置条件下，  
当后提交者保存时，  
系统应产生版本冲突、当前版本和字段差异，  
并满足不覆盖先提交结果、可基于最新版本重试的要求。

#### AC3：重复提交幂等

在同一主体、操作、幂等键和内容重复提交的前置条件下，  
当系统再次处理请求时，  
系统应返回首次生成的业务对象和结果，  
并满足不重复创建 Revision、审批任务、事件或外部调用的要求。

#### AC4：同键异内容拒绝

在相同幂等键已关联不同请求内容的前置条件下，  
当新请求到达时，  
系统应产生冲突错误和可追溯审计，  
并满足不执行任何业务写入或外部副作用的要求。

#### AC5：替代关系完整

在新 Revision 完成批准且必要实例按计划切换的前置条件下，  
当系统推进订阅级有效 Revision 时，  
系统应保存 base、supersedes、renewalOf 或 migrationFrom 关系，并逐实例记录 effectiveRevisionId，  
并满足部分切换时不提前移动全局有效指针、历史 Revision 与当时执行证据仍可读取的要求。

## 研发需求：FR2-RD-02 分离状态机、转换守卫与组合约束

关联功能需求：FR2-FR-02、FR2-FR-05、FR2-FR-06、FR2-FR-07、FR2-FR-08、FR2-FR-09、FR2-FR-11、FR2-FR-12。

### 需求描述

本研发需求实现申请流程、预检执行、预检业务结论、结果有效性、审批、订阅实例生命周期、控制、激活资格和短时会话的独立状态机及组合约束。当用户或外部事件触发状态变化时，系统应根据当前 Revision、角色权限、转换守卫、effectiveAt、operationEpoch 和依赖有效性执行合法迁移，更新对应状态族并记录原因；系统不得通过修改一个总状态推导其他状态族，也不得使用发布、健康或证据结果覆盖订阅契约事实。

### 数据与状态

| 状态对象/维度 | 状态枚举 | 关键约束 | 不得替代 |
|---|---|---|---|
| RequestRevision lifecycle | DRAFT、SUBMITTED、IN_REVIEW、NEEDS_INFO、APPROVED、CONDITIONALLY_APPROVED、REJECTED、WITHDRAWN、ABANDONED、REQUEST_EXPIRED、SUPERSEDED | 状态属于申请 Revision；ABANDONED 仅用于未提交草稿；正式终态后只可创建后继 Revision | PrecheckRun、SubscriptionInstance |
| Precheck runStatus | QUEUED、RUNNING、COMPLETED、FAILED、CANCELLED、TIMED_OUT | 仅表达执行过程 | outcome、validity |
| Precheck outcome | PASS、PASS_WITH_CONDITIONS、BLOCKED、INCONCLUSIVE | 仅在运行完成后形成 | runStatus、validity |
| Precheck validity | CURRENT、STALE、EXPIRED、INVALIDATED | 输入变化或时效独立处理 | outcome |
| ApprovalCase | PENDING、IN_REVIEW、APPROVED、CONDITIONALLY_APPROVED、RETURNED、REJECTED、CANCELLED、EXPIRED | 决定引用固定 RequestRevision | 订阅激活 |
| Instance lifecycle | PENDING_ACTIVATION、ACTIVE、EXPIRING、EXPIRED、REVOKED、TERMINATED、SUPERSEDED | 每个实例对应原子执行作用域；不存在 lifecycle READY | control、release、health、activationReadiness |
| controlStatus | ENABLED、PAUSE_REQUESTED、PAUSED、RESUME_REQUESTED、STOP_REQUESTED、STOPPED | 结果依赖 FR-4 回执；硬门禁阻断由 activationReadiness 表达 | lifecycle、health、activationReadiness |
| activationReadiness | NOT_EVALUATED、EVALUATING、READY、BLOCKED、STALE | 由配置、测试、条件和依赖计算 | lifecycle、releaseStatus |
| RuntimeSession | CREATED、ACTIVE、EXPIRING、CLOSED、TIMED_OUT、REVOKED | 匹配和投递结果另存 | 长期订阅状态 |
| ExecutionCondition | PENDING、SATISFIED、VIOLATED、EXPIRED、WAIVED | 来源、证据、豁免与违反历史不可丢失 | 预检候选、审批状态 |
| SubscriptionChange | DRAFT、IN_REVIEW、APPROVED、REJECTED、CANCELLED | 变更/续期/迁移的计划流程 | Revision、CutoverPlan |
| SubscriptionImpactSnapshot status | CALCULATING、EXECUTABLE、HAS_UNKNOWN、CLOSED | 每次计算形成新快照 | 订阅生命周期 |
| SubscriptionImpactSnapshot validity | CURRENT、STALE、EXPIRED、INVALIDATED | 基线、依赖或时效变化不覆盖旧快照 | status、UNKNOWN 结论 |
| CutoverPlan | PLANNED、EXECUTING、PARTIAL、ROLLING_BACK、SUCCEEDED、ROLLED_BACK、FAILED、CANCELLED | 执行事实由 FR-4 提供；回滚成功不冒充切换成功 | Instance lifecycle |
| ControlRequest | REQUESTED、EXECUTING、PARTIAL、SUCCEEDED、FAILED、UNKNOWN | 仅汇总一次 operationEpoch 的执行结果 | controlStatus |
| ExitChecklist | OPEN、IN_PROGRESS、PENDING_VERIFY、COMPLETED | 必要资源和证据逐项收口 | 请求 ACK、实例终态 |
| SubscriptionRemediationCase | OPEN、IN_PROGRESS、PENDING_VERIFY、COMPLETED、CANCELLED | FR-2 订阅侧处置 | FR-5 RuntimeWorkItem |

* ReleaseOrder、NodeApplication、RuntimeHealth、DeliveryEvidence 均为 FR-4/FR-5 外部事实，不进入 FR-2 状态枚举。
* `CONDITIONALLY_APPROVED` 只可增加激活前提、持续义务或限制；涉及权利对象、用途、区域、服务版本范围或期限变化时必须回到 FR-1。
* 不新增含糊的 `PARTIALLY_ACTIVE`；跨作用域部分执行通过实例/目标回执矩阵表达。

#### 状态转换守卫矩阵

| 状态对象 | fromState | event / action | guard | toState | Owner / authority | sideEffect | failure / late-event rule |
|---|---|---|---|---|---|---|---|
| RequestRevision | 不存在 | request.draft_created | 申请主体、applicationClient、服务版本和环境可固定；有创建权 | DRAFT | FR-2／申请人 | 创建 requestId、requestRevision、baseRef 和草稿保存令牌 | 同一幂等键返回原草稿；基线不可读时不创建 |
| RequestRevision | 不存在 | correction.draft_created | 前驱 RequestRevision=NEEDS_INFO；baseRef、退回理由和可继承内容可固定；有编辑权 | DRAFT | FR-2／申请人 | 创建更高 requestRevision 并继承可复用内容 | 不修改原 NEEDS_INFO Revision；同键幂等返回原后继草稿 |
| RequestRevision | DRAFT | request.submit | 当前草稿 Revision 可提交；Precheck.validity=CURRENT；摘要 inputHash 匹配；无硬阻断；有提交权 | SUBMITTED | FR-2／申请人 | 固定 RequestRevision、创建 ApprovalCase 和 Outbox | 失败不写正式 Revision；重复提交幂等返回原结果；NEEDS_INFO 必须创建后继草稿而非原 Revision 重提 |
| RequestRevision | SUBMITTED | approval.opened | ApprovalCase=PENDING 且引用同一 Revision | IN_REVIEW | FR-2 | 关闭重复提交入口 | 旧 Revision 事件仅审计 |
| RequestRevision | IN_REVIEW | decision.returned | 有权节点、材料可补正 | NEEDS_INFO | FR-2／审批人 | 固定 RETURNED Decision，创建后继草稿路径 | 不原位解锁正式 Revision |
| RequestRevision | IN_REVIEW | decision.approved | 固定输入有效、无条件候选且无不可豁免阻断 | APPROVED | FR-2／审批人 | 创建不可变 SubscriptionRevision | 迟到决定不得覆盖 WITHDRAWN/REQUEST_EXPIRED/SUPERSEDED |
| RequestRevision | IN_REVIEW | decision.conditionally_approved | 固定输入有效；候选条件映射完整；无不可豁免阻断 | CONDITIONALLY_APPROVED | FR-2／审批人 | 创建 SubscriptionRevision 和 ExecutionCondition | 条件缺项或输入 STALE 时拒绝决定 |
| RequestRevision | IN_REVIEW | decision.rejected | 有权节点、reasonCode 和拒绝依据完整 | REJECTED | FR-2／审批人 | 固定 REJECTED Decision，不创建 SubscriptionRevision | 重复/迟到决定仅审计 |
| RequestRevision | DRAFT | request.draft_abandoned | 草稿从未提交；有放弃权；reasonCode 完整 | ABANDONED | FR-2／申请人 | 停止自动保存，固定放弃依据并关闭草稿待办 | 保留审计与当时内容；恢复必须创建新草稿 |
| RequestRevision | SUBMITTED/IN_REVIEW/NEEDS_INFO | request.withdraw | 无最终决定且有撤回权 | WITHDRAWN | FR-2／申请人 | 取消仍开放 ApprovalCase 和未执行待办 | 已有最终决定时拒绝 |
| RequestRevision | SUBMITTED/IN_REVIEW/NEEDS_INFO | request.validity_elapsed | 已达到申请有效期且无最终决定 | REQUEST_EXPIRED | FR-2 定时策略 | 取消开放 ApprovalCase，保留后继申请入口 | 迟到决定不得复活；新申请使用新 Revision |
| RequestRevision | DRAFT/SUBMITTED/IN_REVIEW/NEEDS_INFO | successor.submitted | 更高 RequestRevision 已正式提交 | SUPERSEDED | FR-2 | 取消旧 Case/待办并建立 successorRef | 旧 Revision 的决定和任务结果仅审计 |
| Precheck runStatus | 不存在 | precheck.requested | RequestRevision 可读、规则集和输入引用可固定 | QUEUED | FR-2／有执行权角色 | 创建 PrecheckInputSnapshot、runId 和异步任务 | 重复请求按幂等键返回原 runId |
| Precheck runStatus | QUEUED | worker.started | 任务租约有效且输入快照仍可读 | RUNNING | FR-2 规则执行器 | 记录 startedAt/workerRef | 过期租约不得并发执行同一 runId |
| Precheck runStatus | RUNNING | rules.completed | 所有必需规则均有终态；运行使用的 inputHash 固定 | COMPLETED | FR-2 规则执行器 | 原子固定 Finding 集、outcome 和 completedAt | 若当前业务输入已变化，完成结果仍保存但 validity=STALE |
| Precheck runStatus | RUNNING | execution.failed | 规则服务或依赖发生不可恢复执行错误 | FAILED | FR-2 规则执行器 | 保存技术错误、责任域和重试入口；不生成伪造 outcome | 迟到规则结果不得改写 FAILED Run |
| Precheck runStatus | QUEUED/RUNNING | execution.cancelled | 当前任务可取消且有取消权 | CANCELLED | FR-2／操作者 | 释放任务租约；保留已产生的技术记录 | 不生成业务 outcome |
| Precheck runStatus | QUEUED/RUNNING | execution.timed_out | 超过 ruleSetVersion 规定的最大执行时长 | TIMED_OUT | FR-2 调度器 | 保存超时规则和可重试性 | 迟到规则结果隔离，不改写 Run |
| Precheck outcome | 未设置 | business.outcome.fixed | runStatus=COMPLETED；按规则优先级可唯一计算 | PASS/PASS_WITH_CONDITIONS/BLOCKED/INCONCLUSIVE | FR-2 规则执行器 | 固定汇总及 PrecheckConditionCandidate | outcome 一经固定不可改；重跑创建新 Run |
| Precheck validity | 不存在 | snapshot.created | 输入、规则集和核验时点均固定 | CURRENT | FR-2 | 保存有效期和依赖版本 | 不从空值推断 CURRENT |
| Precheck validity | CURRENT | dependency.changed | 任一关键输入 Revision/Hash/有效性变化 | STALE | FR-2 | 记录变化项并阻断继续使用 | 依赖恢复也不复活旧结果；须新 Run |
| Precheck validity | CURRENT | validity.elapsed | 到达规则结果有效期 | EXPIRED | FR-2 定时策略 | 阻断提交/批准/激活 | 迟到延长不得原位恢复 |
| Precheck validity | CURRENT/STALE/EXPIRED | result.invalidated | 规则撤回、证据被否定或安全复核判定不可用 | INVALIDATED | FR-2／有权 Owner | 记录依据并触发影响处置 | INVALIDATED 优先于迟到完成结果 |
| ApprovalCase | 不存在 | approval.case.created | RequestRevision=SUBMITTED，或 RequestRevision=IN_REVIEW 且前序 Case=EXPIRED、无活动 Case；审批矩阵版本固定 | PENDING | FR-2 | 固定节点、顺序、assignee、SLA、矩阵版本和 predecessorCaseRef | 同一 RequestRevision 仅一个活动 Case；续办 Case 不修改已过期 Case |
| ApprovalCase | PENDING | review.started | 当前 assignee 有权且无 SoD 冲突 | IN_REVIEW | FR-2／审批人 | 记录处理人和开始时间 | 并发领取按版本令牌冲突 |
| ApprovalCase | IN_REVIEW | decision.approved | 输入 CURRENT、无条件候选、无硬阻断 | APPROVED | FR-2／有权节点 | 固定 Decision；同步 RequestRevision=APPROVED | 重复决定幂等；STALE 输入阻断 |
| ApprovalCase | IN_REVIEW | decision.conditionally_approved | 同一 Case 与 RequestRevision 均为 IN_REVIEW；条件映射完整且均不突破硬门禁 | CONDITIONALLY_APPROVED | FR-2／有权节点 | 在同一业务事务/聚合版本中固定 Decision/ExecutionCondition 并设 RequestRevision=CONDITIONALLY_APPROVED | 不完整映射或 Case/Revision 不匹配时不提交；不得形成半批准状态 |
| ApprovalCase | IN_REVIEW | decision.returned | 材料可补正且退回责任/期限完整 | RETURNED | FR-2／有权节点 | 同步 RequestRevision=NEEDS_INFO | 返回后当前 Case 终止；重提新建 Case |
| ApprovalCase | IN_REVIEW | decision.rejected | reasonCode 和拒绝依据完整 | REJECTED | FR-2／有权节点 | 同步 RequestRevision=REJECTED | 不创建 SubscriptionRevision |
| ApprovalCase | PENDING/IN_REVIEW | case.cancelled | 申请撤回、被替代或输入被有权作废 | CANCELLED | FR-2 | 关闭节点和待办 | 已形成最终决定时拒绝取消 |
| ApprovalCase | PENDING/IN_REVIEW | case.deadline_elapsed | 达到 Case 决策 SLA 且无有权延期 | EXPIRED | FR-2 定时策略 | 固定超时事实、策略版本和升级任务；RequestRevision 保持 IN_REVIEW，可按 ApprovalMatrixVersion 创建 successor ApprovalCase | Case SLA 不等于申请有效期；迟到决定只记审计；无新 Case 时必须暴露 Owner/下一动作 |
| ExecutionCondition | 不存在 | condition.adopted | ApprovalDecision 显式采纳/转换候选且字段完整 | PENDING | FR-2／审批决定 | 固定 sourceFindingId、sourceCandidateId 和证据规则 | 未采纳候选不得生成条件 |
| ExecutionCondition | PENDING/VIOLATED | evidence.verified | 核验者有权且证据满足规则 | SATISFIED | FR-2／条件核验人 | 固定核验事实；必要时重算 readiness | 旧证据或越权核验不改变状态 |
| ExecutionCondition | PENDING/SATISFIED | breach.confirmed | 持续义务或范围限制已被有权事实证明违反 | VIOLATED | FR-2／条件 Owner | 执行 breachAction、影响分析和告警 | 迟到满足证据不能删除违反历史 |
| ExecutionCondition | PENDING | condition.deadline_elapsed | 到达 dueAt 且未满足 | EXPIRED | FR-2 定时策略 | 执行 breachAction 并阻断相应动作 | 迟到补证走有权复核，不原位伪造按时满足 |
| ExecutionCondition | PENDING/VIOLATED/EXPIRED | condition.waived | 条件可豁免且有双人签认、范围和期限 | WAIVED | 合规/安全有权人 | 固定 WaiverDecision 并重算门禁 | 不可豁免条件永不进入 WAIVED |
| Instance | 不存在 | instance.created | 已批准 SubscriptionRevision；环境和原子作用域明确 | PENDING_ACTIVATION | FR-2／订阅运营 | 创建 instanceId、effectiveRevisionId 为空、readiness=NOT_EVALUATED | 不因批准自动 ACTIVE |
| controlStatus | 不存在 | instance.created | 实例主记录创建成功且未命中停用/撤销策略 | ENABLED | FR-2 | 与 instanceId 绑定初始控制状态 | 若创建事务失败，不留孤立控制状态 |
| activationReadiness | 不存在 | instance.created | 实例主记录创建成功 | NOT_EVALUATED | FR-2 | 与 instanceId 绑定初始资格状态；不自动启动评估 | 与实例创建同事务；失败不默认 READY |
| activationReadiness | NOT_EVALUATED/BLOCKED/STALE | readiness.evaluate | 实例及评估请求当前；必需依赖有可定位引用，允许将无法读取作为评估结果 | EVALUATING | FR-2 编排 | 创建固定资格输入快照与 evaluationId | 无法固定输入引用时保持原状态并返回 reasonCode，不伪造 EVALUATING |
| activationReadiness | EVALUATING | readiness.completed | 资格输入快照仍 CURRENT；所有硬门禁通过；无缺失/UNKNOWN 必需事实 | READY | FR-2 消费 FR-3/FR-4 事实 | 固定通过结果与证据引用 | 迟到结果若 inputHash 不匹配则转 STALE，不更新为 READY |
| activationReadiness | EVALUATING | readiness.completed | 资格输入快照仍 CURRENT；至少一个硬门禁明确失败 | BLOCKED | FR-2 消费 FR-3/FR-4 事实 | 固定阻断项、Owner 和证据引用 | 缺失/UNKNOWN 不得按通过处理；迟到结果不覆盖新评估 |
| activationReadiness | NOT_EVALUATED/EVALUATING/BLOCKED/STALE | readiness.input_unavailable | 必需依赖在固定核验窗口内缺失、无法读取、已失效或无法验真 | BLOCKED | FR-2 消费依赖事实 | 保存 missingRefs/dependencyRef、reasonCode、Owner、重试/补证条件 | 不将 UNKNOWN 当 READY；依赖恢复后必须新评估 |
| activationReadiness | READY/BLOCKED/EVALUATING | dependency.changed | 关键输入 Revision、有效性或条件变化 | STALE | FR-2 | 阻断新增发布并创建影响快照 | 旧评估只读保留 |
| Instance | PENDING_ACTIVATION | activation.completed | readiness=READY；权益/配置/资格 CURRENT；controlStatus=ENABLED；FR-4 对该原子 target、targetRevision、operationEpoch 返回最终成功；effectiveAt 已到 | ACTIVE | FR-2 消费 FR-4 最终回执 | 写 instance.effectiveRevisionId；更新逐实例事实 | 部分/失败/UNKNOWN 保持 PENDING_ACTIVATION；迟到低 Epoch 回执仅审计 |
| Instance | ACTIVE | expiry.warning | 进入 LifecyclePolicyVersion 的临期窗口 | EXPIRING | FR-2 定时策略 | 创建续期待办 | 续期已提交不阻止旧实例到期 |
| Instance | PENDING_ACTIVATION/ACTIVE/EXPIRING | validTo.reached | 当前时刻达到 `[validFrom, validTo)` 的排他上界 | EXPIRED | FR-2 定时策略 | 阻断新增交付并发起精确停发 | 迟到定时事件按 revisionId＋operationEpoch 幂等判定 |
| Instance | PENDING_ACTIVATION/ACTIVE/EXPIRING | entitlement.revoked | 撤销作用域命中该实例 | REVOKED | FR-1 决定／FR-2 投影 | 发起最小作用域停发和退出清单 | 迟到批准/恢复不得复活 |
| Instance | PENDING_ACTIVATION/ACTIVE/EXPIRING | terminate.completed | 终止决定有效且必要控制回执已收口 | TERMINATED | FR-2 消费 FR-4 回执 | 固定退出证据 | 请求 ACK 不得触发终态 |
| Instance | ACTIVE/EXPIRING | cutover.same_identity_succeeded | 新旧 instanceKeyHash 相同且新 Revision 对该实例执行成功 | ACTIVE | FR-2 消费 FR-4 回执 | 原子更新 effectiveRevisionId；保留 instanceId 和版本时间线 | 仅更新成功实例；不得推进未收敛的订阅级 effective 指针 |
| Instance | PENDING_ACTIVATION/ACTIVE/EXPIRING | cutover.successor_activated | instanceKeyHash 变化；successorInstance 已 ACTIVE 且旧作用域收口 | SUPERSEDED | FR-2 | 固定 supersededByInstanceId 和替代证据 | successor 未成功或旧作用域未收口时不得 SUPERSEDED |
| controlStatus | ENABLED | pause.requested | 有权、目标最小化；ImpactSnapshot.validity=CURRENT，且 status=EXECUTABLE，或 status=HAS_UNKNOWN 但已满足适用的 Break-glass/例外规则 | PAUSE_REQUESTED | FR-2／运营或 Break-glass | 创建 ControlRequest 和 operationEpoch | 失败不宣称 PAUSED；保留上一有效控制事实；共享资源全局撤销不可以 UNKNOWN 例外绕过 |
| controlStatus | PAUSE_REQUESTED | pause.receipt.succeeded | FR-4 对全部必要原子目标最终成功且 Epoch 匹配 | PAUSED | FR-2 消费 FR-4 回执 | 固定实际暂停时间 | 部分/失败/UNKNOWN 由 ControlRequest 表达并保持事件开放 |
| controlStatus | PAUSE_REQUESTED | pause.receipt.failed | 已确认无目标实际暂停且失败为终态 | ENABLED | FR-2 消费 FR-4 回执 | 创建处置记录并保留失败证据 | 部分或 UNKNOWN 不回退 ENABLED |
| controlStatus | PAUSED | resume.requested | 新依据、根因关闭、恢复测试和有权复核 | RESUME_REQUESTED | FR-2／恢复批准人 | 创建新 Epoch ControlRequest | 旧恢复回执不得越过撤销/到期/终止 |
| controlStatus | RESUME_REQUESTED | resume.receipt.succeeded | FR-4 必要目标最终成功且实例仍有权 | ENABLED | FR-2 消费 FR-4 回执 | 固定实际恢复时间 | 失败保持 PAUSED；低 Epoch 回执忽略并审计 |
| controlStatus | RESUME_REQUESTED | resume.receipt.failed | 恢复失败已确认且无目标恢复 | PAUSED | FR-2 消费 FR-4 回执 | 创建处置记录 | 部分或 UNKNOWN 保持 RESUME_REQUESTED |
| controlStatus | ENABLED/PAUSE_REQUESTED/PAUSED/RESUME_REQUESTED | stop.requested | 到期、撤销、终止或不可继续的硬门禁 | STOP_REQUESTED | FR-2；有权决定来自相应 Owner | 阻断新增动作并创建精确 ControlRequest | 不能被迟到批准、激活或恢复覆盖 |
| controlStatus | STOP_REQUESTED | stop.receipt.succeeded | 全部必要目标完成或取得有权例外 | STOPPED | FR-2 消费 FR-4 回执 | 推进 ExitChecklist 核验 | 部分/失败/UNKNOWN 不进入 STOPPED |
| ControlRequest | 不存在 | control.requested | 动作、目标、targetRevision、operationEpoch 和幂等键完整 | REQUESTED | FR-2 | 固定请求内容并发送 Outbox | 同键同内容返回原对象；异内容冲突 |
| ControlRequest | REQUESTED | execution.accepted | FR-4 接受相同目标和 Epoch | EXECUTING | FR-2 消费 FR-4 ACK | 保存 externalTaskId | ACK 不改变 controlStatus 终态 |
| ControlRequest | REQUESTED/EXECUTING/UNKNOWN | receipts.aggregated_success | 所有必要目标最终成功或存在有权例外 | SUCCEEDED | FR-2 消费 FR-4 回执 | 触发对应 controlStatus 转换 | 低 Epoch/错误 Revision 回执忽略 |
| ControlRequest | REQUESTED/EXECUTING/UNKNOWN | receipts.aggregated_partial | 至少一目标成功且至少一目标失败/未知 | PARTIAL | FR-2 | 创建 SubscriptionRemediationCase | 不推断总体成功；重试使用新 operationEpoch |
| ControlRequest | REQUESTED/EXECUTING/UNKNOWN | receipts.aggregated_failed | 所有必要目标最终失败且无实际副作用 | FAILED | FR-2 | 保存失败矩阵和处置入口 | 已有部分副作用时必须为 PARTIAL |
| ControlRequest | REQUESTED/EXECUTING | receipt.deadline_elapsed | 到达核验期限且至少一必要目标无可确认结果 | UNKNOWN | FR-2 定时策略 | 保持事件开放并创建核查 Case | 同 Epoch 的迟到最终回执可重新聚合，但不得越过更高 Epoch |
| RuntimeSession | 不存在 | session.created | 长期订阅、应用客户端、任务与最小化作用域均可固定；通道获准 | CREATED | FR-2／有权测试主体 | 创建 sessionId、伪名、taskRef 和候选 validTo | 授权或范围无法固定时不创建会话 |
| RuntimeSession | CREATED | session.opened | 长期订阅有效、通道/任务允许、TTL 合法 | ACTIVE | FR-2／有权测试主体 | 固定最小化字段和 validTo | 外部匹配结果不改变会话生命周期 |
| RuntimeSession | ACTIVE | expiry.warning | 进入短会话临期窗口 | EXPIRING | FR-2 定时策略 | 通知 Owner，不延长 TTL | 迟到延长需新授权和新版本 |
| RuntimeSession | CREATED/ACTIVE/EXPIRING | session.closed | 有权主体主动取消/关闭或任务正常结束 | CLOSED | FR-2 | 停止新匹配并执行保留/删除策略 | 迟到 open/匹配结果只审计，不复活 |
| RuntimeSession | CREATED/ACTIVE/EXPIRING | ttl.reached | 当前时刻达到 validTo | TIMED_OUT | FR-2 定时策略 | 停止新匹配并执行清理 | 迟到延长不得复活 |
| RuntimeSession | CREATED/ACTIVE/EXPIRING | entitlement.revoked | 长期订阅或任务授权已撤销 | REVOKED | FR-2 | 立即停止新匹配并记录撤销依据 | 迟到 open/extend 事件不得复活 |
| SubscriptionChange | 不存在 | change.draft_created | 当前 Revision 可作为基准且有变更权 | DRAFT | FR-2／申请人 | 固定 baseRevisionId | 基准变化触发 Conflict，不静默换基线 |
| SubscriptionChange | DRAFT | change.submitted | Diff、影响、预检和回退要求完整 | IN_REVIEW | FR-2／申请人 | 固定候选输入并创建审批 | S1 不执行此 S2 路径 |
| SubscriptionChange | IN_REVIEW | change.approved | 审批、重检和测试要求明确 | APPROVED | FR-2／有权审批人 | 创建目标 SubscriptionRevision/CutoverPlan | 不直接切换生产 |
| SubscriptionChange | IN_REVIEW | change.rejected | reasonCode 和依据完整 | REJECTED | FR-2／有权审批人 | 固定拒绝决定 | 不创建目标 Revision |
| SubscriptionChange | DRAFT/IN_REVIEW | change.cancelled | 尚未执行切换且有取消权 | CANCELLED | FR-2 | 关闭待办，保留 Diff 和历史 | 已执行副作用时走补偿而非取消 |
| SubscriptionImpactSnapshot status | 不存在 | impact.requested | triggerRef 和分析基准可固定 | CALCULATING | FR-2 | 创建不可变分析输入 | 重算创建新快照，不覆盖旧快照 |
| SubscriptionImpactSnapshot validity | 不存在 | impact.requested | basisRevision、basisHash、dependencyVersions 和 validityUntil 可固定 | CURRENT | FR-2 | 与快照同事务初始化有效性 | 不从空值推断 CURRENT |
| SubscriptionImpactSnapshot status | CALCULATING | impact.completed_no_unknown | 必要依赖全部可核验且 validity=CURRENT | EXECUTABLE | FR-2 | 固定 knownTargets、hash 和建议动作 | 迟到依赖结果不改快照，重算新版本 |
| SubscriptionImpactSnapshot status | CALCULATING | impact.completed_with_unknown | 至少一必要依赖不可核验且 validity=CURRENT | HAS_UNKNOWN | FR-2 | 固定 unknowns、Owner 和补证动作 | UNKNOWN 不计为无影响 |
| SubscriptionImpactSnapshot validity | CURRENT | impact.dependency_changed | basisRevision、basisHash 或必需依赖版本已变化 | STALE | FR-2 | 记录变化项、Owner 和重算入口 | 依赖恢复不复活旧快照 |
| SubscriptionImpactSnapshot validity | CURRENT | impact.validity_elapsed | 当前时刻达到 validityUntil | EXPIRED | FR-2 定时策略 | 阻断使用快照发起新高风险动作 | 迟到延长不原位恢复 |
| SubscriptionImpactSnapshot validity | CURRENT/STALE/EXPIRED | impact.invalidated | 输入依据被撤回、证据被否定或有权复核判定不可用 | INVALIDATED | FR-2／有权 Owner | 固定作废依据并创建新快照/处置入口 | INVALIDATED 优先于迟到计算结果 |
| SubscriptionImpactSnapshot status | EXECUTABLE/HAS_UNKNOWN | impact.closed | validity=CURRENT；必要动作完成或 UNKNOWN 取得有权例外并留证 | CLOSED | FR-2／影响 Owner | 固定 closureEvidence | 无 Owner/无证据/不可豁免 UNKNOWN 或 validity≠CURRENT 时拒绝关闭 |
| CutoverPlan | 不存在 | cutover.plan_created | SubscriptionChange=APPROVED；新旧 Revision、原子实例、窗口、前置条件和回退目标可固定 | PLANNED | FR-2／有权运营 | 创建不可变计划基线和逐实例目标 | 任一必要信息不完整则不创建可执行计划 |
| CutoverPlan | PLANNED | cutover.cancelled | 尚未开始任一外部执行；有取消权且 reasonCode 完整 | CANCELLED | FR-2／有权运营 | 固定取消依据并关闭未执行任务 | 已有副作用时禁止取消，改走回滚/处置 |
| CutoverPlan | PLANNED | cutover.started | 目标 Revision 获批、资格有效、回退目标可用 | EXECUTING | FR-2 编排／FR-4 执行 | 创建逐实例执行任务 | 重复开始按 planId/Epoch 幂等 |
| CutoverPlan | EXECUTING | results.all_succeeded | 全部获批实例切换成功 | SUCCEEDED | FR-2 消费 FR-4 事实 | 推进实例/订阅 Revision 指针 | ACK 或节点处理中不得触发 |
| CutoverPlan | EXECUTING | results.mixed | 同时存在成功和失败/UNKNOWN | PARTIAL | FR-2 | 保持旧 Revision、创建处置和补偿 | 不静默扩大成功范围 |
| CutoverPlan | EXECUTING | results.all_failed | 无实例切换成功且失败为终态 | FAILED | FR-2 | 保留旧 Revision；如需重试，建立引用当前计划的新 CutoverPlan | 若存在副作用不得标 FAILED；FAILED 计划不原位重启 |
| CutoverPlan | PARTIAL | cutover.retry_remaining | 已固定未成功作用域、当前事实与新 Epoch；继续策略获批 | EXECUTING | FR-2／有权运营 | 仅处理未成功目标 | 不重放已成功目标，不覆盖旧回执 |
| CutoverPlan | PARTIAL | cutover.rollback_started | 回退目标当前仍有效；补偿作用域、风险和新 Epoch 已批准 | ROLLING_BACK | FR-2 编排／FR-4 执行 | 创建逐实例补偿任务 | 无有效回退目标时保持 PARTIAL 并升级处置 |
| CutoverPlan | ROLLING_BACK | rollback.all_succeeded | 所有已变更目标已恢复到批准回退基线且已核验 | ROLLED_BACK | FR-2 消费 FR-4 事实 | 在逐实例 FR-4 成功事实到齐后，将受影响实例 effectiveRevisionId 恢复到 rollbackTarget；固定回滚证据 | 未收敛前不推进订阅级 currentEffectiveRevisionId；不将 ROLLED_BACK 表述为 SUCCEEDED |
| CutoverPlan | ROLLING_BACK | rollback.mixed_or_unknown | 存在补偿失败、不可达或 UNKNOWN 目标 | PARTIAL | FR-2 | 更新逐目标事实并创建/升级 SubscriptionRemediationCase | 不强制关闭；后续继续或再回滚均使用新 Epoch |
| ExitChecklist | 不存在 | exit.opened | 到期、撤销、终止或替代需要收口 | OPEN | FR-2 | 固定资源、绑定类型、引用数和目标动作 | 重复事件引用同一开放清单 |
| ExitChecklist | OPEN | exit.execution_started | 影响快照 validity=CURRENT，且 status=EXECUTABLE，或 status=HAS_UNKNOWN 但每个 UNKNOWN 均有适用的有权例外；必要 Owner 已分派 | IN_PROGRESS | FR-2 | 发起解绑/停发/核验任务并固定 exceptionDecisionRef | 共享资源无完整影响审批不得全局撤销；不可豁免 UNKNOWN 永不允许继续 |
| ExitChecklist | IN_PROGRESS | exit.items_completed | 所有必要项有成功/失败处置/有权例外 | PENDING_VERIFY | FR-2 | 固定逐项结果，等待独立核验 | UNKNOWN 或无 Owner 项不得进入核验 |
| ExitChecklist | PENDING_VERIFY | exit.verified | 独立核验通过且 closureEvidence 完整 | COMPLETED | FR-2／核验人 | 固定实际收口时间和证据 | 核验失败回 IN_PROGRESS，不得强关 |
| ExitChecklist | PENDING_VERIFY | exit.verification_failed | 任一必要项证据不足或结果失效 | IN_PROGRESS | FR-2／核验人 | 创建/重开 SubscriptionRemediationCase | 保留此前结果和失败原因 |
| SubscriptionRemediationCase | 不存在 | remediation.created | 来源、Owner、下一动作、期限和证据要求完整 | OPEN | FR-2 | 创建 Case 和待办 | 同 sourceId＋type 的活动 Case 去重 |
| SubscriptionRemediationCase | OPEN | remediation.accepted | assignee 有权且无职责冲突 | IN_PROGRESS | FR-2／Owner | 记录接受时间和 SLA | 并发领取按 ETag 冲突 |
| SubscriptionRemediationCase | IN_PROGRESS | remediation.submitted | 处理记录和所需证据已提交 | PENDING_VERIFY | FR-2／处理人 | 指派独立验证人 | 上传成功不等于完成 |
| SubscriptionRemediationCase | PENDING_VERIFY | remediation.verified | 验证人有权且复检/证据满足关闭规则 | COMPLETED | FR-2／验证人 | 固定 closureEvidence | 原 Finding 不被改写，必要时引用新 Run |
| SubscriptionRemediationCase | PENDING_VERIFY | remediation.returned | 证据不足或复检未通过 | IN_PROGRESS | FR-2／验证人 | 保存退回原因和新期限 | 不删除已提交证据 |
| SubscriptionRemediationCase | OPEN/IN_PROGRESS/PENDING_VERIFY | remediation.cancelled | 来源义务已被有权作废或被新 Case 替代 | CANCELLED | FR-2／有权 Owner | 固定取消依据和 successorRef | 硬门禁仍有效时禁止取消 |

* 所有 `decision.*` 必须同时校验 ApprovalCase 与所引用 RequestRevision 的 ID、Revision、inputHash 和 `IN_REVIEW` 语境；Case 决定、RequestRevision 结果、Decision 与 Outbox 必须在同一业务事务/聚合版本中成功或共同失败，不得形成半批准状态。

### 验收标准

#### AC1：合法迁移成功

在当前状态、角色和依赖满足转换守卫的前置条件下，  
当用户或系统触发目标动作时，  
系统应更新唯一对应状态族并记录原因、操作者和版本，  
并满足其他状态族不被隐式修改的要求。

#### AC2：非法迁移拒绝

在当前状态不允许目标动作的前置条件下，  
当用户或事件尝试迁移时，  
系统应产生稳定原因码、当前状态和允许动作，  
并满足业务对象、版本和外部副作用均不改变的要求。

#### AC3：组合约束有效

在 Request 已批准但激活资格未通过的前置条件下，  
当用户请求生产激活时，  
系统应保持实例为 PENDING_ACTIVATION 并拒绝进入 ACTIVE，  
并满足 APPROVED 不被解释为 READY 或 ACTIVE 的要求。

#### AC4：状态读取一致

在多个页面或服务读取同一订阅的前置条件下，  
当系统返回状态时，  
系统应从同一聚合版本返回申请、预检、审批、生命周期、控制和资格各维度，  
并满足不存在页面本地复制状态的要求。

#### AC5：终态优先保护

在目标 `SubscriptionInstance.lifecycle ∈ {REVOKED, EXPIRED, TERMINATED, SUPERSEDED}` 的前置条件下，  
当迟到批准、激活或恢复事件到达时，  
系统应保留迟到事件并拒绝改变终态，  
并满足生成补偿或核查动作且不复活关系的要求。

## 研发需求：FR2-RD-03 确定性预检、证据快照与可重放评估

关联功能需求：FR2-FR-01、FR2-FR-03、FR2-FR-04、FR2-FR-05、FR2-FR-06、FR2-FR-13。

### 需求描述

本研发需求实现订阅五层准入预检的输入固定、规则执行、结果解释、有效性维护和确定性重放，覆盖授权/权益、订阅契约、数据质量/服务资格、访问权限/凭证、连接/容量五层。当用户运行预检时，系统应根据固定的 RequestRevision、规则集、权益、服务、能力、空间、端点、证书、质量与容量事实创建 PrecheckRun，异步执行规则并逐项保存预期、实际、证据、结论、责任和下一动作；当任一输入版本或有效性变化时，系统应使受影响结果 STALE，而不是覆盖历史结果。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 状态/有效性 | 外部交互 / 边界 |
|---|---|---|---|---|
| PrecheckInputSnapshot | snapshotId、inputRefs、ruleSetVersion、hash | 运行前固定；不可变 | CURRENT/STALE | 只引用外部事实，不复制所有正文 |
| PrecheckRun | runId、requestRevision、startedAt、completedAt | 每次重跑新建 | runStatus 独立 | 异步任务可取消/超时 |
| PrecheckFinding | ruleId、layer、severity、expected、actual | 逐项追加，完成后不可改 | outcomeItem、validity | evidenceRef 按权限访问 |
| PrecheckDecision | outcome、summary、conditionCandidateRefs | 仅 COMPLETED 后形成 | outcome 与 validity 分离 | 候选条件不具有审批约束力 |
| SubscriptionRemediationCase | caseId、sourceFindingId、owner、nextAction、dueAt、evidence | FR-2 补正闭环 | OPEN→IN_PROGRESS→PENDING_VERIFY→COMPLETED/CANCELLED | 复检创建新 Run；不等同 FR-5 RuntimeWorkItem |

* 相同 inputHash＋ruleSetVersion 必须产生相同业务结论；时间、随机值或环境漂移必须显式进入输入。
* 规则项不得只保存自然语言错误；必须有稳定 ruleId、reasonCode、责任域和证据引用。
* `PASS_WITH_CONDITIONS` 只能生成已结构化、可执行且未突破硬门禁的 `PrecheckConditionCandidate`；候选本身不是生产约束。审批决定必须逐项采纳、拒绝或转换，采纳后才生成不可变 `ExecutionCondition`，并分别保存 sourceFindingId、sourceCandidateId 与有权拒绝依据。

### 验收标准

#### AC1：固定输入执行

在申请修订版和依赖事实可读取的前置条件下，  
当用户启动预检时，  
系统应生成不可变输入快照和唯一 runId，并异步输出五层规则结果，  
并满足每项结果可追溯到规则版本和事实版本的要求。

#### AC2：确定性重放

在 inputHash 和 ruleSetVersion 完全相同的前置条件下，  
当系统重放预检时，  
系统应产生相同 outcome 和 Finding 集合，  
并满足执行时间、节点差异不改变业务结论的要求。

#### AC3：未知默认阻断

在关键授权、能力、空间、凭证或容量事实无法核验的前置条件下，  
当预检完成时，  
系统应产生 INCONCLUSIVE 或包含对应阻断项的结果，  
并满足不按 PASS、不自动忽略且提供 Owner/下一动作的要求。

#### AC4：输入变化标记过期

在旧预检已被申请或审批引用的前置条件下，  
当任一关键输入变化时，  
系统应将相关结果标为 STALE 并生成影响摘要，  
并满足旧结果内容和当时证据保持不可变的要求。

#### AC5：运行异常不伪装业务失败

在规则服务超时、依赖读取失败或任务取消的前置条件下，  
当 PrecheckRun 结束时，  
系统应产生 FAILED、TIMED_OUT 或 CANCELLED 的执行状态，  
并满足不生成伪造 BLOCKED 业务结论、草稿可重试的要求。

## 研发需求：FR2-RD-04 类型化 Coverage、通道和契约范围校验

关联功能需求：FR2-FR-03、FR2-FR-04、FR2-FR-12。

### 需求描述

本研发需求实现订阅范围的规范化、交集计算以及按通道分型的字段和规则校验，覆盖车型能力、Coverage、时段/ODD、Uu-A、PC5、Uu-T、Uu-B、端点、质量、反馈、配额和证据目标。当申请人在订阅向导配置范围与通道时，系统应根据 ServiceVersion 允许的 Selector 类型、Entitlement/Offering/协议/能力上限、SpatialModelVersion 和 ChannelProfile 计算允许交集，返回差异、未知项与禁止组合；系统不得使用一套同构字段强制所有通道，也不得将空值解释为全部。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 校验规则 | 外部交互 / 边界 |
|---|---|---|---|---|
| CoverageSelector | selectorType、objectRefs、direction、spatialVersion | 规范化后固定哈希 | 只能使用 ServiceVersion 允许类型 | 空间事实来自 PG06/空间服务 |
| OperatingScope | schedule、timezone、ODD、validFrom/to | 跨日/节假日显式 | 不超过所有上游最早到期 | 项目时区由 Profile 冻结 |
| ChannelProfile | channelType、environment、primary/standby | 按类型分型 | 禁止不兼容通道组合 | 具体 QoS 在 ICD |
| EndpointBinding | endpointRevision、topic/profile、certificateRef | 只引用已登记对象 | Uu-A/Uu-B/Uu-T 条件必填；PC5不强制 OEM Endpoint | 私钥不进入业务数据 |
| DeliveryConstraint | quota、rateLimit、TTL、quality、feedback、evidenceTarget | 只能在允许范围内收紧 | 硬包络不可突破 | 实际证据由 FR-5 |

* Uu-A：Application 级 B2B 订阅，端点、Topic/Profile、配额与反馈必填；城市不逐 VIN。
* PC5：广播策略，管理 Coverage、消息 Profile、频率、优先级、证书与状态；不要求逐车端点或标识。
* Uu-T：测试任务、轮换伪名、路线/围栏和短期限必填；不得进入量产默认链路。
* Uu-B：OEM 边缘应用、运营商/UPF 与工程条件必填；M0 未确认前保持禁用或 P1。

### 验收标准

#### AC1：规范化交集正确

在上游范围和空间版本可核验的前置条件下，  
当系统计算订阅允许范围时，  
系统应产生原申请、允许交集、越界部分和规范化哈希，  
并满足同义输入得到一致结果、空范围不等于全部的要求。

#### AC2：部分交集需确认

在申请范围只有部分可允许的前置条件下，  
当用户选择接受收窄时，  
系统应创建包含新范围的后继草稿 Revision，  
并满足原申请不被静默改写、差异和确认人可追溯的要求。

#### AC3：空间未知阻断

在方向、车道、Movement 或空间版本映射无法核验的前置条件下，  
当用户运行范围校验时，  
系统应产生 INCONCLUSIVE 结果和校准任务入口，  
并满足不生成空交集或默认可用结果的要求。

#### AC4：通道字段分型

在用户切换 Uu-A、PC5、Uu-T 或 Uu-B 的前置条件下，  
当系统校验契约时，  
系统应按通道加载必填、禁止和条件字段规则，  
并满足 PC5 不要求逐车端点、Uu-T 不被当作量产链路的要求。

#### AC5：质量与证据上限有效

在用户配置质量、反馈或证据目标的前置条件下，  
当请求超过服务硬约束或可证明上限时，  
系统应拒绝越界值并返回允许范围和原因，  
并满足申请人不能降低安全包络或承诺不存在证据的要求。

## 研发需求：FR2-RD-05 多租户权限、职责分离与结构化审批条件

关联功能需求：FR2-FR-01、FR2-FR-06、FR2-FR-07、FR2-FR-09、FR2-FR-11。

### 需求描述

本研发需求实现订阅全流程的 RBAC＋ABAC、租户/环境隔离、动作级职责分离、动态审批矩阵、委托、结构化条件和 Break-glass 边界。当申请人、运营、审批、合规、安全、测试、发布或审计角色执行动作时，系统应根据主体、租户、环境、对象、数据分类、用途、治理等级、当前状态和职责关系判断可见范围与允许动作；当审批产生附加条件时，系统应固定条件类型、作用域、Owner、期限、满足证据和违反动作，禁止用自由文本扩大权利或绕过硬门禁。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 状态/约束 | 外部交互 / 边界 |
|---|---|---|---|---|
| AccessDecision | subject、tenant、environment、resource、action、purpose | 每次服务端校验 | ALLOW/DENY＋reasonCode | 前端隐藏不替代校验 |
| SoDPolicy | rolePair、objectScope、riskLevel、exceptionRule | 版本化 | 申请人≠最终审批人等 | 高风险审批≠发布执行 |
| ApprovalMatrix | trigger、nodes、sequence、assignees、SLA | 申请提交时固定版本 | 动态会签但不可静默减签 | 委托需期限与审计 |
| ExecutionCondition | conditionId、sourceFindingId、sourceCandidateId、type、scope、owner、dueAt、evidenceRule、breachAction | 由审批决定显式创建，批准后不可原位改 | PENDING/SATISFIED/VIOLATED/EXPIRED/WAIVED | WAIVED 需有权依据；硬条件不可豁免 |
| BreakGlassGrant | actor、allowedAction、scope、expiresAt、reviewer | 仅预授权止损动作 | 使用后强制复核 | 不得用于扩权或批准 |

* M0 未确认“城市运营能否代理 OEM 建草稿/提交”前，默认只允许 OEM 或有明确委托关系的主体提交。
* 高治理等级订阅至少要求业务、合规/安全与联合验证职责按 Profile 组合，不在本文件固定组织名称。
* 条件若改变权利对象、用途、区域、服务版本范围或期限，必须返回 FR-1 形成新 EntitlementRevision。
* ApprovalDecision 必须固定每个 PrecheckConditionCandidate 的 `ACCEPTED/REJECTED/TRANSFORMED` 映射；不可豁免候选不得丢弃，拒绝或转换必须记录有权依据和替代条件。

### 验收标准

#### AC1：租户与对象隔离

在用户仅拥有本租户和指定环境权限的前置条件下，  
当其读取或操作其他租户/环境对象时，  
系统应产生统一拒绝结果并记录访问审计，  
并满足不泄露敏感内容或对象存在性的要求。

#### AC2：动作级权限生效

在用户可查看订阅但无审批、暂停或导出权限的前置条件下，  
当其尝试相应动作时，  
系统应拒绝操作并返回所缺权限作用域，  
并满足查看权不自动扩大为修改或高风险执行权的要求。

#### AC3：职责冲突阻断

在申请人或编辑人同时尝试作为最终审批人的前置条件下，  
当其提交审批决定时，  
系统应产生 SoD 冲突并阻断决定，  
并满足支持改派、升级或有权例外且全程留痕的要求。

#### AC4：条件结构完整

在审批人选择附条件批准的前置条件下，  
当其提交决定时，  
系统应校验每项条件的类型、作用域、Owner、期限、证据和违反动作，  
并满足缺项或试图突破硬门禁时拒绝提交的要求。

#### AC5：紧急权限边界

在预授权值班角色执行紧急暂停的前置条件下，  
当 Break-glass 被使用时，  
系统应仅允许既定最小止损作用域并触发复核，  
并满足不能创建权益、批准订阅或扩大服务范围的要求。

## 研发需求：FR2-RD-06 跨 FR 激活编排、异步任务与补偿

关联功能需求：FR2-FR-05、FR2-FR-07、FR2-FR-08、FR2-FR-09、FR2-FR-13。

### 需求描述

本研发需求实现 FR-2 与 FR-1、FR-3、FR-4、FR-5 的激活准备、异步任务、超时、重试和补偿编排，保证订阅只消费有权输入并准确呈现各域事实。当申请提交、审批通过或运营发起激活时，系统应读取 FR-1 当前有效的 EntitlementRevision 及服务/能力依赖，向 FR-3 请求或引用 EffectiveConfigSnapshot，向 FR-4 发起 Qualification/Release/Control 请求，并从 FR-5 读取运行健康和交付证据引用；所有外部请求应携带 SubscriptionRevision、精确作用域、effectiveAt、幂等键和 traceId，超时或部分失败时不得推定成功。

### 数据与状态

| 交互方向 | 最小输入 | 返回/消费结果 | FR-2 写入 | 明确边界 |
|---|---|---|---|---|
| FR-1 → FR-2 | Entitlement/Offering/Service/Capability/Compatibility Revision 与有效性 | Granted/Suspended/Narrowed/Revoked/Expired/Superseded 等变化 | DependencySnapshot、SubscriptionImpactSnapshot | FR-2 不扩大权利或改能力事实 |
| FR-2 → FR-3 | approved SubscriptionRevision、作用域、约束、条件、目标时点 | EffectiveConfigSnapshot ID/Hash、validity、conflicts | 配置引用、资格输入 | FR-2 不计算最终配置值 |
| FR-2 → FR-4 | Activation/Pause/Resume/Cutover/Terminate 请求 | Qualification、Release、Node/Control Receipt | request/receipt 引用、controlStatus | FR-2 不伪造发布或节点事实 |
| FR-2 → FR-5 | 契约期望、FeedbackProfile、EvidenceTarget、关联 ID | DeliveryEvidence、RuntimeHealth、RuntimeIncident/RuntimeWorkItem | 证据/健康引用 | FR-5 不改 SubscriptionRevision |
| AsyncTask | taskId、type、targetRevision、progress、result | QUEUED/RUNNING/PARTIAL/SUCCEEDED/FAILED/CANCELLED/TIMED_OUT | 操作进度和最终引用 | 任务状态不等于业务状态 |

* 每个外部交互必须定义 accepted、executing、partial、succeeded、failed、unknown 的完成边界。
* 任何超时重试使用同一幂等键或明确的新 operationEpoch，避免重复发布或控制。
* 补偿动作必须引用原操作、目标 Revision 和作用域，禁止无关联的全局回滚。

### 验收标准

#### AC1：FR-1 输入门禁

在 EntitlementRevision 非 ACTIVE+ENABLED 或关键依赖非 CURRENT 的前置条件下，  
当 FR-2 尝试提交、续期或激活时，  
系统应产生明确阻断和依赖引用，  
并满足不创建可执行实例、不向后续 FR 发起生产请求的要求。

#### AC2：配置与资格引用正确

在订阅获批且进入激活准备的前置条件下，  
当系统请求有效配置和资格检查时，  
系统应保存返回的快照/任务 ID、Revision、Hash、有效性和 traceId，  
并满足只在结果当前有效且通过时形成 READY 资格的要求。

#### AC3：异步接受不等于完成

在 FR-4 接受发布或控制请求但尚无最终回执的前置条件下，  
当用户查看订阅时，  
系统应显示请求已接受/执行中及最近进度，  
并满足不显示 ACTIVE、PAUSED 或 STOPPED 最终事实的要求。

#### AC4：部分失败触发补偿

在外部操作只对部分作用域成功的前置条件下，  
当系统汇总回执时，  
系统应保存逐作用域结果、创建 SubscriptionRemediationCase 并按批准策略发起补偿，  
并满足未完成作用域保持可见且不扩大执行范围的要求。

#### AC5：跨域追踪完整

在一次订阅激活、暂停或终止跨越多个 FR 的前置条件下，  
当审计人员按 subscriptionId、revision 或 traceId 检索时，  
系统应返回请求、外部任务、回执、补偿和证据关联，  
并满足每个域的唯一事实 Owner 清晰的要求。

## 研发需求：FR2-RD-07 变更、续期、切换、暂停与退出编排

关联功能需求：FR2-FR-10、FR2-FR-11、FR2-FR-13。

### 需求描述

本研发需求实现 SubscriptionRevision 的语义变更、续期、迁移切换以及暂停、恢复、到期、撤销和终止编排，覆盖影响分析、新旧版本并行窗口、控制请求、退出清单和收口判定。当运营人员发起变化时，系统应基于当前 Revision 生成候选 Revision 和结构化 Diff，固定已知/未知影响、重新审批/测试要求、切换与回退目标；当上游撤销、到期或高风险事件触发退出时，系统应按最小作用域创建带 operationEpoch 的控制请求并持续消费执行回执，只有必要作用域完成或取得有权例外后才关闭事件。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 状态/收口 | 外部交互 / 边界 |
|---|---|---|---|---|
| SubscriptionChange | changeId、type、base/targetRevision、diffHash | 创建后固定基准 | DRAFT→IN_REVIEW→APPROVED/REJECTED/CANCELLED | 不直接修改当前 Revision |
| SubscriptionImpactSnapshot | triggerRef、basisRevision、basisHash、dependencyVersions、knownTargets、unknowns、hash、validityUntil | 每次重算新快照 | status=CALCULATING/EXECUTABLE/HAS_UNKNOWN/CLOSED；validity=CURRENT/STALE/EXPIRED/INVALIDATED | FR-2 为 SoR；PG03-I 只读投影和深链 |
| CutoverPlan | scope、window、preconditions、rollbackTarget | 批准后不可覆盖 | PLANNED/EXECUTING/PARTIAL/ROLLING_BACK/SUCCEEDED/ROLLED_BACK/FAILED/CANCELLED | 执行归 FR-4；回滚和切换成功分开 |
| ControlRequest | action、reason、scope、effectiveAt、operationEpoch | 幂等发送 | REQUESTED/EXECUTING/PARTIAL/SUCCEEDED/FAILED/UNKNOWN | 结果来自 FR-4 Receipt |
| ExitChecklist | resourceRef、bindingType、activeReferenceCount、plannedAction、impactApproval、sessions、releases、evidence、caseRefs | 逐项留证 | OPEN/IN_PROGRESS/PENDING_VERIFY/COMPLETED | 不删除历史契约；共享资源默认只解绑当前订阅 |

* 暂停可恢复；到期为时间触发；撤销为有权方终止；计划终止为双方结束；SUPERSEDED 为 Revision 替代，语义不得互换。
* 对活动实例的权益收窄/撤销必须立即阻断新增/续期/激活，并发起精确控制；在 FR-4 未完成前显示“停发已请求/执行待核验”。
* 恢复必须引用新的有效依据、根因关闭、恢复测试和有权审批，不能复用已失效快照。
* 端点、Topic、证书或凭证为 `SHARED` 且 `activeReferenceCount>1` 时，退出动作默认 `UNBIND` 当前订阅，不得全局 `REVOKE`；全局撤销必须先完成影响审批并证明其他有效订阅不受误伤。

### 验收标准

#### AC1：变更差异和影响固定

在用户基于当前 Revision 发起变更的前置条件下，  
当系统完成候选准备时，  
系统应产生结构化 Diff、影响快照、未知依赖、审批/测试和回退要求，  
并满足当前正式 Revision 不被修改的要求。

#### AC2：续期重新校验

在订阅进入临期窗口的前置条件下，  
当用户发起续期时，  
系统应重新执行权益、协议、服务、能力、凭证、风险和未关闭事项校验，  
并满足任一硬门禁失败时不形成新有效期的要求。

#### AC3：切换按作用域执行

在目标 Revision 已获批、验证并具有回退目标的前置条件下，  
当系统发起切换时，  
系统应按固定作用域跟踪每个实例/目标结果并更新成功实例的 effectiveRevisionId，  
并满足部分失败不切换未批准作用域、不静默终止旧 Revision、未收敛前不推进订阅级 currentEffectiveRevisionId 的要求。

#### AC4：退出结果不虚报

在暂停、撤销、到期或终止控制已发送的前置条件下，  
当仍有目标失败、不可达或未知时，  
系统应保持 ControlRequest/ExitChecklist 未完成并生成 SubscriptionRemediationCase，  
并满足请求 ACK 不被解释为实际停发的要求。

#### AC5：收口条件严格

在所有必要目标完成、权限/凭证/会话收口且证据齐全或存在有权例外的前置条件下，  
当运营人员确认收口时，  
系统应将退出清单置为 COMPLETED 并固定证据，  
并满足 UNKNOWN、失败或无 Owner 项存在时拒绝关闭的要求。

## 研发需求：FR2-RD-08 领域事件、Outbox、顺序、迟到与重放补偿

关联功能需求：FR2-FR-02、FR2-FR-05、FR2-FR-08、FR2-FR-10、FR2-FR-11、FR2-FR-13。

### 需求描述

本研发需求实现 FR-2 领域事件的原子记录、可靠发布、消费幂等、聚合顺序、迟到事件保护、死信、受控重放和补偿，确保跨系统异步协作不破坏当前事实。当订阅聚合完成提交、批准、激活、替代、暂停、恢复、到期、撤销或终止事务时，系统应在同一事务内记录领域事实与 OutboxMessage；当消费外部事件时，系统应根据 aggregateId、aggregateRevision、effectiveAt、operationEpoch、eventId 和 payloadHash 判定重复、顺序和优先级，旧事件不得覆盖高 Revision 或更高优先级终态。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 状态/优先级 | 外部交互 / 边界 |
|---|---|---|---|---|
| EventEnvelope | eventId、eventType、schemaVersion、producer、occurredAt、effectiveAt | 不可变 | 每事件唯一 | 统一跨 FR envelope |
| AggregateRef | aggregateType、aggregateId、aggregateRevision、payloadHash | 单聚合递增 | 低 Revision 不回退 | 同 Revision 异 Hash 争议 |
| Causality | traceId、causationId、correlationId、operationEpoch | 全链传递 | 新 Epoch 隔离旧回执 | 支持端到端追踪 |
| OutboxMessage | eventId、payload、publishStatus、retryCount | 与业务事务原子写入 | PENDING/SENT/FAILED/DEAD | 重试不重复业务写入 |
| InboxRecord | consumer、eventId、processedAt、resultHash | 消费前去重 | PROCESSED/IGNORED/FAILED | 支持受控重放 |
| DeadLetterRecord | eventId、reason、payloadRef、owner | 不静默丢弃 | OPEN/REPLAYING/RESOLVED | 人工复核后重放 |

* 撤销、到期、终止和更高 operationEpoch 的停止决定优先于迟到批准、激活与恢复。
* 旧 Revision 停发回执不得暂停已切换的新 Revision；目标 Revision 与 operationEpoch 必须同时匹配。
* 续期生效后旧 Revision 的到期定时事件应被幂等忽略并保留审计。

### 验收标准

#### AC1：业务与事件原子记录

在订阅状态转换成功的前置条件下，  
当事务提交时，  
系统应同时保存聚合变化和待发布 OutboxMessage，  
并满足不存在业务成功但事件永久缺失或事件发送但业务回滚的要求。

#### AC2：重复事件幂等

在同一消费者已处理 eventId 的前置条件下，  
当重复事件到达时，  
系统应返回已处理结果或安全忽略，  
并满足不重复转换状态、创建任务、发送控制或追加业务证据的要求。

#### AC3：迟到事件受保护

在当前聚合已进入更高 Revision、更新 operationEpoch 或更高优先级终态的前置条件下，  
当旧批准、激活、暂停或恢复事件到达时，  
系统应记录其为过期/被替代并保持当前事实，  
并满足必要时按 Owner 创建 FR-2 SubscriptionRemediationCase 或引用 FR-5 RuntimeIncident 进行补偿停发/对账的要求。

#### AC4：同版本异内容争议

在相同 aggregateId 和 aggregateRevision 已保存不同 payloadHash 的前置条件下，  
当新事件到达时，  
系统应隔离该事件并创建争议/人工核查，  
并满足不采用最后写入、不自动重放的要求。

#### AC5：死信可控重放

在事件因临时依赖失败进入死信的前置条件下，  
当有权人员修复原因并发起重放时，  
系统应保留原 eventId/因果链并按当前优先级重新判定，  
并满足重放可审计且不能绕过终态保护的要求。

## 研发需求：FR2-RD-09 运行兴趣会话、数据最小化与通道责任

关联功能需求：FR2-FR-04、FR2-FR-12、FR2-FR-13。

### 需求描述

本研发需求实现运行兴趣策略和短时会话契约的创建、责任边界、到期关闭、隐私最小化与证据关联，按 Uu-A、PC5、Uu-T、Uu-B 区分责任。FR-2 负责校验并发布 RuntimeInterestPolicy/matchingOwner；Uu-A 的逐车选择由 OEM 域执行，PC5 的相关性由车辆本地执行，FR-2 不执行也不伪造这些外部匹配结果。当获准 Uu-T 场景创建短时会话时，系统应根据有效 SubscriptionRevision、任务授权、路线/围栏、TTL 和数据分类限制会话内容；会话过期、任务结束或长期订阅失效时停止新的平台侧会话匹配并执行保留/清理策略。FR-2 不把 MATCHED、DELIVERING 或 DEGRADED 混入会话生命周期。

### 数据与状态

| 业务对象 | 关键字段 | 读写规则 | 状态/结果 | 外部交互 / 边界 |
|---|---|---|---|---|
| RuntimeInterestPolicy | subscriptionRevision、mode、matchingOwner、scope | 随 Revision 固定 | 不单独扩权 | Uu-A/PC5 可无城市会话 |
| RuntimeSession | sessionId、pseudonym、taskRef、route/geofence、validTo | 短期、最小化 | CREATED/ACTIVE/EXPIRING/CLOSED/TIMED_OUT/REVOKED | 仅获准通道创建 |
| ExternalMatchResultRef | policy/session、eventId、result、reasonCode、evaluatedAt、producer | 仅保存外部结果引用或受控投影 | MATCHED/NOT_MATCHED/UNKNOWN | Uu-A 由 OEM、PC5 由车辆；不改变会话状态 |
| PrivacyPolicyRef | purpose、precision、recipient、retention、deleteAction | 由 Profile/授权引用 | CURRENT/STALE | 不保存生产私钥 |
| SessionEvidence | open/close reason、actor、traceId、evidenceRef | 追加写 | 可核验/不可核验分开 | 深层交付证据归 FR-5 |

* 默认不在城市侧持有量产逐 VIN 白名单和全量实时位置；如项目确需，必须单独完成必要性、授权、安全和准出评审。
* PC5 区域广播不创建逐车 RuntimeSession；车辆本地相关性结果除非有明确反馈契约，否则显示 UNVERIFIABLE。
* 运行会话失效不修改 ServiceEntitlementRevision 或长期 SubscriptionRevision。
* S1 仅交付 Uu-A RuntimeInterestPolicy、matchingOwner 和外部结果引用模型；PC5/Uu-T 完整能力在 S3，Uu-B 在 P1，未进入切片的能力只允许显示禁用态与启用前置条件。

### 验收标准

#### AC1：按通道使用正确模式

在不同 ChannelProfile 生效的前置条件下，  
当系统生成或校验运行兴趣契约时，  
系统应写明 Uu-A OEM 域选择、PC5 车辆本地判断、Uu-T 平台短会话或获准 Uu-B 边缘模式的 matchingOwner、所需最小输入和可接收结果类型，  
并满足 FR-2 不代替 OEM/车辆执行匹配、不把四种通道视为同构逐车订阅的要求。

#### AC2：短会话不越界

在测试任务与长期订阅有效的前置条件下，  
当用户创建 RuntimeSession 时，  
系统应将路线/围栏、期限、用途、标识和通道限制在允许交集内，  
并满足越界部分拒绝且不改变长期契约的要求。

#### AC3：最小化与隔离

在会话需要车辆或位置相关信息的前置条件下，  
当系统保存或共享数据时，  
系统应采用批准的伪名、精度、接收方、保留期和访问策略，  
并满足跨租户、跨环境和非必要长期保存被阻断的要求。

#### AC4：到期关闭

在会话达到 validTo、任务结束或长期订阅失效的前置条件下，  
当定时或事件处理触发时，  
系统应停止新匹配、记录关闭原因并执行保留/清理动作，  
并满足迟到延长请求不能复活无有效依据会话的要求。

#### AC5：匹配与交付事实分开

在会话处于 ACTIVE 的前置条件下，  
当事件进行相关性判断和后续投递时，  
系统应分别保存有权外部 Owner 返回的 ExternalMatchResultRef（或明确由平台执行的 Uu-T MatchResult）与投递证据引用，  
并满足 MATCHED 不被解释为已发送、已接收或已展示的要求。

## 研发需求：FR2-RD-10 契约接口、审计可观测性、性能与恢复验证

关联功能需求：FR2-FR-01 至 FR2-FR-13。

### 需求描述

本研发需求实现 FR-2 管理 API、异步事件、统一错误/原因码、审计、业务指标、日志/指标/追踪、性能容量和恢复验证的工程基线。系统应以 OpenAPI/AsyncAPI 或等价可校验契约定义请求响应、字段分类、分页排序、幂等、ETag、异步任务、事件 Envelope、错误码和版本兼容；所有高风险读写应记录主体、对象 ID/Revision、前后哈希、授权决定、结果、reasonCode 和 traceId。性能、数据规模、超时、重试、RTO/RPO、留存和浏览器基线由 M0 冻结，未冻结前不得伪造达标结论。

### 数据与状态

| 能力 | 最小内容 | 验证方式 | 边界 |
|---|---|---|---|
| OpenAPI | 鉴权、字段分类、分页/过滤/排序、Idempotency-Key、ETag、错误结构、异步 taskId | Schema/契约测试 | 不把 HTTP 200 映射为业务成功 |
| AsyncAPI/Event | eventId、aggregate、revision、occurredAt、effectiveAt、trace/causation、payloadHash | 生产者/消费者兼容测试 | Schema 变化需版本策略 |
| Error/ReasonCode | domain、code、messageKey、retryable、ownerDomain、nextAction | 前后端/测试字典一致性 | 文案不替代稳定编码 |
| AuditRecord | actor、tenant、action、object、revision、before/afterHash、accessDecision、result | 追加写与完整性校验 | 普通管理员不可改删 |
| Telemetry | trace、业务指标、任务延迟、失败、重试、死信、依赖健康 | 仪表盘/告警/追踪 | 不记录私钥或超范围敏感数据 |
| NFR Baseline | P95/P99、峰值规模、并发、超时、RTO/RPO、留存 | 容量、故障、恢复演练 | 数值由 M0 签认 |

* 页面成功、构建成功、HTTP 200、事件 ACK、FR-4 接受请求、节点应用成功和车辆使用分别验收。
* 本地存储、Mock、静态 HTML 或前端枚举不得作为生产业务事实源。
* 审计写入异常对高风险动作默认阻断；如项目批准受控降级，必须记录范围、补写和复核。

### 验收标准

#### AC1：契约可校验

在 API 和事件契约已发布的前置条件下，  
当生产者、消费者和 Mock 执行契约测试时，  
系统应产生字段、枚举、必填、兼容和错误码一致的结果，  
并满足破坏性变化无法在未升级版本时进入联调的要求。

#### AC2：业务错误可行动

在权限、状态、并发、规则或依赖错误发生的前置条件下，  
当系统返回失败时，  
系统应产生稳定 reasonCode、可重试性、责任域、当前 Revision 和下一动作，  
并满足不只返回通用异常或成功 HTTP 状态的要求。

#### AC3：高风险审计完整

在提交、审批、激活、暂停、恢复、撤销影响处置、终止、敏感证据访问或导出发生的前置条件下，  
当操作结束时，  
系统应写入不可篡改审计及前后哈希、权限决定和 traceId，  
并满足审计失败被告警且按策略阻断/补偿的要求。

#### AC4：性能与容量可验收

在 M0 已冻结数据规模、并发、P95/P99 和超时基线的前置条件下，  
当执行列表、预检、影响计算、审批和异步任务容量测试时，  
系统应产生可重复的测量结果与瓶颈证据，  
并满足未达标时不以功能正确替代性能准出的要求。

#### AC5：恢复演练不丢事实

在数据库、事件、规则或外部依赖发生故障并按 RTO/RPO 恢复的前置条件下，  
当系统执行重试、重放和补偿时，  
系统应保持聚合 Revision、幂等记录、事件顺序、审计与外部结果一致，  
并满足不产生重复订阅、状态回退或不可追踪副作用的要求。

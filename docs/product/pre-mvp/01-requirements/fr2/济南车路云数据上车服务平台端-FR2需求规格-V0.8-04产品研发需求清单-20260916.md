# FR-2 产品研发需求清单

> 文档版本：V0.8  
> 本文用于 UX、前端和页面测试拆单。每个交付单元固定包含功能范围、页面内容、交互规则、业务规则和验收结果；服务端状态机、事件、权限和跨 FR 编排见 V0.8-03。  
> 页面映射：FR2-P01～P03 对应 V0.6 PG10；FR2-P04～P08 对应 PG11；FR2-P09～P14 对应 PG12；FR2-P15 对应 PG01 订阅组件。  
> 共同要求：所有页面显示当前租户、环境、对象 ID/Revision、状态更新时间和审计入口；Loading、Empty、Error、Partial、No Permission、Conflict 六态必须逐页可验收。
> Release/Slice：以 V0.8-00 第 8.3～8.4 节为唯一事实源；“S1 只验收 Uu-A”是待 U01/U02 签认的建议基线，PC5/Uu-T 为 S3，Uu-B 为 P1，未进入切片的能力必须同时在页面和服务端不可用。
> 开工边界：本文是页面规格评审基线，不构成代码授权。只有在目标 StoryId 通过 DoR 且 DevelopmentStartDecision 签认后才可编码；跨 FR 只允许接口、Mock、只读投影或已确认证据，移动端、车端和 OEM 系统零改动。

## 0. 跨页面规格评审基线（非开工授权）

### 0.1 动作与权限

所有按钮、菜单、批量动作和深链必须引用 V0.8-00 第 7.2 节的稳定 `permissionCode`，并声明 `visibleWhen、enabledWhen、denyReason、confirmationLevel、auditLevel`。前端无权时隐藏或禁用不替代服务端 RBAC＋ABAC＋对象状态＋SoD 校验；对象不可见时不得通过数量、错误文案或导出泄露其存在。

### 0.2 六态模板

| 页面状态 | 进入条件 | 必须保留 | 允许动作 | 恢复 CTA | reasonCode / telemetry / fixture |
|---|---|---|---|---|---|
| Loading | 首次读取或明确刷新尚未完成 | 租户、环境、路由、对象 ID/Revision；刷新时保留最近成功内容 | 返回、取消可取消任务；禁止冲突写入 | 超时后重试/查看任务 | `LOAD_IN_PROGRESS`；loadDuration；延迟响应 fixture |
| Empty | 请求成功且有权范围内为零 | 查询条件、数据时间、空态类型 | 有创建权时创建；否则调整筛选/返回来源 | 新建或清除筛选 | `EMPTY_NO_DATA`/`EMPTY_FILTERED`；emptyType；零记录 fixture |
| Error | 核心请求失败且无可用正文 | 安全的上下文、未提交本地输入、traceId | 重试、返回、复制诊断号 | 重试/联系 Owner | 稳定依赖错误码；errorDomain；5xx/超时 fixture |
| Partial | 至少一项成功且一项失败/UNKNOWN | 所有成功内容、各自数据时间和来源 | 操作不依赖失败源的安全动作；重试失败分区 | 重试失败项/进入来源 | `PARTIAL_DEPENDENCY`；failedSources；单依赖失败 fixture |
| No Permission | 服务端 DENY 或字段级脱敏 | 不泄露超范围正文；可保留获准的脱敏上下文 | 返回、申请权限、联系 Owner | 申请权限/切换有权上下文 | `ACCESS_DENIED_*`；permissionCode；跨租户 fixture |
| Conflict | ETag、Revision、inputHash 或对象状态与提交基准不一致 | 未保存输入、当前服务端版本、结构化 Diff | 刷新比较、复制本地修改、基于最新版重建 | 比较并重建/放弃本地修改 | `VERSION_CONFLICT`/`STATE_CONFLICT`；base/current；并发 fixture |

页面对六态的“差异声明”必须说明触发源、保留内容、禁用动作和特定 CTA；不得只写一个状态名称。

### 0.3 高风险表单字段字典

字段分类 `INTERNAL/CONTROLLED/RESTRICTED` 为产品基线，最终分级与保留规则由 M0 的 FieldClassificationVersion/RetentionPolicyVersion 签认。日期时间以 UTC ISO 8601 传输、项目业务时区展示；有效区间统一为 `[validFrom, validTo)`。

| 字段 | 类型 / 格式 | 来源 / 默认 | requiredWhen | 校验 / 单位 | 分类 | 失败 reasonCode |
|---|---|---|---|---|---|---|
| P02.entitlementRevisionId | string / UUID | FR-1 候选或深链；无默认 | 始终 | ACTIVE＋ENABLED＋CURRENT，且属当前租户/应用/环境 | CONTROLLED | ENTITLEMENT_NOT_ELIGIBLE |
| P02.applicationClientId | string / UUID | PG07；无默认 | 始终 | 与 OEM、环境、权益一致 | CONTROLLED | APPLICATION_SCOPE_MISMATCH |
| P02.serviceVersionId | string / UUID | 权益允许集合；无默认 | 始终 | PUBLISHED 且未弃用/失效 | INTERNAL | SERVICE_VERSION_NOT_AVAILABLE |
| P02.capabilityProfileRevisionId | string / UUID | PG08；无默认 | 服务要求车型能力时 | OEM_CONFIRMED、兼容结论 CURRENT | CONTROLLED | CAPABILITY_NOT_CURRENT |
| P02.coverageSelector | object / typed selector | 用户选择；空不等于全部 | 始终 | selectorType、objectRefs、direction、spatialVersion 完整且在允许交集内 | RESTRICTED | COVERAGE_OUT_OF_SCOPE |
| P02.operatingSchedule | object / timezone＋intervals | Project Profile；无默认全时段 | 服务受时段/ODD 限制时 | 时区有效、跨日/节假日明确 | CONTROLLED | SCHEDULE_INVALID |
| P02.channelType | enum | 无默认 | 始终 | S1 仅 `UU_A` 可选；`PC5/UU_T` S3，`UU_B` P1 | INTERNAL | CHANNEL_NOT_IN_RELEASE |
| P02.endpointProfileRevisionId | string / UUID | PG07 已登记端点 | channelType=UU_A | 环境匹配、证书有效、连接资料完整 | RESTRICTED | ENDPOINT_NOT_READY |
| P02.topicProfile | object / topic＋schema/profileVersion | EndpointProfile/ICD；无默认 | channelType=UU_A | Topic 属于端点允许集合；Schema/Profile 兼容 ServiceVersion | CONTROLLED | TOPIC_PROFILE_INCOMPATIBLE |
| P02.deliveryRole | enum PRIMARY/STANDBY | 默认 PRIMARY | 每个 Uu-A binding | 同一原子作用域至少一个 PRIMARY；STANDBY 必须声明接管条件 | INTERNAL | CHANNEL_ROLE_INVALID |
| P02.quota | integer / events·day⁻¹ 或 bytes·day⁻¹ | 权益/Offering 上限 | 权益或 Offering 有配额时 | 正整数且不超过最小上限；单位固定 | CONTROLLED | QUOTA_OUT_OF_RANGE |
| P02.rateLimit | integer / events·s⁻¹ | ServiceVersion/Endpoint 上限 | channelType=UU_A | 正整数且不超过端点、服务、权益最小上限 | CONTROLLED | RATE_LIMIT_OUT_OF_RANGE |
| P02.dedupPolicy | object / keyFields＋windowMs | ICD/ServiceVersion 建议值 | channelType=UU_A | keyFields 属于 Schema；windowMs 在允许范围 | INTERNAL | DEDUP_POLICY_INVALID |
| P02.fallbackPolicy | object / trigger＋targetBinding＋maxDuration | 无默认自动回落 | 配置 STANDBY 时 | 目标存在且兼容；不得扩大 Coverage/用途/质量包络 | CONTROLLED | FALLBACK_POLICY_INVALID |
| P02.interestMode | enum OEM_APPLICATION_FILTER | S1 固定值 | channelType=UU_A | S1 不允许城市侧逐 VIN/实时位置匹配 | CONTROLLED | INTEREST_MODE_NOT_ALLOWED |
| P02.matchingOwner | enum OEM_DOMAIN | S1 固定值 | channelType=UU_A | 必须与 OEM/ApplicationClient 责任一致 | CONTROLLED | MATCHING_OWNER_INVALID |
| P02.qualityPolicyVersion | string / version | ServiceVersion 绑定 | 始终 | 只能等于或收紧硬约束 | INTERNAL | QUALITY_POLICY_RELAXED |
| P02.feedbackProfile | enum F0-F3 | 服务允许的最低档 | 始终 | 通道/OEM 能力允许，目的和保留明确 | CONTROLLED | FEEDBACK_PROFILE_UNSUPPORTED |
| P02.evidenceTarget | enum R0-R6/RX | 不高于可证明上限 | 始终 | 与 feedbackProfile、通道和合规边界一致 | CONTROLLED | EVIDENCE_TARGET_UNPROVABLE |
| P02.feedbackRetentionPolicyRef | string / version | RetentionPolicyVersion | feedbackProfile≠F0 | 目的、保存期、删除动作和接收方完整 | RESTRICTED | FEEDBACK_RETENTION_INVALID |
| P02.maskingPolicyRef | string / version | FieldClassificationVersion | 反馈/证据含 CONTROLLED 或 RESTRICTED 字段 | 脱敏、精度和可见角色满足分类策略 | RESTRICTED | MASKING_POLICY_INVALID |
| P02.validFrom / validTo | date-time / UTC | validFrom 可建议审批后；validTo 无默认无限期 | 始终 | `validFrom<validTo` 且不超过所有上游最早到期 | CONTROLLED | VALIDITY_OUT_OF_RANGE |
| P02.exitObligations | array / obligationType＋owner＋dueRule＋evidenceRule | ServiceVersion/协议模板 | 始终 | 至少覆盖停发、解绑/凭证、会话、证据和未收口处置 | CONTROLLED | EXIT_OBLIGATION_INCOMPLETE |
| P08.decision | enum | 无默认 | 始终 | APPROVED/CONDITIONALLY_APPROVED/RETURNED/REJECTED | CONTROLLED | DECISION_NOT_ALLOWED |
| P08.reasonCode | string / dictionary code | ReasonCodeVersion | 始终 | 与 decision、风险和当前节点兼容 | CONTROLLED | REASON_CODE_INVALID |
| P08.effectiveAt | date-time / UTC | 当前时间建议值 | 批准/条件批准时 | 不早于决定时间；不得越过上游有效期 | CONTROLLED | DECISION_EFFECTIVE_TIME_INVALID |
| P08.conditions | array | PrecheckConditionCandidate＋审批新增 | decision=CONDITIONALLY_APPROVED | 至少一项；每项结构完整 | CONTROLLED | CONDITION_REQUIRED |
| P08.condition.sourceFindingId | string / UUID | P04/P05 Finding | 来源为预检条件时 | 必须指向固定 PrecheckFinding | CONTROLLED | CONDITION_FINDING_REF_INVALID |
| P08.condition.sourceCandidateId | string / UUID | PrecheckConditionCandidate | 来源为预检条件时 | 必须记录 ACCEPTED/REJECTED/TRANSFORMED 映射 | CONTROLLED | CONDITION_MAPPING_MISSING |
| P08.condition.type | enum | 无默认 | 每项条件 | ACTIVATION_PREREQUISITE/ONGOING_OBLIGATION/SCOPE_LIMIT | CONTROLLED | CONDITION_TYPE_INVALID |
| P08.condition.scope | object | 申请允许范围 | 每项条件 | 不得扩大 Entitlement；类型化原子作用域 | RESTRICTED | CONDITION_SCOPE_OUT_OF_RIGHT |
| P08.condition.ownerSubjectId | string / UUID | 组织目录 | 每项条件 | Owner 对租户/环境/对象有责权 | CONTROLLED | CONDITION_OWNER_INVALID |
| P08.condition.dueAt | date-time / UTC | 无默认 | 每项条件 | 晚于决定时间且不超过适用边界 | CONTROLLED | CONDITION_DUE_INVALID |
| P08.condition.evidenceRule | object | 规则库 | 每项条件 | 证据类型、核验者、满足标准完整 | RESTRICTED | CONDITION_EVIDENCE_RULE_INVALID |
| P08.condition.breachAction | enum | 条件类型建议值 | 每项条件 | BLOCK_ACTIVATION/PAUSE/ESCALATE/TERMINATE 等受 Profile 限制 | CONTROLLED | BREACH_ACTION_INVALID |
| P12.changeType | enum | 无默认 | 始终 | CHANGE/RENEWAL/SERVICE_MIGRATION/SPATIAL_MIGRATION/CHANNEL_MIGRATION | INTERNAL | CHANGE_TYPE_INVALID |
| P12.baseRevisionId | string / UUID | 当前获批 Revision；只读 | 始终 | 提交时仍为所选基准，否则 Conflict | CONTROLLED | BASE_REVISION_CHANGED |
| P12.targetEffectiveAt | date-time / UTC | 无默认 | 始终 | 在批准窗口内，保留验证/回退时间 | CONTROLLED | CUTOVER_TIME_INVALID |
| P12.cutoverScope | object / instance refs | SubscriptionImpactSnapshot | 迁移/变更涉及执行时 | 只含获批原子实例，不得静默扩大 | RESTRICTED | CUTOVER_SCOPE_INVALID |
| P12.compatibilityWindow | object / UTC interval | 无默认 | 新旧并行时 | 明确开始/结束、责任和容量影响 | CONTROLLED | COMPATIBILITY_WINDOW_INVALID |
| P12.rollbackTargetRevisionId | string / UUID | 有权历史 Revision | 高风险切换时 | 当前权利、配置和兼容条件仍有效 | CONTROLLED | ROLLBACK_TARGET_NOT_ELIGIBLE |
| P12.exceptionDecisionRef | string / UUID | 有权例外流程 | 存在可受理 UNKNOWN 时 | 不适用于不可豁免 UNKNOWN；含范围、期限和签认 | RESTRICTED | UNKNOWN_EXCEPTION_INVALID |
| P13.actionType | enum | 无默认 | 始终 | PAUSE/RESUME/REVOKE_IMPACT/EXPIRY_CLOSE/TERMINATE | CONTROLLED | CONTROL_ACTION_INVALID |
| P13.reasonCode | string / dictionary code | ReasonCodeVersion | 始终 | 与 actionType、triggerSource 匹配 | CONTROLLED | CONTROL_REASON_INVALID |
| P13.scope | object / instance refs | 当前实例矩阵 | 始终 | 最小必要原子作用域 | RESTRICTED | CONTROL_SCOPE_INVALID |
| P13.effectiveAt | date-time / UTC | 紧急动作可为当前时间 | 始终 | 符合审批/Break-glass 策略 | CONTROLLED | CONTROL_EFFECTIVE_TIME_INVALID |
| P13.operationEpoch | integer / server generated | 服务端下一 Epoch；只读 | 提交后 | 对 subscription＋instance 单调递增 | INTERNAL | OPERATION_EPOCH_CONFLICT |
| P13.impactSnapshotId | string / UUID | 最新 validity=CURRENT 的快照 | 提交时 | basisRevision/hash 未过期；status=EXECUTABLE，或 HAS_UNKNOWN 已满足受控 Break-glass/例外规则 | CONTROLLED | IMPACT_SNAPSHOT_STALE |
| P13.resourceActions | array | ExitChecklist | 涉及退出/终止时 | resourceRef、EXCLUSIVE/SHARED、activeReferenceCount、UNBIND/REVOKE/RETAIN、impactApproval 完整 | RESTRICTED | SHARED_RESOURCE_ACTION_UNSAFE |
| P13.recoveryCriteria | object | 风险/测试策略 | PAUSE 且允许恢复时 | 新依据、根因关闭、恢复测试、批准角色完整 | RESTRICTED | RECOVERY_CRITERIA_INCOMPLETE |

### 0.4 页面动作—权限映射

`visibleWhen` 只控制界面呈现，`enabledWhen` 只表达当前可执行性；服务端仍必须用相同 `permissionCode`、对象状态和 ABAC/SoD 重新判定。表中“无”表示无需二次确认，不表示无需鉴权或审计。

| 页面 / 动作 | permissionCode | visibleWhen | enabledWhen | denyReason | confirmationLevel | auditLevel |
|---|---|---|---|---|---|---|
| P01 查询/重置/保存筛选/查看/查看冲突 | FR2.REQUEST.READ | 有页面读权 | 页面非 Loading/Error；对象在有权范围 | ACCESS_DENIED_REQUEST_READ | 无 | 受控读；纯本地筛选不写业务审计 |
| P01 新建/复制为新申请 | FR2.REQUEST.CREATE | 有创建权 | 存在有效权益且环境可用 | REQUEST_CREATE_NOT_ALLOWED | 无 | 标准写审计 |
| P01 继续草稿/进入补正 | FR2.REQUEST.EDIT / FR2.REMEDIATION.MANAGE | 对应对象有动作权 | 只有 DRAFT 可继续编辑；Case 未终态可进入补正 | REQUEST_NOT_EDITABLE / REMEDIATION_NOT_MANAGEABLE | 无 | 标准写审计 |
| P01 从退回申请创建后继草稿 | FR2.REQUEST.CREATE | 前驱 RequestRevision 有读权且有创建权 | 前驱=NEEDS_INFO；退回原因可读；无活动后继草稿 | CORRECTION_DRAFT_NOT_ALLOWED | 创建确认 | 标准写审计 |
| P01 撤回 | FR2.REQUEST.WITHDRAW | 有撤回权 | SUBMITTED/IN_REVIEW/NEEDS_INFO 且无最终决定 | REQUEST_WITHDRAW_NOT_ALLOWED | 二次确认＋reasonCode | 高风险审计 |
| P01 导出当前结果 | FR2.REQUEST.EXPORT | 有导出权 | 用途、字段范围和脱敏模板完整 | REQUEST_EXPORT_DENIED | 导出确认 | 敏感访问审计 |
| P02 上一步/下一步/退出 | FR2.REQUEST.READ | 有当前草稿读权 | 路由可用；退出不依赖保存成功 | ACCESS_DENIED_REQUEST_READ | 未保存输入退出时确认 | 轻量操作审计 |
| P02 保存草稿 | FR2.REQUEST.EDIT | 有编辑权 | DraftRevision、ETag 和依赖版本当前 | REQUEST_EDIT_CONFLICT | 无 | 标准写审计 |
| P02 放弃草稿 | FR2.REQUEST.ABANDON | 当前 Draft Owner/有放弃权 | RequestRevision=DRAFT；从未提交；reasonCode 完整 | REQUEST_ABANDON_NOT_ALLOWED | 高风险二次确认 | 高风险审计 |
| P02 运行预检 | FR2.PRECHECK.EXECUTE | 有执行权 | 必填字段完整且无前置格式/范围阻断 | PRECHECK_INPUT_NOT_READY | 无 | 标准写审计 |
| P03 返回修改/刷新摘要 | FR2.REQUEST.EDIT / FR2.REQUEST.READ | 对应读写权存在 | 草稿仍可编辑；依赖可读取 | REQUEST_NOT_EDITABLE / SUMMARY_NOT_READABLE | 返回修改需确认摘要失效 | 标准写审计 |
| P03 导出预览 | FR2.REQUEST.EXPORT | 有导出权 | 摘要已生成且用途/水印完整 | REQUEST_EXPORT_DENIED | 导出确认 | 敏感访问审计 |
| P03 提交申请 | FR2.REQUEST.SUBMIT | 有提交权 | inputHash、摘要、预检 CURRENT；无硬阻断 | REQUEST_SUBMIT_GUARD_FAILED | 高风险二次确认 | 高风险审计 |
| P04 查看/筛选规则和历史 | FR2.PRECHECK.READ | 有 PrecheckRun 读权 | Run 存在且字段可脱敏展示 | PRECHECK_READ_DENIED | 无 | 受控读审计 |
| P04 运行/重新预检 | FR2.PRECHECK.EXECUTE | 有执行权 | 无同 Revision 活动 Run 或规则允许并行 | PRECHECK_EXECUTE_NOT_ALLOWED | 无 | 标准写审计 |
| P04 取消任务 | FR2.PRECHECK.CANCEL | 有取消权 | runStatus=QUEUED/RUNNING 且任务可取消 | PRECHECK_CANCEL_NOT_ALLOWED | 二次确认 | 标准写审计 |
| P04 导出摘要 | FR2.REQUEST.EXPORT | 有导出权 | 固定 Run 可读取且脱敏模板完整 | PRECHECK_EXPORT_DENIED | 导出确认 | 敏感访问审计 |
| P04 创建补正 | FR2.REMEDIATION.MANAGE | 有补正管理权 | Finding=BLOCKED/INCONCLUSIVE 且无重复活动 Case | REMEDIATION_CREATE_NOT_ALLOWED | 无 | 标准写审计 |
| P05 查看来源/复制诊断引用 | FR2.PRECHECK.READ | 有规则元数据读权 | Finding 和引用存在 | PRECHECK_FINDING_READ_DENIED | 无 | 受控读审计 |
| P05 申请证据权限 | FR2.EVIDENCE.ACCESS_REQUEST | 已有受控元数据读权 | 业务用途、范围和期限完整 | EVIDENCE_ACCESS_REQUEST_INVALID | 申请确认 | 敏感访问审计 |
| P05 创建补正/标记争议 | FR2.REMEDIATION.MANAGE | 有管理权 | Finding 未失效且来源固定 | REMEDIATION_CREATE_NOT_ALLOWED | 标记争议需确认 | 标准写审计 |
| P06 保存/指派/处理/补证/退回/取消 | FR2.REMEDIATION.MANAGE | 当前 Owner/运营有权 | Case 处于对应允许状态且 ETag 当前 | REMEDIATION_ACTION_NOT_ALLOWED | 取消需 reasonCode 确认 | 标准写审计 |
| P06 验证完成 | FR2.REMEDIATION.VERIFY | 有独立验证权 | PENDING_VERIFY、非本人处理、证据/复检齐备 | REMEDIATION_VERIFY_GUARD_FAILED | 验证签认 | 高风险审计 |
| P06 发起复检 | FR2.PRECHECK.EXECUTE | 有执行权 | Case 有固定 RequestRevision 和复检条件 | PRECHECK_INPUT_NOT_READY | 无 | 标准写审计 |
| P07 查看材料/链路 | FR2.APPROVAL.READ | 当前节点、会签、审计或获准申请人 | Case/固定输入可读取 | APPROVAL_READ_DENIED | 无 | 受控读审计 |
| P07 打开决定/退回/拒绝 | FR2.APPROVAL.DECIDE | 当前 assignee 有决定权 | Case=IN_REVIEW、输入 CURRENT、无 SoD 冲突 | APPROVAL_DECIDE_GUARD_FAILED | 决定签认 | 高风险审计 |
| P07 升级会签/改派 | FR2.APPROVAL.REASSIGN | 当前 Owner/审批管理员 | Case 活动、接收人有权且不减签 | APPROVAL_REASSIGN_NOT_ALLOWED | 二次确认 | 高风险审计 |
| P07 查看审计 | FR2.AUDIT.READ | 有审计权 | 对象和时间范围有权 | AUDIT_READ_DENIED | 无 | 敏感访问审计 |
| P08 保存决定草稿/确认决定 | FR2.APPROVAL.DECIDE | 当前 assignee 有决定权 | 输入 CURRENT；条件映射、reasonCode、SoD 完整 | APPROVAL_DECIDE_GUARD_FAILED | 最终确认＋签认 | 高风险审计 |
| P09 查询/查看详情 | FR2.SUBSCRIPTION.READ | 有订阅/实例读权 | 对象处于有权租户/环境 | SUBSCRIPTION_READ_DENIED | 无 | 受控读审计 |
| P09 导出 | FR2.SUBSCRIPTION.EXPORT | 有导出权 | 用途、时间范围和脱敏模板完整 | SUBSCRIPTION_EXPORT_DENIED | 导出确认 | 敏感访问审计 |
| P09 查看 Revision 链 | FR2.REVISION.COMPARE | 有两个版本读权 | 不可变 Revision 可读取 | REVISION_COMPARE_DENIED | 无 | 受控读审计 |
| P09 查看影响 | FR2.IMPACT.READ | 有影响读权 | Snapshot 可读取 | IMPACT_READ_DENIED | 无 | 受控读审计 |
| P09 进入诊断/建运行工单 | FR2.DIAGNOSIS.READ / FR2.RUNTIME_WORKITEM.CREATE | 有诊断/建单权 | 诊断输入完整；FR-5 接口可用 | DIAGNOSIS_DENIED / RUNTIME_WORKITEM_CREATE_DENIED | 建单确认 | 受控读/标准写审计 |
| P09 续期/变更/迁移 | FR2.SUBSCRIPTION.CHANGE | 订阅组头有变更权 | S2 已启用且当前 Revision 可作为基准 | CHANGE_NOT_IN_RELEASE / CHANGE_NOT_ALLOWED | 进入向导前确认基准 | 高风险审计 |
| P09 进入暂停/终止影响 | FR2.CONTROL.PLAN | 有控制规划权 | 原子实例可被作用且无冲突操作 | CONTROL_PLAN_NOT_ALLOWED | 无 | 标准写审计 |
| P10 查看页签/外部深链 | FR2.SUBSCRIPTION.READ | 有订阅读权 | 页头 Revision 语境固定 | SUBSCRIPTION_READ_DENIED | 无 | 受控读审计 |
| P10 提交条件证据 | FR2.CONDITION.EVIDENCE.SUBMIT | 当前 Condition Owner/获授权协作人 | Condition=PENDING/VIOLATED/EXPIRED；证据引用和 hash 完整 | CONDITION_EVIDENCE_SUBMIT_DENIED | 提交确认 | 标准写审计 |
| P10 核验条件履行 | FR2.CONDITION.VERIFY | 有独立核验权 | Condition=PENDING/VIOLATED；非本人提交；证据规则满足 | CONDITION_VERIFY_GUARD_FAILED | 核验签认 | 高风险审计 |
| P10 确认条件违反 | FR2.CONDITION.BREACH.CONFIRM | 有条件违反确认权 | Condition=PENDING/SATISFIED；违反证据和 breachAction 完整 | CONDITION_BREACH_CONFIRM_DENIED | 最高风险签认 | 最高风险审计 |
| P10 豁免可豁免条件 | FR2.CONDITION.WAIVE | 明确授权的合规/安全人员 | Condition 可豁免；双人复核、范围、期限和依据完整 | CONDITION_WAIVE_NOT_ALLOWED | 最高风险双人签认 | 最高风险审计 |
| P10 变更/续期/迁移 | FR2.SUBSCRIPTION.CHANGE | 有变更权 | S2 已启用且基准 CURRENT | CHANGE_NOT_IN_RELEASE / CHANGE_NOT_ALLOWED | 进入向导前确认 | 高风险审计 |
| P10 暂停/终止 | FR2.CONTROL.PLAN | 有控制规划权 | 实例作用域明确且影响可计算 | CONTROL_PLAN_NOT_ALLOWED | 无；执行在 P13 再确认 | 标准写审计 |
| P10 诊断/建工单 | FR2.DIAGNOSIS.READ / FR2.RUNTIME_WORKITEM.CREATE | 有对应权限 | 诊断输入完整；FR-5 接口可用 | DIAGNOSIS_DENIED / RUNTIME_WORKITEM_CREATE_DENIED | 建单确认 | 受控读/标准写审计 |
| P10 导出审计证据 | FR2.SUBSCRIPTION.EXPORT | 有导出权 | EvidencePackage 用途/范围/脱敏完整 | SUBSCRIPTION_EXPORT_DENIED | 导出确认 | 敏感访问审计 |
| P11 比较/交换/仅看变化 | FR2.REVISION.COMPARE | 两个 Revision 均有读权 | Diff 基准固定 | REVISION_COMPARE_DENIED | 无 | 受控读审计 |
| P11 导出 Diff/进入影响 | FR2.SUBSCRIPTION.EXPORT / FR2.IMPACT.READ | 有对应权限 | Diff Hash 固定；Snapshot 可读 | DIFF_EXPORT_DENIED / IMPACT_READ_DENIED | 导出确认 | 敏感访问/受控读审计 |
| P12 保存/提交/撤回变更候选 | FR2.SUBSCRIPTION.CHANGE | S2 已启用且有变更权 | 基准、Diff、预检、影响和回退门禁满足 | CHANGE_NOT_IN_RELEASE / CHANGE_GUARD_FAILED | 提交/撤回二次确认 | 高风险审计 |
| P12 运行预检/比较/查看影响 | FR2.PRECHECK.EXECUTE / FR2.REVISION.COMPARE / FR2.IMPACT.READ | 对应权限存在 | 候选输入完整且有权 | PRECHECK_INPUT_NOT_READY / IMPACT_READ_DENIED | 无 | 标准写/受控读审计 |
| P13 重算影响/保存草稿 | FR2.CONTROL.PLAN | 有规划权 | 当前实例和基准 Revision 可读取 | CONTROL_PLAN_NOT_ALLOWED | 无 | 标准写审计 |
| P13 提交暂停/终止 | FR2.CONTROL.PAUSE / FR2.CONTROL.TERMINATE | 有对应高风险权限 | Impact validity=CURRENT；status=EXECUTABLE 或符合受控 Break-glass/例外；作用域最小 | CONTROL_EXECUTE_GUARD_FAILED | 最高风险二次确认＋签认 | 最高风险审计 |
| P13 申请恢复 | FR2.CONTROL.RESUME | 有恢复权 | 根因关闭、测试通过、新依据和 SoD 完整 | CONTROL_RESUME_GUARD_FAILED | 恢复签认 | 最高风险审计 |
| P13 取消未执行请求/创建处置 | FR2.CONTROL.PLAN / FR2.REMEDIATION.MANAGE | 有对应权限 | ControlRequest 尚无外部副作用；Case 字段完整 | CONTROL_CANCEL_NOT_ALLOWED / REMEDIATION_CREATE_NOT_ALLOWED | 取消需确认 | 高风险/标准写审计 |
| P13 更新退出项 | FR2.EXIT.MANAGE | 资源 Owner/有退出管理权 | ExitChecklist=OPEN/IN_PROGRESS；Impact validity=CURRENT；资源动作安全 | EXIT_ITEM_ACTION_NOT_ALLOWED | 共享资源动作需高风险确认 | 高风险审计 |
| P13 核验退出收口 | FR2.EXIT.VERIFY | 有独立核验权 | ExitChecklist=PENDING_VERIFY；非本人处理；必要证据齐全 | EXIT_VERIFY_GUARD_FAILED | 最高风险签认 | 最高风险审计 |
| P13 创建运行工单 | FR2.RUNTIME_WORKITEM.CREATE | 有 FR-5 建单权 | 运行/交付异常输入和证据引用完整；FR-5 接口可用 | RUNTIME_WORKITEM_CREATE_DENIED | 建单确认 | 标准写审计 |
| P14 刷新/查看来源/复制诊断引用 | FR2.DIAGNOSIS.READ | 有诊断权 | 诊断输入有权且在保留期 | DIAGNOSIS_DENIED | 无 | 受控读审计 |
| P14 建运行工单 | FR2.RUNTIME_WORKITEM.CREATE | 有建单权 | 诊断输入、首个阻断层和证据引用完整 | RUNTIME_WORKITEM_CREATE_DENIED | 建单确认 | 标准写审计 |
| P15 筛选/刷新/保存视图/已读/关注/查看来源 | FR2.WORKBENCH.READ | 有工作台权 | 联合投影可读取 | WORKBENCH_READ_DENIED | 无 | 轻量操作/受控读审计 |
| P15 转交 FR-2 处置 | FR2.TASK.REASSIGN | 当前 Owner/FR-2 管理员 | 仅 SubscriptionRemediationCase；接收人有权 | TASK_REASSIGN_NOT_ALLOWED | 转交确认 | 标准写审计 |
| P15 建运行工单/转交 FR-5 任务 | FR2.RUNTIME_WORKITEM.CREATE / FR2.WORKBENCH.READ | 有对应权限 | 建单输入完整；转交仅深链 FR-5 | RUNTIME_WORKITEM_CREATE_DENIED / EXTERNAL_ACTION_REQUIRED | 建单确认 | 标准写/受控读审计 |
| P01～P15 查看审计入口 | FR2.AUDIT.READ | 有审计权时才显示 | 页面当前对象与时间范围有权 | AUDIT_READ_DENIED | 无 | 敏感访问审计 |

### 0.5 页面六态差异声明

下表只声明相对 0.2 通用模板的差异；未列出的行为继承通用模板。“禁用动作”指页面层面的额外禁用，不替代权限和状态机守卫。

| 页面 | 特定触发源 | 额外保留内容 | 额外禁用动作 | 特定恢复 CTA / fixture |
|---|---|---|---|---|
| P01 | 统计卡失败、筛选无结果、Draft ETag 冲突 | 列表、筛选、分页、展开行、未保存筛选 | Conflict 时继续办理/撤回；Partial 时仅禁依赖失败的统计动作 | 重载冲突行/基于最新版继续；统计 5xx、零记录、并发保存 fixture |
| P02 | 权益/能力/端点局部失败、自动保存失败、基准变化 | 全部分步输入、当前步骤、lastSavedVersion、依赖数据时间 | 提交、依赖失败步骤的下一步、非 S1 通道编辑 | 重试依赖/导出未保存摘要/比较并重建；端点超时、ETag 冲突 fixture |
| P03 | 摘要生成失败、预检 STALE、inputHash 冲突 | 双摘要最近成功版本、Diff、声明草稿 | 提交、导出未完成摘要 | 刷新摘要/返回修改；Hash 变化、证据局部失败 fixture |
| P04 | 规则任务超时、单层依赖失败、输入变化 | 已完成层、Run 历史、固定 inputSnapshot | 当前 Run 重复启动、STALE 结果用于审批 | 重试失败层/新建 Run；超时、取消、单依赖 UNKNOWN fixture |
| P05 | 证据正文无权/过期/加载失败、Finding STALE | 规则、expected/actual、受控元数据、返回滚动位置 | 下载/复制敏感正文、对原 Finding 改 PASS | 申请权限/查看来源/新建复检；字段脱敏、证据 404 fixture |
| P06 | 附件失败、Case ETag 冲突、验证退回 | 任务正文、已提交证据元数据、处理日志 | 验证人冲突时完成；硬门禁 Case 取消 | 重传/比较最新版/补证；附件超时、并发指派 fixture |
| P07 | 固定输入 STALE、证据局部失败、SoD 冲突 | 固定 RequestRevision、审批链、已办意见 | 批准/条件批准；越权改派 | 退回重检/升级会签/合法改派；SoD、委托过期 fixture |
| P08 | Case 被处理、条件映射缺失、决定幂等冲突 | 决定草稿、条件草稿、固定输入哈希 | 确认决定 | 刷新 Case/补齐映射；重复提交、候选条件遗漏 fixture |
| P09 | 单状态源失败、实例混跑、筛选上下文冲突 | 其他成功状态列、每列数据时间、订阅分组和实例行 | 依赖失败源相关动作；行内变更 | 重试单源/重载分组；FR-5 超时、MIXED_REVISION_VIEW fixture |
| P10 | 单页签失败、历史 Revision、外部事实 UNKNOWN | 页头 Revision 语境、其他页签、最近成功事实 | 历史 Revision 写操作、UNKNOWN 依赖的高风险动作 | 重试页签/进入来源；配置服务 5xx、无证据权限 fixture |
| P11 | 证据局部失败、比较基准变化、敏感值无权 | 两个 Revision、Diff Hash、变化类别 | 导出未固定 Diff、选择无权回退目标 | 重新计算/申请字段权限；基准替代、空间 UNKNOWN fixture |
| P12 | S2 未启用、baseRevision 变化、影响 UNKNOWN | 候选草稿、Diff、影响任务进度 | S1 全部写动作；不可豁免 UNKNOWN 的提交 | 查看 Release 计划/重新基线；功能开关关闭、基准冲突 fixture |
| P13 | Impact STALE、Control 部分/UNKNOWN、共享资源风险 | ControlRequest、逐目标回执、operationEpoch、退出清单 | 重复执行、无影响审批的全局 REVOKE、未满足恢复 | 重算影响/创建 Case/申请恢复；部分回执、共享证书 fixture |
| P14 | 无事件命中、单层不可用、证据超保留期 | 五层成功事实、诊断输入、最高可证明层级 | 直接改订阅/发布状态、越级结论 | 重试失败层/建 FR-5 工单；no-hit、UNVERIFIABLE fixture |
| P15 | 单卡片源失败、任务已被他人处理、外部任务只读 | 其他卡片、筛选、滚动、来源系统/Owner | 在聚合页完成高风险动作、改写 FR-5 Owner | 刷新源任务/深链来源；卡片超时、并发处理 fixture |

---

## 研发需求名称

【订阅申请】-【FR2-P01 申请列表与继续办理】

## 描述

作为 OEM/TSP 订阅申请人与城市订阅运营人员，  
在需要新建、继续或查找一次订阅申请时，  
我希望通过申请列表快速识别草稿、待补正、审批中和已结束申请，  
以便从正确 Revision 继续办理且避免重复申请。

关联功能需求：FR2-FR-01、FR2-FR-02、FR2-FR-06。

### 1. 功能范围

- 支持查询本人或权限范围内的订阅申请；
- 支持新建、继续 DRAFT、查看、从 NEEDS_INFO 创建后继草稿、复制为新申请、撤回和进入补正；
- 展示重复/重叠关系、阻断摘要、待办和后继 Revision；
- 支持从权益详情、工作台和通知深链进入并恢复来源上下文；
- 不在列表页直接执行审批、激活、暂停或终止。

### 2. 页面内容

- 查询条件：Request ID、Subscription ID、OEM、ApplicationClient、环境、服务、申请状态、预检结果/有效性、申请人、更新时间范围；
- 表格字段：Request ID、最新 Revision、OEM/应用/环境、服务/Offering、Coverage 摘要、流程状态、预检摘要、阻断数、当前 Owner、更新时间；
- 状态字段：requestStatus、precheckOutcome、precheckValidity 分栏显示；
- 页面操作：新建申请、查询、重置、保存筛选、导出当前结果；
- 行内操作：继续 DRAFT、从 NEEDS_INFO 创建后继草稿、查看、进入补正、撤回、查看冲突、复制为新申请；
- 六态：骨架屏、无申请、局部统计失败、列表加载失败、无权限、草稿版本冲突。

### 3. 交互规则

- 用户点击“新建申请”后，先选择当前租户/环境下有效权益；从 Entitlement 深链进入时自动带入并只读显示 Revision；
- 用户点击“继续办理”时，只能从 DRAFT 携带 requestId、draftRevision 和版本令牌进入 FR2-P02；NEEDS_INFO 必须先创建更高 requestRevision 的后继 DRAFT，原 Revision 始终只读；
- 用户点击“撤回”时，系统应展示当前 Revision、已生成待办和影响，要求填写 reasonCode 与说明；
- 当统计卡加载失败时保留已成功的列表，并标识统计数据时间和重试入口；
- 返回列表后恢复查询条件、分页、排序和展开行，不清空用户上下文。

### 4. 业务规则

- OEM 只能查看本租户和获权应用的申请；城市运营按 ABAC 作用域查看；
- 仅 DRAFT 可继续编辑；NEEDS_INFO 只允许查看、撤回或创建后继 DRAFT；SUBMITTED/IN_REVIEW 只读；终态只能查看或按规则创建新申请；
- 撤回仅用于 SUBMITTED/IN_REVIEW/NEEDS_INFO 且无最终决定的正式 Revision；DRAFT 使用“放弃草稿”，两者都不删除原 Revision；
- 检出等价或重叠关系时展示差异并优先导流至续期/变更；
- 无创建权限时空态不显示创建 CTA，应显示权限说明或联系 Owner。

### 5. 验收结果

- 用户能定位一条指定申请并从正确 Revision 继续办理；
- 空列表能区分“没有记录”“筛选无结果”和“无查看权限”；
- 重复或重叠申请展示相关对象、范围差异和处理路径；
- 统计局部失败时列表仍可操作，且 UNKNOWN 不计入正常；
- 旧版本继续办理时显示冲突和恢复方案，不覆盖最新草稿。

## 研发需求名称

【订阅申请】-【FR2-P02 新建与编辑申请向导】

## 描述

作为 OEM/TSP 订阅申请人，  
在一个有效权益需要转化为具体订阅契约时，  
我希望通过分步向导配置服务、车型、范围、通道、质量、反馈、期限和配额，  
以便形成完整且不越权的订阅草稿。

关联功能需求：FR2-FR-01、FR2-FR-02、FR2-FR-03、FR2-FR-04、FR2-FR-12。

### 1. 功能范围

- 提供选择权益、服务版本、车型/范围、通道/端点、质量/反馈、期限/配额、自动预检、合同摘要八步向导；
- 支持自动保存、手动保存、返回修改、退出并继续办理；
- S1 实现 Uu-A 字段、interestMode 和 matchingOwner；PC5/Uu-T 以 S3 禁用态展示，Uu-B 以 P1 禁用态展示，并说明启用前置条件；
- 每一步即时校验并提供阻断项修复深链；
- 上游变化时标识受影响步骤并将后续结果置为 STALE。

### 2. 页面内容

- 固定上下文：tenantId、environment、requestId、draftRevision、OEM、ApplicationClient、EntitlementRevision、完成度、阻断数和最近保存时间；
- 权益/服务：OfferingVersion、ServiceVersion、用途、治理等级、条件、允许/禁用范围；
- 车型/时空：CapabilityProfileRevision、Compatibility、CoverageSelector、SpatialModelVersion、方向/车道/Movement、schedule、timezone、ODD；
- 通道/端点：channelType、EndpointProfileRevision、Topic/Profile、主备顺序、配额、限流、去重/回落、interestMode、matchingOwner；
- 质量/反馈：QualityPolicyVersion、TTL、降级、FeedbackProfile F0—F3、EvidenceTarget R0—R6/RX、保留与脱敏；
- 期限/退出：validFrom/to、紧急联系人、退出义务、条件 Owner；
- 页面操作：上一步、下一步、保存草稿、运行预检、退出、放弃草稿；
- 六态：步骤骨架、无可选权益/能力/端点、依赖局部失败、整体不可用、无编辑权、保存冲突。

### 3. 交互规则

- 创建草稿后租户与环境不可在向导内切换；需切换时保存并退出当前草稿；
- 选择 ApplicationClient 后只展示属于该 OEM/环境且在权益范围内的对象；
- 地图选择器同步显示原范围、允许交集、越界和 UNKNOWN，接受收窄时创建新的草稿版本；
- S1 切换到非 Uu-A 通道时不进入可编辑表单，只显示目标 Release、责任边界和启用前置条件；后续切片启用后，通道切换仍须提示将被清除或失效的字段并要求确认；
- 每步通过前端格式校验与服务端业务预校验；依赖失败时保留草稿但禁止提交；
- 自动保存显示 saving/saved/failed 和版本号，失败时可重试或导出未保存草稿摘要。
- “退出”只是导航行为，不改变草稿状态；“放弃草稿”必须二次确认、填写 reasonCode，成功后进入 ABANDONED 且不可原位恢复。

### 4. 业务规则

- 仅接受 ACTIVE+ENABLED、CURRENT 且未过期的 EntitlementRevision；
- Coverage、用途、服务版本、车型、通道、期限和配额只能收窄上游允许范围；
- Uu-A 必填 OEM 端点/Topic/Profile；PC5 不得强制逐车端点或车辆标识；Uu-T 必填测试任务、伪名策略和短期限；Uu-B 未获 M0 批准时禁用；
- 待 U01/U02 签认的 S1 建议默认 matchingOwner 为 OEM 域；平台只保存并发布兴趣策略，不执行量产逐车匹配，最终值以签认决策为准；
- 用户不得降低服务硬性质量、安全、TTL 或撤销要求；
- 用户选择的证据目标不得高于通道、反馈能力和合规允许的可证明等级。

### 5. 验收结果

- 能完成一条 Uu-A 单服务、单 OEM 应用、单车型能力组、单区域的 S1 草稿；
- 权益失效、Coverage 越界、能力 STALE、端点失败等均定位到具体步骤和修复入口；
- S1 能完整验收 Uu-A 必填/禁止字段；PC5/Uu-T/Uu-B 显示正确禁用态、目标切片和启用前置条件，不计入 S1 功能完成度；
- 自动保存失败、无权限、依赖局部失败和并发冲突均不丢失已填写内容；
- 返回修改关键字段后，后续预检和摘要明确变为 STALE。

## 研发需求名称

【订阅申请】-【FR2-P03 契约摘要与提交确认】

## 描述

作为订阅申请人，  
在草稿完成并准备进入正式审批前，  
我希望同时核对人类可读契约、机器执行策略、风险差异和责任声明，  
以便提交的是双方理解一致且内容固定的申请修订版。

关联功能需求：FR2-FR-02、FR2-FR-05、FR2-FR-06。

### 1. 功能范围

- 展示人类可读契约摘要和机器执行策略摘要；
- 展示申请范围、允许交集、上次 Revision Diff、预检结果和未决项；
- 支持查看每项依据、证据、Owner 和退出义务；
- 支持提交声明、幂等提交和提交成功后的对象回执；
- 不在本页修改正式输入，返回修改需使旧摘要失效。

### 2. 页面内容

- 页头：Request ID、Draft Revision、EntitlementRevision、ApplicationClient、环境、内容哈希和摘要生成时间；
- 人类摘要：服务、用途、车型、Coverage、时段、通道、质量、反馈、期限、配额、责任与退出义务；
- 机器摘要：对象/版本引用、规范化 Scope Hash、ChannelProfile、约束和 reasonCode 词典版本；
- 差异区：新增、修改、删除、收窄、未知和上次正式 Revision；
- 预检区：runId、outcome、validity、五层统计、条件和阻断；
- 提交区：真实性声明、授权代理声明（如适用）、备注、幂等状态；
- 页面操作：返回修改、刷新摘要、导出预览、提交申请；
- 六态：摘要生成中、无可提交内容、局部证据不可用、生成失败、无提交权、摘要已过期/冲突。

### 3. 交互规则

- 用户展开任一摘要项时，可查看来源对象 ID/Revision、规则和证据；
- 当前预检非 CURRENT、存在硬阻断或摘要版本不匹配时，“提交申请”禁用并展示原因；
- 提交前二次确认 OEM、应用、环境、服务、Coverage、有效期和关键责任；
- 重复点击提交使用同一幂等键，处理中显示不可重复触发的任务状态；
- 提交成功展示 RequestRevision、内容哈希、审批入口和下一步，不仅显示 Toast。

### 4. 业务规则

- 人类摘要与机器摘要必须由同一规范化输入生成；
- 预检通过不替代审批，提交成功不生成 ACTIVE 订阅；
- 申请声明不得用来豁免授权、安全或合规硬门禁；
- 返回修改会生成新草稿版本并使原摘要/预检 STALE；
- 敏感证据按权限脱敏，导出预览须带用途、水印和审计。

### 5. 验收结果

- 同一草稿生成的两类摘要在服务、作用域、通道、期限和版本引用上一致；
- 预检 STALE、硬阻断或摘要哈希变化时无法提交；
- 重复提交仅产生一个正式 RequestRevision 和一组审批待办；
- 提交成功可复制/打开对象 ID、Revision、哈希及审批入口；
- 证据局部失败时明确标为不可核验，不生成“全部通过”假状态。

## 研发需求名称

【订阅预检】-【FR2-P04 准入五层预检工作台】

## 描述

作为申请人、订阅运营、审批、安全或测试人员，  
在需要判断订阅是否具备准入条件时，  
我希望通过五层预检工作台查看固定输入、执行进度和逐层结论，  
以便快速定位阻断、未知和需要补正的责任域。

关联功能需求：FR2-FR-05、FR2-FR-06、FR2-FR-07、FR2-FR-13。

### 1. 功能范围

- 创建和异步运行授权/权益、订阅契约、数据质量/服务资格、访问权限/凭证、连接/容量五层预检；
- 分开呈现运行状态、业务 outcome 和结果 validity；
- 展示逐层统计、规则结果、输入快照和历史 Run；
- 支持重新预检、取消允许取消的任务、导出摘要和创建补正；
- 不把运行预检与审批决定合成一个权限动作。

### 2. 页面内容

- 页头：Request/Revision、风险等级、PrecheckRun ID、inputSnapshot ID/Hash、ruleSetVersion、执行时间；
- 状态区：runStatus、outcome、validity、进度、开始/结束时间和失败原因；
- 五层矩阵：每层通过、条件、阻断、未知、过期数量和最后评估时间；
- 规则表：ruleId、layer、severity、expected、actual、outcome、evidence、Owner、nextAction、dueAt；
- 历史区：Run 对比、输入变化、结果差异和审批引用标识；
- 页面操作：运行/重新预检、取消、筛选责任域、导出摘要、创建补正；
- 六态：未运行、排队/运行中、部分规则失败、任务整体失败、无查看/执行权、输入已变化。

### 3. 交互规则

- 用户点击“运行预检”后立即获得 taskId/runId，并可离开页面后从工作台继续查看；
- 规则完成后局部刷新对应层，不闪烁整页；部分规则依赖失败显示 UNKNOWN，不推断 PASS；
- 点击规则进入 FR2-P05，携带 runId、ruleId、inputSnapshot 和返回上下文；
- 点击“重新预检”生成新 Run，旧 Run 仍可查看且标明曾被哪个审批引用；
- 取消只影响允许取消的执行任务，不修改申请或旧结果。

### 4. 业务规则

- runStatus 仅允许 QUEUED/RUNNING/COMPLETED/FAILED/CANCELLED/TIMED_OUT；
- outcome 仅允许 PASS/PASS_WITH_CONDITIONS/BLOCKED/INCONCLUSIVE；validity 独立为 CURRENT/STALE/EXPIRED/INVALIDATED；
- 关键规则 INCONCLUSIVE 或结果 STALE 时禁止正式审批通过和生产激活；
- 相同 inputHash＋ruleSetVersion 的重放结论必须一致；
- 预检通过仅证明准入检查结果，不等于审批、配置、测试、发布或运行成功。

### 5. 验收结果

- 五层规则均可定位到固定输入、证据版本、Owner 和下一动作；
- 执行失败、业务阻断和输入过期显示为三个不同维度；
- 重跑不覆盖历史，历史 Run 可比较且审批引用保持稳定；
- 部分依赖不可用时保留已成功结果并明确未知范围；
- 无执行权限、任务超时和输入冲突均有可恢复路径。

## 研发需求名称

【订阅预检】-【FR2-P05 规则结果与证据抽屉】

## 描述

作为订阅申请、运营、审批或审计人员，  
在某项预检出现通过、条件、阻断或无法核验结论时，  
我希望查看该规则的预期、事实、证据、适用范围、责任和历史，  
以便判断结论是否正确并采取可执行动作。

关联功能需求：FR2-FR-05、FR2-FR-13。

### 1. 功能范围

- 展示单项 Finding 的规则、输入、事实、证据和结论；
- 支持证据权限校验、脱敏预览、版本定位和有效期查看；
- 展示 Owner、下一动作、期限、可否自动修复和历史结果；
- 支持进入来源对象、创建补正任务和复制诊断引用；
- 不允许在抽屉中直接改写事实或人工改成 PASS。

### 2. 页面内容

- 基础：ruleId、规则名称、layer、severity、ruleSetVersion、Finding ID；
- 结论：outcome、validity、reasonCode、影响范围和评估时间；
- 比较：expected、actual、阈值/允许范围、差异和 unknown 字段；
- 证据：evidenceRef、对象 ID/Revision、hash、来源、核验状态、到期时间和访问级别；
- 处置：Owner、nextAction、dueAt、remediationType、SubscriptionRemediationCase、复检条件；
- 历史：同规则历次结果、输入版本变化和审批引用；
- 页面操作：查看来源、申请证据权限、创建补正、标记争议、复制引用；
- 六态：加载、无证据、部分证据不可用、详情失败、无证据权限、结果已 STALE。

### 3. 交互规则

- 从 P04 打开抽屉时保持预检筛选和滚动位置；关闭后返回原规则行；
- 点击证据先校验权限，敏感正文不可见时仍显示受控元数据与申请路径；
- 点击“查看来源”携带对象 ID/Revision、ruleId 和 returnContext；
- “标记争议”要求填写争议类型和说明，生成核查任务，不修改原 Finding；
- 证据加载局部失败时保留规则结论但标记证据不可核验，关键规则不得继续显示有效 PASS。

### 4. 业务规则

- expected 与 actual 必须分栏，不能只给自然语言总错误；
- Finding 一经 PrecheckRun 完成即只读，修复后通过新 Run 形成新结果；
- 无权查看证据正文不代表证据不存在，但也不得把未核验正文推定为有效；
- 人工争议不自动改变 outcome，需有权流程重新评估；
- 导出或复制敏感证据引用按用途和数据分类审计。

### 5. 验收结果

- 任一阻断规则可解释“期望什么、实际是什么、依据何在、谁处理、下一步是什么”；
- 证据失效或不可访问时显示正确有效性，不把空白当通过；
- 创建补正后返回 SubscriptionRemediationCase ID、Owner、期限和跟踪入口；
- 原 Finding 不能被页面直接编辑，重检结果形成新 Run；
- 无权限、证据局部失败和争议状态均不泄露超范围内容。

## 研发需求名称

【订阅预检】-【FR2-P06 补正任务创建与跟踪】

## 描述

作为订阅运营或有权审批人员，  
在预检或审批发现可修复的缺项时，  
我希望创建责任、期限、所需证据和复检条件明确的补正任务，  
以便问题由正确责任方闭环且不依赖线下口头沟通。

关联功能需求：FR2-FR-05、FR2-FR-06、FR2-FR-07、FR2-FR-13。

### 1. 功能范围

- 从 Finding、审批未决项或依赖变化创建补正任务；
- 关联 RequestRevision、PrecheckRun、规则和受影响范围；
- 指定 Owner、协作人、期限、所需证据、下一动作和复检条件；
- 跟踪处理、补证、验证、退回和关闭；
- 完成任务后支持发起新 PrecheckRun，不覆盖旧结果。

### 2. 页面内容

- 表单字段：sourceType/sourceId、ruleId、问题摘要、受影响范围、remediationType、Owner、协作人、dueAt、requiredEvidence、nextAction、优先级；
- 跟踪字段：SubscriptionRemediationCase ID、状态、处理记录、附件/证据引用、验证人、验证结果、关闭时间；
- 页面操作：保存、指派、提交处理、补充证据、退回、验证完成、取消、发起复检；
- 关联入口：返回规则结果、申请、来源对象和新预检；
- 六态：加载、无可补正项、附件局部失败、服务不可用、无指派/验证权、任务版本冲突。

### 3. 交互规则

- 从 Finding 创建时自动带入规则、事实、影响和建议动作，用户只补充责任和期限；
- Owner 变更时记录原因、原 Owner 和生效时间，并通知相关方；
- 处理人提交证据后进入 PENDING_VERIFY，由有权验证人确认，不自动关闭；
- 点击“发起复检”创建新 runId 并关联 SubscriptionRemediationCase，结果回写为验证依据；
- 附件失败时不丢失任务正文，可重试上传或引用已有受控证据。

### 4. 业务规则

- BLOCKED/INCONCLUSIVE 的关键项必须有 Owner 和下一动作后才能进入待处理；
- SubscriptionRemediationCase 状态与 Precheck outcome、Request status 分离；运行/交付异常使用 FR-5 RuntimeWorkItem，不在本页改写；
- 处理人和验证人按风险实施职责分离；
- 完成任务不自动把原 Finding 改为 PASS，必须通过新预检验证；
- 取消任务需说明原因，不得取消由硬门禁产生且仍被业务引用的处置义务。

### 5. 验收结果

- 能从一项阻断创建完整补正任务并追溯到原规则与申请 Revision；
- Owner、期限、证据和复检条件缺失时不可正式指派；
- 补正完成后可触发新预检，旧结果和处理记录保持可查；
- 无验证权、附件失败、超期和并发修改均显示明确处置路径；
- 只有复检或有权例外验证通过后任务才能完成，不能以“已上传”自动关闭。

## 研发需求名称

【订阅审批】-【FR2-P07 审批队列与审批工作台】

## 描述

作为订阅审批、合规、安全或联合验证人员，  
在需要处理本人待办或会签事项时，  
我希望查看固定申请快照、风险、预检、差异和审批链，  
以便在职责范围内作出可追责决定。

关联功能需求：FR2-FR-05、FR2-FR-06、FR2-FR-07。

### 1. 功能范围

- 提供我的待办、已办、委托、超时和需会签队列；
- 展示申请固定输入、双摘要、五层预检、风险、DVP&R/测试要求和历史差异；
- 展示审批节点、顺序/并行关系、职责冲突和 SLA；
- 支持进入决定、退回、拒绝、升级会签和改派（按权限）；
- 与 P04 共享只读预检组件，但不共享执行与审批权限。

### 2. 页面内容

- 查询条件：ApprovalCase ID、Request ID、OEM、应用、服务、风险、节点、状态、到期、委托、是否冲突；
- 队列表格：对象、Revision、申请人、当前节点、风险、预检摘要、条件数、到期时间、超时状态；
- 工作台左侧：申请摘要、差异、作用域、责任声明；
- 中部：五层结果、未决项、测试/回滚要求和历史决定；
- 右侧：审批链、当前 assignee、会签人、SoD、SLA、Owner 和下一动作；
- 页面操作：打开决定、退回补充、拒绝、升级会签、合法改派、查看审计；
- 六态：加载、无待办、证据/预检局部失败、审批服务失败、无审批权、申请输入 STALE/冲突。

### 3. 交互规则

- 用户进入待办时固定展示审批引用的 RequestRevision 和 PrecheckRun，不自动切换到最新未审版本；
- 若关键依赖变化使输入 STALE，决定操作禁用，仅允许退回重检或按规则终止当前 Case；
- 点击“升级会签”选择触发原因、角色、期限和材料范围，不能任意降低原会签链；
- 委托/改派必须展示授权来源、生效期限和审计影响；
- 决定成功后返回 Decision ID、状态和后续激活条件入口。

### 4. 业务规则

- 申请人、编辑人和最终审批人的 SoD 冲突按矩阵阻断；
- 技术管理员和城市运营不因系统角色自动拥有业务审批权；
- 审批人不能修改申请字段，只能决定、退回或追加结构化条件；
- 材料不足使用退回补充，不能用普通意见或口头方式通过；
- 批准不等于 ACTIVE、发布成功或车辆使用。

### 5. 验收结果

- 审批人能看到与决定相关的固定申请、证据、风险、差异和完整审批链；
- 输入 STALE、证据局部失败或 SoD 冲突时无法批准并有明确处理入口；
- OEM A 的审批人无法查看 OEM B 的敏感申请；
- 委托、升级、超时和改派均有期限、原因与审计；
- 审批结果不在页面上被误显示为已部署或已运行。

## 研发需求名称

【订阅审批】-【FR2-P08 审批决定与条件编辑器】

## 描述

作为当前审批节点的有权人员，  
在申请材料和预检结果可用于决定时，  
我希望作出批准、附条件批准、退回或拒绝决定并结构化记录条件，  
以便结论可执行、可跟踪且不会扩大权益。

关联功能需求：FR2-FR-07、FR2-FR-08。

### 1. 功能范围

- 支持批准、附条件批准、退回补充和拒绝；
- 支持编辑激活前提、持续义务和范围限制三类条件；
- 校验决定权限、SoD、当前输入有效性和不可豁免门禁；
- 固定 reasonCode、决定说明、条件 Owner/期限/证据/违反动作；
- 按决定类型展示后继结果：批准/条件批准返回 Decision＋SubscriptionRevision，退回返回 Decision＋后继草稿路径，拒绝只返回 Decision。

### 2. 页面内容

- 只读摘要：ApprovalCase、RequestRevision、PrecheckRun、风险、硬阻断、申请范围、权益上限；
- 决定字段：decision、reasonCode、comment、effectiveAt；
- 条件字段：sourceFindingId、sourceCandidateId、candidateDisposition、conditionType、scope、description、Owner、dueAt、evidenceRule、breachAction、是否阻断激活；
- 退回字段：需补充内容、责任方、期限、允许重提范围；
- 拒绝字段：拒绝依据、是否允许重新申请和建议路径；
- 操作：取消、保存决定草稿（如允许）、确认决定；
- 六态：加载、无可决定 Case、证据部分不可用、提交失败、无决定权/SoD、输入已 STALE。

### 3. 交互规则

- 打开编辑器后再次校验 Case、输入有效性、当前 assignee 和权限；
- 选择附条件批准时动态显示条件编辑器，缺任一必填项不能确认；
- 条件涉及权利对象、用途、区域、服务版本范围或期限变化时阻断，并引导回 FR-1 新建权益 Revision；
- 确认决定前展示对象、Revision、决定、条件、责任人和后果二次确认；
- 重复提交使用同一幂等键，成功后编辑器只读并展示 Decision ID；仅批准/条件批准展示 SubscriptionRevision，退回展示后继草稿入口，拒绝明确不创建订阅 Revision。

### 4. 业务规则

- 不可豁免授权、安全或合规硬阻断存在时不能批准或条件批准；
- 条件批准只增加运行限制、激活前提或持续义务，不得扩大权益；
- 每个 PrecheckConditionCandidate 必须记录 ACCEPTED、REJECTED 或 TRANSFORMED；只有审批显式采纳/转换后才生成 ExecutionCondition，硬条件不得丢失；
- `comment` 不能替代 reasonCode 或结构化条件；
- 退回生成后继草稿路径，原正式 Revision 不可编辑；
- 决定保存审计、输入哈希、审批矩阵版本和签认身份。

### 5. 验收结果

- 四种决定均生成唯一 Decision ID、稳定 reasonCode 和完整审计，且只为批准/条件批准创建 SubscriptionRevision；
- 条件缺 Owner、期限、证据或违反动作时无法提交；
- 试图扩大权益或豁免硬门禁时被阻断并指向正确流程；
- 自审、越租户、输入 STALE 和重复提交均不会产生错误决定；
- 批准后只形成准入结论或待激活订阅，不显示为 ACTIVE。

## 研发需求名称

【订阅运营】-【FR2-P09 订阅实例列表】

## 描述

作为 OEM 接入、订阅运营、配置发布、运行保障或审计人员，  
在需要查看当前订阅关系、临期事项和运行异常时，  
我希望通过实例列表分别识别生命周期、控制、激活、发布、健康和证据状态，  
以便快速进入正确处置流程而不被一个总状态误导。

关联功能需求：FR2-FR-08、FR2-FR-09、FR2-FR-10、FR2-FR-11。

### 1. 功能范围

- 默认一行展示一个 SubscriptionInstance，并按 ServiceSubscription 分组；订阅级动作放组头，实例级动作放行内；
- 展示当前 Revision、前序/后继关系、状态分栏和关键依赖；
- 支持进入详情、临期续期、变更、迁移、暂停/终止影响和诊断；
- 展示部分发布、未知、漂移、条件临期和未收口事项；
- 不在列表页直接显示或执行“全部成功”式高风险快捷动作。

### 2. 页面内容

- 查询条件：Subscription ID、Instance ID、approved/target/effective Revision、OEM、ApplicationClient、环境、服务、车型能力组、Coverage、通道、lifecycleStatus、controlStatus、activationReadiness、releaseStatus、runtimeHealth、evidenceGrade、有效期；
- 分组字段：Subscription ID、currentApprovedRevisionId、targetRevisionId、currentEffectiveRevisionId（仅已收敛时）、是否 `MIXED_REVISION_VIEW`、OEM/应用、服务和订阅级 Owner；
- 实例行字段：instanceId、effectiveRevisionId、environment、atomicScopeHash、车型/Coverage、region/channel、targetCount、生命周期、控制、激活资格、发布、健康、证据、有效期、Owner、更新时间；
- 风险标识：权益/证书/条件临期、配置 STALE、部分发布、UNKNOWN、未关闭 SubscriptionRemediationCase 或 FR-5 RuntimeIncident/RuntimeWorkItem；
- 订阅组头操作：续期/变更/迁移、查看 Revision 链；页面操作：查询、重置、保存视图、导出；
- 实例行内操作：查看详情、查看影响、进入诊断、建运行工单、按权限进入暂停/终止影响；
- 六态：骨架屏、无订阅、局部状态源失败、列表失败、无权限、版本/筛选上下文冲突。

### 3. 交互规则

- 多状态列可单独筛选，不能用“正常/异常”折叠所有维度；
- 点击任一风险标识进入对应页签或外部事实页，并携带 SubscriptionRevision 和 returnContext；
- 当某状态源暂不可用时显示最近成功值、数据时间和 UNKNOWN，不将其视为正常；
- 订阅组头的续期/变更入口先选择业务类型并进入 FR2-P12，不在实例行内直接提交；实例行只提供详情、影响、诊断和有权控制入口；
- 导出遵守当前筛选、权限和字段脱敏，并显示生成时间与数据范围。

### 4. 业务规则

- 列表状态来自各自唯一事实源；前端不得通过其他状态推导；
- `MIXED_REVISION_VIEW` 只是组级展示标签，不是业务状态；混跑时必须逐行显示实际 effectiveRevisionId 和剩余作用域；
- 部分发布按实例/目标作用域展示，不新增含糊 `PARTIALLY_ACTIVE` 生命周期；
- 证据等级只表示实际可证明层级，不代表服务健康或业务效果；
- 跨租户对象不可检索、导出或通过总数泄露；
- 默认排序优先显示硬阻断、临期、部分失败和 UNKNOWN，再按更新时间排序。

### 5. 验收结果

- 用户能按每个状态族独立筛选并定位一条异常原子实例，同时看见所属订阅组；
- 部分切换时能同时看见旧/新 effectiveRevisionId，且不会提前显示单一全局有效 Revision；
- 发布未知、运行健康未知和证据不可核验不会显示为绿色正常；
- 单一状态源失败时保留其他列并明确数据时间与重试入口；
- 从列表进入详情、变更和诊断后返回可恢复原筛选与分页；
- 无权限、空态和导出脱敏均符合租户及数据范围规则。

## 研发需求名称

【订阅运营】-【FR2-P10 订阅单一事实详情】

## 描述

作为订阅相关协作人员，  
在需要确认某个订阅当前到底完成到哪一步时，  
我希望在同一事实详情中查看契约、依赖、配置、测试、发布、运行和证据，  
以便围绕同一 Revision 作出后续动作且不复制状态。

关联功能需求：FR2-FR-08、FR2-FR-09、FR2-FR-10、FR2-FR-11、FR2-FR-12、FR2-FR-13。

### 1. 功能范围

- 提供订阅概览及权益、服务/车型、Coverage、通道、运行兴趣、有效配置、测试、发布、运行、变更、审计页签；
- 分栏展示申请、预检、审批、生命周期、控制、激活资格、发布、健康和证据；
- 展示当前 Revision、Owner、条件、下一里程碑、依赖和完整时间线；
- 支持 ExecutionCondition Owner 提交履行证据、独立核验、违反确认和受控豁免，各动作按独立权限与 SoD 执行；
- 支持发起变更/续期/迁移、暂停/终止影响、运行诊断和工单；
- 外部动作通过深链进入 FR-3/FR-4/FR-5 页面，不在本页伪造结果。

### 2. 页面内容

- 页头：Subscription ID、currentApprovedRevisionId、targetRevisionId、currentEffectiveRevisionId（仅已收敛时）、所选 instanceId/effectiveRevisionId、混跑标签、内容哈希、OEM/应用/环境、服务、有效期、业务 Owner、运行 Owner；
- 状态条：requestStatus、precheck outcome/validity、approval decision、lifecycleStatus、controlStatus、activationReadiness、releaseStatus、runtimeHealth、evidenceGrade；
- 概览：人类契约摘要、机器策略摘要、条件、里程碑、阻断和风险；条件页签展示 conditionId、type、scope、Owner、dueAt、status、evidenceRule、breachAction、证据历史、豁免决定与核验人；
- 依赖：EntitlementRevision、Offering/ServiceVersion、Capability/Compatibility、空间、端点/证书；
- 下游：EffectiveConfigSnapshot、QualificationRun、ReleaseOrder/节点、最后事件、最高证据和未关闭工单；
- 运行兴趣：interestMode、matchingOwner、ChannelProfile、外部匹配结果引用或 Uu-T 会话；S1 只读展示 Uu-A/OEM 域责任，S3/P1 再启用会话操作；
- 页面操作：变更、续期、迁移、暂停、终止、进入诊断、建工单、导出审计证据；条件页签依权限提供“提交证据/核验通过/确认违反/豁免”动作；
- 六态：页头骨架、无下游事实、单页签部分失败、详情整体失败、无页面/证据权限、Revision 已替代/冲突。

### 3. 交互规则

- 页签切换保持同一 subscriptionId 及明确的 approved/target/effective Revision 语境；查看历史版本或实例实际版本时页头持续标识其角色；
- 点击外部对象时携带对象 ID/Revision、目标页签、reasonCode 和 returnUrl；
- 单个页签加载失败不清空页头及其他成功内容，展示最近成功时间；
- 高风险动作先进入 P12/P13 独立流程，不在详情页即时改变状态；
- 条件履行动作使用独立抽屉/弹窗固定 conditionId、evidenceRef/hash、处理人和当前 ETag；核验、违反确认与豁免不能共用一个模糊的“完成”操作；
- 导出前选择用途、范围和脱敏模板，成功后展示 EvidencePackage ID。

### 4. 业务规则

- `APPROVED ≠ READY ≠ ACTIVE ≠ release SUCCEEDED ≠ HEALTHY ≠ evidence Rn`；
- 所有页签引用页头声明的 Revision 语境，禁止各自维护“当前状态”；混跑时必须按实例展示 effectiveRevisionId；
- Uu-A/PC5 外部 matchingOwner 的执行结果只作为引用或受控投影展示，FR-2 页面不得声称平台完成 OEM/车辆匹配；
- 权益失效、配置 STALE、部分发布、运行 UNKNOWN 或证据不足不得被总体健康掩盖；
- 回滚按钮仅发起/跳转 FR-4，不直接修改订阅或发布事实；
- 历史 Revision 只读，敏感内容按 ABAC 脱敏。
- 条件证据提交人不得核验本人结果；硬条件不可豁免；豁免必须有范围、期限、双人签认和后续复核；违反确认不删除既有满足历史。

### 5. 验收结果

- 用户能从详情说明该订阅的权利依据、契约 Revision、配置、发布、健康和最高证据；
- 用户能在混跑时说明最新获批、目标及各实例实际 Revision，并能查看 Uu-A 运行兴趣责任；
- 每个状态的来源、更新时间和深链可追溯，页面之间无状态冲突；
- 页签局部失败、无证据权限、历史版本和外部依赖 UNKNOWN 均有明确表现；
- 变更、暂停、回滚等动作不会在前端直接生成成功状态；
- 导出、深链和审计均保留当前对象、Revision 和来源上下文。
- 条件履行、违反和豁免都能追溯至固定证据、独立权限与操作人，无权人不能从页面或 API 变更条件状态。

## 研发需求名称

【订阅版本】-【FR2-P11 Revision 历史与差异】

## 描述

作为订阅运营、OEM 接入、审批或审计人员，  
在订阅经历申请、退回、续期、变更、迁移或替代后，  
我希望比较任意两个 Revision 的结构化差异和执行关系，  
以便准确判断改变了什么、影响谁、为何替代以及能否回退。

关联功能需求：FR2-FR-02、FR2-FR-06、FR2-FR-09、FR2-FR-10。

### 1. 功能范围

- 展示 RequestRevision 和 SubscriptionRevision 的完整版本链；
- 支持选择两个版本比较字段、作用域、空间、通道、质量、反馈、条件和依赖；
- 展示 base/supersedes/renewalOf/migrationFrom、批准、切换和回退关系；
- 关联每个 Revision 的预检、审批、配置、测试、发布和证据；
- 支持导出差异摘要，不允许编辑历史版本。
- Release 边界：S1 只验收申请/基础 Revision 对比；完整迁移影响、切换和回退关系在 S2 验收。

### 2. 页面内容

- 版本列表：Revision、类型、创建人/批准人/时间、内容哈希、validFrom/validTo、base/supersedes/renewalOf/migrationFrom、是否 currentApproved/target，以及执行该版本的实例数；不为 SubscriptionRevision 虚构通用生命周期状态；
- 比较选择：baseRevision、targetRevision、比较时间点；
- Diff 分组：主体/用途、服务版本、车型、Coverage、时段、通道/端点、质量/反馈、期限/配额、条件/退出；
- 影响摘要：新增、减少、未知、需重审、需重测、需切换和未迁移对象；
- 证据引用：PrecheckRun、Decision、ConfigSnapshot、Qualification、Release、EvidencePackage；
- 页面操作：选择比较、交换版本、仅看变化、导出 Diff、进入影响分析；
- 六态：加载、仅一个版本/无可比对象、部分证据失败、比较服务失败、无敏感字段权限、比较基准已变化。

### 3. 交互规则

- 默认比较当前 Revision 与直接前序版本，允许用户选择任意有权版本；
- 地图/空间差异使用新增、移除、重叠、UNKNOWN 图层并提供可访问列表；
- 点击差异项定位来源字段、规则、审批条件和受影响对象；
- 无敏感权限时遮蔽实际值但保留“发生受控变化”的审计语义；
- 导出时固定两个 Revision、Diff Hash、生成时间和权限水印。

### 4. 业务规则

- Diff 基于不可变 Revision 计算，不比较页面草稿缓存；
- 同义规范化输入不得产生虚假差异；
- 删除或收窄用不同语义展示，UNKNOWN 不归入无变化；
- 历史版本及其证据不可被当前版本覆盖；
- 回退只能选择仍满足当前权利和兼容条件的有权目标，并由 FR-4 执行。

### 5. 验收结果

- 任意两个有权 Revision 可生成稳定、可导出的结构化 Diff；
- Coverage、通道和条件变化可定位到具体范围和影响；
- 历史证据局部不可用时明确 UNKNOWN，不影响已固定差异正文；
- 无敏感权限时不泄露内容但仍可理解变化类别；
- Diff 导出可验证版本、哈希和生成权限，不被后续变化改写。

## 研发需求名称

【订阅变更】-【FR2-P12 变更、续期与迁移向导】

## 描述

作为 OEM/TSP 申请人与订阅运营负责人，  
在生产订阅需要调整、延续或迁移时，  
我希望基于当前 Revision 创建候选并完成差异、影响、复检和切换准备，  
以便变化可审批、可测试、可回退且不覆盖历史。

关联功能需求：FR2-FR-03、FR2-FR-04、FR2-FR-05、FR2-FR-10。

### 1. 功能范围

- 支持变更、续期、服务版本迁移、空间版本迁移和通道迁移；
- 基于当前 Revision 复制允许继承内容并明确需重新确认项；
- 展示结构化 Diff、SubscriptionImpactSnapshot、重新审批/测试、兼容窗口和回退目标；
- 支持保存候选、预检、提交和撤回；
- 切换执行通过 FR-4，向导只完成契约与计划准备。
- 本页 Release=S2，不进入 S1 DoD；S1 仅可展示受控的“后续版本”入口或禁用态说明。

### 2. 页面内容

- 基础：changeType、baseRevision、targetRevision、原因、目标生效时间、Owner；
- 变化内容：服务/车型/Coverage/时段/通道/质量/反馈/期限/配额/条件；
- Diff/影响：变更字段、Scope Diff、已知/未知对象、风险等级、重新审批/测试要求；
- 切换：兼容窗口、cutoverScope、前置条件、回退目标、观察要求；
- 续期专项：权益、协议、服务、能力、证书、风险和未关闭事项复核；
- 页面操作：保存候选、运行预检、比较、查看影响、提交、撤回；
- 六态：加载、无可变更订阅、影响/证据部分失败、向导失败、无变更权、基准 Revision 已变化。

### 3. 交互规则

- 进入向导时锁定 baseRevision；若当前 Revision 变化，提示重新基线或保留为独立候选；
- 选择 changeType 后只开放允许字段并自动标出必须重新确认项；
- 任何语义变化即时刷新 Diff，影响计算异步执行并显示 taskId/进度；
- 不可豁免关键 UNKNOWN、无回退目标或硬门禁存在时提交禁用；可受理 UNKNOWN 仅可携带有权例外引用进入审批，在消除或取得有效例外前禁止切换和旧 Revision 收口；
- 提交成功返回 Change/Request Revision 和后续审批入口，不直接切换生产。

### 4. 业务规则

- 生产语义变化必须新建 Revision；非语义说明变更仍需审计；
- 续期不是延长日期，必须重检所有关键依据和未关闭风险；
- 新 Revision 未验证并切换前，旧 Revision 按批准兼容窗口运行；
- 未迁移对象、UNKNOWN 或无有权例外时不能收口旧 Revision；
- 例外决定必须限定 UNKNOWN 的作用域、期限、责任人和补证动作，不得覆盖不可豁免授权、安全或合规门禁；
- 切换/回退事实来源于 FR-4，页面不得模拟完成。

### 5. 验收结果

- 能从当前 Revision 创建变更、续期或迁移候选并得到完整 Diff；
- baseRevision 变化、影响计算失败和 UNKNOWN 均不会被静默忽略；
- 续期在权益/证书失效或风险未关闭时被阻断；
- 无回退目标或无测试要求的高风险变化不能提交；
- 提交后只形成正式变更输入，生产切换状态保持真实。

## 研发需求名称

【订阅退出】-【FR2-P13 暂停与终止影响确认】

## 描述

作为订阅运营、合规或运行保障负责人，  
在需要暂停、恢复、撤销影响处置或终止订阅时，  
我希望先确认原因、作用域、未知依赖、执行计划和恢复/退出条件，  
以便用最小范围止损并准确跟踪实际执行结果。

关联功能需求：FR2-FR-11、FR2-FR-13。

### 1. 功能范围

- 支持普通业务暂停、恢复、权益撤销影响处置、到期收口和计划终止；
- 展示已知/未知影响、节点/端点/凭证/会话/运行关系和退出清单；
- 支持选择最小作用域、生效时点、恢复条件和控制优先级；
- 按权限发起控制请求并跟踪各作用域回执、补偿和工单；
- 管理 ExitChecklist 逐资源动作，并由独立核验人对 PENDING_VERIFY 退出清单完成或退回；
- 不把请求 ACK 显示为已停发或已终止。

### 2. 页面内容

- 对象：Subscription/Revision/Instance、当前 lifecycle/control、服务、OEM、区域、通道；
- 动作字段：actionType、reasonCode、triggerSource、scope、effectiveAt、说明、operationEpoch；
- 影响：ImpactSnapshot status/validity、basisRevision/hash、已知目标、UNKNOWN、正在发布/会话、端点/Topic/证书/凭证的 EXCLUSIVE/SHARED 绑定、activeReferenceCount、预计中断和责任人；
- 恢复/退出：恢复前提、测试、批准人、回退/最后良好配置、ExitChecklist；
- 执行：ControlRequest、逐作用域状态、FR-4 Receipt、失败/未知、补偿和 SubscriptionRemediationCase；运行异常只引用 FR-5 RuntimeWorkItem；
- 页面操作：重新计算影响、保存草稿、提交审批/执行、取消未执行请求、更新退出项、提交独立核验、验证完成/退回、创建订阅处置或 FR-5 运行工单、申请恢复；
- 六态：加载、无受影响对象、回执部分失败、影响/控制服务失败、无高风险权限/SoD、影响快照已过期。

### 3. 交互规则

- 高风险动作分“影响预览→审批/确认→执行→回执→收口”五步显示；
- 普通停服事前按矩阵审批；预授权 Break-glass 仅允许固定最小作用域并强制事后复核；
- 提交后立即展示 ControlRequest ID 和“执行待核验”，逐作用域刷新回执；
- 失败/不可达/UNKNOWN 自动或手动创建 SubscriptionRemediationCase，保持事件开放；属于运行/交付异常时创建或引用 FR-5 RuntimeWorkItem；
- 恢复入口仅在新依据、根因关闭、恢复测试和有权复核均满足时可用。
- ImpactSnapshot validity≠CURRENT 时必须重算；status=HAS_UNKNOWN 时默认阻断，仅预授权 Break-glass 或有效例外可在限定范围内继续，不可用于共享资源的全局撤销。
- ExitChecklist 处理人不得核验本人结果；核验失败必须返回 IN_PROGRESS 并保留已提交证据。

### 4. 业务规则

- 暂停、运行抑制、到期、撤销、终止和 SUPERSEDED 的原因及恢复性不同，不能共用一个状态；
- 撤销、到期和终止优先于迟到批准/激活/恢复事件；
- 旧 Revision 的控制回执按 targetRevision＋operationEpoch 隔离，不能影响新 Revision；
- 共享端点、Topic、证书或凭证默认 `UNBIND` 当前订阅，不得在仍有其他有效引用时全局 `REVOKE`；全局撤销必须具备 impactApproval；
- 收口要求必要作用域完成或取得有权例外，不能以请求发送成功替代；
- 执行人与恢复批准人按风险实施职责分离。

### 5. 验收结果

- 用户可在执行前看到精确作用域、已知/未知影响和恢复/退出条件；
- 执行中、部分成功、失败、未知和最终完成分别可见；
- 迟到旧回执不会暂停或复活错误 Revision；
- 未收口对象自动形成责任和期限明确的处置项；
- 只有恢复/退出门禁全部满足时才能形成最终结果和固定证据。
- 退出清单只有经独立核验才能进入 COMPLETED；处理人自审、证据缺失、共享资源不安全撤销或 ImpactSnapshot 失效均被阻断。

## 研发需求名称

【订阅诊断】-【FR2-P14 运行无数据五层诊断】

## 描述

作为 OEM 接入、订阅运营或运行保障人员，  
在一个获批订阅没有收到预期数据时，  
我希望按权益、订阅、有效配置、运行资格和投递证据逐层查看当前事实，  
以便定位最高可证明结论，而不是猜测车辆已经收到或服务已经失败。

关联功能需求：FR2-FR-09、FR2-FR-13。

### 1. 功能范围

- 在 PG12 内提供 S1 五层只读诊断摘要；
- 按目标时间、区域、通道和事件筛选当前事实；
- 区分无事件命中、权益/契约阻断、配置缺失、资格抑制和投递不可核验；
- 展示 reasonCode、事实来源、版本、Owner、下一动作和证据层级；
- 支持进入来源页、创建工单和在 P1 启用后进入完整 PG25 调试器。

### 2. 页面内容

- 输入：Subscription/Revision、时间范围、区域/Coverage、通道、可选 eventId/traceId；
- 五层：Entitlement、Subscription、EffectiveConfig、RuntimeEligibility、DeliveryEvidence；
- 每层字段：status/result、validity、object/Revision、reasonCode、lastEvaluatedAt、evidenceGrade、Owner、nextAction；
- 结果摘要：最高可证明层级、首个阻断层、UNKNOWN 层和推荐动作；
- 页面操作：刷新诊断、查看来源、复制诊断引用、建工单、进入完整调试器（P1 可用时）；
- 六态：加载、有效“无事件命中”、部分层不可用、诊断整体失败、无证据权限、输入 Revision/时间冲突。

### 3. 交互规则

- 默认使用当前 SubscriptionRevision 和最近业务时间窗，用户修改范围后明确显示诊断输入；
- 每层按顺序展示但不因前层通过而推断后层，UNKNOWN 独立突出；
- 点击层级进入相应页面并保留诊断上下文和 returnUrl；
- “无事件命中”作为有效事实展示，不自动判定连接或车辆故障；
- PG25 未启用时不显示死链，而显示 S1 能力边界和可执行工单入口。

### 4. 业务规则

- 运行五层诊断与 P04 准入五层预检是不同模型，不共用 outcome 或输入快照；
- 网关 ACK 只能证明相应证据等级，不能推断车辆验证、HMI 展示或算法消费；
- 数据源不可用、无权限或超出保留期显示 UNVERIFIABLE，不用零值代替；
- 诊断只读，不直接改变订阅、发布或运行状态；
- 创建运行工单必须调用 FR-5 RuntimeWorkItem 权威接口，并带入诊断输入、首个阻断层和证据引用；FR-2 只保存 workItemRef。

### 5. 验收结果

- 对一条无数据 S1 订阅能逐层展示事实、版本和最高证据结论；
- 无事件命中、质量抑制、端点失败和证据不可核验能被区分；
- 任一层局部失败不清空其他层，UNKNOWN 不被显示为正常；
- 创建工单后返回 FR-5 RuntimeWorkItem ID 并可从工单回到同一诊断输入；
- 未启用 PG25 时 S1 页面仍能完成最小诊断闭环。

## 研发需求名称

【我的工作台】-【FR2-P15 订阅待办与风险组件】

## 描述

作为订阅申请、审批、运营、测试或运行保障人员，  
在每天处理服务订阅事项时，  
我希望集中看到与本人职责相关的补正、审批、临期、依赖变化和无数据风险，  
以便按优先级直接进入正确对象并完成闭环。

关联功能需求：FR2-FR-05、FR2-FR-07、FR2-FR-09、FR2-FR-10、FR2-FR-11、FR2-FR-13。

### 1. 功能范围

- 聚合本人补正、审批、条件、续期、迁移、退出、运行诊断和工单待办；
- 展示风险、到期、SLA、影响范围、Owner 和下一动作；
- 支持按角色、租户、环境、服务和事项类型筛选；
- 提供深链进入 P01/P04/P06/P07/P10/P12/P13/P14；
- 支持待办已读、关注，以及仅对 FR-2 SubscriptionRemediationCase 的合法转交；FR-5 运行任务必须回源系统转交，不直接在卡片完成高风险动作。

### 2. 页面内容

- 卡片：我的待补正、待审批、条件临期、订阅临期、依赖 STALE、停发待核验、无数据/证据风险；
- 列表字段：taskType、priority、objectId/revision、OEM/应用、服务、环境、risk/reasonCode、dueAt、Owner、更新时间；
- 统计：总数、超时数、UNKNOWN 数、今日新增和最近数据时间；
- 页面操作：筛选、刷新、保存视图、标记已读、关注、转交 FR-2 处置（按 `FR2.TASK.REASSIGN`）；FR-5 任务只显示“进入来源系统转交”；
- 行内操作：查看/处理、进入来源、查看影响、建工单；
- 六态：骨架、无待办、单卡片部分失败、整体服务失败、无工作台权限、任务已被他人处理/冲突。

### 3. 交互规则

- 点击事项携带 taskId、objectId、revisionId、tenant、environment 和 returnContext 进入目标页；
- 返回工作台后恢复筛选、滚动位置和展开状态；
- 单一数据源失败只影响对应卡片，显示最近成功时间和重试入口；
- 转交 FR-2 SubscriptionRemediationCase 时要求选择接收人、原因和期限，并通过 FR-2 权威接口校验接收人权限；FR-5 RuntimeWorkItem 只深链回 FR-5 执行转交，P15 不写其 Owner；
- 当任务已被他人处理时显示最新状态和处理人，不允许基于旧版本重复完成。

### 4. 业务规则

- 工作台只聚合，不复制各业务对象状态或生成新事实；
- FR-2 SubscriptionRemediationCase 与 FR-5 RuntimeIncident/RuntimeWorkItem 分栏标识 Owner 和权威来源，工作台只保存联合投影与深链；
- `FR2.TASK.REASSIGN` 仅适用于 FR-2 对象；外部任务的分派、状态和完成均由其来源系统负责；
- UNKNOWN 和 UNVERIFIABLE 单独计数，不归入正常或完成；
- 高风险批准、暂停、恢复和终止必须进入专用页面完成；
- 用户只能查看本人或权限范围内事项，统计不得泄露其他租户数量；
- 事项只有源对象达到完成条件才从待办移出，已读不等于完成。

### 5. 验收结果

- 不同角色看到与其责任、租户、环境和数据范围一致的待办；
- 任一事项可深链到正确对象和 Revision，返回后上下文完整；
- 单一卡片失败不会造成全页空白，统计展示数据时间和 UNKNOWN；
- 任务被并发处理、合法转交和超时升级均有可见结果；
- 卡片不提供绕过审批或影响预览的高风险快捷成功操作。

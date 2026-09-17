# MVP 前产品与研发文档索引

本目录把散落在工作区的车路云数据上车产品材料归并为一条可追溯主线。文档原始版本保留在文件名中，评审稿不覆盖、不改写；工程当前实现以仓库代码、契约和测试为准。

## 阅读顺序

1. 先读 `pre-mvp/00-overall-plan`，确认目标、范围、行业场景和平台总体规划。
2. 再读 `pre-mvp/01-requirements`，按 FR-1～FR-6 查看用户故事、功能需求、常规研发需求和产品研发需求清单。
3. 接着读 `pre-mvp/02-product-spec`，确认平台端产品说明、角色、流程、页面和数据对象的收敛过程。
4. 读 `pre-mvp/03-engineering-readiness`，确认开发前终审、差异补强和最小解阻项。
5. 最后读 `mvp-entry`，确认 MVP 核心范围和进入开发的收敛版本。

## 文档分组

### 00 · 总体规划

- V0.1：平台端整体规划设计方案
- V0.2：对比评估与功能深化方案
- V0.3：功能合理性审查与深化建议
- V1.0：济南车路云数据上车总体方案（含 Markdown 与评审版 Word）

### 01 · FR 需求规格

- `fr1/`：FR-1 服务目录、产品能力与数据授权，包含 V0.4 详细规格和 V0.5 四层需求规格。
- `fr2/`：FR-2 订阅申请、准入、审批、订阅运营，包含 V0.8 四层需求规格。
- `fr3-fr6/`：FR-3 配置、FR-4 测试发布、FR-5 运行证据、FR-6 租户与接入四层评审稿。

### 02 · 产品说明书

保留 V0.6 评审稿、V0.10 整合修订稿、V0.10-R2 开发前终审稿和 V0.10-R3 功能完备性终审稿，用于追踪从结构设计到开发前收敛的变化。

### 03 · 研发就绪

- V0.7：研发启动就绪度审查与最小解阻清单
- V0.10-R1：需求差异补强

### MVP 入口

- 核心功能 MVP 需求规格 V0.1：四层开发稿
- 产品说明书 V0.11：MVP 核心收敛稿

### 附录

保留平台端功能规划与架构核验、变更影响面矩阵和开发执行摘要，作为历史决策与实现核验依据，不作为当前功能事实来源。

## 代码与文档追溯

| 产品层 | 主线代码 | 主线契约 / 验证 |
|---|---|---|
| 服务目录、权益、订阅申请 | `apps/web/src/features/catalog`、`entitlements`、`subscriptions` | `packages/contracts/src/subscription.ts`、`apps/web/src/mocks/subscription-repository.test.ts` |
| 配置、联合测试、服务发布 | `apps/web/src/features/configuration`、`qualification`、`release` | `packages/contracts/src/platform.ts`、对应 Repository 测试 |
| 证据、事件与诊断 | `apps/web/src/features/evidence`、`incidents`、`diagnosis` | `DeliveryEvidence`、`Incident` 相关契约与测试 |
| 角色、授权、租户、端点凭证 | `apps/web/src/features/governance` | 权限、数据范围、租户/环境隔离和幂等测试 |
| 数据上车规则与服务参考实现 | `services/v2x-platform/v2xplat` | `services/v2x-platform/tests` |

## 纳入与排除规则

- 纳入：与 DCM 数据上车平台产品、平台端控制面、订阅/配置/接入服务直接相关的 Markdown、架构 ADR、共享契约、前端代码、参考服务和测试。
- 排除：移动端、交警指挥无人车平台、本地开发看板、浏览器截图/日志、构建产物、运行数据库和其他项目临时目录。
- Word 文档仅保留总体方案评审版作为附件，其 Markdown 版本作为主阅读和版本追踪载体。

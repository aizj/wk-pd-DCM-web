# wk-pd-DCM-web

济南车路云数据上车服务平台主线仓库。当前主线用于归档和持续演进 **MVP 前的产品基线、平台端控制面和数据上车服务参考实现**，不代表生产系统已经开通或车辆端已经生效。

## 仓库结构

```text
wk-pd-DCM-web/
├── apps/web/                         # 平台端控制面：React + TypeScript + Vite
├── services/v2x-platform/            # 数据上车服务 P0-S4 参考实现：Python + SQLite
├── packages/contracts/               # 平台端共享业务契约、状态和权限类型
├── docs/product/pre-mvp/             # MVP 前规划、需求、产品说明和研发就绪文档
├── docs/product/mvp-entry/           # MVP 入口范围与收敛稿
├── docs/product/appendix/            # 历史核验、影响面和开发执行材料
├── docs/                              # 工程架构、UX/UI 和 ADR
└── scripts/                          # 边界与质量检查
```

## 主线基线

- `apps/web` 提供服务目录、权益、订阅申请、准入检查、审批、订阅运营、参数配置、联合测试、服务发布、运行监控、安全审计、租户接入和端点凭证治理等平台控制面切片。
- `services/v2x-platform` 保留数据上车 P0-S4 的规则、订阅、授权白名单、审计链和 API 参考实现；运行数据库不进入 Git，启动时由服务自行创建。
- `packages/contracts` 是跨页面和服务边界的类型基线；真实接口接入前需继续对齐 OpenAPI/AsyncAPI、ETag、幂等键、ReasonCode 和权限映射。
- `docs/product/pre-mvp` 按规划、需求、产品说明、研发就绪分组保留评审链；文件清单和版本关系见 [`docs/product/INDEX.md`](docs/product/INDEX.md)。
- `main` 作为 MVP 前主线基线；后续开发建议使用 `codex/` 或业务专项分支，完成验证后再合并回主线。

## 运行与验证

平台端：

```bash
npm install
npm run dev
npm run check
```

默认地址：`http://127.0.0.1:5173`。

数据上车服务参考实现：

```bash
PYTHONPATH=services/v2x-platform python3 -m unittest discover -s services/v2x-platform/tests -v
python3 services/v2x-platform/main.py demo
python3 services/v2x-platform/main.py serve 8787
```

默认地址：`http://127.0.0.1:8787`。

## 边界说明

1. Mock 和参考实现用于验证对象、权限、状态、规则和交互契约，不代表生产事实。
2. 生产身份、订阅生效、配置发布、车辆端展示和交互证据必须由对应服务端、车企云、车端或审计系统回传。
3. 页面不保存私钥或 Token；端点、凭证和操作均按租户、环境、权限、职责分离和幂等规则治理。
4. 与本项目无关的移动端、交警指挥无人车平台和本地开发看板未纳入主线，避免污染 DCM 产品仓库。

## 关键文档

- [产品文档索引](docs/product/INDEX.md)
- [基础功能架构](docs/ARCHITECTURE.md)
- [运营后台 UI 规范](docs/UI-REDESIGN.md)
- [UX 修正记录](docs/UX-CORRECTION.md)
- [平台壳层 ADR](docs/adr/0001-platform-shell.md)

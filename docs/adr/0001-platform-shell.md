# ADR-0001：以模块化前端壳层启动平台工程

- 状态：Accepted for scaffold
- 日期：2026-09-16

## 决策

新建独立 npm workspace，以 React＋TypeScript＋Vite 构建平台 SPA；共享状态、权限码和接口类型进入 `packages/contracts`。FR-1～FR-5 先保持模块边界，不在基础骨架阶段引入跨域共享可变状态或生产写接口。

## 原因

- 支持多工作区、深链、复杂表格和权限路由；
- 允许在 OpenAPI/AsyncAPI 冻结后替换 Mock；
- 避免继续扩展既有单文件演示工程；
- 保持移动端、车端和 OEM 系统零改动。

## 后果

- 基础壳层可以先验证信息架构和页面交付单元；
- Mock 结果仅用于交互验证；
- 后端技术栈、数据库和部署拓扑仍需后续 ADR 与项目签认。


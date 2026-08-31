# MaxKB 工具

[English](README.md) | 中文

`@soho/dsh-maxkb` 为 Soho Harness 提供本地 MaxKB 健康检查、应用、工作流和调试打开工具。端点和授权始终来自本地进程配置；该包绝不存储凭据。

## Model Experience

None, as the local administration tools are invoked by consumers and this package registers no model request context itself.

#### KV Cache effect

None; the package does not change any model request.

## Known Limitations and Deferred Work

- The operator must provide valid local MaxKB authorization before administration operations can succeed.
- This package does not provision MaxKB accounts, applications, workflows, knowledge bases, or Docker data.

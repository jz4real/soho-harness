# Agent Note: 保持 Soho MaxKB 启动配置一致

Status: implemented

[English](2026-08-31-soho-maxkb-launcher-configuration.md) | 中文

## Problem

Soho MaxKB 工具接受 `MAXKB_BASE_URL`，而右侧面板在 Profile patch 未提供独立值时固定回退到 8080。使用 `maxkbPort` 的 Windows 部署可能使工具访问一个地址、面板显示另一个地址。启动器还会在 Compose 启动的 MaxKB 完成初始化前失败，且其常规 Compose 状态检查无法区分“正在响应、但由另一个 Compose 项目或手工容器管理”的本机服务。

## Decision

MaxKB 面板的 Host 配置依次解析显式 `baseUrl`、`MAXKB_BASE_URL` 和 loopback 8080 默认值。`dsh/start-soho-web.mjs` 在启动 DSH 前最多等待配置服务 30 秒可达。loopback 服务响应后，它只在最多三秒内读取仓库 Compose 状态；若该项目没有运行服务则给出警告，绝不启动、停止、迁移或修改已有容器或卷。启动器继续只接受 `MAXKB_TOKEN` 和 `MAXKB_ACCOUNT_FILE` 作为账号输入，并删除从无关目录布局推导账号文件的未使用 Python helper。

## Alternatives considered

**仅通过浏览器状态传递地址。** 不予采纳，因为浏览器不能安全读取进程环境，而面板 Host projection 已拥有配置后的 MaxKB 地址。

**把配置端口上的每个监听服务视为本 Compose 项目。** 不予采纳，因为这会隐藏具有运维意义的所有权不一致，并可能诱导对其他部署执行生命周期操作。

**首个健康检查失败即退出。** 不予采纳，因为 Compose 成功启动通常先于 HTTP 服务就绪一小段时间。

## Consequences

非默认 MaxKB 端口通过同一启动器设置到达面板和工具。启动等待和 Compose 诊断均有上限，未受管理的本机服务仍可使用，但会在启动器诊断中标识。面板默认地址、布局、标签与交互不变。`dsh/tests/test-soho-web-start.mjs` 覆盖延迟就绪、Compose 诊断超时和未受管理服务警告；`packages/extensions/maxkb-panel/tests/panel.spec.mjs` 覆盖地址优先级。

# MaxKB 面板

[English](README.md) | 中文

`@soho/dsh-maxkb-panel` 添加由源码维护的 `Files | MaxKB` 右侧工作台。其 iframe 只接受配置的本地 MaxKB origin 和 `/admin` 路径。

## Model Experience

None, as the browser panel is a local presentation surface and registers no model request context.

#### KV Cache effect

None; the panel does not change any model request.

## Known Limitations and Deferred Work

- The panel requires a reachable local MaxKB service and a legitimate browser login.
- It does not embed arbitrary URLs, provision MaxKB content, or replace DSH attachment storage.

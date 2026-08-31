# MaxKB panel

English | [中文](README.zh.md)

`@soho/dsh-maxkb-panel` adds the source-owned `Files | MaxKB` right workbench. Its iframe accepts only the configured local MaxKB origin and `/admin` paths.

## Model Experience

None, as the browser panel is a local presentation surface and registers no model request context.

#### KV Cache effect

None; the panel does not change any model request.

## Known Limitations and Deferred Work

- The panel requires a reachable local MaxKB service and a legitimate browser login.
- It does not embed arbitrary URLs, provision MaxKB content, or replace DSH attachment storage.

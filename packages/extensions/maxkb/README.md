# MaxKB tools

English | [中文](README.zh.md)

`@soho/dsh-maxkb` exposes local MaxKB health, application, workflow, and debug-opening tools to Soho Harness. Its endpoint and authorization remain local process configuration; the package never stores credentials.

## Model Experience

None, as the local administration tools are invoked by consumers and this package registers no model request context itself.

#### KV Cache effect

None; the package does not change any model request.

## Known Limitations and Deferred Work

- The operator must provide valid local MaxKB authorization before administration operations can succeed.
- This package does not provision MaxKB accounts, applications, workflows, knowledge bases, or Docker data.

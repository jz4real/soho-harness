# @soho/dsh-brand-plugin

DeepSeek Harness Web 品牌定制插件：把默认的**小鲸鱼 Logo / "DeepSeek Harness" 字标**换成**自定义图标 + 自定义品牌名**，并把品牌蓝主题换成**淡金色**。图标与文字全部可通过 profile 配置覆盖，**无需修改任何 DSH 源码**，浅色/深色主题都适配。

> English: A standard DSH client plugin that replaces the DeepSeek Harness Web logo/wordmark (whale → your icon, "DeepSeek" → your brand name) and retints the brand-blue theme to champagne gold. Fully configurable via the profile, works in both light and dark themes, no source modification needed.

## 效果

| 位置 | 修改前 | 修改后 |
| --- | --- | --- |
| 左上角字标 | 小鲸鱼 + "DeepSeek" + HARNESS 徽章 | **你的图标 + 品牌名 + HARNESS 徽章** |
| 侧栏折叠态小鲸鱼 | 小鲸鱼 | **你的图标** |
| 新建会话页（正面）大鲸鱼 | 小鲸鱼 | **你的图标** |
| 新建会话页标题 | "探索未至之境" | **"传承 开放 诚信 卓越"** |
| 新建会话页徽章 | "预览版" | **隐藏**（可配置保留） |
| 主题强调色 | 品牌蓝 | **淡金色**（侧栏选中项、气泡、按钮、状态点等） |
| 底色 | 纯白/纯黑 | 极轻微金色暖调 |

## 目录结构

```
soho-brand-plugin/
├── package.json          # npm 包清单 + dsh.client 声明（platform: web）
├── README.md
├── assets/
│   └── preview.png       # 内置默认图标（苏豪控股）
└── lib/
    ├── index.js          # Host（节点）半区：无操作占位
    ├── client.js         # 浏览器半区：品牌定制逻辑（被 /plugins/<id>/client.js 服务）
    └── types/            # 类型声明
```

## 安装（三步，给使用者）

### 第 1 步：让包可被 profile 解析

在 `~\.dsh\profiles\<profile名>\`（例如 `C:\Users\<你>\.dsh\profiles\web\`）下，任选其一：

- **方式 A（推荐，本地文件）**：编辑该目录的 `package.json`，把本包加入依赖后安装：

  ```json
  {
    "name": "dsh-profile-web",
    "private": true,
    "dependencies": {
      "@soho/dsh-brand-plugin": "file:C:/绝对/路径/soho-brand-plugin"
    },
    "dsh": { "profile": { "bundles": [ "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app" ] } }
  }
  ```

  ```bash
  cd ~\.dsh\profiles\web
  npm install        # 或 pnpm install
  ```

- **方式 B（直接放置）**：把整个 `soho-brand-plugin` 目录复制到 `~\.dsh\profiles\node_modules\@soho\dsh-brand-plugin`。

- **方式 C（发布到 npm 后）**：`npm install @soho/dsh-brand-plugin`（在 profile 目录内执行）。

### 第 2 步：在 profile 的 cordis.patch.yml 注册

编辑 `~\.dsh\profiles\<profile名>\cordis.patch.yml`，追加：

```yaml
- insert:
    - id: soho-brand
      name: '@soho/dsh-brand-plugin'
```

### 第 3 步：重启并刷新

```bash
dsh --profile web
```

重启后打开页面（如有缓存请硬刷新 `Ctrl+Shift+R`）。

## 配置（可选）

`icon` / `wordmark` / `harness` 三项均可覆盖，不配置则用内置默认值：

```yaml
- insert:
    - id: soho-brand
      name: '@soho/dsh-brand-plugin'
      config:
        # 你的图标：任意图片转 data URI（推荐 PNG，透明背景最佳）。
        # 可用 PowerShell 生成： [Convert]::ToBase64String([IO.File]::ReadAllBytes('logo.png'))
        icon: 'data:image/png;base64,iVBORw0KGgo...'
        wordmark: '苏豪控股'        # 左上角品牌文字，默认 '苏豪控股'
        harness: 'HARNESS'          # 徽章文字，默认 'HARNESS'（不想显示可留空字符串）
        headline: '传承 开放 诚信 卓越'  # 新建会话页标题，默认 '传承 开放 诚信 卓越'
        showPreview: false          # true 则保留 '预览版' 徽章，默认 false（隐藏）
```

淡金色配色是固定的品牌色（浅色/深色成对），暂不开放配置；如需调整，可改 `lib/client.js` 里的 `GOLD_TOKENS`。

## 卸载

1. 从 `cordis.patch.yml` 删除 `soho-brand` 行；
2. 从 profile 的 `package.json` 移除依赖并 `npm uninstall @soho/dsh-brand-plugin`（方式 B 则删除目录）；
3. 重启 `dsh --profile web`。

## 工作原理

- **主题**：客户端 `apply(ctx, config)` 通过 `ctx.theme.overrideTokens("soho-brand", GOLD_TOKENS)` 叠加 token 层——这是 DSH 主题系统官方提供的扩展点。ui-layout 的 ThemePresenter 会把合成后的 token 写成 `body` 内联样式，浅色/深色自动按配色方案取值，切换主题无需额外处理。
- **Logo/字标**：小鲸鱼（`FishLogo`）与字标（`BrandWordmark`）编译在 Web 壳里、没有 slot 可覆盖，因此插件用 `MutationObserver` **隐藏**原 SVG 并**原位插入**定制节点（图标 `<img>` + 品牌文字 + HARNESS 徽章）。不删除 React 管理的节点，避免破坏 React 协调；组件卸载时观察器随之断开。
- **加载机制**：包声明 `dsh.client: { platform: "web", inject: [...] }` 与 `exports["./client"]`，被 client-modules 扫描进 `window.__DSH_BOOT__`，浏览器通过 `/plugins/@soho/dsh-brand-plugin/client.js`（no-cache）拉取执行——与 DSH 官方客户端插件完全相同的标准机制。

## 环境要求

- DeepSeek Harness（dsh）`web` profile，版本 `0.1.0-rc.6` 系列或 `0.1.1-rc.2` 及以上。
- 依赖官方客户端插件：`@deepseek-ai/dsh-client-runtime`、`@deepseek-ai/dsh-client-ui-theme`（web profile 默认已包含）。

## 版本历史

- **0.2.1**：兼容 DSH `0.1.1-rc.2` 新版客户端插件扫描器（`exports` 增加 `./package.json` 出口，否则插件会被静默跳过）。
- **0.2.0**：初版。

## License

MIT

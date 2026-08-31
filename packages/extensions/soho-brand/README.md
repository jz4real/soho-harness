# @soho/dsh-brand-plugin

English | [中文](README.zh.md)

A DeepSeek Harness Web branding plugin. It replaces the default whale logo and DeepSeek Harness wordmark with a configurable icon and brand name, and changes the blue theme to champagne gold. The profile config overrides all values without changing DSH source, in both light and dark modes.

> 中文：一个标准 DSH 客户端插件，将 DeepSeek Harness Web 的 Logo／字标与品牌蓝主题替换为可配置的图标、品牌名和淡金色主题。无需修改 DSH 源码，适配浅色／深色主题。

## Result

| Location | Before | After |
| --- | --- | --- |
| Top-left wordmark | Whale + "DeepSeek" + HARNESS badge | **Your icon + brand name + HARNESS badge** |
| Collapsed sidebar whale | Whale | **Your icon** |
| New-session whale | Whale | **Your icon** |
| New-session headline | "Explore the unknown" | **"Inheritance · Openness · Integrity · Excellence"** |
| New-session badge | "Preview" | **Hidden** (configurable) |
| Theme accent | Brand blue | **Champagne gold** for selected sidebar items, bubbles, buttons, and status dots |
| Base colors | Pure white / black | A very slight warm gold tint |

## Layout

```
soho-brand-plugin/
├── package.json          # npm manifest + dsh.client declaration (platform: web)
├── README.md
├── assets/
│   └── preview.png       # bundled default icon (Soho Holdings)
└── lib/
    ├── index.js          # host half: no-op placeholder
    ├── client.js         # browser half, served as /plugins/<id>/client.js
    └── types/            # declarations
```

## Installation (three steps)

### Step 1: Make the package resolvable by the profile

In `~\.dsh\profiles\<profile>\` (for example `C:\Users\<you>\.dsh\profiles\web\`), choose one:

- **Option A (recommended, local file):** add the package to the profile `package.json`, then install:

  ```json
  {
    "name": "dsh-profile-web",
    "private": true,
    "dependencies": {
      "@soho/dsh-brand-plugin": "file:C:/absolute/path/soho-brand-plugin"
    },
    "dsh": { "profile": { "bundles": [ "@deepseek-ai/dsh-base", "@deepseek-ai/dsh-web-app" ] } }
  }
  ```

  ```bash
  cd ~\.dsh\profiles\web
  npm install        # or pnpm install
  ```

- **Option B (direct placement):** copy `soho-brand-plugin` to `~\.dsh\profiles\node_modules\@soho\dsh-brand-plugin`.

- **Option C (after publishing):** run `npm install @soho/dsh-brand-plugin` in the profile directory.

### Step 2: Register it in cordis.patch.yml

Append to `~\.dsh\profiles\<profile>\cordis.patch.yml`:

```yaml
- insert:
    - id: soho-brand
      name: '@soho/dsh-brand-plugin'
```

### Step 3: Restart and refresh

```bash
dsh --profile web
```

Open the page after restart; hard-refresh with `Ctrl+Shift+R` when cached.

## Optional configuration

`icon`, `wordmark`, and `harness` are overrideable; omitted values use the bundled defaults:

```yaml
- insert:
    - id: soho-brand
      name: '@soho/dsh-brand-plugin'
      config:
        # Your icon as a data URI; PNG with transparency is recommended.
        # PowerShell: [Convert]::ToBase64String([IO.File]::ReadAllBytes('logo.png'))
        icon: 'data:image/png;base64,iVBORw0KGgo...'
        wordmark: 'Soho Holdings'
        harness: 'HARNESS'
        headline: 'Inheritance Openness Integrity Excellence'
        showPreview: false
```

Champagne-gold tokens are fixed for the light/dark brand theme. Change `GOLD_TOKENS` in `lib/client.js` only when the palette changes.

## Uninstall

1. Remove the `soho-brand` entry from `cordis.patch.yml`.
2. Remove the dependency from the profile `package.json` and run `npm uninstall @soho/dsh-brand-plugin` (or remove the direct-placement directory).
3. Restart `dsh --profile web`.

## How it works

- **Theme:** client `apply(ctx, config)` overlays `GOLD_TOKENS` through `ctx.theme.overrideTokens("soho-brand", GOLD_TOKENS)`. ThemePresenter writes composed tokens to `body`, and both modes select the paired palette automatically.
- **Logo/wordmark:** `FishLogo` and `BrandWordmark` have no slot, so a `MutationObserver` hides the original SVG and inserts the icon, brand name, and HARNESS badge. It preserves React-owned nodes and disconnects on unmount.
- **Loading:** `dsh.client: { platform: "web", inject: [...] }` and `exports["./client"]` allow client-modules to include the package in `window.__DSH_BOOT__`, then the browser loads `/plugins/@soho/dsh-brand-plugin/client.js` without cache.

## Requirements

- DeepSeek Harness `web` profile, version `0.1.0-rc.6` or `0.1.1-rc.2` and later.
- `@deepseek-ai/dsh-client-runtime` and `@deepseek-ai/dsh-client-ui-theme`, which the web profile includes.

## Version history

- **0.2.1:** supports the DSH `0.1.1-rc.2` client-plugin scanner by exporting `./package.json`.
- **0.2.0:** initial release.

## License

MIT

## Model Experience

None, as the browser branding layer changes presentation only and registers no model request context.

#### KV Cache effect

None; the plugin does not change any model request.

## Known Limitations and Deferred Work

- The logo and wordmark use DOM observation because the Web shell exposes no replacement slot.
- Champagne-gold theme tokens are fixed in source; profile configuration does not provide arbitrary palette editing.

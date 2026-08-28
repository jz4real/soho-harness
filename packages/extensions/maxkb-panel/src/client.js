window.__ModuleLoader__.load({
  id: '@soho/dsh-maxkb-panel',
  factory: (require) => {
    const module = { exports: {} }
    const { jsx } = require('react/jsx-runtime')
    const { createRoot } = require('react-dom/client')
    const name = '@soho/dsh-maxkb-panel'
    const inject = ['sessions', 'remote']
    const MAXKB_PRESET_ID = 'maxkb-builder'
    const DEFAULT_BASE_URL = 'http://127.0.0.1:8080'
    const WORKBENCH_STYLE_ID = 'soho-maxkb-workbench-layout'

    const workflowUrl = (baseUrl, applicationId) => `${String(baseUrl).replace(/\/+$/, '')}/admin/application/workspace/${encodeURIComponent(applicationId)}/workflow`

    function trustedMaxkbUrl(value, baseUrl) {
      try {
        const allowed = new URL(baseUrl || DEFAULT_BASE_URL)
        const target = new URL(value)
        if (target.origin !== allowed.origin || !target.pathname.startsWith('/admin')) return null
        return target.toString()
      } catch { return null }
    }

    function installWorkbenchLayout() {
      if (document.getElementById(WORKBENCH_STYLE_ID)) return () => {}
      const style = document.createElement('style')
      style.id = WORKBENCH_STYLE_ID
      style.textContent = `
        :root { --soho-workbench-width: clamp(360px, 35vw, 760px); }
        #root { margin-right: var(--soho-workbench-width); width: calc(100% - var(--soho-workbench-width)); }
        @media (max-width: 900px) { :root { --soho-workbench-width: min(42vw, 420px); } }
      `
      document.head.append(style)
      return () => style.remove()
    }

    function Tab({ label, active, onClick }) {
      return jsx('button', {
        type: 'button', role: 'tab', 'aria-selected': active, onClick,
        style: {
          height: 34, padding: '0 10px', border: 0, borderRight: '1px solid #e5e7eb',
          background: active ? '#fff' : '#f8fafc', color: '#334155', cursor: 'pointer',
          fontSize: 12, fontWeight: active ? 600 : 400,
          boxShadow: active ? 'inset 0 -2px 0 #d6a84b' : 'none',
        },
        children: label,
      })
    }

    function FilesPanel() {
      return jsx('div', {
        style: { padding: 18, color: '#64748b', fontSize: 13, lineHeight: 1.7 },
        children: [
          jsx('strong', { key: 'title', style: { color: '#334155', display: 'block', marginBottom: 6 }, children: '文件' }),
          jsx('span', { key: 'copy', children: '会话附件保留在当前 DSH 工作区；在左侧工作区或会话输入框的“+”中管理文件。' }),
        ],
      })
    }

    function MaxKBPanel({ url, baseUrl }) {
      const src = trustedMaxkbUrl(url, baseUrl)
      return src
        ? jsx('iframe', {
          title: 'MaxKB', src,
          style: { width: '100%', height: '100%', border: 0, display: 'block', background: '#fff' },
          referrerPolicy: 'no-referrer',
        })
        : jsx('div', { style: { padding: 16, color: '#b42318' }, children: 'MaxKB 地址未被允许。' })
    }

    function SohoWorkbench({ activeTab, onSelect, url, baseUrl }) {
      const content = activeTab === 'maxkb'
        ? jsx(MaxKBPanel, { url, baseUrl })
        : jsx(FilesPanel, {})
      return jsx('aside', {
        'aria-label': 'Soho 右侧工作台',
        style: {
          position: 'fixed', zIndex: 20, top: 0, right: 0, bottom: 0,
          width: 'var(--soho-workbench-width)', background: '#fff', borderLeft: '1px solid #e5e7eb',
          display: 'grid', gridTemplateRows: '35px minmax(0, 1fr)', overflow: 'hidden',
        },
        children: [
          jsx('div', {
            key: 'tabs', role: 'tablist', 'aria-label': '工作台标签页',
            style: { display: 'flex', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' },
            children: [
              jsx(Tab, { key: 'files', label: 'Files', active: activeTab === 'files', onClick: () => onSelect('files') }),
              jsx(Tab, { key: 'maxkb', label: 'MaxKB', active: activeTab === 'maxkb', onClick: () => onSelect('maxkb') }),
            ],
          }),
          jsx('div', { key: 'content', role: 'tabpanel', style: { minHeight: 0, overflow: 'hidden' }, children: content }),
        ],
      })
    }

    function projection(ctx) {
      try {
        const current = ctx.sessions?.list?.getSnapshot?.().current
        if (!current) return null
        const session = ctx.sessions.sessionOf(ctx.sessions.scope(current))
        return session?.projections?.faceOf('maxkbState')?.getSnapshot?.() || null
      } catch { return null }
    }

    function target(ctx, config) {
      const state = projection(ctx)
      const baseUrl = state?.baseUrl || config?.baseUrl || DEFAULT_BASE_URL
      const applicationId = state?.applicationId || config?.applicationId || ''
      return {
        baseUrl,
        url: applicationId ? workflowUrl(baseUrl, applicationId) : `${String(baseUrl).replace(/\/+$/, '')}/admin/application`,
      }
    }

    function apply(ctx, config = {}) {
      ctx.effect(() => {
        if (typeof document === 'undefined') return () => {}
        const removeLayout = installWorkbenchLayout()
        const host = document.createElement('div')
        host.dataset.sohoMaxkbPanel = ''
        document.body.append(host)
        const root = createRoot(host)
        let stopped = false
        let activeTab = 'files'
        const selectedPresets = new Map()
        const sessionItem = (sessionId) => ctx.sessions?.list?.getSnapshot?.().byId?.[sessionId]
        const selectedPreset = (sessionId) => selectedPresets.get(sessionId) || sessionItem(sessionId)?.agentPreset
        const sync = () => {
          if (stopped) return
          const sessionId = ctx.sessions?.list?.getSnapshot?.().current
          if (sessionId && selectedPreset(sessionId) === MAXKB_PRESET_ID) activeTab = 'maxkb'
          const next = target(ctx, config)
          root.render(jsx(SohoWorkbench, {
            activeTab, url: next.url, baseUrl: next.baseUrl,
            onSelect: (tab) => { activeTab = tab; sync() },
          }))
        }
        const unsubscribe = ctx.sessions?.list?.subscribe?.(sync) || (() => {})
        const unsubscribePreset = ctx.remote?.$on?.('agent-preset/selected', (sessionId, agentPreset) => {
          selectedPresets.set(sessionId, agentPreset)
          activeTab = agentPreset === MAXKB_PRESET_ID ? 'maxkb' : 'files'
          sync()
        }) || (() => {})
        sync()
        return () => {
          stopped = true; unsubscribe(); unsubscribePreset()
          root.unmount(); host.remove(); removeLayout()
        }
      })
    }

    module.exports.name = name
    module.exports.inject = inject
    module.exports.apply = apply
    return module.exports
  },
})

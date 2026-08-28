export const name = '@soho/dsh-maxkb-panel'
export const inject = ['sessionProjections']

const DEFAULTS = { baseUrl: 'http://127.0.0.1:8080', applicationId: '', workspaceId: 'default' }

function fromArguments(argumentsText) {
  try {
    const value = typeof argumentsText === 'string' ? JSON.parse(argumentsText) : argumentsText
    if (!value || typeof value !== 'object') return null
    const applicationId = value.application_id ?? value.applicationId
    const workspaceId = value.workspace_id ?? value.workspaceId
    return typeof applicationId === 'string' && applicationId
      ? { applicationId, workspaceId: typeof workspaceId === 'string' ? workspaceId : undefined }
      : null
  } catch { return null }
}

export function resolvePanelConfig(config = {}) {
  return {
    ...DEFAULTS,
    ...config,
    baseUrl: String(config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, ''),
  }
}

export function apply(ctx, config = {}) {
  const cfg = resolvePanelConfig(config)
  ctx.sessionProjections.register({
    key: 'maxkbState',
    schema: { parse: (value) => value },
    init: () => ({ version: 0, navigationVersion: 0, applicationId: cfg.applicationId, workspaceId: cfg.workspaceId, pending: {} }),
    apply(state, event) {
      if (event.type === 'tool/call' && event.data?.name === 'maxkb_open_debug' && typeof event.data?.callId === 'string') {
        const target = fromArguments(event.data.arguments)
        if (!target) return state
        return { ...state, pending: { ...state.pending, [event.data.callId]: target } }
      }
      if (event.type === 'tool/result') {
        const callId = event.data?.message?.source?.callId
        const target = typeof callId === 'string' ? state.pending[callId] : undefined
        if (!target) return state
        const pending = { ...state.pending }
        delete pending[callId]
        return {
          ...state,
          version: state.version + 1,
          navigationVersion: state.navigationVersion + 1,
          applicationId: target.applicationId,
          workspaceId: target.workspaceId ?? state.workspaceId,
          pending,
        }
      }
      return state
    },
    view(state) {
      return {
        version: state.version,
        navigationVersion: state.navigationVersion,
        baseUrl: cfg.baseUrl,
        applicationId: state.applicationId,
        workspaceId: state.workspaceId,
      }
    },
    stateVersion: 1,
  })
}

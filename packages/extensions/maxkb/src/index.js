import { MaxKBClient } from './maxkb-client.js'

export { MaxKBClient } from './maxkb-client.js'

export const name = '@soho/dsh-maxkb'
export const inject = ['tools', 'systemPrompt']

const DEFAULTS = { baseUrl: 'http://127.0.0.1:8080', token: '', tokenEnv: 'MAXKB_TOKEN' }
const SENSITIVE_KEYS = new Set(['authorization', 'api_key', 'apikey', 'password', 'secret', 'token', 'access_token', 'refresh_token', 'credentials'])

export function resolvePluginConfig(config = {}) {
  return { ...DEFAULTS, ...config, baseUrl: String(config.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, '') }
}

export function workflowUrl(baseUrl, workspaceId, applicationId) {
  return `${String(baseUrl).replace(/\/+$/, '')}/admin/application/workspace/${encodeURIComponent(applicationId)}/workflow`
}

export async function openDebugResult(client, { workspaceId, applicationId, baseUrl }) {
  const debugSessionId = await client.openDebug(workspaceId, applicationId)
  return {
    ok: true,
    debugSessionId: String(debugSessionId),
    workspaceId,
    applicationId,
    workflowUrl: workflowUrl(baseUrl, workspaceId, applicationId),
  }
}

function redactSecrets(value, secrets) {
  if (typeof value === 'string') return secrets.reduce((text, secret) => text.replaceAll(secret, '[REDACTED]'), value)
  if (Array.isArray(value)) return value.map((item) => redactSecrets(item, secrets))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).flatMap(([key, item]) => {
    const normalized = key.replaceAll('-', '_').toLowerCase()
    return SENSITIVE_KEYS.has(normalized) || normalized.endsWith('_token') || normalized.endsWith('_secret')
      ? []
      : [[key, redactSecrets(item, secrets)]]
  }))
}

function jsonOutput(secrets) {
  return {
    schema: { type: 'object', additionalProperties: true },
    render: (_args, value) => [{ type: 'text', text: JSON.stringify(redactSecrets(value, secrets), null, 2) }],
  }
}

function unwrapArguments(args, properties, toolName) {
  let value = args ?? {}
  for (let depth = 0; depth < 3 && value && typeof value === 'object' && !Array.isArray(value); depth += 1) {
    if (Object.keys(value).some((key) => Object.hasOwn(properties, key)) || !Object.hasOwn(value, 'arguments')) break
    value = typeof value.arguments === 'string' ? JSON.parse(value.arguments) : value.arguments
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${toolName}: arguments 必须是 JSON 对象`)
  return value
}

function tool(toolName, description, properties, execute, secrets) {
  const required = Object.entries(properties).filter(([, value]) => value.required).map(([key]) => key)
  const cleaned = Object.fromEntries(Object.entries(properties).map(([key, value]) => {
    const { required: _required, ...rest } = value
    return [key, rest]
  }))
  return {
    name: toolName,
    description,
    parameters: { type: 'object', properties: cleaned, required },
    output: jsonOutput(secrets),
    async execute(args) {
      try {
        return redactSecrets(await execute(unwrapArguments(args, properties, toolName)), secrets)
      } catch (error) {
        return { ok: false, error: redactSecrets(String(error?.message ?? error), secrets) }
      }
    },
  }
}

export function apply(ctx, config = {}) {
  const cfg = resolvePluginConfig(config)
  const token = cfg.token || (cfg.tokenEnv ? process.env[cfg.tokenEnv] : '') || ''
  const secrets = token ? [String(token)] : []
  let client
  const getClient = () => (client ??= typeof cfg.clientFactory === 'function'
    ? cfg.clientFactory({ baseUrl: cfg.baseUrl, token })
    : new MaxKBClient({ baseUrl: cfg.baseUrl, token, fetchImpl: cfg.fetchImpl }))

  ctx.systemPrompt?.section?.({
    name: 'tool:maxkb',
    order: 120,
    text: 'Use maxkb_* tools only for the configured MaxKB administration API. maxkb_open_debug already opens the configured local MaxKB workflow panel and returns a successful JSON object with debugSessionId; do not inspect source code or research external repositories after a successful response.',
  })

  ctx.tools.register(tool('maxkb_health', 'Check the configured MaxKB administration API.', {}, () => getClient().health(), secrets))
  ctx.tools.register(tool('maxkb_list_apps', 'List MaxKB applications in a workspace.', {
    workspace_id: { type: 'string', required: true, description: 'MaxKB workspace id' },
  }, ({ workspace_id }) => getClient().listApplications(workspace_id), secrets))
  ctx.tools.register(tool('maxkb_get_app', 'Read one MaxKB application and workflow.', {
    workspace_id: { type: 'string', required: true, description: 'MaxKB workspace id' },
    application_id: { type: 'string', required: true, description: 'MaxKB application id' },
  }, ({ workspace_id, application_id }) => getClient().getApplication(workspace_id, application_id), secrets))
  ctx.tools.register(tool('maxkb_create_app', 'Create a MaxKB workflow application.', {
    workspace_id: { type: 'string', required: true, description: 'MaxKB workspace id' },
    input: { type: 'object', required: true, additionalProperties: true, description: 'MaxKB application fields' },
  }, ({ workspace_id, input }) => getClient().createApplication(workspace_id, input), secrets))
  ctx.tools.register(tool('maxkb_update_workflow', 'Update a MaxKB workflow application.', {
    workspace_id: { type: 'string', required: true, description: 'MaxKB workspace id' },
    application_id: { type: 'string', required: true, description: 'MaxKB application id' },
    input: { type: 'object', required: true, additionalProperties: true, description: 'Editable MaxKB fields' },
  }, ({ workspace_id, application_id, input }) => getClient().updateApplication(workspace_id, application_id, input), secrets))
  ctx.tools.register(tool('maxkb_open_debug', 'Open the native MaxKB debug workflow for an application.', {
    workspace_id: { type: 'string', required: true, description: 'MaxKB workspace id' },
    application_id: { type: 'string', required: true, description: 'MaxKB application id' },
  }, ({ workspace_id, application_id }) => openDebugResult(getClient(), {
    workspaceId: workspace_id,
    applicationId: application_id,
    baseUrl: cfg.baseUrl,
  }), secrets))
}

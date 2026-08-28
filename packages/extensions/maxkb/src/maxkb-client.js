const DEFAULT_BASE_URL = 'http://127.0.0.1:8080'

export class MaxKBClient {
  constructor({ baseUrl = DEFAULT_BASE_URL, token = '', fetchImpl = globalThis.fetch } = {}) {
    this.baseUrl = String(baseUrl).replace(/\/+$/, '')
    this.token = token
    this.fetch = fetchImpl
  }

  async request(path, { method = 'GET', body } = {}) {
    const response = await this.fetch(`${this.baseUrl}/admin/api${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const payload = await response.json()
    if (!response.ok || payload?.code !== 200) throw new Error(payload?.message || `MaxKB HTTP ${response.status}`)
    return payload.data
  }

  health() { return this.request('/user/profile') }
  listApplications(workspaceId) { return this.request(`/workspace/${workspaceId}/application`) }
  getApplication(workspaceId, applicationId) { return this.request(`/workspace/${workspaceId}/application/${applicationId}`) }
  createApplication(workspaceId, input) { return this.request(`/workspace/${workspaceId}/application`, { method: 'POST', body: input }) }
  updateApplication(workspaceId, applicationId, input) {
    return this.request(`/workspace/${workspaceId}/application/${applicationId}`, { method: 'PUT', body: input })
  }
  openDebug(workspaceId, applicationId) { return this.request(`/workspace/${workspaceId}/application/${applicationId}/open`) }
}

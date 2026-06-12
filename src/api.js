const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

async function request(url, options = {}) {
  const res = await fetch(`${API_URL}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  })
  return res.json()
}

export const getProjects     = () => request('/api/projects')
export const createProject   = (data) => request('/api/projects', { method: 'POST', body: JSON.stringify(data) })
export const updateProject = (id, data) => request(`/api/projects/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteProject   = (id) => request(`/api/projects/${id}`, { method: 'DELETE' })
export const getShipments    = (projectId) => request(`/api/shipments/project/${projectId}`)
export const createShipment  = (data) => request('/api/shipments', { method: 'POST', body: JSON.stringify(data) })
export const updateShipment  = (id, data) => request(`/api/shipments/${id}`, { method: 'PUT', body: JSON.stringify(data) })
export const deleteShipment  = (id) => request(`/api/shipments/${id}`, { method: 'DELETE' })
export const refreshShipment = (id) => request(`/api/shipments/${id}/refresh`, { method: 'POST' })
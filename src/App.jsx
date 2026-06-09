import { useState, useEffect } from 'react'
import * as api from './api'
import './App.css'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatRange(earliest, latest) {
  if (!earliest && !latest) return '—'
  if (!earliest) return formatDate(latest)
  if (!latest) return formatDate(earliest)
  if (earliest === latest) return formatDate(earliest)
  return `${formatDate(earliest)} – ${formatDate(latest)}`
}

function Timeline({ title, phases, type }) {
  return (
    <div className={`timeline ${type}`}>
      <h4>{title}</h4>
      <div className="timeline-steps">
        {phases.map((phase, i) => (
          <div key={i} className={`step ${phase.status || ''}`}>
            <div className="step-dot" />
            {i < phases.length - 1 && <div className="step-line" />}
            <div className="step-label">{phase.label}</div>
            <div className="step-date">{phase.dateText}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function StatusBadge({ delayDays, status }) {
  if (status === 'pending' || !status) return <div className="status-badge processing">⏳ Awaiting container number</div>
  if (status === 'tracking') return <div className="status-badge processing">⟳ Fetching live data — click Refresh</div>
  if (delayDays === 0) return <div className="status-badge ontime">✅ On Time</div>
  if (delayDays > 0) return <div className="status-badge late">🔴 {delayDays} Day{delayDays > 1 ? 's' : ''} Late</div>
  return <div className="status-badge early">🟢 {Math.abs(delayDays)} Day{Math.abs(delayDays) > 1 ? 's' : ''} Early</div>
}

function DeleteModal({ title, message, showDownload, onDownload, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>⚠️ {title}</h2>
        <p>{message}</p>
        <p style={{ color: '#e74c3c', fontWeight: 600 }}>This action is irreversible.</p>
        {showDownload && (
          <p>Please <button className="link-btn" onClick={onDownload}>download the Excel sheet</button> before deleting.</p>
        )}
        <div className="modal-buttons">
          <button onClick={onConfirm} className="delete-confirm-btn">Yes, Delete</button>
          <button onClick={onCancel}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function ShipmentCard({ shipment, onRefresh, onAddContainer, onDelete }) {
  const [containerInput, setContainerInput] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const idealPhases = [
    {
      label: 'Departure',
      dateText: formatDate(shipment.departure_date),
      status: 'done'
    },
    {
      label: 'Arrival',
      dateText: formatRange(shipment.planned_arrival_earliest, shipment.planned_arrival_latest)
    },
    {
      label: 'Customs Done',
      dateText: formatRange(shipment.planned_customs_done_earliest, shipment.planned_customs_done_latest)
    },
    {
      label: 'Site Delivery',
      dateText: formatRange(shipment.planned_site_delivery_earliest, shipment.planned_site_delivery_latest)
    },
  ]

  const livePhases = [
    {
      label: 'Gate In',
      dateText: formatDate(shipment.actual_gate_in),
      status: shipment.actual_gate_in ? 'done' : ''
    },
    {
      label: 'Departure',
      dateText: formatDate(shipment.actual_departure),
      status: shipment.actual_departure ? 'done' : ''
    },
    {
      label: 'Arrival (Predicted)',
      dateText: formatDate(shipment.predicted_arrival),
      status: shipment.predicted_arrival
        ? (shipment.delay_days > 0 ? 'late' : 'ontime')
        : ''
    },
    {
      label: 'Customs (Est.)',
      dateText: formatRange(shipment.planned_customs_done_earliest, shipment.planned_customs_done_latest),
      status: 'estimate'
    },
    {
      label: 'Site Delivery (Est.)',
      dateText: formatRange(shipment.planned_site_delivery_earliest, shipment.planned_site_delivery_latest),
      status: 'estimate'
    },
  ]

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh(shipment.id)
    setRefreshing(false)
  }

  const handleAddContainer = async () => {
    if (!containerInput.trim()) return
    await onAddContainer(shipment.id, containerInput.trim())
    setShowForm(false)
    setContainerInput('')
  }

  return (
    <div className="shipment-card">
      <div className="shipment-header">
        <div className="shipment-info">
          <h3>{shipment.origin_port} → {shipment.destination_port}</h3>
          <p>Departure: {formatDate(shipment.departure_date)}</p>
          {shipment.carrier && <p>Carrier: {shipment.carrier}</p>}
          {shipment.container_number && <p>Container: {shipment.container_number}</p>}
        </div>
        <div className="shipment-actions">
          {shipment.gocomet_tracking_id && (
            <button onClick={handleRefresh} disabled={refreshing} className="refresh-btn">
              {refreshing ? '⟳ Refreshing...' : '⟳ Refresh'}
            </button>
          )}
          {!shipment.container_number && (
            <button onClick={() => setShowForm(!showForm)} className="add-container-btn">
              + Add Container
            </button>
          )}
          <button onClick={() => setShowDeleteModal(true)} className="delete-btn">🗑</button>
        </div>
      </div>

      {showForm && (
        <div className="container-form">
          <input
            type="text"
            placeholder="Container number e.g. ONEU0613652"
            value={containerInput}
            onChange={e => setContainerInput(e.target.value)}
          />
          <button onClick={handleAddContainer}>Start Tracking</button>
          <button onClick={() => setShowForm(false)}>Cancel</button>
        </div>
      )}

      <Timeline title="📅 Ideal Timeline" phases={idealPhases} type="ideal" />

      {shipment.gocomet_tracking_id && (
        <>
          <Timeline title="🚢 Live Tracking" phases={livePhases} type="live" />
          {shipment.last_updated && (
            <p className="last-updated">Last updated: {new Date(shipment.last_updated).toLocaleString()}</p>
          )}
        </>
      )}

      <StatusBadge
        delayDays={shipment.delay_days}
        status={shipment.gocomet_tracking_id ? shipment.status : 'pending'}
      />

      {showDeleteModal && (
        <DeleteModal
          title="Delete Shipment?"
          message={`Delete shipment from ${shipment.origin_port} to ${shipment.destination_port}?`}
          showDownload={false}
          onConfirm={() => { setShowDeleteModal(false); onDelete(shipment.id) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}
    </div>
  )
}

function NewShipmentModal({ projectId, onClose, onCreated }) {
  const PORTS = [
    'Port of Valencia','Port of Genoa','Port of Trieste','Port of Venice',
    'Port of Southampton','Port of Hamburg','Port of Gdynia','Port of Riga',
    'Port of Istanbul (Ambarli)','Port of Guangzhou (Nansha)','Port of Shenzhen',
    'Port of Shanghai','Port Klang','Port of Singapore'
  ]
  const DESTINATIONS = ['Nhava Sheva','Chennai','Mundra','Katupalli']
  const [form, setForm] = useState({ origin_port: PORTS[0], destination_port: DESTINATIONS[0], departure_date: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.departure_date) return setError('Please enter departure date')
    setLoading(true)
    setError('')
    try {
      const shipment = await api.createShipment({ project_id: projectId, ...form })
      if (shipment.error) throw new Error(shipment.error)
      onCreated(shipment)
      onClose()
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>Add New Shipment</h2>
        <label>Departure Date</label>
        <input type="date" value={form.departure_date} onChange={e => setForm({...form, departure_date: e.target.value})} />
        <label>Origin Port</label>
        <select value={form.origin_port} onChange={e => setForm({...form, origin_port: e.target.value})}>
          {PORTS.map(p => <option key={p}>{p}</option>)}
        </select>
        <label>Destination Port</label>
        <select value={form.destination_port} onChange={e => setForm({...form, destination_port: e.target.value})}>
          {DESTINATIONS.map(d => <option key={d}>{d}</option>)}
        </select>
        {error && <p className="error">{error}</p>}
        <div className="modal-buttons">
          <button onClick={handleSubmit} disabled={loading}>{loading ? 'Generating timeline...' : 'Generate Timeline'}</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

function NewProjectModal({ onClose, onCreated }) {
  const [name, setName] = useState('')
  const [clientName, setClientName] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim()) return
    setLoading(true)
    const project = await api.createProject({ name: name.trim(), client_name: clientName.trim() })
    onCreated(project)
    onClose()
    setLoading(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>New Project</h2>
        <label>Project Name</label>
        <input type="text" placeholder="e.g. Disney HQ Bangalore" value={name} onChange={e => setName(e.target.value)} />
        <label>Client Name (optional)</label>
        <input type="text" placeholder="e.g. Walt Disney India" value={clientName} onChange={e => setClientName(e.target.value)} />
        <div className="modal-buttons">
          <button onClick={handleSubmit} disabled={loading}>{loading ? 'Creating...' : 'Create Project'}</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [shipments, setShipments] = useState([])
  const [showNewProject, setShowNewProject] = useState(false)
  const [showNewShipment, setShowNewShipment] = useState(false)
  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (activeProjectId) loadShipments(activeProjectId) }, [activeProjectId])

  const loadProjects = async () => {
    const data = await api.getProjects()
    setProjects(Array.isArray(data) ? data : [])
    if (Array.isArray(data) && data.length > 0) setActiveProjectId(data[0].id)
    setLoading(false)
  }

  const loadShipments = async (id) => {
    const data = await api.getShipments(id)
    setShipments(Array.isArray(data) ? data : [])
  }

  const handleRefresh = async (shipmentId) => {
    const updated = await api.refreshShipment(shipmentId)
    if (updated.id) setShipments(prev => prev.map(s => s.id === shipmentId ? updated : s))
  }

  const handleAddContainer = async (shipmentId, containerNumber) => {
    const updated = await api.addTracking(shipmentId, containerNumber)
    if (updated.id) setShipments(prev => prev.map(s => s.id === shipmentId ? updated : s))
  }

  const handleDeleteShipment = async (shipmentId) => {
    await api.deleteShipment(shipmentId)
    setShipments(prev => prev.filter(s => s.id !== shipmentId))
  }

  const handleDeleteProject = async () => {
    await api.deleteProject(activeProjectId)
    const remaining = projects.filter(p => p.id !== activeProjectId)
    setProjects(remaining)
    setActiveProjectId(remaining.length > 0 ? remaining[0].id : null)
    setShipments([])
    setShowDeleteProject(false)
  }

  const handleDownload = () => {
    window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/export/project/${activeProjectId}`)
  }

  const activeProject = projects.find(p => p.id === activeProjectId)

  if (loading) return <div className="loading">Loading Studio19 Tracker...</div>

  return (
    <div className="app">
      <header className="app-header">
        <h1>Studio19 — Shipment Tracker</h1>
      </header>

      <div className="project-tabs">
        {projects.map(p => (
          <button
            key={p.id}
            className={`project-tab ${p.id === activeProjectId ? 'active' : ''}`}
            onClick={() => setActiveProjectId(p.id)}
          >
            {p.name}
          </button>
        ))}
        <button className="project-tab new-tab" onClick={() => setShowNewProject(true)}>+ New Project</button>
      </div>

      {activeProject && (
        <div className="project-content">
          <div className="project-toolbar">
            <h2>{activeProject.name}{activeProject.client_name ? ` — ${activeProject.client_name}` : ''}</h2>
            <div className="toolbar-actions">
              <button onClick={handleDownload} className="download-btn">⬇ Download Excel</button>
              <button onClick={() => setShowNewShipment(true)} className="add-shipment-btn">+ Add Shipment</button>
              <button onClick={() => setShowDeleteProject(true)} className="delete-project-btn">🗑 Delete Project</button>
            </div>
          </div>
          {shipments.length === 0
            ? <div className="empty-state"><p>No shipments yet. Click + Add Shipment to get started.</p></div>
            : <div className="shipments-list">
                {shipments.map(s => (
                  <ShipmentCard
                    key={s.id}
                    shipment={s}
                    onRefresh={handleRefresh}
                    onAddContainer={handleAddContainer}
                    onDelete={handleDeleteShipment}
                  />
                ))}
              </div>
          }
        </div>
      )}

      {projects.length === 0 && !loading && (
        <div className="empty-state"><p>No projects yet. Click + New Project to get started.</p></div>
      )}

      {showNewProject && (
        <NewProjectModal
          onClose={() => setShowNewProject(false)}
          onCreated={project => { setProjects(prev => [project, ...prev]); setActiveProjectId(project.id) }}
        />
      )}

      {showNewShipment && (
        <NewShipmentModal
          projectId={activeProjectId}
          onClose={() => setShowNewShipment(false)}
          onCreated={shipment => setShipments(prev => [shipment, ...prev])}
        />
      )}

      {showDeleteProject && (
        <DeleteModal
          title="Delete Project?"
          message={`Are you sure you want to delete "${activeProject?.name}" and all its shipments?`}
          showDownload={true}
          onDownload={handleDownload}
          onConfirm={handleDeleteProject}
          onCancel={() => setShowDeleteProject(false)}
        />
      )}
    </div>
  )
}
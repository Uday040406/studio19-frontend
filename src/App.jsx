import { useState, useEffect } from 'react'
import * as api from './api'
import './App.css'
import {
  Package, Ship, Target, RefreshCw, Pencil, Trash2, Plus, Download,
  FolderKanban, AlertTriangle, CheckCircle2, X, Send, LogIn,
  Anchor, ArrowDownToLine, ArrowUpFromLine, Flag, TrendingDown, TrendingUp
} from 'lucide-react'

function formatDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function toIST(utcStr) {
  if (!utcStr) return ''
  const str = utcStr.endsWith('Z') ? utcStr : utcStr + 'Z'
  return new Date(str).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true
  }) + ' IST'
}

function titleCase(str) {
  if (!str) return ''
  return str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())
}

const EVENT_LABELS = {
  dispatch:                 'Dispatch',
  gate_in:                  'Gate In',
  origin_departure:         'Origin Departure',
  trans_shipment_arrival:   'Transshipment Arrival',
  trans_shipment_departure: 'Transshipment Departure',
  arrival:                  'Arrival',
}

const EVENT_ICONS = {
  dispatch:                 Send,
  gate_in:                  LogIn,
  origin_departure:         Anchor,
  trans_shipment_arrival:   ArrowDownToLine,
  trans_shipment_departure: ArrowUpFromLine,
  arrival:                  Flag,
}

function Timeline({ events }) {
  if (!events || events.length === 0) return (
    <div className="no-live">
      <RefreshCw size={16} strokeWidth={2} />
      <span>No live data yet — click Refresh</span>
    </div>
  )
  return (
    <div className="timeline">
      <div className="timeline-steps">
        {events.map((e, i) => {
          const isDone = !!e.actual_date
          const isDelayed = e.delayed && !isDone
          const dotClass = isDone ? 'done' : isDelayed ? 'late' : ''
          const Icon = EVENT_ICONS[(e.event || '').toLowerCase()] || Package
          return (
            <div key={i} className={`step ${dotClass}`}>
              {i < events.length - 1 && <div className="step-line" />}
              <div className="step-dot">
                <Icon size={14} strokeWidth={2.5} />
              </div>
              <div className="step-label">{EVENT_LABELS[(e.event || '').toLowerCase()] || e.display_event}</div>
              {e.location && <div className="step-location">{titleCase(e.location)}</div>}
              <div className="step-dates">
                <span className="date-row"><span className="date-label">Planned</span> {formatDate(e.planned_date)}</span>
                <span className="date-row"><span className="date-label">Actual</span> {formatDate(e.actual_date)}</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DelayBadge({ delayDays, status, predictedArrival, expectedArrival }) {
  if (status === 'tracking') return (
    <div className="delay-badge processing">
      <RefreshCw size={18} strokeWidth={2.5} />
      <span>Fetching live data — click Refresh</span>
    </div>
  )
  if (!status || status === 'pending') return null

  if (delayDays > 0) return (
    <div className="delay-badge late">
      <div className="delay-icon"><TrendingDown size={22} strokeWidth={2.5} /></div>
      <div className="delay-main">
        <span className="delay-num">{delayDays}</span>
        <span className="delay-text">Day{delayDays > 1 ? 's' : ''} Late</span>
      </div>
      {predictedArrival && (
        <span className="delay-sub">Predicted {formatDate(predictedArrival)} · Expected {formatDate(expectedArrival)}</span>
      )}
    </div>
  )
  if (delayDays < 0) return (
    <div className="delay-badge early">
      <div className="delay-icon"><TrendingUp size={22} strokeWidth={2.5} /></div>
      <div className="delay-main">
        <span className="delay-num">{Math.abs(delayDays)}</span>
        <span className="delay-text">Day{Math.abs(delayDays) > 1 ? 's' : ''} Early</span>
      </div>
      {predictedArrival && (
        <span className="delay-sub">Predicted {formatDate(predictedArrival)} · Expected {formatDate(expectedArrival)}</span>
      )}
    </div>
  )
  return (
    <div className="delay-badge ontime">
      <div className="delay-icon"><CheckCircle2 size={22} strokeWidth={2.5} /></div>
      <div className="delay-main">
        <span className="delay-text">On Time</span>
      </div>
      {predictedArrival && <span className="delay-sub">Predicted {formatDate(predictedArrival)}</span>}
    </div>
  )
}

function DeleteModal({ title, message, showDownload, onDownload, onConfirm, onCancel }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-icon warn"><AlertTriangle size={24} strokeWidth={2.5} /></div>
        <h2>{title}</h2>
        <p>{message}</p>
        <p className="irreversible">This action is irreversible.</p>
        {showDownload && (
          <p className="download-hint">
            Please <button className="link-btn" onClick={onDownload}>download the Excel sheet</button> before deleting.
          </p>
        )}
        <div className="modal-buttons">
          <button onClick={onCancel} className="btn-secondary">Cancel</button>
          <button onClick={onConfirm} className="btn-danger">Yes, Delete</button>
        </div>
      </div>
    </div>
  )
}

function EditShipmentModal({ shipment, onClose, onUpdated }) {
  const [form, setForm] = useState({
    shipment_name:         shipment.shipment_name || '',
    container_number:      shipment.container_number || '',
    expected_arrival_date: shipment.expected_arrival_date || ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState('')

  const handleSubmit = async () => {
    if (!form.container_number.trim())   return setError('Container number required')
    if (!form.expected_arrival_date)     return setError('Expected arrival date required')
    setLoading(true)
    setError('')
    try {
      const updated = await api.updateShipment(shipment.id, form)
      if (updated.error) throw new Error(updated.error)
      onUpdated(updated)
      onClose()
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Edit Shipment</h2>
        <label>Shipment Name <span className="optional">Optional</span></label>
        <input
          type="text"
          value={form.shipment_name}
          onChange={e => setForm({...form, shipment_name: e.target.value})}
        />
        <label>Container Number</label>
        <input
          type="text"
          value={form.container_number}
          onChange={e => setForm({...form, container_number: e.target.value.toUpperCase()})}
        />
        <label>Expected Arrival Date</label>
        <input
          type="date"
          value={form.expected_arrival_date}
          onChange={e => setForm({...form, expected_arrival_date: e.target.value})}
        />
        {error && <p className="error">{error}</p>}
        <div className="modal-buttons">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ShipmentCard({ shipment, onRefresh, onDelete, onUpdate }) {
  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await onRefresh(shipment.id)
    setRefreshing(false)
  }

  return (
    <div className="shipment-card">
      <div className="shipment-header">
        <div className="shipment-info">
          <h3>{shipment.shipment_name || shipment.container_number}</h3>
          <div className="shipment-meta">
            <span className="meta-pill"><Package size={13} strokeWidth={2.5} /> {shipment.container_number}</span>
            {shipment.carrier && <span className="meta-pill"><Ship size={13} strokeWidth={2.5} /> {shipment.carrier}</span>}
            <span className="meta-pill accent"><Target size={13} strokeWidth={2.5} /> Expected {formatDate(shipment.expected_arrival_date)}</span>
          </div>
        </div>
        <div className="shipment-actions">
          <button onClick={handleRefresh} disabled={refreshing} className="icon-btn refresh" title="Refresh">
            <RefreshCw size={16} strokeWidth={2.5} className={refreshing ? 'spin' : ''} />
          </button>
          <button onClick={() => setShowEditModal(true)} className="icon-btn edit" title="Edit">
            <Pencil size={16} strokeWidth={2.5} />
          </button>
          <button onClick={() => setShowDeleteModal(true)} className="icon-btn delete" title="Delete">
            <Trash2 size={16} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      <DelayBadge
        delayDays={shipment.delay_days}
        status={shipment.status}
        predictedArrival={shipment.predicted_arrival}
        expectedArrival={shipment.expected_arrival_date}
      />

      <Timeline events={shipment.gocomet_events} />

      {shipment.last_updated && (
        <p className="last-updated">Updated {toIST(shipment.last_updated)}</p>
      )}

      {showDeleteModal && (
        <DeleteModal
          title="Delete Shipment?"
          message={`Delete "${shipment.shipment_name || shipment.container_number}"?`}
          showDownload={false}
          onConfirm={() => { setShowDeleteModal(false); onDelete(shipment.id) }}
          onCancel={() => setShowDeleteModal(false)}
        />
      )}

      {showEditModal && (
        <EditShipmentModal
          shipment={shipment}
          onClose={() => setShowEditModal(false)}
          onUpdated={updated => {
            onUpdate(shipment.id, updated)
            setShowEditModal(false)
          }}
        />
      )}
    </div>
  )
}

function NewShipmentModal({ projectId, onClose, onCreated }) {
  const [form, setForm] = useState({ shipment_name: '', container_number: '', expected_arrival_date: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!form.container_number.trim()) return setError('Container number is required')
    if (!form.expected_arrival_date) return setError('Expected arrival date is required')
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
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Add Shipment</h2>
        <label>Shipment Name <span className="optional">Optional</span></label>
        <input
          type="text"
          placeholder="e.g. Andreu World — Phase 2"
          value={form.shipment_name}
          onChange={e => setForm({...form, shipment_name: e.target.value})}
        />
        <label>Container Number</label>
        <input
          type="text"
          placeholder="e.g. HMMU2204997"
          value={form.container_number}
          onChange={e => setForm({...form, container_number: e.target.value.toUpperCase()})}
        />
        <label>Expected Arrival Date</label>
        <input
          type="date"
          value={form.expected_arrival_date}
          onChange={e => setForm({...form, expected_arrival_date: e.target.value})}
        />
        {error && <p className="error">{error}</p>}
        <div className="modal-buttons">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">
            {loading ? 'Starting tracking...' : 'Add & Track'}
          </button>
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
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2>New Project</h2>
        <label>Project Name</label>
        <input type="text" placeholder="e.g. Disney HQ Bangalore" value={name} onChange={e => setName(e.target.value)} />
        <label>Client Name <span className="optional">Optional</span></label>
        <input type="text" placeholder="e.g. Walt Disney India" value={clientName} onChange={e => setClientName(e.target.value)} />
        <div className="modal-buttons">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">{loading ? 'Creating...' : 'Create Project'}</button>
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

  const handleUpdateShipment = (shipmentId, updatedShipment) => {
    setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, ...updatedShipment } : s))
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

  if (loading) return (
    <div className="loading">
      <div className="loading-mark">S19</div>
      <span>Loading Studio19 Tracker...</span>
    </div>
  )

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark">S19</div>
          <div className="brand-text">
            <strong>Studio19</strong>
            <span>Shipment Tracker</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <div className="sidebar-label">Projects</div>
          {projects.map(p => (
            <button
              key={p.id}
              className={`sidebar-item ${p.id === activeProjectId ? 'active' : ''}`}
              onClick={() => setActiveProjectId(p.id)}
            >
              <FolderKanban size={16} strokeWidth={2.5} />
              <span>{p.name}</span>
            </button>
          ))}
        </nav>

        <button className="sidebar-new" onClick={() => setShowNewProject(true)}>
          <Plus size={16} strokeWidth={2.5} />
          New Project
        </button>
      </aside>

      <main className="main">
        {activeProject ? (
          <>
            <div className="page-header">
              <div>
                <h1>{activeProject.name}</h1>
                {activeProject.client_name && <p className="page-subtitle">{activeProject.client_name}</p>}
              </div>
              <div className="page-actions">
                <button onClick={handleDownload} className="btn-outline">
                  <Download size={15} strokeWidth={2.5} /> Excel
                </button>
                <button onClick={() => setShowNewShipment(true)} className="btn-primary">
                  <Plus size={15} strokeWidth={2.5} /> Add Shipment
                </button>
                <button onClick={() => setShowDeleteProject(true)} className="icon-btn delete">
                  <Trash2 size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {shipments.length === 0
              ? (
                <div className="empty-state">
                  <Package size={40} strokeWidth={1.5} />
                  <p>No shipments yet</p>
                  <span>Click "Add Shipment" to start tracking your first container</span>
                </div>
              )
              : <div className="shipments-list">
                  {shipments.map(s => (
                    <ShipmentCard
                      key={s.id}
                      shipment={s}
                      onRefresh={handleRefresh}
                      onDelete={handleDeleteShipment}
                      onUpdate={handleUpdateShipment}
                    />
                  ))}
                </div>
            }
          </>
        ) : (
          <div className="empty-state">
            <FolderKanban size={40} strokeWidth={1.5} />
            <p>No projects yet</p>
            <span>Click "New Project" in the sidebar to get started</span>
          </div>
        )}
      </main>

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
          message={`Delete "${activeProject?.name}" and all its shipments?`}
          showDownload={true}
          onDownload={handleDownload}
          onConfirm={handleDeleteProject}
          onCancel={() => setShowDeleteProject(false)}
        />
      )}
    </div>
  )
}
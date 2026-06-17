import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import * as api from './api'
import './App.css'
import logo from './assets/studio19-logo.png'
import {
  Package, Ship, Target, RefreshCw, Pencil, Trash2, Plus, Download,
  AlertTriangle, CheckCircle2, X, Send, LogIn, MapPin,
  Anchor, ArrowDownToLine, ArrowUpFromLine, Flag, TrendingDown, TrendingUp,
  ChevronDown, ChevronUp, Sun, Moon, LayoutGrid, FolderKanban, ArrowRight, Clock,
  FolderInput
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
  gate_in:                    'Gate In',
  origin_departure:           'Origin Departure',
  trans_shipment_arrival:     'Transshipment Arrival',
  trans_shipment_departure:   'Transshipment Departure',
  loaded_at_pod:              'Loaded At POD',
  departure_at_pod:           'Departure At POD',
  arrival:                    'Arrival',
  discharge_at_pod:           'Discharge At POD',
  inland_destination_arrival: 'Inland Destination Arrival',
}

const EVENT_ICONS = {
  gate_in:                    LogIn,
  origin_departure:           Anchor,
  trans_shipment_arrival:     ArrowDownToLine,
  trans_shipment_departure:   ArrowUpFromLine,
  loaded_at_pod:              ArrowDownToLine,
  departure_at_pod:           ArrowUpFromLine,
  arrival:                    MapPin,
  discharge_at_pod:           ArrowDownToLine,
  inland_destination_arrival: Flag,
}

function getDisplayStatus(shipment) {
  const { status, delay_days } = shipment
  if (!status || status === 'tracking' || status === 'pending') return 'pending'
  if (status === 'arrived') return 'delivered'
  if (status === 'delayed' || delay_days > 0) return 'delayed'
  if (status === 'early' || delay_days < 0) return 'early'
  if (status === 'customs') return 'customs'
  return 'in_transit'
}

const STATUS_META = {
  pending:    { label: 'Pending',    css: 's-pending',    processing: true },
  in_transit: { label: 'In Transit', css: 's-in_transit', processing: false },
  customs:    { label: 'Customs',    css: 's-customs',    processing: false },
  delayed:    { label: 'Delayed',    css: 's-delayed',    processing: false },
  early:      { label: 'Early',      css: 's-early',      processing: false },
  on_time:    { label: 'On Time',    css: 's-on_time',    processing: false },
  delivered:  { label: 'Arrived',    css: 's-arrived',    processing: false },
}

const FILTERS = ['all', 'in_transit', 'customs', 'delayed', 'delivered', 'pending']

function getRoute(shipment) {
  let origin = shipment.origin || shipment.origin_port
  let dest = shipment.destination || shipment.destination_port
  const events = shipment.gocomet_events
  if (events && events.length > 0) {
    if (!origin) {
      const e = events.find(e => e.location)
      if (e) origin = titleCase(e.location)
    }
    if (!dest) {
      for (let i = events.length - 1; i >= 0; i--) {
        if (events[i].location) { dest = titleCase(events[i].location); break }
      }
    }
  }
  return {
    origin: (origin || '—').split(',')[0].trim(),
    dest: (dest || '—').split(',')[0].trim()
  }
}

function getProgress(shipment) {
  const ds = getDisplayStatus(shipment)
  if (ds === 'delivered') return 100
  const events = shipment.gocomet_events
  if (events && events.length > 0) {
    const done = events.filter(e => !!e.actual_date).length
    return Math.round((done / events.length) * 100)
  }
  if (ds === 'pending') return 4
  if (ds === 'delayed') return 55
  if (ds === 'early') return 70
  if (ds === 'customs') return 85
  return 45
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
    <div className="delay-badge processing s-pending">
      <RefreshCw size={18} strokeWidth={2.5} />
      <span>Fetching live data — click Refresh</span>
    </div>
  )
  if (!status || status === 'pending') return null

  if (status === 'arrived') return (
    <div className="delay-badge s-arrived">
      <div className="delay-icon"><CheckCircle2 size={22} strokeWidth={2.5} /></div>
      <div className="delay-main"><span className="delay-text">Arrived</span></div>
      {predictedArrival && <span className="delay-sub">Arrived {formatDate(predictedArrival)}</span>}
    </div>
  )

  if (delayDays > 0) return (
    <div className="delay-badge s-delayed">
      <div className="delay-icon"><TrendingDown size={22} strokeWidth={2.5} /></div>
      <div className="delay-main">
        <span className="delay-num">{delayDays}</span>
        <span className="delay-text">Day{delayDays > 1 ? 's' : ''} Late</span>
      </div>
      {predictedArrival && <span className="delay-sub">Predicted {formatDate(predictedArrival)} · Expected {formatDate(expectedArrival)}</span>}
    </div>
  )
  if (delayDays < 0) return (
    <div className="delay-badge s-early">
      <div className="delay-icon"><TrendingUp size={22} strokeWidth={2.5} /></div>
      <div className="delay-main">
        <span className="delay-num">{Math.abs(delayDays)}</span>
        <span className="delay-text">Day{Math.abs(delayDays) > 1 ? 's' : ''} Early</span>
      </div>
      {predictedArrival && <span className="delay-sub">Predicted {formatDate(predictedArrival)} · Expected {formatDate(expectedArrival)}</span>}
    </div>
  )
  return (
    <div className="delay-badge s-on_time">
      <div className="delay-icon"><CheckCircle2 size={22} strokeWidth={2.5} /></div>
      <div className="delay-main"><span className="delay-text">On Time</span></div>
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

function MoveShipmentModal({ shipment, projects, currentProjectId, onClose, onMoved }) {
  const [targetId, setTargetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleMove = async () => {
    if (!targetId) return setError('Select a project')
    setLoading(true)
    setError('')
    try {
      const updated = await api.moveShipment(shipment.id, targetId)
      if (updated.error) throw new Error(updated.error)
      onMoved(shipment.id, targetId)
      onClose()
    } catch (err) { setError(err.message) }
    setLoading(false)
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <button className="modal-close" onClick={onClose}><X size={18} /></button>
        <h2>Move Shipment</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: '0.88rem', lineHeight: 1.6 }}>
          Moving <strong>{shipment.shipment_name || shipment.container_number}</strong> to another project.
        </p>
        <label>Target Project</label>
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          style={{
            width: '100%', padding: '11px 14px',
            border: '1.5px solid var(--border)', borderRadius: 9,
            fontSize: '0.9rem', color: 'var(--text)',
            background: 'var(--surface-2)', fontFamily: 'inherit',
            outline: 'none', cursor: 'pointer'
          }}
        >
          <option value="">Select project...</option>
          {projects
            .filter(p => p.id !== currentProjectId)
            .map(p => <option key={p.id} value={p.id}>{p.name}</option>)
          }
        </select>
        {error && <p className="error">{error}</p>}
        <div className="modal-buttons">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleMove} disabled={!targetId || loading} className="btn-primary">
            {loading ? 'Moving...' : 'Move Shipment'}
          </button>
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
        <input type="text" value={form.shipment_name} onChange={e => setForm({...form, shipment_name: e.target.value})} />
        <label>Container Number</label>
        <input type="text" value={form.container_number} onChange={e => setForm({...form, container_number: e.target.value.toUpperCase()})} />
        <label>Expected Arrival Date</label>
        <input type="date" value={form.expected_arrival_date} onChange={e => setForm({...form, expected_arrival_date: e.target.value})} />
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

// ─── SHIPMENT CARD ────────────────────────────────────────────────────────────
function ShipmentCard({ shipment, projectName: propProjectName, onRefresh, onDelete, onUpdate, onMove, projects, activeProjectId }) {
  const [refreshing, setRefreshing] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showMoveModal, setShowMoveModal] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [barWidth, setBarWidth] = useState(0)

  // Resolve project name from prop (unified view) or from projects array (project view)
  const projectName = propProjectName || projects.find(p => p.id === activeProjectId)?.name || ''

  const displayStatus = getDisplayStatus(shipment)
  const meta = STATUS_META[displayStatus] || STATUS_META.in_transit
  const progress = getProgress(shipment)

  useEffect(() => {
    const t = setTimeout(() => setBarWidth(progress), 150)
    return () => clearTimeout(t)
  }, [progress])

  const handleRefresh = async (e) => {
    e.stopPropagation()
    setRefreshing(true)
    await onRefresh(shipment.id)
    setRefreshing(false)
  }

  const { origin, dest } = getRoute(shipment)

  const etaText = displayStatus === 'delivered'
    ? 'Arrived'
    : (shipment.predicted_arrival ? formatDate(shipment.predicted_arrival) : formatDate(shipment.expected_arrival_date))

  return (
    <div className={`shipment-card ${meta.css} ${expanded ? 'expanded' : ''}`}>
      <div className="card-row" onClick={() => setExpanded(!expanded)}>

        {/* ── TOP ROW: [container# + status | carrier] ── [project name] ── [actions] ── */}
        <div className="card-row-top">

          {/* LEFT: container number + status pill inline, carrier pill below */}
          <div className="card-id-block">
            <div className="card-id-line">
              <div className="card-id">{shipment.container_number}</div>
              <span className={`status-pill ${meta.processing ? 'processing' : ''}`}>
                <span className="dot" /> {meta.label.toUpperCase()}
              </span>
            </div>
            {shipment.carrier && (
              <span className="carrier-pill">{shipment.carrier}</span>
            )}
          </div>

          {/* CENTER: shipment name */}
          {shipment.shipment_name && shipment.shipment_name !== shipment.container_number && (
            <div className="card-project-name">{shipment.shipment_name}</div>
          )}

          {/* RIGHT: action buttons */}
          <div className="card-actions">
            <button onClick={handleRefresh} disabled={refreshing} className={`icon-btn refresh ${refreshing ? 'spin-active' : ''}`} title="Refresh">
              <RefreshCw size={14} strokeWidth={2.5} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowEditModal(true) }} className="icon-btn edit" title="Edit">
              <Pencil size={14} strokeWidth={2.5} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowMoveModal(true) }} className="icon-btn" title="Move to project">
              <FolderInput size={14} strokeWidth={2.5} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setShowDeleteModal(true) }} className="icon-btn delete" title="Delete">
              <Trash2 size={14} strokeWidth={2.5} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} className="icon-btn chevron" title={expanded ? 'Collapse' : 'Expand'}>
              {expanded ? <ChevronUp size={16} strokeWidth={2.5} /> : <ChevronDown size={16} strokeWidth={2.5} />}
            </button>
          </div>
        </div>

        {/* ── BOTTOM ROW: route / progress / ETA ── */}
        <div className="card-row-bottom">
          <div className="card-route">
            <div className="route-point">
              <div className="route-label">Origin</div>
              <div className="route-city">{origin}</div>
            </div>
            <div className="route-arrow"><ArrowRight size={14} strokeWidth={2.5} /></div>
            <div className="route-point dest">
              <div className="route-label">Dest</div>
              <div className="route-city">{dest}</div>
            </div>
          </div>

          <div className="card-progress">
            <div className="progress-head">
              <span className="progress-label">Progress</span>
              <span className="progress-pct">{progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${barWidth}%` }} />
            </div>
          </div>

          <div className="eta-block">
            <Clock size={14} strokeWidth={2.5} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
            <span className="eta-label">ETA</span>
            <span className="eta-value">{etaText}</span>
            {displayStatus === 'delayed' && shipment.delay_days > 0 && (
              <span className="eta-delay"><TrendingDown size={12} strokeWidth={3} /> {shipment.delay_days}d Late</span>
            )}
            {displayStatus === 'early' && shipment.delay_days < 0 && (
              <span className="eta-delay"><TrendingUp size={12} strokeWidth={3} /> {Math.abs(shipment.delay_days)}d Early</span>
            )}
            {displayStatus === 'in_transit' && (
              <span className="eta-delay">On Time</span>
            )}
          </div>
        </div>
      </div>

      {/* ── EXPANDED BODY ── */}
      <div className={`shipment-body${expanded ? ' open' : ''}`}>
        <DelayBadge
          delayDays={shipment.delay_days}
          status={shipment.status}
          predictedArrival={shipment.predicted_arrival}
          expectedArrival={shipment.expected_arrival_date}
        />
        <Timeline events={shipment.gocomet_events} />
        {shipment.last_updated && <p className="last-updated">Updated {toIST(shipment.last_updated)}</p>}
      </div>

      {showDeleteModal && createPortal(
        <DeleteModal
          title="Delete Shipment?"
          message={`Delete "${shipment.shipment_name || shipment.container_number}"?`}
          showDownload={false}
          onConfirm={() => { setShowDeleteModal(false); onDelete(shipment.id) }}
          onCancel={() => setShowDeleteModal(false)}
        />,
        document.body
      )}

      {showEditModal && createPortal(
        <EditShipmentModal
          shipment={shipment}
          onClose={() => setShowEditModal(false)}
          onUpdated={updated => { onUpdate(shipment.id, updated); setShowEditModal(false) }}
        />,
        document.body
      )}

      {showMoveModal && createPortal(
        <MoveShipmentModal
          shipment={shipment}
          projects={projects}
          currentProjectId={activeProjectId}
          onClose={() => setShowMoveModal(false)}
          onMoved={(shipmentId, targetProjectId) => {
            onMove(shipmentId, targetProjectId)
            setShowMoveModal(false)
          }}
        />,
        document.body
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
        <input type="text" placeholder="e.g. Andreu World — Phase 2" value={form.shipment_name} onChange={e => setForm({...form, shipment_name: e.target.value})} />
        <label>Container Number</label>
        <input type="text" placeholder="e.g. HMMU2204997" value={form.container_number} onChange={e => setForm({...form, container_number: e.target.value.toUpperCase()})} />
        <label>Expected Arrival Date</label>
        <input type="date" value={form.expected_arrival_date} onChange={e => setForm({...form, expected_arrival_date: e.target.value})} />
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

function EditProjectModal({ project, onClose, onUpdated }) {
  const [name, setName] = useState(project.name || '')
  const [clientName, setClientName] = useState(project.client_name || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async () => {
    if (!name.trim()) return setError('Project name is required')
    setLoading(true)
    setError('')
    try {
      const updated = await api.updateProject(project.id, { name: name.trim(), client_name: clientName.trim() })
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
        <h2>Edit Project</h2>
        <label>Project Name</label>
        <input type="text" placeholder="e.g. Disney HQ Bangalore" value={name} onChange={e => setName(e.target.value)} />
        <label>Client Name <span className="optional">Optional</span></label>
        <input type="text" placeholder="e.g. Walt Disney India" value={clientName} onChange={e => setClientName(e.target.value)} />
        {error && <p className="error">{error}</p>}
        <div className="modal-buttons">
          <button onClick={onClose} className="btn-secondary">Cancel</button>
          <button onClick={handleSubmit} disabled={loading} className="btn-primary">{loading ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </div>
    </div>
  )
}

function FleetStats({ shipments }) {
  const total   = shipments.length
  const pending = shipments.filter(s => getDisplayStatus(s) === 'pending').length
  const arrived = shipments.filter(s => getDisplayStatus(s) === 'delivered').length
  const late    = shipments.filter(s => getDisplayStatus(s) === 'delayed').length
  const early   = shipments.filter(s => getDisplayStatus(s) === 'early').length
  const inTransit = total - pending - arrived - late - early

  return (
    <div className="fleet-stats">
      <div className="stat-card s-pending">
        <div className="stat-icon"><Package size={18} strokeWidth={2.5} /></div>
        <div className="stat-text"><span className="stat-num">{total}</span><span className="stat-label">Total</span></div>
      </div>
      <div className="stat-card s-in_transit">
        <div className="stat-icon"><Ship size={18} strokeWidth={2.5} /></div>
        <div className="stat-text"><span className="stat-num">{inTransit}</span><span className="stat-label">In Transit</span></div>
      </div>
      <div className="stat-card s-delayed">
        <div className="stat-icon"><TrendingDown size={18} strokeWidth={2.5} /></div>
        <div className="stat-text"><span className="stat-num">{late}</span><span className="stat-label">Delayed</span></div>
      </div>
      <div className="stat-card s-early">
        <div className="stat-icon"><TrendingUp size={18} strokeWidth={2.5} /></div>
        <div className="stat-text"><span className="stat-num">{early}</span><span className="stat-label">Early</span></div>
      </div>
      <div className="stat-card s-arrived">
        <div className="stat-icon"><Target size={18} strokeWidth={2.5} /></div>
        <div className="stat-text"><span className="stat-num">{arrived}</span><span className="stat-label">Arrived</span></div>
      </div>
    </div>
  )
}

function ThemeToggle({ theme, onToggle }) {
  return (
    <button className="theme-toggle" onClick={onToggle} title="Toggle theme" aria-label="Toggle theme">
      <span className="knob">
        {theme === 'dark' ? <Moon size={12} strokeWidth={3} /> : <Sun size={12} strokeWidth={3} />}
      </span>
    </button>
  )
}

export default function App() {
  const [theme, setTheme] = useState(() => {
    const saved = typeof localStorage !== 'undefined' && localStorage.getItem('s19-theme')
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })

  const [view, setView] = useState('project')
  const [projects, setProjects] = useState([])
  const [activeProjectId, setActiveProjectId] = useState(null)
  const [shipments, setShipments] = useState([])
  const [allShipments, setAllShipments] = useState([])
  const [unifiedLoading, setUnifiedLoading] = useState(false)
  const [unifiedFilter, setUnifiedFilter] = useState('all')

  const [showNewProject, setShowNewProject] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [showNewShipment, setShowNewShipment] = useState(false)
  const [showDeleteProject, setShowDeleteProject] = useState(false)
  const [loading, setLoading] = useState(true)
  const [refreshingAll, setRefreshingAll] = useState(false)

  const [projDragIdx, setProjDragIdx] = useState(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try { localStorage.setItem('s19-theme', theme) } catch { /* ignore */ }
  }, [theme])

  useEffect(() => { loadProjects() }, [])
  useEffect(() => { if (activeProjectId) loadShipments(activeProjectId) }, [activeProjectId])
  useEffect(() => { if (view === 'unified' && projects.length > 0) loadAllShipments() }, [view, projects])

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

  const loadAllShipments = async () => {
    setUnifiedLoading(true)
    const results = await Promise.all(projects.map(async p => {
      const data = await api.getShipments(p.id)
      return Array.isArray(data) ? data.map(s => ({ ...s, _projectName: p.name, _projectId: p.id })) : []
    }))
    setAllShipments(results.flat())
    setUnifiedLoading(false)
  }

  const handleRefresh = async (shipmentId) => {
    const updated = await api.refreshShipment(shipmentId)
    if (updated.id) {
      setShipments(prev => prev.map(s => s.id === shipmentId ? updated : s))
      setAllShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, ...updated } : s))
    }
  }

  const handleRefreshAll = async () => {
    if (shipments.length === 0) return
    setRefreshingAll(true)
    const updates = await Promise.all(shipments.map(s => api.refreshShipment(s.id)))
    setShipments(prev => prev.map(s => {
      const u = updates.find(x => x.id === s.id)
      return (u && !u.error) ? u : s
    }))
    setRefreshingAll(false)
  }

  const handleProjectUpdated = (updated) => {
    setProjects(prev => prev.map(p => p.id === updated.id ? { ...p, ...updated } : p))
  }

  const handleUpdateShipment = (shipmentId, updatedShipment) => {
    setShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, ...updatedShipment } : s))
    setAllShipments(prev => prev.map(s => s.id === shipmentId ? { ...s, ...updatedShipment } : s))
  }

  const handleDeleteShipment = async (shipmentId) => {
    await api.deleteShipment(shipmentId)
    setShipments(prev => prev.filter(s => s.id !== shipmentId))
    setAllShipments(prev => prev.filter(s => s.id !== shipmentId))
  }

  const handleMoveShipment = (shipmentId, targetProjectId) => {
    setShipments(prev => prev.filter(s => s.id !== shipmentId))
    setAllShipments(prev => prev.map(s =>
      s.id === shipmentId ? { ...s, project_id: targetProjectId } : s
    ))
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

  const handleProjDragStart = (i) => setProjDragIdx(i)
  const handleProjDragOver = (e) => e.preventDefault()
  const handleProjDrop = (i) => {
    if (projDragIdx === null || projDragIdx === i) { setProjDragIdx(null); return }
    const reordered = [...projects]
    const [item] = reordered.splice(projDragIdx, 1)
    reordered.splice(i, 0, item)
    setProjects(reordered)
    setProjDragIdx(null)
  }
  const handleProjDragEnd = () => setProjDragIdx(null)

  const activeProject = projects.find(p => p.id === activeProjectId)

  const filteredUnified = unifiedFilter === 'all'
    ? allShipments
    : allShipments.filter(s => getDisplayStatus(s) === unifiedFilter)

  if (loading) return (
    <div className="loading" data-theme={theme}>
      <img src={logo} alt="Studio19" className="loading-logo" />
      <span>Loading Studio19 Tracker...</span>
    </div>
  )

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-brand">
          <img src={logo} alt="Studio19" className="brand-logo" />
          <h1>Studio19<span>Shipment Tracker</span></h1>
        </div>
        <div className="header-right">
          <ThemeToggle theme={theme} onToggle={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} />
        </div>
      </header>

      <div className="view-switch">
        <button className={view === 'project' ? 'active' : ''} onClick={() => setView('project')}>
          <FolderKanban size={15} strokeWidth={2.5} /> Project View
        </button>
        <button className={view === 'unified' ? 'active' : ''} onClick={() => setView('unified')}>
          <LayoutGrid size={15} strokeWidth={2.5} /> Unified View
        </button>
      </div>

      {view === 'project' && (
        <div className="project-tabs">
          {projects.map((p, i) => (
            <button
              key={p.id}
              draggable
              onDragStart={() => handleProjDragStart(i)}
              onDragOver={handleProjDragOver}
              onDrop={() => handleProjDrop(i)}
              onDragEnd={handleProjDragEnd}
              className={`project-tab ${p.id === activeProjectId ? 'active' : ''} ${projDragIdx === i ? 'dragging' : ''}`}
              onClick={() => setActiveProjectId(p.id)}
            >
              {p.name}
            </button>
          ))}
          <button className="project-tab new-tab" onClick={() => setShowNewProject(true)}>
            <Plus size={14} strokeWidth={3} /> New Project
          </button>
        </div>
      )}

      <main className="main">
        {view === 'project' ? (
          activeProject ? (
            <>
              <div className="page-header">
                <div>
                  <h2>{activeProject.name}</h2>
                  {activeProject.client_name && <p className="page-subtitle">{activeProject.client_name}</p>}
                </div>
                <div className="page-actions">
                  <button onClick={handleRefreshAll} disabled={refreshingAll || shipments.length === 0} className={`icon-btn refresh ${refreshingAll ? 'spin-active' : ''}`} title="Refresh all shipments">
                    <RefreshCw size={16} strokeWidth={2.5} />
                  </button>
                  <button onClick={handleDownload} className="btn-outline">
                    <Download size={15} strokeWidth={2.5} /> Excel
                  </button>
                  <button onClick={() => setShowNewShipment(true)} className="btn-primary">
                    <Plus size={15} strokeWidth={2.5} /> Add Shipment
                  </button>
                  <button onClick={() => setShowEditProject(true)} className="icon-btn edit" title="Edit project">
                    <Pencil size={16} strokeWidth={2.5} />
                  </button>
                  <button onClick={() => setShowDeleteProject(true)} className="icon-btn delete" title="Delete project">
                    <Trash2 size={16} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {shipments.length > 0 && <FleetStats shipments={shipments} />}

              {shipments.length === 0
                ? (
                  <div className="empty-state">
                    <Package size={40} strokeWidth={1.5} />
                    <p>No shipments yet</p>
                    <span>Click "Add Shipment" to start tracking your first container</span>
                  </div>
                )
                : <div className="shipments-grid">
                    {shipments.map(s => (
                      <ShipmentCard
                        key={s.id}
                        shipment={s}
                        onRefresh={handleRefresh}
                        onDelete={handleDeleteShipment}
                        onUpdate={handleUpdateShipment}
                        onMove={handleMoveShipment}
                        projects={projects}
                        activeProjectId={activeProjectId}
                      />
                    ))}
                  </div>
              }
            </>
          ) : (
            <div className="empty-state">
              <Package size={40} strokeWidth={1.5} />
              <p>No projects yet</p>
              <span>Click "New Project" above to get started</span>
            </div>
          )
        ) : (
          <>
            <div className="page-header">
              <div>
                <h2>All Shipments</h2>
                <p className="page-subtitle">Global overview across every project</p>
              </div>
              <div className="page-actions">
                <button onClick={loadAllShipments} disabled={unifiedLoading} className={`icon-btn refresh ${unifiedLoading ? 'spin-active' : ''}`} title="Reload">
                  <RefreshCw size={16} strokeWidth={2.5} />
                </button>
              </div>
            </div>

            {allShipments.length > 0 && <FleetStats shipments={allShipments} />}

            <div className="filter-bar">
              {FILTERS.map(f => {
                const meta = f === 'all' ? null : STATUS_META[f]
                const label = f === 'all' ? 'All' : meta.label
                return (
                  <button
                    key={f}
                    className={`filter-pill ${meta ? meta.css : ''} ${unifiedFilter === f ? 'active' : ''}`}
                    onClick={() => setUnifiedFilter(f)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>

            {unifiedLoading && allShipments.length === 0 ? (
              <div className="empty-state">
                <RefreshCw size={40} strokeWidth={1.5} className="spin-active" />
                <p>Loading all shipments…</p>
              </div>
            ) : filteredUnified.length === 0 ? (
              <div className="empty-state">
                <Package size={40} strokeWidth={1.5} />
                <p>No shipments found</p>
                <span>Try a different filter</span>
              </div>
            ) : (
              <div className="shipments-grid">
                {filteredUnified.map(s => (
                  <ShipmentCard
                    key={s.id}
                    shipment={s}
                    projectName={s._projectName}
                    onRefresh={handleRefresh}
                    onDelete={handleDeleteShipment}
                    onUpdate={handleUpdateShipment}
                    onMove={handleMoveShipment}
                    projects={projects}
                    activeProjectId={s._projectId || activeProjectId}
                  />
                ))}
              </div>
            )}
          </>
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

      {showEditProject && (
        <EditProjectModal
          project={activeProject}
          onClose={() => setShowEditProject(false)}
          onUpdated={handleProjectUpdated}
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
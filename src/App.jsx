import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ===================== CONFIG =====================
const WEBHOOK_URL = 'https://0785-2a01-cb08-295-5700-ecb8-f7f8-726e-43d7.ngrok-free.app/webhook/update-statut'
const SHEET_ID = '1bdrSOSYT0-i5Zoqfj1c-AGAnTCcWvykLrVMR4in8LBo'
const SHEET_NAME = 'Data'
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`

const STATUTS = ['nouveau', 'à postuler', 'postulé', 'relancé', 'ignoré']
const STATUT_COLORS = {
  'nouveau': '#9B8EC4',
  'à postuler': '#4CAF50',
  'postulé': '#FF9800',
  'relancé': '#2196F3',
  'ignoré': '#F44336',
}
const STATUT_BG = {
  'nouveau': '#EDE9F6',
  'à postuler': '#E8F5E9',
  'postulé': '#FFF3E0',
  'relancé': '#E3F2FD',
  'ignoré': '#FFEBEE',
}

const VILLES = ['Toutes', 'Paris', 'Lyon', 'Marseille', 'Montpellier', 'Monaco', 'Autres']

// ===================== UTILS =====================
function parseSheetData(raw) {
  const json = JSON.parse(raw.substring(47).slice(0, -2))
  const cols = json.table.cols.map(c => c.label.toLowerCase().trim())
  return json.table.rows.map(row => {
    const obj = {}
    row.c.forEach((cell, i) => {
      obj[cols[i]] = cell?.v ?? ''
    })
    return obj
  }).filter(r => r.titre)
}

function scoreColor(s) {
  const n = parseInt(s)
  if (isNaN(n)) return '#9B8EC4'
  if (n >= 8) return '#2d7d46'
  if (n >= 6) return '#856a00'
  if (n >= 4) return '#b84c00'
  return '#c0392b'
}

function scoreBg(s) {
  const n = parseInt(s)
  if (isNaN(n)) return '#EDE9F6'
  if (n >= 8) return '#d4f5e2'
  if (n >= 6) return '#fff3c4'
  if (n >= 4) return '#ffe0c4'
  return '#ffd4d4'
}

function villeMatch(localisation, ville) {
  if (ville === 'Toutes') return true
  const loc = (localisation || '').toLowerCase()
  if (ville === 'Autres') {
    return !['paris', 'lyon', 'marseille', 'montpellier', 'monaco'].some(v => loc.includes(v))
  }
  return loc.includes(ville.toLowerCase())
}

// ===================== COMPONENTS =====================

function ScoreBadge({ score }) {
  if (!score && score !== 0) return <span className="score-badge score-na">?</span>
  return (
    <span className="score-badge" style={{ background: scoreBg(score), color: scoreColor(score) }}>
      {score}/10
    </span>
  )
}

function StatutBadge({ statut }) {
  return (
    <span className="statut-badge" style={{
      background: STATUT_BG[statut] || '#EDE9F6',
      color: STATUT_COLORS[statut] || '#9B8EC4'
    }}>
      {statut || 'nouveau'}
    </span>
  )
}

function OffreCard({ offre, onStatutChange }) {
  const [expanded, setExpanded] = useState(false)
  const [localStatut, setLocalStatut] = useState(offre.statut || 'nouveau')

  function handleStatut(s) {
    setLocalStatut(s)
    onStatutChange(offre.url, s)
  }

  return (
    <div className={`offre-card ${expanded ? 'expanded' : ''}`}>
      <div className="card-header" onClick={() => setExpanded(!expanded)}>
        <div className="card-top">
          <ScoreBadge score={offre.score_llm} />
          <span className="card-source">{offre.source?.toUpperCase()}</span>
          <span className="card-chevron">{expanded ? '▲' : '▼'}</span>
        </div>
        <h3 className="card-titre">{offre.titre}</h3>
        <div className="card-meta">
          <span className="card-entreprise">🏢 {offre.entreprise}</span>
          <span className="card-lieu">📍 {offre.localisation}</span>
          {offre.salaire && offre.salaire !== 'A négocier' && offre.salaire !== 'À négocier' &&
            <span className="card-salaire">💶 {offre.salaire}</span>
          }
        </div>
      </div>

      {expanded && (
        <div className="card-body">
          {offre.resume_llm && (
            <div className="card-resume">
              <span className="label">Analyse IA</span>
              <p>{offre.resume_llm}</p>
            </div>
          )}

          <div className="card-actions">
            <a href={offre.url} target="_blank" rel="noopener noreferrer" className="btn-offre">
              Voir l'offre →
            </a>
          </div>

          <div className="card-statuts">
            <span className="label">Statut</span>
            <div className="statut-buttons">
              {STATUTS.map(s => (
                <button
                  key={s}
                  className={`statut-btn ${localStatut === s ? 'active' : ''}`}
                  style={localStatut === s ? {
                    background: STATUT_COLORS[s],
                    color: '#fff',
                    borderColor: STATUT_COLORS[s]
                  } : {}}
                  onClick={() => handleStatut(s)}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="card-footer">
            <span>📅 {offre.date_publication}</span>
            <span>Semaine {offre.semaine}</span>
            {offre.contrat && <span>📄 {offre.contrat}</span>}
          </div>
        </div>
      )}
    </div>
  )
}

function KanbanCol({ statut, offres, onStatutChange }) {
  return (
    <div className="kanban-col">
      <div className="kanban-col-header">
        <span className="kanban-dot" style={{ background: STATUT_COLORS[statut] }}></span>
        <span className="kanban-title">{statut}</span>
        <span className="kanban-count">{offres.length}</span>
      </div>
      <div className="kanban-cards">
        {offres.length === 0
          ? <div className="kanban-empty">Aucune offre</div>
          : offres.map((o, i) => (
            <OffreCard key={o.url || i} offre={o} onStatutChange={onStatutChange} />
          ))
        }
      </div>
    </div>
  )
}

// ===================== APP =====================
export default function App() {
  const [offres, setOffres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scoreMin, setScoreMin] = useState(0)
  const [ville, setVille] = useState('Toutes')
  const [search, setSearch] = useState('')
  const [statuts, setStatuts] = useState({}) // url -> statut local

  // Charge les données du sheet
  useEffect(() => {
    fetch(SHEET_URL)
      .then(r => r.text())
      .then(raw => {
        const data = parseSheetData(raw)
        setOffres(data)
        // Init statuts locaux
        const s = {}
        data.forEach(o => { s[o.url] = o.statut || 'nouveau' })
        setStatuts(s)
        setLoading(false)
      })
      .catch(e => {
        setError('Impossible de charger les données. Vérifie que le Google Sheet est public.')
        setLoading(false)
      })
  }, [])

  const handleStatutChange = useCallback(async (url, newStatut) => {
    setStatuts(prev => ({ ...prev, [url]: newStatut }))
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, statut: newStatut })
      })
    } catch (e) {
      console.error('Webhook error:', e)
    }
  }, [])

  // Filtre les offres
  const offresFiltered = offres.filter(o => {
    const score = parseInt(o.score_llm)
    if (!isNaN(score) && score < scoreMin) return false
    if (!villeMatch(o.localisation, ville)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.titre?.toLowerCase().includes(q) &&
        !o.entreprise?.toLowerCase().includes(q) &&
        !o.resume_llm?.toLowerCase().includes(q)) return false
    }
    return true
  })

  // Groupe par statut
  const byStatut = {}
  STATUTS.forEach(s => { byStatut[s] = [] })
  offresFiltered.forEach(o => {
    const s = statuts[o.url] || 'nouveau'
    if (byStatut[s]) byStatut[s].push(o)
    else byStatut['nouveau'].push(o)
  })

  // Tri par score desc dans chaque colonne
  Object.keys(byStatut).forEach(s => {
    byStatut[s].sort((a, b) => (parseInt(b.score_llm) || 0) - (parseInt(a.score_llm) || 0))
  })

  const totalOffres = offres.length
  const offresPertinentes = offres.filter(o => parseInt(o.score_llm) >= 7).length

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">
            <span className="title-accent">Offres</span> Emploi
          </h1>
          <div className="header-stats">
            <span className="stat">{totalOffres} offres collectées</span>
            <span className="stat-sep">·</span>
            <span className="stat highlight">{offresPertinentes} pertinentes (≥7)</span>
          </div>
        </div>
        <button className="btn-refresh" onClick={() => window.location.reload()}>
          ↻ Actualiser
        </button>
      </header>

      {/* Filtres */}
      <div className="filters-bar">
        <div className="filter-group">
          <label>Recherche</label>
          <input
            className="filter-input"
            placeholder="Titre, entreprise..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <label>Score min IA</label>
          <div className="score-slider-wrap">
            <input
              type="range" min="0" max="10" step="1"
              value={scoreMin}
              onChange={e => setScoreMin(Number(e.target.value))}
              className="score-slider"
            />
            <span className="score-slider-val" style={{ color: scoreColor(scoreMin) }}>
              {scoreMin}+
            </span>
          </div>
        </div>
        <div className="filter-group">
          <label>Ville</label>
          <div className="ville-pills">
            {VILLES.map(v => (
              <button
                key={v}
                className={`ville-pill ${ville === v ? 'active' : ''}`}
                onClick={() => setVille(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="filter-results">
          {offresFiltered.length} offre{offresFiltered.length > 1 ? 's' : ''}
        </div>
      </div>

      {/* Main */}
      <main className="app-main">
        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p>Chargement des offres...</p>
          </div>
        )}
        {error && (
          <div className="error-box">
            <p>⚠️ {error}</p>
            <p className="error-hint">Rends le Google Sheet public : Partager → "Tout le monde avec le lien peut voir"</p>
          </div>
        )}
        {!loading && !error && (
          <div className="kanban-board">
            {STATUTS.map(s => (
              <KanbanCol
                key={s}
                statut={s}
                offres={byStatut[s]}
                onStatutChange={handleStatutChange}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

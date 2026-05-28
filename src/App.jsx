import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ===================== CONFIG =====================
const SHEET_ID = 'TON_SHEET_ID_ICI'
const SHEET_NAME = 'data'
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`
const WEBHOOK_URL = 'https://n8n.gwendev.eu/webhook/update-statut'
const PASSWORD = 'antibeug'

// ===================== LOGIN =====================
function LoginModal({ onLogin }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (input === PASSWORD) {
      onLogin()
    } else {
      setError(true)
      setInput('')
      setTimeout(() => setError(false), 2000)
    }
  }

  return (
    <div className="login-overlay">
      <div className="login-modal">
        <h2 className="login-title"><span className="title-accent">Offres</span> Emploi</h2>
        <p className="login-sub">Accès restreint</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input
            type="password"
            className={`login-input ${error ? 'login-error' : ''}`}
            placeholder="Mot de passe"
            value={input}
            onChange={e => setInput(e.target.value)}
            autoFocus
          />
          <button type="submit" className="login-btn">Accéder →</button>
        </form>
        {error && <p className="login-err-msg">Mot de passe incorrect</p>}
      </div>
    </div>
  )
}

const VILLES = ['Toutes', 'Paris', 'Lyon', 'Marseille', 'Montpellier', 'Monaco', 'Autres']

// ===================== UTILS =====================
function parseSheetData(raw) {
  const json = JSON.parse(raw.substring(47).slice(0, -2))
  const cols = json.table.cols.map(c => c.label.toLowerCase().trim())
  return json.table.rows.map(row => {
    const obj = {}
    row.c.forEach((cell, i) => { obj[cols[i]] = cell?.v ?? '' })
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
  if (ville === 'Autres') return !['paris', 'lyon', 'marseille', 'montpellier', 'monaco'].some(v => loc.includes(v))
  return loc.includes(ville.toLowerCase())
}

// ===================== CARD =====================
function OffreCard({ offre, onTraite, isAuth }) {
  const [expanded, setExpanded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const score = parseInt(offre.score_llm)
  const hasScore = !isNaN(score)
  const salOk = offre.salaire && offre.salaire !== 'A négocier' && offre.salaire !== 'À négocier'

  async function handleTraite(e) {
    e.stopPropagation()
    setLoading(true)
    await onTraite(offre.url)
    setDone(true)
    setLoading(false)
  }

  return (
    <div className={`offre-card ${done ? 'done' : ''}`}>
      <div className="card-header" onClick={() => setExpanded(!expanded)}>
        <div className="card-top">
          {hasScore && (
            <span className="score-badge" style={{ background: scoreBg(score), color: scoreColor(score) }}>
              {score}/10
            </span>
          )}
          <span className="card-chevron">{expanded ? '▲' : '▼'}</span>
        </div>
        <h3 className="card-titre">{offre.titre}</h3>
        <div className="card-meta">
          <span>🏢 {offre.entreprise}</span>
          <span>📍 {offre.localisation}</span>
          {salOk && <span className="card-salaire">💶 {offre.salaire}</span>}
        </div>
      </div>

      <div className="card-actions">
        <a href={offre.url} target="_blank" rel="noopener noreferrer" className="btn-voir" onClick={e => e.stopPropagation()}>
          Voir l'offre →
        </a>
        {isAuth && (
          <button className={`btn-traite ${done ? 'btn-traite-done' : ''}`} onClick={handleTraite} disabled={loading || done}>
            {loading ? '...' : done ? '✓ Traité' : 'Traité ✓'}
          </button>
        )}
      </div>

      {expanded && (
        <div className="card-body">
          {offre.resume_llm && (
            <div className="card-resume">
              <span className="label">Analyse IA</span>
              <p>{offre.resume_llm}</p>
            </div>
          )}
          <div className="card-footer">
            <span>📅 {offre.date_publication}</span>
            {offre.contrat && <span>📄 {offre.contrat}</span>}
            <span>{offre.semaine}</span>
          </div>
        </div>
      )}
    </div>
  )
}

// ===================== APP =====================
export default function App() {
  const [auth, setAuth] = useState(() => sessionStorage.getItem('auth') === 'ok')
  const [offres, setOffres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scoreMin, setScoreMin] = useState(0)
  const [ville, setVille] = useState('Toutes')
  const [search, setSearch] = useState('')
  const [traites, setTraites] = useState(new Set())
  const [vue, setVue] = useState('atraiter')

  function handleLogin() {
    sessionStorage.setItem('auth', 'ok')
    setAuth(true)
  }

  useEffect(() => {
    fetch(SHEET_URL)
      .then(r => r.text())
      .then(raw => {
        const data = parseSheetData(raw)
        setOffres(data)
        const t = new Set()
        data.forEach(o => { if (o.statut && o.statut !== 'nouveau' && o.statut !== '') t.add(o.url) })
        setTraites(t)
        setLoading(false)
      })
      .catch(() => {
        setError('Impossible de charger les données.')
        setLoading(false)
      })
  }, [])

  const handleTraite = useCallback(async (url) => {
    setTraites(prev => new Set([...prev, url]))
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, statut: 'traite' })
      })
    } catch(e) {
      console.error('Webhook error:', e)
    }
  }, [])

  const offresFiltered = offres.filter(o => {
    const estTraite = traites.has(o.url)
    if (vue === 'atraiter' && estTraite) return false
    if (vue === 'traites' && !estTraite) return false
    const score = parseInt(o.score_llm)
    if (!isNaN(score) && score < scoreMin) return false
    if (!villeMatch(o.localisation, ville)) return false
    if (search) {
      const q = search.toLowerCase()
      if (!o.titre?.toLowerCase().includes(q) && !o.entreprise?.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => (parseInt(b.score_llm) || 0) - (parseInt(a.score_llm) || 0))

  const nbATraiter = offres.filter(o => !traites.has(o.url)).length
  const nbTraites = traites.size

  if (!auth) return <LoginModal onLogin={handleLogin} />

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title"><span className="title-accent">Offres</span> Emploi</h1>
          <div className="header-stats">
            <span className="stat highlight">{nbATraiter} à traiter</span>
            <span className="stat-sep">·</span>
            <span className="stat">{nbTraites} traités</span>
          </div>
        </div>
        <button className="btn-refresh" onClick={() => window.location.reload()}>↻</button>
      </header>

      <div className="vue-toggle">
        <button className={`vue-btn ${vue === 'atraiter' ? 'active' : ''}`} onClick={() => setVue('atraiter')}>
          À traiter <span className="vue-count">{nbATraiter}</span>
        </button>
        <button className={`vue-btn ${vue === 'traites' ? 'active' : ''}`} onClick={() => setVue('traites')}>
          Traités <span className="vue-count">{nbTraites}</span>
        </button>
      </div>

      <div className="filters-bar">
        <div className="filter-group">
          <label>Recherche</label>
          <input className="filter-input" placeholder="Titre, entreprise..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="filter-group">
          <label>Score min IA</label>
          <div className="score-slider-wrap">
            <input type="range" min="0" max="10" step="1" value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))} className="score-slider" />
            <span className="score-slider-val" style={{ color: scoreColor(scoreMin) }}>{scoreMin}+</span>
          </div>
        </div>
        <div className="filter-group">
          <label>Ville</label>
          <div className="ville-pills">
            {VILLES.map(v => (
              <button key={v} className={`ville-pill ${ville === v ? 'active' : ''}`} onClick={() => setVille(v)}>{v}</button>
            ))}
          </div>
        </div>
        <div className="filter-results">{offresFiltered.length} offre{offresFiltered.length > 1 ? 's' : ''}</div>
      </div>

      <main className="app-main">
        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        {error && <div className="error-box"><p>⚠️ {error}</p><p className="error-hint">Rends le Google Sheet public.</p></div>}
        {!loading && !error && (
          <div className="offres-list">
            {offresFiltered.length === 0
              ? <div className="liste-empty">{vue === 'atraiter' ? '🎉 Toutes les offres ont été traitées !' : "Aucune offre traitée pour l'instant."}</div>
              : offresFiltered.map((o, i) => (
                <OffreCard key={o.url || i} offre={o} onTraite={handleTraite} isAuth={auth} />
              ))
            }
          </div>
        )}
      </main>
    </div>
  )
}

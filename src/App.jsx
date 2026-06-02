import { useState, useEffect, useCallback } from 'react'
import './App.css'

// ===================== CONFIG =====================
const SHEET_ID = '1bdrSOSYT0-i5Zoqfj1c-AGAnTCcWvykLrVMR4in8LBo'
const SHEET_NAME = 'data'
const SHEET_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`
const WEBHOOK_URL = 'https://n8n.gwendev.eu/webhook/update-statut'
const PASSWORD = 'antibeug'

// ===================== GEO ZONES =====================
const ZONES = {
  'Paris intra': ['paris 0', 'paris 1', 'paris 2', 'paris 3', 'paris 4', 'paris 5', 'paris 6', 'paris 7', 'paris 8', 'paris 9', 'paris 10', 'paris 11', 'paris 12', 'paris 13', 'paris 14', 'paris 15', 'paris 16', 'paris 17', 'paris 18', 'paris 19', 'paris 20', '75'],
  'Hauts-de-Seine': ['92', 'boulogne', 'neuilly', 'levallois', 'issy', 'courbevoie', 'puteaux', 'nanterre', 'suresnes', 'clichy', 'gennevilliers', 'colombes', 'rueil', 'antony', 'châtenay', 'chatenay', 'montrouge', 'malakoff', 'vanves', 'clamart'],
  'Val-de-Marne': ['94', 'créteil', 'creteil', 'vincennes', 'charenton', 'ivry', 'vitry', 'maisons-alfort', 'saint-maur', 'champigny', 'joinville'],
  'Seine-Saint-Denis': ['93', 'saint-denis', 'montreuil', 'aubervilliers', 'pantin', 'noisy', 'bobigny', 'aulnay'],
  'Essonne': ['91', 'evry', 'évry', 'massy', 'palaiseau', 'corbeil', 'longjumeau'],
  'Yvelines': ['78', 'versailles', 'saint-germain', 'vélizy', 'velizy', 'mantes', 'poissy'],
  'Val-d\'Oise': ['95', 'cergy', 'pontoise', 'argenteuil', 'sarcelles'],
  'Seine-et-Marne': ['77', 'melun', 'meaux', 'torcy', 'lognes'],
  'Lyon': ['69', 'lyon', 'villeurbanne', 'bron', 'caluire', 'vénissieux', 'venissieux', 'saint-priest', 'décines', 'decines', 'mions', 'chassis'],
  'Marseille': ['13', 'marseille', 'aix-en-provence', 'aix en provence', 'martigues', 'aubagne'],
  'Montpellier': ['34', 'montpellier', 'lattes', 'castelnau', 'pérols', 'perols'],
  'Monaco': ['monaco', 'monte-carlo', 'monte carlo'],
  'Télétravail': ['télétravail complet', 'full remote', '100% remote', '100% télétravail', 'full teletravail']
}

// Score géo : plus proche = meilleur
const GEO_SCORE = {
  'Paris intra': 10,
  'Hauts-de-Seine': 9,
  'Val-de-Marne': 8,
  'Seine-Saint-Denis': 8,
  'Essonne': 7,
  'Yvelines': 7,
  "Val-d'Oise": 7,
  'Seine-et-Marne': 6,
  'Lyon': 7,
  'Marseille': 6,
  'Montpellier': 6,
  'Monaco': 5,
  'Télétravail': 9,
}

function getZone(localisation) {
  const loc = (localisation || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  for (const [zone, keywords] of Object.entries(ZONES)) {
    if (keywords.some(k => loc.includes(k.normalize('NFD').replace(/[\u0300-\u036f]/g, '')))) {
      return zone
    }
  }
  return null
}

const ZONE_GROUPS = [
  { label: 'Toutes', zones: null },
  { label: 'IDF', zones: ['Paris intra', 'Hauts-de-Seine', 'Val-de-Marne', 'Seine-Saint-Denis', 'Essonne', 'Yvelines', "Val-d'Oise", 'Seine-et-Marne'] },
  { label: 'Paris', zones: ['Paris intra'] },
  { label: 'Proche banlieue', zones: ['Hauts-de-Seine', 'Val-de-Marne', 'Seine-Saint-Denis'] },
  { label: 'Grande banlieue', zones: ['Essonne', 'Yvelines', "Val-d'Oise", 'Seine-et-Marne'] },
  { label: 'Lyon', zones: ['Lyon'] },
  { label: 'Marseille', zones: ['Marseille'] },
  { label: 'Montpellier', zones: ['Montpellier'] },
  { label: 'Remote', zones: ['Télétravail'] },
]

// ===================== LOGIN =====================
function LoginModal({ onLogin, onClose }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    if (input === PASSWORD) { onLogin() }
    else { setError(true); setInput(''); setTimeout(() => setError(false), 2000) }
  }

  return (
    <div className="login-overlay" onClick={onClose}>
      <div className="login-modal" onClick={e => e.stopPropagation()}>
        <h2 className="login-title"><span className="title-accent">Accès</span> admin</h2>
        <p className="login-sub">Entrez le mot de passe pour activer les actions</p>
        <form onSubmit={handleSubmit} className="login-form">
          <input type="password" className={`login-input ${error ? 'login-error' : ''}`} placeholder="Mot de passe" value={input} onChange={e => setInput(e.target.value)} autoFocus />
          <button type="submit" className="login-btn">Accéder →</button>
        </form>
        {error && <p className="login-err-msg">Mot de passe incorrect</p>}
      </div>
    </div>
  )
}

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
  if (n >= 80) return '#2d7d46'
  if (n >= 60) return '#856a00'
  if (n >= 40) return '#b84c00'
  return '#c0392b'
}

function scoreBg(s) {
  const n = parseInt(s)
  if (isNaN(n)) return '#EDE9F6'
  if (n >= 80) return '#d4f5e2'
  if (n >= 60) return '#fff3c4'
  if (n >= 40) return '#ffe0c4'
  return '#ffd4d4'
}

// ===================== CARD =====================
function OffreCard({ offre, onAction, isAuth }) {
  const [expanded, setExpanded] = useState(false)
  const [loadingAction, setLoadingAction] = useState(null)
  const [done, setDone] = useState(null)

  const score = parseInt(offre.score_llm)
  const hasScore = !isNaN(score)
  const salOk = offre.salaire && offre.salaire !== 'A négocier' && offre.salaire !== 'À négocier'
  const zone = getZone(offre.localisation)

  async function handleAction(e, statut) {
    e.stopPropagation()
    setLoadingAction(statut)
    await onAction(offre.url, statut)
    setDone(statut)
    setLoadingAction(null)
  }

  return (
    <div className={`offre-card ${done ? 'done' : ''}`}>
      <div className="card-header" onClick={() => setExpanded(!expanded)}>
        <div className="card-top">
          {hasScore && <span className="score-badge" style={{ background: scoreBg(score), color: scoreColor(score) }}>{score}/100</span>}
          {zone && <span className="zone-badge">{zone}</span>}
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
        {isAuth && !done && (
          <>
            <button className="btn-postule" onClick={e => handleAction(e, 'postule')} disabled={loadingAction}>
              {loadingAction === 'postule' ? '...' : '✅ Postulé'}
            </button>
            <button className="btn-ignore" onClick={e => handleAction(e, 'ignore')} disabled={loadingAction}>
              {loadingAction === 'ignore' ? '...' : '❌'}
            </button>
          </>
        )}
        {isAuth && done && (
          <span className="done-badge">{done === 'postule' ? '✅ Postulé' : '❌ Ignoré'}</span>
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
  const [showLogin, setShowLogin] = useState(false)
  const [offres, setOffres] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [scoreMin, setScoreMin] = useState(0)
  const [zoneFilter, setZoneFilter] = useState('Toutes')
  const [search, setSearch] = useState('')
  const [traites, setTraites] = useState(new Set())
  const [vue, setVue] = useState('atraiter')

  function handleLogin() {
    sessionStorage.setItem('auth', 'ok')
    setAuth(true)
    setShowLogin(false)
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
      .catch(() => { setError('Impossible de charger les données.'); setLoading(false) })
  }, [])

  const handleAction = useCallback(async (url, statut) => {
    setTraites(prev => new Set([...prev, url]))
    try {
      await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, statut })
      })
    } catch(e) { console.error('Webhook error:', e) }
  }, [])

  const selectedGroup = ZONE_GROUPS.find(g => g.label === zoneFilter)

  const offresFiltered = offres.filter(o => {
    const estTraite = traites.has(o.url)
    if (vue === 'atraiter' && estTraite) return false
    if (vue === 'traites' && !estTraite) return false
    const score = parseInt(o.score_llm)
    if (!isNaN(score) && score < scoreMin) return false
    if (selectedGroup?.zones) {
      const zone = getZone(o.localisation)
      if (!selectedGroup.zones.includes(zone)) return false
    }
    if (search) {
      const q = search.toLowerCase()
      if (!o.titre?.toLowerCase().includes(q) && !o.entreprise?.toLowerCase().includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    const scoreA = parseInt(a.score_llm) || 0
    const scoreB = parseInt(b.score_llm) || 0
    const geoA = GEO_SCORE[getZone(a.localisation)] || 0
    const geoB = GEO_SCORE[getZone(b.localisation)] || 0
    return (scoreB * 2 + geoB) - (scoreA * 2 + geoA)
  })

  const nbATraiter = offres.filter(o => !traites.has(o.url)).length
  const nbTraites = traites.size

  return (
    <div className="app">
      {showLogin && <LoginModal onLogin={handleLogin} onClose={() => setShowLogin(false)} />}

      <div className="sticky-top">
        <header className="app-header">
          <div className="header-left">
            <h1 className="app-title"><span className="title-accent">Offres</span> Emploi</h1>
            <div className="header-stats">
              <span className="stat highlight">{nbATraiter} à traiter</span>
              <span className="stat-sep">·</span>
              <span className="stat">{nbTraites} traités</span>
            </div>
          </div>
          <div className="header-right">
            <button className="btn-refresh" onClick={() => window.location.reload()}>↻</button>
            <button
              className={`btn-lock ${auth ? 'btn-lock-active' : ''}`}
              onClick={() => auth ? (sessionStorage.removeItem('auth'), setAuth(false)) : setShowLogin(true)}
              title={auth ? 'Admin actif — cliquer pour se déconnecter' : 'Accès admin'}
            >
              {auth ? '🔓' : '🔒'}
            </button>
          </div>
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
              <input type="range" min="0" max="100" step="5" value={scoreMin} onChange={e => setScoreMin(Number(e.target.value))} className="score-slider" />
              <span className="score-slider-val" style={{ color: scoreColor(scoreMin) }}>{scoreMin}+</span>
            </div>
          </div>
          <div className="filter-group filter-group-full">
            <label>Zone</label>
            <div className="ville-pills">
              {ZONE_GROUPS.map(g => (
                <button key={g.label} className={`ville-pill ${zoneFilter === g.label ? 'active' : ''}`} onClick={() => setZoneFilter(g.label)}>{g.label}</button>
              ))}
            </div>
          </div>
          <div className="filter-results">{offresFiltered.length} offre{offresFiltered.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      <main className="app-main">
        {loading && <div className="loading"><div className="loading-spinner"></div><p>Chargement...</p></div>}
        {error && <div className="error-box"><p>⚠️ {error}</p><p className="error-hint">Rends le Google Sheet public.</p></div>}
        {!loading && !error && (
          <div className="offres-list">
            {offresFiltered.length === 0
              ? <div className="liste-empty">{vue === 'atraiter' ? '🎉 Toutes les offres ont été traitées !' : "Aucune offre traitée pour l'instant."}</div>
              : offresFiltered.map((o, i) => (
                <OffreCard key={o.url || i} offre={o} onAction={handleAction} isAuth={auth} />
              ))
            }
          </div>
        )}
      </main>
    </div>
  )
}

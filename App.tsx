import { useEffect, useRef, useState, type ChangeEvent, type DragEvent } from 'react'
import {
  Activity,
  AlertCircle,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  CloudUpload,
  FileImage,
  HeartPulse,
  Image as ImageIcon,
  LockKeyhole,
  Menu,
  Microscope,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

type ScreeningStatus = 'queued' | 'processing' | 'completed' | 'rejected_quality' | 'failed'

type ScreeningResponse = {
  screening_id: string
  status: ScreeningStatus
  status_url?: string
  quality?: {
    status: 'pass' | 'reject' | 'uncertain'
    reason_codes?: string[]
    metrics?: Record<string, number | string | boolean>
    pipeline_version?: string
  }
  prediction?: {
    predicted_class_id: string
    probabilities: number[]
    class_ids: string[]
    model_version: string
  }
  error?: { code: string; message: string }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')
const MAX_FILE_SIZE = 15 * 1024 * 1024

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function App() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState('')
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [screening, setScreening] = useState<ScreeningResponse | null>(null)
  const [apiReady, setApiReady] = useState<boolean | null>(null)

  useEffect(() => {
    if (!API_BASE) return
    const controller = new AbortController()
    fetch(`${API_BASE}/health/ready`, { signal: controller.signal })
      .then((response) => setApiReady(response.ok))
      .catch(() => setApiReady(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function chooseFile(next: File | undefined) {
    setError('')
    setNotice('')
    setScreening(null)
    if (!next) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(next.type)) {
      setError('Choose a JPG, PNG, or WebP image to continue.')
      return
    }
    if (next.size > MAX_FILE_SIZE) {
      setError('This file is larger than 15 MB. Choose a smaller image.')
      return
    }
    setFile(next)
    setPreview(URL.createObjectURL(next))
  }

  function onInputChange(event: ChangeEvent<HTMLInputElement>) {
    chooseFile(event.target.files?.[0])
    event.target.value = ''
  }

  function onDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setDragging(false)
    chooseFile(event.dataTransfer.files?.[0])
  }

  function clearFile() {
    setFile(null)
    setPreview('')
    setError('')
    setNotice('')
    setScreening(null)
  }

  async function runScreening() {
    if (!file) return
    if (!API_BASE) {
      setError('The screening API is not configured. Add VITE_API_BASE_URL to a local .env file and start the backend. No result has been generated.')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    setScreening(null)
    try {
      const body = new FormData()
      body.append('image', file)
      const response = await fetch(`${API_BASE}/screenings`, { method: 'POST', body })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        throw new Error(payload?.error?.message ?? `The API could not accept the image (${response.status}).`)
      }
      const submitted = (await response.json()) as ScreeningResponse
      setScreening(submitted)
      if (submitted.status === 'queued' || submitted.status === 'processing') {
        setNotice('Upload received. Waiting for the research service to finish processing…')
        await pollScreening(submitted)
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong while contacting the API.')
    } finally {
      setBusy(false)
    }
  }

  async function pollScreening(initial: ScreeningResponse) {
    if (!API_BASE) return
    const route = initial.status_url ?? `/screenings/${initial.screening_id}`
    const url = route.startsWith('http') ? route : `${API_BASE}${route.startsWith('/api/v1') ? route.replace('/api/v1', '') : route}`
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 1500))
      const response = await fetch(url)
      if (!response.ok) throw new Error('The screening was accepted, but its status could not be retrieved.')
      const result = (await response.json()) as ScreeningResponse
      setScreening(result)
      if (!['queued', 'processing'].includes(result.status)) {
        setNotice('')
        return
      }
    }
    setNotice('Processing is taking longer than expected. You can check again in a moment.')
  }

  const statusLabel = apiReady === true ? 'API connected' : apiReady === false ? 'API unavailable' : API_BASE ? 'Checking API' : 'Demo workspace'

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuOpen ? 'mobile-open' : ''}`}>
        <a className="brand" href="#top" aria-label="RetinaGuard home">
          <span className="brand-mark"><HeartPulse size={21} strokeWidth={2.2} /></span>
          <span className="brand-name">retina<span>guard</span><small>RESEARCH WORKSPACE</small></span>
        </a>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="side-nav" aria-label="Main navigation">
          <a className="nav-item active" href="#screening" onClick={() => setMenuOpen(false)}><Activity size={18} />New screening</a>
          <a className="nav-item disabled" href="#history" onClick={(event) => event.preventDefault()}><Clock3 size={18} />Screening history <span className="soon">SOON</span></a>
          <a className="nav-item disabled" href="#research" onClick={(event) => event.preventDefault()}><Microscope size={18} />Research notes <span className="soon">SOON</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="privacy-card"><span className="privacy-icon"><LockKeyhole size={16} /></span><div><strong>Privacy first</strong><p>Images are handled by your configured research service.</p></div></div>
          <div className="profile"><div className="avatar">RG</div><div className="profile-copy"><strong>Research workspace</strong><span>Local prototype</span></div><MoreHorizontal size={19} className="profile-more" /></div>
        </div>
      </aside>

      <main className="main-area" id="top">
        <header className="topbar">
          <button className="mobile-menu icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} onClick={() => setMenuOpen((open) => !open)}><Menu size={20} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>New screening</strong></div>
          <div className="topbar-right"><span className={`connection ${apiReady === true ? 'online' : ''}`}><i />{statusLabel}</span><button className="help-button"><CircleHelp size={17} /> Help</button></div>
        </header>

        <div className="content-wrap" id="screening">
          <section className="intro-row">
            <div>
              <div className="eyebrow"><span className="eyebrow-line" /> RETINAL IMAGE ANALYSIS</div>
              <h1>Start a new <em>screening</em></h1>
              <p className="intro-copy">Upload a fundus image to begin a research workflow. Image quality and model analysis are provided only when the backend is connected.</p>
            </div>
            <div className="protocol-pill"><span className="protocol-dot" />RESEARCH PROTOCOL <ChevronDown size={14} /></div>
          </section>

          <div className="workflow" aria-label="Workflow progress">
            <div className="workflow-step current"><span className="step-number">01</span><div><strong>Upload image</strong><small>Choose a fundus photograph</small></div></div>
            <div className="workflow-connector" />
            <div className="workflow-step"><span className="step-number muted">02</span><div><strong>Quality check</strong><small>Image suitability</small></div></div>
            <div className="workflow-connector" />
            <div className="workflow-step"><span className="step-number muted">03</span><div><strong>Review output</strong><small>Research result</small></div></div>
          </div>

          <div className="workspace-grid">
            <section className="panel upload-panel">
              <div className="panel-heading"><div><span className="panel-kicker">STEP 01</span><h2>Upload retinal image</h2><p>Use a color fundus photograph in a supported image format.</p></div><span className="heading-icon"><ImageIcon size={19} /></span></div>
              {!file ? (
                <div className={`dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
                  <div className="upload-symbol"><CloudUpload size={25} strokeWidth={1.8} /></div>
                  <h3>Drop your image here</h3>
                  <p>or <button className="browse-link" onClick={() => inputRef.current?.click()}>browse files</button> from your device</p>
                  <div className="format-row"><span>JPG</span><span>JPEG</span><span>PNG</span><i />Up to 15 MB</div>
                  <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={onInputChange} />
                </div>
              ) : (
                <div className="selected-file">
                  <div className="preview-frame"><img src={preview} alt="Selected retinal image preview" /></div>
                  <div className="file-details"><div className="file-title"><span className="file-icon"><FileImage size={17} /></span><strong>{file.name}</strong></div><span className="file-meta">{formatBytes(file.size)} <span>·</span> {file.type || 'Image file'}</span><div className="local-badge"><Check size={13} />Ready to submit</div></div>
                  <button className="remove-file" onClick={clearFile} aria-label="Remove selected image"><Trash2 size={17} /></button>
                </div>
              )}
              {error && <div className="inline-message error-message" role="alert"><AlertCircle size={17} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={16} /></button></div>}
              {notice && <div className="inline-message info-message" role="status"><Activity size={17} /><span>{notice}</span></div>}

              <div className="upload-footnote"><ShieldCheck size={16} /><span>Files are sent only to the API configured for this workspace.</span><button className="text-icon" aria-label="Privacy details"><CircleHelp size={15} /></button></div>
              <div className="panel-divider" />
              <div className="submit-row"><div className="submit-note"><LockKeyhole size={15} /><span>No patient details requested</span></div><button className="primary-button" disabled={!file || busy} onClick={runScreening}>{busy ? <><span className="spinner" />Submitting…</> : <>Continue to analysis <ArrowRight size={17} /></>}</button></div>
            </section>

            <aside className="right-column">
              <section className="panel quality-panel">
                <div className="small-panel-heading"><span className="heading-icon soft"><Sparkles size={17} /></span><div><h2>Quality gate</h2><p>Runs before any model analysis</p></div></div>
                <div className="quality-placeholder"><div className="quality-graphic"><span className="graphic-ring ring-one" /><span className="graphic-ring ring-two" /><span className="graphic-center"><ImageIcon size={21} /></span><span className="graphic-spark spark-a">✳</span><span className="graphic-spark spark-b">✦</span></div><strong>Image check pending</strong><p>Focus, illumination, and framing are evaluated by the research service.</p><span className="pending-chip"><span />AWAITING IMAGE</span></div>
              </section>

              <section className="safety-card"><div className="safety-top"><span className="safety-icon"><ShieldCheck size={18} /></span><span className="safety-label">IMPORTANT</span></div><h3>Research use only</h3><p>This prototype is not a medical device and does not provide a diagnosis. Results must not guide care decisions.</p><a href="#limitations" onClick={(event) => { event.preventDefault(); document.getElementById('limitations')?.scrollIntoView({ behavior: 'smooth' }) }}>Read limitations <ArrowRight size={14} /></a></section>

              <div className="support-note"><span className="support-icon"><CircleHelp size={16} /></span><span><strong>Need help?</strong><br />See the project setup guide for API configuration.</span></div>
            </aside>
          </div>

          {screening && <section className="panel result-panel" aria-live="polite"><div className="result-heading"><div><span className="panel-kicker">SCREENING STATUS</span><h2>{screening.status === 'completed' ? 'Analysis response received' : screening.status === 'rejected_quality' ? 'Image did not pass the quality gate' : screening.status === 'failed' ? 'Analysis could not be completed' : 'Screening submitted'}</h2></div><span className={`result-state state-${screening.status}`}>{screening.status.replace('_', ' ')}</span></div><p className="result-description">{screening.status === 'completed' ? 'The API returned a completed research response. Review the output with the limitations and model version provided by your research team.' : screening.status === 'rejected_quality' ? `The research service did not proceed with inference. ${screening.quality?.reason_codes?.join(', ') || 'Review image suitability and follow your study protocol.'}` : screening.status === 'failed' ? screening.error?.message || 'The service returned a failure. No result is available.' : 'This is a processing status only. No prediction is available yet.'}</p>{screening.prediction && <div className="prediction-summary"><strong>Model output</strong><span>{screening.prediction.predicted_class_id}</span><small>Model version: {screening.prediction.model_version} · Research output, not a diagnosis</small></div>}</section>}

          <section className="limitations" id="limitations"><div className="limitations-icon"><AlertCircle size={17} /></div><div><strong>About this research prototype</strong><p>Quality checks and model outputs depend on the connected service, dataset, and model version. A successful upload does not confirm that an image is suitable or that a result is clinically valid.</p></div><button aria-label="More about limitations"><MoreHorizontal size={19} /></button></section>

          <footer className="footer"><span>© 2026 RetinaGuard AI <i /> Research prototype</span><span><a href="#limitations">Limitations</a><a href="#privacy">Privacy</a><span className="version">UI PREVIEW 0.1</span></span></footer>
        </div>
      </main>
    </div>
  )
}

export default App

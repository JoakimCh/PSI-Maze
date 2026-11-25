import { DISTANCE, drawMaze, generateMaze, targetSpeed } from './maze.js'
import { MicrophoneTRNG } from './microphone.js'
import { DAYS_PER_BLOCK, dayKey, historyCSV, loadRuns, saveRun, summarize } from './history.js'

const byId = id => document.getElementById(id)
const canvas = byId('maze')
const timer = byId('timer')
const status = byId('status')
const start = byId('start')
const next = byId('new-maze')
const navigation = ['training', 'free', 'history']
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dateFromKey = key => new Date(key + 'T12:00:00')
const seconds = ms => (ms / 1000).toFixed(1) + ' s'
const signalTimeout = 6500

let mode = 'training'
let path = generateMaze()
let active
let runs = []
let storageError = false
let historyRequest = 0
let previousTrainingDay = dayKey(new Date())

function element(tag, content, className) {
  const node = document.createElement(tag)
  if (content !== undefined) node.textContent = content
  if (className) node.className = className
  return node
}

function progressText({ blocks, pending }) {
  const today = dayKey(new Date())
  if (pending.some(day => day.key === today)) {
    return pending.length + ' of 7 training days · Today counted'
  }
  if (blocks.at(-1)?.days.at(-1).key === today) {
    return 'Block ' + blocks.length + ' revealed · New block starts on your next training day'
  }
  return pending.length + ' of ' + DAYS_PER_BLOCK + ' training days'
}

function metric(label, value) {
  const card = element('div', undefined, 'metric')
  card.append(element('span', label), element('strong', value))
  return card
}

function showProgress(renderResults = true) {
  const history = summarize(runs)
  const { blocks } = history
  const progress = storageError ? 'Training history is unavailable on this device.' : progressText(history)
  byId('progress-label').textContent = progress
  byId('history-progress').textContent = progress
  byId('export').hidden = !blocks.length
  if (renderResults) renderHistory(blocks)
}

function renderHistory(blocks) {
  const results = byId('results')
  results.replaceChildren()
  if (!blocks.length) {
    results.append(element('p', 'Your first results unlock after seven training days.'))
    return
  }

  const baseline = blocks[0]
  const latest = blocks.at(-1)
  const metrics = element('div', undefined, 'metrics')
  metrics.append(metric('Baseline', seconds(baseline.time)))
  if (blocks.length > 1) {
    const change = latest.time - baseline.time
    const difference = Math.abs(change / baseline.time * 100)
    const comparison = Math.abs(change) < 50
      ? 'No change'
      : seconds(Math.abs(change)) + (change < 0 ? ' less' : ' more') + ' (' + difference.toFixed(1) + '%)'
    metrics.append(metric('Latest block', seconds(latest.time)), metric('Compared with baseline', comparison))
  }
  results.append(metrics)

  const setupCount = new Set(blocks.flatMap(block => block.setups.map(setup => setup.signature))).size
  if (setupCount > 1) {
    results.append(element('p', 'The history includes different microphone setups or game rules.', 'setup'))
  }

  if (blocks.length > 1) {
    const trend = element('section', undefined, 'trend')
    const rows = element('ol')
    const longest = Math.max(...blocks.map(block => block.time))
    blocks.forEach((block, i) => {
      const row = element('li')
      const date = element('time', shortDate.format(dateFromKey(block.days.at(-1).key)))
      date.dateTime = block.days.at(-1).key
      date.textContent = 'Block ' + (i + 1) + ' · ' + date.textContent
      const bar = element('div', undefined, 'bar')
      bar.style.width = (100 * block.time / longest) + '%'
      bar.setAttribute('aria-hidden', 'true')
      row.append(date, bar, element('strong', seconds(block.time)))
      rows.append(row)
    })
    trend.append(element('h2', 'Typical time by block'), rows)
    results.append(trend)
  }

  for (let i = blocks.length - 1; i >= 0; i--) {
    const block = blocks[i]
    const dates = fullDate.formatRange(dateFromKey(block.days[0].key), dateFromKey(block.days.at(-1).key))
    const group = element('details')
    group.open = i === blocks.length - 1
    group.append(element('summary', 'Block ' + (i + 1) + (i === 0 ? ' · Baseline' : '') + ' · ' + dates + ' · ' + seconds(block.time)))
    const panel = element('div', undefined, 'block-info')
    panel.append(element('p', block.setups.map(setup => setup.label + ' · ' + setup.rate + ' Hz').join(' / '), 'setup'))
    for (const day of block.days) {
      const dayGroup = element('details')
      const summary = element('summary')
      const title = element('span', undefined, 'day-title')
      title.append(
        element('span', fullDate.format(dateFromKey(day.key)) + ' · ' + seconds(day.time)),
        element('small', day.runs.length + (day.runs.length === 1 ? ' run' : ' runs'))
      )
      summary.append(title)
      const list = element('ul', undefined, 'run-list')
      for (const run of day.runs) {
        const recordedTime = run.localTime ?? timeOfDay.format(new Date(run.at))
        const setup = setupCount > 1 ? ' · ' + run.setup.label + ' · ' + run.setup.rate + ' Hz' : ''
        list.append(element('li', recordedTime + ' · ' + seconds(run.ms) + setup))
      }
      dayGroup.append(summary, list)
      panel.append(dayGroup)
    }
    group.append(panel)
    results.append(group)
  }
}

async function refreshHistory() {
  const request = ++historyRequest
  try {
    const saved = await loadRuns()
    if (request !== historyRequest) return
    runs = saved
    storageError = false
  } catch {
    if (request !== historyRequest) return
    storageError = true
  }
  showProgress(mode === 'history')
}

function release(run) {
  if (active !== run) return
  active = undefined
  run.mic.stop()
  cancelAnimationFrame(run.frame)
  run.wake?.release().catch(() => {})
  next.disabled = false
}

function ready(message = 'Press Start to enable the microphone.') {
  status.textContent = message
  start.textContent = 'Start'
  timer.textContent = '0.0 s'
  drawMaze(canvas, path, 0, false)
}

function stopRun(run, message) {
  if (active !== run) return
  release(run)
  ready(message)
}

function setMode(selected, focus = false) {
  if (selected === mode && focus) return
  if (active) release(active)
  mode = selected
  for (const name of navigation) {
    const button = byId('nav-' + name)
    if (name === selected) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  byId('game').hidden = selected === 'history'
  byId('history').hidden = selected !== 'history'
  byId('game-title').textContent = selected === 'free' ? 'Free Play' : 'Training'
  byId('progress-label').hidden = selected !== 'training'
  timer.hidden = selected !== 'free'
  ready()
  if (selected === 'history') refreshHistory()
  if (focus) window.scrollTo(0, 0)
}

async function finish(run, at) {
  release(run)
  const elapsed = at - run.started
  drawMaze(canvas, path, DISTANCE, true)
  start.textContent = 'Start'
  status.textContent = 'Finished.'
  if (mode === 'free') timer.textContent = seconds(elapsed)
  next.focus({ preventScroll: true })
  if (mode !== 'training') return
  const date = new Date()
  try {
    await saveRun({
      day: dayKey(date), at: date.getTime(), localTime: timeOfDay.format(date),
      ms: elapsed, setup: run.setup
    })
    await refreshHistory()
  } catch {
    if (mode === 'training' && !active && status.textContent === 'Finished.') {
      status.textContent = 'Finished. This run could not be saved.'
    }
  }
}

function animate(run, now) {
  if (active !== run) return
  const lastData = run.lastWord ?? run.listening
  if (lastData !== undefined && now - lastData > signalTimeout) {
    stopRun(run, 'No usable microphone signal. Check the mic and try again.')
    return
  }
  if (run.started !== undefined) {
    const time = Math.max(run.frameAt, Math.min(now, run.lastWord + 150))
    const delta = time - run.frameAt
    if (delta > 0) {
      run.speed += (run.target - run.speed) * (1 - Math.exp(-delta / 190))
      const advance = run.speed * delta / 1000
      if (run.position + advance >= DISTANCE) {
        finish(run, run.frameAt + (DISTANCE - run.position) / advance * delta)
        return
      }
      run.position += advance
      run.frameAt = time
      drawMaze(canvas, path, run.position, false)
    }
    if (mode === 'free') timer.textContent = seconds(now - run.started)
  }
  run.frame = requestAnimationFrame(time => animate(run, time))
}

async function startRun() {
  if (active) {
    stopRun(active, 'Run stopped. Press Start to try again.')
    return
  }
  const run = { mic: new MicrophoneTRNG(), position: 0, speed: 2.2 }
  active = run
  next.disabled = true
  start.textContent = 'Cancel'
  timer.textContent = '0.0 s'
  status.textContent = 'Waiting for microphone access…'
  drawMaze(canvas, path, 0, false)
  try {
    await run.mic.start((word, setup) => {
      if (active !== run) return
      const now = performance.now()
      if (run.lastWord !== undefined && now - run.lastWord > 350) run.frameAt = now
      run.lastWord = now
      run.target = targetSpeed(word)
      if (run.started !== undefined) return
      run.started = now
      run.frameAt = now
      run.setup = setup
      status.textContent = 'Run in progress'
      start.textContent = 'Stop'
    }, message => stopRun(run, message))
    if (active !== run) return
    run.listening = performance.now()
    if (run.started === undefined) status.textContent = 'Listening for microphone input…'
    run.frame = requestAnimationFrame(time => animate(run, time))
    navigator.wakeLock?.request('screen').then(lock => {
      if (active === run) run.wake = lock
      else lock.release().catch(() => {})
    }).catch(() => {})
  } catch (error) {
    const message = error.name === 'NotAllowedError'
      ? 'Microphone access was blocked. Allow it in the browser and try again.'
      : error.name === 'NotFoundError'
        ? 'No microphone found. Connect one and try again.'
        : error.message || 'The microphone could not start.'
    stopRun(run, message)
  }
}

for (const name of navigation) byId('nav-' + name).onclick = () => setMode(name, true)
start.onclick = startRun
next.onclick = () => {
  let replacement = generateMaze()
  while (replacement.every((cell, i) => cell === path[i]) ||
    replacement.every((cell, i) => cell === path.at(-1 - i))) {
    replacement = generateMaze()
  }
  path = replacement
  ready('New maze ready. Press Start to begin.')
  start.focus({ preventScroll: true })
}

byId('export').onclick = () => {
  const { blocks } = summarize(runs)
  if (!blocks.length) return
  const url = URL.createObjectURL(new Blob([historyCSV(blocks)], { type: 'text/csv;charset=utf-8' }))
  const link = element('a')
  link.href = url
  link.download = 'psi-maze-history-' + dayKey(new Date()) + '.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && active) stopRun(active, 'Run stopped when the app left the screen.')
  if (!document.hidden) refreshHistory()
})
setInterval(() => {
  const today = dayKey(new Date())
  if (today !== previousTrainingDay) {
    previousTrainingDay = today
    showProgress(false)
  }
}, 15_000)

document.addEventListener('keydown', event => {
  if (event.altKey || event.ctrlKey || event.metaKey) return
  if (event.key === 'Escape' || event.key === 'GoBack' || event.key === 'BrowserBack') {
    if (active) stopRun(active, 'Run stopped. Press Start to try again.')
    else if (mode !== 'training') {
      setMode('training', true)
      byId('nav-training').focus()
    } else return
    event.preventDefault()
    return
  }

  const direction = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].indexOf(event.key)
  if (direction === -1) return
  const candidates = [...document.querySelectorAll('button:not(:disabled), summary')].filter(el => el.getClientRects().length)
  const focused = document.activeElement
  if (!candidates.includes(focused)) {
    (mode === 'history' ? byId('nav-history') : start).focus()
    event.preventDefault()
    return
  }
  const origin = focused.getBoundingClientRect()
  const horizontal = direction % 2 === 0
  const sign = direction < 2 ? -1 : 1
  const center = (rect, x) => x ? rect.left + rect.width / 2 : rect.top + rect.height / 2
  let best
  let bestScore = Infinity
  for (const candidate of candidates) {
    if (candidate === focused) continue
    const rect = candidate.getBoundingClientRect()
    const forward = sign * (center(rect, horizontal) - center(origin, horizontal))
    if (forward < 6) continue
    const offset = Math.abs(center(rect, !horizontal) - center(origin, !horizontal))
    const overlap = horizontal
      ? rect.top < origin.bottom && origin.top < rect.bottom
      : rect.left < origin.right && origin.left < rect.right
    const score = forward + offset * (overlap ? .45 : 2.4) + (overlap ? 0 : 25)
    if (score < bestScore) {
      best = candidate
      bestScore = score
    }
  }
  if (best) {
    event.preventDefault()
    best.focus({ preventScroll: true })
    best.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }
})

let installPrompt
window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  installPrompt = event
  byId('install').hidden = false
})
byId('install').onclick = async () => {
  const prompt = installPrompt
  if (!prompt) return
  installPrompt = undefined
  byId('install').hidden = true
  await prompt.prompt()
}
window.addEventListener('appinstalled', () => {
  installPrompt = undefined
  byId('install').hidden = true
})
navigator.serviceWorker?.register('./service-worker.js').catch(error => console.warn('Offline cache:', error))

setMode('training')
refreshHistory()

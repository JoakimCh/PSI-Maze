import { CAPTURE_BATCH_MS, WordCadence, canDeliver } from './word-cadence.js'
import { createRateTest } from './rate-test.js'
import { createCaptureSettings } from './capture-settings.js'
import { createDiagnostics } from './diagnostics.js'
import { drawMaze, mazeForRun, moveInMaze } from './maze.js'
import { drawAppleRun, moveTowardApple, newAppleRun } from './apple.js'
import { direction } from './steering.js'
import { MicrophoneTRNG } from './microphone.js'
import { CATCHES_PER_DAY, DAYS_PER_BLOCK, dayKey, historyCSV, loadRuns, saveRun, summarize, loadPlayers, savePlayer } from './history.js'

const byId = id => document.getElementById(id)
const canvas = byId('arena')
const phoneLayout = matchMedia('(pointer: coarse) and (max-width: 600px), (pointer: coarse) and (max-height: 550px)')
const status = byId('status')
const start = byId('start')
const navigation = ['maze', 'apple', 'history', 'diagnostics', 'advanced', 'players']
const getCaptureSettings = createCaptureSettings(byId('advanced'))
const diagnostics = createDiagnostics(byId('diagnostics'), getCaptureSettings)
const gameModes = { maze: 'Maze', apple: 'Apple Catch' }
const rateTest = createRateTest(byId('advanced'), getCaptureSettings)
const countdown = byId('maze-countdown')
const cancelCountdown = byId('cancel-countdown')
const profileForm = byId('player-form')
const playerName = byId('player-name')
const playerStatus = byId('player-status')
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })
const fullDate = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })
const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit', second: '2-digit' })
const dateFromKey = key => new Date(key + 'T12:00:00')
const seconds = ms => (ms / 1000).toFixed(1) + ' s'
const rateWindow = 5000
const mazeBreak = 5000

let page = 'maze'
let gameMode = 'maze'
let historyMode = 'maze'
let player = { id: 'default', name: 'Player 1' }
let players = [player]
let runs = []
let active
let initialized = false
let editing
let preview
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

function selectedRuns(mode) {
  return runs.filter(run => run.playerId === player.id && run.mode === mode &&
    (mode !== 'apple' || run.kind === 'catch'))
}

function showProgress(renderResults = true) {
  const history = summarize(selectedRuns(historyMode), historyMode)
  const { blocks } = history
  const unavailable = 'Training history is unavailable on this device.'
  const progress = summarize(selectedRuns(gameMode), gameMode)
  const todayCatches = gameMode === 'apple' ? selectedRuns('apple').filter(run => run.day === dayKey(new Date())).length : 0
  const dailyProgress = gameMode === 'apple' && todayCatches < CATCHES_PER_DAY
    ? ' · ' + todayCatches + ' of ' + CATCHES_PER_DAY + ' catches today' : ''
  byId('progress-label').textContent = storageError ? unavailable : progressText(progress) + dailyProgress
  byId('history-progress').textContent = storageError ? unavailable : progressText(history)
  for (const mode of Object.keys(gameModes)) {
    byId('history-' + mode).setAttribute('aria-pressed', String(historyMode === mode))
  }
  byId('export').hidden = !blocks.length
  if (renderResults) renderHistory(blocks)
}

function renderHistory(blocks) {
  const results = byId('results')
  results.replaceChildren()
  if (!blocks.length) {
    const hint = historyMode === 'apple' ? ' Each day needs at least six catches.' : ''
    results.append(element('p', 'Your first results unlock after seven training days.' + hint))
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
      const unit = historyMode === 'apple' ? ' catches' : day.runs.length === 1 ? ' run' : ' runs'
      const description = historyMode === 'apple' ? ' average' : ''
      title.append(
        element('span', fullDate.format(dateFromKey(day.key)) + ' · ' + seconds(day.time) + description),
        element('small', day.runs.length + unit)
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
  showProgress(page === 'history')
}

function appleCount(count) {
  byId('apple-count').textContent = count + (count === 1 ? ' catch' : ' catches')
}

function newBoard() {
  const portrait = phoneLayout.matches
  canvas.toggleAttribute('data-portrait', portrait)
  if (gameMode === 'maze') {
    preview = mazeForRun(selectedRuns('maze').length, portrait)
    drawMaze(canvas, preview)
  } else {
    preview = newAppleRun(portrait)
    drawAppleRun(canvas, preview)
    appleCount(0)
  }
}

function release(run) {
  if (active !== run) return
  active = undefined
  run.mic.stop()
  cancelAnimationFrame(run.frame)
  run.wake?.release().catch(() => {})
  countdown.hidden = true
  start.removeAttribute('data-countdown')
}

function ready(message = 'Press Start to enable the microphone.', showPreview = true) {
  status.textContent = message
  start.textContent = 'Start'
  start.disabled = !initialized
  if (showPreview) newBoard()
}

function stopRun(run, message) {
  if (active !== run) return
  const moveFocus = countdown.contains(document.activeElement)
  release(run)
  preview = undefined
  ready(message, false)
  if (moveFocus) start.focus({ preventScroll: true })
}

function setPage(selected) {
  if (page === selected && initialized) return
  if (active) release(active)
  if (page === 'diagnostics') diagnostics.stop()
  if (page === 'advanced') rateTest.stop()
  page = selected
  for (const name of navigation) {
    const button = byId('nav-' + name)
    if (name === selected) button.setAttribute('aria-current', 'page')
    else button.removeAttribute('aria-current')
  }
  const isGame = selected === 'maze' || selected === 'apple'
  document.body.classList.toggle('game-page', isGame)
  byId('game').hidden = !isGame
  byId('history').hidden = selected !== 'history'
  byId('players').hidden = selected !== 'players'
  byId('diagnostics').hidden = selected !== 'diagnostics'
  byId('advanced').hidden = selected !== 'advanced'
  if (selected === 'diagnostics') diagnostics.prepare()
  if (isGame) {
    gameMode = selected
    byId('game-title').textContent = gameModes[selected]
    byId('apple-count').hidden = gameMode !== 'apple'
    canvas.setAttribute('aria-label', gameMode === 'apple'
      ? 'A yellow dot moves toward a red apple. The arena wraps at every edge.'
      : 'A yellow dot follows a winding blue corridor to a marked finish line.')
    ready()
  }
  if (selected === 'history') {
    historyMode = gameMode
    refreshHistory()
  }
  if (selected === 'players') {
    profileForm.hidden = true
    renderPlayers()
  }
  showProgress(false)
  window.scrollTo(0, 0)
}

async function saveCompletion(run, at) {
  const date = new Date()
  try {
    await saveRun({
      playerId: run.playerId, mode: run.mode, kind: run.mode === 'apple' ? 'catch' : 'maze',
      day: dayKey(date), at: date.getTime(), localTime: timeOfDay.format(date),
      ms: at - run.started, setup: run.setup
    })
    await refreshHistory()
  } catch {
    if (active === run) stopRun(run, 'The result could not be saved. Check browser storage and try again.')
  }
}

function finishMaze(run, at, now) {
  saveCompletion(run, at)
  run.completedMazes++
  run.restartAt = now + mazeBreak
  byId('countdown-number').textContent = '5'
  countdown.hidden = false
  start.setAttribute('data-countdown', '')
  cancelCountdown.focus({ preventScroll: true })
  status.textContent = 'Maze completed.'
}

function newSessionMaze(run, now) {
  const portrait = phoneLayout.matches
  run.board = mazeForRun(run.completedMazes, portrait)
  canvas.toggleAttribute('data-portrait', portrait)
  run.position = 0
  run.started = undefined
  run.velocity = { x: 0, y: 0 }
  run.target = { x: 0, y: 0 }
  run.cadence = new WordCadence(run.rate, now)
  run.nextCheck = now + rateWindow + CAPTURE_BATCH_MS
  delete run.restartAt
  countdown.hidden = true
  start.removeAttribute('data-countdown')
  start.focus({ preventScroll: true })
  drawMaze(canvas, run.board)
  status.textContent = 'Listening for microphone input…'
}

function advanceMotion(run, until, now) {
  while (run.started !== undefined && run.frameAt < until) {
    const delta = Math.min(until - run.frameAt, 50)
    const blend = 1 - Math.exp(-delta / 115)
    run.velocity.x += (run.target.x - run.velocity.x) * blend
    run.velocity.y += (run.target.y - run.velocity.y) * blend
    if (run.mode === 'maze') {
      const moved = moveInMaze(run.board, run.position, run.velocity, delta)
      run.position = moved.position
      if (moved.finishedIn !== undefined) {
        drawMaze(canvas, run.board, run.position)
        finishMaze(run, run.frameAt + moved.finishedIn, now)
        return false
      }
    } else {
      const caughtIn = moveTowardApple(run.board, run.velocity, delta)
      if (caughtIn !== undefined) {
        const at = run.frameAt + caughtIn
        saveCompletion(run, at)
        run.started = at
        appleCount(run.board.caught)
      }
    }
    run.frameAt += delta
  }
  return true
}

function animate(run, now) {
  if (active !== run) return
  run.frame = requestAnimationFrame(time => animate(run, time))
  if (run.restartAt !== undefined) {
    if (now >= run.restartAt) newSessionMaze(run, now)
    else {
      const number = byId('countdown-number')
      const remaining = String(Math.ceil((run.restartAt - now) / 1000))
      if (number.textContent !== remaining) number.textContent = remaining
    }
    return
  }

  if (now >= run.nextCheck) {
    const report = run.cadence.report(now, rateWindow)
    if (!canDeliver(report, run.rate)) {
      const reason = report.wordsPerSecond < run.rate - .4
        ? 'Microphone is supplying ' + report.wordsPerSecond.toFixed(1) + ' words/s.'
        : 'Microphone words are arriving unevenly (' + Math.round(report.coverage * 100) + '% of updates supplied).'
      stopRun(run, reason + ' ' + gameModes[run.mode] + ' is set to ' + run.rate +
        ' words/s. Lower the rate or sample discard in Advanced.')
      return
    }
    run.nextCheck = now + 1000
  }

  for (const update of run.cadence.take(now)) {
    if (!advanceMotion(run, update.at, now)) return
    run.target = update.word === undefined ? { x: 0, y: 0 } : direction(update.word)
    if (update.word !== undefined && run.started === undefined) {
      run.started = update.at
      run.frameAt = update.at
      status.textContent = 'Run in progress'
      start.textContent = 'Stop'
    }
  }

  if (run.started === undefined || !advanceMotion(run, now, now)) return
  if (run.mode === 'maze') drawMaze(canvas, run.board, run.position)
  else drawAppleRun(canvas, run.board)
}

function startRun() {
  if (active) {
    stopRun(active, 'Session stopped. Press Start to play again.')
    return
  }
  if (initialized) launchRun()
}

cancelCountdown.onclick = () => {
  if (active) stopRun(active, 'Session stopped. Press Start to play again.')
}

async function launchRun() {
  if (!preview || gameMode === 'apple') newBoard()
  const settings = getCaptureSettings()
  const run = {
    mic: new MicrophoneTRNG(), position: 0, velocity: { x: 0, y: 0 }, target: { x: 0, y: 0 },
    mode: gameMode, playerId: player.id, board: preview, rate: settings.rates[gameMode],
    completedMazes: selectedRuns('maze').length
  }
  active = run
  start.textContent = 'Cancel'
  status.textContent = 'Waiting for microphone access…'
  try {
    await run.mic.start((word, setup) => {
      if (active !== run || !run.cadence || run.restartAt !== undefined) return
      run.setup ??= setup
      run.cadence.add(word, performance.now())
    }, message => stopRun(run, message), {
      ...settings,
      onCapture() {
        if (active !== run) return
        const now = performance.now()
        run.cadence = new WordCadence(run.rate, now)
        run.nextCheck = now + rateWindow + CAPTURE_BATCH_MS
        start.textContent = 'Stop'
        status.textContent = 'Listening for microphone input…'
        run.frame = requestAnimationFrame(time => animate(run, time))
      }
    })
    if (active !== run) return
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

function rememberPlayer(id) {
  try { localStorage.setItem('psi-maze-player', id) } catch {}
}

function updatePlayerButton() {
  const button = byId('nav-players')
  button.textContent = player.name
  button.setAttribute('aria-label', 'Switch player. Current player: ' + player.name)
}

function selectPlayer(id) {
  const selected = players.find(candidate => candidate.id === id)
  if (!selected) return
  player = selected
  rememberPlayer(id)
  updatePlayerButton()
  setPage(gameMode)
  byId('nav-' + gameMode).focus({ preventScroll: true })
}

function renderPlayers() {
  const list = byId('player-list')
  list.replaceChildren()
  const sorted = players.slice().sort((a, b) => a.name.localeCompare(b.name))
  for (const profile of sorted) {
    const button = element('button', profile.name, 'secondary')
    if (profile.id === player.id) button.setAttribute('aria-current', 'true')
    button.onclick = () => selectPlayer(profile.id)
    list.append(button)
  }
}

function editPlayer(profile) {
  editing = profile
  playerStatus.textContent = ''
  profileForm.hidden = false
  playerName.value = profile?.name ?? ''
  playerName.focus()
}

byId('add-player').onclick = () => editPlayer()
byId('rename-player').onclick = () => editPlayer(player)
byId('cancel-player-form').onclick = () => {
  profileForm.hidden = true
  byId(editing ? 'rename-player' : 'add-player').focus()
}
profileForm.onsubmit = async event => {
  event.preventDefault()
  const name = playerName.value.trim()
  if (!name) {
    playerStatus.textContent = 'Enter a player name.'
    return
  }
  const submit = profileForm.querySelector('button.primary')
  submit.disabled = true
  try {
    const id = await savePlayer(editing?.id, name)
    players = await loadPlayers()
    profileForm.hidden = true
    playerStatus.textContent = ''
    if (page === 'players') selectPlayer(id)
  } catch (error) {
    playerStatus.textContent = error?.name === 'ConstraintError'
      ? 'That player name is already in use.'
      : 'Could not save the player.'
  } finally {
    submit.disabled = false
  }
}

for (const name of navigation) byId('nav-' + name).onclick = () => setPage(name)
for (const name of Object.keys(gameModes)) {
  byId('history-' + name).onclick = () => {
    historyMode = name
    showProgress()
  }
}
start.onclick = startRun
byId('export').onclick = () => {
  const { blocks } = summarize(selectedRuns(historyMode), historyMode)
  if (!blocks.length) return
  const url = URL.createObjectURL(new Blob([historyCSV(blocks, gameModes[historyMode], player.name)], { type: 'text/csv;charset=utf-8' }))
  const link = element('a')
  link.href = url
  link.download = 'psi-maze-' + historyMode + '-' + dayKey(new Date()) + '.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && active) stopRun(active, 'Run stopped when the app left the screen.')
  if (document.hidden) {
    diagnostics.stop('Test stopped when the app left the screen.')
    rateTest.stop('Test stopped when the app left the screen.')
  } else refreshHistory()
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
    if (page === 'diagnostics' && diagnostics.stop()) {
      byId('diag-start').focus()
    } else if (page === 'advanced' && rateTest.stop()) {
      byId('advanced-test').focus()
    } else if (active) stopRun(active, 'Session stopped. Press Start to play again.')
    else if (page === 'players' && !profileForm.hidden) {
      byId('cancel-player-form').click()
    } else if (page !== 'maze') {
      setPage(page === 'apple' ? 'maze' : gameMode)
      byId('nav-' + page).focus()
    } else return
    event.preventDefault()
    return
  }

  const direction = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'].indexOf(event.key)
  if (direction === -1) return
  const focused = document.activeElement
  if ((focused === playerName || focused?.type === 'range') && direction % 2 === 0) return
  const candidates = [...document.querySelectorAll('button:not(:disabled), summary, input')].filter(el => el.getClientRects().length)
  if (!candidates.includes(focused)) {
    (byId('game').hidden || start.disabled ? byId('nav-' + page) : start).focus()
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

async function initialize() {
  try {
    players = await loadPlayers()
    const lastPlayer = localStorage.getItem('psi-maze-player')
    player = players.find(candidate => candidate.id === lastPlayer) ?? players[0]
  } catch {
    storageError = true
  }
  updatePlayerButton()
  await refreshHistory()
  initialized = true
  if (!byId('game').hidden) ready()
  if (page === 'players') renderPlayers()
}
phoneLayout.addEventListener('change', () => {
  if (page === gameMode && preview && !active) newBoard()
})
setPage('maze')
initialize()

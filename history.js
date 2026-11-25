export const DAYS_PER_BLOCK = 7

export function dayKey(date) {
  const part = n => String(n).padStart(2, '0')
  return [date.getFullYear(), part(date.getMonth() + 1), part(date.getDate())].join('-')
}

export function median(values) {
  const sorted = values.slice().sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function summarize(runs, mode) {
  const days = new Map()
  for (const run of runs.slice().sort((a, b) => a.at - b.at)) {
    if (!days.has(run.day)) days.set(run.day, { key: run.day, runs: [] })
    days.get(run.day).runs.push(run)
  }
  const ordered = [...days.values()].sort((a, b) => a.key.localeCompare(b.key))
  const blocks = []
  while (ordered.length >= DAYS_PER_BLOCK) {
    const days = ordered.splice(0, DAYS_PER_BLOCK).map(day => ({
      ...day,
      time: mode === 'apple'
        ? day.runs.reduce((sum, run) => sum + run.ms, 0) / day.runs.length
        : median(day.runs.map(run => run.ms))
    }))
    const setups = [...new Map(days.flatMap(day => day.runs.map(run => [run.setup.signature, run.setup]))).values()]
    blocks.push({ days, setups, time: median(days.map(day => day.time)) })
  }
  return { blocks, pending: ordered }
}

let database
function openDatabase() {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open('psi-maze', 2)
    request.onupgradeneeded = event => {
      const db = request.result
      if (event.oldVersion === 0) db.createObjectStore('runs', { keyPath: 'id', autoIncrement: true })
      if (event.oldVersion < 2) {
        const profiles = db.createObjectStore('players', { keyPath: 'id' })
        profiles.createIndex('nameKey', 'nameKey', { unique: true })
        profiles.add({ id: 'default', name: 'Player 1', nameKey: 'player 1' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  }).catch(error => {
    database = undefined
    throw error
  })
  return database
}

async function access(storeName, mode, action) {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode)
    const request = action(transaction.objectStore(storeName))
    transaction.oncomplete = () => resolve(request.result)
    transaction.onabort = () => reject(transaction.error)
  })
}

export const loadRuns = () => access('runs', 'readonly', store => store.getAll())
export const saveRun = run => access('runs', 'readwrite', store => store.add(run))

export const loadPlayers = () => access('players', 'readonly', store => store.getAll())

export function savePlayer(id, name) {
  const player = { id: id ?? crypto.randomUUID(), name, nameKey: name.toLowerCase() }
  return access('players', 'readwrite', store => id ? store.put(player) : store.add(player))
}

export function historyCSV(blocks, mode, player) {
  const quote = value => '"' + String(value).replaceAll('"', '""') + '"'
  const rows = [['mode', 'player', 'block', 'local_day', 'completed_at_iso', 'elapsed_ms', 'microphone', 'sample_rate_hz', 'rules']]
  const safeCell = value => /^[=+@\-\t\r\n]/.test(value) ? "'" + value : value
  blocks.forEach((block, i) => block.days.forEach(day => day.runs.forEach(run => {
    // Avoid formula interpretation when opening exports in spreadsheets.
    rows.push([mode, safeCell(player), i + 1, day.key, new Date(run.at).toISOString(), Math.round(run.ms),
      safeCell(run.setup.label), run.setup.rate, run.setup.rules])
  })))
  return rows.map(row => row.map(quote).join(',')).join('\r\n') + '\r\n'
}

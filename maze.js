export const COLUMNS = 18
export const ROWS = 10
export const DISTANCE = COLUMNS * ROWS - 1

function onEdge(cell) {
  const x = cell % COLUMNS
  return x === 0 || x === COLUMNS - 1 || cell < COLUMNS || cell >= COLUMNS * (ROWS - 1)
}

function neighbors(cell) {
  const x = cell % COLUMNS
  return [
    x > 0 ? cell - 1 : -1,
    x < COLUMNS - 1 ? cell + 1 : -1,
    cell >= COLUMNS ? cell - COLUMNS : -1,
    cell < COLUMNS * (ROWS - 1) ? cell + COLUMNS : -1
  ].filter(candidate => candidate >= 0)
}

export function generateMaze(random = Math.random) {
  // Rewire one endpoint at a time. Reversing that portion of the path
  // preserves every grid cell, every connection being one cell long.
  let path = Array.from({ length: DISTANCE + 1 }, (_, i) =>
    Math.floor(i / COLUMNS) % 2 === 0 ? i : i + COLUMNS - 1 - 2 * (i % COLUMNS))
  let best = path
  let bestTurns = 0
  for (let step = 0; step < 1200; step++) {
    const fromStart = random() < 0.5
    const end = fromStart ? path[0] : path.at(-1)
    const next = fromStart ? path[1] : path.at(-2)
    const choices = neighbors(end).filter(cell => cell !== next)
    const pivot = path.indexOf(choices[Math.floor(random() * choices.length)])
    path = fromStart
      ? path.slice(0, pivot).reverse().concat(path.slice(pivot))
      : path.slice(0, pivot + 1).concat(path.slice(pivot + 1).reverse())
    if (step < 350 || !onEdge(path[0]) || !onEdge(path.at(-1))) continue
    const turns = path.slice(2).reduce((count, cell, i) =>
      count + Number(cell - path[i + 1] !== path[i + 1] - path[i]), 0)
    if (turns > bestTurns) {
      best = path
      bestTurns = turns
    }
  }
  return best
}

export function targetSpeed(word) {
  let ones = 0
  for (let bits = word >>> 0; bits; bits = (bits & (bits - 1)) >>> 0) ones++
  return 2.2 + Math.abs(2 * ones - 32) * 0.95
}

const cell = 40
const pad = 14
const x = index => pad + index % COLUMNS * cell
const y = index => pad + Math.floor(index / COLUMNS) * cell
const backgrounds = new WeakMap()

function drawBackground(canvas, path) {
  const ctx = canvas.getContext('2d')
  const endpoints = [path[0], path.at(-1)]
  // Open one exterior wall at the entrance and one at the exit.
  const edge = index => index % COLUMNS === 0 ? 'left'
    : index % COLUMNS === COLUMNS - 1 ? 'right'
      : index < COLUMNS ? 'top' : 'bottom'
  const gaps = new Map(endpoints.map(index => [index, edge(index)]))
  const openings = new Set()
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    openings.add(Math.min(a, b) * 2 + Number(Math.abs(a - b) === COLUMNS))
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#020305'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  for (let i = 0; i < path.length; i++) {
    const left = x(i)
    const top = y(i)
    if (i % COLUMNS === 0 && gaps.get(i) !== 'left') {
      ctx.moveTo(left, top)
      ctx.lineTo(left, top + cell)
    }
    if (i < COLUMNS && gaps.get(i) !== 'top') {
      ctx.moveTo(left, top)
      ctx.lineTo(left + cell, top)
    }
    if (!openings.has(i * 2) && gaps.get(i) !== 'right') {
      ctx.moveTo(left + cell, top)
      ctx.lineTo(left + cell, top + cell)
    }
    if (!openings.has(i * 2 + 1) && gaps.get(i) !== 'bottom') {
      ctx.moveTo(left, top + cell)
      ctx.lineTo(left + cell, top + cell)
    }
  }
  ctx.strokeStyle = '#3479ed'
  ctx.lineWidth = 3
  ctx.lineCap = 'square'
  ctx.stroke()

  const end = path.at(-1)
  const delta = end - path.at(-2)
  ctx.save()
  ctx.translate(x(end) + cell / 2, y(end) + cell / 2)
  if (Math.abs(delta) === 1) ctx.rotate(Math.PI / 2)
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 6; col++) {
      ctx.fillStyle = (row + col) % 2 ? '#553f07' : '#ffe275'
      ctx.fillRect(-15 + col * 5, -5 + row * 5, 5, 5)
    }
  }
  ctx.restore()
}

export function drawMaze(canvas, path, progress, finished) {
  let background = backgrounds.get(path)
  if (!background) {
    background = document.createElement('canvas')
    background.width = canvas.width
    background.height = canvas.height
    drawBackground(background, path)
    backgrounds.set(path, background)
  }
  const ctx = canvas.getContext('2d')
  ctx.drawImage(background, 0, 0)
  const step = Math.floor(progress)
  const fraction = progress - step
  const current = path[step]
  const next = path[Math.min(step + 1, DISTANCE)]
  const dotX = x(current) + cell / 2 + (x(next) - x(current)) * fraction
  const dotY = y(current) + cell / 2 + (y(next) - y(current)) * fraction
  ctx.beginPath()
  ctx.arc(dotX, dotY, finished ? 11 : 9, 0, Math.PI * 2)
  ctx.fillStyle = '#ffe04e'
  ctx.shadowBlur = 14
  ctx.shadowColor = '#ffc529'
  ctx.fill()
  ctx.shadowBlur = 0
}

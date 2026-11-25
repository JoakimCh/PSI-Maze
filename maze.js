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

export function mazeForRun(completed) {
  const rotation = completed % 4
  let columns = COLUMNS
  let rows = ROWS
  let path = generateMaze()
  const first = path[0]
  const toTop = first < COLUMNS ? 0
    : first % COLUMNS === COLUMNS - 1 ? 3
      : first >= COLUMNS * (ROWS - 1) ? 2 : 1
  for (let turn = 0; turn < (toTop + rotation) % 4; turn++) {
    path = path.map(index => (index % columns) * rows + rows - 1 - Math.floor(index / columns))
    const previousColumns = columns
    columns = rows
    rows = previousColumns
  }
  return { path, columns, rows, side: ['top', 'right', 'bottom', 'left'][rotation] }
}

export function moveInMaze(maze, position, velocity, milliseconds) {
  const { path, columns } = maze
  let remaining = milliseconds
  while (position < DISTANCE && remaining > 0) {
    const step = Math.floor(position)
    const from = path[step]
    const to = path[step + 1]
    const x = to % columns - from % columns
    const y = Math.floor(to / columns) - Math.floor(from / columns)
    const speed = (x * velocity.x + y * velocity.y) * 31 / 1000
    if (speed <= 0) return { position }
    const timeToNext = (step + 1 - position) / speed
    if (remaining < timeToNext) return { position: position + speed * remaining }
    position = step + 1
    remaining -= timeToNext
  }
  return { position, finishedIn: position === DISTANCE ? milliseconds - remaining : undefined }
}

const cell = 40
const pad = 14
const backgrounds = new WeakMap()

function drawBackground(canvas, maze) {
  const { path, columns, rows, side } = maze
  const ctx = canvas.getContext('2d')
  const x = index => pad + index % columns * cell
  const y = index => pad + Math.floor(index / columns) * cell
  const end = path.at(-1)
  const endSide = end % columns === 0 ? 'left'
    : end % columns === columns - 1 ? 'right'
      : end < columns ? 'top' : 'bottom'
  const gaps = new Map([[path[0], side], [end, endSide]])
  const openings = new Set()
  for (let i = 1; i < path.length; i++) {
    const a = path[i - 1]
    const b = path[i]
    openings.add(Math.min(a, b) * 2 + Number(Math.abs(a - b) === columns))
  }

  ctx.fillStyle = '#020305'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.beginPath()
  for (let i = 0; i < path.length; i++) {
    const left = x(i)
    const top = y(i)
    if (i % columns === 0 && gaps.get(i) !== 'left') {
      ctx.moveTo(left, top)
      ctx.lineTo(left, top + cell)
    }
    if (i < columns && gaps.get(i) !== 'top') {
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

export function drawDot(ctx, x, y, radius, color, glow) {
  ctx.beginPath()
  ctx.arc(x, y, radius, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.shadowBlur = 14
  ctx.shadowColor = glow
  ctx.fill()
  ctx.shadowBlur = 0
}

export function drawMaze(canvas, maze, progress = 0) {
  const { path, columns, rows } = maze
  let background = backgrounds.get(maze)
  if (!background) {
    background = document.createElement('canvas')
    background.width = columns * cell + pad * 2
    background.height = rows * cell + pad * 2
    drawBackground(background, maze)
    backgrounds.set(maze, background)
  }
  if (canvas.width !== background.width || canvas.height !== background.height) {
    canvas.width = background.width
    canvas.height = background.height
  }
  const ctx = canvas.getContext('2d')
  ctx.drawImage(background, 0, 0)
  const step = Math.floor(progress)
  const fraction = progress - step
  const current = path[step]
  const next = path[Math.min(step + 1, DISTANCE)]
  const x = current % columns + (next % columns - current % columns) * fraction
  const y = Math.floor(current / columns) + (Math.floor(next / columns) - Math.floor(current / columns)) * fraction
  drawDot(ctx, pad + (x + .5) * cell, pad + (y + .5) * cell, progress === DISTANCE ? 11 : 9, '#ffe04e', '#ffc529')
}

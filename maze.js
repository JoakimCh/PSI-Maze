export const COLUMNS = 15
export const ROWS = 12
export const DISTANCE = COLUMNS * ROWS - 1

function neighbors(cell, columns, rows) {
  const x = cell % columns
  return [
    x > 0 ? cell - 1 : -1,
    x < columns - 1 ? cell + 1 : -1,
    cell >= columns ? cell - columns : -1,
    cell < columns * (rows - 1) ? cell + columns : -1
  ].filter(candidate => candidate >= 0)
}

function pathScore(path) {
  let score = 0
  let straight = 1
  for (let i = 2; i < path.length; i++) {
    if (path[i] - path[i - 1] === path[i - 1] - path[i - 2]) {
      straight++
    } else {
      score += 1 - 3 * Math.max(0, straight - 5) ** 2
      straight = 1
    }
  }
  return score - 3 * Math.max(0, straight - 5) ** 2
}

function mazePath(columns, rows, side) {
  const edges = [
    cell => Math.floor(cell / columns),
    cell => columns - 1 - cell % columns,
    cell => rows - 1 - Math.floor(cell / columns),
    cell => cell % columns
  ]
  const startDistance = edges[side]
  const endDistance = edges[(side + 2) % 4]

  // Seed with a valid winding path, then rewire its endpoints without
  // changing the grid dimensions or the number of steps.
  const acrossRows = side % 2 === 0
  const span = acrossRows ? columns : rows
  let path = Array.from({ length: columns * rows }, (_, i) => {
    const lane = Math.floor(i / span)
    const offset = lane % 2 === 0 ? i % span : span - 1 - i % span
    return acrossRows ? lane * columns + offset : offset * columns + lane
  })
  if (startDistance(path[0]) !== 0) path.reverse()

  let best = path
  let bestScore = pathScore(path)
  for (let step = 0; step < 24000; step++) {
    if (step && step % 2400 === 0) path = best
    const fromStart = Math.random() < 0.5
    const end = fromStart ? path[0] : path.at(-1)
    const next = fromStart ? path[1] : path.at(-2)
    const choices = neighbors(end, columns, rows).filter(cell => cell !== next)
    const pivot = path.indexOf(choices[Math.floor(Math.random() * choices.length)])
    const edgeDistance = fromStart ? startDistance : endDistance
    const newEndpoint = path[fromStart ? pivot - 1 : pivot + 1]
    // Favor moves near the requested edges while still exploring the interior.
    if (edgeDistance(newEndpoint) > edgeDistance(end) && Math.random() < .8) continue
    path = fromStart
      ? path.slice(0, pivot).reverse().concat(path.slice(pivot))
      : path.slice(0, pivot + 1).concat(path.slice(pivot + 1).reverse())
    if (step < 350 || startDistance(path[0]) !== 0 || endDistance(path.at(-1)) !== 0) continue
    const score = pathScore(path)
    if (score > bestScore) {
      best = path
      bestScore = score
    }
  }
  return best
}

export function mazeForRun(completed, portrait = false) {
  const sides = ['top', 'right', 'bottom', 'left']
  const side = completed % sides.length
  const columns = portrait ? ROWS : COLUMNS
  const rows = portrait ? COLUMNS : ROWS
  return {
    path: mazePath(columns, rows, side),
    columns,
    rows,
    side: sides[side],
    endSide: sides[(side + 2) % sides.length]
  }
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
  const { path, columns, side, endSide } = maze
  const ctx = canvas.getContext('2d')
  const x = index => pad + index % columns * cell
  const y = index => pad + Math.floor(index / columns) * cell
  const end = path.at(-1)
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

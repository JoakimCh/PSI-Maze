import { COLUMNS, ROWS, CELL_SIZE, drawDot } from './maze.js'

const spawnDistance = 3.8
const catchRadius = .57
const pad = 14

const wrap = (value, size) => ((value % size) + size) % size
const nearest = (delta, size) => wrap(delta + size / 2, size) - size / 2

function spawnApple({ x, y, width, height }) {
  const angle = Math.random() * Math.PI * 2
  return {
    x: wrap(x + Math.cos(angle) * spawnDistance, width),
    y: wrap(y + Math.sin(angle) * spawnDistance, height)
  }
}

export function newAppleRun(portrait = false) {
  const width = portrait ? ROWS : COLUMNS
  const height = portrait ? COLUMNS : ROWS
  const game = { x: width / 2, y: height / 2, width, height, caught: 0 }
  return { ...game, target: spawnApple(game) }
}

export function moveTowardApple(game, pixels) {
  const { width, height } = game
  const dx = pixels.x / CELL_SIZE
  const dy = pixels.y / CELL_SIZE
  const tx = nearest(game.target.x - game.x, width)
  const ty = nearest(game.target.y - game.y, height)
  const stepSquared = dx * dx + dy * dy
  if (!stepSquared) return false

  // Find the nearest point on the step, including a step across a seam.
  const fraction = Math.max(0, Math.min(1, (tx * dx + ty * dy) / stepSquared))
  const caught = Math.hypot(tx - dx * fraction, ty - dy * fraction) <= catchRadius
  game.x = wrap(game.x + dx, width)
  game.y = wrap(game.y + dy, height)
  if (caught) {
    game.caught++
    game.target = spawnApple(game)
  }
  return caught
}

export function interpolateAppleStep(game, from, fraction) {
  const { width, height } = game
  return {
    x: wrap(from.x + nearest(game.x - from.x, width) * fraction, width),
    y: wrap(from.y + nearest(game.y - from.y, height) * fraction, height)
  }
}

function wrappedDot(ctx, { x, y }, { width, height }, radius, color, glow) {
  const margin = .45
  const xs = x < margin ? [x, x + width] : x > width - margin ? [x, x - width] : [x]
  const ys = y < margin ? [y, y + height] : y > height - margin ? [y, y - height] : [y]
  for (const a of xs) {
    for (const b of ys) drawDot(ctx, pad + a * CELL_SIZE, pad + b * CELL_SIZE, radius, color, glow)
  }
}

export function drawAppleRun(canvas, game, dot = game) {
  const { width, height } = game
  const w = width * CELL_SIZE + pad * 2
  const h = height * CELL_SIZE + pad * 2
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w
    canvas.height = h
  }
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#020305'
  ctx.fillRect(0, 0, w, h)
  ctx.strokeStyle = '#3479ed'
  ctx.lineWidth = 3
  ctx.setLineDash([7, 8])
  ctx.strokeRect(pad, pad, width * CELL_SIZE, height * CELL_SIZE)
  ctx.setLineDash([])
  ctx.save()
  ctx.beginPath()
  ctx.rect(pad, pad, width * CELL_SIZE, height * CELL_SIZE)
  ctx.clip()
  wrappedDot(ctx, game.target, game, 11, '#ff493f', '#e13a37')
  wrappedDot(ctx, dot, game, 9, '#ffe04e', '#ffc529')
  ctx.restore()
}

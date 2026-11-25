import { drawDot } from './maze.js'

const width = 18
const height = 10
const spawnDistance = 3.8
const catchRadius = .57
const cell = 40
const pad = 14
export const APPLES_PER_RUN = 5

const wrap = (value, size) => ((value % size) + size) % size
const nearest = (delta, size) => wrap(delta + size / 2, size) - size / 2

export function spawnApple(x, y, random = Math.random) {
  const angle = random() * Math.PI * 2
  return {
    x: wrap(x + Math.cos(angle) * spawnDistance, width),
    y: wrap(y + Math.sin(angle) * spawnDistance, height)
  }
}

export function newAppleRun() {
  const x = width / 2
  const y = height / 2
  return { x, y, target: spawnApple(x, y), caught: 0 }
}

export function moveTowardApple(game, velocity, milliseconds) {
  const speed = 19
  const magnitude = Math.hypot(velocity.x, velocity.y)
  const scale = magnitude > 1.2 ? 1.2 / magnitude : 1
  const dx = velocity.x * speed * scale * milliseconds / 1000
  const dy = velocity.y * speed * scale * milliseconds / 1000
  const tx = nearest(game.target.x - game.x, width)
  const ty = nearest(game.target.y - game.y, height)
  const stepSquared = dx * dx + dy * dy
  // Test the whole movement segment, including a hit reached across a seam.
  if (stepSquared > 0) {
    const along = tx * dx + ty * dy
    const offset = tx * tx + ty * ty - catchRadius * catchRadius
    const discriminant = along * along - stepSquared * offset
    if (discriminant >= 0) {
      const fraction = (along - Math.sqrt(discriminant)) / stepSquared
      if (fraction >= 0 && fraction <= 1) {
        game.x = wrap(game.x + dx * fraction, width)
        game.y = wrap(game.y + dy * fraction, height)
        game.caught++
        if (game.caught === APPLES_PER_RUN) return milliseconds * fraction
        game.target = spawnApple(game.x, game.y)
        return
      }
    }
  }
  game.x = wrap(game.x + dx, width)
  game.y = wrap(game.y + dy, height)
}

function wrappedDot(ctx, x, y, radius, color, glow) {
  const margin = .45
  const xs = x < margin ? [x, x + width] : x > width - margin ? [x, x - width] : [x]
  const ys = y < margin ? [y, y + height] : y > height - margin ? [y, y - height] : [y]
  for (const a of xs) {
    for (const b of ys) drawDot(ctx, pad + a * cell, pad + b * cell, radius, color, glow)
  }
}

export function drawAppleRun(canvas, game) {
  const w = width * cell + pad * 2
  const h = height * cell + pad * 2
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
  ctx.strokeRect(pad, pad, width * cell, height * cell)
  ctx.setLineDash([])
  ctx.save()
  ctx.beginPath()
  ctx.rect(pad, pad, width * cell, height * cell)
  ctx.clip()
  if (game.caught < APPLES_PER_RUN) wrappedDot(ctx, game.target.x, game.target.y, 11, '#ff493f', '#e13a37')
  wrappedDot(ctx, game.x, game.y, 9, '#ffe04e', '#ffc529')
  ctx.restore()
}

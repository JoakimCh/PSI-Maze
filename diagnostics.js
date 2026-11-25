import { MicrophoneTRNG } from './microphone.js'
import { countSetBits } from './steering.js'

const percent = (value, total) => total ? (100 * value / total).toFixed(1) + '%' : '—'
const decibels = level => level > 0 ? (20 * Math.log10(level)).toFixed(1) + ' dBFS' : '−∞ dBFS'
const trackFlag = value => {
  if (typeof value === 'string') return 'On (' + value + ')'
  return typeof value === 'boolean' ? (value ? 'On' : 'Off') : 'Not reported'
}
const discardChoices = [0, .5, .75, .9, .95]

export function bitBalance(ones, bits) {
  const expected = bits / 2
  const sigma = Math.sqrt(bits) / 2
  return { expected, sigma, z: bits ? (ones - expected) / sigma : null }
}

function drawBalance(canvas, z) {
  const ctx = canvas.getContext('2d')
  const { width, height } = canvas
  const limit = 4
  const left = 36
  const right = width - left
  const top = 12
  const bottom = height - 35
  const x = score => left + (score + limit) * (right - left) / (2 * limit)
  ctx.clearRect(0, 0, width, height)

  ctx.beginPath()
  ctx.moveTo(left, bottom)
  for (let i = 0; i <= 100; i++) {
    const value = -limit + (2 * limit * i) / 100
    ctx.lineTo(x(value), bottom - (bottom - top) * Math.exp(-value * value / 2))
  }
  ctx.lineTo(right, bottom)
  ctx.closePath()
  ctx.fillStyle = '#172f55'
  ctx.fill()
  ctx.strokeStyle = '#74aaf0'
  ctx.lineWidth = 2
  ctx.stroke()

  ctx.font = '20px system-ui'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#b5c2db'
  ctx.lineWidth = 1
  for (const tick of [-4, -2, 0, 2, 4]) {
    ctx.strokeStyle = tick === 0 ? '#7e91b3' : '#364664'
    ctx.beginPath()
    ctx.moveTo(x(tick), top)
    ctx.lineTo(x(tick), bottom)
    ctx.stroke()
    ctx.fillText(tick === 0 ? '0' : (tick > 0 ? '+' : '−') + Math.abs(tick) + 'σ', x(tick), height - 8)
  }

  if (z !== null) {
    const point = x(Math.max(-limit, Math.min(limit, z)))
    ctx.strokeStyle = '#ffe04e'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(point, top)
    ctx.lineTo(point, bottom)
    ctx.stroke()
  }
}

export function createDiagnostics(section) {
  const get = id => section.querySelector('#diag-' + id)
  const start = get('start')
  const processing = get('processing')
  const discard = get('discard')
  const status = get('status')
  const chart = get('balance-chart')
  const fields = [...section.querySelectorAll('[data-diagnostic]')]
  let run
  let discardIndex = 0
  drawBalance(chart, null)

  function showBalance({ ones, bits }) {
    if (!bits) return
    const { expected, sigma, z } = bitBalance(ones, bits)
    get('ones').textContent = ones.toLocaleString() + ' / ' + bits.toLocaleString()
    get('expected').textContent = expected.toLocaleString() + ' ones'
    get('sigma').textContent = sigma.toFixed(2) + ' bits'
    get('z').textContent = (z > 0 ? '+' : '') + z.toFixed(2) + 'σ'
    drawBalance(chart, z)
  }

  function stop(message = 'Test stopped.') {
    if (!run) return false
    run.mic.stop()
    showBalance(run)
    run = undefined
    start.textContent = 'Start test'
    processing.disabled = false
    discard.disabled = false
    status.textContent = message
    return true
  }

  function report(data) {
    get('words').textContent = (data.words / data.seconds).toFixed(1) + ' / s'
    get('rejected').textContent = (data.rejectedBlocks / data.seconds).toFixed(1) + ' / s'
    get('rms').textContent = data.samples ? decibels(Math.sqrt(data.sumSquares / data.samples)) : '—'
    get('peak').textContent = data.samples ? decibels(data.peak) : '—'
    get('zero').textContent = percent(data.zeroSamples, data.samples)
    get('skipped').textContent = percent(data.skippedSamples, data.samples)
    get('ties').textContent = percent(data.ties, data.pairs)
    get('missing').textContent = (data.missingQuanta / data.seconds).toFixed(1) + ' / s'
    get('budget').textContent = data.samplesToUse + ' of ' + data.blockSize
  }

  async function launch() {
    if (stop()) return
    const current = { mic: new MicrophoneTRNG(), bits: 0, ones: 0 }
    const disableProcessing = processing.getAttribute('aria-pressed') === 'true'
    run = current
    start.textContent = 'Cancel'
    processing.disabled = true
    discard.disabled = true
    status.textContent = 'Waiting for microphone access…'
    fields.forEach(field => { field.textContent = '—' })
    drawBalance(chart, null)
    const fail = message => { if (run === current) stop(message) }

    try {
      await current.mic.start(word => {
        current.bits += 32
        current.ones += countSetBits(word)
      }, fail, {
        disableProcessing,
        discardFactor: discardChoices[discardIndex],
        onDiagnostics: data => {
          if (run !== current) return
          report(data)
          showBalance(current)
        },
        onCapture: (setup, settings) => {
          if (run !== current) return
          get('mic').textContent = setup.label
          get('rates').textContent = (settings.sampleRate ? settings.sampleRate + ' Hz' : 'Not reported') +
            ' / ' + setup.rate + ' Hz'
          get('noise').textContent = trackFlag(settings.noiseSuppression)
          get('echo').textContent = trackFlag(settings.echoCancellation)
          get('gain').textContent = trackFlag(settings.autoGainControl)
          start.textContent = 'Stop test'
          status.textContent = disableProcessing
            ? 'Testing with processing off requested'
            : 'Testing with browser defaults'
        }
      })
    } catch (error) {
      const message = error.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in the browser and try again.'
        : error.name === 'NotFoundError' ? 'No microphone found.' : error.message
      fail(message || 'The microphone could not start.')
    }
  }

  processing.onclick = () => {
    const enabled = processing.getAttribute('aria-pressed') === 'true'
    processing.setAttribute('aria-pressed', String(!enabled))
    processing.textContent = enabled ? 'Processing: browser defaults' : 'Processing: request off'
  }
  discard.onclick = () => {
    discardIndex = (discardIndex + 1) % discardChoices.length
    discard.textContent = 'Sample discard: ' + percent(discardChoices[discardIndex], 1).replace('.0%', '%')
  }
  start.onclick = launch
  return { stop }
}

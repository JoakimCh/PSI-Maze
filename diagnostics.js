import { MicrophoneTRNG } from './microphone.js'

const percent = (value, total) => total ? (100 * value / total).toFixed(1) + '%' : '—'
const decibels = level => level > 0 ? (20 * Math.log10(level)).toFixed(1) + ' dBFS' : '−∞ dBFS'
const trackFlag = value => {
  if (typeof value === 'string') return 'On (' + value + ')'
  return typeof value === 'boolean' ? (value ? 'On' : 'Off') : 'Not reported'
}
const discardChoices = [0, .5, .75, .9, .95]

export function createDiagnostics(section) {
  const get = id => section.querySelector('#diag-' + id)
  const start = get('start')
  const processing = get('processing')
  const discard = get('discard')
  const status = get('status')
  const fields = [...section.querySelectorAll('[data-diagnostic]')]
  let run
  let discardIndex = 0

  function stop(message = 'Test stopped.') {
    if (!run) return false
    run.mic.stop()
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
    const current = { mic: new MicrophoneTRNG() }
    const disableProcessing = processing.getAttribute('aria-pressed') === 'true'
    run = current
    start.textContent = 'Cancel'
    processing.disabled = true
    discard.disabled = true
    status.textContent = 'Waiting for microphone access…'
    fields.forEach(field => { field.textContent = '—' })
    const fail = message => { if (run === current) stop(message) }

    try {
      await current.mic.start(undefined, fail, {
        disableProcessing,
        discardFactor: discardChoices[discardIndex],
        onDiagnostics: data => { if (run === current) report(data) },
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

import { DEFAULT_BLOCKS_PER_SECOND, trngPlan } from './trng-config.js'

export const PROCESSING_FLAGS = [
  ['noiseSuppression', 'Noise suppression'],
  ['echoCancellation', 'Echo cancellation'],
  ['autoGainControl', 'Automatic gain control']
]
export const DISCARD_CHOICES = [0, .5, .75, .9, .95]
export const DEFAULT_DISCARD_FACTOR = .9
const defaultWordRate = 24
const maxSteeringRate = 4096
const storageKey = 'psi-maze-capture'
const defaultProcessing = Object.freeze(Object.fromEntries(PROCESSING_FLAGS.map(([key]) => [key, false])))

export function audioConstraints(processing) {
  const constraints = Object.fromEntries(Object.entries(processing).filter(([, value]) => typeof value === 'boolean'))
  return Object.keys(constraints).length ? constraints : true
}

export function discardLabel(factor) {
  return 'Sample discard: ' + Math.round(factor * 100) + '%'
}

export function createCaptureSettings(section) {
  const defaults = () => ({
    processing: { ...defaultProcessing }, discardFactor: DEFAULT_DISCARD_FACTOR,
    blocksPerSecond: DEFAULT_BLOCKS_PER_SECOND, wordRate: defaultWordRate, halfMovement: false
  })
  let current = defaults()
  let sampleRate
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    for (const [key] of PROCESSING_FLAGS) {
      const value = saved?.processing?.[key]
      if (typeof value === 'boolean' || value === null) current.processing[key] = value
    }
    if (DISCARD_CHOICES.includes(saved?.discardFactor)) current.discardFactor = saved.discardFactor
    const blocks = saved?.blocksPerSecond
    if (Number.isInteger(blocks) && blocks >= 5 && blocks <= 60) current.blocksPerSecond = blocks
    const wordRate = saved?.wordRate
    if (Number.isInteger(wordRate) && wordRate >= 1 && wordRate <= maxSteeringRate) current.wordRate = wordRate
    if (typeof saved?.halfMovement === 'boolean') current.halfMovement = saved.halfMovement
  } catch {}

  const discard = section.querySelector('#advanced-discard')
  const blocks = section.querySelector('#trng-blocks')
  const blocksValue = section.querySelector('#trng-blocks-value')
  const estimate = section.querySelector('#trng-estimate')
  const halfMovement = section.querySelector('#half-movement')
  const wordRate = section.querySelector('#word-rate')
  const wordRateValue = section.querySelector('#word-rate-value')
  const status = section.querySelector('#advanced-status')
  const buttons = PROCESSING_FLAGS.map(([key, label]) => [key, label, section.querySelector('#advanced-' + key)])

  function render() {
    for (const [key, label, button] of buttons) {
      const value = current.processing[key]
      const state = value === null ? 'Browser default' : value ? 'On' : 'Off'
      button.textContent = label + ': ' + state
    }
    discard.textContent = discardLabel(current.discardFactor)
    blocks.value = current.blocksPerSecond
    blocksValue.textContent = current.blocksPerSecond + ' blocks/s'
    const rate = sampleRate ?? 48000
    const plan = trngPlan(rate, current.blocksPerSecond, current.discardFactor)
    estimate.textContent = 'Estimated source: about ' + Math.round(plan.wordsPerSecond) + ' words/s at ' +
      rate.toLocaleString() + ' Hz (' + (sampleRate ? 'measured sample rate' : 'assumed sample rate') + ', 25% ties).'
    wordRate.max = Math.min(maxSteeringRate, Math.max(30, Math.ceil(plan.wordsPerSecond * 1.5), current.wordRate))
    wordRate.value = current.wordRate
    wordRateValue.textContent = current.wordRate + ' words/s'
    halfMovement.setAttribute('aria-pressed', String(current.halfMovement))
    halfMovement.textContent = 'Half movement: ' + (current.halfMovement ? 'On' : 'Off')
  }

  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(current))
      status.textContent = 'Settings saved on this device.'
    } catch {
      status.textContent = 'Settings apply until you close the app.'
    }
    render()
  }

  for (const [key, , button] of buttons) {
    button.onclick = () => {
      const value = current.processing[key]
      current.processing[key] = value === false ? true : value === true ? null : false
      save()
    }
  }
  discard.onclick = () => {
    const index = DISCARD_CHOICES.indexOf(current.discardFactor)
    current.discardFactor = DISCARD_CHOICES[(index + 1) % DISCARD_CHOICES.length]
    save()
  }
  section.querySelector('#advanced-reset').onclick = () => {
    current = defaults()
    save()
  }
  wordRate.oninput = () => {
    current.wordRate = wordRate.valueAsNumber
    save()
  }
  blocks.oninput = () => {
    current.blocksPerSecond = blocks.valueAsNumber
    save()
  }
  halfMovement.onclick = () => {
    current.halfMovement = !current.halfMovement
    save()
  }
  render()

  return {
    getSettings: () => ({
      audio: audioConstraints(current.processing),
      discardFactor: current.discardFactor,
      blocksPerSecond: current.blocksPerSecond,
      wordRate: current.wordRate,
      halfMovement: current.halfMovement
    }),
    setSampleRate(rate) {
      sampleRate = rate
      render()
    }
  }
}

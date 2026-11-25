export const PROCESSING_FLAGS = [
  ['noiseSuppression', 'Noise suppression'],
  ['echoCancellation', 'Echo cancellation'],
  ['autoGainControl', 'Automatic gain control']
]
export const DISCARD_CHOICES = [0, .5, .75, .9, .95]
export const DEFAULT_DISCARD_FACTOR = .9
const defaultRates = { maze: 24, apple: 10 }
const defaultMultiplier = 1
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
  const defaults = () => ({ processing: { ...defaultProcessing }, discardFactor: DEFAULT_DISCARD_FACTOR, rates: { ...defaultRates }, multiplier: defaultMultiplier })
  let current = defaults()
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey))
    for (const [key] of PROCESSING_FLAGS) {
      const value = saved?.processing?.[key]
      if (typeof value === 'boolean' || value === null) current.processing[key] = value
    }
    if (DISCARD_CHOICES.includes(saved?.discardFactor)) current.discardFactor = saved.discardFactor
    const multiplier = saved?.multiplier
    if (Number.isInteger(multiplier * 2) && multiplier >= .5 && multiplier <= 12) current.multiplier = multiplier
    for (const mode of Object.keys(defaultRates)) {
      const rate = saved?.rates?.[mode]
      if (Number.isInteger(rate) && rate >= 1 && rate <= 30) current.rates[mode] = rate
    }
  } catch {}

  const discard = section.querySelector('#advanced-discard')
  const multiplier = section.querySelector('#movement-multiplier')
  const multiplierValue = section.querySelector('#movement-multiplier-value')
  const status = section.querySelector('#advanced-status')
  const rateControls = Object.keys(defaultRates).map(mode => [
    mode, section.querySelector('#rate-' + mode), section.querySelector('#rate-' + mode + '-value')
  ])
  const buttons = PROCESSING_FLAGS.map(([key, label]) => [key, label, section.querySelector('#advanced-' + key)])

  function render() {
    for (const [key, label, button] of buttons) {
      const value = current.processing[key]
      const state = value === null ? 'Browser default' : value ? 'On' : 'Off'
      button.textContent = label + ': ' + state
    }
    discard.textContent = discardLabel(current.discardFactor)
    multiplier.value = current.multiplier
    multiplierValue.textContent = current.multiplier + '×'
    for (const [mode, input, output] of rateControls) {
      input.value = current.rates[mode]
      output.textContent = current.rates[mode] + ' words/s'
    }
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
  for (const [mode, input] of rateControls) {
    input.oninput = () => {
      current.rates[mode] = input.valueAsNumber
      save()
    }
  }
  multiplier.oninput = () => {
    current.multiplier = multiplier.valueAsNumber
    save()
  }
  render()

  return () => ({
    audio: audioConstraints(current.processing),
    discardFactor: current.discardFactor,
    rates: { ...current.rates },
    multiplier: current.multiplier
  })
}

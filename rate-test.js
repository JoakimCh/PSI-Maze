import { MicrophoneTRNG } from './microphone.js'
import { CAPTURE_BATCH_MS, WordCadence, canDeliver } from './word-cadence.js'

const testDuration = 10000

export function createRateTest(section, getCaptureSettings, setSampleRate) {
  const button = section.querySelector('#advanced-test')
  const result = section.querySelector('#advanced-test-result')
  const countdown = section.querySelector('#advanced-countdown')
  const progress = section.querySelector('#advanced-test-progress')
  const seconds = section.querySelector('#advanced-test-seconds')
  const controls = [...section.querySelectorAll('input, button')].filter(control => control !== button)
  let active

  function stop(message = 'Rate test stopped.') {
    if (!active) return false
    clearTimeout(active.timer)
    cancelAnimationFrame(active.frame)
    active.mic.stop()
    active = undefined
    countdown.hidden = true
    button.textContent = 'Test settings'
    controls.forEach(control => { control.disabled = false })
    result.textContent = message
    return true
  }

  function drawCountdown(run, end, now) {
    if (active !== run) return
    const remaining = Math.max(0, end - now)
    progress.value = remaining
    seconds.textContent = Math.ceil(remaining / 1000) + ' s'
    if (remaining > 0) run.frame = requestAnimationFrame(time => drawCountdown(run, end, time))
  }

  button.onclick = async () => {
    if (stop()) return
    const run = { mic: new MicrophoneTRNG() }
    const settings = getCaptureSettings()
    const rate = settings.wordRate
    active = run
    button.textContent = 'Stop test'
    controls.forEach(control => { control.disabled = true })
    result.textContent = 'Waiting for microphone access…'
    const fail = message => { if (active === run) stop(message) }

    try {
      await run.mic.start(word => {
        if (active === run) run.cadence?.add(word, performance.now())
      }, fail, {
        ...settings,
        onCapture(setup) {
          if (active !== run) return
          setSampleRate(setup.rate)
          result.textContent = 'Measuring usable words…'
          const now = performance.now()
          run.cadence = new WordCadence(rate, now)
          countdown.hidden = false
          drawCountdown(run, now + testDuration, now)
          run.timer = setTimeout(() => {
            if (active !== run) return
            const report = run.cadence.report(performance.now(), testDuration)
            const source = report.wordsPerSecond.toFixed(1)
            const coverage = Math.round(report.coverage * 100)
            const outcome = canDeliver(report, rate) ? 'pass' : 'lower the rate or sample discard'
            stop('Source: ' + source + ' words/s. Both games at ' + rate + '/s: ' + outcome +
              ' (' + coverage + '% of slots supplied).')
          }, testDuration + CAPTURE_BATCH_MS)
        }
      })
    } catch (error) {
      fail(error.name === 'NotAllowedError'
        ? 'Microphone access was blocked. Allow it in the browser and try again.'
        : error.message || 'The microphone could not start.')
    }
  }

  return { stop }
}

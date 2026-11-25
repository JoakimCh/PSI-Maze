import { MicrophoneTRNG } from './microphone.js'
import { CAPTURE_BATCH_MS, WordCadence, canDeliver } from './word-cadence.js'

const testDuration = 10000

export function createRateTest(section, getCaptureSettings, setSampleRate) {
  const button = section.querySelector('#advanced-test')
  const result = section.querySelector('#advanced-test-result')
  const controls = [...section.querySelectorAll('input, button')].filter(control => control !== button)
  let active

  function stop(message = 'Rate test stopped.') {
    if (!active) return false
    clearTimeout(active.timer)
    active.mic.stop()
    active = undefined
    button.textContent = 'Test settings'
    controls.forEach(control => { control.disabled = false })
    result.textContent = message
    return true
  }

  button.onclick = async () => {
    if (stop()) return
    const run = { mic: new MicrophoneTRNG() }
    const settings = getCaptureSettings()
    const modes = [['Maze', settings.rates.maze], ['Apple Catch', settings.rates.apple]]
    active = run
    button.textContent = 'Stop test'
    controls.forEach(control => { control.disabled = true })
    result.textContent = 'Waiting for microphone access…'
    const fail = message => { if (active === run) stop(message) }

    try {
      await run.mic.start((word) => {
        if (active !== run) return
        const now = performance.now()
        for (const test of run.tests ?? []) test.cadence.add(word, now)
      }, fail, {
        ...settings,
        onCapture(setup) {
          if (active !== run) return
          setSampleRate(setup.rate)
          result.textContent = 'Measuring usable words for 10 seconds…'
          const now = performance.now()
          run.tests = modes.map(([name, rate]) => ({ name, rate, cadence: new WordCadence(rate, now) }))
          run.timer = setTimeout(() => {
            if (active !== run) return
            const at = performance.now()
            const reports = run.tests.map(test => ({
              ...test, ...test.cadence.report(at, testDuration)
            }))
            const source = reports[0].wordsPerSecond.toFixed(1)
            const scores = reports.map(report => {
              const result = canDeliver(report, report.rate) ? 'pass' : 'lower the rate or sample discard'
              return report.name + ' at ' + report.rate + '/s: ' + result + ' (' +
                Math.round(report.coverage * 100) + '% of slots supplied).'
            })
            stop('Source: ' + source + ' words/s. ' + scores.join(' '))
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

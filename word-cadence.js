export const CAPTURE_BATCH_MS = 200
const batchesPerSecond = 1000 / CAPTURE_BATCH_MS

export class WordCadence {
  #batch = 0
  #captured = []
  #spare = []
  #source = 0
  #pending = []
  #completed = []

  constructor(rate, started) {
    this.rate = rate
    this.started = started
  }

  #quota(batch) {
    return Math.floor((batch + 1) * this.rate / batchesPerSecond) -
      Math.floor(batch * this.rate / batchesPerSecond)
  }

  #closeBefore(at) {
    const end = Math.floor((at - this.started) / CAPTURE_BATCH_MS)
    while (this.#batch < end) {
      const batch = this.#batch
      const quota = this.#quota(batch)
      const words = this.#captured.slice(0, quota)
      const shortage = quota - words.length
      if (shortage) words.unshift(...this.#spare.slice(-shortage))

      // Play this batch while the next one is captured.
      const boundary = this.started + (batch + 1) * CAPTURE_BATCH_MS
      for (let i = 0; i < quota; i++) {
        this.#pending.push({ at: boundary + i * CAPTURE_BATCH_MS / quota, word: words[i] })
      }
      this.#completed.push({ boundary, source: this.#source, supplied: words.length, quota })
      this.#spare = this.#captured.slice(quota)
      this.#captured = []
      this.#source = 0
      this.#batch++
    }
    const oldest = this.started + this.#batch * CAPTURE_BATCH_MS - 12000
    while (this.#completed[0]?.boundary <= oldest) this.#completed.shift()
    while (this.#pending[0]?.at < oldest) this.#pending.shift()
  }

  add(word, at) {
    this.#closeBefore(at)
    const quota = this.#quota(this.#batch)
    const capacity = quota + Math.ceil(this.rate / batchesPerSecond)
    // Keep the first quota in arrival order, plus the newest spare words.
    if (this.#captured.length === capacity) this.#captured.splice(quota, 1)
    this.#captured.push(word)
    this.#source++
  }

  take(at) {
    this.#closeBefore(at)
    const next = this.#pending.findIndex(update => update.at > at)
    return this.#pending.splice(0, next < 0 ? this.#pending.length : next)
  }

  report(at, milliseconds) {
    this.#closeBefore(at)
    const sourceEnd = this.started + this.#batch * CAPTURE_BATCH_MS
    const deliveryEnd = sourceEnd - CAPTURE_BATCH_MS
    let source = 0
    let captureBatches = 0
    let supplied = 0
    let quota = 0
    for (const batch of this.#completed) {
      if (batch.boundary > sourceEnd - milliseconds) {
        source += batch.source
        captureBatches++
      }
      if (batch.boundary <= deliveryEnd && batch.boundary > deliveryEnd - milliseconds) {
        supplied += batch.supplied
        quota += batch.quota
      }
    }
    return {
      wordsPerSecond: captureBatches ? source * batchesPerSecond / captureBatches : 0,
      coverage: quota ? supplied / quota : 0
    }
  }
}

export function canDeliver(report, rate) {
  return report.wordsPerSecond >= rate - .4 && report.coverage >= .9
}

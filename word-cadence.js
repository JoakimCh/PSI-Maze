// A slot can consume the newest word received during it, once.
export class WordCadence {
  #slots = new Map()
  #sampled = -1

  constructor(rate, started) {
    this.period = 1000 / rate
    this.started = started
  }

  #slot(at) {
    return Math.floor((at - this.started) / this.period)
  }

  add(word, at) {
    const slot = this.#slot(at)
    const previous = this.#slots.get(slot)
    this.#slots.set(slot, { word, count: (previous?.count ?? 0) + 1 })
    const expired = this.#slot(at - 12000)
    for (const key of this.#slots.keys()) {
      if (key >= expired) break
      this.#slots.delete(key)
    }
  }

  sample(at) {
    const slot = this.#slot(at) - 1
    if (slot <= this.#sampled) return
    this.#sampled = slot
    return { word: this.#slots.get(slot)?.word }
  }

  report(at, milliseconds) {
    const end = this.#slot(at)
    const first = Math.max(0, end - Math.round(milliseconds / this.period))
    let source = 0
    let filled = 0
    for (let i = first; i < end; i++) {
      const slot = this.#slots.get(i)
      if (slot) {
        source += slot.count
        filled++
      }
    }
    const size = end - first
    return {
      wordsPerSecond: size ? source * 1000 / (size * this.period) : 0,
      coverage: size ? filled / size : 0
    }
  }
}

export function canDeliver(report, rate) {
  return report.wordsPerSecond >= rate - .4 && report.coverage >= .9
}

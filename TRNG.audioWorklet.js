import { DEFAULT_BLOCKS_PER_SECOND, trngPlan } from './trng-config.js'

class TRNG extends AudioWorkletProcessor {
  #block
  #blockIndex = 0
  #report
  #reportFrame
  #samplesToUse
  #pairsPerBlock
  #word = 0
  #bitCount = 0

  constructor({ processorOptions = {} }) {
    super()
    const { blocksPerSecond = DEFAULT_BLOCKS_PER_SECOND, discardFactor = 0, diagnostics } = processorOptions
    const plan = trngPlan(sampleRate, blocksPerSecond, discardFactor)
    this.#block = new Float32Array(plan.blockSize)
    this.#samplesToUse = plan.samplesToUse
    this.#pairsPerBlock = plan.pairs
    if (diagnostics) {
      this.#reportFrame = currentFrame
      this.#resetReport()
    }
  }

  process(inputs) {
    const samples = inputs[0]?.[0] // as Float32Array
    const skipped = samples?.[0] === 0 && samples[1] === 0 && samples[2] === 0
    if (this.#report) this.#measureInput(samples, skipped)
    if (samples && !skipped) this.#handleSamples(samples)
    if (this.#report && currentFrame - this.#reportFrame >= sampleRate / 2) {
      this.port.postMessage({ diagnostics: {
        ...this.#report,
        seconds: (currentFrame - this.#reportFrame) / sampleRate,
        blockSize: this.#block.length,
        samplesToUse: this.#samplesToUse,
        pendingBits: this.#bitCount
      } })
      this.#reportFrame = currentFrame
      this.#resetReport()
    }
    return true // returning true forces the browser to keep the node alive
  }

  #resetReport() {
    this.#report = {
      samples: 0, zeroSamples: 0, skippedSamples: 0, missingQuanta: 0,
      sumSquares: 0, peak: 0, pairs: 0, ties: 0, words: 0, emptyBlocks: 0
    }
  }

  #measureInput(samples, skipped) {
    const report = this.#report
    if (!samples?.length) {
      report.missingQuanta++
      return
    }
    report.samples += samples.length
    if (skipped) report.skippedSamples += samples.length
    for (const sample of samples) {
      report.sumSquares += sample * sample
      report.peak = Math.max(report.peak, Math.abs(sample))
      if (sample === 0) report.zeroSamples++
    }
  }

  #handleSamples(samples) {
    let samplesIndex = 0
    // fill up blocks and handle them
    while (samplesIndex < samples.length && this.#blockIndex < this.#block.length) {
      const missingSamples = this.#block.length - this.#blockIndex
      const toInsert = samples.subarray(samplesIndex, samplesIndex + missingSamples)
      samplesIndex += toInsert.length
      this.#block.set(toInsert, this.#blockIndex)
      this.#blockIndex += toInsert.length
      if (this.#blockIndex == this.#block.length) {
        this.#blockIndex = 0
        this.#samplesToRandomData() // handle the block
      }
    }
  }

  #samplesToRandomData() {
    const samples = this.#block
    fisherYatesShuffle(samples)
    const words = new Uint32Array(Math.floor((this.#bitCount + this.#pairsPerBlock) / 32))
    let count = 0
    let ties = 0

    for (let i = 0; i + 1 < this.#samplesToUse; i += 2) {
      const a = Math.abs(Math.trunc(samples[i] * 32767)) & 0b11
      const b = Math.abs(Math.trunc(samples[i + 1] * 32767)) & 0b11
      if (a === b) {
        ties++
        continue
      }
      if (a < b) this.#word |= 1 << this.#bitCount
      if (++this.#bitCount === 32) {
        words[count++] = this.#word
        this.#word = 0
        this.#bitCount = 0
      }
    }

    if (this.#report) {
      this.#report.pairs += this.#pairsPerBlock
      this.#report.ties += ties
      this.#report.words += count
      if (ties === this.#pairsPerBlock) this.#report.emptyBlocks++
    }
    // A partial word stays in the processor until later blocks supply its remaining bits.
    if (count) {
      const data = count === words.length ? words.buffer : words.buffer.slice(0, count * 4)
      this.port.postMessage({ data }, [data])
    }
  }
}

registerProcessor('TRNG', TRNG)

function fisherYatesShuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[array[i], array[j]] = [array[j], array[i]]
  }
  return array
}


class TRNG extends AudioWorkletProcessor {
  #cfg = {
    blockSize: 1000, // num of samples to collect before extracting random data
    outputSize: 0, // size of random data to extract from the block
    discardFactor: 0,
    diagnostics: false,
  }
  /** @type {Float32Array} */
  #block
  #blockIndex = 0
  #report
  #reportFrame
  #samplesToUse

  constructor({processorOptions}) {
    super(...arguments)
    if (typeof processorOptions == 'object') {
      for (const key in processorOptions) {
        if (key in this.#cfg) {
          this.#cfg[key] = processorOptions[key]
        }
      }
    }
    this.#block = new Float32Array(this.#cfg.blockSize)
    this.#samplesToUse = Math.round(this.#cfg.blockSize * (1 - this.#cfg.discardFactor))
    if (this.#cfg.diagnostics) {
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
        samplesToUse: this.#samplesToUse
      } })
      this.#reportFrame = currentFrame
      this.#resetReport()
    }
    return true // returning true forces the browser to keep the node alive
  }

  #resetReport() {
    this.#report = {
      samples: 0, zeroSamples: 0, skippedSamples: 0, missingQuanta: 0,
      sumSquares: 0, peak: 0, pairs: 0, ties: 0, words: 0, rejectedBlocks: 0
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

  /** Use noise in the samples to create random data. */
  #samplesToRandomData() {
    // The idea here is to make it so a soul/spirit (or mind over matter) could easily push for a desired outcome without having to change too many bits (less friction).
    const samples = this.#block
    const samplesToUse = this.#samplesToUse
    fisherYatesShuffle(samples) // (to pick from random time offsets)
    // if a size is set use it else it's at least used 16 samples to create 1 byte
    const bytes = new Uint8Array(this.#cfg.outputSize || Math.trunc(samplesToUse / 16))
    let randomByte = 0, bitIndex = 0, sampleIndex = 0, byteIndex = 0
    let ties = 0
    while (sampleIndex <= samplesToUse - 2) {
      // convert f32 to u16 then read bits from the abs (2 bits of noise)
      const a = Math.abs(Math.trunc(samples[sampleIndex++] * 32767)) & 0b11
      const b = Math.abs(Math.trunc(samples[sampleIndex++] * 32767)) & 0b11
      if (a == b) {
        ties++
        continue
      }
      if (a < b) {
        randomByte |= 1 << bitIndex
      }
      if (++bitIndex == 8) {
        bytes[byteIndex++] = randomByte
        randomByte = 0
        bitIndex = 0
        if (this.#cfg.outputSize && byteIndex == this.#cfg.outputSize) {
          break
        }
      }
    }
    if (this.#report) {
      this.#report.pairs += sampleIndex / 2
      this.#report.ties += ties
      if (byteIndex === this.#cfg.outputSize) this.#report.words++
      else this.#report.rejectedBlocks++
    }
    if (this.#cfg.outputSize == 0 || byteIndex == this.#cfg.outputSize) {
      const buffer = (byteIndex == bytes.length ? bytes.buffer : bytes.buffer.slice(0, byteIndex))
      this.port.postMessage({data: buffer}, [buffer])
    } else {
      this.port.postMessage({
        data: bytes.buffer,
        truncated: byteIndex,
        error: `TRNG outputSize (${this.#cfg.outputSize}) is more than it could gather (${byteIndex}) from the blockSize (${this.#cfg.blockSize}). Which usually means that it's receiving poor input data or has a too small blockSize.`
      }, [bytes.buffer])
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

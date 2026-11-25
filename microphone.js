export class MicrophoneTRNG {
  #context
  #stream
  #source
  #node
  #closed = false

  async start(onWord, onError) {
    if (!navigator.mediaDevices?.getUserMedia || !window.AudioContext) {
      throw new Error('Microphone access needs a supported browser on HTTPS.')
    }

    this.#context = new AudioContext()
    // Call both from the Start gesture, before crossing an asynchronous boundary.
    const resume = this.#context.resume()
    const mic = navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      if (this.#closed) {
        stream.getTracks().forEach(track => track.stop())
        return
      }
      this.#stream = stream
    })
    try {
      await Promise.all([
        resume,
        mic,
        this.#context.audioWorklet.addModule(new URL('./TRNG.audioWorklet.js', import.meta.url))
      ])
      if (this.#closed) return
      const track = this.#stream.getAudioTracks()[0]
      const settings = track.getSettings()
      const capture = ['echoCancellation', 'noiseSuppression', 'autoGainControl']
        .map(key => settings[key] === undefined ? '?' : Number(settings[key])).join('/')
      const setup = {
        label: track.label || 'Default microphone',
        signature: [track.label, settings.deviceId, this.#context.sampleRate, capture, 'steering-v2'].join('|'),
        rate: this.#context.sampleRate,
        rules: 'steering-v2'
      }
      this.#node = new AudioWorkletNode(this.#context, 'TRNG', {
        processorOptions: {
          blockSize: Math.trunc(this.#context.sampleRate / 30),
          outputSize: 4
        }
      })
      this.#node.port.onmessage = ({ data }) => {
        if (!this.#closed && !data.error && data.data.byteLength === 4) {
          onWord(new Uint32Array(data.data)[0], setup)
        }
      }
      this.#node.onprocessorerror = () => onError('Microphone processing stopped. Try again.')
      track.addEventListener('ended', () => onError('Microphone disconnected. Try again.'), { once: true })
      this.#source = this.#context.createMediaStreamSource(this.#stream)
      this.#source.connect(this.#node).connect(this.#context.destination)
    } catch (error) {
      this.stop()
      throw error
    }
  }

  stop() {
    if (this.#closed) return
    this.#closed = true
    this.#stream?.getTracks().forEach(track => track.stop())
    this.#source?.disconnect()
    if (this.#node) {
      this.#node.port.close()
      this.#node.disconnect()
    }
    this.#context?.close().catch(() => {})
  }
}

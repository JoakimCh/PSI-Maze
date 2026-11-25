export const DEFAULT_BLOCKS_PER_SECOND = 30
export const ESTIMATED_TIE_RATE = .25

export function trngPlan(sampleRate, blocksPerSecond, discardFactor) {
  const blockSize = Math.floor(sampleRate / blocksPerSecond)
  const samplesToUse = Math.round(blockSize * (1 - discardFactor))
  const pairs = Math.floor(samplesToUse / 2)
  const wordsPerSecond = pairs * (1 - ESTIMATED_TIE_RATE) * sampleRate / (blockSize * 32)
  return { blockSize, samplesToUse, pairs, wordsPerSecond }
}

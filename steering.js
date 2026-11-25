export function countSetBits(word) {
  let count = 0
  while (word) {
    word = (word & (word - 1)) >>> 0
    count++
  }
  return count
}

const weights = Uint8Array.from({ length: 256 }, (_, byte) => countSetBits(byte))

export function direction(word) {
  return {
    x: weights[(word >>> 8) & 255] - weights[word & 255],
    y: weights[word >>> 24] - weights[(word >>> 16) & 255]
  }
}

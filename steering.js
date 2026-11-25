const weights = Float32Array.from({ length: 256 }, (_, byte) => {
  let count = 0
  while (byte) {
    byte &= byte - 1
    count++
  }
  return count / 2
})

export function direction(word) {
  return {
    x: weights[(word >>> 8) & 255] - weights[word & 255],
    y: weights[word >>> 24] - weights[(word >>> 16) & 255]
  }
}

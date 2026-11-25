# PSI Maze

An installable game for exploring mind over matter. Microphone-derived bits steer a yellow dot while you focus on where you want it to go. [Play PSI Maze](https://joakimch.github.io/PSI-Maze/).

## Play

Press **Start** and allow microphone access. A session continues until you press **Stop**, switch tabs, or leave the app. Completed mazes and catches are saved.

- **Maze.** Focus along the corridor. The dot can only move forward. Each maze is 179 steps, and the entrance cycles through all four sides. After finishing, a five-second countdown starts the next maze. Press **Cancel** to end the session.
- **Apple Catch.** Focus toward the red dot. Every catch spawns another apple at the same distance. The board wraps at the edges.
- **Controls.** Use the D-pad and Select on a TV, or the arrow keys, Tab, Enter, and Escape on a keyboard. Both games use the same board, wide on larger screens and tall on phones.

## Training history

Profiles and results are stored in your browser. Times stay hidden during play and unlock every seven qualifying training days. The days can be nonconsecutive.

A **Maze** day needs one completed maze and uses the median time. An **Apple Catch** day needs six catches across any number of sessions and uses the average catch time. Each seven-day block reports the median of its daily results. **History** offers CSV export for revealed runs.

## How the microphone steers the dot

The [UFO experiment’s extractor](https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/blob/main/TRNG.audioWorklet.js) shuffles microphone samples and compares the two lowest bits of their quantized magnitudes in pairs. It drops ties and emits a `1` when the first value is smaller or a `0` when it is larger. Each 32-bit word has one byte per direction. Every set bit contributes equally, and opposing directions cancel. Each word moves the dot by its net directional weight in board pixels. The animation ends at that position.

The experiment asks whether focusing on a direction can bias those bits. Ordinary microphone fluctuations also move the dot. Training history tracks changes in run times. A test of intention would need controlled comparisons.

## Advanced and Diagnostics

- **Advanced** defaults to **90% sample discard**, **24 steering updates/s for Maze**, **10 for Apple Catch**, and requests noise suppression, echo cancellation, and automatic gain control off. The movement multiplier defaults to **1×** and controls the distance each word moves the dot.
- **Test settings** measures source throughput and the percentage of steering updates supplied over ten seconds. The game collects words in **200 ms batches** and plays them evenly during the next batch. Spare words can fill a gap in the following batch before expiring. A test can pass with occasional misses. A sustained shortage stops play and points you to Advanced.
- **Diagnostics** shows the input level, skipped samples, ties, rejected blocks, and the processing settings reported by the browser. It can compare your saved settings with **Processing: browser defaults**. **Live bit balance** shows how far the count of ones is from the fair-bit expectation, using the Z-score display from [The Guess Experiment](https://github.com/JoakimCh/the-guess-experiment/blob/main/stats.js).

## Run locally

Serve this directory on HTTPS or localhost, for example with `python3 -m http.server 8000`. The browser needs microphone and AudioWorklet support. Audio stays on the device. Compatible browsers can install the app, and it works offline after caching.

For GitHub Pages, publish from the root of the default branch. When changing bundled assets, increment the cache version in `service-worker.js`.

# PSI Maze

An installable game for exploring mind over matter, based on the microphone random number generator from the UFO experiment. [Play PSI Maze](https://joakimch.github.io/PSI-Maze/).

## The mind-over-matter idea

Can focusing on a direction slightly bias the random bits that steer a dot? In **Maze**, focus on the direction the corridor takes next. In **Apple Catch**, focus on moving toward the red dot. The game turns a small imbalance in the bits into a visible change in movement, so a shift of even one bit changes the steering signal.

Ordinary fluctuations in the microphone signal already move the dot. Room sounds and differences between microphones can also affect the input. The seven-day results show how your run times change. Testing whether intention affects the bits would require controlled comparisons under the same conditions.

## How the microphone steers the dot

The microphone provides a live physical input. The [extractor from the UFO experiment](https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/blob/main/TRNG.audioWorklet.js) shuffles each block of audio samples, then compares pairs using the two lowest bits of each quantized sample's magnitude. It drops ties and emits a `1` if the first value is smaller or a `0` if it is larger. Small changes in the measured samples can change these comparisons. The app requests one 32-bit word per block, at roughly 30 blocks per second.

The game assigns one byte each to left, right, up, and down. Every set bit adds half a point, giving each direction a weight from 0 to 4. Opposing weights cancel. For example, six set bits for right and two for left give weights of 3 and 1, so the net signal is 2 to the right. The game smooths the signal across successive words to make changes in direction easier to see.

## Modes and training

Both boards are wide on desktops, TVs, and tablets, and tall on phones.

- **Maze** uses the directional signal that points along the corridor. The dot can stop and can only move forward. Each run gets a new 179-step layout. Finishing a run advances the next entrance through the top, right, bottom and left sides, with the exit on the opposite edge.
- **Apple Catch** uses both axes. The arena wraps at each edge. Red apples spawn at the same shortest distance from the yellow dot, and five catches complete a run.
- **Players** are local to the browser. Use the player button to add, rename or switch profiles.
- **History** reveals a player's results for each mode after every seven local calendar days with a completed run. Days can be nonconsecutive. A block's typical time is the median of its seven daily medians. Runs later on the seventh day still count toward that block. Elapsed times stay hidden during play. History and CSV exports show only revealed runs.
- On a TV, use the D-pad to move focus and Select to activate a control. On a keyboard, use arrow keys or Tab, Enter and Escape.

## TRNG diagnostics

Open **Diagnostics** and start a test in a quiet room. Compare **32-bit words**, **Samples skipped by zero gate**, and **Tied sample pairs**. Run the same test with **Processing: request off** and compare the browser-reported settings and generation rate. The browser and device decide which processing controls are available. **Sample discard** changes how many samples the extractor considers during the test.

**Live bit balance** follows the Z-score display from [The Guess Experiment](https://github.com/JoakimCh/the-guess-experiment/blob/main/stats.js). It counts ones in every complete TRNG word since the test started. For a fair, independent stream of `n` bits, the expected count is `n / 2` and its standard deviation is `sqrt(n) / 2`. The marker shows how far the observed count is from the expected count in standard deviations. Positive values show more ones and negative values show more zeros.

## Run or host it

Serve this directory over HTTPS or localhost, for example with `python3 -m http.server 8000`. Open the page, press **Start** and allow microphone access. Android TV needs a browser with microphone access and AudioWorklet support. Installation is available through compatible browsers. Once cached, the app works offline. Audio is processed on-device.

For GitHub Pages, deploy from the root of the default branch. All app URLs are relative so the PWA can be hosted below a repository path. When changing bundled assets, increment the cache version in `service-worker.js`.

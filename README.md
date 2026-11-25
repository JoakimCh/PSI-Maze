# PSI Maze

An installable game for exploring mind over matter, based on the microphone random number generator from the UFO experiment. [Play PSI Maze](https://joakimch.github.io/PSI-Maze/).

## The mind-over-matter idea

Can focusing on a direction slightly bias the random bits that steer a dot? In **Maze**, focus on the direction the corridor takes next. In **Apple Catch**, focus on moving toward the red dot. The game turns a small imbalance in the bits into a visible change in movement, so a shift of even one bit changes the steering signal.

Ordinary fluctuations in the microphone signal already move the dot. Room sounds and differences between microphones can also affect the input. The seven-day results show how your run times change. Testing whether intention affects the bits would require controlled comparisons under the same conditions.

## How the microphone steers the dot

The microphone provides a live physical input. The [extractor from the UFO experiment](https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/blob/main/TRNG.audioWorklet.js) shuffles each block of audio samples, then compares pairs using the two lowest bits of each quantized sample's magnitude. It drops ties and emits a `1` if the first value is smaller or a `0` if it is larger. Small changes in the measured samples can change these comparisons. The app requests one 32-bit word per block, at roughly 30 blocks per second.

The game assigns one byte each to left, right, up, and down. Every set bit adds half a point, giving each direction a weight from 0 to 4. Opposing weights cancel. For example, six set bits for right and two for left give weights of 3 and 1, so the net signal is 2 to the right. The game smooths the signal across successive words to make changes in direction easier to see.

## Modes and training

Both games use the same 15×12 playfield on desktops, TVs, and tablets, and 12×15 on phones. Press **Start** once to play continuously. **Stop**, switching tabs, or leaving the app ends the session.

- **Maze** uses the directional signal that points along the corridor. The dot can stop and can only move forward. Each run gets a new 179-step layout, and the generator favors turns and shorter straightaways. Completed mazes are saved immediately. The next maze begins after a five-second countdown unless you cancel. Each completion moves the next entrance around the edges, with the exit opposite it.
- **Apple Catch** uses both axes. The arena wraps at each edge. Red apples spawn at the same shortest distance from the yellow dot. Each catch saves its elapsed time and spawns the next apple immediately.
- **Players** are local to the browser. Use the player button to add, rename or switch profiles.
- **History** reveals results every seven qualifying local calendar days, which can be nonconsecutive. A Maze day needs one completed maze and uses the daily median. An Apple Catch day needs at least six catches across any number of sessions and uses the daily average. A block's typical time is the median of its seven daily results. Elapsed times stay hidden during play. History and CSV exports show only revealed runs.
- On a TV, use the D-pad to move focus and Select to activate a control. On a keyboard, use arrow keys or Tab, Enter and Escape.

## TRNG diagnostics

PSI Maze requests noise suppression, echo cancellation, and automatic gain control off in both game modes and in Diagnostics. The browser and device decide which settings they can apply. The extractor discards 90% of each shuffled sample block by default, using the remaining 10% to generate bits.

Open **Advanced** to change the game settings saved on this device. Each processing control cycles between Off, On, and Browser default. The sliders control how often the games use fresh words, with defaults of 24 words/s for Maze and 10 for Apple Catch. The generator still aims for 30 words/s. The scheduler collects words in 200 ms batches and spreads each batch’s steering updates across the next 200 ms. Spare words can cover gaps in the following batch, then expire. **Test settings** checks the source rate and delivery at both selected rates over ten seconds. If the source falls short during play, the session stops with an explanation. **Restore defaults** restores the two rates and 90% sample discard, with all three processing controls Off.

Open **Diagnostics** and start a test in a quiet room. It starts with your Advanced settings. Switch to **Processing: browser defaults** for a comparison run. Check the browser-reported settings along with **32-bit words**, **Samples skipped by zero gate**, and **Tied sample pairs**. **Sample discard** changes how many samples the extractor considers during the test.

**Live bit balance** follows the Z-score display from [The Guess Experiment](https://github.com/JoakimCh/the-guess-experiment/blob/main/stats.js). It counts ones in every complete TRNG word since the test started. For a fair, independent stream of `n` bits, the expected count is `n / 2` and its standard deviation is `sqrt(n) / 2`. The marker shows how far the observed count is from the expected count in standard deviations. Positive values show more ones and negative values show more zeros.

## Run or host it

Serve this directory over HTTPS or localhost, for example with `python3 -m http.server 8000`. Open the page, press **Start** and allow microphone access. Android TV needs a browser with microphone access and AudioWorklet support. Installation is available through compatible browsers. Once cached, the app works offline. Audio is processed on-device.

For GitHub Pages, deploy from the root of the default branch. All app URLs are relative so the PWA can be hosted below a repository path. When changing bundled assets, increment the cache version in `service-worker.js`.

# PSI Maze

A microphone-driven maze for TVs, desktops and phones. Every maze is a single winding corridor of 179 grid steps. A yellow dot moves forward, accelerating when a microphone-derived 32-bit word contains an imbalance in either direction.

- **Training** hides the timer and unlocks results every seven local calendar days with a completed run. The days can be nonconsecutive. A block's typical time is the median of its seven daily medians. Runs later on the seventh day still count toward that block.
- **Free Play** shows the timer and leaves the training history untouched.
- **History** shows revealed blocks, days and run times. Its CSV export includes revealed runs. History is stored on the device that ran the app.
- On a TV, use the D-pad to move focus and Select to activate a control. On a keyboard, use arrow keys or Tab, Enter and Escape.

## Run or host it

Serve this directory over HTTPS or localhost, for example with `python3 -m http.server 8000`. Open the page, press **Start** and allow microphone access. Android TV needs a browser with microphone access and AudioWorklet support. Installation is available through compatible browsers. Once cached, the app works offline. Audio is processed on-device.

For GitHub Pages, deploy from the root of the default branch. All app URLs are relative so the PWA can be hosted below a repository path. When changing bundled assets, increment the cache version in `service-worker.js`.

## Microphone extractor

`TRNG.audioWorklet.js` comes from Joakim Christiansen's [TRNG Mind Over Matter Experiments](https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/blob/main/TRNG.audioWorklet.js). The browser adapter creates the same worklet and requests one 32-bit word per block, at roughly 30 blocks per second. The maze uses the UFO experiment's absolute bit imbalance to compute its target speed.

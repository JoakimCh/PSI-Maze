# PSI Maze

An installable, microphone-driven PWA for TVs, desktops and phones. The game splits each 32-bit word into four bytes. Each set bit adds half a point to its direction, giving left, right, up and down a 0–4 weight each. Opposing directions cancel.

- **Maze** uses the directional signal that points along the corridor. The dot can stop and can only move forward. Every maze is 179 grid steps. A player sees the same layout at all four rotations, then moves on to a new layout.
- **Apple Catch** uses both axes. The arena wraps at each edge. Red apples spawn at the same shortest distance from the yellow dot, and five catches complete a run.
- **Players** are local to the browser. Use the player button to add, rename or switch profiles.
- **History** reveals a player's results for each mode after every seven local calendar days with a completed run. Days can be nonconsecutive. A block's typical time is the median of its seven daily medians. Runs later on the seventh day still count toward that block. Elapsed times stay hidden during play. History and CSV exports show only revealed runs.
- On a TV, use the D-pad to move focus and Select to activate a control. On a keyboard, use arrow keys or Tab, Enter and Escape.

## Run or host it

Serve this directory over HTTPS or localhost, for example with `python3 -m http.server 8000`. Open the page, press **Start** and allow microphone access. Android TV needs a browser with microphone access and AudioWorklet support. Installation is available through compatible browsers. Once cached, the app works offline. Audio is processed on-device.

For GitHub Pages, deploy from the root of the default branch. All app URLs are relative so the PWA can be hosted below a repository path. When changing bundled assets, increment the cache version in `service-worker.js`.

## Microphone extractor

`TRNG.audioWorklet.js` comes from Joakim Christiansen's [TRNG Mind Over Matter Experiments](https://github.com/JoakimCh/TRNG-Mind-Over-Matter-Experiments/blob/main/TRNG.audioWorklet.js). The browser adapter requests one 32-bit word per block, at roughly 30 blocks per second.

// Global tick pause state — shared between terminal handler and game loop
let paused = false;

function isPaused() { return paused; }
function setPaused(v) { paused = v; }

module.exports = { isPaused, setPaused };

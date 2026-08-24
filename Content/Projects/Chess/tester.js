// tester.js — "Test mode": a free-move sandbox layered on top of the current
// game. It lets the player shuffle either side's pieces, run variations, and
// pull up Stockfish analysis for any position, with a one-tap reset back to
// the position where test mode was entered.
//
// The real game is untouched underneath: entering test mode snapshots it, and
// leaving restores it exactly, so the player can improvise freely and then
// carry on the actual game exactly as it was.

export function createTester(app) {
  const { testBtn, resetBtn } = app;
  let testing = false;
  let backup = null; // the real game, saved when test mode starts
  let startFen = null; // where the working board resets to

  const tint = (on) => document.body.classList.toggle("testing", on);

  function updateButtons() {
    testBtn.classList.toggle("on", testing);
    testBtn.textContent = testing ? "Test ✓" : "Test";
    resetBtn.classList.toggle("hidden", !testing);
  }

  function start() {
    if (testing) return;
    backup = app.snapshot();
    startFen = backup.fen;
    app.cancelEngine();
    testing = true;
    app.setWorking(startFen);
    tint(true);
    updateButtons();
    app.renderAll();
  }

  function stop() {
    if (!testing) return;
    app.cancelEngine();
    testing = false;
    app.restoreTest(backup);
    tint(false);
    updateButtons();
    app.renderAll();
    app.resume();
  }

  function reset() {
    if (!testing) return;
    app.cancelEngine();
    app.setWorking(startFen);
    app.renderAll();
  }

  // A playable variation was made: score it and refresh the helper views, then
  // have Stockfish size up the new live position so the player gets feedback.
  async function afterMove() {
    const i = app.currentIndex();
    await app.analyzeIndex(i);
    if (!testing) return;
    app.renderMoves();
    app.renderAnalysis();
    app.renderEval();
    app.refreshLive();
    app.updateStatus();
  }

  function isOn() { return testing; }
  function toggle() { return testing ? stop() : start(); }

  testBtn.addEventListener("click", toggle);
  resetBtn.addEventListener("click", reset);

  updateButtons();

  return { isOn, toggle, reset, start, stop, afterMove };
}
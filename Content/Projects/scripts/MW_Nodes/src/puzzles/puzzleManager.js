/**
 * Puzzle Manager - Orchestrates puzzle loading, verification, canvas HUD, and completion.
 */
import { getAllPuzzles, getPuzzleById, PUZZLE_SCREENSHOTS } from './puzzlesData.js';

const COMPLETED_STORAGE_KEY = 'miliastra_completed_puzzles_v1';

export class PuzzleManager {
  constructor(state, renderer, simulator) {
    this.state = state;
    this.renderer = renderer;
    this.simulator = simulator;
    this.activePuzzle = null;
    this.hudElement = null;

    // Load completed IDs
    this.completedPuzzleIds = new Set();
    try {
      const stored = localStorage.getItem(COMPLETED_STORAGE_KEY);
      if (stored) {
        JSON.parse(stored).forEach(id => this.completedPuzzleIds.add(id));
      }
    } catch (_) {}

    // Listen to simulator finishes in case puzzle test was running
    window.addEventListener('miliastra_simulation_completed', (e) => {
      if (this.activePuzzle && this._isVerifying) {
        this._isVerifying = false;
        this.evaluatePuzzleResult(e.detail?.simulatedState);
      }
    });
  }

  isCompleted(puzzleId) {
    return this.completedPuzzleIds.has(puzzleId);
  }

  markCompleted(puzzleId) {
    this.completedPuzzleIds.add(puzzleId);
    try {
      localStorage.setItem(COMPLETED_STORAGE_KEY, JSON.stringify([...this.completedPuzzleIds]));
    } catch (_) {}
    window.dispatchEvent(new CustomEvent('miliastra_puzzle_completed', { detail: { puzzleId } }));
  }

  /**
   * Load puzzle challenge into active graph
   */
  loadPuzzle(puzzleId) {
    const puzzle = getPuzzleById(puzzleId);
    if (!puzzle) {
      console.error(`Puzzle not found: ${puzzleId}`);
      return;
    }

    this.activePuzzle = puzzle;

    // Clear current graph and load puzzle template
    this.state.nodes = [];
    this.state.wires = [];
    this.state.comments = [];
    this.state.notes = [];
    this.state.name = puzzle.title;

    const init = puzzle.initialGraph || {};

    if (init.nodes && init.nodes.length > 0) {
      // Clone nodes
      this.state.nodes = JSON.parse(JSON.stringify(init.nodes));
    }
    if (init.wires && init.wires.length > 0) {
      this.state.wires = JSON.parse(JSON.stringify(init.wires));
    }
    if (init.notes && init.notes.length > 0) {
      // Attach screenshot SVG if defined
      const clonedNotes = JSON.parse(JSON.stringify(init.notes));
      clonedNotes.forEach(note => {
        if (note.screenshotKey && PUZZLE_SCREENSHOTS[note.screenshotKey]) {
          note.screenshotSvg = PUZZLE_SCREENSHOTS[note.screenshotKey];
        }
      });
      this.state.notes = clonedNotes;
    }

    // Refresh renderer
    this.renderer.panX = 100;
    this.renderer.panY = 100;
    this.renderer.render();

    // Show on-canvas puzzle HUD
    this.showCanvasHud();
  }

  /**
   * Floating Top Banner on the canvas
   */
  showCanvasHud() {
    this.hideCanvasHud();
    if (!this.activePuzzle) return;

    const pz = this.activePuzzle;
    const hud = document.createElement('div');
    hud.id = 'puzzleCanvasHud';
    hud.className = 'puzzle-canvas-hud';

    hud.innerHTML = `
      <div class="puzzle-hud-info">
        <div class="puzzle-hud-title">
          <span class="puzzle-hud-tag">${pz.difficulty}</span>
          <span>${pz.title}</span>
        </div>
        <div class="puzzle-hud-desc" title="${pz.summary}">${pz.summary}</div>
      </div>
      <div class="puzzle-hud-btns">
        <button id="btnPzVerify" class="puzzle-hud-btn-check" title="Run simulation and verify conditions">
          <span>▶ Check & Test</span>
        </button>
        <button id="btnPzHint" class="puzzle-hud-btn-sec" title="View Objective & Notes">
          <span>Objective & Info</span>
        </button>
        <button id="btnPzSolution" class="puzzle-hud-btn-sec" title="Peek Solution">
          <span>Solution</span>
        </button>
        <button id="btnPzExit" class="puzzle-hud-btn-sec" title="Exit Puzzle Mode">
          <span>✕ Exit</span>
        </button>
      </div>
    `;

    document.body.appendChild(hud);
    this.hudElement = hud;

    hud.querySelector('#btnPzVerify').addEventListener('click', () => {
      this.verifyCurrentPuzzle();
    });
    hud.querySelector('#btnPzHint').addEventListener('click', () => {
      this.showPuzzleDetailsModal(this.activePuzzle);
    });
    hud.querySelector('#btnPzSolution').addEventListener('click', () => {
      this.showSolutionModal(this.activePuzzle);
    });
    hud.querySelector('#btnPzExit').addEventListener('click', () => {
      this.exitPuzzleMode();
    });
  }

  hideCanvasHud() {
    if (this.hudElement && this.hudElement.parentNode) {
      this.hudElement.parentNode.removeChild(this.hudElement);
    }
    this.hudElement = null;
  }

  exitPuzzleMode() {
    this.activePuzzle = null;
    this.hideCanvasHud();
  }

  /**
   * Run simulation and test criteria
   */
  async verifyCurrentPuzzle() {
    if (!this.activePuzzle) return;
    const pz = this.activePuzzle;

    // First, run simulation so simulation logs & state are fresh
    this._isVerifying = true;
    if (this.simulator && typeof this.simulator.runSimulation === 'function') {
      await this.simulator.runSimulation();
    } else {
      this.evaluatePuzzleResult(null);
    }
  }

  evaluatePuzzleResult(simState) {
    if (!this.activePuzzle) return;
    const pz = this.activePuzzle;

    if (!pz.validation || typeof pz.validation.check !== 'function') {
      this.showSuccessModal('Puzzle logic fulfilled!');
      return;
    }

    const result = pz.validation.check(this.state, simState || this.simulator?.simulatedState);

    if (result.success) {
      this.markCompleted(pz.id);
      this.playVictorySound();
      this.showSuccessModal(result.message || 'All conditions satisfied!');
    } else {
      this.showErrorModal(result.message || 'Requirements not met yet. Check the instructions and node wiring!');
    }
  }

  /**
   * Web Audio API Chime (pure JS, zero dependencies)
   */
  playVictorySound() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.value = freq;

        const startTime = ctx.currentTime + idx * 0.1;
        const endTime = startTime + 0.55;

        gain.gain.setValueAtTime(0.01, startTime);
        gain.gain.exponentialRampToValueAtTime(0.25, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(endTime);
      });
    } catch (_) {}
  }

  showSuccessModal(message) {
    const modal = document.createElement('div');
    modal.className = 'puzzle-success-modal';
    modal.innerHTML = `
      <div class="puzzle-success-card">
        <div class="puzzle-success-icon-badge">✓</div>
        <div class="puzzle-success-title">PUZZLE COMPLETED!</div>
        <div class="puzzle-success-msg">${message}</div>
        <div class="puzzle-success-btns">
          <button id="btnKeepBuilding" class="puzzles-btn-secondary" style="flex: 1; padding: 10px;">
            Keep Experimenting
          </button>
          <button id="btnNextPuzzle" class="puzzles-btn-primary" style="flex: 1; padding: 10px;">
            Next Puzzle →
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btnKeepBuilding').addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('#btnNextPuzzle').addEventListener('click', () => {
      modal.remove();
      const all = getAllPuzzles();
      const currIdx = all.findIndex(p => p.id === this.activePuzzle?.id);
      if (currIdx >= 0 && currIdx < all.length - 1) {
        this.loadPuzzle(all[currIdx + 1].id);
      } else {
        // Open explorer
        window.dispatchEvent(new CustomEvent('miliastra_open_puzzles_explorer'));
      }
    });
  }

  showErrorModal(message) {
    const modal = document.createElement('div');
    modal.className = 'puzzle-success-modal';
    modal.innerHTML = `
      <div class="puzzle-success-card" style="border-color: #ef4444; box-shadow: 0 16px 40px rgba(239, 68, 68, 0.25);">
        <div class="puzzle-success-icon-badge" style="background: rgba(239, 68, 68, 0.2); border-color: #ef4444; color: #f87171;">✕</div>
        <div class="puzzle-success-title" style="color: #f87171;">NOT QUITE YET</div>
        <div class="puzzle-success-msg">${message}</div>
        <div class="puzzle-success-btns">
          <button id="btnCloseErr" class="puzzles-btn-primary" style="flex: 1; padding: 10px; background: #374151; border-color: #4b5563;">
            Got it, let me fix it!
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.querySelector('#btnCloseErr').addEventListener('click', () => modal.remove());
  }

  showSolutionModal(puzzle) {
    if (!puzzle.solution) {
      alert('No solution recorded for this puzzle.');
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'puzzles-modal-overlay';
    modal.innerHTML = `
      <div class="puzzles-explorer-window" style="width: 650px; height: auto; max-height: 80vh;">
        <div class="puzzles-header">
          <div class="puzzles-title-wrap">
            <span class="puzzles-badge-icon">SOLUTION</span>
            <span class="puzzles-title">${puzzle.title}</span>
          </div>
          <button id="btnPzSolClose" class="puzzles-close-btn">×</button>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 14px; overflow-y: auto;">
          <div style="font-size: 13.5px; color: #cbd5e1; line-height: 1.6;">
            <strong>Solution Walkthrough:</strong>
            <p style="margin-top: 6px;">${puzzle.solution.explanation}</p>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button id="btnLoadSolGraph" class="puzzles-btn-primary" style="flex: 1; padding: 10px;">
              Load Solution Onto Canvas
            </button>
            <button id="btnDismissSol" class="puzzles-btn-secondary" style="padding: 10px 16px;">
              Close
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btnPzSolClose').addEventListener('click', () => modal.remove());
    modal.querySelector('#btnDismissSol').addEventListener('click', () => modal.remove());
    modal.querySelector('#btnLoadSolGraph').addEventListener('click', () => {
      modal.remove();
      if (puzzle.solution.graph) {
        if (puzzle.solution.graph.nodes) {
          this.state.nodes = JSON.parse(JSON.stringify(puzzle.solution.graph.nodes));
        }
        if (puzzle.solution.graph.wires) {
          this.state.wires = JSON.parse(JSON.stringify(puzzle.solution.graph.wires));
        }
        this.renderer.render();
      }
    });
  }

  showPuzzleDetailsModal(puzzle) {
    window.dispatchEvent(new CustomEvent('miliastra_open_puzzles_explorer', { detail: { selectedId: puzzle.id } }));
  }
}

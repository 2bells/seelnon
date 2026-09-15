/**
 * Puzzle Explorer UI - Brutalist Explorer dialog for browsing, playing, and creating puzzles.
 */
import { getAllPuzzles, getPuzzleById, PUZZLE_SCREENSHOTS, saveCustomPuzzle } from './puzzlesData.js';

export class PuzzleExplorer {
  constructor(puzzleManager) {
    this.puzzleManager = puzzleManager;
    this.isOpen = false;
    this.selectedPuzzleId = null;
    this.selectedCategory = 'All';
    this.searchQuery = '';
    this.element = null;

    // Listen to global open requests
    window.addEventListener('miliastra_open_puzzles_explorer', (e) => {
      this.open(e.detail?.selectedId);
    });

    window.addEventListener('miliastra_puzzle_completed', () => {
      if (this.isOpen) {
        this.renderList();
        this.renderDetails();
      }
    });
  }

  open(preselectId) {
    if (this.isOpen) {
      if (preselectId) {
        this.selectedPuzzleId = preselectId;
        this.renderList();
        this.renderDetails();
      }
      return;
    }
    this.isOpen = true;
    const puzzles = getAllPuzzles();
    this.selectedPuzzleId = preselectId || (puzzles.length > 0 ? puzzles[0].id : null);
    this.initDom();
  }

  close() {
    this.isOpen = false;
    if (this.element && this.element.parentNode) {
      this.element.parentNode.removeChild(this.element);
    }
    this.element = null;
  }

  initDom() {
    const overlay = document.createElement('div');
    overlay.className = 'puzzles-modal-overlay';
    overlay.id = 'puzzlesModalOverlay';

    const win = document.createElement('div');
    win.className = 'puzzles-explorer-window';
    win.id = 'puzzlesExplorerWindow';

    // Center window by default
    const left = Math.max(20, Math.floor((window.innerWidth - 1040) / 2));
    const top = Math.max(50, Math.floor((window.innerHeight - 680) / 2));
    win.style.left = `${left}px`;
    win.style.top = `${top}px`;

    win.innerHTML = `
      <div class="sig-header" id="puzzlesHeader">
        <div class="sig-header-left">
          <span class="sig-header-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor"/>
              <path d="M9 3v18"/>
              <path d="M9 9h12"/>
              <path d="M9 15h12"/>
            </svg>
          </span>
          <span class="sig-header-title">Miliastra Wonderland Puzzle Explorer</span>
        </div>
        <div class="sig-header-actions">
          <button id="btnCreateCustomPuzzle" class="puzzles-btn-secondary" style="height: 26px; padding: 0 10px; font-size: 11px;">+ New Puzzle</button>
          <button id="btnExportPuzzles" class="puzzles-btn-secondary" style="height: 26px; padding: 0 10px; font-size: 11px;">Export JSON</button>
          <button id="btnImportPuzzles" class="puzzles-btn-secondary" style="height: 26px; padding: 0 10px; font-size: 11px;">Import JSON</button>
          <input type="file" id="puzzleFileInput" accept=".json" style="display: none;" />
          <button class="sig-btn-icon sig-close-btn" id="btnClosePuzzles" title="Close">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="puzzles-body">
        <!-- Sidebar -->
        <div class="puzzles-sidebar" id="puzzlesSidebar"></div>

        <!-- List -->
        <div class="puzzles-list-pane" id="puzzlesListPane">
          <div style="margin-bottom: 8px;">
            <input type="text" id="puzzleSearchInput" placeholder="Search puzzles & tags..." 
                   style="width: 100%; background: #1a1e2b; border: 1px solid #2b3245; color: #f1f5f9; padding: 6px 10px; font-size: 12px; border-radius: 3px; outline: none;" />
          </div>
          <div id="puzzlesListItems" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>

        <!-- Details -->
        <div class="puzzles-detail-pane" id="puzzlesDetailPane"></div>
      </div>
    `;

    overlay.appendChild(win);
    document.body.appendChild(overlay);
    this.element = overlay;

    // Draggable header
    const header = win.querySelector('#puzzlesHeader');
    let isDragging = false;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    header.addEventListener('mousedown', (e) => {
      if (e.target.closest('button') || e.target.closest('input')) return;
      isDragging = true;
      const rect = win.getBoundingClientRect();
      dragOffsetX = e.clientX - rect.left;
      dragOffsetY = e.clientY - rect.top;
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const maxLeft = window.innerWidth - 100;
      const maxTop = window.innerHeight - 80;
      const newLeft = Math.max(10, Math.min(maxLeft, e.clientX - dragOffsetX));
      const newTop = Math.max(30, Math.min(maxTop, e.clientY - dragOffsetY));
      win.style.left = `${newLeft}px`;
      win.style.top = `${newTop}px`;
    });

    window.addEventListener('mouseup', () => {
      isDragging = false;
    });

    // Hook header buttons
    win.querySelector('#btnClosePuzzles').addEventListener('click', () => this.close());
    win.querySelector('#btnCreateCustomPuzzle').addEventListener('click', () => this.openCreatePuzzleModal());
    win.querySelector('#btnExportPuzzles').addEventListener('click', () => this.exportPuzzlesAsJson());
    
    const fileInput = win.querySelector('#puzzleFileInput');
    win.querySelector('#btnImportPuzzles').addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleImportJson(e));

    const searchInput = win.querySelector('#puzzleSearchInput');
    searchInput.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderList();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close();
    });

    this.renderCategories();
    this.renderList();
    this.renderDetails();
  }

  getCategories() {
    const puzzles = getAllPuzzles();
    const map = { 'All': puzzles.length };
    puzzles.forEach(p => {
      const cat = p.category || 'General';
      map[cat] = (map[cat] || 0) + 1;
    });
    return map;
  }

  renderCategories() {
    const sidebar = this.element.querySelector('#puzzlesSidebar');
    if (!sidebar) return;
    sidebar.innerHTML = '';

    const cats = this.getCategories();
    Object.keys(cats).forEach(cat => {
      const btn = document.createElement('button');
      btn.className = `puzzles-cat-btn ${this.selectedCategory === cat ? 'active' : ''}`;
      btn.innerHTML = `
        <span>${cat}</span>
        <span class="puzzles-cat-count">${cats[cat]}</span>
      `;
      btn.addEventListener('click', () => {
        this.selectedCategory = cat;
        this.renderCategories();
        this.renderList();
      });
      sidebar.appendChild(btn);
    });
  }

  getFilteredPuzzles() {
    let list = getAllPuzzles();
    if (this.selectedCategory !== 'All') {
      list = list.filter(p => (p.category || 'General') === this.selectedCategory);
    }
    if (this.searchQuery) {
      list = list.filter(p => {
        const titleMatch = p.title.toLowerCase().includes(this.searchQuery);
        const descMatch = (p.summary || '').toLowerCase().includes(this.searchQuery);
        const tagMatch = (p.tags || []).some(t => t.toLowerCase().includes(this.searchQuery));
        return titleMatch || descMatch || tagMatch;
      });
    }
    return list;
  }

  renderList() {
    const listContainer = this.element.querySelector('#puzzlesListItems');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const list = this.getFilteredPuzzles();
    if (list.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 24px; text-align: center; color: #64748b; font-size: 12px;">
          No puzzles found in this category.
        </div>
      `;
      return;
    }

    list.forEach(pz => {
      const isCompleted = this.puzzleManager.isCompleted(pz.id);
      const isSelected = this.selectedPuzzleId === pz.id;

      const card = document.createElement('div');
      card.className = `puzzle-card ${isSelected ? 'active' : ''}`;
      card.innerHTML = `
        <div class="puzzle-card-top">
          <span class="puzzle-diff-tag puzzle-diff-${pz.difficulty || 'Beginner'}">${pz.difficulty || 'Beginner'}</span>
          ${isCompleted ? '<span class="puzzle-status-icon">✓ Completed</span>' : ''}
        </div>
        <div class="puzzle-card-title">${pz.title}</div>
        <div class="puzzle-card-desc">${pz.summary || ''}</div>
        <div class="puzzle-tags-row">
          ${(pz.tags || []).map(t => `<span class="puzzle-tag-pill">#${t}</span>`).join('')}
        </div>
      `;

      card.addEventListener('click', () => {
        this.selectedPuzzleId = pz.id;
        this.renderList();
        this.renderDetails();
      });

      listContainer.appendChild(card);
    });
  }

  renderDetails() {
    const pane = this.element.querySelector('#puzzlesDetailPane');
    if (!pane) return;
    pane.innerHTML = '';

    const puzzle = getPuzzleById(this.selectedPuzzleId);
    if (!puzzle) {
      pane.innerHTML = `
        <div style="display: flex; height: 100%; align-items: center; justify-content: center; color: #64748b;">
          Select a puzzle from the list to view instructions and scene preview.
        </div>
      `;
      return;
    }

    const isCompleted = this.puzzleManager.isCompleted(puzzle.id);
    const screenshotSvg = puzzle.screenshotKey && PUZZLE_SCREENSHOTS[puzzle.screenshotKey] 
      ? PUZZLE_SCREENSHOTS[puzzle.screenshotKey] 
      : puzzle.screenshotSvg || null;

    // Extract only Objective text from instructions
    let objectiveText = puzzle.objective || '';
    if (!objectiveText && puzzle.instructions) {
      const match = puzzle.instructions.match(/### Objective\s*([\s\S]*?)(?=###|$)/i);
      if (match) {
        objectiveText = match[1].trim();
      } else {
        objectiveText = puzzle.instructions;
      }
    }

    let objectiveHtml = objectiveText
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/`([^`]+)`/gim, '<code>$1</code>')
      .replace(/\n\n/gim, '<br/><br/>');

    pane.innerHTML = `
      <div class="puzzle-detail-header">
        <div style="display: flex; align-items: center; justify-content: space-between;">
          <span class="puzzle-diff-tag puzzle-diff-${puzzle.difficulty || 'Beginner'}">${puzzle.difficulty || 'Beginner'}</span>
          <span style="font-size: 12px; color: ${isCompleted ? '#4ade80' : '#94a3b8'}; font-weight: 700;">
            ${isCompleted ? '✓ SOLVED & COMPLETED' : '○ INCOMPLETE'}
          </span>
        </div>
        <div class="puzzle-detail-title">${puzzle.title}</div>
        <div class="puzzle-detail-meta">
          <span>Category: <strong>${puzzle.category || 'General'}</strong></span>
          <span>•</span>
          <span>Author: <strong>${puzzle.author || 'Community'}</strong></span>
        </div>
      </div>

      ${screenshotSvg ? `
        <div class="puzzle-detail-screenshot-wrap">
          ${screenshotSvg}
        </div>
      ` : ''}

      <div class="puzzle-instructions-box">
        <h3 style="color: #e5a93c; font-size: 12.5px; margin: 0 0 6px 0; font-weight: 600;">Objective</h3>
        <div>${objectiveHtml}</div>
      </div>

      <div class="puzzle-actions-footer">
        <button id="btnLoadPuzzle" class="puzzles-btn-primary" style="flex: 2; padding: 10px 18px; font-size: 13px;">
          ▶ Load Challenge Graph
        </button>
        ${puzzle.solution ? `
          <button id="btnViewSol" class="puzzles-btn-secondary" style="flex: 1; padding: 10px 14px; font-size: 12px;">
            Solution Walkthrough
          </button>
        ` : ''}
      </div>
    `;

    pane.querySelector('#btnLoadPuzzle').addEventListener('click', () => {
      this.close();
      this.puzzleManager.loadPuzzle(puzzle.id);
    });

    const solBtn = pane.querySelector('#btnViewSol');
    if (solBtn) {
      solBtn.addEventListener('click', () => {
        this.puzzleManager.showSolutionModal(puzzle);
      });
    }
  }

  openCreatePuzzleModal() {
    const curNodes = this.puzzleManager.state.nodes || [];
    const modal = document.createElement('div');
    modal.className = 'puzzles-modal-overlay';
    modal.innerHTML = `
      <div class="puzzles-explorer-window" style="width: 620px; height: auto; max-height: 85vh;">
        <div class="puzzles-header">
          <div class="puzzles-title-wrap">
            <span class="puzzles-badge-icon">CREATOR</span>
            <span class="puzzles-title">Save Graph as New Puzzle</span>
          </div>
          <button id="btnCreateClose" class="puzzles-close-btn">×</button>
        </div>
        <div style="padding: 20px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto;">
          <div>
            <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Puzzle Title</label>
            <input type="text" id="newPzTitle" value="My Custom Mechanism Challenge" 
                   style="width: 100%; background: #1a1e2b; border: 1px solid #2b3245; color: #f1f5f9; padding: 8px 10px; font-size: 13px; border-radius: 3px;" />
          </div>
          <div style="display: flex; gap: 10px;">
            <div style="flex: 1;">
              <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Category</label>
              <select id="newPzCategory" style="width: 100%; background: #1a1e2b; border: 1px solid #2b3245; color: #f1f5f9; padding: 7px 10px; font-size: 12px; border-radius: 3px;">
                <option value="Mechanism & Tabs">Mechanism & Tabs</option>
                <option value="Conditionals & Flow">Conditionals & Flow</option>
                <option value="Loops & Iteration">Loops & Iteration</option>
                <option value="Signals & Communication">Signals & Communication</option>
                <option value="Custom Challenges" selected>Custom Challenges</option>
              </select>
            </div>
            <div style="flex: 1;">
              <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Difficulty</label>
              <select id="newPzDiff" style="width: 100%; background: #1a1e2b; border: 1px solid #2b3245; color: #f1f5f9; padding: 7px 10px; font-size: 12px; border-radius: 3px;">
                <option value="Beginner">Beginner</option>
                <option value="Intermediate" selected>Intermediate</option>
                <option value="Advanced">Advanced</option>
              </select>
            </div>
          </div>
          <div>
            <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Summary / Hint</label>
            <input type="text" id="newPzSummary" placeholder="Short description shown on card..." 
                   value="Build the logic network described in the notes to complete this challenge."
                   style="width: 100%; background: #1a1e2b; border: 1px solid #2b3245; color: #f1f5f9; padding: 8px 10px; font-size: 12px; border-radius: 3px;" />
          </div>
          <div>
            <label style="font-size: 12px; color: #94a3b8; display: block; margin-bottom: 4px;">Mission Instructions</label>
            <textarea id="newPzInstructions" rows="4" 
                      style="width: 100%; background: #1a1e2b; border: 1px solid #2b3245; color: #f1f5f9; padding: 8px 10px; font-size: 12px; border-radius: 3px; resize: vertical;">Describe the challenge rules and objective here. Users will read this when loading the puzzle.</textarea>
          </div>
          <div style="display: flex; gap: 10px; margin-top: 8px;">
            <button id="btnSaveNewPuzzle" class="puzzles-btn-primary" style="flex: 1; padding: 10px;">
              Save to Puzzles Library (${curNodes.length} nodes currently on canvas)
            </button>
            <button id="btnCancelNew" class="puzzles-btn-secondary" style="padding: 10px 16px;">
              Cancel
            </button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('#btnCreateClose').addEventListener('click', () => modal.remove());
    modal.querySelector('#btnCancelNew').addEventListener('click', () => modal.remove());
    modal.querySelector('#btnSaveNewPuzzle').addEventListener('click', () => {
      const title = modal.querySelector('#newPzTitle').value.trim() || 'Custom Challenge';
      const category = modal.querySelector('#newPzCategory').value;
      const difficulty = modal.querySelector('#newPzDiff').value;
      const summary = modal.querySelector('#newPzSummary').value.trim();
      const instructions = modal.querySelector('#newPzInstructions').value.trim();

      const newId = 'custom_puzzle_' + Date.now();
      const customPz = {
        id: newId,
        title,
        category,
        difficulty,
        summary,
        instructions,
        author: 'User',
        tags: ['Custom', category],
        initialGraph: {
          name: title,
          nodes: JSON.parse(JSON.stringify(this.puzzleManager.state.nodes || [])),
          wires: JSON.parse(JSON.stringify(this.puzzleManager.state.wires || [])),
          comments: JSON.parse(JSON.stringify(this.puzzleManager.state.comments || [])),
          notes: JSON.parse(JSON.stringify(this.puzzleManager.state.notes || []))
        },
        validation: {
          check: (graphState) => {
            if (graphState.nodes.length >= curNodes.length && curNodes.length > 0) {
              return { success: true, message: 'Custom puzzle requirements verified!' };
            }
            return { success: false, message: 'Construct the graph structure according to instructions.' };
          }
        }
      };

      saveCustomPuzzle(customPz);
      modal.remove();
      this.selectedCategory = category;
      this.selectedPuzzleId = newId;
      this.renderCategories();
      this.renderList();
      this.renderDetails();
    });
  }

  exportPuzzlesAsJson() {
    const puzzles = getAllPuzzles();
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(puzzles, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `miliastra_puzzles_export_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  handleImportJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        const list = Array.isArray(imported) ? imported : [imported];
        let count = 0;
        list.forEach(item => {
          if (item.title && item.id) {
            saveCustomPuzzle(item);
            count++;
          }
        });
        alert(`Successfully imported ${count} puzzle(s)!`);
        this.renderCategories();
        this.renderList();
      } catch (err) {
        alert('Invalid JSON file format.');
      }
    };
    reader.readAsText(file);
  }
}

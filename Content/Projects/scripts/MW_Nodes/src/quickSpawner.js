/**
 * Miliastra Wonderland Quick Node Spawner
 * Instant keyboard-driven popup menu to search & place nodes directly at the mouse cursor.
 */

import { getAllNodes, CATEGORIES } from './nodesData.js';

function parseFolderNumber(folderStr) {
  if (!folderStr) return null;
  const m = folderStr.match(/^([IVXLCDM\d]+)/i);
  if (!m) return null;
  const token = m[1];
  if (/^\d+$/.test(token)) return parseInt(token, 10);
  const roman = { i: 1, v: 5, x: 10, l: 50, c: 100, d: 500, m: 1000 };
  let val = 0;
  let prev = 0;
  const clean = token.toLowerCase();
  for (let i = clean.length - 1; i >= 0; i--) {
    const curr = roman[clean[i]];
    if (!curr) return null;
    if (curr < prev) val -= curr;
    else { val += curr; prev = curr; }
  }
  return val > 0 ? val : null;
}

export class QuickSpawner {
  constructor(rootContainer, graphState, renderer) {
    this.root = rootContainer;
    this.state = graphState;
    this.renderer = renderer;

    this.isOpen = false;
    this.spawnCanvasX = 0;
    this.spawnCanvasY = 0;
    this.pendingWireConnection = null;
    this.selectedIndex = 0;
    this.selectedCategoryIndex = 0;
    this.filteredResults = [];
    this.selectedCategory = null;

    this.initDOM();
    this.attachEvents();
  }

  initDOM() {
    this.modal = document.createElement('div');
    this.modal.className = 'quick-spawner-modal';
    this.modal.style.display = 'none';

    this.modal.innerHTML = `
      <div class="spawner-header">
        <span class="spawner-search-icon">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </span>
        <input type="text" class="spawner-input" id="spawnerInput" placeholder="Type node name..." autocomplete="off" />
        <span class="spawner-esc-hint">ESC</span>
      </div>
      <div class="spawner-results" id="spawnerResults"></div>
    `;

    this.root.appendChild(this.modal);
    this.input = this.modal.querySelector('#spawnerInput');
    this.resultsList = this.modal.querySelector('#spawnerResults');
  }

  attachEvents() {
    this.input.addEventListener('input', () => {
      this.selectedIndex = 0;
      this.updateResults();
    });

    this.input.addEventListener('keydown', (e) => {
      const query = this.input.value.trim();
      const isCategoriesView = !this.selectedCategory && !query;
      const categoriesList = Object.values(CATEGORIES);

      if (isCategoriesView) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedCategoryIndex = (this.selectedCategoryIndex + 2) % categoriesList.length;
          this.highlightSelectedCategory();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedCategoryIndex = (this.selectedCategoryIndex - 2 + categoriesList.length) % categoriesList.length;
          this.highlightSelectedCategory();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.selectedCategoryIndex = (this.selectedCategoryIndex + 1) % categoriesList.length;
          this.highlightSelectedCategory();
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.selectedCategoryIndex = (this.selectedCategoryIndex - 1 + categoriesList.length) % categoriesList.length;
          this.highlightSelectedCategory();
        } else if (e.key === 'Tab') {
          e.preventDefault();
          const step = e.shiftKey ? -1 : 1;
          this.selectedCategoryIndex = (this.selectedCategoryIndex + step + categoriesList.length) % categoriesList.length;
          this.highlightSelectedCategory();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const chosenCat = categoriesList[this.selectedCategoryIndex];
          if (chosenCat) {
            this.selectedCategory = chosenCat.id;
            this.selectedIndex = 0;
            this.input.focus();
            this.updateResults();
          }
        } else if (e.key === 'Escape') {
          this.close();
        }
        return;
      }

      if (e.key === 'Backspace' && !query && this.selectedCategory) {
        // Return to categories view on backspace in empty query
        this.selectedCategory = null;
        this.selectedCategoryIndex = 0;
        this.selectedIndex = 0;
        this.updateResults();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.filteredResults.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filteredResults.length;
          this.highlightSelected();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.filteredResults.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.filteredResults.length) % this.filteredResults.length;
          this.highlightSelected();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (this.filteredResults.length > 0) {
          this.spawnNode(this.filteredResults[this.selectedIndex]);
        }
      } else if (e.key === 'Escape') {
        if (this.selectedCategory) {
          this.selectedCategory = null;
          this.selectedCategoryIndex = 0;
          this.updateResults();
        } else {
          this.close();
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (this.isOpen && !this.modal.contains(e.target)) {
        this.close();
      }
    });

    // Spacebar to open quick spawner at current cursor
    window.addEventListener('keydown', (e) => {
      if (e.key === ' ' && !this.isOpen) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable ||
            activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable ||
            e.target.closest('.ide-container') || document.activeElement?.closest('.ide-container') ||
            e.target.closest('.comment-tray') || document.activeElement?.closest('.comment-tray') ||
            e.target.closest('.note-bubble') || document.activeElement?.closest('.note-bubble') ||
            e.target.closest('.param-input') || document.activeElement?.closest('.param-input')) {
          return;
        }
        e.preventDefault();
        const rect = this.renderer.container.getBoundingClientRect();
        const screenX = Math.max(rect.left + 50, Math.min(rect.right - 350, window.lastMouseX || (rect.left + rect.width / 2)));
        const screenY = Math.max(rect.top + 50, Math.min(rect.bottom - 400, window.lastMouseY || (rect.top + rect.height / 2)));
        const canvasCoord = this.renderer.screenToCanvas(screenX, screenY);
        this.openAt(screenX, screenY, canvasCoord.x, canvasCoord.y);
      }
    });

    window.addEventListener('mousemove', (e) => {
      window.lastMouseX = e.clientX;
      window.lastMouseY = e.clientY;
    });
  }

  openAt(screenX, screenY, canvasX, canvasY, pendingWire = null) {
    this.isOpen = true;
    this.spawnCanvasX = canvasX;
    this.spawnCanvasY = canvasY;
    this.pendingWireConnection = pendingWire;
    this.selectedCategory = null;
    this.selectedCategoryIndex = 0;

    // Position modal safely inside viewport
    const modalW = 340;
    const modalH = 400;
    let posX = screenX;
    let posY = screenY;

    if (posX + modalW > window.innerWidth - 20) {
      posX = window.innerWidth - modalW - 20;
    }
    if (posY + modalH > window.innerHeight - 20) {
      posY = window.innerHeight - modalH - 20;
    }

    this.modal.style.left = `${posX}px`;
    this.modal.style.top = `${posY}px`;
    this.modal.style.display = 'flex';

    this.input.value = '';
    this.selectedIndex = 0;
    this.selectedCategoryIndex = 0;
    this.updateResults();

    setTimeout(() => {
      this.input.focus();
    }, 20);
  }

  close() {
    this.isOpen = false;
    this.modal.style.display = 'none';
    this.pendingWireConnection = null;
    this.selectedCategory = null;
    if (this.renderer && typeof this.renderer.clearActiveDragWire === 'function') {
      this.renderer.clearActiveDragWire();
    }
  }

  updateResults() {
    const query = this.input.value.trim().toLowerCase();
    let results = getAllNodes();

    // Filter compatible nodes if dragging wire
    if (this.pendingWireConnection) {
      const { isExec, isOutput } = this.pendingWireConnection;
      if (isExec) {
        // Must have exec pin on opposite side
        results = results.filter(n => isOutput ? n.execIn : n.execOut);
      } else {
        // Must have data pin on opposite side
        results = results.filter(n => isOutput ? (n.inputs && n.inputs.length > 0) : (n.outputs && n.outputs.length > 0));
      }
    }

    if (this.selectedCategory) {
      results = results.filter(n => n.category === this.selectedCategory);
    }

    if (query) {
      if (/^\d+$/.test(query)) {
        const targetNum = parseInt(query, 10);
        results = results.filter(n => parseFolderNumber(n.folder) === targetNum);
      } else {
        results = results.filter(n => {
          const name = String(n.name || '').toLowerCase();
          const folder = String(n.folder || '').toLowerCase();
          const category = String(n.category || '').toLowerCase();
          const desc = String(n.description || '').toLowerCase();
          return name.includes(query) || folder.includes(query) || category.includes(query) || desc.includes(query);
        });
      }
    }

    this.filteredResults = results.slice(0, 30);
    this.renderResults();
  }

  renderResults() {
    this.resultsList.innerHTML = '';
    const query = this.input.value.trim();

    if (!this.selectedCategory && !query) {
      const grid = document.createElement('div');
      grid.className = 'spawner-categories-grid';

      const catList = Object.values(CATEGORIES);
      catList.forEach((cat, idx) => {
        const card = document.createElement('div');
        card.className = `spawner-category-card ${idx === this.selectedCategoryIndex ? 'active' : ''}`;
        card.dataset.index = idx;
        card.style.borderColor = cat.headerColor + '44';
        card.innerHTML = `
          <div class="spawner-cat-indicator" style="background:${cat.headerColor}"></div>
          <div class="spawner-cat-info">
            <span class="spawner-cat-name">${cat.name}</span>
            <span class="spawner-cat-count">${cat.count} nodes</span>
          </div>
        `;
        card.addEventListener('mouseenter', () => {
          this.selectedCategoryIndex = idx;
          this.highlightSelectedCategory();
        });
        card.addEventListener('click', () => {
          this.selectedCategory = cat.id;
          this.selectedIndex = 0;
          this.input.focus();
          this.updateResults();
        });
        grid.appendChild(card);
      });

      this.resultsList.appendChild(grid);
      this.scrollToSelectedCategory();
      return;
    }

    if (this.selectedCategory) {
      const cat = CATEGORIES[this.selectedCategory];
      if (cat) {
        const bar = document.createElement('div');
        bar.className = 'spawner-active-cat-bar';
        bar.innerHTML = `
          <span class="spawner-active-indicator" style="background:${cat.headerColor}"></span>
          <span class="spawner-active-title">Category: <strong>${cat.name}</strong></span>
          <button class="spawner-cat-back-btn" title="Show All Categories">✕ All</button>
        `;
        bar.querySelector('.spawner-cat-back-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedCategory = null;
          this.selectedCategoryIndex = 0;
          this.input.value = '';
          this.input.focus();
          this.updateResults();
        });
        this.resultsList.appendChild(bar);
      }
    }

    if (this.filteredResults.length === 0) {
      const noRes = document.createElement('div');
      noRes.className = 'spawner-no-results';
      noRes.textContent = 'No matching nodes found';
      this.resultsList.appendChild(noRes);
      return;
    }

    this.filteredResults.forEach((node, idx) => {
      const cat = CATEGORIES[node.category] || CATEGORIES.execution;
      const item = document.createElement('div');
      item.className = `spawner-item ${idx === this.selectedIndex ? 'active' : ''}`;
      item.dataset.index = idx;

      const folderPrefix = node.folder ? `<span style="color:#7b88a1;font-weight:600;">${node.folder}</span> • ` : '';

      item.innerHTML = `
        <span class="spawner-item-cat" style="background:${cat.headerColor}"></span>
        <div class="spawner-item-info">
          <span class="spawner-item-name">${node.name}</span>
          <span class="spawner-item-desc">${folderPrefix}${node.description || cat.name}</span>
        </div>
      `;

      item.addEventListener('mouseenter', () => {
        this.selectedIndex = idx;
        this.highlightSelected();
      });

      item.addEventListener('click', () => {
        this.spawnNode(node);
      });

      this.resultsList.appendChild(item);
    });

    this.scrollToSelected();
  }

  highlightSelectedCategory() {
    const cards = this.resultsList.querySelectorAll('.spawner-category-card');
    cards.forEach((card, idx) => {
      if (idx === this.selectedCategoryIndex) {
        card.classList.add('active');
      } else {
        card.classList.remove('active');
      }
    });
    this.scrollToSelectedCategory();
  }

  scrollToSelectedCategory() {
    const active = this.resultsList.querySelector('.spawner-category-card.active');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  highlightSelected() {
    const items = this.resultsList.querySelectorAll('.spawner-item');
    items.forEach((item, idx) => {
      if (idx === this.selectedIndex) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
    this.scrollToSelected();
  }

  scrollToSelected() {
    const active = this.resultsList.querySelector('.spawner-item.active');
    if (active) {
      active.scrollIntoView({ block: 'nearest' });
    }
  }

  spawnNode(blueprint) {
    const pw = this.pendingWireConnection;
    let targetPinName = null;

    // 1. Identify connector pin on the new node
    if (pw) {
      if (pw.isExec) {
        if (pw.isOutput && blueprint.execIn) {
          targetPinName = 'execIn';
        } else if (!pw.isOutput && (blueprint.execOut || blueprint.canAddDynamicBranches)) {
          if (Array.isArray(blueprint.execOut) && blueprint.execOut.length > 0) {
            targetPinName = blueprint.execOut[0].name || blueprint.execOut[0];
          } else if (blueprint.execOut) {
            targetPinName = 'execOut';
          } else if (blueprint.canAddDynamicBranches) {
            targetPinName = 'Branch 0';
          }
        }
      } else {
        // Data wire
        if (pw.isOutput) {
          if (blueprint.inputs && blueprint.inputs.length > 0) {
            const srcPinType = this.state.getPinType(pw.fromNode, pw.fromPin, 'generic');
            const matchingInput = blueprint.inputs.find(inp => inp.type === srcPinType);
            targetPinName = matchingInput ? matchingInput.name : blueprint.inputs[0].name;
          } else if (blueprint.canAddDynamicBranches) {
            targetPinName = 'Control Expression';
          }
        } else {
          if (blueprint.outputs && blueprint.outputs.length > 0) {
            const srcPinType = this.state.getPinType(pw.fromNode, pw.fromPin, 'generic');
            const matchingOutput = blueprint.outputs.find(out => out.type === srcPinType);
            targetPinName = matchingOutput ? matchingOutput.name : blueprint.outputs[0].name;
          }
        }
      }
    }

    // 2. Instantiate node
    const node = this.state.createNode(blueprint.id, this.spawnCanvasX, this.spawnCanvasY);
    if (!node) {
      this.close();
      return;
    }

    // 3. Render DOM element synchronously to accurately measure the connector socket offset
    this.renderer.renderNodes();
    const nodeEl = this.renderer.nodeElements.get(node.id);

    // 4. Snap node position so the connector pin lands directly at (spawnCanvasX, spawnCanvasY)
    if (pw && targetPinName && nodeEl) {
      let targetPinEl = null;

      if (pw.isExec) {
        if (pw.isOutput) {
          targetPinEl = nodeEl.querySelector('.pin-exec-in');
        } else {
          targetPinEl = nodeEl.querySelector(`.pin-exec-out[data-pin-name="${CSS.escape(targetPinName)}"]`) || nodeEl.querySelector('.pin-exec-out');
        }
      } else {
        if (pw.isOutput) {
          targetPinEl = nodeEl.querySelector(`.socket-in[data-pin-name="${CSS.escape(targetPinName)}"]`) || nodeEl.querySelector('.socket-in');
        } else {
          targetPinEl = nodeEl.querySelector(`.socket-out[data-pin-name="${CSS.escape(targetPinName)}"]`) || nodeEl.querySelector('.socket-out');
        }
      }

      if (targetPinEl) {
        const nodeRect = nodeEl.getBoundingClientRect();
        const pinRect = targetPinEl.getBoundingClientRect();
        const zoom = this.state.zoom;

        let relX, relY;
        if (pw.isExec) {
          if (pw.isOutput) {
            relX = (pinRect.left + 2 - nodeRect.left) / zoom;
          } else {
            relX = (pinRect.right - 2 - nodeRect.left) / zoom;
          }
          relY = (pinRect.top + pinRect.height / 2 - nodeRect.top) / zoom;
        } else {
          relX = (pinRect.left + pinRect.width / 2 - nodeRect.left) / zoom;
          relY = (pinRect.top + pinRect.height / 2 - nodeRect.top) / zoom;
        }

        node.x = Math.round(this.spawnCanvasX - relX);
        node.y = Math.round(this.spawnCanvasY - relY);
        nodeEl.style.transform = `translate3d(${node.x}px, ${node.y}px, 0)`;
      } else {
        node.x = Math.round(this.spawnCanvasX - (pw.isOutput ? 10 : 200));
        node.y = Math.round(this.spawnCanvasY - 45);
        nodeEl.style.transform = `translate3d(${node.x}px, ${node.y}px, 0)`;
      }
    } else {
      // Normal spawn without wire: cursor centered comfortably near header
      node.x = Math.round(this.spawnCanvasX - 40);
      node.y = Math.round(this.spawnCanvasY - 16);
      if (nodeEl) {
        nodeEl.style.transform = `translate3d(${node.x}px, ${node.y}px, 0)`;
      }
    }

    // 5. Connect wire between pins
    if (pw && targetPinName) {
      if (pw.isExec) {
        if (pw.isOutput) {
          this.state.addWire(pw.fromNode, pw.fromPin, node.id, targetPinName, true);
        } else {
          this.state.addWire(node.id, targetPinName, pw.fromNode, pw.fromPin, true);
        }
      } else {
        if (pw.isOutput) {
          this.state.addWire(pw.fromNode, pw.fromPin, node.id, targetPinName, false);
        } else {
          this.state.addWire(node.id, targetPinName, pw.fromNode, pw.fromPin, false);
        }
      }
    }

    // 6. Select newly spawned node and save history snapshot
    this.state.selectedNodeIds.clear();
    this.state.selectedWireIds.clear();
    this.state.selectedNodeIds.add(node.id);
    this.state.saveSnapshot();

    // 7. Clean up preview wire and close modal
    this.renderer.clearActiveDragWire();
    this.close();
    this.renderer.render();
  }
}

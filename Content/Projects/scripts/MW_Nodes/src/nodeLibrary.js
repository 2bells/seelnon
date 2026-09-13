/**
 * Miliastra Wonderland Floating Node Library
 * Right-side dockable panel with high-speed search, category trees, sorting container, and drag & drop.
 */

import { CATEGORIES, NODE_REGISTRY, getNodeBlueprint } from './nodesData.js';

export class NodeLibrary {
  constructor(container, graphState, renderer) {
    this.container = container;
    this.state = graphState;
    this.renderer = renderer;

    this.searchTerm = '';
    this.selectedCategory = 'all';
    this.sortOrder = 'default';

    this.expandedCategories = new Set(['execution', 'event', 'flow', 'query', 'operation']);
    this.expandedFolders = new Set([
      'execution:I. Common Nodes',
      'event:I. Custom Variables',
      'flow:I. General',
      'operation:I. General',
      'query:I. General'
    ]);

    // Track explicit user collapse/expand overrides (persisting during active search)
    this.userCollapsedCategories = new Set();
    this.userExpandedCategories = new Set();
    this.userCollapsedFolders = new Set();
    this.userExpandedFolders = new Set();

    this.initDOM();
    this.renderList();
  }

  initDOM() {
    this.panel = document.createElement('div');
    this.panel.className = 'node-library-panel';
    this.panel.id = 'nodeLibraryPanel';

    // Header
    const header = document.createElement('div');
    header.className = 'library-header';
    header.innerHTML = `
      <span class="library-title">Node Library</span>
      <div class="library-header-actions">
        <button class="lib-btn-collapse" id="libCollapseBtn" title="Minimize Library">_</button>
      </div>
    `;
    this.panel.appendChild(header);

    // Search bar
    const searchBar = document.createElement('div');
    searchBar.className = 'library-search-bar';
    searchBar.innerHTML = `
      <span class="search-icon">
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      </span>
      <input type="text" class="library-search-input" id="libSearchInput" placeholder="Search nodes..." autocomplete="off" />
      <button class="filter-funnel-btn" id="libFilterBtn" title="Toggle filter / sort options">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
      </button>
    `;
    this.panel.appendChild(searchBar);

    // Dedicated Sorting & Filter Container (in-flow, never cut off)
    this.sortContainer = document.createElement('div');
    this.sortContainer.className = 'library-sort-container';
    this.sortContainer.id = 'libSortContainer';
    this.sortContainer.innerHTML = `
      <div class="sort-control-group">
        <label class="sort-label" for="libCategorySelect">Cat</label>
        <select class="sort-select" id="libCategorySelect" title="Filter by node category">
          <option value="all">All (${NODE_REGISTRY.length})</option>
          ${Object.values(CATEGORIES).map(c => `
            <option value="${c.id}">${c.name} (${c.count})</option>
          `).join('')}
        </select>
      </div>
      <div class="sort-control-group">
        <label class="sort-label" for="libSortOrderSelect">Sort</label>
        <select class="sort-select" id="libSortOrderSelect" title="Sort order">
          <option value="default">Default</option>
          <option value="name-asc">A → Z</option>
          <option value="name-desc">Z → A</option>
        </select>
      </div>
    `;
    this.panel.appendChild(this.sortContainer);

    // Tree list container
    this.treeContainer = document.createElement('div');
    this.treeContainer.className = 'library-tree-container';
    this.panel.appendChild(this.treeContainer);

    this.container.appendChild(this.panel);

    // Events
    const searchInput = this.panel.querySelector('#libSearchInput');
    searchInput.addEventListener('input', (e) => {
      const prevTerm = this.searchTerm;
      this.searchTerm = (e.target.value || '').trim().toLowerCase();
      if (this.searchTerm !== prevTerm) {
        // Reset manual collapse overrides on new search query
        this.userCollapsedCategories.clear();
        this.userExpandedCategories.clear();
        this.userCollapsedFolders.clear();
        this.userExpandedFolders.clear();
      }
      this.renderList();
    });

    // Keyboard shortcut '/' to focus search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      }
    });

    const categorySelect = this.panel.querySelector('#libCategorySelect');
    categorySelect.addEventListener('change', (e) => {
      this.selectedCategory = e.target.value;
      this.updateFilterBtnHighlight();
      this.renderList();
    });

    const sortOrderSelect = this.panel.querySelector('#libSortOrderSelect');
    sortOrderSelect.addEventListener('change', (e) => {
      this.sortOrder = e.target.value;
      this.updateFilterBtnHighlight();
      this.renderList();
    });

    const filterBtn = this.panel.querySelector('#libFilterBtn');
    filterBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = this.sortContainer.style.display !== 'none';
      this.sortContainer.style.display = isVisible ? 'none' : 'flex';
      filterBtn.classList.toggle('active', !isVisible || this.selectedCategory !== 'all' || this.sortOrder !== 'default');
    });

    const collapseBtn = this.panel.querySelector('#libCollapseBtn');
    collapseBtn.addEventListener('click', () => {
      this.panel.classList.toggle('minimized');
    });

    // Drag-and-drop onto canvas
    this.setupDragAndDrop();
  }

  updateFilterBtnHighlight() {
    const filterBtn = this.panel.querySelector('#libFilterBtn');
    if (!filterBtn) return;
    const isFiltered = this.selectedCategory !== 'all' || this.sortOrder !== 'default';
    filterBtn.classList.toggle('active', isFiltered);
  }

  renderList() {
    this.treeContainer.innerHTML = '';

    const categories = Object.values(CATEGORIES);

    for (const cat of categories) {
      if (this.selectedCategory !== 'all' && this.selectedCategory !== cat.id) {
        continue;
      }

      // Filter nodes in this category
      let nodes = NODE_REGISTRY.filter(n => n.category === cat.id);
      if (this.searchTerm) {
        nodes = nodes.filter(n => {
          const name = String(n.name || '').toLowerCase();
          const folder = String(n.folder || '').toLowerCase();
          const desc = String(n.description || '').toLowerCase();
          return name.includes(this.searchTerm) || folder.includes(this.searchTerm) || desc.includes(this.searchTerm);
        });
        if (nodes.length === 0) continue;
      }

      // Determine category expanded state
      let isCatExpanded = false;
      if (this.userCollapsedCategories.has(cat.id)) {
        isCatExpanded = false;
      } else if (this.userExpandedCategories.has(cat.id)) {
        isCatExpanded = true;
      } else if (this.searchTerm) {
        isCatExpanded = true;
      } else {
        isCatExpanded = this.expandedCategories.has(cat.id);
      }

      const catHeader = document.createElement('div');
      catHeader.className = `cat-tree-header ${isCatExpanded ? 'expanded' : ''}`;
      catHeader.innerHTML = `
        <span class="cat-arrow">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
        </span>
        <span class="cat-icon-badge" style="color:${cat.headerColor}">
          ${this.renderer.getCategoryIconSVG(cat.iconType)}
        </span>
        <span class="cat-name">${cat.name}</span>
        <span class="cat-count">${nodes.length}</span>
      `;

      catHeader.addEventListener('click', (e) => {
        e.stopPropagation();
        if (isCatExpanded) {
          this.userCollapsedCategories.add(cat.id);
          this.userExpandedCategories.delete(cat.id);
          this.expandedCategories.delete(cat.id);
        } else {
          this.userExpandedCategories.add(cat.id);
          this.userCollapsedCategories.delete(cat.id);
          this.expandedCategories.add(cat.id);
        }
        this.renderList();
      });

      this.treeContainer.appendChild(catHeader);

      if (isCatExpanded) {
        const itemsList = document.createElement('div');
        itemsList.className = 'cat-items-list';

        // Group nodes by folder
        const folderMap = new Map();
        for (const node of nodes) {
          const folderName = node.folder || 'General';
          if (!folderMap.has(folderName)) {
            folderMap.set(folderName, []);
          }
          folderMap.get(folderName).push(node);
        }

        // Render each folder group
        for (const [folderName, folderNodes] of folderMap.entries()) {
          const folderKey = `${cat.id}:${folderName}`;

          // Determine folder expanded state
          let isFolderExpanded = false;
          if (this.userCollapsedFolders.has(folderKey)) {
            isFolderExpanded = false;
          } else if (this.userExpandedFolders.has(folderKey)) {
            isFolderExpanded = true;
          } else if (this.searchTerm) {
            isFolderExpanded = true;
          } else {
            isFolderExpanded = this.expandedFolders.has(folderKey);
          }

          const folderHeader = document.createElement('div');
          folderHeader.className = `folder-tree-header ${isFolderExpanded ? 'expanded' : ''}`;
          folderHeader.innerHTML = `
            <span class="folder-arrow">
              <svg viewBox="0 0 24 24" width="10" height="10" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </span>
            <span class="folder-name">${folderName}</span>
            <span class="folder-count">${folderNodes.length}</span>
          `;

          folderHeader.addEventListener('click', (e) => {
            e.stopPropagation();
            if (isFolderExpanded) {
              this.userCollapsedFolders.add(folderKey);
              this.userExpandedFolders.delete(folderKey);
              this.expandedFolders.delete(folderKey);
            } else {
              this.userExpandedFolders.add(folderKey);
              this.userCollapsedFolders.delete(folderKey);
              this.expandedFolders.add(folderKey);
            }
            this.renderList();
          });

          itemsList.appendChild(folderHeader);

          if (isFolderExpanded) {
            const folderItemsList = document.createElement('div');
            folderItemsList.className = 'folder-items-list';

            // Apply Sort Order if requested
            let displayNodes = [...folderNodes];
            if (this.sortOrder === 'name-asc') {
              displayNodes.sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
            } else if (this.sortOrder === 'name-desc') {
              displayNodes.sort((a, b) => String(b.name || '').localeCompare(String(a.name || '')));
            }

            for (const node of displayNodes) {
              const itemEl = this.createNodeItemElement(node, cat);
              folderItemsList.appendChild(itemEl);
            }

            itemsList.appendChild(folderItemsList);
          }
        }

        this.treeContainer.appendChild(itemsList);
      }
    }

    if (this.treeContainer.children.length === 0) {
      const emptyNotice = document.createElement('div');
      emptyNotice.style.cssText = 'padding: 24px 12px; text-align: center; color: #5c6475; font-size: 11px;';
      emptyNotice.textContent = 'No matching nodes found';
      this.treeContainer.appendChild(emptyNotice);
    }
  }

  createNodeItemElement(node, cat) {
    const itemEl = document.createElement('div');
    itemEl.className = 'library-node-item';
    itemEl.draggable = true;
    itemEl.dataset.blueprintId = node.id;
    itemEl.title = node.description || node.name;

    itemEl.innerHTML = `
      <span class="node-bullet" style="background:${cat.headerColor}"></span>
      <span class="node-name-text">${this.highlightMatch(node.name, this.searchTerm)}</span>
      <span class="node-quick-add" title="Add to center of graph">+</span>
    `;

    // Quick click to spawn
    itemEl.addEventListener('click', (e) => {
      if (e.target.classList.contains('node-quick-add')) {
        e.stopPropagation();
      }
      this.spawnNodeNearCenter(node.id);
    });

    // Drag setup
    itemEl.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', node.id);
      itemEl.classList.add('dragging');
    });

    itemEl.addEventListener('dragend', () => {
      itemEl.classList.remove('dragging');
    });

    return itemEl;
  }

  highlightMatch(text, query) {
    if (!text) return '';
    if (!query) return text;
    const str = String(text);
    const q = String(query).toLowerCase();
    const idx = str.toLowerCase().indexOf(q);
    if (idx === -1) return str;
    const before = str.slice(0, idx);
    const match = str.slice(idx, idx + q.length);
    const after = str.slice(idx + q.length);
    return `${before}<mark class="lib-highlight">${match}</mark>${after}`;
  }

  spawnNodeNearCenter(blueprintId) {
    const canvasRect = this.renderer.container.getBoundingClientRect();
    const centerScreenX = canvasRect.left + canvasRect.width / 2;
    const centerScreenY = canvasRect.top + canvasRect.height / 2;
    const pos = this.renderer.screenToCanvas(centerScreenX, centerScreenY);

    // Stagger slightly so multiple spawns don't directly overlap
    const offset = (Math.random() - 0.5) * 60;
    const node = this.state.createNode(blueprintId, pos.x + offset - 80, pos.y + offset - 40);
    this.state.selectedNodeIds.clear();
    this.state.selectedNodeIds.add(node.id);
    this.renderer.render();
  }

  setupDragAndDrop() {
    const canvasEl = this.renderer.container;

    canvasEl.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    canvasEl.addEventListener('drop', (e) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData('text/plain');
      if (!raw) return;

      const pos = this.renderer.screenToCanvas(e.clientX, e.clientY);
      let bpId = raw;
      let varName = null;

      try {
        if (raw.startsWith('{')) {
          const parsed = JSON.parse(raw);
          if (parsed.action === 'spawn_graph_var') {
            bpId = 'query_get_node_graph_var';
            varName = parsed.varName;
          }
        }
      } catch (err) {}

      const node = this.state.createNode(bpId, pos.x - 80, pos.y - 25);
      if (varName) {
        node.inputValues['Variable Name'] = varName;
      }
      this.state.selectedNodeIds.clear();
      this.state.selectedNodeIds.add(node.id);
      this.renderer.render();
    });
  }
}

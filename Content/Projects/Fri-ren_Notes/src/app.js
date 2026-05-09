import { Vault } from './db.js';
import { Editor } from './editor.js';
import { GraphModule } from './graph.js';

class CavemanApp {
  constructor() {
    window.app = this;
    this.vault = new Vault();
    this.editorModule = new Editor(this.vault);
    this.graphModule = new GraphModule(this);
    this.notes = [];
    this.currentNote = null;
    this.viewMode = null; // 'preview', 'editor', 'canvas'

    // Elements
    this.noteListEl = document.getElementById('note-list');
    this.editorEl = document.getElementById('editor');
    this.editorWrapper = document.getElementById('editor-wrapper');
    this.lineNumbersEl = document.getElementById('line-numbers');
    this.previewEl = document.getElementById('preview');
    this.canvasPanel = document.getElementById('canvas-panel');
    this.titleInput = document.getElementById('note-title');
    this.folderInput = document.getElementById('note-folder');
    this.newNoteBtn = document.getElementById('new-note');
    this.togglePreviewBtn = document.getElementById('toggle-preview');
    this.canvasModeBtn = document.getElementById('canvas-mode-btn');
    this.deleteNoteBtn = document.getElementById('delete-note');
    this.exportBtn = document.getElementById('export-btn');
    this.exportNoteBtn = document.getElementById('download-pdf-btn');
    this.importInput = document.getElementById('import-vault');
    this.charCountEl = document.getElementById('char-count');
    this.lastSavedEl = document.getElementById('last-saved');
    this.searchInput = document.getElementById('search-notes');
    this.themeToggle = document.getElementById('theme-control');
    this.viewBtn = document.getElementById('view-btn');
    this.viewMenu = document.getElementById('view-menu');
    this.printBackgroundCheck = document.getElementById('print-background-check');
    this.printContinuousCheck = document.getElementById('print-continuous-check');
    this.dbBtn = document.getElementById('db-btn');
    this.graphBtn = document.getElementById('graph-btn');
    this.dbMenu = document.getElementById('db-menu');
    this.graphMenu = document.getElementById('graph-menu');
    this.statusResizer = document.getElementById('status-resizer');
    this.closeOverlayBtns = document.querySelectorAll('.close-overlay');
    this.collapsedFolders = JSON.parse(localStorage.getItem('caveman-collapsed-folders') || '[]');
    this.imageCache = new Map(); // Memory cache to prevent flash
    this.historyStack = new Map(); // noteId -> { undo: [], redo: [] }
    this.historyTimer = null;
    this.measureEl = null;
    this.renamingFolder = null;
    this.renamingNoteId = null;
    this.lastFolderClick = { time: 0, path: null };
    this.lastNoteClick = { time: 0, id: null };
    this.FAST_DBL_CLICK_THRESHOLD = 250;
    this.dblClickRenaming = localStorage.getItem('caveman-dbl-click-rename') !== 'false';
    this.folderSettings = JSON.parse(localStorage.getItem('caveman-folder-settings') || '{}');
    this.activePopover = null;
    this.DEFAULT_PALETTE = [
      '#ffadad', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff',
      '#a0c4ff', '#bdb2ff', '#ffc6ff', '#fffffc'
    ];
    this.tintPalette = JSON.parse(localStorage.getItem('caveman-tint-palette') || JSON.stringify(this.DEFAULT_PALETTE));
    this.paletteGridEl = document.getElementById('settings-palette-grid');

    // Search Widget Elements
    this.editorSearchWidget = document.getElementById('editor-search-widget');
    this.editorSearchInput = document.getElementById('editor-search-input');
    this.editorSearchResults = document.getElementById('editor-search-results');
    this.editorSearchNext = document.getElementById('editor-search-next');
    this.editorSearchPrev = document.getElementById('editor-search-prev');
    this.editorSearchClose = document.getElementById('editor-search-close');
    this.editorSearchMatches = [];
    this.currentSearchMatchIndex = -1;
    this.editorHighlightsEl = document.getElementById('editor-highlights');

    this.initLazyLoader();
    this.init();
  }

  initLazyLoader() {
    this.imageObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.loadLazyImage(entry.target);
          this.imageObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px' });
  }

  async loadLazyImage(imgEl) {
    const imgId = imgEl.dataset.imgId;
    if (!imgId) return;

    if (this.imageCache.has(imgId)) {
      imgEl.src = this.imageCache.get(imgId);
      imgEl.classList.remove('lazy-vault-img');
      return;
    }

    const dataUrl = await this.vault.getImage(imgId);
    if (dataUrl) {
      this.imageCache.set(imgId, dataUrl);
      imgEl.src = dataUrl;
      imgEl.classList.remove('lazy-vault-img');
    }
  }

  async init() {
    try {
      // 0. Theme First (Immediate Caveman Comfort)
      const savedNightMode = localStorage.getItem('caveman-night-mode');
      if (savedNightMode === 'true') {
        this.isNightMode = true;
        document.body.classList.add('night-mode');
        document.documentElement.classList.add('night-mode');
      }

      // Explicitly wait for vault before proceeding to UI binding
      await this.vault.init();
      
      // 1. Initial Load (Local Vault First)
      this.publicNotes = [];
      await this.loadNotes();
      
      // Initialize settings elements
      this.dblClickRenameCheck = document.getElementById('dbl-click-rename-check');
      if (this.dblClickRenameCheck) {
        this.dblClickRenameCheck.checked = this.dblClickRenaming;
      }

      // 2. Restore Last Session OR Create New (Critical: Await this before listeners)
      if (this.notes.length > 0) {
        const lastNoteId = localStorage.getItem('caveman-last-note-id');
        const lastNote = this.notes.find(n => String(n.id) === String(lastNoteId));
        if (lastNote) {
          await this.selectNote(lastNote);
        } else {
          await this.selectNote(this.notes[0]);
        }
      } else {
        await this.createNewNote();
      }

      this.renderPaletteInSettings();
      // 3. Attach Listeners ONLY after initial state is set
      this.attachEventListeners();

      // 4. Background Load Ancient Scrolls (Public Tutorial)
      this.loadPublicNotes().then(() => {
        this.loadNotes(); // Update registry with public notes when ready
      }).catch(err => console.warn("Scroll acquisition failed", err));

    } catch (err) {
      console.error("CRITICAL: Ancient monolith failed to activate.", err);
      // Fallback: Notify user or attempt one retry?
    }
  }

  attachEventListeners() {
    window.addEventListener('mousedown', (e) => {
      if (this.activePopover && !this.activePopover.contains(e.target)) {
        this.activePopover.remove();
        this.activePopover = null;
        this.renderNoteList(); 
      }
    });

    if (this.dblClickRenameCheck) {
      this.dblClickRenameCheck.addEventListener('change', () => {
        this.dblClickRenaming = this.dblClickRenameCheck.checked;
        localStorage.setItem('caveman-dbl-click-rename', this.dblClickRenaming);
      });
    }

    // New Note logic
    let newNoteTimer;
    let longPressTriggered = false;

    this.newNoteBtn.addEventListener('pointerdown', () => {
      longPressTriggered = false;
      newNoteTimer = setTimeout(() => {
        this.createCustodesNote();
        longPressTriggered = true;
        this.newNoteBtn.classList.add('easter-egg-trigger');
        setTimeout(() => this.newNoteBtn.classList.remove('easter-egg-trigger'), 500);
      }, 2500);
    });

    const release = () => {
      if (newNoteTimer) {
        clearTimeout(newNoteTimer);
        newNoteTimer = null;
      }
    };

    this.newNoteBtn.addEventListener('pointerup', release);
    this.newNoteBtn.addEventListener('pointerleave', release);

    this.newNoteBtn.addEventListener('click', (e) => {
      if (longPressTriggered) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      this.createNewNote();
    });
    
    this.editorEl.addEventListener('input', () => {
      this.handleInput();
      this.updateLineNumbers();
      if (!this.editorSearchWidget.classList.contains('hidden')) {
        this.performSearch(false); // Update results without jumping if typing
      }
    });

    this.editorSearchInput.addEventListener('input', () => this.performSearch());
    this.editorSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) this.goToPrevMatch();
        else this.goToNextMatch();
      }
      if (e.key === 'Escape') this.hideSearch();
    });
    this.editorSearchNext.addEventListener('click', () => this.goToNextMatch());
    this.editorSearchPrev.addEventListener('click', () => this.goToPrevMatch());
    this.editorSearchClose.addEventListener('click', () => this.hideSearch());
    this.editorEl.addEventListener('scroll', () => {
      this.lineNumbersEl.scrollTop = this.editorEl.scrollTop;
      this.editorHighlightsEl.scrollTop = this.editorEl.scrollTop;
      this.editorHighlightsEl.scrollLeft = this.editorEl.scrollLeft;
    });
    this.titleInput.addEventListener('input', () => this.handleInput());
    this.folderInput.addEventListener('input', () => this.handleInput());
    this.togglePreviewBtn.addEventListener('click', () => this.toggleEditorMode());
    this.canvasModeBtn.addEventListener('click', () => this.toggleCanvasMode());
    this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
    this.editorEl.addEventListener('paste', (e) => this.handlePaste(e));
    this.exportBtn.addEventListener('click', () => this.exportVault());
    this.exportNoteBtn.addEventListener('click', () => this.exportNoteAsPDF());
    this.importInput.addEventListener('change', (e) => this.importVault(e));
    this.searchInput.addEventListener('input', () => this.renderNoteList());
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Status resizer logic
    const savedFolderWidth = localStorage.getItem('caveman-folder-width') || '80';
    this.folderInput.style.width = `${savedFolderWidth}px`;
    this.isResizingStatus = false;

    this.statusResizer.addEventListener('mousedown', (e) => {
      this.isResizingStatus = true;
      document.body.style.cursor = 'ew-resize';
      this.statusResizer.classList.add('active');
      e.preventDefault();
    });

    window.addEventListener('mousemove', (e) => {
      if (!this.isResizingStatus) return;
      const rect = this.folderInput.getBoundingClientRect();
      const newWidth = Math.max(40, Math.min(600, e.clientX - rect.left));
      this.folderInput.style.width = `${newWidth}px`;
      localStorage.setItem('caveman-folder-width', newWidth);
    });

    window.addEventListener('mouseup', () => {
      if (this.isResizingStatus) {
        this.isResizingStatus = false;
        document.body.style.cursor = '';
        this.statusResizer.classList.remove('active');
      }
    });

    window.addEventListener('resize', () => this.updateLineNumbers());

    this.previewEl.addEventListener('click', (e) => this.handlePreviewClick(e));

    this.viewBtn.addEventListener('click', () => this.openViewMenu());
    this.printBackgroundCheck.addEventListener('change', () => {
      const checked = this.printBackgroundCheck.checked;
      localStorage.setItem('caveman-print-bg', checked);
      document.body.classList.toggle('print-with-background', checked);
      document.documentElement.classList.toggle('print-with-background', checked);
    });
    this.printContinuousCheck.addEventListener('change', () => {
      const checked = this.printContinuousCheck.checked;
      localStorage.setItem('caveman-print-continuous', checked);
      document.body.classList.toggle('print-continuous', checked);
    });

    this.dblClickRenameCheck.addEventListener('change', () => {
      this.dblClickRenaming = this.dblClickRenameCheck.checked;
      localStorage.setItem('caveman-dbl-click-rename', this.dblClickRenaming);
    });

    this.dbBtn.addEventListener('click', () => this.openDatabaseMenu());
    this.graphBtn.addEventListener('click', () => {
      this.closeOverlays();
      this.graphBtn.classList.add('active');
      this.graphModule.open();
    });
    
    this.closeOverlayBtns.forEach(btn => btn.addEventListener('click', () => {
      this.closeOverlays();
      this.graphModule.close();
    }));
    
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.addEventListener('click', (e) => this.setZoom(e.target.dataset.size));
    });

    const savedZoom = localStorage.getItem('caveman-zoom') || '14';
    this.setZoom(savedZoom);

    const savedPrintBg = localStorage.getItem('caveman-print-bg') === 'true';
    this.printBackgroundCheck.checked = savedPrintBg;
    document.body.classList.toggle('print-with-background', savedPrintBg);
    document.documentElement.classList.toggle('print-with-background', savedPrintBg);

    const savedPrintContinuous = localStorage.getItem('caveman-print-continuous') === 'true';
    this.printContinuousCheck.checked = savedPrintContinuous;
    document.body.classList.toggle('print-continuous', savedPrintContinuous);

    window.addEventListener('beforeprint', () => {
      if (document.body.classList.contains('print-continuous')) {
        const previewHeight = this.previewEl.scrollHeight;
        const heightCm = Math.ceil(previewHeight / 37.8) + 2; 
        
        const style = document.createElement('style');
        style.id = 'continuous-print-style';
        style.innerHTML = `
          @page {
            size: 21cm ${heightCm}cm !important;
            margin: 0 !important;
          }
        `;
        document.head.appendChild(style);
      }
    });

    window.addEventListener('afterprint', () => {
      const style = document.getElementById('continuous-print-style');
      if (style) style.remove();
    });

    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('purge-vault-btn').addEventListener('click', () => this.purgeVault());
    document.getElementById('purge-images-btn').addEventListener('click', () => this.purgeUnusedImages());

    // Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && (e.key === 'p' || e.key === ']')) {
        e.preventDefault();
        this.toggleEditorMode();
      }
      if (e.ctrlKey && e.key === 'k') {
        e.preventDefault();
        this.toggleCanvasMode();
      }
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault();
        this.toggleSidebar();
      }
      if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        this.showSearch();
      }
      if (e.key === 'Escape') {
        this.closeOverlays();
        this.graphModule.close();
        this.hideSearch();
      }
      
      // Undo/Redo
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      }
      if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        this.redo();
      }
    });
  }

  toggleTheme() {
    document.body.classList.toggle('night-mode');
    document.documentElement.classList.toggle('night-mode');
    const isNight = document.body.classList.contains('night-mode');
    localStorage.setItem('caveman-night-mode', isNight ? 'true' : 'false');
    if (isNight) {
      console.log("%cBONFIRE LIT", "color: #c0a062; font-size: 40px; font-weight: bold; font-family: serif; font-style: italic;");
    }
    if (this.canvasModule) {
      this.canvasModule.render();
    }
  }

  toggleFolder(folderName) {
    const name = folderName.toUpperCase();
    if (this.collapsedFolders.includes(name)) {
      this.collapsedFolders = this.collapsedFolders.filter(f => f !== name);
    } else {
      this.collapsedFolders.push(name);
    }
    localStorage.setItem('caveman-collapsed-folders', JSON.stringify(this.collapsedFolders));
    this.renderNoteList();
  }

  async loadPublicNotes() {
    try {
      const response = await fetch('./server/server.json');
      if (!response.ok) return;
      const data = await response.json();
      this.publicNotes = [];
      
      for (const p of data.public_notes) {
        const md = await fetch(`./server/${p.file}`);
        const content = await md.text();
        this.publicNotes.push({
          ...p,
          id: `public:${p.file}`,
          content,
          updatedAt: Date.now(),
          isPublic: true
        });
      }
    } catch (e) {
      console.warn("Ancient vault unreachable.");
    }
  }

  async renameFolder(oldFolderPath, newFolderName) {
    if (!newFolderName || !oldFolderPath) return;
    
    const parts = oldFolderPath.split('/');
    const newPathParts = [...parts];
    newPathParts[newPathParts.length - 1] = newFolderName.toUpperCase();
    const newFolderPath = newPathParts.join('/');

    if (oldFolderPath === newFolderPath) {
      this.renamingFolder = null;
      this.renderNoteList();
      return;
    }

    const updates = this.notes
      .filter(note => !note.isPublic)
      .filter(note => {
        const folder = (note.folder || '').toUpperCase();
        return folder === oldFolderPath || folder.startsWith(oldFolderPath + '/');
      })
      .map(async note => {
        const folder = note.folder || '';
        const folderUpper = folder.toUpperCase();
        
        let updatedFolder;
        if (folderUpper === oldFolderPath) {
          updatedFolder = newFolderPath;
        } else {
          updatedFolder = newFolderPath + folder.slice(oldFolderPath.length);
        }
        
        note.folder = updatedFolder;
        note.updatedAt = Date.now();
        await this.vault.saveNote(note);
      });

    await Promise.all(updates);
    this.renamingFolder = null;
    await this.loadNotes();
    
    if (this.currentNote) {
       this.folderInput.value = this.currentNote.folder || '';
    }
  }

  async renameNote(noteId, newTitle) {
    if (!newTitle) return;
    const note = this.notes.find(n => n.id === noteId);
    if (!note || note.isPublic) return;
    
    if (note.title === newTitle) {
      this.renamingNoteId = null;
      this.renderNoteList();
      return;
    }

    note.title = note.isPublic ? note.title : newTitle;
    if (!note.isPublic) {
      note.updatedAt = Date.now();
      await this.vault.saveNote(note);
    }
    this.renamingNoteId = null;
    await this.loadNotes();
    
    if (this.currentNote && this.currentNote.id === noteId) {
      this.titleInput.value = note.title;
    }
  }

  async moveNoteToFolder(noteId, folderPath) {
    const note = this.notes.find(n => n.id.toString() === noteId.toString());
    if (!note || note.isPublic) return;

    if (note.folder === folderPath) return;

    note.folder = folderPath;
    note.updatedAt = Date.now();
    await this.vault.saveNote(note);
    await this.loadNotes();
    
    if (this.currentNote && this.currentNote.id.toString() === noteId.toString()) {
      this.folderInput.value = folderPath;
    }
  }

  openFolderSettings(folderPath, triggerEl) {
    if (this.activePopover) {
      this.activePopover.remove();
    }

    const rect = triggerEl.getBoundingClientRect();
    const popover = document.createElement('div');
    popover.className = 'folder-settings-popover';
    popover.style.top = `${rect.bottom + 5}px`;
    popover.style.left = `${Math.max(10, rect.left)}px`;

    const settings = this.folderSettings[folderPath] || { color: '#fffffc', emoji: '' };

    // Emoji Picker
    const emojiTitle = document.createElement('div');
    emojiTitle.className = 'popover-title';
    emojiTitle.textContent = 'FOLDER ICON';
    popover.appendChild(emojiTitle);

    const emojiField = document.createElement('div');
    emojiField.className = 'emoji-picker-field';
    const emojiInput = document.createElement('input');
    emojiInput.type = 'text';
    emojiInput.className = 'emoji-picker-input';
    emojiInput.placeholder = 'Emoji...';
    emojiInput.value = settings.emoji || '';
    emojiField.appendChild(emojiInput);
    popover.appendChild(emojiField);

    // Color Picker
    const colorTitle = document.createElement('div');
    colorTitle.className = 'popover-title';
    colorTitle.textContent = 'TINT COLOR';
    popover.appendChild(colorTitle);

    const colorGrid = document.createElement('div');
    colorGrid.className = 'color-grid';
    const colors = [...this.tintPalette, ''];

    colors.forEach(c => {
      const swatch = document.createElement('div');
      swatch.className = `color-swatch ${settings.color === c ? 'active' : ''}`;
      if (!c) swatch.classList.add('empty');
      if (c) swatch.style.backgroundColor = c;
      swatch.onclick = () => {
        settings.color = c;
        this.folderSettings[folderPath] = { ...settings };
        this.saveFolderSettings();
        this.renderNoteList();
        popover.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
        swatch.classList.add('active');
      };
      colorGrid.appendChild(swatch);
    });
    popover.appendChild(colorGrid);

    emojiInput.oninput = () => {
      settings.emoji = emojiInput.value.trim().slice(0, 2);
      this.folderSettings[folderPath] = { ...settings };
      this.saveFolderSettings();
      this.renderNoteList(); 
    };

    emojiInput.onkeydown = (e) => {
      if (e.key === 'Enter') {
        this.renderNoteList();
        popover.remove();
        this.activePopover = null;
      }
    };

    document.body.appendChild(popover);
    this.activePopover = popover;
  }

  saveFolderSettings() {
    localStorage.setItem('caveman-folder-settings', JSON.stringify(this.folderSettings));
  }
  
  savePalette() {
    localStorage.setItem('caveman-tint-palette', JSON.stringify(this.tintPalette));
  }

  renderPaletteInSettings() {
    if (!this.paletteGridEl) return;
    this.paletteGridEl.innerHTML = '';
    this.tintPalette.forEach((color, index) => {
      const item = document.createElement('div');
      item.className = 'palette-item';
      item.style.backgroundColor = color;
      
      const input = document.createElement('input');
      input.type = 'color';
      input.value = color;
      input.oninput = (e) => {
        const newColor = e.target.value;
        this.tintPalette[index] = newColor;
        item.style.backgroundColor = newColor;
        this.savePalette();
        this.renderNoteList(); 
      };
      
      item.appendChild(input);
      this.paletteGridEl.appendChild(item);
    });
  }

  async loadNotes() {
    const localNotes = await this.vault.getNotes();
    const publicNotes = this.publicNotes || [];
    
    // Deduplicate: hide public notes if a local note with the same path exists
    const filteredPublic = publicNotes.filter(pn => {
      const pnPath = ((pn.folder || '').toUpperCase()) + '/' + pn.title;
      return !localNotes.some(ln => (((ln.folder || '').toUpperCase()) + '/' + ln.title) === pnPath);
    });

    this.notes = [...filteredPublic, ...localNotes].map(note => ({
      ...note,
      _searchIndex: `${note.folder || ''} ${note.title} ${note.content}`.toLowerCase()
    }));
    this.renderNoteList();
  }

  renderNoteList() {
    const query = this.searchInput.value.toLowerCase();
    this.noteListEl.innerHTML = '';
    
    // ROOT DROP TARGET (for moving notes out of folders)
    this.noteListEl.ondragover = (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      this.noteListEl.classList.add('drag-over-root');
    };
    this.noteListEl.ondragleave = () => {
      this.noteListEl.classList.remove('drag-over-root');
    };
    this.noteListEl.ondrop = async (e) => {
      // Only trigger if we dropped on the actual list container, not children
      if (e.target !== this.noteListEl) return;
      e.preventDefault();
      this.noteListEl.classList.remove('drag-over-root');
      const noteId = e.dataTransfer.getData('text/plain');
      if (noteId) {
        await this.moveNoteToFolder(noteId, '');
      }
    };

    const filtered = this.notes
      .sort((a,b) => (a.title || '').localeCompare(b.title || ''))
      .filter(note => {
        if (!query) return true;
        return note._searchIndex.includes(query);
      });

    // Build hierarchical tree
    const root = { folders: {}, notes: [] };

    filtered.forEach(note => {
      const parts = (note.folder || '').split('/').filter(p => p.length > 0);
      let current = root;
      parts.forEach(part => {
        const key = part.toUpperCase();
        if (!current.folders[key]) {
          current.folders[key] = { folders: {}, notes: [], path: (current.path ? current.path + '/' : '') + key };
        }
        current = current.folders[key];
      });
      current.notes.push(note);
    });

    this.renderTree(root, this.noteListEl, 0);
  }

  renderTree(node, container, depth) {
    // Sort and render subfolders
    Object.keys(node.folders).sort().forEach(name => {
      const folder = node.folders[name];
      const isCollapsed = this.collapsedFolders.includes(folder.path);
      const isRenaming = this.renamingFolder === folder.path;
      
      const header = document.createElement('div');
      header.className = `sidebar-folder-label ${isCollapsed ? 'collapsed' : ''} ${isRenaming ? 'renaming' : ''}`;
      header.style.paddingLeft = '4px'; // Almost hugging the left wall
      
      if (isRenaming) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'folder-rename-input';
        input.style.marginLeft = `${depth * 12}px`;
        input.value = name;
        header.appendChild(input);
        
        // Timeout to focus because browser might not have attached it yet
        setTimeout(() => {
          input.focus();
          input.select();
        }, 10);

        const handleRename = async () => {
          const newName = input.value.trim().toUpperCase();
          if (newName && newName !== name) {
            await this.renameFolder(folder.path, newName);
          } else {
            this.renamingFolder = null;
            this.renderNoteList();
          }
        };

        input.onkeydown = (e) => {
          if (e.key === 'Enter') handleRename();
          if (e.key === 'Escape') {
            this.renamingFolder = null;
            this.renderNoteList();
          }
        };
        input.onblur = handleRename;
        input.onclick = (e) => e.stopPropagation();
      } else {
        const settings = this.folderSettings[folder.path] || {};
        const tint = settings.color || '';
        if (tint) {
          header.style.backgroundColor = `${tint}33`; // 33 hex is roughly 20% alpha
        } else {
          header.style.backgroundColor = '';
        }

        const configTrigger = document.createElement('div');
        configTrigger.className = 'folder-config-trigger';
        configTrigger.textContent = settings.emoji || '⋮';
        configTrigger.onclick = (e) => {
          e.stopPropagation();
          this.openFolderSettings(folder.path, configTrigger);
        };
        header.appendChild(configTrigger);

        const labelText = document.createElement('span');
        labelText.className = 'folder-label-text';
        labelText.textContent = name.toUpperCase();
        labelText.style.paddingLeft = `${depth * 12}px`;
        header.appendChild(labelText);

        header.onclick = (e) => {
          e.stopPropagation();
          const now = Date.now();
          if (this.dblClickRenaming && now - this.lastFolderClick.time < this.FAST_DBL_CLICK_THRESHOLD && this.lastFolderClick.path === folder.path) {
            this.renamingFolder = folder.path;
            this.renderNoteList();
          } else {
            this.toggleFolder(folder.path);
          }
          this.lastFolderClick = { time: now, path: folder.path };
        };

        // DRAG AND DROP: FOLDER DROP TARGET
        header.ondragover = (e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
          header.classList.add('drag-over');
        };
        header.ondragleave = () => {
          header.classList.remove('drag-over');
        };
        header.ondrop = async (e) => {
          e.preventDefault();
          e.stopPropagation();
          header.classList.remove('drag-over');
          const noteId = e.dataTransfer.getData('text/plain');
          if (noteId) {
            await this.moveNoteToFolder(noteId, folder.path);
          }
        };
      }

      container.appendChild(header);

      if (!isCollapsed && !isRenaming) {
        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';
        this.renderTree(folder, folderContent, depth + 1);
        container.appendChild(folderContent);
      }
    });

    // Render notes in this folder
    node.notes.forEach(note => {
      const isRenaming = this.renamingNoteId === note.id;
      const el = document.createElement('div');
      el.className = `note-item ${this.currentNote && this.currentNote.id === note.id ? 'active' : ''} ${isRenaming ? 'renaming' : ''}`;
      el.style.paddingLeft = `${depth > 0 ? 16 + (depth * 12) : 16}px`;

      if (isRenaming) {
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'note-rename-input';
        input.value = note.title;
        el.appendChild(input);

        setTimeout(() => {
          input.focus();
          input.select();
        }, 10);

        const handleRename = async () => {
          const newTitle = input.value.trim();
          if (newTitle && newTitle !== note.title) {
            await this.renameNote(note.id, newTitle);
          } else {
            this.renamingNoteId = null;
            this.renderNoteList();
          }
        };

        input.onkeydown = (e) => {
          if (e.key === 'Enter') handleRename();
          if (e.key === 'Escape') {
            this.renamingNoteId = null;
            this.renderNoteList();
          }
        };
        input.onblur = handleRename;
        input.onclick = (e) => e.stopPropagation();
      } else {
        const titleSpan = document.createElement('span');
        titleSpan.textContent = note.title || 'Untitled';
        if (note.isPublic) el.classList.add('note-public');
        titleSpan.style.overflow = 'hidden';
        titleSpan.style.textOverflow = 'ellipsis';
        titleSpan.style.whiteSpace = 'nowrap';
        
        const timeSpan = document.createElement('span');
        timeSpan.className = 'opacity-60';
        timeSpan.style.fontSize = '9px';
        timeSpan.style.marginLeft = '8px';
        timeSpan.textContent = this.formatRelativeTime(note.updatedAt);
        
        el.appendChild(titleSpan);
        el.appendChild(timeSpan);
        
        el.onclick = () => {
          const now = Date.now();
          if (this.dblClickRenaming && now - this.lastNoteClick.time < this.FAST_DBL_CLICK_THRESHOLD && this.lastNoteClick.id === note.id) {
            if (!note.isPublic) {
              this.renamingNoteId = note.id;
              this.renderNoteList();
            }
          } else {
            this.selectNote(note);
          }
          this.lastNoteClick = { time: now, id: note.id };
        };

        // DRAG AND DROP: NOTE DRAGGABLE
        if (!note.isPublic) {
          el.draggable = true;
          el.ondragstart = (e) => {
            e.dataTransfer.setData('text/plain', note.id.toString());
            e.dataTransfer.effectAllowed = 'move';
            el.style.opacity = '0.5';
          };
          el.ondragend = () => {
            el.style.opacity = '1';
          };
        }
      }

      container.appendChild(el);
    });
  }

  formatRelativeTime(ts) {
    const diff = (Date.now() - ts) / 1000;
    if (diff < 60) return 'NOW';
    if (diff < 3600) return `${Math.floor(diff/60)}M`;
    if (diff < 86400) return `${Math.floor(diff/3600)}H`;
    return `${Math.floor(diff/86400)}D`;
  }

  async createCustodesNote() {
    await this.handleInput();
    const content = `<div class="imperial-records-container">
  <div class="imperial-header">
    <img src="./server/adeptus_custodes_icon_330x192.png" class="imperial-seal" alt="Adeptus Custodes Seal" />
    <div class="header-data">
      <div>++++ TRANSMITTED: +[REDACTED]+ ++++</div>
      <div>++++ RECEIVED: +SOL SYSTEM+ ++++</div>
      <br/>
      <div>++++ FROM: ADEPTUS CUSTODES // TALONS OF THE EMPEROR ++++</div>
      <div>++++ TO: ALL LOYAL SUBJECTS OF THE IMPERIUM ++++</div>
    </div>
  </div>

  <div class="imperial-titles">
    <h1 class="imperial-title-main">✠ ADEPTUS CUSTODES ✠</h1>
    <h2 class="imperial-title-sub">✵ OFFICIAL NOTIFICATION ✵</h2>
    <h3 class="imperial-title-will">BY THE WILL OF THE IMMORTAL EMPEROR OF MANKIND</h3>
  </div>

  <hr class="imperial-hr" />

  | Squad Designation | Regiment Name | Logistics Rating | Information |
  | :--- | :--- | :--- | :--- |
  | **THE GILDED HOST** | 1st Guard | **EXTREMIS** | SECTOR SECURED |

  <hr class="imperial-hr" />

  <h3 class="imperial-section-header">PERSONNEL STATUS RECORD</h3>

  | NAME | STATUS | DEMEANOUR | CAUSE OF DEATH |
  | :--- | :--- | :--- | :--- |
  | **Shield-Captain Tyvar** | ACTIVE | RESOLUTE | - |
  | **Custode Valerian** | ACTIVE | STOIC | - |
  | **Sister Aleya** | ACTIVE | SILENT | - |
  | **Venerable Contemptor** | DORMANT | ANCIENT | - |

  <hr class="imperial-hr" />

  <blockquote class="imperial-quote">
    <strong>"THOUGHT FOR THE DAY: Wisdom is the beginning of fear."</strong>
  </blockquote>

  <hr class="imperial-hr" />

  <div class="imperial-footer">
    <p><em>Verified by the Inquisition.</em></p>
    <p class="final-seal"><strong>✠ IN THE EMPEROR'S NAME ✠</strong></p>
  </div>
</div>`;

    const note = {
      title: 'ADEPTUS CUSTODES - OFFICIAL NOTICE',
      folder: 'IMPERIAL RECORDS',
      content: content,
      lastViewMode: 'preview',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    
    const id = await this.vault.saveNote(note);
    note.id = id;
    this.notes.push(note);
    this.selectNote(note);
    this.switchView('preview');
    
    if (this.isNightMode) {
       console.log("%cFOR THE EMPEROR", "color: #ffd700; font-size: 30px; font-weight: bold; text-shadow: 2px 2px #000;");
    }
  }

  async createNewNote() {
    await this.handleInput();
    const note = {
      title: '',
      folder: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    const id = await this.vault.saveNote(note);
    note.id = id;
    this.notes.push(note);
    this.selectNote(note);
    if (this.viewMode === 'editor') {
       this.updateLineNumbers();
    }
  }

  async selectNote(note) {
    this.hideSearch();
    if (this.currentNote && !this.currentNote.isPublic) {
      // Ensure we await the save before switching context to avoid clobbering data
      await this.handleInput(true); 
    }
    this.currentNote = note;
    this.titleInput.value = note.title;
    this.folderInput.value = note.folder || '';
    this.editorEl.value = note.content;
    
    if (this.viewMode === 'editor') {
      this.updateLineNumbers();
    }
    
    // Initialize history for this note if it doesn't exist
    if (!this.historyStack.has(note.id)) {
      this.historyStack.set(note.id, {
        undo: [{ content: note.content, start: 0, end: 0 }],
        redo: []
      });
    }
    
    // Save last opened
    localStorage.setItem('caveman-last-note-id', note.id);
    
    // Reset delete confirmation
    this.confirmDelete = false;
    this.deleteNoteBtn.textContent = 'Delete';
    this.deleteNoteBtn.classList.remove('btn-danger');
    if (this.deleteTimeout) clearTimeout(this.deleteTimeout);
 
    // Disable delete for public notes
    this.deleteNoteBtn.style.display = note.isPublic ? 'none' : 'block';
 
    this.renderNoteList();
    
    // Sync Canvas
    if (!this.canvasModule) {
      this.canvasModule = new window.CanvasLite('canvas-lite-root', (data) => this.handleCanvasChange(data));
    }
    this.canvasModule.setData(note.canvasData);
 
    // Per-note view mode persistence
    const lastMode = note.lastViewMode || 'preview';
    this.switchView(lastMode);
    
    if (lastMode === 'preview') this.updatePreview();
    if (lastMode === 'editor') this.updateLineNumbers();
    this.updateStats();

    // Final scroll reset to ensure we are at the top regardless of previous note's state
    this.editorEl.scrollTop = 0;
    this.editorEl.scrollLeft = 0;
    this.previewEl.scrollTop = 0;
    this.lineNumbersEl.scrollTop = 0;
    this.editorHighlightsEl.scrollTop = 0;
    this.editorHighlightsEl.scrollLeft = 0;
    this.renderHighlights();
  }

  async handlePreviewClick(e) {
    const target = e.target;
    const wikilink = target.closest('.wikilink');

    // 1. Handle Wikilinks [[Note Title]]
    if (wikilink) {
      const title = wikilink.dataset.target;
      await this.navigateToNote(title);
      return;
    }

    // 2. Handle Checkboxes (Task Lists)
    if (target.tagName === 'INPUT' && target.type === 'checkbox') {
      // Find which checkbox we clicked relative to others in the same preview
      const allCheckboxes = Array.from(this.previewEl.querySelectorAll('input[type="checkbox"]'));
      const targetIndex = allCheckboxes.indexOf(target);

      if (targetIndex === -1) return;

      const isChecked = target.checked;
      const content = this.editorEl.value;
      const lines = content.split('\n');
      let currentCheckboxIndex = 0;
      
      // We iterate line by line to accurately find the checkbox.
      // This is more reliable than a global replace which might miss or double-count.
      const taskPattern = /^(\s*([-*+•]|\d+\.)\s+)\[([ xX])\]/;
      
      const newLines = lines.map(line => {
        const match = line.match(taskPattern);
        if (match) {
          if (currentCheckboxIndex === targetIndex) {
            currentCheckboxIndex++;
            const prefix = match[1];
            return `${prefix}[${isChecked ? 'x' : ' '}]${line.slice(match[0].length)}`;
          }
          currentCheckboxIndex++;
        }
        return line;
      });

      const newContent = newLines.join('\n');

      if (newContent !== content) {
        this.editorEl.value = newContent;
        this.handleInput(true); // Persists but skips re-render to avoid flashing
      }
    }
  }

  async handleInput(skipPreview = false, skipHistory = false) {
    if (!this.currentNote) return;

    // Check if anything actually changed before saving
    const newTitle = this.titleInput.value;
    const newFolder = this.folderInput.value;
    const newContent = this.editorEl.value;
    
    if (this.currentNote.title === newTitle && 
        this.currentNote.folder === newFolder && 
        this.currentNote.content === newContent) {
      if (!skipPreview) this.updatePreview();
      return;
    }

    if (!skipHistory) {
      const content = this.editorEl.value;
      const lastChar = content[this.editorEl.selectionStart - 1];
      const isWordBoundary = /[\s,.!?;:]/.test(lastChar);
      
      clearTimeout(this.historyTimer);
      if (isWordBoundary) {
        this.pushHistory();
      } else {
        this.historyTimer = setTimeout(() => this.pushHistory(), 300);
      }
    }

    // If editing a public note, fork it into a local one first
    if (this.currentNote.isPublic) {
      const newNote = {
        title: this.titleInput.value,
        folder: this.folderInput.value,
        content: this.editorEl.value,
        canvasData: this.currentNote.canvasData,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const newId = await this.vault.saveNote(newNote);
      newNote.id = newId;
      
      // Update notes list
      await this.loadNotes();
      await this.selectNote(newNote);
      return;
    }

    this.currentNote.title = this.titleInput.value;
    this.currentNote.folder = this.folderInput.value;
    this.currentNote.content = this.editorEl.value;
    this.currentNote.updatedAt = Date.now();
    this.currentNote._searchIndex = `${this.currentNote.folder || ''} ${this.currentNote.title} ${this.currentNote.content}`.toLowerCase();
    
    await this.vault.saveNote(this.currentNote);
    this.renderNoteList();
    if (this.viewMode === 'preview' && skipPreview !== true) this.updatePreview();
    this.updateStats();
    this.lastSavedEl.textContent = `Saved: ${new Date().toLocaleTimeString()}`;
  }

  pushHistory() {
    if (!this.currentNote) return;
    const history = this.historyStack.get(this.currentNote.id);
    if (!history) return;

    const content = this.editorEl.value;
    const last = history.undo[history.undo.length - 1];
    
    if (last && last.content === content) return;

    history.undo.push({
      content,
      start: this.editorEl.selectionStart,
      end: this.editorEl.selectionEnd
    });

    if (history.undo.length > 100) history.undo.shift();
    history.redo = []; // Clear redo on new manual input
  }

  undo() {
    if (!this.currentNote) return;
    const history = this.historyStack.get(this.currentNote.id);
    if (!history || history.undo.length <= 1) return;

    const current = history.undo.pop();
    history.redo.push(current);
    
    const prev = history.undo[history.undo.length - 1];
    this.editorEl.value = prev.content;
    this.editorEl.setSelectionRange(prev.start, prev.end);
    
    this.handleInput(false, true); // true = skip history push
    this.editorEl.focus();
  }

  redo() {
    if (!this.currentNote) return;
    const history = this.historyStack.get(this.currentNote.id);
    if (!history || history.redo.length === 0) return;

    const next = history.redo.pop();
    history.undo.push(next);
    
    this.editorEl.value = next.content;
    this.editorEl.setSelectionRange(next.start, next.end);
    
    this.handleInput(false, true); // true = skip history push
    this.editorEl.focus();
  }

  async handleCanvasChange(data) {
    if (!this.currentNote) return;
    
    // If it's a public note, fork it
    if (this.currentNote.isPublic) {
      const newNote = {
        title: this.titleInput.value,
        folder: this.folderInput.value,
        content: this.editorEl.value,
        canvasData: data,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const newId = await this.vault.saveNote(newNote);
      newNote.id = newId;
      await this.loadNotes();
      this.selectNote(newNote);
      return;
    }

    this.currentNote.canvasData = data;
    this.currentNote.updatedAt = Date.now();
    await this.vault.saveNote(this.currentNote);
    this.lastSavedEl.textContent = `Saved: ${new Date().toLocaleTimeString()}`;
  }

  updateStats() {
    const length = this.editorEl.value.length;
    this.charCountEl.textContent = `Chars: ${length}`;
  }

  async navigateToNote(title) {
    // Try to find note by exact title or path (folder/title)
    let targetNote = this.notes.find(n => {
      const fullPath = ((n.folder || '').toUpperCase() ? (n.folder || '').toUpperCase() + '/' : '') + n.title;
      const searchTitle = title.toUpperCase();
      const noteTitle = n.title.toUpperCase();
      const notePath = fullPath.toUpperCase();
      return noteTitle === searchTitle || notePath === searchTitle;
    });

    if (!targetNote) {
      // Case-insensitive search as fallback if not found directly
      targetNote = this.notes.find(n => {
        return n.title.toLowerCase() === title.toLowerCase();
      });
    }

    if (!targetNote) {
      // Brutalist Creation Prompt: Instead of confirm, show in-preview UI
      this.renderMissingNoteUI(title);
      return;
    }

    if (targetNote) {
      await this.selectNote(targetNote);
    }
  }

  renderMissingNoteUI(title) {
    this.previewEl.innerHTML = `
      <div class="missing-note-container">
        <div class="missing-note-card">
          <div class="missing-note-icon">?</div>
          <h1 class="missing-note-title">NOTE NOT FOUND</h1>
          <p class="missing-note-path">Path: <code>${title}</code></p>
          <p>The wisdom you seek has not been inscribed in the vault yet.</p>
          <div class="missing-note-actions">
            <button id="create-missing-note" class="btn btn-brutalist">CREATE IT</button>
            <button id="cancel-missing-note" class="btn">GO BACK</button>
          </div>
        </div>
      </div>
    `;

    document.getElementById('create-missing-note').onclick = async () => {
      const parts = title.split('/');
      const newTitle = parts.pop();
      const newFolder = parts.join('/');
      
      const note = {
        title: newTitle,
        folder: newFolder,
        content: `# ${newTitle}\n\nLinked from [[${this.currentNote.title}]]`,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      const id = await this.vault.saveNote(note);
      note.id = id;
      await this.loadNotes();
      const targetNote = this.notes.find(n => n.id === id);
      if (targetNote) this.selectNote(targetNote);
    };

    document.getElementById('cancel-missing-note').onclick = () => {
      this.updatePreview();
    };
  }

  async updatePreview() {
    if (!this.currentNote) return;

    if (this.currentNote.folder === 'IMPERIAL RECORDS') {
      this.previewEl.classList.add('imperial-records');
    } else {
      this.previewEl.classList.remove('imperial-records');
    }
    
    let html = await this.editorModule.processMarkdown(this.currentNote.content);
    html = this.scopeStyles(html);
    
    // BACKLINKS: Find who links to THIS note
    const backlinks = this.notes.filter(n => {
      if (n.id === this.currentNote.id) return false;
      const mention = `[[${this.currentNote.title}]]`;
      return n.content.includes(mention);
    });

    if (backlinks.length > 0) {
      html += `
        <div class="backlinks-section">
          <h4>LINKED MENTIONS (${backlinks.length})</h4>
          <div class="backlinks-list">
            ${backlinks.map(bn => `
              <div class="backlink-item wikilink" data-target="${bn.title}">
                <span class="bn-title">${bn.title}</span>
                <span class="bn-folder">${bn.folder || 'root'}</span>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    this.previewEl.innerHTML = html;
    
    // Attach lazy loader to images
    this.previewEl.querySelectorAll('.lazy-vault-img').forEach(img => {
      this.imageObserver.observe(img);
    });
  }

  switchView(mode) {
    if (this.viewMode === mode && this.currentNote?.lastViewMode === mode) return;
    
    this.viewMode = mode;
    if (this.currentNote) {
      this.currentNote.lastViewMode = mode;
      this.vault.saveNote(this.currentNote);
    }
    
    // Hide all
    this.editorWrapper.classList.add('hidden');
    this.previewEl.classList.add('hidden');
    this.canvasPanel.classList.add('hidden');
    
    // Deactivate buttons
    this.togglePreviewBtn.classList.remove('active');
    this.canvasModeBtn.classList.remove('active');
    
    if (mode === 'editor') {
      this.editorWrapper.classList.remove('hidden');
      this.togglePreviewBtn.textContent = 'View';
      this.updateLineNumbers();
    } else if (mode === 'preview') {
      this.previewEl.classList.remove('hidden');
      this.previewEl.scrollTop = 0;
      this.togglePreviewBtn.textContent = 'Edit';
      this.togglePreviewBtn.classList.add('active'); // Highlight active mode
      this.updatePreview();
    } else if (mode === 'canvas') {
      this.canvasPanel.classList.remove('hidden');
      this.canvasModeBtn.classList.add('active');
      
      if (this.canvasModule) {
        this.canvasModule.onResize();
        this.canvasModule.render();
      }
    }
  }

  toggleEditorMode() {
    if (this.viewMode === 'editor') {
      this.switchView('preview');
    } else {
      this.switchView('editor');
    }
  }

  toggleCanvasMode() {
    if (this.viewMode === 'canvas') {
      this.switchView('preview');
    } else {
      this.switchView('canvas');
    }
  }

  async deleteCurrentNote() {
    if (!this.currentNote) return;

    if (!this.confirmDelete) {
      this.confirmDelete = true;
      this.deleteNoteBtn.textContent = 'REALLY?';
      this.deleteNoteBtn.classList.add('btn-danger');
      
      // Reset after 3 seconds if not clicked again
      this.deleteTimeout = setTimeout(() => {
        this.confirmDelete = false;
        this.deleteNoteBtn.textContent = 'Delete';
        this.deleteNoteBtn.classList.remove('btn-danger');
      }, 3000);
      return;
    }

    clearTimeout(this.deleteTimeout);
    this.confirmDelete = false;
    this.deleteNoteBtn.textContent = 'Delete';
    this.deleteNoteBtn.classList.remove('btn-danger');
    
    await this.vault.deleteNote(this.currentNote.id);
    await this.loadNotes();
    if (this.notes.length > 0) {
      await this.selectNote(this.notes[0]);
    } else {
      this.createNewNote();
    }
  }

  async handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    const noteIdOnStart = this.currentNote ? this.currentNote.id : null;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = async (event) => {
          const img = new Image();
          img.onload = async () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 1920;
            let width = img.width;
            let height = img.height;
            
            if (width > MAX_WIDTH) {
              height *= MAX_WIDTH / width;
              width = MAX_WIDTH;
            }
            
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const dataUrl = canvas.toDataURL('image/png');
            const imgId = this.editorModule.generateImageId();
            this.imageCache.set(imgId, dataUrl);
            await this.vault.saveImage(imgId, dataUrl);
            
            const reference = `![[${imgId}]]`;
            
            // Check if we are still on the same note
            if (this.currentNote && this.currentNote.id === noteIdOnStart) {
              const start = this.editorEl.selectionStart;
              const end = this.editorEl.selectionEnd;
              const text = this.editorEl.value;
              
              const newContent = text.slice(0, start) + reference + text.slice(end);
              this.editorEl.value = newContent;
              
              // Restore cursor after the inserted reference
              const newPos = start + reference.length;
              this.editorEl.setSelectionRange(newPos, newPos);
              this.editorEl.focus();

              this.handleInput(false, true); // Save but skip pushing current state to history (we'll push separately if needed)
              this.updateLineNumbers();
            } else {
              // Note switched mid-paste. Find original note and update IT on disk.
              const originalNote = this.notes.find(n => n.id === noteIdOnStart);
              if (originalNote) {
                originalNote.content += (originalNote.content ? '\n\n' : '') + reference;
                originalNote.updatedAt = Date.now();
                await this.vault.saveNote(originalNote);
                this.renderNoteList(); // Update sidebar timestamp
              }
            }
          };
          img.src = event.target.result;
        };
        reader.readAsDataURL(blob);
      }
    }
  }

  async exportCurrentNote() {
    if (!this.currentNote) return;
    const filename = `${this.currentNote.title || 'untitled'}.md`.replace(/[/\\?%*:|"<>]/g, '-');
    const blob = new Blob([this.currentNote.content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
  }

  exportNoteAsPDF() {
    console.log("PDF Export Triggered");
    if (!this.currentNote) {
      console.warn("No current note selected for PDF export.");
      return;
    }
    
    const wasEditing = this.viewMode === 'editor';
    if (wasEditing) this.switchView('preview');
    
    // Check if in iframe
    const inIframe = window.self !== window.top;
    if (inIframe) {
      this.lastSavedEl.textContent = "Open in NEW TAB to print PDF";
      this.lastSavedEl.style.color = "#ff4444";
      setTimeout(() => {
        this.lastSavedEl.textContent = "Ready";
        this.lastSavedEl.style.color = "";
      }, 3000);
    }
    
    setTimeout(() => {
      window.focus();
      try {
        window.print();
      } catch (e) {
        console.error("Print failed:", e);
        this.statusMessenger("Export failed. Opening new tab...", "error");
        setTimeout(() => {
          const win = window.open(window.location.href, '_blank');
          if (!win) {
            this.statusMessenger("Popup blocked!", "error");
          }
        }, 2000);
      }
      
      if (wasEditing) {
        setTimeout(() => this.switchView('editor'), 800);
      }
    }, 600);
  }

  toggleCanvas() {
    this.closeOverlays();
    this.canvasBtn.classList.add('active');
    this.canvasMenu.classList.remove('hidden');
    if (!this.canvasModule && window.CanvasLite) {
      this.canvasModule = new window.CanvasLite('canvas-lite-root');
    } else if (this.canvasModule) {
      this.canvasModule.onResize();
    }
  }

  openViewMenu() {
    this.closeOverlays();
    this.viewMenu.classList.remove('hidden');
    this.viewBtn.classList.add('active');
  }

  async openDatabaseMenu() {
    this.closeOverlays();
    this.dbMenu.classList.remove('hidden');
    this.dbBtn.classList.add('active');
    const notes = await this.vault.getNotes();
    const images = await this.vault.getAllImages();
    
    document.getElementById('stat-count').textContent = notes.length;
    document.getElementById('stat-imgs').textContent = images.length;
    
    let totalSize = 0;
    notes.forEach(n => totalSize += (n.content?.length || 0));
    images.forEach(img => totalSize += (img.data?.length || 0));
    
    document.getElementById('stat-size').textContent = (totalSize / 1024).toFixed(1) + ' KB';
  }

  closeOverlays() {
    this.viewMenu.classList.add('hidden');
    this.dbMenu.classList.add('hidden');
    this.graphMenu.classList.add('hidden');
    this.viewBtn.classList.remove('active');
    this.dbBtn.classList.remove('active');
    this.graphBtn.classList.remove('active');
  }

  setZoom(size) {
    localStorage.setItem('caveman-zoom', size);
    document.documentElement.style.setProperty('--zoom-scale', size + 'px');
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
    if (this.viewMode === 'editor') {
      this.updateLineNumbers();
    }
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('hidden');
  }

  showSearch() {
    this.editorSearchWidget.classList.remove('hidden');
    this.editorSearchInput.focus();
    this.editorSearchInput.select();
    this.performSearch();
  }

  hideSearch() {
    this.editorSearchWidget.classList.add('hidden');
    this.renderHighlights(); // Clear marks
    this.editorEl.focus();
  }

  performSearch(shouldJump = true) {
    const query = this.editorSearchInput.value;
    if (!query || query.length < 1) {
      this.editorSearchMatches = [];
      this.currentSearchMatchIndex = -1;
      this.renderHighlights();
      this.updateSearchUI();
      return;
    }

    const text = this.editorEl.value;
    try {
      const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      this.editorSearchMatches = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        this.editorSearchMatches.push({ start: match.index, end: match.index + match[0].length });
      }

      if (this.editorSearchMatches.length > 0) {
        if (this.currentSearchMatchIndex === -1 || shouldJump) {
          this.currentSearchMatchIndex = 0;
          if (shouldJump) {
            this.highlightMatch(false); 
          }
        }
      } else {
        this.currentSearchMatchIndex = -1;
      }
      this.renderHighlights();
      this.updateSearchUI();
    } catch (e) {
      this.editorSearchMatches = [];
      this.currentSearchMatchIndex = -1;
      this.renderHighlights();
      this.updateSearchUI();
    }
  }

  updateSearchUI() {
    const total = this.editorSearchMatches.length;
    const current = total > 0 ? this.currentSearchMatchIndex + 1 : 0;
    this.editorSearchResults.textContent = `${current}/${total}`;
  }

  highlightMatch(stealFocus = true) {
    if (this.currentSearchMatchIndex === -1) return;
    const match = this.editorSearchMatches[this.currentSearchMatchIndex];
    
    if (stealFocus) {
      this.editorEl.focus();
    }
    
    const lineHeight = parseFloat(getComputedStyle(this.editorEl).lineHeight);
    const beforeText = this.editorEl.value.substring(0, match.start);
    const lines = beforeText.split('\n');
    const lineIndex = lines.length - 1;
    
    const targetScroll = lineIndex * lineHeight - (this.editorEl.clientHeight / 2);
    
    this.editorEl.scrollTop = targetScroll;
    this.lineNumbersEl.scrollTop = this.editorEl.scrollTop;
    this.editorHighlightsEl.scrollTop = this.editorEl.scrollTop;
    
    this.renderHighlights();
  }

  renderHighlights() {
    const text = this.editorEl.value;
    const query = this.editorSearchInput.value;
    
    if (!query || this.editorSearchWidget.classList.contains('hidden')) {
      this.editorHighlightsEl.innerHTML = this.escapeHtml(text) + '\n';
      return;
    }

    try {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escapedQuery, 'gi');
      
      let lastIndex = 0;
      let html = '';
      let match;
      let count = 0;

      while ((match = regex.exec(text)) !== null) {
        html += this.escapeHtml(text.substring(lastIndex, match.index));
        const isCurrent = (count === this.currentSearchMatchIndex);
        html += `<mark class="${isCurrent ? 'current' : ''}">${this.escapeHtml(match[0])}</mark>`;
        lastIndex = regex.lastIndex;
        count++;
      }
      html += this.escapeHtml(text.substring(lastIndex));
      this.editorHighlightsEl.innerHTML = html + '\n';
    } catch (e) {
      this.editorHighlightsEl.innerHTML = this.escapeHtml(text) + '\n';
    }
  }

  escapeHtml(str) {
    return str.replace(/[&<>"']/g, function(m) {
      return {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
      }[m];
    });
  }

  goToNextMatch() {
    if (this.editorSearchMatches.length === 0) return;
    this.currentSearchMatchIndex = (this.currentSearchMatchIndex + 1) % this.editorSearchMatches.length;
    this.highlightMatch(false);
    this.updateSearchUI();
  }

  goToPrevMatch() {
    if (this.editorSearchMatches.length === 0) return;
    this.currentSearchMatchIndex = (this.currentSearchMatchIndex - 1 + this.editorSearchMatches.length) % this.editorSearchMatches.length;
    this.highlightMatch(false);
    this.updateSearchUI();
  }

  async purgeVault() {
    if (!this._confirmPurge) {
      this._confirmPurge = true;
      const btn = document.getElementById('purge-vault-btn');
      btn.textContent = 'REALLY? (IRREVERSIBLE)';
      btn.classList.add('btn-danger');
      
      this._purgeGlobalTimeout = setTimeout(() => {
        this._confirmPurge = false;
        btn.textContent = 'PURGE ENTIRE VAULT';
        btn.classList.remove('btn-danger');
      }, 3000);
      return;
    }

    clearTimeout(this._purgeGlobalTimeout);
    await this.vault.clear();
    localStorage.removeItem('caveman-current-note-id');
    location.reload();
  }

  async purgeUnusedImages() {
    const allNotes = await this.vault.getNotes();
    const images = await this.vault.getAllImages();
    const usedImageIds = new Set();
    
    // Updated regex to correctly identify IDs even with sizing arguments
    // ![[img-id]] or ![[img-id 100 100]]
    const imgPattern = /!\[\[(img-[a-zA-Z0-9_-]*)(?:\s+\d+)?(?:\s+\d+)?\]\]/g;
    
    allNotes.forEach(note => {
      let match;
      const content = note.content || '';
      while ((match = imgPattern.exec(content)) !== null) {
        usedImageIds.add(match[1].trim());
      }
    });
    
    const unused = images.filter(img => !usedImageIds.has(img.id));
    
    const btn = document.getElementById('purge-images-btn');
    if (unused.length === 0) {
      this.statusMessenger("Vault is clean.", "success");
      btn.textContent = "Purge Unused Images";
      btn.classList.remove('btn-danger');
      return;
    }

    if (!this._purgeStep) this._purgeStep = 0;
    this._purgeStep++;

    if (this._purgeStep === 1) {
      btn.textContent = `CONFIRM PURGE (${unused.length})?`;
      btn.classList.add('btn-danger');
      this._purgeTimeout = setTimeout(() => {
        this._purgeStep = 0;
        btn.textContent = "Purge Unused Images";
        btn.classList.remove('btn-danger');
      }, 3000);
      return;
    }

    if (this._purgeStep === 2) {
      clearTimeout(this._purgeTimeout);
      for (const img of unused) {
        await this.vault.deleteImage(img.id);
      }
      this.statusMessenger(`Purged ${unused.length} images.`, "success");
      this._purgeStep = 0;
      btn.textContent = "Purge Unused Images";
      btn.classList.remove('btn-danger');
      this.openDatabaseMenu();
    }
  }

  async exportVault() {
    this.statusMessenger("Creating ZIP...", "info");
    try {
      const zip = new JSZip();
      const images = await this.vault.getAllImages();
      const notesToExport = this.notes.filter(n => !n.isPublic);

      zip.file("notes.json", JSON.stringify(notesToExport, null, 2));
      
      const imgFolder = zip.folder("images");
      for (const img of images) {
        const base64Data = img.data.split(',')[1];
        if (base64Data) {
          imgFolder.file(`${img.id}.png`, base64Data, { base64: true });
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `caveman-vault-full-${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      this.statusMessenger("Exported ZIP", "success");
    } catch (e) {
      console.error(e);
      this.statusMessenger("Export Failed", "error");
    }
  }

  downloadJson(data, filename) {
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  async importVault(e) {
    const file = e.target.files[0];
    if (!file) return;

    console.log("Importing file:", file.name);
    if (!window.JSZip && typeof JSZip === 'undefined') {
      console.error("JSZip not loaded");
      this.statusMessenger("JSZip library missing", "error");
      return;
    }
    
    if (file.name.toLowerCase().endsWith('.zip')) {
      await this.importZip(file);
    } else {
      await this.importJson(file);
    }
    // Reset picker
    e.target.value = '';
  }

  async importJson(file) {
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.notes) {
          for (const note of data.notes) {
            await this.vault.saveNote(note);
          }
          if (data.images) {
            for (const img of data.images) {
              await this.vault.saveImage(img.id, img.data);
            }
          }
          this.statusMessenger(`Imported ${data.notes.length} notes.`, "success");
          await this.loadNotes();
          if (this.notes.length > 0) this.selectNote(this.notes[0]);
        }
      } catch (err) {
        this.statusMessenger("Invalid file format", "error");
        console.error(err);
      }
    };
    reader.readAsText(file);
  }

  async importZip(file) {
    this.statusMessenger("Unzipping...", "info");
    try {
      const zip = await JSZip.loadAsync(file);
      const notesFile = zip.file("notes.json");
      if (!notesFile) throw new Error("No notes.json found in ZIP");
      
      const notesData = JSON.parse(await notesFile.async("string"));
      for (const note of notesData) {
        await this.vault.saveNote(note);
      }

      const imgFolder = zip.folder("images");
      let imgCount = 0;
      if (imgFolder) {
        const files = [];
        imgFolder.forEach((path, file) => {
          if (!file.dir) files.push(file);
        });

        for (const f of files) {
          const id = f.name.split('/').pop().replace('.png', '').replace('.jpg', '').replace('.jpeg', '');
          const binaryData = await f.async("base64");
          // Reconstruct as PNG DataURL (safest assumption for alpha preservation)
          const dataUrl = `data:image/png;base64,${binaryData}`;
          await this.vault.saveImage(id, dataUrl);
          imgCount++;
        }
      }

      this.statusMessenger(`Imported ${notesData.length} items.`, "success");
      await this.loadNotes();
      if (this.notes.length > 0) this.selectNote(this.notes[0]);
    } catch (e) {
       console.error(e);
       this.statusMessenger("ZIP import failed", "error");
    }
  }

  statusMessenger(msg, type = "info") {
    this.lastSavedEl.textContent = msg;
    if (type === "success") this.lastSavedEl.style.color = "#44ff44";
    else if (type === "error") this.lastSavedEl.style.color = "#ff4444";
    else this.lastSavedEl.style.color = "";
    
    setTimeout(() => {
      this.lastSavedEl.textContent = "Ready";
      this.lastSavedEl.style.color = "";
    }, 4000);
  }

  updateLineNumbers() {
    if (!this.lineNumbersEl || !this.editorEl) return;
    
    // 1. Ensure Ghost Element for measurement
    if (!this.measureEl) {
      this.measureEl = document.createElement('div');
      this.measureEl.id = 'measure-wrap-el';
      this.measureEl.style.position = 'absolute';
      this.measureEl.style.visibility = 'hidden';
      this.measureEl.style.height = 'auto';
      this.measureEl.style.whiteSpace = 'pre-wrap';
      this.measureEl.style.wordWrap = 'break-word';
      this.measureEl.style.overflowWrap = 'break-word';
      this.measureEl.style.pointerEvents = 'none';
      this.measureEl.style.top = '-9999px';
      this.measureEl.style.left = '-9999px';
      document.body.appendChild(this.measureEl);
    }

    // 2. Sync styles with editor
    const style = window.getComputedStyle(this.editorEl);
    this.measureEl.style.fontFamily = style.fontFamily;
    this.measureEl.style.fontSize = style.fontSize;
    
    // Force a numeric line-height for calculations if 'normal'
    let lineHeight = parseFloat(style.lineHeight);
    if (isNaN(lineHeight)) {
      lineHeight = parseFloat(style.fontSize) * 1.6;
    }
    this.measureEl.style.lineHeight = lineHeight + 'px';
    
    this.measureEl.style.paddingLeft = style.paddingLeft;
    this.measureEl.style.paddingRight = style.paddingRight;
    this.measureEl.style.boxSizing = style.boxSizing;
    
    // Width must be exact to match textarea wrapping behavior
    // We use clientWidth but account for potential scrollbar flicker
    this.measureEl.style.width = this.editorEl.clientWidth + 'px';

    const lines = this.editorEl.value.split('\n');
    let lineNumbersContent = '';
    
    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i] || ' '; 
      this.measureEl.textContent = lineText;
      const height = this.measureEl.getBoundingClientRect().height;
      
      // Calculate visual lines by dividing total height by line height
      // We use a small epsilon to avoid floating point rounding issues
      const visualLines = Math.max(1, Math.round((height + 0.1) / lineHeight));
      
      // Line number for the FIRST visual line
      lineNumbersContent += `<div style="height:${lineHeight}px; line-height:${lineHeight}px;">${i + 1}</div>`;
      
      // Empty slots for subsequent wrapped visual lines
      for (let j = 1; j < visualLines; j++) {
        lineNumbersContent += `<div style="height:${lineHeight}px; line-height:${lineHeight}px;">&nbsp;</div>`;
      }
    }
    
    this.lineNumbersEl.innerHTML = lineNumbersContent;
    this.lineNumbersEl.scrollTop = this.editorEl.scrollTop;
  }

  scopeStyles(html) {
    if (!html) return '';
    // Find all <style> blocks and scope them to the #preview container
    return html.replace(/<style>([\s\S]*?)<\/style>/gi, (match, css) => {
      // Simple regex to find selectors before a '{'
      // This is not a full CSS parser but covers typical user-written styles in markdown
      const scopedCss = css.replace(/([^\r\n,{}]+)(?=[^{}]*{)/g, (selector) => {
        return selector.split(',').map(s => {
          let part = s.trim();
          if (!part) return '';
          
          // Skip at-rules (like @keyframes, @media)
          if (part.startsWith('@')) return part;
          
          // Skip common keyframe keywords
          if (part === 'from' || part === 'to' || /^\d+%$/.test(part)) return part;

          // Replace body/html with #preview scope
          if (part === 'body' || part === 'html') return '#preview';
          
          // Handle root pseudo-classes/elements attached to #preview
          if (part.startsWith(':')) return `#preview${part}`;

          // Prepend #preview selector to restrict scope
          return `#preview ${part}`;
        }).filter(s => s).join(', ');
      });
      return `<style>${scopedCss}</style>`;
    });
  }
}

new CavemanApp();

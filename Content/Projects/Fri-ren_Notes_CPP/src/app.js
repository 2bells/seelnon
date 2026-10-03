import { Vault } from './db.js';
import { Editor } from './editor.js';
import { GraphModule } from './graph.js';
import { ExportMenu } from './export.js';
import { ColorPicker } from './color-picker.js';
import { wasmEngine } from './wasm-engine.js';

class CavemanApp {
  constructor() {
    window.app = this;
    this.vault = new Vault();
    this.editorModule = new Editor(this.vault);
    this.graphModule = new GraphModule(this);
    this.exportMenu = new ExportMenu(this);
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
    this.editorFoldMap = new Map();
    this.foldIdCounter = 1;
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
    this.showEditorHighlights = localStorage.getItem('caveman-show-editor-highlights') !== 'false';

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
    this.searchMarksEl = document.getElementById('search-marks');
    this.editorColorWidgets = document.getElementById('editor-color-widgets');
    this.colorPicker = new ColorPicker();
    this.wasmEngine = wasmEngine;

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
      // 0. Initialize WebAssembly Engine
      await this.wasmEngine.init();

      // 0. Theme First (Immediate Caveman Comfort)
      const savedNightMode = localStorage.getItem('caveman-night-mode');
      if (savedNightMode === 'true') {
        this.isNightMode = true;
        document.body.classList.add('night-mode');
        document.documentElement.classList.add('night-mode');
      }
      this.updatePrismTheme();

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
      
      // Initialize Highlights Toggle
      this.showHighlightsCheck = document.getElementById('show-editor-highlights-check');
      if (this.showHighlightsCheck) {
        this.showHighlightsCheck.checked = this.showEditorHighlights;
        document.body.classList.toggle('no-highlights', !this.showEditorHighlights);
      }

      // Initialize Native Engine / C++ WASM Acceleration Toggle
      this.nativeEngineCheck = document.getElementById('native-engine-check');
      if (this.nativeEngineCheck && this.wasmEngine) {
        this.nativeEngineCheck.checked = this.wasmEngine.isNativeEngineEnabled();
        this.nativeEngineCheck.addEventListener('change', () => {
          this.wasmEngine.setNativeEngineEnabled(this.nativeEngineCheck.checked);
          this.cachedLines = null; // Force fresh highlight pass
          this.renderHighlights();
        });
      }

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
    window.addEventListener('beforeunload', () => {
      if (this.currentNote && this.saveTimeout) {
        this.vault.saveNote(this.currentNote);
      }
    });

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

    if (this.showHighlightsCheck) {
      this.showHighlightsCheck.addEventListener('change', () => {
        this.showEditorHighlights = this.showHighlightsCheck.checked;
        localStorage.setItem('caveman-show-editor-highlights', this.showEditorHighlights);
        document.body.classList.toggle('no-highlights', !this.showEditorHighlights);
        this.renderHighlights(); // Re-render if enabled
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
      const text = this.editorEl.value;
      const cursor = this.editorEl.selectionStart;

      // 1. Instant background highlight patch (<0.05ms)
      this.renderHighlightsFast(text, cursor);

      // 2. Fast input state handling
      this.handleInput();

      // 3. Debounced stats (300ms) to avoid blocking main thread on 80k WASM analysis
      clearTimeout(this._statsDebounceTimer);
      this._statsDebounceTimer = setTimeout(() => this.updateStats(), 300);

      // 4. Line count change check for line numbers (zero memory allocation)
      let lineCount = 1;
      for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10) lineCount++;
      }
      if (lineCount !== this.lastRenderedLineCount) {
        this.requestFastLineNumbers(true);
      } else {
        clearTimeout(this._lineNumbersDebounceTimer);
        this._lineNumbersDebounceTimer = setTimeout(() => this.requestFastLineNumbers(), 250);
      }

      // 5. Debounced search update if search widget is open (150ms)
      if (!this.editorSearchWidget.classList.contains('hidden')) {
        clearTimeout(this._searchDebounceTimer);
        this._searchDebounceTimer = setTimeout(() => this.performSearch(false), 150);
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
    this.lineNumbersEl.addEventListener('click', (e) => {
      const indicator = e.target.closest('.fold-indicator');
      if (indicator) {
        const lineIndex = parseInt(indicator.dataset.lineIndex);
        if (indicator.classList.contains('collapsed')) {
          this.unfoldHeading(lineIndex);
        } else {
          this.foldHeading(lineIndex);
        }
        return;
      }
      const foldRow = e.target.closest('.line-number-row.has-fold');
      if (foldRow) {
        const ind = foldRow.querySelector('.fold-indicator');
        if (ind) {
          const lineIndex = parseInt(ind.dataset.lineIndex);
          if (ind.classList.contains('collapsed')) {
            this.unfoldHeading(lineIndex);
          } else {
            this.foldHeading(lineIndex);
          }
        }
      }
    });
    this.editorEl.addEventListener('scroll', () => {
      this.syncAllEditorScrolls();
      this.onEditorScroll();
    });
    window.addEventListener('resize', () => {
      this.cachedCharWidth = null;
      this.cachedLineHeight = null;
      this._gutterLineTops = null;
      this._lastGutterStart = null;
      this._lastGutterEnd = null;
      this.updateLineNumbers(true);
      this.renderHighlights();
    });
    this.editorEl.addEventListener('click', (e) => {
      // 1. Direct hit-test for actual swatch or color box element ONLY
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const sw = elements.find(el => el.classList && (el.classList.contains('macro-inline-swatch') || el.classList.contains('editor-swatch-box') || el.classList.contains('macro-color-box-slot')));

      // Strict dormancy: only show full picker when user presses directly on the square
      if (!sw) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();

      const text = this.editorEl.value;
      const lines = text.split('\n');

      let targetLineIdx = -1;
      if (sw.hasAttribute('data-line-index')) {
        targetLineIdx = parseInt(sw.getAttribute('data-line-index'), 10);
      } else if (sw.getAttribute('data-macro-id')) {
        const mId = sw.getAttribute('data-macro-id');
        const numMatch = mId.match(/\d+/g);
        if (numMatch) targetLineIdx = parseInt(numMatch[0], 10);
      }

      if (targetLineIdx >= 0 && targetLineIdx < lines.length) {
        const lineText = lines[targetLineIdx];
        const macroMatch = lineText.match(/(?:\[|<)color\s*=\s*(?:#([0-9a-fA-F]*))?(?:\]|>)?/i);
        if (macroMatch) {
          const initialHex = macroMatch[1] ? (macroMatch[1].startsWith('#') ? macroMatch[1] : '#' + macroMatch[1]) : '';
          this.openColorPickerForMacro(targetLineIdx, sw, initialHex);
        }
      }
    });
    this.editorEl.addEventListener('mousemove', (e) => {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const sw = elements.find(el => el.classList && (el.classList.contains('macro-inline-swatch') || el.classList.contains('editor-swatch-box') || el.classList.contains('macro-color-box-slot')));
      if (sw) {
        if (this.lastHoveredSwatch !== sw) {
          if (this.lastHoveredSwatch) this.lastHoveredSwatch.classList.remove('hovered');
          this.lastHoveredSwatch = sw;
          sw.classList.add('hovered');
        }
        this.editorEl.style.cursor = 'pointer';
      } else {
        if (this.lastHoveredSwatch) {
          this.lastHoveredSwatch.classList.remove('hovered');
          this.lastHoveredSwatch = null;
        }
        this.editorEl.style.cursor = 'text';
      }
    });
    this.titleInput.addEventListener('input', () => this.handleInput());
    this.folderInput.addEventListener('input', () => this.handleInput());
    this.togglePreviewBtn.addEventListener('click', () => this.toggleEditorMode());
    this.canvasModeBtn.addEventListener('click', () => this.toggleCanvasMode());
    this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
    this.editorEl.addEventListener('paste', (e) => this.handlePaste(e));
    this.exportBtn.addEventListener('click', () => this.exportVault());
    this.exportNoteBtn.addEventListener('click', () => {
      if (this.viewMode === 'canvas') {
        this.exportMenu.open();
      } else {
        this.exportNoteAsPDF();
      }
    });
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

    window.addEventListener('resize', () => {
      this.updateLineNumbers();
      this.renderHighlights();
    });

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
      const isCtrlOrMeta = e.ctrlKey || e.metaKey;
      const keyLower = e.key ? e.key.toLowerCase() : '';

      if (isCtrlOrMeta && (keyLower === 'p' || e.key === ']')) {
        e.preventDefault();
        this.toggleEditorMode();
      }
      if (isCtrlOrMeta && keyLower === 'k') {
        e.preventDefault();
        this.toggleCanvasMode();
      }
      if (isCtrlOrMeta && e.key === '[') {
        e.preventDefault();
        this.toggleSidebar();
      }
      if (isCtrlOrMeta && keyLower === 'f') {
        e.preventDefault();
        this.showSearch();
      }
      if (e.key === 'F3') {
        e.preventDefault();
        if (this.editorSearchWidget.classList.contains('hidden')) {
          this.showSearch();
        } else {
          if (e.shiftKey) {
            this.goToPrevMatch();
          } else {
            this.goToNextMatch();
          }
        }
      }
      if (e.key === 'Escape') {
        this.closeOverlays();
        this.graphModule.close();
        this.hideSearch();
      }
      
      // Undo/Redo
      if (isCtrlOrMeta && keyLower === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          this.redo();
        } else {
          this.undo();
        }
      }
      if (isCtrlOrMeta && keyLower === 'y') {
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
    this.updatePrismTheme();
    if (isNight) {
      console.log("%cBONFIRE LIT", "color: #c0a062; font-size: 40px; font-weight: bold; font-family: serif; font-style: italic;");
    }
    if (this.canvasModule) {
      this.canvasModule.render();
    }
  }

  updatePrismTheme() {
    const isNight = document.body.classList.contains('night-mode');
    const prismTheme = document.getElementById('prism-theme');
    if (prismTheme) {
      prismTheme.href = isNight 
        ? './lib/prism-tomorrow.min.css'
        : './lib/prism.min.css';
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

    if (this.currentNote) {
      const found = this.notes.find(n => n.id.toString() === this.currentNote.id.toString());
      if (found) {
        this.currentNote = found;
      }
    }

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
    await this.handleInput(false, false, true);
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
    note._searchIndex = `${note.folder} ${note.title} ${note.content}`.toLowerCase();
    
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
    await this.handleInput(false, false, true);
    const note = {
      title: '',
      folder: '',
      content: '',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    note._searchIndex = '  '; // empty folder + empty title + empty content
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
      await this.handleInput(true, false, true); 
    }
    this.editorScrollResetNeeded = true;
    this.lastRenderedText = null;
    this.lastRenderedQuery = null;
    this.lastSearchWidgetHidden = null;
    this.lastRenderedMatchIndex = null;
    this.cachedLines = null;
    this.cachedHighlightedLines = null;
    this.lastRenderedLineCount = null;
    this.lastRenderedEditorWidth = null;
    this._gutterLineTops = null;
    this._gutterLineHeights = null;
    this._lastGutterStart = null;
    this._lastGutterEnd = null;
    this.currentNote = note;
    this.titleInput.value = note.title;
    this.folderInput.value = note.folder || '';
    this.editorEl.value = note.content;
    
    this.editorFoldMap.clear();
    this.foldIdCounter = 1;
    
    // Auto-restore folded headings
    try {
      const noteKey = `caveman-folded-${note.id || note.title || 'default'}`;
      const folded = JSON.parse(localStorage.getItem(noteKey) || '[]');
      if (Array.isArray(folded) && folded.length > 0) {
        let lines = this.editorEl.value.split('\n');
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const cleanLine = line.trim();
          if (/^(\s*#{1,6})\s+/.test(line) && folded.includes(cleanLine)) {
            const match = line.match(/^(\s*#{1,6})\s+/);
            const level = match ? match[1].trim().length : 0;
            if (level > 0) {
              let endIndex = i + 1;
              while (endIndex < lines.length) {
                const nextLine = lines[endIndex];
                const nextMatch = nextLine.match(/^(\s*#{1,6})\s+/);
                const nextLevel = nextMatch ? nextMatch[1].trim().length : 0;
                if (nextLevel > 0 && nextLevel <= level) {
                  break;
                }
                endIndex++;
              }
              const foldLines = lines.slice(i + 1, endIndex);
              if (foldLines.length > 0 && !foldLines[0].trim().startsWith('<!-- FOLD:')) {
                const foldContent = foldLines.join('\n');
                const shortId = `f_${this.foldIdCounter++}`;
                this.editorFoldMap.set(shortId, foldContent);
                lines = [
                  ...lines.slice(0, i + 1),
                  `<!-- FOLD:${shortId} -->`,
                  ...lines.slice(endIndex)
                ];
              }
            }
          }
        }
        this.editorEl.value = lines.join('\n');
      }
    } catch (e) {
      console.warn("Failed to restore folds:", e);
    }
    
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
    this.searchMarksEl.scrollTop = 0;
    this.searchMarksEl.scrollLeft = 0;
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
        await this.handleInput(true, false, true); // Persists but skips re-render to avoid flashing
        this.renderHighlights();
      }
    }
  }

  async handleInput(skipPreview = false, skipHistory = false, forceSave = false) {
    if (!this.currentNote) return;

    const newTitle = this.titleInput.value;
    const newFolder = this.folderInput.value;
    const rawContent = this.editorEl.value;
    
    if (this.currentNote.title === newTitle && 
        this.currentNote.folder === newFolder && 
        (this.currentNote.rawContent === rawContent || (!this.currentNote.rawContent && this.currentNote.content === rawContent))) {
      if (!skipPreview && this.viewMode === 'preview') this.updatePreview();
      return;
    }

    if (!skipHistory) {
      clearTimeout(this.historyTimer);
      this.historyTimer = setTimeout(() => this.pushHistory(), 400);
    }

    // If editing a public note, fork it into a local one first
    if (this.currentNote.isPublic) {
      const newContent = this.getCleanMarkdown(rawContent);
      const newNote = {
        title: this.titleInput.value,
        folder: this.folderInput.value,
        content: newContent,
        rawContent: rawContent,
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

    this.currentNote.title = newTitle;
    this.currentNote.folder = newFolder;
    this.currentNote.rawContent = rawContent;
    this.currentNote.updatedAt = Date.now();
    
    this.saveFoldedHeadingsState();
    
    if (this.viewMode === 'preview' && skipPreview !== true) this.updatePreview();

    if (forceSave) {
      clearTimeout(this.saveTimeout);
      const newContent = this.getCleanMarkdown(rawContent);
      this.currentNote.content = newContent;
      this.currentNote._searchIndex = `${this.currentNote.folder || ''} ${this.currentNote.title} ${this.currentNote.content}`.toLowerCase();
      await this.vault.saveNote(this.currentNote);
      this.renderNoteList();
      this.updateStats();
      this.lastSavedEl.textContent = `Saved: ${new Date().toLocaleTimeString()}`;
    } else {
      clearTimeout(this.saveTimeout);
      this.lastSavedEl.textContent = 'Saving...';
      this.saveTimeout = setTimeout(async () => {
        if (this.currentNote) {
          const currentRaw = this.editorEl ? this.editorEl.value : this.currentNote.rawContent;
          this.currentNote.content = this.getCleanMarkdown(currentRaw);
          this.currentNote._searchIndex = `${this.currentNote.folder || ''} ${this.currentNote.title} ${this.currentNote.content}`.toLowerCase();
          await this.vault.saveNote(this.currentNote);
          if (this._lastSavedTitle !== this.currentNote.title || this._lastSavedFolder !== this.currentNote.folder) {
            this._lastSavedTitle = this.currentNote.title;
            this._lastSavedFolder = this.currentNote.folder;
            this.renderNoteList();
          }
          this.updateStats();
          this.lastSavedEl.textContent = `Saved: ${new Date().toLocaleTimeString()}`;
        }
      }, 800);
    }
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
    setTimeout(() => this.renderHighlights(), 0);
    this.updateLineNumbers();
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
    setTimeout(() => this.renderHighlights(), 0);
    this.updateLineNumbers();
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
    if (!this.editorEl || !this.charCountEl) return;
    const text = this.editorEl.value;
    if (this.wasmEngine && this.wasmEngine.ready) {
      const stats = this.wasmEngine.analyze(text);
      if (stats) {
        this.charCountEl.textContent = `Chars: ${stats.totalChars} | Words: ${stats.totalWords} | Lines: ${stats.totalLines} [WASM]`;
        return;
      }
    }
    const length = text.length;
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
    
    // Detect all-caps headers to apply brutalist mono/sans style as requested
    this.previewEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach(h => {
      const text = h.textContent.trim();
      const letters = text.replace(/[^a-zA-Z]/g, '');
      if (letters.length > 0 && letters === letters.toUpperCase()) {
        h.classList.add('header-allcaps');
      }
    });
    
    // Attach lazy loader to images
    this.previewEl.querySelectorAll('.lazy-vault-img').forEach(img => {
      this.imageObserver.observe(img);
    });
  }

  switchView(mode) {
    if (this.colorPicker) this.colorPicker.close();
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
      
      // Force sync scroll elements now that they are visible in the DOM
      this.syncAllEditorScrolls(this.editorScrollResetNeeded);
      this.editorScrollResetNeeded = false;

      this.updateLineNumbers();
      setTimeout(() => this.renderHighlights(), 0);
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
              this.renderHighlights();
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
    const s = parseInt(size) || 14;
    const lh = Math.round(s * 1.6);
    localStorage.setItem('caveman-zoom', size);
    document.documentElement.style.setProperty('--zoom-scale', s + 'px');
    document.documentElement.style.setProperty('--editor-line-height', lh + 'px');
    this.cachedLineHeight = lh;
    this.cachedCharWidth = null;
    this._gutterLineTops = null;
    this._lastGutterStart = null;
    this._lastGutterEnd = null;
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
    if (this.viewMode === 'editor') {
      this.updateLineNumbers(true);
      this.renderHighlights();
    }
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('hidden');
    
    // Crucial: Update editor layouts after sidebar push/pull
    if (this.viewMode === 'editor') {
      setTimeout(() => {
        this.updateLineNumbers();
        this.renderHighlights();
      }, 0);
    }
  }

  showSearch() {
    this.editorSearchWidget.classList.remove('hidden');
    
    // Auto-populate search with active text selection if not empty and on one line
    const selStart = this.editorEl.selectionStart;
    const selEnd = this.editorEl.selectionEnd;
    if (typeof selStart === 'number' && typeof selEnd === 'number' && selStart !== selEnd) {
      const selectedText = this.editorEl.value.substring(selStart, selEnd);
      if (selectedText && selectedText.trim().length > 0 && !selectedText.includes('\n')) {
        this.editorSearchInput.value = selectedText;
      }
    }

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
      this.editorSearchMatches = [];
      if (this.wasmEngine && this.wasmEngine.ready) {
        const offsets = this.wasmEngine.search(query, false);
        const qLen = query.length;
        this.editorSearchMatches = offsets.map(offset => ({ start: offset, end: offset + qLen }));
      } else {
        const regex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        let match;
        while ((match = regex.exec(text)) !== null) {
          this.editorSearchMatches.push({ start: match.index, end: match.index + match[0].length });
        }
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
    
    // Render search highlights synchronously so they exist in the DOM right now
    this.renderHighlightsImmediate();
    
    const currentMark = this.searchMarksEl.querySelector('mark.current');
    if (currentMark) {
      // Find the relative offsetTop of the current mark element which reflects the actual layout positioning
      // (accounting for line-wrap, zooming, margins, custom widths etc.)
      const targetScroll = currentMark.offsetTop - (this.editorEl.clientHeight / 2);
      
      this.editorEl.scrollTop = targetScroll;
      this.syncAllEditorScrolls();
    } else {
      // Fallback in case mark.current was not found
      const lineHeight = parseFloat(getComputedStyle(this.editorEl).lineHeight);
      const beforeText = this.editorEl.value.substring(0, match.start);
      const lines = beforeText.split('\n');
      const lineIndex = lines.length - 1;
      
      const targetScroll = lineIndex * lineHeight - (this.editorEl.clientHeight / 2);
      
      this.editorEl.scrollTop = targetScroll;
      this.syncAllEditorScrolls();
    }
  }

  renderHighlights() {
    requestAnimationFrame(() => this.renderHighlightsImmediate());
  }

  syncAllEditorScrolls(reset = false) {
    if (!this.editorEl) return;
    if (reset) {
      this.editorEl.scrollTop = 0;
      this.editorEl.scrollLeft = 0;
    }
    const top = this.editorEl.scrollTop;
    const left = this.editorEl.scrollLeft;
    const scrollbarWidth = Math.max(0, this.editorEl.offsetWidth - this.editorEl.clientWidth);

    if (this.lineNumbersEl) this.lineNumbersEl.scrollTop = top;
    if (this.editorHighlightsEl) {
      this.editorHighlightsEl.scrollTop = top;
      this.editorHighlightsEl.scrollLeft = left;
      this.editorHighlightsEl.style.right = scrollbarWidth + 'px';
    }
    if (this.searchMarksEl) {
      this.searchMarksEl.scrollTop = top;
      this.searchMarksEl.scrollLeft = left;
      this.searchMarksEl.style.right = scrollbarWidth + 'px';
    }
    if (this.editorColorWidgets) {
      this.editorColorWidgets.scrollTop = top;
      this.editorColorWidgets.scrollLeft = left;
    }
  }

  openColorPickerForMacro(targetLineIdx, anchorBtn, initialHex = '') {
    if (!this.colorPicker) return;

    let targetIdx = typeof targetLineIdx === 'number' ? targetLineIdx : -1;
    if (targetIdx === -1 && typeof targetLineIdx === 'string') {
      const numMatch = targetLineIdx.match(/\d+/g);
      if (numMatch) targetIdx = parseInt(numMatch[0], 10);
    }

    const startColor = (initialHex && initialHex.length >= 4)
      ? (initialHex.startsWith('#') ? initialHex : '#' + initialHex)
      : (this.isNightMode ? '#a18a5e' : '#141414');

    const anchorRect = (anchorBtn && typeof anchorBtn.getBoundingClientRect === 'function')
      ? anchorBtn.getBoundingClientRect()
      : null;

    // Firmly lock viewport scroll position before picker interaction
    const lockedScrollTop = this.editorEl.scrollTop;
    const lockedScrollLeft = this.editorEl.scrollLeft;

    this.colorPicker.open({
      anchorEl: (anchorBtn && typeof anchorBtn.contains === 'function') ? anchorBtn : this.editorEl,
      anchorRect: anchorRect,
      initialColor: startColor,
      onSelect: (selectedHex) => {
        const currentScrollTop = this.editorEl.scrollTop > 0 ? this.editorEl.scrollTop : lockedScrollTop;
        const currentScrollLeft = this.editorEl.scrollLeft > 0 ? this.editorEl.scrollLeft : lockedScrollLeft;
        const savedSelStart = this.editorEl.selectionStart;
        const savedSelEnd = this.editorEl.selectionEnd;

        const currentText = this.editorEl.value;
        const currentLines = currentText.split('\n');

        let lIdx = targetIdx;
        if (lIdx < 0 || lIdx >= currentLines.length || !/(?:\[|<)color\s*=/i.test(currentLines[lIdx])) {
          lIdx = currentLines.findIndex((ln, idx) => Math.abs(idx - targetIdx) <= 2 && /(?:\[|<)color\s*=/i.test(ln));
        }
        if (lIdx === -1) return;

        const line = currentLines[lIdx];
        const cleanHex = selectedHex.replace(/^#/, '').toLowerCase();
        
        // Match existing tag structure: [color=#hex], [color=], <color=#hex>, etc.
        const tagRegex = /(\[|<)color(?:\s*=\s*|\s+)?(?:#[0-9a-fA-F]*)?(\]|\>)?/i;
        const m = line.match(tagRegex);
        if (!m) return;

        const openChar = m[1]; // '[' or '<'
        const closeChar = openChar === '<' ? '>' : ']';
        const newTag = `${openChar}color=  #${cleanHex}${closeChar}`;

        const updatedLine = line.replace(tagRegex, newTag);
        if (updatedLine === line) return;

        currentLines[lIdx] = updatedLine;
        this.editorEl.value = currentLines.join('\n');
        targetIdx = lIdx;

        // Restore scroll and cursor position immediately
        this.editorEl.scrollTop = currentScrollTop;
        this.editorEl.scrollLeft = currentScrollLeft;
        if (savedSelStart !== null && savedSelEnd !== null) {
          try { this.editorEl.setSelectionRange(savedSelStart, savedSelEnd); } catch (_) {}
        }

        this.handleInput(false, false, false);

        // Re-anchor scroll and sync highlights and line numbers
        this.editorEl.scrollTop = currentScrollTop;
        this.editorEl.scrollLeft = currentScrollLeft;
        this.renderHighlightsImmediate();
        this.syncAllEditorScrolls();
      },
      onClose: () => {
        const currentScrollTop = this.editorEl.scrollTop > 0 ? this.editorEl.scrollTop : lockedScrollTop;
        const currentScrollLeft = this.editorEl.scrollLeft > 0 ? this.editorEl.scrollLeft : lockedScrollLeft;
        try {
          this.editorEl.focus({ preventScroll: true });
        } catch (_) {
          this.editorEl.focus();
        }
        this.editorEl.scrollTop = currentScrollTop;
        this.editorEl.scrollLeft = currentScrollLeft;
        this.syncAllEditorScrolls();
      }
    });
  }

  onEditorScroll() {
    if (this._scrollRenderRaf) return;
    this._scrollRenderRaf = requestAnimationFrame(() => {
      this._scrollRenderRaf = null;
      this.renderHighlightsImmediate();
      this.updateLineNumbers(false);
    });
  }

  highlightInline(text, inCodeBlock = false, codeBlockLang = '') {
    if (!text) return '';
    const hasLang = Boolean(inCodeBlock && codeBlockLang && codeBlockLang.trim().length > 0);
    let prismLang = null;

    if (hasLang && typeof Prism !== 'undefined') {
      const effectiveLang = codeBlockLang.trim().toLowerCase();
      if (Prism.languages[effectiveLang]) {
        prismLang = effectiveLang;
      } else if (effectiveLang === 'js' && Prism.languages.javascript) {
        prismLang = 'javascript';
      } else if (effectiveLang === 'ts' && Prism.languages.typescript) {
        prismLang = 'typescript';
      } else if (effectiveLang === 'py' && Prism.languages.python) {
        prismLang = 'python';
      } else if (effectiveLang === 'sh' && Prism.languages.bash) {
        prismLang = 'bash';
      } else if ((effectiveLang === 'html' || effectiveLang === 'xml') && Prism.languages.markup) {
        prismLang = 'markup';
      } else if (effectiveLang === 'jus' && Prism.languages.lua) {
        prismLang = 'lua';
      }
    }

    if (inCodeBlock) {
      if (hasLang && prismLang && Prism.languages[prismLang]) {
        return Prism.highlight(text, Prism.languages[prismLang], prismLang);
      }
      return this.escapeHtml(text);
    } else if (typeof Prism !== 'undefined' && Prism.languages.markdown) {
      return Prism.highlight(text, Prism.languages.markdown, 'markdown');
    } else {
      return this.escapeHtml(text);
    }
  }

  formatOpenTagWithSwatch(tagRaw, lineIdx, mIdx, hex) {
    const currentHex = hex ? (hex.startsWith('#') ? hex : '#' + hex) : '';
    const mId = `cm-${lineIdx}-${mIdx}`;
    const swatchHtml = `<span class="macro-color-box-slot-center" data-macro-id="${mId}" data-line-index="${lineIdx}" data-color="${currentHex}"><span class="macro-inline-swatch ${currentHex ? '' : 'empty-swatch'}" style="${currentHex ? `background-color: ${currentHex};` : ''}" data-macro-id="${mId}" data-line-index="${lineIdx}"></span></span>`;

    const m = tagRaw.match(/^([\[<]color=)(\s*)(.*)$/i);
    if (m) {
      const tagPrefix = m[1]; // e.g. '[color=' or '<color='
      const spaces = m[2] || '';
      const tagSuffix = m[3] || '';
      const escapedPrefix = this.escapeHtml(tagPrefix);
      const escapedSuffix = this.escapeHtml(tagSuffix);

      if (spaces.length >= 2) {
        const spaceAfter = spaces.slice(1);
        return `<span class="token tag editor-color-tag">${escapedPrefix} </span>${swatchHtml}<span class="token tag editor-color-tag">${spaceAfter}${escapedSuffix}</span>`;
      } else if (spaces.length === 1) {
        return `<span class="token tag editor-color-tag">${escapedPrefix}</span>${swatchHtml}<span class="token tag editor-color-tag"> ${escapedSuffix}</span>`;
      } else {
        return `<span class="token tag editor-color-tag">${escapedPrefix}</span>${swatchHtml}<span class="token tag editor-color-tag">${escapedSuffix}</span>`;
      }
    }

    return `<span class="token tag editor-color-tag">${this.escapeHtml(tagRaw)}</span>`;
  }

  formatSingleLine(line, lineIdx = 0, inCodeBlock = false, codeBlockLang = '', colorEvents = null) {
    const trimmed = line.trim();

    if (trimmed.startsWith('```')) {
      return `<span class="token code-fence">${this.escapeHtml(line)}</span>`;
    }

    if (trimmed.startsWith('<!--') && trimmed.includes('FOLD:') && trimmed.endsWith('-->')) {
      return `<span class="editor-fold-marker">${this.escapeHtml(line)}</span>`;
    }

    let lineHtml = '';

    // Handle color events for this line
    if (colorEvents && colorEvents.length > 0) {
      const ev = colorEvents[0];
      if (ev.role === 'multiInside') {
        const highlighted = this.highlightInline(line, inCodeBlock, codeBlockLang);
        lineHtml = `<span class="editor-colored-text" style="color: ${ev.pair.hex} !important;">${highlighted}</span>`;
      } else if (ev.role === 'multiClose') {
        const textBefore = line.slice(0, ev.pair.close.start);
        const closeTag = line.slice(ev.pair.close.start, ev.pair.close.end);
        const textAfter = line.slice(ev.pair.close.end);
        const beforeHtml = `<span class="editor-colored-text" style="color: ${ev.pair.hex} !important;">${this.highlightInline(textBefore, inCodeBlock, codeBlockLang)}</span>`;
        const closeHtml = `<span class="token tag editor-color-tag">${this.escapeHtml(closeTag)}</span>`;
        const afterHtml = this.highlightInline(textAfter, inCodeBlock, codeBlockLang);
        lineHtml = beforeHtml + closeHtml + afterHtml;
      } else if (ev.role === 'sameLinePair') {
        const textBefore = line.slice(0, ev.pair.open.start);
        const openTag = line.slice(ev.pair.open.start, ev.pair.open.end);
        const coloredText = line.slice(ev.pair.open.end, ev.pair.close.start);
        const closeTag = line.slice(ev.pair.close.start, ev.pair.close.end);
        const textAfter = line.slice(ev.pair.close.end);
        const beforeHtml = this.highlightInline(textBefore, inCodeBlock, codeBlockLang);
        const openHtml = this.formatOpenTagWithSwatch(openTag, lineIdx, 0, ev.pair.hex);
        const coloredHtml = `<span class="editor-colored-text" style="color: ${ev.pair.hex} !important;">${this.highlightInline(coloredText, inCodeBlock, codeBlockLang)}</span>`;
        const closeHtml = `<span class="token tag editor-color-tag">${this.escapeHtml(closeTag)}</span>`;
        const afterHtml = this.highlightInline(textAfter, inCodeBlock, codeBlockLang);
        lineHtml = beforeHtml + openHtml + coloredHtml + closeHtml + afterHtml;
      } else if (ev.role === 'multiOpen') {
        const textBefore = line.slice(0, ev.pair.open.start);
        const openTag = line.slice(ev.pair.open.start, ev.pair.open.end);
        const coloredText = line.slice(ev.pair.open.end);
        const beforeHtml = this.highlightInline(textBefore, inCodeBlock, codeBlockLang);
        const openHtml = this.formatOpenTagWithSwatch(openTag, lineIdx, 0, ev.pair.hex);
        const coloredHtml = `<span class="editor-colored-text" style="color: ${ev.pair.hex} !important;">${this.highlightInline(coloredText, inCodeBlock, codeBlockLang)}</span>`;
        lineHtml = beforeHtml + openHtml + coloredHtml;
      } else if (ev.role === 'unclosedOpen') {
        const textBefore = line.slice(0, ev.open.start);
        const openTag = line.slice(ev.open.start, ev.open.end);
        const coloredText = line.slice(ev.open.end);
        const beforeHtml = this.highlightInline(textBefore, inCodeBlock, codeBlockLang);
        const openHtml = this.formatOpenTagWithSwatch(openTag, lineIdx, 0, ev.open.hex);
        const coloredHtml = ev.open.hex
          ? `<span class="editor-colored-text" style="color: ${ev.open.hex} !important;">${this.highlightInline(coloredText, inCodeBlock, codeBlockLang)}</span>`
          : this.highlightInline(coloredText, inCodeBlock, codeBlockLang);
        lineHtml = beforeHtml + openHtml + coloredHtml;
      }
    } else {
      // Check if user is typing a color tag on this line (requires '=' to show color box)
      const typingMatch = line.match(/(?:\[|<)color\s*=\s*(?:<span[^>]*>)?(?:#([0-9a-fA-F]*))?(\]|\>)?/i);
      if (typingMatch && (line.includes('[color=') || line.includes('<color='))) {
        const start = typingMatch.index;
        const end = start + typingMatch[0].length;
        const prefix = line.slice(0, start);
        const tagRaw = typingMatch[0];
        const suffix = line.slice(end);
        const hex = typingMatch[1] ? (typingMatch[1].startsWith('#') ? typingMatch[1] : '#' + typingMatch[1]) : '';
        const openTagHtml = this.formatOpenTagWithSwatch(tagRaw, lineIdx, 0, hex);
        const suffixHtml = hex
          ? `<span class="editor-colored-text" style="color: ${hex} !important;">${this.highlightInline(suffix, inCodeBlock, codeBlockLang)}</span>`
          : this.highlightInline(suffix, inCodeBlock, codeBlockLang);
        lineHtml = this.highlightInline(prefix, inCodeBlock, codeBlockLang) + openTagHtml + suffixHtml;
      } else {
        lineHtml = this.highlightInline(line, inCodeBlock, codeBlockLang);
      }
    }

    if (inCodeBlock) {
      // ALWAYS wrap code block lines in .editor-code-line for blue code-like aesthetics & filled spacebars
      const content = lineHtml.length > 0 ? lineHtml : '&nbsp;';
      lineHtml = `<span class="editor-code-line">${content}</span>`;
    }

    // Fold markers (10% opacity)
    if (lineHtml.includes('FOLD:')) {
      lineHtml = lineHtml.replace(/<span class="token comment">&lt;!--\s*FOLD:.*?\s*--&gt;<\/span>/gi, match => `<span class="editor-fold-marker">${match}</span>`);
      lineHtml = lineHtml.replace(/&lt;!--\s*FOLD:.*?\s*--&gt;/gi, match => `<span class="editor-fold-marker">${match}</span>`);
      lineHtml = lineHtml.replace(/<!--\s*FOLD:.*?\s*-->/gi, match => `<span class="editor-fold-marker">${this.escapeHtml(match)}</span>`);
    }

    return lineHtml;
  }

  renderHighlightsFast(text, cursor = 0) {
    if (!this.showEditorHighlights) return;
    if (!this.cachedLines || !this.cachedHighlightedLines || this.cachedLines.length === 0) {
      this.renderHighlightsImmediate();
      return;
    }

    const newLines = text.split('\n');
    const oldLength = this.cachedLines.length;
    const newLength = newLines.length;

    // Fast cursor line index lookup
    let cursorLineIdx = 0;
    for (let i = 0, len = Math.min(cursor, text.length); i < len; i++) {
      if (text.charCodeAt(i) === 10) cursorLineIdx++;
    }

    const inCodeBlock = this.cachedCodeBlockStates ? Boolean(this.cachedCodeBlockStates[cursorLineIdx]) : false;
    const codeBlockLang = this.cachedCodeBlockLangs ? (this.cachedCodeBlockLangs[cursorLineIdx] || '') : '';

    if (newLength === oldLength) {
      // 1. Single line update (keystroke or backspace inside a line)
      let changedIdx = cursorLineIdx;
      if (changedIdx >= newLength) changedIdx = newLength - 1;

      if (newLines[changedIdx] === this.cachedLines[changedIdx]) {
        for (let i = 0; i < newLength; i++) {
          if (newLines[i] !== this.cachedLines[i]) {
            changedIdx = i;
            break;
          }
        }
      }

      if (changedIdx < newLength && newLines[changedIdx] !== this.cachedLines[changedIdx]) {
        // If backticks or color tags were added/removed/edited, trigger immediate pass
        if (newLines[changedIdx].includes('```') || this.cachedLines[changedIdx].includes('```') || newLines[changedIdx].includes('color') || this.cachedLines[changedIdx].includes('color')) {
          this.renderHighlightsImmediate();
          return;
        }

        this.cachedLines[changedIdx] = newLines[changedIdx];
        this.cachedHighlightedLines[changedIdx] = this.formatSingleLine(newLines[changedIdx], changedIdx, inCodeBlock, codeBlockLang);
        
        if (!this._fastHighlightRaf) {
          this._fastHighlightRaf = requestAnimationFrame(() => {
            this._fastHighlightRaf = null;
            if (this.cachedHighlightedLines && this.editorHighlightsEl) {
              this.editorHighlightsEl.innerHTML = this.cachedHighlightedLines.join('\n') + '\n';
            }
          });
        }
      }
    } else if (newLength === oldLength + 1) {
      // 2. User pressed Enter (line added)
      let splitIdx = -1;
      for (let i = 0; i < oldLength; i++) {
        if (newLines[i] !== this.cachedLines[i]) {
          splitIdx = i;
          break;
        }
      }
      if (splitIdx === -1) splitIdx = Math.max(0, cursorLineIdx - 1);

      const line1 = newLines[splitIdx];
      const line2 = newLines[splitIdx + 1];

      if (line1.includes('color') || line2.includes('color') || (this.cachedLines[splitIdx] && this.cachedLines[splitIdx].includes('color'))) {
        this.renderHighlightsImmediate();
        this.requestFastLineNumbers(true);
        return;
      }

      const formatted1 = this.formatSingleLine(line1, splitIdx, inCodeBlock, codeBlockLang);
      const formatted2 = this.formatSingleLine(line2, splitIdx + 1, inCodeBlock, codeBlockLang);

      this.cachedLines.splice(splitIdx, 1, line1, line2);
      this.cachedHighlightedLines.splice(splitIdx, 1, formatted1, formatted2);
      
      if (!this._fastHighlightRaf) {
        this._fastHighlightRaf = requestAnimationFrame(() => {
          this._fastHighlightRaf = null;
          if (this.cachedHighlightedLines && this.editorHighlightsEl) {
            this.editorHighlightsEl.innerHTML = this.cachedHighlightedLines.join('\n') + '\n';
          }
        });
      }
      this.requestFastLineNumbers(true);
    } else if (newLength === oldLength - 1) {
      // 3. User pressed Backspace/Delete (line merged)
      let mergeIdx = -1;
      for (let i = 0; i < newLength; i++) {
        if (newLines[i] !== this.cachedLines[i]) {
          mergeIdx = i;
          break;
        }
      }
      if (mergeIdx === -1) mergeIdx = cursorLineIdx;

      const mergedLine = newLines[mergeIdx];
      if (mergedLine.includes('color') || (this.cachedLines[mergeIdx] && this.cachedLines[mergeIdx].includes('color')) || (this.cachedLines[mergeIdx + 1] && this.cachedLines[mergeIdx + 1].includes('color'))) {
        this.renderHighlightsImmediate();
        this.requestFastLineNumbers(true);
        return;
      }

      const formatted = this.formatSingleLine(mergedLine, mergeIdx, inCodeBlock, codeBlockLang);

      this.cachedLines.splice(mergeIdx, 2, mergedLine);
      this.cachedHighlightedLines.splice(mergeIdx, 2, formatted);
      
      if (!this._fastHighlightRaf) {
        this._fastHighlightRaf = requestAnimationFrame(() => {
          this._fastHighlightRaf = null;
          if (this.cachedHighlightedLines && this.editorHighlightsEl) {
            this.editorHighlightsEl.innerHTML = this.cachedHighlightedLines.join('\n') + '\n';
          }
        });
      }
      this.requestFastLineNumbers(true);
    } else {
      // 4. Large paste or multi-line edit
      this.renderHighlightsImmediate();
      return;
    }

    // Schedule background full pass for syntax tokenization across lines (400ms debounce)
    clearTimeout(this._fullHighlightTimer);
    this._fullHighlightTimer = setTimeout(() => {
      this.renderHighlights();
    }, 400);
  }

  renderHighlightsImmediate() {
    if (!this.currentNote || this.viewMode !== 'editor') return;

    const text = this.editorEl.value;
    const query = this.editorSearchInput.value;
    const isSearchHidden = this.editorSearchWidget.classList.contains('hidden');
    const matchIndex = this.currentSearchMatchIndex;
    const scrollTop = this.editorEl.scrollTop;

    // Fast check: if nothing changed AND scroll window hasn't shifted significantly
    const scrollDelta = Math.abs(scrollTop - (this.lastRenderedScrollTop || 0));
    if (text === this.lastRenderedText && 
        query === this.lastRenderedQuery && 
        isSearchHidden === this.lastSearchWidgetHidden &&
        matchIndex === this.lastRenderedMatchIndex &&
        scrollDelta < 100) {
      return;
    }

    this.lastRenderedText = text;
    this.lastRenderedQuery = query;
    this.lastSearchWidgetHidden = isSearchHidden;
    this.lastRenderedMatchIndex = matchIndex;
    this.lastRenderedScrollTop = scrollTop;
    
    try {
      // 1. Scan for color tags & compute manual enclosures vs single-line auto-closes
      const rawLines = text.split('\n');
      const totalLines = rawLines.length;

      const tags = [];
      const openRegex = /(?:\[|<)color\s*=\s*(?:#([0-9a-fA-F]{0,8}))?(?:\]|>)/gi;
      const closeRegex = /(?:\[\/color\]|<\/color>)/gi;

      for (let lineIdx = 0; lineIdx < totalLines; lineIdx++) {
        const line = rawLines[lineIdx];
        if (!line.includes('color')) continue;

        let m;
        const oRe = new RegExp(openRegex.source, 'gi');
        while ((m = oRe.exec(line)) !== null) {
          tags.push({
            type: 'open',
            line: lineIdx,
            start: m.index,
            end: m.index + m[0].length,
            hex: m[1] ? (m[1].startsWith('#') ? m[1] : '#' + m[1]) : '',
            raw: m[0]
          });
        }
        const cRe = new RegExp(closeRegex.source, 'gi');
        while ((m = cRe.exec(line)) !== null) {
          tags.push({
            type: 'close',
            line: lineIdx,
            start: m.index,
            end: m.index + m[0].length,
            raw: m[0]
          });
        }
      }

      tags.sort((a, b) => a.line === b.line ? a.start - b.start : a.line - b.line);

      const matchedPairs = [];
      const stack = [];
      for (let tIdx = 0; tIdx < tags.length; tIdx++) {
        const t = tags[tIdx];
        if (t.type === 'open') {
          stack.push(t);
        } else if (t.type === 'close') {
          if (stack.length > 0) {
            const op = stack.pop();
            matchedPairs.push({ open: op, close: t, hex: op.hex });
          }
        }
      }
      const unclosedOpens = stack;

      // Group by line for O(1) lookup during line generation
      const lineTagMap = new Map();
      for (let pIdx = 0; pIdx < matchedPairs.length; pIdx++) {
        const p = matchedPairs[pIdx];
        if (p.open.line === p.close.line) {
          if (!lineTagMap.has(p.open.line)) lineTagMap.set(p.open.line, []);
          lineTagMap.get(p.open.line).push({ role: 'sameLinePair', pair: p });
        } else {
          if (!lineTagMap.has(p.open.line)) lineTagMap.set(p.open.line, []);
          lineTagMap.get(p.open.line).push({ role: 'multiOpen', pair: p });

          if (!lineTagMap.has(p.close.line)) lineTagMap.set(p.close.line, []);
          lineTagMap.get(p.close.line).push({ role: 'multiClose', pair: p });

          for (let l = p.open.line + 1; l < p.close.line; l++) {
            if (!lineTagMap.has(l)) lineTagMap.set(l, []);
            lineTagMap.get(l).push({ role: 'multiInside', pair: p });
          }
        }
      }

      for (let uIdx = 0; uIdx < unclosedOpens.length; uIdx++) {
        const u = unclosedOpens[uIdx];
        if (!lineTagMap.has(u.line)) lineTagMap.set(u.line, []);
        lineTagMap.get(u.line).push({ role: 'unclosedOpen', open: u });
      }

      // Configure Prism markdown once
      if (typeof Prism !== 'undefined' && Prism.languages.markdown) {
        if (!Prism.languages.markdown.wikilink) {
          Prism.languages.markdown.wikilink = {
            pattern: /\[\[.*?\]\]/,
            alias: 'wikilink'
          };
        }
      }

      if (!this._lineHighlightCache) this._lineHighlightCache = new Map();

      // OPTIMIZATION: Incremental line diffing via native C++ / WASM engine (Feature 3)
      let incrementalApplied = false;
      let highlightedLines;
      let codeBlockStates;
      let codeBlockLangs;

      if (this.wasmEngine && this.wasmEngine.isNativeEngineEnabled() && 
          this.cachedLines && this.cachedHighlightedLines && 
          this.cachedCodeBlockStates && this.cachedCodeBlockLangs &&
          this.cachedHighlightedLines.length === this.cachedLines.length) {
        
        const diff = this.wasmEngine.diffEngine.findLineDiff(this.cachedLines, rawLines);
        
        if (!diff.isFull && !diff.changed) {
          // Document lines unchanged
          highlightedLines = this.cachedHighlightedLines;
          codeBlockStates = this.cachedCodeBlockStates;
          codeBlockLangs = this.cachedCodeBlockLangs;
          incrementalApplied = true;
        } else if (!diff.isFull && diff.changed) {
          const p = diff.startLine;
          const oldEnd = diff.oldEndLine;
          const newEnd = diff.newEndLine;

          // Check whether code fence status remains consistent across the splice
          let inCodeBlock = (p > 0 && p <= this.cachedCodeBlockStates.length) 
            ? (this.cachedCodeBlockStates[p - 1] === 1) 
            : false;
          let codeBlockLang = (p > 0 && p <= this.cachedCodeBlockLangs.length)
            ? (this.cachedCodeBlockLangs[p - 1] || '')
            : '';
          
          let validSplice = true;
          const deltaHighlights = [];
          const deltaStates = [];
          const deltaLangs = [];

          for (let i = p; i < newEnd; i++) {
            const line = rawLines[i];
            const trimmed = line.trim();

            if (trimmed.startsWith('```')) {
              if (!inCodeBlock) {
                inCodeBlock = true;
                codeBlockLang = trimmed.slice(3).trim().toLowerCase().split(/\s+/)[0];
              } else {
                inCodeBlock = false;
                codeBlockLang = '';
              }
              deltaStates.push(1);
              deltaLangs.push('');
              deltaHighlights.push(`<span class="token code-fence">${this.escapeHtml(line)}</span>`);
              continue;
            }

            deltaStates.push(inCodeBlock ? 1 : 0);
            deltaLangs.push(codeBlockLang);

            const lineColorEvents = lineTagMap.get(i);
            const hasColorMacro = Boolean(lineColorEvents && lineColorEvents.length > 0);
            const cacheKey = !hasColorMacro && !line.includes('color') && !line.includes('FOLD:')
              ? `${inCodeBlock ? codeBlockLang : 'md'}:${line}`
              : null;

            let formatted = cacheKey ? this._lineHighlightCache.get(cacheKey) : null;
            if (!formatted) {
              formatted = this.formatSingleLine(line, i, inCodeBlock, codeBlockLang, lineColorEvents);
              if (cacheKey) {
                if (this._lineHighlightCache.size > 8000) this._lineHighlightCache.clear();
                this._lineHighlightCache.set(cacheKey, formatted);
              }
            }
            deltaHighlights.push(formatted);
          }

          // Verify if suffix codeblock state is unperturbed
          const expectedSuffixState = (oldEnd < this.cachedCodeBlockStates.length)
            ? (this.cachedCodeBlockStates[oldEnd] === 1)
            : false;
          
          if (inCodeBlock === expectedSuffixState) {
            highlightedLines = [
              ...this.cachedHighlightedLines.slice(0, p),
              ...deltaHighlights,
              ...this.cachedHighlightedLines.slice(oldEnd)
            ];
            codeBlockStates = new Uint8Array(totalLines);
            codeBlockStates.set(this.cachedCodeBlockStates.subarray(0, p), 0);
            codeBlockStates.set(new Uint8Array(deltaStates), p);
            codeBlockStates.set(this.cachedCodeBlockStates.subarray(oldEnd), newEnd);

            codeBlockLangs = [
              ...this.cachedCodeBlockLangs.slice(0, p),
              ...deltaLangs,
              ...this.cachedCodeBlockLangs.slice(oldEnd)
            ];
            incrementalApplied = true;
          }
        }
      }

      if (!incrementalApplied) {
        let inCodeBlock = false;
        let codeBlockLang = '';
        let codeBlockStartLine = -1;
        highlightedLines = new Array(totalLines);
        codeBlockStates = new Uint8Array(totalLines);
        codeBlockLangs = new Array(totalLines);

        for (let i = 0; i < totalLines; i++) {
          const line = rawLines[i];
          const trimmed = line.trim();

          // Track fenced code blocks continuously across the entire document
          if (trimmed.startsWith('```')) {
            if (!inCodeBlock) {
              inCodeBlock = true;
              codeBlockLang = trimmed.slice(3).trim().toLowerCase().split(/\s+/)[0];
              codeBlockStartLine = i;
            } else {
              inCodeBlock = false;
              codeBlockLang = '';
              codeBlockStartLine = -1;
            }
            codeBlockStates[i] = 1;
            codeBlockLangs[i] = '';
            highlightedLines[i] = `<span class="token code-fence">${this.escapeHtml(line)}</span>`;
            continue;
          }

          // Safety cap: If an unclosed code block exceeds 500 lines, auto-close it to prevent lagging 80k words
          if (inCodeBlock && codeBlockStartLine >= 0 && (i - codeBlockStartLine > 500)) {
            inCodeBlock = false;
            codeBlockLang = '';
            codeBlockStartLine = -1;
          }

          codeBlockStates[i] = inCodeBlock ? 1 : 0;
          codeBlockLangs[i] = codeBlockLang;

          const lineColorEvents = lineTagMap.get(i);
          const hasColorMacro = Boolean(lineColorEvents && lineColorEvents.length > 0);
          
          // Use cached formatted line if available and no dynamic macros/folding
          const cacheKey = !hasColorMacro && !line.includes('color') && !line.includes('FOLD:')
            ? `${inCodeBlock ? codeBlockLang : 'md'}:${line}`
            : null;

          let formatted = cacheKey ? this._lineHighlightCache.get(cacheKey) : null;
          if (!formatted) {
            formatted = this.formatSingleLine(line, i, inCodeBlock, codeBlockLang, lineColorEvents);
            if (cacheKey) {
              if (this._lineHighlightCache.size > 8000) this._lineHighlightCache.clear();
              this._lineHighlightCache.set(cacheKey, formatted);
            }
          }
          highlightedLines[i] = formatted;
        }
      }

      this.editorHighlightsEl.innerHTML = highlightedLines.join('\n') + '\n';
      this.cachedLines = rawLines.slice();
      this.cachedHighlightedLines = highlightedLines.slice();
      this.cachedCodeBlockStates = codeBlockStates;
      this.cachedCodeBlockLangs = codeBlockLangs;

      if (this.editorColorWidgets) {
        this.editorColorWidgets.innerHTML = '';
      }

      // 2. Search Highlights
      if (!query || this.editorSearchWidget.classList.contains('hidden')) {
        if (this.searchMarksEl.innerHTML !== '') {
          this.searchMarksEl.innerHTML = '';
        }
        this.syncAllEditorScrolls();
        return;
      }

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
      this.searchMarksEl.innerHTML = html + '\n';
    } catch (e) {
      console.warn("Highlighter failed:", e);
      if (this.editorHighlightsEl) this.editorHighlightsEl.innerHTML = this.escapeHtml(text) + '\n';
    }
    this.syncAllEditorScrolls();
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
    const btn = document.getElementById('purge-vault-btn');
    if (!this._vaultPurgeStep) this._vaultPurgeStep = 0;
    this._vaultPurgeStep++;

    if (this._purgeGlobalTimeout) clearTimeout(this._purgeGlobalTimeout);

    if (this._vaultPurgeStep === 1) {
      btn.textContent = 'REALLY? (IRREVERSIBLE)';
      btn.className = 'btn-danger'; // Standard red
    } else if (this._vaultPurgeStep === 2) {
      btn.textContent = 'EVERYTHING WILL BE GONE!';
      btn.className = 'btn-danger-dark'; // Darker red
    } else if (this._vaultPurgeStep === 3) {
      btn.textContent = 'ARE YOU REALLY REALLY SURE?';
      btn.className = 'btn-danger-extreme'; // Deep red
    } else if (this._vaultPurgeStep === 4) {
      await this.vault.clear();
      localStorage.removeItem('caveman-current-note-id');
      location.reload();
      return;
    }

    this._purgeGlobalTimeout = setTimeout(() => {
      this._vaultPurgeStep = 0;
      btn.textContent = 'PURGE ENTIRE VAULT';
      btn.className = '';
    }, 4000); // Give them 4 seconds between clicks
  }

  async purgeUnusedImages() {
    const allNotes = await this.vault.getNotes();
    const images = await this.vault.getAllImages();
    const usedImageIds = new Set();
    
     // Updated regex to correctly identify IDs even with sizing, scale and alignment arguments
    // ![[img-id]] or ![[img-id 100 100]] or ![[img-id 40% c]]
    const imgPattern = /!\[\[(img-[a-zA-Z0-9_-]*)(?:\s+[^\]]+)?\]\]/g;
    
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
      zip.file("folder-settings.json", JSON.stringify(this.folderSettings, null, 2));
      zip.file("tint-palette.json", JSON.stringify(this.tintPalette, null, 2));
      zip.file("collapsed-folders.json", JSON.stringify(this.collapsedFolders, null, 2));
      
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
          if (data.folderSettings) {
            this.folderSettings = { ...this.folderSettings, ...data.folderSettings };
            localStorage.setItem('caveman-folder-settings', JSON.stringify(this.folderSettings));
          }
          if (data.tintPalette) {
            this.tintPalette = data.tintPalette;
            localStorage.setItem('caveman-tint-palette', JSON.stringify(this.tintPalette));
          }
          if (data.collapsedFolders) {
            this.collapsedFolders = [...new Set([...this.collapsedFolders, ...data.collapsedFolders])];
            localStorage.setItem('caveman-collapsed-folders', JSON.stringify(this.collapsedFolders));
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

      const settingsFile = zip.file("folder-settings.json");
      if (settingsFile) {
        const settingsData = JSON.parse(await settingsFile.async("string"));
        this.folderSettings = { ...this.folderSettings, ...settingsData };
        localStorage.setItem('caveman-folder-settings', JSON.stringify(this.folderSettings));
      }

      const paletteFile = zip.file("tint-palette.json");
      if (paletteFile) {
        const paletteData = JSON.parse(await paletteFile.async("string"));
        this.tintPalette = paletteData;
        localStorage.setItem('caveman-tint-palette', JSON.stringify(this.tintPalette));
      }

      const collapsedFile = zip.file("collapsed-folders.json");
      if (collapsedFile) {
        const collapsedData = JSON.parse(await collapsedFile.async("string"));
        this.collapsedFolders = [...new Set([...this.collapsedFolders, ...collapsedData])];
        localStorage.setItem('caveman-collapsed-folders', JSON.stringify(this.collapsedFolders));
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

  getCharWidth() {
    if (!this.cachedCharWidth || this.cachedCharWidth <= 0) {
      const span = document.createElement('span');
      span.style.fontFamily = 'var(--font-mono)';
      span.style.fontSize = 'var(--zoom-scale, 14px)';
      span.style.fontWeight = '400';
      span.style.letterSpacing = '0px';
      span.style.position = 'absolute';
      span.style.visibility = 'hidden';
      span.textContent = 'WWWWWWWWWWWWWWWWWWWW'; // 20 chars
      document.body.appendChild(span);
      this.cachedCharWidth = span.getBoundingClientRect().width / 20;
      span.remove();
      if (!this.cachedCharWidth || isNaN(this.cachedCharWidth) || this.cachedCharWidth <= 0) this.cachedCharWidth = 8.4;
    }
    return this.cachedCharWidth;
  }

  getLineHeight() {
    if (!this.cachedLineHeight || this.cachedLineHeight <= 0) {
      const style = window.getComputedStyle(this.editorEl);
      let lh = Math.round(parseFloat(style.lineHeight));
      if (isNaN(lh) || lh <= 0) {
        lh = Math.round(parseFloat(style.fontSize) * 1.6);
      }
      this.cachedLineHeight = lh || 24;
    }
    return this.cachedLineHeight;
  }

  countVisualLines(text, maxChars) {
    if (!text || text.length <= maxChars) return 1;
    let count = 0;
    let idx = 0;
    const len = text.length;
    while (idx < len) {
      count++;
      if (idx + maxChars >= len) break;
      let breakIdx = text.lastIndexOf(' ', idx + maxChars);
      if (breakIdx <= idx) {
        idx += maxChars;
      } else {
        idx = breakIdx + 1;
      }
    }
    return Math.max(1, count);
  }

  requestFastLineNumbers(force = false) {
    if (this._lineNumberRaf) return;
    this._lineNumberRaf = requestAnimationFrame(() => {
      this._lineNumberRaf = null;
      this.updateLineNumbers(force);
    });
  }

  updateLineNumbers(force = false) {
    if (!this.lineNumbersEl || !this.editorEl) return;
    
    const editorWidth = this.editorEl.clientWidth;
    const text = this.editorEl.value;
    const lines = text.split('\n');
    const totalLines = lines.length;

    const charWidth = this.getCharWidth();
    const lineHeight = this.getLineHeight();
    const usableWidth = Math.max(100, editorWidth - 52);
    const maxCharsPerLine = Math.max(10, Math.floor(usableWidth / charWidth));

    const needsMetrics = force || 
                         totalLines !== this.lastRenderedLineCount || 
                         editorWidth !== this.lastRenderedEditorWidth || 
                         !this._gutterLineTops || 
                         this._gutterLineTops.length !== totalLines + 1;

    if (needsMetrics) {
      this.lastRenderedLineCount = totalLines;
      this.lastRenderedEditorWidth = editorWidth;

      // Fast layout metrics calculation using integer arithmetic to eliminate subpixel drift
      const lineHeights = new Int32Array(totalLines);
      const lineTops = new Int32Array(totalLines + 1);
      const headingLevels = new Int8Array(totalLines);
      let runningTop = 0;

      for (let i = 0; i < totalLines; i++) {
        const lineText = lines[i];
        let visualLines = 1;
        if (lineText.length > maxCharsPerLine) {
          visualLines = this.countVisualLines(lineText, maxCharsPerLine);
        }
        const h = visualLines * lineHeight;
        lineHeights[i] = h;
        lineTops[i] = runningTop;
        runningTop += h;

        const match = lineText.match(/^(\s*#{1,6})\s+/);
        headingLevels[i] = match ? match[1].trim().length : 0;
      }
      lineTops[totalLines] = runningTop;

      this._gutterLineHeights = lineHeights;
      this._gutterLineTops = lineTops;
      this._gutterHeadingLevels = headingLevels;

      const editorScrollHeight = this.editorEl.scrollHeight || runningTop;
      this._gutterTotalHeight = Math.max(runningTop, editorScrollHeight);
      this._gutterLines = lines;
    }

    // Determine visible window from current scroll position
    const scrollTop = this.editorEl.scrollTop;
    const clientHeight = this.editorEl.clientHeight || 800;
    const lineTops = this._gutterLineTops;
    const lineHeights = this._gutterLineHeights;
    const headingLevels = this._gutterHeadingLevels;
    const cachedLines = this._gutterLines || lines;

    // Fast search for visible start line
    let startLine = 0;
    while (startLine < totalLines - 1 && lineTops[startLine + 1] < scrollTop) {
      startLine++;
    }
    let endLine = startLine;
    while (endLine < totalLines && lineTops[endLine] < scrollTop + clientHeight) {
      endLine++;
    }

    // Add buffer of 35 lines above and below for smooth scrolling
    startLine = Math.max(0, startLine - 35);
    endLine = Math.min(totalLines, endLine + 35);

    // CRITICAL: If scrolled near the bottom, ALWAYS include all the way to totalLines
    if (scrollTop + clientHeight >= (lineTops[totalLines] || 0) - 300 || endLine >= totalLines - 25) {
      endLine = totalLines;
      startLine = Math.max(0, Math.min(startLine, totalLines - 80));
    }

    // Fast exit if visible range & metrics have not changed
    if (!force && 
        !needsMetrics &&
        startLine === this._lastGutterStart && 
        endLine === this._lastGutterEnd) {
      return;
    }

    this._lastGutterStart = startLine;
    this._lastGutterEnd = endLine;

    // Render ONLY the ~35-45 visible line rows (takes ~0.04ms instead of 25ms!)
    let rowsHtml = '';
    for (let i = startLine; i < endLine; i++) {
      const top = lineTops[i];
      const h = lineHeights[i];
      const level = headingLevels[i];
      const isHeading = level > 0;
      const isNextLineFold = (i + 1 < totalLines) && cachedLines[i + 1].startsWith('<!-- FOLD:');

      let indicatorHtml = '';
      let foldClass = '';
      if (isHeading) {
        let hasContent = false;
        for (let nextIdx = i + 1; nextIdx < totalLines; nextIdx++) {
          const nextLevel = headingLevels[nextIdx];
          if (nextLevel > 0 && nextLevel <= level) break;
          if (cachedLines[nextIdx].trim() !== '') {
            hasContent = true;
            break;
          }
        }
        if (isNextLineFold) {
          indicatorHtml = `<span class="fold-indicator collapsed" data-line-index="${i}">▶</span>`;
          foldClass = ' has-fold is-folded';
        } else if (hasContent) {
          indicatorHtml = `<span class="fold-indicator expanded" data-line-index="${i}">▼</span>`;
          foldClass = ' has-fold is-expanded';
        }
      }

      rowsHtml += `<div class="line-number-row${foldClass}" style="position: absolute; top: ${top}px; height: ${h}px; line-height: ${lineHeight}px; left: 0; right: 0;">${indicatorHtml}<span class="line-num-text">${i + 1}</span></div>`;
    }

    this.lineNumbersEl.innerHTML = `<div class="line-numbers-virtual-container" style="position: relative; height: ${this._gutterTotalHeight}px; width: 100%; min-height: 100%;">${rowsHtml}</div>`;
    this.syncAllEditorScrolls();
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

  getCleanMarkdown(text) {
    if (!text) return '';
    if (!text.includes('<!-- FOLD:')) return text;
    const lines = text.split('\n');
    const cleanLines = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/^<!--\s*FOLD:(.*?)\s*-->$/);
      if (match) {
        const id = match[1].trim();
        if (this.editorFoldMap && this.editorFoldMap.has(id)) {
          const content = this.editorFoldMap.get(id);
          cleanLines.push(this.getCleanMarkdown(content));
        } else {
          try {
            const decoded = decodeURIComponent(escape(atob(id)));
            cleanLines.push(this.getCleanMarkdown(decoded));
          } catch (e) {
            console.error("Failed to decode folded content:", e);
            cleanLines.push(line);
          }
        }
      } else {
        cleanLines.push(line);
      }
    }
    return cleanLines.join('\n');
  }

  saveFoldedHeadingsState() {
    if (!this.currentNote) return;
    const noteKey = `caveman-folded-${this.currentNote.id || this.currentNote.title || 'default'}`;
    const text = this.editorEl ? this.editorEl.value : '';
    if (!text || !text.includes('<!-- FOLD:')) {
      localStorage.setItem(noteKey, JSON.stringify([]));
      return;
    }
    const lines = text.split('\n');
    const folded = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('<!-- FOLD:')) {
        const cleanHeader = line.trim();
        if (cleanHeader && !folded.includes(cleanHeader)) {
          folded.push(cleanHeader);
        }
      }
    }
    localStorage.setItem(noteKey, JSON.stringify(folded));
  }

  foldHeading(lineIndex) {
    const text = this.editorEl.value;
    const lines = text.split('\n');
    if (lineIndex >= lines.length) return;
    
    let foldRange = null;
    if (this.wasmEngine && this.wasmEngine.foldEngine) {
      foldRange = this.wasmEngine.foldEngine.getFoldRange(lines, lineIndex);
    }
    
    if (!foldRange || !foldRange.isFoldable) {
      const headerLine = lines[lineIndex];
      const match = headerLine.match(/^(\s*#{1,6})\s+/);
      const level = match ? match[1].trim().length : 0;
      if (level === 0) return;
      
      let endIndex = lineIndex + 1;
      while (endIndex < lines.length) {
        const nextLine = lines[endIndex];
        const nextMatch = nextLine.match(/^(\s*#{1,6})\s+/);
        const nextLevel = nextMatch ? nextMatch[1].trim().length : 0;
        if (nextLevel > 0 && nextLevel <= level) {
          break;
        }
        endIndex++;
      }
      foldRange = { startIndex: lineIndex + 1, endIndex: endIndex, isFoldable: (endIndex > lineIndex + 1) };
    }
    
    if (!foldRange.isFoldable) return;
    const foldLines = lines.slice(foldRange.startIndex, foldRange.endIndex);
    if (foldLines.length === 0) return;
    if (foldLines[0].startsWith('<!-- FOLD:')) return;
    
    const foldContent = foldLines.join('\n');
    const shortId = `f_${this.foldIdCounter++}`;
    this.editorFoldMap.set(shortId, foldContent);
    const foldMarker = `<!-- FOLD:${shortId} -->`;
    
    const newLines = [
      ...lines.slice(0, lineIndex + 1),
      foldMarker,
      ...lines.slice(foldRange.endIndex)
    ];
    
    const selStart = this.editorEl.selectionStart;
    const selEnd = this.editorEl.selectionEnd;
    
    this.editorEl.value = newLines.join('\n');
    
    // Restore selection as best as possible
    this.editorEl.setSelectionRange(Math.min(selStart, this.editorEl.value.length), Math.min(selEnd, this.editorEl.value.length));
    
    this.handleInput(true, false, false); // Save full content silently
    this.saveFoldedHeadingsState();
    this.updateLineNumbers(true);
    this.renderHighlights();
  }

  unfoldHeading(lineIndex) {
    const text = this.editorEl.value;
    const lines = text.split('\n');
    if (lineIndex >= lines.length) return;
    
    const markerIndex = lineIndex + 1;
    if (markerIndex >= lines.length) return;
    
    const markerLine = lines[markerIndex];
    const match = markerLine.match(/^<!--\s*FOLD:(.*?)\s*-->$/);
    if (!match) return;
    
    const id = match[1].trim();
    let decoded = '';
    if (this.editorFoldMap && this.editorFoldMap.has(id)) {
      decoded = this.editorFoldMap.get(id);
    } else {
      try {
        decoded = decodeURIComponent(escape(atob(id)));
      } catch (e) {
        console.error("Failed to decode folded content:", e);
        return;
      }
    }
    
    const newLines = [
      ...lines.slice(0, markerIndex),
      ...decoded.split('\n'),
      ...lines.slice(markerIndex + 1)
    ];
    
    const selStart = this.editorEl.selectionStart;
    const selEnd = this.editorEl.selectionEnd;
    
    this.editorEl.value = newLines.join('\n');
    
    // Restore selection
    this.editorEl.setSelectionRange(Math.min(selStart, this.editorEl.value.length), Math.min(selEnd, this.editorEl.value.length));
    
    this.handleInput(true, false, false); // Save full content silently
    this.saveFoldedHeadingsState();
    this.updateLineNumbers(true);
    this.renderHighlights();
  }
}

new CavemanApp();

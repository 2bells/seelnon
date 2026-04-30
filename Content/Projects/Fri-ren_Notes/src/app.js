import { Vault } from './db.js';
import { Editor } from './editor.js';
import { GraphModule } from './graph.js';

class CavemanApp {
  constructor() {
    this.vault = new Vault();
    this.editorModule = new Editor(this.vault);
    this.graphModule = new GraphModule(this);
    this.notes = [];
    this.currentNote = null;
    this.isPreview = true;

    // Elements
    this.noteListEl = document.getElementById('note-list');
    this.editorEl = document.getElementById('editor');
    this.previewEl = document.getElementById('preview');
    this.titleInput = document.getElementById('note-title');
    this.folderInput = document.getElementById('note-folder');
    this.newNoteBtn = document.getElementById('new-note');
    this.togglePreviewBtn = document.getElementById('toggle-preview');
    this.deleteNoteBtn = document.getElementById('delete-note');
    this.exportBtn = document.getElementById('export-btn');
    this.exportNoteBtn = document.getElementById('export-note-btn');
    this.importInput = document.getElementById('import-vault');
    this.charCountEl = document.getElementById('char-count');
    this.lastSavedEl = document.getElementById('last-saved');
    this.searchInput = document.getElementById('search-notes');
    this.themeToggle = document.getElementById('theme-control');
    this.viewBtn = document.getElementById('view-btn');
    this.dbBtn = document.getElementById('db-btn');
    this.graphBtn = document.getElementById('graph-btn');
    this.viewMenu = document.getElementById('view-menu');
    this.dbMenu = document.getElementById('db-menu');
    this.graphMenu = document.getElementById('graph-menu');
    this.closeOverlayBtns = document.querySelectorAll('.close-overlay');
    this.collapsedFolders = JSON.parse(localStorage.getItem('caveman-collapsed-folders') || '[]');

    this.init();
  }

  async init() {
    // 0. Theme First (Immediate Caveman Comfort)
    const savedNightMode = localStorage.getItem('caveman-night-mode');
    if (savedNightMode === 'true') {
      this.isNightMode = true;
      document.body.classList.add('night-mode');
    }

    await this.vault.init();
    
    // 1. Initial Load (Local Vault First)
    this.publicNotes = [];
    await this.loadNotes();

    // Event Listeners
    this.newNoteBtn.addEventListener('click', () => this.createNewNote());
    this.editorEl.addEventListener('input', () => this.handleInput());
    this.titleInput.addEventListener('input', () => this.handleInput());
    this.folderInput.addEventListener('input', () => this.handleInput());
    this.togglePreviewBtn.addEventListener('click', () => this.togglePreview());
    this.deleteNoteBtn.addEventListener('click', () => this.deleteCurrentNote());
    this.editorEl.addEventListener('paste', (e) => this.handlePaste(e));
    this.exportBtn.addEventListener('click', () => this.exportVault());
    this.exportNoteBtn.addEventListener('click', () => this.exportCurrentNote());
    this.importInput.addEventListener('change', (e) => this.importVault(e));
    this.searchInput.addEventListener('input', () => this.renderNoteList());
    this.themeToggle.addEventListener('click', () => this.toggleTheme());

    this.previewEl.addEventListener('click', (e) => this.handlePreviewClick(e));

    this.viewBtn.addEventListener('click', () => this.openViewMenu());
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

    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => this.toggleSidebar());
    document.getElementById('purge-vault-btn').addEventListener('click', () => this.purgeVault());

    // Shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key === 'p') {
        e.preventDefault();
        this.togglePreview();
      }
      if (e.ctrlKey && e.key === '[') {
        e.preventDefault();
        this.toggleSidebar();
      }
    });

    // 2. Restore Last Session
    if (this.notes.length > 0) {
      const lastNoteId = localStorage.getItem('caveman-last-note-id');
      const lastNote = this.notes.find(n => String(n.id) === String(lastNoteId));
      if (lastNote) {
        this.selectNote(lastNote);
      } else {
        this.selectNote(this.notes[0]);
      }
    } else {
      this.createNewNote();
    }

    if (this.isPreview) {
      this.editorEl.classList.add('hidden');
      this.previewEl.classList.remove('hidden');
      this.togglePreviewBtn.textContent = 'Editor Mode';
    }

    // 3. Background Load Ancient Scrolls (Public Tutorial)
    this.loadPublicNotes().then(() => {
      this.loadNotes(); // Update registry with public notes when ready
    });
  }

  toggleTheme() {
    document.body.classList.toggle('night-mode');
    const isNight = document.body.classList.contains('night-mode');
    localStorage.setItem('caveman-night-mode', isNight ? 'true' : 'false');
    if (isNight) {
      console.log("%cBONFIRE LIT", "color: #c0a062; font-size: 40px; font-weight: bold; font-family: serif; font-style: italic;");
    }
  }

  toggleFolder(folderName) {
    if (this.collapsedFolders.includes(folderName)) {
      this.collapsedFolders = this.collapsedFolders.filter(f => f !== folderName);
    } else {
      this.collapsedFolders.push(folderName);
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

  async loadNotes() {
    const localNotes = await this.vault.getNotes();
    const publicNotes = this.publicNotes || [];
    
    // Deduplicate: hide public notes if a local note with the same path exists
    const filteredPublic = publicNotes.filter(pn => {
      const pnPath = (pn.folder || '') + '/' + pn.title;
      return !localNotes.some(ln => ((ln.folder || '') + '/' + ln.title) === pnPath);
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
    
    const filtered = this.notes
      .sort((a,b) => b.updatedAt - a.updatedAt)
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
        if (!current.folders[part]) {
          current.folders[part] = { folders: {}, notes: [], path: (current.path ? current.path + '/' : '') + part };
        }
        current = current.folders[part];
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
      
      const header = document.createElement('div');
      header.className = `sidebar-folder-label ${isCollapsed ? 'collapsed' : ''}`;
      header.style.paddingLeft = `${16 + (depth * 12)}px`;
      header.textContent = name.toUpperCase();
      
      header.onclick = (e) => {
        e.stopPropagation();
        this.toggleFolder(folder.path);
      };

      header.ondblclick = (e) => {
        e.stopPropagation();
        this.folderInput.focus();
      };

      container.appendChild(header);

      if (!isCollapsed) {
        const folderContent = document.createElement('div');
        folderContent.className = 'folder-content';
        this.renderTree(folder, folderContent, depth + 1);
        container.appendChild(folderContent);
      }
    });

    // Render notes in this folder
    node.notes.forEach(note => {
      const el = document.createElement('div');
      el.className = `note-item ${this.currentNote && this.currentNote.id === note.id ? 'active' : ''}`;
      el.style.paddingLeft = `${depth > 0 ? 16 + (depth * 12) : 16}px`;

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
      
      el.onclick = () => this.selectNote(note);
      el.ondblclick = () => {
        this.selectNote(note);
        this.titleInput.focus();
      };

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

  async createNewNote() {
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
  }

  selectNote(note) {
    this.currentNote = note;
    this.titleInput.value = note.title;
    this.folderInput.value = note.folder || '';
    this.editorEl.value = note.content;
    
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
    this.updatePreview();
    this.updateStats();
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
        this.handleInput(); // Persists and triggers re-render
      }
    }
  }

  async handleInput() {
    if (!this.currentNote) return;

    // If editing a public note, fork it into a local one first
    if (this.currentNote.isPublic) {
      const newNote = {
        title: this.titleInput.value,
        folder: this.folderInput.value,
        content: this.editorEl.value,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      const newId = await this.vault.saveNote(newNote);
      newNote.id = newId;
      
      // Update notes list
      await this.loadNotes();
      this.selectNote(newNote);
      return;
    }

    this.currentNote.title = this.titleInput.value;
    this.currentNote.folder = this.folderInput.value;
    this.currentNote.content = this.editorEl.value;
    this.currentNote.updatedAt = Date.now();
    this.currentNote._searchIndex = `${this.currentNote.folder || ''} ${this.currentNote.title} ${this.currentNote.content}`.toLowerCase();
    
    await this.vault.saveNote(this.currentNote);
    this.renderNoteList();
    if (this.isPreview) this.updatePreview();
    this.updateStats();
    this.lastSavedEl.textContent = `Saved: ${new Date().toLocaleTimeString()}`;
  }

  updateStats() {
    const length = this.editorEl.value.length;
    this.charCountEl.textContent = `Chars: ${length}`;
  }

  async navigateToNote(title) {
    // Try to find note by exact title or path (folder/title)
    let targetNote = this.notes.find(n => {
      const fullPath = (n.folder ? n.folder + '/' : '') + n.title;
      return n.title === title || fullPath === title;
    });

    if (!targetNote) {
      // Caveman Creation: If it doesn't exist, create it
      if (confirm(`Note "${title}" not found. Create it?`)) {
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
        targetNote = this.notes.find(n => n.id === id);
      }
    }

    if (targetNote) {
      this.selectNote(targetNote);
      // Auto-switch to editor if it's a new empty note? 
      // Nah, stay in preview if we came from preview.
    }
  }

  async updatePreview() {
    if (!this.currentNote) return;
    
    let html = await this.editorModule.processMarkdown(this.currentNote.content);
    
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
  }

  togglePreview() {
    this.isPreview = !this.isPreview;
    if (this.isPreview) {
      this.editorEl.classList.add('hidden');
      this.previewEl.classList.remove('hidden');
      this.updatePreview();
      this.togglePreviewBtn.textContent = 'Editor Mode';
    } else {
      this.editorEl.classList.remove('hidden');
      this.previewEl.classList.add('hidden');
      this.togglePreviewBtn.textContent = 'Preview Mode';
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
      this.selectNote(this.notes[0]);
    } else {
      this.createNewNote();
    }
  }

  async handlePaste(e) {
    const items = (e.clipboardData || e.originalEvent.clipboardData).items;
    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        const blob = item.getAsFile();
        const reader = new FileReader();
        reader.onload = async (event) => {
          const dataUrl = event.target.result;
          const imgId = this.editorModule.generateImageId();
          await this.vault.saveImage(imgId, dataUrl);
          
          const start = this.editorEl.selectionStart;
          const end = this.editorEl.selectionEnd;
          const text = this.editorEl.value;
          const reference = `![[${imgId}]]`;
          this.editorEl.value = text.slice(0, start) + reference + text.slice(end);
          
          this.handleInput();
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
    this.viewBtn.classList.remove('active');
    this.dbBtn.classList.remove('active');
    this.graphBtn.classList.remove('active');
  }

  setZoom(size) {
    document.documentElement.style.setProperty('--zoom-scale', size + 'px');
    document.querySelectorAll('.zoom-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.size === size);
    });
  }

  toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) sidebar.classList.toggle('hidden');
  }

  async purgeVault() {
    if (confirm('CRITICAL WARNING: This will permanently destroy all notes and images in your vault. This action cannot be undone. Proceed?')) {
      await this.vault.clear();
      localStorage.removeItem('caveman-current-note-id');
      location.reload();
    }
  }

  async exportVault() {
    const images = await this.vault.getAllImages();
    // Segmented export idea: we pack them into one for now, but roadmap 1.2 will split them.
    const data = {
      notes: this.notes,
      images: images,
      exportDate: new Date().toISOString(),
      vaultName: 'CavemanVault'
    };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `caveman-vault-${Date.now()}.json`;
    a.click();
  }

  async importVault(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.notes && data.images) {
          for (const note of data.notes) {
            await this.vault.saveNote(note);
          }
          for (const img of data.images) {
            await this.vault.saveImage(img.id, img.data);
          }
          alert(`Imported ${data.notes.length} notes and ${data.images.length} images.`);
          await this.loadNotes();
          if (this.notes.length > 0) this.selectNote(this.notes[0]);
        }
      } catch (err) {
        alert('Invalid vault file format.');
        console.error(err);
      }
    };
    reader.readAsText(file);
  }
}

new CavemanApp();

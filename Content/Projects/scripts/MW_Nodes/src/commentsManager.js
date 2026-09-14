/**
 * ============================================================================
 * src/commentsManager.js - Notes, Comment Trays & Text Bubbles System
 * Pure JavaScript - Brutalist Aesthetic - Zero Dependencies
 * ============================================================================
 */

import { PIN_COLORS, CATEGORIES, getNodeBlueprint } from './nodesData.js';

export class CommentsManager {
  constructor(app) {
    this.app = app;
    this.isCommentingMode = false;
    this.activeTrayId = null;
    this.activeNoteId = null;

    // Interaction state
    this.dragMode = null; // 'draw-tray' | 'move-tray' | 'resize-tray' | 'move-note' | 'resize-note'
    this.dragData = null;
    this.attachingNoteId = null; // When in "pick a node to attach" mode

    // DOM Caches
    this.trayElements = new Map();
    this.noteElements = new Map();
    this.bannerEl = null;
    this.previewEl = null;
    this.attachmentSvgEl = null;

    // Color presets for comment trays (subtle brutalist dark tints, never white)
    this.trayColors = [
      { id: 'slate', name: 'Slate Dark', bg: 'rgba(28, 33, 44, 0.72)', header: 'rgba(38, 45, 60, 0.95)', border: 'rgba(82, 94, 116, 0.5)' },
      { id: 'charcoal', name: 'Charcoal', bg: 'rgba(20, 23, 30, 0.75)', header: 'rgba(30, 34, 44, 0.95)', border: 'rgba(70, 78, 95, 0.5)' },
      { id: 'cyan', name: 'Glacier Blue', bg: 'rgba(18, 32, 42, 0.72)', header: 'rgba(24, 48, 64, 0.95)', border: 'rgba(88, 140, 165, 0.5)' },
      { id: 'emerald', name: 'Deep Emerald', bg: 'rgba(18, 36, 28, 0.72)', header: 'rgba(26, 52, 40, 0.95)', border: 'rgba(75, 130, 95, 0.5)' },
      { id: 'amber', name: 'Warm Amber', bg: 'rgba(38, 32, 20, 0.72)', header: 'rgba(56, 46, 28, 0.95)', border: 'rgba(150, 120, 65, 0.5)' },
      { id: 'purple', name: 'Twilight Purple', bg: 'rgba(32, 22, 40, 0.72)', header: 'rgba(48, 32, 60, 0.95)', border: 'rgba(125, 80, 145, 0.5)' },
      { id: 'crimson', name: 'Dark Crimson', bg: 'rgba(38, 20, 26, 0.72)', header: 'rgba(56, 28, 36, 0.95)', border: 'rgba(145, 70, 85, 0.5)' }
    ];

    this.init();
  }

  get state() {
    return this.app.state;
  }

  set state(s) {
    this.render();
  }

  get renderer() {
    return this.app.renderer;
  }

  init() {
    window.miliastraComments = this;

    // Listen to window pointer events for dragging
    window.addEventListener('mousemove', (e) => this.onWindowMouseMove(e));
    window.addEventListener('mouseup', (e) => this.onWindowMouseUp(e));

    // Global keyboard listener for 'C' to toggle commenting mode
    window.addEventListener('keydown', (e) => {
      if ((e.key === 'c' || e.key === 'C') && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const tag = (e.target && e.target.tagName) ? e.target.tagName.toLowerCase() : '';
        const activeTag = (document.activeElement && document.activeElement.tagName) ? document.activeElement.tagName.toLowerCase() : '';
        if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable ||
            activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select' || document.activeElement?.isContentEditable) {
          return;
        }
        e.preventDefault();
        this.toggleCommentingMode();
      } else if (e.key === 'Escape') {
        if (this.attachingNoteId) {
          this.cancelPickNodeToAttach();
        } else if (this.isCommentingMode) {
          this.toggleCommentingMode(false);
        }
      }
    });
  }

  // ==========================================================================
  // COMMENTING MODE TOGGLE & BANNER
  // ==========================================================================

  toggleCommentingMode(forceState = null) {
    this.isCommentingMode = forceState !== null ? forceState : !this.isCommentingMode;

    const dockBtn = document.getElementById('btnToggleComments');
    if (dockBtn) {
      if (this.isCommentingMode) {
        dockBtn.classList.add('commenting-active');
      } else {
        dockBtn.classList.remove('commenting-active');
      }
    }

    if (this.isCommentingMode) {
      document.body.classList.add('commenting-mode-active');
      this.showModeBanner();
    } else {
      document.body.classList.remove('commenting-mode-active');
      this.hideModeBanner();
      if (this.attachingNoteId) {
        this.cancelPickNodeToAttach();
      }
    }

    this.render();
  }

  showModeBanner() {
    if (!this.bannerEl) {
      this.bannerEl = document.createElement('div');
      this.bannerEl.className = 'commenting-mode-banner';
      this.bannerEl.innerHTML = `
        <span class="commenting-mode-banner-badge">Commenting Mode</span>
        <span>Drag on empty space to draw Tray • Click to place Note Bubble</span>
        <span style="color:#6c7689;font-size:11px;">(Press [C] to Exit)</span>
        <button class="commenting-mode-banner-close" title="Exit commenting mode">✕</button>
      `;
      this.bannerEl.querySelector('.commenting-mode-banner-close').addEventListener('click', () => {
        this.toggleCommentingMode(false);
      });
      document.body.appendChild(this.bannerEl);
    }
    this.bannerEl.style.display = 'flex';
  }

  hideModeBanner() {
    if (this.bannerEl) {
      this.bannerEl.style.display = 'none';
    }
  }

  // ==========================================================================
  // CANVAS MOUSE EVENTS (TRIGGERED FROM RENDERER)
  // ==========================================================================

  handleCanvasMouseDown(e) {
    if (!this.isCommentingMode) return false;

    // Only respond to left clicks
    if (e.button !== 0) return false;

    // Check if clicked inside an existing tray or note or node
    if (e.target.closest('.miliastra-node, .note-bubble, .comment-tray, input, select, button')) {
      return false;
    }

    // Start drag on empty canvas to either draw a tray or place a note
    const canvasPos = this.renderer.screenToCanvas(e.clientX, e.clientY);
    this.dragMode = 'draw-tray';
    this.dragData = {
      startX: e.clientX,
      startY: e.clientY,
      canvasStartX: canvasPos.x,
      canvasStartY: canvasPos.y,
      hasMoved: false
    };

    if (!this.previewEl) {
      this.previewEl = document.createElement('div');
      this.previewEl.className = 'comment-drag-preview';
      this.renderer.stage.appendChild(this.previewEl);
    }
    this.previewEl.style.display = 'none';

    return true; // Handled
  }

  onWindowMouseMove(e) {
    if (!this.dragMode || !this.dragData) return;

    if (this.dragMode === 'draw-tray') {
      const dx = Math.abs(e.clientX - this.dragData.startX);
      const dy = Math.abs(e.clientY - this.dragData.startY);

      if (dx > 10 || dy > 10) {
        this.dragData.hasMoved = true;
        const currentPos = this.renderer.screenToCanvas(e.clientX, e.clientY);
        const x = Math.min(this.dragData.canvasStartX, currentPos.x);
        const y = Math.min(this.dragData.canvasStartY, currentPos.y);
        const w = Math.abs(currentPos.x - this.dragData.canvasStartX);
        const h = Math.abs(currentPos.y - this.dragData.canvasStartY);

        this.previewEl.style.left = `${x}px`;
        this.previewEl.style.top = `${y}px`;
        this.previewEl.style.width = `${w}px`;
        this.previewEl.style.height = `${h}px`;
        this.previewEl.style.display = 'block';
      }
    } else if (this.dragMode === 'move-tray') {
      const dx = (e.clientX - this.dragData.startX) / this.state.zoom;
      const dy = (e.clientY - this.dragData.startY) / this.state.zoom;

      const tray = this.state.comments.find(c => c.id === this.dragData.trayId);
      if (tray) {
        tray.x = Math.round(this.dragData.origTrayX + dx);
        tray.y = Math.round(this.dragData.origTrayY + dy);

        // Move all enclosed nodes
        if (this.dragData.enclosedNodes) {
          for (const item of this.dragData.enclosedNodes) {
            const n = this.state.nodes.find(node => node.id === item.id);
            if (n) {
              n.x = Math.round(item.origX + dx);
              n.y = Math.round(item.origY + dy);
              const nodeEl = this.renderer.nodeElements.get(n.id);
              if (nodeEl) {
                nodeEl.style.transform = `translate3d(${n.x}px, ${n.y}px, 0)`;
              }
              this.renderer.updateNodePinCoordinates(n);
            }
          }
        }

        // Move all enclosed notes
        if (this.dragData.enclosedNotes) {
          for (const item of this.dragData.enclosedNotes) {
            const note = this.state.notes.find(nt => nt.id === item.id);
            if (note) {
              note.x = Math.round(item.origX + dx);
              note.y = Math.round(item.origY + dy);
              const noteEl = this.noteElements.get(note.id);
              if (noteEl) {
                noteEl.style.transform = `translate3d(${note.x}px, ${note.y}px, 0)`;
              }
            }
          }
        }

        const trayEl = this.trayElements.get(tray.id);
        if (trayEl) {
          trayEl.style.transform = `translate3d(${tray.x}px, ${tray.y}px, 0)`;
        }

        // Real-time wire updates when moving collapsed code block
        if (tray.collapsed) {
          this.cacheCollapsedSockets(this.renderer.pinCoords);
        }

        this.renderer.renderWires();
        this.renderAttachmentLines();
      }
    } else if (this.dragMode === 'resize-tray') {
      const dx = (e.clientX - this.dragData.startX) / this.state.zoom;
      const dy = (e.clientY - this.dragData.startY) / this.state.zoom;

      const tray = this.state.comments.find(c => c.id === this.dragData.trayId);
      if (tray) {
        tray.width = Math.max(160, Math.round(this.dragData.origWidth + dx));
        tray.height = Math.max(100, Math.round(this.dragData.origHeight + dy));

        const trayEl = this.trayElements.get(tray.id);
        if (trayEl) {
          trayEl.style.width = `${tray.width}px`;
          trayEl.style.height = `${tray.height}px`;
        }
      }
    } else if (this.dragMode === 'move-note') {
      const dx = (e.clientX - this.dragData.startX) / this.state.zoom;
      const dy = (e.clientY - this.dragData.startY) / this.state.zoom;

      const note = this.state.notes.find(nt => nt.id === this.dragData.noteId);
      if (note) {
        note.x = Math.round(this.dragData.origX + dx);
        note.y = Math.round(this.dragData.origY + dy);

        // If attached, update offset relative to attached node
        if (note.attachedNodeId) {
          const attachedNode = this.state.nodes.find(n => n.id === note.attachedNodeId);
          if (attachedNode) {
            note.attachedOffset = {
              x: note.x - attachedNode.x,
              y: note.y - attachedNode.y
            };
          }
        }

        const noteEl = this.noteElements.get(note.id);
        if (noteEl) {
          noteEl.style.transform = `translate3d(${note.x}px, ${note.y}px, 0)`;
        }

        this.renderAttachmentLines();
      }
    } else if (this.dragMode === 'resize-note') {
      const dx = (e.clientX - this.dragData.startX) / this.state.zoom;
      const dy = (e.clientY - this.dragData.startY) / this.state.zoom;

      const note = this.state.notes.find(nt => nt.id === this.dragData.noteId);
      if (note) {
        note.width = Math.max(180, Math.round(this.dragData.origWidth + dx));
        note.height = Math.max(90, Math.round(this.dragData.origHeight + dy));

        const noteEl = this.noteElements.get(note.id);
        if (noteEl) {
          noteEl.style.width = `${note.width}px`;
          noteEl.style.height = `${note.height}px`;
        }
      }
    } else if (this.dragMode === 'drag-note-pin') {
      const note = this.state.notes.find(nt => nt.id === this.dragData.noteId);
      if (note) {
        const x1 = note.x + 14;
        const y1 = note.y + 15;
        const currentPos = this.renderer.screenToCanvas(e.clientX, e.clientY);
        const x2 = currentPos.x;
        const y2 = currentPos.y;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const curveOffset = Math.max(Math.abs(dx) * 0.4, 30);
        const cp1x = x1 + (dx >= 0 ? curveOffset : -curveOffset);
        const cp1y = y1;
        const cp2x = x2 - (dx >= 0 ? curveOffset : -curveOffset);
        const cp2y = y2;

        this.dragData.previewPath = `
          <path d="M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}" class="note-drag-wire-preview" />
          <circle cx="${x1}" cy="${y1}" r="3.5" fill="#ffd787" />
          <circle cx="${x2}" cy="${y2}" r="4" fill="#ffd787" />
        `;

        // Highlight hovered node under cursor
        const targetEl = document.elementFromPoint(e.clientX, e.clientY);
        const nodeEl = targetEl ? targetEl.closest('.miliastra-node') : null;
        document.querySelectorAll('.miliastra-node.node-drop-highlight').forEach(el => {
          if (el !== nodeEl) el.classList.remove('node-drop-highlight');
        });
        if (nodeEl) {
          nodeEl.classList.add('node-drop-highlight');
        }

        this.renderAttachmentLines();
      }
    }
  }

  onWindowMouseUp(e) {
    if (!this.dragMode || !this.dragData) return;

    if (this.dragMode === 'draw-tray') {
      if (this.previewEl) {
        this.previewEl.style.display = 'none';
      }

      if (this.dragData.hasMoved) {
        const currentPos = this.renderer.screenToCanvas(e.clientX, e.clientY);
        const x = Math.min(this.dragData.canvasStartX, currentPos.x);
        const y = Math.min(this.dragData.canvasStartY, currentPos.y);
        const w = Math.abs(currentPos.x - this.dragData.canvasStartX);
        const h = Math.abs(currentPos.y - this.dragData.canvasStartY);

        // Only create if meaningful size
        if (w >= 60 && h >= 40) {
          this.createTray('Code Block', Math.round(x), Math.round(y), Math.round(w), Math.round(h));
        }
      } else {
        // User clicked without dragging -> Create text note bubble!
        const canvasPos = this.renderer.screenToCanvas(e.clientX, e.clientY);
        this.createNote('New note instructions...', Math.round(canvasPos.x), Math.round(canvasPos.y));
      }
    } else if (this.dragMode === 'drag-note-pin') {
      document.querySelectorAll('.miliastra-node.node-drop-highlight').forEach(el => el.classList.remove('node-drop-highlight'));
      const targetEl = document.elementFromPoint(e.clientX, e.clientY);
      const nodeEl = targetEl ? targetEl.closest('.miliastra-node') : null;
      const note = (this.state.notes || []).find(nt => nt.id === this.dragData.noteId);
      const dist = Math.hypot(e.clientX - this.dragData.startX, e.clientY - this.dragData.startY);

      if (nodeEl && nodeEl.dataset.nodeId) {
        this.attachNoteToNode(this.dragData.noteId, nodeEl.dataset.nodeId);
      } else if (note && note.attachedNodeId && (dist < 6 || targetEl?.closest('.note-pin-socket'))) {
        // User clicked the pin or dropped on it to detach
        this.detachNote(note.id);
        if (this.app.showNotice) {
          this.app.showNotice('Note detached', 'info');
        }
      } else if (note && note.attachedNodeId && dist >= 6) {
        // User dragged pin away and released onto empty canvas: detach
        this.detachNote(note.id);
        if (this.app.showNotice) {
          this.app.showNotice('Note detached', 'info');
        }
      }
      this.dragMode = null;
      this.dragData = null;
      this.render();
      this.renderAttachmentLines();
      return;
    } else if (this.dragMode === 'move-tray' || this.dragMode === 'resize-tray' || this.dragMode === 'move-note' || this.dragMode === 'resize-note') {
      this.state.saveSnapshot();
      this.renderer.cachePinPositions();
      this.renderer.renderWires();
    }

    this.dragMode = null;
    this.dragData = null;
  }

  // ==========================================================================
  // COMMENT TRAY MANAGEMENT
  // ==========================================================================

  createTray(title = 'Code Block', x = 100, y = 100, width = 360, height = 220, color = 'slate') {
    const tray = {
      id: `comment_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
      title,
      x,
      y,
      width,
      height,
      collapsed: false,
      color,
      collapsedNodeIds: []
    };

    this.state.comments = this.state.comments || [];
    this.state.comments.push(tray);
    this.state.saveSnapshot();
    this.render();

    // Auto-focus title for immediate editing
    setTimeout(() => {
      const trayEl = this.trayElements.get(tray.id);
      if (trayEl) {
        const titleEl = trayEl.querySelector('.comment-tray-title');
        if (titleEl) {
          titleEl.contentEditable = 'true';
          titleEl.focus();
          document.execCommand('selectAll', false, null);
        }
      }
    }, 50);

    return tray;
  }

  removeTray(trayId) {
    const tray = (this.state.comments || []).find(c => c.id === trayId);
    if (!tray) return;

    // If collapsed, unhide all enclosed nodes and notes before removing
    if (tray.collapsed && Array.isArray(tray.collapsedNodeIds)) {
      tray.collapsedNodeIds.forEach(id => {
        const nodeEl = this.renderer.nodeElements.get(id);
        if (nodeEl) nodeEl.style.display = '';
      });
    }
    if (tray.collapsed && Array.isArray(tray.collapsedNoteIds)) {
      tray.collapsedNoteIds.forEach(id => {
        const noteEl = this.noteElements.get(id);
        if (noteEl) noteEl.style.display = '';
      });
    }

    this.state.comments = (this.state.comments || []).filter(c => c.id !== trayId);
    const el = this.trayElements.get(trayId);
    if (el) {
      el.remove();
      this.trayElements.delete(trayId);
    }

    this.state.saveSnapshot();
    this.render();
  }

  toggleCollapseTray(trayId) {
    const tray = (this.state.comments || []).find(c => c.id === trayId);
    if (!tray) return;

    tray.collapsed = !tray.collapsed;

    if (tray.collapsed) {
      // Find all nodes enclosed in this tray's bounding box
      tray.savedWidth = tray.width;
      tray.savedHeight = tray.height;

      const enclosed = (this.state.nodes || []).filter(n =>
        n.x >= tray.x - 20 &&
        n.x <= tray.x + tray.width + 20 &&
        n.y >= tray.y - 20 &&
        n.y <= tray.y + tray.height + 20
      );
      tray.collapsedNodeIds = enclosed.map(n => n.id);

      // Find all notes enclosed in this tray's bounding box to collapse as well
      const enclosedNotes = (this.state.notes || []).filter(nt =>
        nt.x >= tray.x - 20 &&
        nt.x <= tray.x + tray.width + 20 &&
        nt.y >= tray.y - 20 &&
        nt.y <= tray.y + tray.height + 20
      );
      tray.collapsedNoteIds = enclosedNotes.map(nt => nt.id);
    } else {
      // Restore dimensions
      tray.width = tray.savedWidth || 360;
      tray.height = tray.savedHeight || 220;
    }

    this.state.saveSnapshot();
    this.renderer.renderNodes();
    this.render();
    this.renderer.cachePinPositions();
    this.renderer.renderWires();
  }

  setTrayColor(trayId, colorId) {
    const tray = (this.state.comments || []).find(c => c.id === trayId);
    if (!tray) return;

    tray.color = colorId;
    this.state.saveSnapshot();
    this.render();
  }

  // ==========================================================================
  // TEXT BUBBLE / NOTE MANAGEMENT
  // ==========================================================================

  createNote(text = 'New note...', x = 200, y = 200, width = 240, height = 140, attachedNodeId = null, color = '#88C0D0', title = 'Note') {
    const note = {
      id: `note_${Date.now().toString(36)}_${Math.random().toString(36).substr(2, 4)}`,
      title: title || 'Note',
      text,
      x,
      y,
      width,
      height,
      attachedNodeId,
      attachedOffset: { x: 0, y: 0 },
      color,
      isMinimized: false,
      isEditing: true
    };

    if (attachedNodeId) {
      const node = this.state.nodes.find(n => n.id === attachedNodeId);
      if (node) {
        note.attachedOffset = { x: x - node.x, y: y - node.y };
      }
    }

    this.state.notes = this.state.notes || [];
    this.state.notes.push(note);
    this.state.saveSnapshot();
    this.render();

    // Auto-focus textarea
    setTimeout(() => {
      const noteEl = this.noteElements.get(note.id);
      if (noteEl) {
        const textarea = noteEl.querySelector('.note-bubble-textarea');
        if (textarea) {
          textarea.focus();
          textarea.select();
        }
      }
    }, 50);

    return note;
  }

  removeNote(noteId) {
    this.state.notes = (this.state.notes || []).filter(nt => nt.id !== noteId);
    const el = this.noteElements.get(noteId);
    if (el) {
      el.remove();
      this.noteElements.delete(noteId);
    }
    this.state.saveSnapshot();
    this.render();
  }

  toggleMinimizeNote(noteId) {
    const note = (this.state.notes || []).find(nt => nt.id === noteId);
    if (!note) return;

    note.isMinimized = !note.isMinimized;
    this.state.saveSnapshot();
    this.render();
  }

  startPickNodeToAttach(note) {
    this.attachingNoteId = note.id;
    document.body.classList.add('is-picking-node-to-attach');

    if (this.app.showNotice) {
      this.app.showNotice('Click on any node on canvas to attach this note (or Esc to cancel)', 'info');
    }

    const onNodeClick = (e) => {
      const nodeEl = e.target.closest('.miliastra-node');
      if (!nodeEl) return;

      e.stopPropagation();
      e.preventDefault();

      const nodeId = nodeEl.dataset.nodeId;
      if (nodeId) {
        this.attachNoteToNode(note.id, nodeId);
      }
      this.cancelPickNodeToAttach();
      window.removeEventListener('click', onNodeClick, true);
    };

    window.addEventListener('click', onNodeClick, { capture: true, once: true });
  }

  cancelPickNodeToAttach() {
    this.attachingNoteId = null;
    document.body.classList.remove('is-picking-node-to-attach');
  }

  attachNoteToNode(noteId, nodeId) {
    const note = (this.state.notes || []).find(nt => nt.id === noteId);
    const node = (this.state.nodes || []).find(n => n.id === nodeId);
    if (!note || !node) return;

    note.attachedNodeId = nodeId;
    note.attachedOffset = {
      x: note.x - node.x,
      y: note.y - node.y
    };

    this.state.saveSnapshot();
    this.render();
    if (this.app.showNotice) {
      this.app.showNotice(`Note attached to node "${node.name}"`, 'success');
    }
  }

  detachNote(noteId) {
    const note = (this.state.notes || []).find(nt => nt.id === noteId);
    if (!note) return;

    note.attachedNodeId = null;
    note.attachedOffset = { x: 0, y: 0 };
    this.state.saveSnapshot();
    this.render();
  }

  getNodeColor(node) {
    if (!node) return '#e5c07b';
    if (node.isComposite) return '#B8B8D0';
    const catId = node.category || (node.bp && node.bp.category);
    if (catId && CATEGORIES[catId]) {
      return CATEGORIES[catId].headerColor || CATEGORIES[catId].accentColor;
    }
    const bp = getNodeBlueprint(node.type || node.name);
    if (bp && bp.category && CATEGORIES[bp.category]) {
      return CATEGORIES[bp.category].headerColor || CATEGORIES[bp.category].accentColor;
    }
    return '#6373BF';
  }

  // Called by renderer whenever a node is dragged
  onNodeDragged(node) {
    if (!this.state.notes) return;
    const attachedNotes = this.state.notes.filter(nt => nt.attachedNodeId === node.id);
    for (const note of attachedNotes) {
      const off = note.attachedOffset || { x: 220, y: -40 };
      note.x = node.x + off.x;
      note.y = node.y + off.y;
      const noteEl = this.noteElements.get(note.id);
      if (noteEl) {
        noteEl.style.transform = `translate3d(${note.x}px, ${note.y}px, 0)`;
      }
    }
    this.renderAttachmentLines();
  }

  // ==========================================================================
  // TEXT & IMAGE PARSING (HTTP IMAGES & MARKDOWN INSTRUCTIONS)
  // ==========================================================================

  parseMarkdownAndImages(rawText) {
    if (!rawText) return '<p style="color:#6c7689;font-style:italic;">Empty note</p>';

    // Escape HTML first for safety
    let text = rawText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 1. Parse markdown image syntax: ![alt](url)
    text = text.replace(/!\[(.*?)\]\((https?:\/\/[^\s\)]+)\)/g, (match, alt, url) => {
      return `
        <div class="note-image-wrap">
          <img src="${url}" alt="${alt || 'Note Image'}" class="note-bubble-img" loading="lazy" onerror="this.parentElement.innerHTML='<span style=\\'color:#ff6b8b;font-size:10px;padding:4px;display:block;\\'>[Image Failed to Load]</span>'" />
        </div>
      `;
    });

    // 2. Parse standalone direct image URLs (http:// or https:// ending with jpg, png, gif, webp, svg)
    text = text.replace(/(^|[^"'])(https?:\/\/[^\s<]+?\.(?:png|jpg|jpeg|gif|webp|svg)(?:\?[^\s<]+)?)/gi, (match, prefix, url) => {
      return `${prefix}
        <div class="note-image-wrap">
          <img src="${url}" alt="Embedded Image" class="note-bubble-img" loading="lazy" onerror="this.parentElement.innerHTML='<span style=\\'color:#ff6b8b;font-size:10px;padding:4px;display:block;\\'>[Image Failed to Load]</span>'" />
        </div>
      `;
    });

    // 3. Headers: #, ##, ###
    text = text.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    text = text.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    text = text.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // 4. Bold: **text**
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    // 5. Inline Code: `code`
    text = text.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 6. Bullet lists
    text = text.replace(/^\s*-\s+(.*$)/gim, '<div style="display:flex;gap:6px;"><span style="color:#88c0d0;">•</span><span>$1</span></div>');

    // 7. Paragraphs / Linebreaks
    const paragraphs = text.split(/\n\n+/).map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      if (trimmed.startsWith('<h') || trimmed.startsWith('<div')) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br/>')}</p>`;
    });

    return paragraphs.join('');
  }

  // ==========================================================================
  // COLLAPSED TRAY SOCKETS CACHE
  // ==========================================================================

  cacheCollapsedSockets(pinCoords) {
    const collapsedTrays = (this.state.comments || []).filter(c => c.collapsed);
    if (collapsedTrays.length === 0) return;

    for (const tray of collapsedTrays) {
      const trayEl = this.trayElements.get(tray.id);
      if (!trayEl) continue;

      const inSockets = trayEl.querySelectorAll('.collapsed-socket-in');
      inSockets.forEach(sock => {
        const targetNode = sock.dataset.targetNode;
        const targetPin = sock.dataset.targetPin;
        if (targetNode && targetPin) {
          const rect = sock.getBoundingClientRect();
          const stageRect = this.renderer.stage.getBoundingClientRect();
          const canvasX = (rect.left + rect.width / 2 - stageRect.left) / this.state.zoom;
          const canvasY = (rect.top + rect.height / 2 - stageRect.top) / this.state.zoom;
          pinCoords.set(`${targetNode}::${targetPin}`, { x: canvasX, y: canvasY });
        }
      });

      const outSockets = trayEl.querySelectorAll('.collapsed-socket-out');
      outSockets.forEach(sock => {
        const sourceNode = sock.dataset.sourceNode;
        const sourcePin = sock.dataset.sourcePin;
        if (sourceNode && sourcePin) {
          const rect = sock.getBoundingClientRect();
          const stageRect = this.renderer.stage.getBoundingClientRect();
          const canvasX = (rect.left + rect.width / 2 - stageRect.left) / this.state.zoom;
          const canvasY = (rect.top + rect.height / 2 - stageRect.top) / this.state.zoom;
          pinCoords.set(`${sourceNode}::${sourcePin}`, { x: canvasX, y: canvasY });
        }
      });
    }
  }

  // ==========================================================================
  // RENDERING PIPELINE
  // ==========================================================================

  render() {
    if (!this.renderer || !this.renderer.commentsLayer || !this.renderer.notesLayer) return;

    this.renderTrays();
    this.renderNotes();
    this.renderAttachmentLines();
  }

  renderTrays() {
    const comments = this.state.comments || [];
    const currentIds = new Set(comments.map(c => c.id));

    // Remove deleted trays
    for (const [id, el] of this.trayElements.entries()) {
      if (!currentIds.has(id)) {
        el.remove();
        this.trayElements.delete(id);
      }
    }

    for (const tray of comments) {
      let trayEl = this.trayElements.get(tray.id);
      if (!trayEl) {
        trayEl = document.createElement('div');
        this.trayElements.set(tray.id, trayEl);
        this.renderer.commentsLayer.appendChild(trayEl);
      }

      this.updateTrayElement(tray, trayEl);
    }
  }

  updateTrayElement(tray, el) {
    const preset = this.trayColors.find(p => p.id === tray.color) || this.trayColors[0];

    el.className = `comment-tray ${tray.collapsed ? 'collapsed' : ''}`;
    el.dataset.trayId = tray.id;
    el.style.transform = `translate3d(${tray.x}px, ${tray.y}px, 0)`;

    if (tray.collapsed) {
      el.style.height = 'auto';
      el.style.backgroundColor = preset.bg;
      el.style.borderColor = preset.border;
      this.populateCollapsedTray(tray, el, preset);
    } else {
      el.style.width = `${tray.width}px`;
      el.style.height = `${tray.height}px`;
      el.style.backgroundColor = preset.bg;
      el.style.borderColor = preset.border;
      this.populateExpandedTray(tray, el, preset);
    }
  }

  esc(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  populateExpandedTray(tray, el, preset) {
    el.innerHTML = `
      <div class="comment-tray-header" style="background-color: ${preset.header};">
        <button class="comment-tray-collapse-btn" title="Collapse comment tray">▼</button>
        <div class="comment-tray-title" title="Double click to edit title">${this.esc(tray.title)}</div>
        <div class="comment-tray-controls">
          <button class="comment-tray-tool-btn" data-action="color" title="Change tray tint">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="9"/>
              <circle cx="9" cy="10" r="1.5" fill="currentColor"/>
              <circle cx="15" cy="10" r="1.5" fill="currentColor"/>
              <circle cx="12" cy="15" r="1.5" fill="currentColor"/>
            </svg>
          </button>
          <button class="comment-tray-tool-btn danger" data-action="delete" title="Delete tray (nodes stay safe)">✕</button>
        </div>
      </div>
      <div class="comment-tray-body"></div>
      <div class="comment-tray-resize-handle" title="Resize tray"></div>
    `;

    const collapseBtn = el.querySelector('.comment-tray-collapse-btn');
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapseTray(tray.id);
    });

    const titleEl = el.querySelector('.comment-tray-title');
    titleEl.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      titleEl.contentEditable = 'true';
      titleEl.focus();
      document.execCommand('selectAll', false, null);
    });

    titleEl.addEventListener('blur', () => {
      titleEl.contentEditable = 'false';
      const newTitle = titleEl.textContent.trim() || 'Code Block';
      tray.title = newTitle;
      this.state.saveSnapshot();
    });

    titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        titleEl.blur();
      }
    });

    // Tray Header Dragging
    const headerEl = el.querySelector('.comment-tray-header');
    headerEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button, input, select') || titleEl.isContentEditable) return;
      e.stopPropagation();

      // Find all enclosed nodes and notes
      const enclosedNodes = (this.state.nodes || []).filter(n =>
        n.x >= tray.x - 20 &&
        n.x <= tray.x + tray.width + 20 &&
        n.y >= tray.y - 20 &&
        n.y <= tray.y + tray.height + 20
      ).map(n => ({ id: n.id, origX: n.x, origY: n.y }));

      const enclosedNotes = (this.state.notes || []).filter(nt =>
        nt.x >= tray.x - 20 &&
        nt.x <= tray.x + tray.width + 20 &&
        nt.y >= tray.y - 20 &&
        nt.y <= tray.y + tray.height + 20
      ).map(nt => ({ id: nt.id, origX: nt.x, origY: nt.y }));

      this.dragMode = 'move-tray';
      this.dragData = {
        trayId: tray.id,
        startX: e.clientX,
        startY: e.clientY,
        origTrayX: tray.x,
        origTrayY: tray.y,
        enclosedNodes,
        enclosedNotes
      };
    });

    // Resize Handle
    const resizeHandle = el.querySelector('.comment-tray-resize-handle');
    resizeHandle.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.dragMode = 'resize-tray';
      this.dragData = {
        trayId: tray.id,
        startX: e.clientX,
        startY: e.clientY,
        origWidth: tray.width,
        origHeight: tray.height
      };
    });

    // Color Palette Button
    const colorBtn = el.querySelector('[data-action="color"]');
    colorBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.openColorPicker(tray, colorBtn);
    });

    // Delete Button
    const deleteBtn = el.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeTray(tray.id);
    });
  }

  populateCollapsedTray(tray, el, preset) {
    const collapsedNodeIds = new Set(tray.collapsedNodeIds || []);
    const collapsedNoteIds = new Set(tray.collapsedNoteIds || []);

    // Categorize incoming wires from outside into collapsed nodes
    const incomingWires = (this.state.wires || []).filter(w =>
      !collapsedNodeIds.has(w.fromNode) && collapsedNodeIds.has(w.toNode)
    );

    // Categorize outgoing wires from collapsed nodes to outside
    const outgoingWires = (this.state.wires || []).filter(w =>
      collapsedNodeIds.has(w.fromNode) && !collapsedNodeIds.has(w.toNode)
    );

    // Deduplicate pins
    const inPinsMap = new Map();
    incomingWires.forEach(w => {
      const key = `${w.toNode}::${w.toPin}`;
      if (!inPinsMap.has(key)) {
        const targetNode = this.state.nodes.find(n => n.id === w.toNode);
        inPinsMap.set(key, {
          targetNodeId: w.toNode,
          targetPinName: w.toPin,
          nodeName: targetNode ? targetNode.name : 'Node',
          isExec: w.isExec,
          dataType: w.dataType || 'any'
        });
      }
    });

    const outPinsMap = new Map();
    outgoingWires.forEach(w => {
      const key = `${w.fromNode}::${w.fromPin}`;
      if (!outPinsMap.has(key)) {
        const srcNode = this.state.nodes.find(n => n.id === w.fromNode);
        outPinsMap.set(key, {
          sourceNodeId: w.fromNode,
          sourcePinName: w.fromPin,
          nodeName: srcNode ? srcNode.name : 'Node',
          isExec: w.isExec,
          dataType: w.dataType || 'any'
        });
      }
    });

    // Build incoming pin items HTML
    let inHtml = '';
    inPinsMap.forEach(pin => {
      const color = pin.isExec ? '#FFFFFF' : (PIN_COLORS[pin.dataType] || '#538cc4');
      const socketClass = pin.isExec ? 'collapsed-socket-in collapsed-socket-exec' : 'collapsed-socket-in';
      inHtml += `
        <div class="collapsed-pin-row">
          <div class="${socketClass}" style="border-color:${color};background-color:${color};" data-target-node="${pin.targetNodeId}" data-target-pin="${pin.targetPinName}"></div>
          <span class="collapsed-pin-label">${pin.targetPinName}</span>
          <span class="collapsed-pin-source">(${pin.nodeName})</span>
        </div>
      `;
    });

    // Build outgoing pin items HTML
    let outHtml = '';
    outPinsMap.forEach(pin => {
      const color = pin.isExec ? '#FFFFFF' : (PIN_COLORS[pin.dataType] || '#538cc4');
      const socketClass = pin.isExec ? 'collapsed-socket-out collapsed-socket-exec' : 'collapsed-socket-out';
      outHtml += `
        <div class="collapsed-pin-row">
          <span class="collapsed-pin-source">(${pin.nodeName})</span>
          <span class="collapsed-pin-label">${pin.sourcePinName}</span>
          <div class="${socketClass}" style="border-color:${color};background-color:${color};" data-source-node="${pin.sourceNodeId}" data-source-pin="${pin.sourcePinName}"></div>
        </div>
      `;
    });

    if (!inHtml) {
      inHtml = `<div style="color:#5c6475;font-size:10px;font-style:italic;">(No input connections)</div>`;
    }
    if (!outHtml) {
      outHtml = `<div style="color:#5c6475;font-size:10px;font-style:italic;">(No output connections)</div>`;
    }

    const badgeLabel = `${collapsedNodeIds.size} NODES${collapsedNoteIds.size > 0 ? ` • ${collapsedNoteIds.size} NOTES` : ''}`;

    // Calculate generous comfortable width so all pins sit well inside the container
    let maxInLen = 0;
    inPinsMap.forEach(p => {
      const len = (p.targetPinName || '').length + (p.nodeName || '').length;
      if (len > maxInLen) maxInLen = len;
    });

    let maxOutLen = 0;
    outPinsMap.forEach(p => {
      const len = (p.sourcePinName || '').length + (p.nodeName || '').length;
      if (len > maxOutLen) maxOutLen = len;
    });

    const inColW = maxInLen > 0 ? maxInLen * 8.5 + 40 : 130;
    const outColW = maxOutLen > 0 ? maxOutLen * 8.5 + 40 : 130;
    const titleW = (tray.title || '').length * 9.5 + 200;

    const comfortableWidth = Math.max(500, Math.min(Math.max(Math.round(inColW + outColW + 80), titleW), 820));
    el.style.width = `${comfortableWidth}px`;
    tray.width = comfortableWidth;

    el.innerHTML = `
      <div class="comment-tray-header" style="background-color:${preset.header};">
        <button class="comment-tray-collapse-btn" title="Expand comment tray">▶</button>
        <div class="comment-tray-title">${this.esc(tray.title)}</div>
        <span class="comment-tray-collapsed-badge">${badgeLabel}</span>
        <div class="comment-tray-controls">
          <button class="comment-tray-tool-btn danger" data-action="delete" title="Delete tray">✕</button>
        </div>
      </div>
      <div class="collapsed-tray-pins-grid">
        <div class="collapsed-pins-col pins-in">${inHtml}</div>
        <div class="collapsed-pins-col pins-out">${outHtml}</div>
      </div>
    `;

    const collapseBtn = el.querySelector('.comment-tray-collapse-btn');
    collapseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggleCollapseTray(tray.id);
    });

    const headerEl = el.querySelector('.comment-tray-header');
    headerEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button')) return;
      e.stopPropagation();

      // Collect enclosed nodes and notes so they move with collapsed tray
      const enclosedNodes = (tray.collapsedNodeIds || []).map(id => {
        const n = this.state.nodes.find(node => node.id === id);
        return n ? { id: n.id, origX: n.x, origY: n.y } : null;
      }).filter(Boolean);

      const enclosedNotes = (tray.collapsedNoteIds || []).map(id => {
        const nt = (this.state.notes || []).find(note => note.id === id);
        return nt ? { id: nt.id, origX: nt.x, origY: nt.y } : null;
      }).filter(Boolean);

      this.dragMode = 'move-tray';
      this.dragData = {
        trayId: tray.id,
        startX: e.clientX,
        startY: e.clientY,
        origTrayX: tray.x,
        origTrayY: tray.y,
        enclosedNodes,
        enclosedNotes
      };
    });

    const deleteBtn = el.querySelector('[data-action="delete"]');
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.removeTray(tray.id);
    });
  }

  openColorPicker(tray, anchorBtn) {
    const existing = document.querySelector('.comment-color-palette');
    if (existing) {
      existing.remove();
      return;
    }

    const headerEl = anchorBtn.closest('.comment-tray-header');
    if (!headerEl) return;

    const palette = document.createElement('div');
    palette.className = 'comment-color-palette';

    this.trayColors.forEach(preset => {
      const swatch = document.createElement('div');
      swatch.className = 'comment-color-swatch';
      swatch.style.backgroundColor = preset.header;
      swatch.title = preset.name;
      swatch.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setTrayColor(tray.id, preset.id);
        palette.remove();
      });
      palette.appendChild(swatch);
    });

    const onOutside = (e) => {
      if (!palette.contains(e.target) && e.target !== anchorBtn) {
        palette.remove();
        window.removeEventListener('mousedown', onOutside, true);
      }
    };
    window.addEventListener('mousedown', onOutside, true);

    headerEl.appendChild(palette);
  }

  // ==========================================================================
  // NOTE BUBBLES RENDERING & UPDATES
  // ==========================================================================

  renderNotes() {
    const notes = this.state.notes || [];
    const currentIds = new Set(notes.map(n => n.id));

    // Remove deleted notes
    for (const [id, el] of this.noteElements.entries()) {
      if (!currentIds.has(id)) {
        el.remove();
        this.noteElements.delete(id);
      }
    }

    // Collect all note IDs that are enclosed in collapsed trays
    const collapsedNoteIds = new Set();
    (this.state.comments || []).filter(c => c.collapsed).forEach(c => {
      (c.collapsedNoteIds || []).forEach(nid => collapsedNoteIds.add(nid));
    });

    for (const note of notes) {
      let noteEl = this.noteElements.get(note.id);
      if (!noteEl) {
        noteEl = document.createElement('div');
        this.noteElements.set(note.id, noteEl);
        this.renderer.notesLayer.appendChild(noteEl);
      }

      if (collapsedNoteIds.has(note.id)) {
        noteEl.style.display = 'none';
      } else {
        noteEl.style.display = '';
      }

      this.updateNoteElement(note, noteEl);
    }
  }

  updateNoteElement(note, el) {
    el.className = `note-bubble ${note.attachedNodeId ? 'attached' : ''} ${note.isMinimized ? 'minimized' : ''}`;
    el.dataset.noteId = note.id;
    el.style.transform = `translate3d(${note.x}px, ${note.y}px, 0)`;
    el.style.width = `${note.width}px`;
    el.style.height = note.isMinimized ? '32px' : `${note.height}px`;

    const attachedNode = note.attachedNodeId ? this.state.nodes.find(n => n.id === note.attachedNodeId) : null;
    const nodeColor = attachedNode ? this.getNodeColor(attachedNode) : '#8c95a8';
    const noteTitle = note.title || 'Note';

    if (note.attachedNodeId && attachedNode) {
      el.style.borderLeftWidth = '3.5px';
      el.style.borderLeftColor = nodeColor;
    } else {
      el.style.borderLeftWidth = '';
      el.style.borderLeftColor = '';
    }

    el.innerHTML = `
      <div class="note-bubble-header">
        <div class="note-pin-socket ${note.attachedNodeId ? 'connected' : ''}" data-action="pin" title="${note.attachedNodeId ? `Attached to ${this.esc(attachedNode?.name || 'Node')} • Click or drag pin to detach` : 'Drag this pin to attach to any node'}" style="${note.attachedNodeId && attachedNode ? `border-color:${nodeColor}; background-color:${nodeColor};` : ''}"></div>
        <svg class="note-bubble-icon" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="16" y1="13" x2="8" y2="13"/>
          <line x1="16" y1="17" x2="8" y2="17"/>
        </svg>
        <span class="note-bubble-title">${this.esc(noteTitle)}</span>
        <div class="note-bubble-controls">
          <button class="note-tool-btn" data-action="toggle-edit" title="${note.isEditing ? 'View Preview' : 'Edit Text'}">
            ${note.isEditing ? `
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            ` : `
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
            `}
          </button>
          <button class="note-tool-btn" data-action="minimize" title="${note.isMinimized ? 'Expand note' : 'Minimize note'}">${note.isMinimized ? '▢' : '—'}</button>
          <button class="note-tool-btn danger" data-action="delete" title="Delete note">✕</button>
        </div>
      </div>
      <div class="note-bubble-body">
        ${note.isEditing ? `
          <textarea class="note-bubble-textarea" placeholder="Type instructions, markdown, or add image URLs...">${note.text || ''}</textarea>
        ` : `
          <div class="note-bubble-content">${this.parseMarkdownAndImages(note.text)}</div>
        `}
      </div>
      ${note.isEditing ? `
        <div class="note-bubble-toolbar">
          <div class="note-image-entry" style="display: none;">
            <input type="text" class="note-image-url-input" placeholder="Paste image URL (https://...)" />
            <button class="note-image-add-btn">Add</button>
            <button class="note-image-cancel-btn">✕</button>
          </div>
          <div class="note-bubble-toolbar-actions">
            <button class="note-bubble-toolbar-btn" data-action="insert-img">+ Image URL</button>
            <button class="note-bubble-toolbar-btn" data-action="done-edit">✓ Done</button>
          </div>
        </div>
      ` : ''}
      <div class="note-bubble-resize-handle"></div>
    `;

    // Editable Note Title: single click when commenting mode active, double click anytime
    const titleEl = el.querySelector('.note-bubble-title');
    if (titleEl) {
      const startEditing = (e) => {
        e.stopPropagation();
        titleEl.contentEditable = 'true';
        titleEl.focus();
        document.execCommand('selectAll', false, null);
      };

      if (this.isCommentingMode) {
        titleEl.style.cursor = 'text';
        titleEl.title = 'Click or double-click to rename note';
        titleEl.addEventListener('click', startEditing);
      } else {
        titleEl.contentEditable = 'false';
        titleEl.style.cursor = 'grab';
        titleEl.title = 'Double-click to rename note (or enable Commenting Mode [C])';
      }

      titleEl.addEventListener('dblclick', startEditing);

      titleEl.addEventListener('blur', () => {
        titleEl.contentEditable = 'false';
        const newTitle = titleEl.textContent.trim() || 'Note';
        note.title = newTitle;
        if (this.state && typeof this.state.saveSnapshot === 'function') {
          this.state.saveSnapshot();
        }
      });
      titleEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          titleEl.blur();
        }
      });
    }

    // Pin Socket Wiring Interaction
    const pinSocket = el.querySelector('.note-pin-socket');
    if (pinSocket) {
      pinSocket.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.dragMode = 'drag-note-pin';
        this.dragData = {
          noteId: note.id,
          startX: e.clientX,
          startY: e.clientY
        };
      });
    }

    // Note Header Dragging
    const headerEl = el.querySelector('.note-bubble-header');
    headerEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0 || e.target.closest('button, .note-pin-socket') || (this.isCommentingMode && e.target.closest('.note-bubble-title[contenteditable="true"]'))) return;
      e.stopPropagation();

      this.dragMode = 'move-note';
      this.dragData = {
        noteId: note.id,
        startX: e.clientX,
        startY: e.clientY,
        origX: note.x,
        origY: note.y
      };
    });

    // Resize Handle
    const resizeHandle = el.querySelector('.note-bubble-resize-handle');
    if (resizeHandle) {
      resizeHandle.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        e.stopPropagation();
        this.dragMode = 'resize-note';
        this.dragData = {
          noteId: note.id,
          startX: e.clientX,
          startY: e.clientY,
          origWidth: note.width,
          origHeight: note.height
        };
      });
    }

    // Toggle Edit / Preview
    const toggleEditBtn = el.querySelector('[data-action="toggle-edit"]');
    if (toggleEditBtn) {
      toggleEditBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        note.isEditing = !note.isEditing;
        this.render();
      });
    }

    // Minimize Button
    const minimizeBtn = el.querySelector('[data-action="minimize"]');
    if (minimizeBtn) {
      minimizeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleMinimizeNote(note.id);
      });
    }

    // Delete Button
    const deleteBtn = el.querySelector('[data-action="delete"]');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.removeNote(note.id);
      });
    }

    // Textarea input
    const textarea = el.querySelector('.note-bubble-textarea');
    if (textarea) {
      textarea.addEventListener('input', (e) => {
        note.text = e.target.value;
      });
      textarea.addEventListener('change', () => {
        this.state.saveSnapshot();
      });
      textarea.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // Double click content to edit
    const contentEl = el.querySelector('.note-bubble-content');
    if (contentEl) {
      contentEl.addEventListener('dblclick', (e) => {
        e.stopPropagation();
        note.isEditing = true;
        this.render();
      });
      contentEl.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // Inline Image URL Input helper (replaces prompt/alert)
    const insertImgBtn = el.querySelector('[data-action="insert-img"]');
    const imgEntry = el.querySelector('.note-image-entry');
    const toolbarActions = el.querySelector('.note-bubble-toolbar-actions');
    const imgInput = el.querySelector('.note-image-url-input');
    const imgAddBtn = el.querySelector('.note-image-add-btn');
    const imgCancelBtn = el.querySelector('.note-image-cancel-btn');

    if (insertImgBtn && imgEntry && toolbarActions && imgInput && imgAddBtn && imgCancelBtn) {
      insertImgBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toolbarActions.style.display = 'none';
        imgEntry.style.display = 'flex';
        imgInput.value = '';
        imgInput.focus();
      });

      const confirmAddImg = () => {
        const url = imgInput.value.trim();
        if (url) {
          note.text = (note.text || '').trim() + `\n\n![Image](${url})\n`;
          const ta = el.querySelector('.note-bubble-textarea');
          if (ta) ta.value = note.text;
          this.state.saveSnapshot();
        }
        imgEntry.style.display = 'none';
        toolbarActions.style.display = 'flex';
      };

      imgAddBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        confirmAddImg();
      });

      imgInput.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') {
          e.preventDefault();
          confirmAddImg();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          imgEntry.style.display = 'none';
          toolbarActions.style.display = 'flex';
        }
      });

      imgCancelBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imgEntry.style.display = 'none';
        toolbarActions.style.display = 'flex';
      });

      imgInput.addEventListener('mousedown', (e) => e.stopPropagation());
    }

    // Done editing button
    const doneBtn = el.querySelector('[data-action="done-edit"]');
    if (doneBtn) {
      doneBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        note.isEditing = false;
        this.state.saveSnapshot();
        this.render();
      });
    }
  }

  // ==========================================================================
  // ATTACHMENT CONNECTOR LINES
  // ==========================================================================

  renderAttachmentLines() {
    if (!this.renderer || !this.renderer.stage) return;

    if (!this.attachmentSvgEl) {
      this.attachmentSvgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      this.attachmentSvgEl.setAttribute('class', 'note-attachment-svg');
      this.renderer.stage.appendChild(this.attachmentSvgEl);
    }

    // Collect all note IDs that are collapsed inside any tray
    const collapsedNoteIds = new Set();
    (this.state.comments || []).filter(c => c.collapsed).forEach(c => {
      (c.collapsedNoteIds || []).forEach(nid => collapsedNoteIds.add(nid));
    });

    const notes = (this.state.notes || []).filter(nt => nt.attachedNodeId && !collapsedNoteIds.has(nt.id));
    let pathsHtml = '';

    for (const note of notes) {
      const node = this.state.nodes.find(n => n.id === note.attachedNodeId);
      if (!node) continue;

      // Note pin socket coordinate
      const x1 = note.x + 14;
      const y1 = note.y + 15;

      // Target node coordinate (if target node is collapsed inside a tray, point to tray header)
      let x2, y2;
      const collapsedTray = (this.state.comments || []).find(c => c.collapsed && (c.collapsedNodeIds || []).includes(node.id));
      if (collapsedTray) {
        x2 = collapsedTray.x + 60;
        y2 = collapsedTray.y + 16;
      } else {
        x2 = node.x + 90;
        y2 = node.y + 16;
      }

      // Smooth horizontal cubic bezier curve
      const dx = x2 - x1;
      const dy = y2 - y1;
      const curveOffset = Math.max(Math.abs(dx) * 0.4, 30);
      const cp1x = x1 + (dx >= 0 ? curveOffset : -curveOffset);
      const cp1y = y1;
      const cp2x = x2 - (dx >= 0 ? curveOffset : -curveOffset);
      const cp2y = y2;

      const nodeColor = this.getNodeColor(node);
      pathsHtml += `
        <path d="M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}" class="note-attach-path" stroke="${nodeColor}" />
        <circle cx="${x1}" cy="${y1}" r="3" fill="${nodeColor}" />
        <circle cx="${x2}" cy="${y2}" r="3.5" fill="${nodeColor}" />
      `;
    }

    // Live preview wire when dragging pin to attach
    if (this.dragMode === 'drag-note-pin' && this.dragData && this.dragData.previewPath) {
      pathsHtml += this.dragData.previewPath;
    }

    this.attachmentSvgEl.innerHTML = pathsHtml;
  }
}

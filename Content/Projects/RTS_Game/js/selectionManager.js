import { Vector2 } from './vector2.js';

export class SelectionManager {
  constructor(game) {
    this.game = game;
    this.selecting = false;
    this.selectionStart = null;
    this.selectionEnd = null;
    
    // Store references to handlers
    this.mouseDownHandler = this.onMouseDown.bind(this);
    this.mouseMoveHandler = this.onMouseMove.bind(this);
    this.mouseUpHandler = this.onMouseUp.bind(this);
    this.contextMenuHandler = this.onContextMenu.bind(this);
    
    this.setupListeners();
  }

  cleanup() {
    // Remove event listeners
    const canvas = this.game.canvas;
    
    // Remove the existing event listeners
    canvas.removeEventListener('mousedown', this.mouseDownHandler);
    canvas.removeEventListener('mousemove', this.mouseMoveHandler);
    canvas.removeEventListener('mouseup', this.mouseUpHandler);
    canvas.removeEventListener('contextmenu', this.contextMenuHandler);
  }

  onMouseDown(e) {
    if (e.button === 0) { // Left click
      this.selecting = true;
      this.selectionStart = new Vector2(e.clientX, e.clientY);
      this.selectionEnd = this.selectionStart;

      // Deselect all units if not holding shift
      if (!e.shiftKey) {
        this.game.units.forEach(unit => {
          if (!unit.isEnemy) {
            unit.selected = false;
          }
        });
      }
    }
  }

  onMouseMove(e) {
    if (this.selecting) {
      this.selectionEnd = new Vector2(e.clientX, e.clientY);
    }
  }

  onMouseUp(e) {
    if (e.button === 0) { // Left click
      if (this.selecting) {
        this.selectUnitsInBox();
        this.selecting = false;
      }
    }
  }

  onContextMenu(e) {
    e.preventDefault();
    this.game.handleRightClick(new Vector2(e.clientX, e.clientY));
  }

  setupListeners() {
    const canvas = this.game.canvas;

    canvas.addEventListener('mousedown', this.mouseDownHandler);
    canvas.addEventListener('mousemove', this.mouseMoveHandler);
    canvas.addEventListener('mouseup', this.mouseUpHandler);
    canvas.addEventListener('contextmenu', this.contextMenuHandler);
  }

  selectUnitsInBox() {
    const minX = Math.min(this.selectionStart.x, this.selectionEnd.x);
    const maxX = Math.max(this.selectionStart.x, this.selectionEnd.x);
    const minY = Math.min(this.selectionStart.y, this.selectionEnd.y);
    const maxY = Math.max(this.selectionStart.y, this.selectionEnd.y);

    // If it's a small box, treat it as a click
    if (Math.abs(maxX - minX) < 5 && Math.abs(maxY - minY) < 5) {
      const clickedUnit = this.game.units.find(unit => 
        !unit.isEnemy && unit.contains(this.selectionStart)
      );
      if (clickedUnit) {
        clickedUnit.selected = true;
      }
      return;
    }

    // Otherwise select all units in the box
    this.game.units.forEach(unit => {
      if (!unit.isEnemy &&
          unit.position.x >= minX && unit.position.x <= maxX &&
          unit.position.y >= minY && unit.position.y <= maxY) {
        unit.selected = true;
      }
    });
  }

  draw(ctx) {
    if (this.selecting) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 5]);
      
      const width = this.selectionEnd.x - this.selectionStart.x;
      const height = this.selectionEnd.y - this.selectionStart.y;
      
      ctx.strokeRect(
        this.selectionStart.x,
        this.selectionStart.y,
        width,
        height
      );
      
      ctx.setLineDash([]);
    }
  }
}
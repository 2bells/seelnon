export function setupIgnoreSystem() {
    const isEditingText = () => {
        const active = document.activeElement;
        if (!active) return false;
        const tag = active.tagName;
        return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || active.isContentEditable;
    };

    // 1. Keydown default action blocks
    window.addEventListener('keydown', (e) => {
        const key = e.key;
        const lowKey = key.toLowerCase();
        
        // Block Alt on its own to prevent Windows/Linux/Firefox menu bar focus activation
        if (key === 'Alt') {
            e.preventDefault();
            return;
        }

        // Check if user is typing in standard text inputs
        if (isEditingText()) {
            return;
        }

        // Tab focus shifting - highly annoying in drawing/canvas apps
        if (key === 'Tab') {
            e.preventDefault();
            return;
        }

        // F1 (Help), F3 (Find), F10 (Bar focus)
        if (key === 'F1' || key === 'F3' || key === 'F10') {
            e.preventDefault();
            return;
        }

        // Ctrl Combinations
        if (e.ctrlKey || e.metaKey) {
            // Ctrl+S (Save), Ctrl+D (Deselect)
            if (lowKey === 's' || lowKey === 'd') {
                e.preventDefault();
                return;
            }
            // Ctrl+Z (Undo), Ctrl+Y (Redo)
            if (lowKey === 'z' || lowKey === 'y') {
                e.preventDefault();
                return;
            }
            // Ctrl+C (Copy), Ctrl+V (Paste), Ctrl+X (Cut)
            if (lowKey === 'c' || lowKey === 'v' || lowKey === 'x') {
                e.preventDefault();
                return;
            }
            // Ctrl+A (Select All text/elements)
            if (lowKey === 'a') {
                e.preventDefault();
                return;
            }
            // Ctrl+P (Print)
            if (lowKey === 'p') {
                e.preventDefault();
                return;
            }
            // Ctrl+F (Find)
            if (lowKey === 'f') {
                e.preventDefault();
                return;
            }
        }

        // Alt Combinations (e.g. Alt+F, Alt+E, Alt+D, etc.) to prevent menus
        if (e.altKey && key !== 'Alt') {
            e.preventDefault();
            return;
        }

        // Backspace going back in history (older or customized browsers)
        if (key === 'Backspace') {
            e.preventDefault();
            return;
        }
    }, { capture: true });

    // 2. Prevent Alt+Click standard behaviors (downloading, focus stealing, etc.)
    window.addEventListener('pointerdown', (e) => {
        if (e.altKey) {
            // Prevent default behavior (e.g., Firefox window dragging, text selection)
            // but still allow our pointer handlers to capture coordinates.
            e.preventDefault();
        }
    }, { capture: true });

    // 3. Block Context Menu globally in the drawing workspace
    window.addEventListener('contextmenu', (e) => {
        if (isEditingText()) {
            return;
        }
        e.preventDefault();
    }, { capture: true });

    // 4. Overlap/Drag and Drop files default (stops page replacing with dropped image)
    window.addEventListener('dragover', (e) => {
        e.preventDefault();
    }, { capture: true });
    
    window.addEventListener('drop', (e) => {
        e.preventDefault();
    }, { capture: true });
}

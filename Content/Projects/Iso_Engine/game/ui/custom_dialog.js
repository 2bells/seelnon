// game/ui/custom_dialog.js
console.log("game/ui/custom_dialog.js loaded");

// Stylized Custom Dialogs matching the RPG aesthetic, replaces native alert/confirm/prompt.
class CustomDialog {
    static init() {
        if (document.getElementById('rpg-custom-dialog-styles')) return;

        // Dynamic style injection for a self-contained beautiful dialogue overlay
        const style = document.createElement('style');
        style.id = 'rpg-custom-dialog-styles';
        style.textContent = `
            #rpg-dialog-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background-color: rgba(28, 22, 18, 0.8);
                backdrop-filter: blur(4px);
                z-index: 99999;
                display: flex;
                justify-content: center;
                align-items: center;
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                animation: rpg-fade-in 0.15s ease-out;
            }

            .rpg-dialog-box {
                background-color: #5A4B3E;
                border: 2px solid #8C6D56;
                border-radius: 8px;
                color: #EFEBE0;
                width: 400px;
                max-width: 90%;
                box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                animation: rpg-slide-up 0.2s cubic-bezier(0.1, 0.8, 0.3, 1);
            }

            .rpg-dialog-header {
                background-color: #4a3c30;
                padding: 10px 14px;
                font-size: 1.05em;
                font-weight: bold;
                border-bottom: 2px solid #3B322C;
                display: flex;
                justify-content: space-between;
                align-items: center;
                color: #D4C8A0;
                letter-spacing: 0.5px;
            }

            .rpg-dialog-body {
                padding: 20px 16px;
                font-size: 0.95em;
                line-height: 1.5;
                color: #EFEBE0;
                background-color: rgba(59, 50, 44, 0.3);
            }

            .rpg-dialog-body p {
                margin: 0 0 12px 0;
            }

            .rpg-dialog-body p:last-child {
                margin-bottom: 0;
            }

            .rpg-dialog-field-group {
                margin-top: 12px;
            }

            .rpg-dialog-field-group label {
                display: block;
                font-size: 0.85em;
                font-weight: bold;
                margin-bottom: 4px;
                color: #D4C8A0;
            }

            .rpg-dialog-input {
                width: 100%;
                background-color: #3B322C;
                color: #EFEBE0;
                border: 1px solid #8C6D56;
                border-radius: 4px;
                padding: 8px;
                box-sizing: border-box;
                font-family: inherit;
                font-size: 0.95em;
                outline: none;
                transition: border-color 0.15s ease;
            }

            .rpg-dialog-input:focus {
                border-color: #D4C8A0;
            }

            .rpg-dialog-double-fields {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 12px;
                margin-top: 12px;
            }

            .rpg-dialog-textarea {
                min-height: 80px;
                resize: vertical;
            }

            .rpg-dialog-footer {
                padding: 12px 16px;
                background-color: #4a3c30;
                border-top: 1px solid #3B322C;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
            }

            .rpg-dialog-btn {
                padding: 8px 16px;
                font-size: 0.9em;
                font-weight: bold;
                border-radius: 4px;
                cursor: pointer;
                transition: background-color 0.15s ease, transform 0.1s ease;
                border: none;
                display: inline-flex;
                align-items: center;
                justify-content: center;
            }

            .rpg-dialog-btn:active {
                transform: scale(0.97);
            }

            .rpg-dialog-btn-primary {
                background-color: #8C6D56;
                color: #FFFFFF;
                border: 1px solid #5A4B3E;
            }

            .rpg-dialog-btn-primary:hover {
                background-color: #A07D65;
            }

            .rpg-dialog-btn-secondary {
                background-color: #3B322C;
                color: #D4C8A0;
                border: 1px solid #8C6D56;
            }

            .rpg-dialog-btn-secondary:hover {
                background-color: #4a3c30;
            }

            @keyframes rpg-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            @keyframes rpg-slide-up {
                from { transform: translateY(15px); opacity: 0; }
                to { transform: translateY(0); opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }

    static show(htmlContent, setupController) {
        CustomDialog.init();

        // Prevent multiple overlays
        const existing = document.getElementById('rpg-dialog-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'rpg-dialog-overlay';

        overlay.innerHTML = `
            <div class="rpg-dialog-box">
                ${htmlContent}
            </div>
        `;

        document.body.appendChild(overlay);

        // Run custom controller/listeners setup
        return new Promise((resolve) => {
            const close = (result) => {
                overlay.remove();
                resolve(result);
            };
            setupController(overlay, close);
        });
    }

    // Custom Alert
    static alert(message, title = "System Notification") {
        const html = `
            <div class="rpg-dialog-header">
                <span>📁 ${title}</span>
            </div>
            <div class="rpg-dialog-body">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="rpg-dialog-footer">
                <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">OK</button>
            </div>
        `;

        return CustomDialog.show(html, (overlay, close) => {
            const btn = overlay.querySelector('#rpg-dialog-confirm-btn');
            btn.focus();
            btn.onclick = () => close(true);
            
            // Allow closing on Enter/Space
            overlay.onkeydown = (e) => {
                if (e.key === 'Enter' || e.key === 'Escape') {
                    e.preventDefault();
                    close(true);
                }
            };
        });
    }

    // Custom Confirm (Yes / No)
    static confirm(message, title = "Confirm Decision") {
        const html = `
            <div class="rpg-dialog-header">
                <span>❓ ${title}</span>
            </div>
            <div class="rpg-dialog-body">
                <p>${message.replace(/\n/g, '<br>')}</p>
            </div>
            <div class="rpg-dialog-footer">
                <button class="rpg-dialog-btn rpg-dialog-btn-secondary" id="rpg-dialog-cancel-btn">Cancel</button>
                <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">Confirm</button>
            </div>
        `;

        return CustomDialog.show(html, (overlay, close) => {
            const confirmBtn = overlay.querySelector('#rpg-dialog-confirm-btn');
            const cancelBtn = overlay.querySelector('#rpg-dialog-cancel-btn');
            confirmBtn.focus();

            confirmBtn.onclick = () => close(true);
            cancelBtn.onclick = () => close(false);

            overlay.onkeydown = (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault();
                    close(false);
                }
            };
        });
    }

    // Custom Prompt
    static prompt(message, defaultValue = "", title = "User Input Required") {
        const html = `
            <div class="rpg-dialog-header">
                <span>💬 ${title}</span>
            </div>
            <div class="rpg-dialog-body">
                <p>${message.replace(/\n/g, '<br>')}</p>
                <div class="rpg-dialog-field-group">
                    <input type="text" class="rpg-dialog-input" id="rpg-dialog-input-field" value="${defaultValue}">
                </div>
            </div>
            <div class="rpg-dialog-footer">
                <button class="rpg-dialog-btn rpg-dialog-btn-secondary" id="rpg-dialog-cancel-btn">Cancel</button>
                <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">Submit</button>
            </div>
        `;

        return CustomDialog.show(html, (overlay, close) => {
            const inputField = overlay.querySelector('#rpg-dialog-input-field');
            const confirmBtn = overlay.querySelector('#rpg-dialog-confirm-btn');
            const cancelBtn = overlay.querySelector('#rpg-dialog-cancel-btn');

            inputField.focus();
            inputField.select();

            confirmBtn.onclick = () => close(inputField.value);
            cancelBtn.onclick = () => close(null);

            inputField.onkeydown = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    close(inputField.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            };
        });
    }

    // Custom Prompt for New Map (Both Width & Height at once!)
    static promptNewMap(defaultWidth = 10, defaultHeight = 10) {
        const html = `
            <div class="rpg-dialog-header">
                <span>🗺️ Create New Map</span>
            </div>
            <div class="rpg-dialog-body">
                <p>Customize the grid size of your new adventure world.</p>
                <div class="rpg-dialog-double-fields">
                    <div>
                        <label for="rpg-map-width">Grid Width (tiles)</label>
                        <input type="number" class="rpg-dialog-input" id="rpg-map-width" min="1" max="100" value="${defaultWidth}">
                    </div>
                    <div>
                        <label for="rpg-map-height">Grid Height (tiles)</label>
                        <input type="number" class="rpg-dialog-input" id="rpg-map-height" min="1" max="100" value="${defaultHeight}">
                    </div>
                </div>
            </div>
            <div class="rpg-dialog-footer">
                <button class="rpg-dialog-btn rpg-dialog-btn-secondary" id="rpg-dialog-cancel-btn">Cancel</button>
                <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">Create Map</button>
            </div>
        `;

        return CustomDialog.show(html, (overlay, close) => {
            const widthInput = overlay.querySelector('#rpg-map-width');
            const heightInput = overlay.querySelector('#rpg-map-height');
            const confirmBtn = overlay.querySelector('#rpg-dialog-confirm-btn');
            const cancelBtn = overlay.querySelector('#rpg-dialog-cancel-btn');

            widthInput.focus();
            widthInput.select();

            const handleSubmit = () => {
                const w = parseInt(widthInput.value);
                const h = parseInt(heightInput.value);
                if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) {
                    CustomDialog.alert("Invalid dimensions. Please enter positive numbers.", "Input Error");
                    return;
                }
                close({ width: w, height: h });
            };

            confirmBtn.onclick = handleSubmit;
            cancelBtn.onclick = () => close(null);

            const handleKeys = (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmit();
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            };

            widthInput.onkeydown = handleKeys;
            heightInput.onkeydown = handleKeys;
        });
    }

    // Custom Note Text dialog with a nice large textarea
    static promptNoteText(defaultValue = "") {
        const html = `
            <div class="rpg-dialog-header">
                <span>📝 Context Note Description</span>
            </div>
            <div class="rpg-dialog-body">
                <label for="rpg-note-text" style="display: block; font-size: 0.85em; font-weight: bold; margin-bottom: 6px; color: #D4C8A0;">
                    Note Text (Provides context to NPCs on this map)
                </label>
                <textarea class="rpg-dialog-input rpg-dialog-textarea" id="rpg-note-text" placeholder="Write description or system instructions...">${defaultValue}</textarea>
            </div>
            <div class="rpg-dialog-footer">
                <button class="rpg-dialog-btn rpg-dialog-btn-secondary" id="rpg-dialog-cancel-btn">Cancel</button>
                <button class="rpg-dialog-btn rpg-dialog-btn-primary" id="rpg-dialog-confirm-btn">Save Note</button>
            </div>
        `;

        return CustomDialog.show(html, (overlay, close) => {
            const textarea = overlay.querySelector('#rpg-note-text');
            const confirmBtn = overlay.querySelector('#rpg-dialog-confirm-btn');
            const cancelBtn = overlay.querySelector('#rpg-dialog-cancel-btn');

            textarea.focus();
            textarea.select();

            confirmBtn.onclick = () => close(textarea.value);
            cancelBtn.onclick = () => close(null);

            textarea.onkeydown = (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    close(textarea.value);
                } else if (e.key === 'Escape') {
                    e.preventDefault();
                    close(null);
                }
            };
        });
    }
}

// Bind to window.CustomDialog for convenient access across traditional module boundaries
window.CustomDialog = CustomDialog;

export default CustomDialog;

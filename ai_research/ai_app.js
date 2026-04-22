import awareness from './logs/awareness.js';
import witness from './logs/witness.js';
import analysis from './logs/analysis.js';
import directions from './logs/directions.js';
import imagination from './logs/imagination.js';
import happenings from './logs/happenings.js';

// Research Logs Database
const researchFiles = [
    { ...awareness },
    { ...witness },
    { ...analysis },
    { ...directions },
    { ...imagination },
    { ...happenings }
];

// NEW: Import water pool functionality
import { initWaterPool, addWaterDropFromPixel } from './water_pool.js';

const headingEl = document.getElementById('dynamic-heading');
const contentEl = document.getElementById('text-content');
const fileBrowserEl = document.querySelector('#file-browser ul');

// Change canvas reference to the new node-canvas
const nodeCanvas = document.getElementById('node-canvas');
let ctx; // Context will be initialized in `initialize`

let dpr = Math.max(1, window.devicePixelRatio || 1);
let nodes = [];
let mouse = { x: -9999, y: -9999, down: false }; // Mouse for node interaction
let currentFileId = null;
let uiActive = false; // New state variable to track if the UI panels are active

let fileBrowserListItems = []; // Array to hold the list item elements

// Global state for 'Press any key to continue...'
let currentContentLines = [];
let currentContentLineIndex = 0;
let isContentPaused = false;
let continueMessageEl = null;

// NEW: Timer IDs for animation cancellation
let currentTypingTimer = null; // For the heading typeWriter
let currentLineDisplayTimer = null; // For the content line-by-line display

// Add these constants at the top level of ai_app.js for styling consistency
const NODE_LABEL_FONT = '12px ' + getComputedStyle(document.body).getPropertyValue('--font-family').split(',')[0]; // Use the primary terminal font
const NODE_ACTIVE_COLOR = '#CCCCCC'; // Solid light grey when active/hover
const NODE_INACTIVE_COLOR = 'rgba(204, 204, 204, 0.7)'; // Slightly transparent light grey when inactive
const CONNECTION_COLOR = 'rgba(204, 204, 204, 0.7)'; // Slightly transparent light grey for connections
const NODE_CORE_COLOR = '#CCCCCC'; // Solid light grey for node core (the '@' symbol)
const ASCII_LINE_CHAR = '-'; // Character to draw for lines
const ASCII_CHAR_WIDTH_EST = 10; // Estimated pixel width of an ASCII character at 12px font

// Original typeWriter function (for the heading only - character by character)
function typeWriter(text, element, onComplete) {
    // NEW: Clear any existing typing timer if a new one is started
    if (currentTypingTimer) {
        clearTimeout(currentTypingTimer);
        currentTypingTimer = null;
    }

    let i = 0;
    element.innerHTML = ''; // Clear existing text
    element.classList.add('typing'); // Add typing class for cursor
    const baseSpeed = 25; // milliseconds per character (base speed)

    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            let currentDelay = baseSpeed; // Start with base speed

            const char = text.charAt(i);
            const prevChar = i > 0 ? text.charAt(i - 1) : '';
            const nextChar = i < text.length - 1 ? text.charAt(i + 1) : '';

            // Rule 1: Longer pause after a tag like "[TAG]"
            if (char === ']' && nextChar === ' ') {
                currentDelay = 250; // Pause for 250ms
            }
            // Rule 2: Slightly longer, randomized pause after most words
            else if (char === ' ' && prevChar !== ' ' && i < text.length - 1) { // Ensure it's not the very last character and a real word break
                currentDelay = baseSpeed + Math.random() * 80 + 70; // Base speed + 70-150ms
            }
            // Rule 3: Small randomization for normal typing speed
            else {
                currentDelay = baseSpeed + (Math.random() - 0.5) * 15; // +/- 7.5ms from baseSpeed
            }

            i++;
            // NEW: Store the timer ID
            currentTypingTimer = setTimeout(type, currentDelay);
        } else {
            element.classList.remove('typing'); // Remove typing class when done
            currentTypingTimer = null; // Clear timer when animation is complete
            if (onComplete) {
                onComplete();
            }
        }
    }
    type();
}

// NEW: Function to cancel all active content animations and reset state
function cancelActiveContentAnimations() {
    if (currentTypingTimer) {
        clearTimeout(currentTypingTimer);
        currentTypingTimer = null;
        headingEl.classList.remove('typing'); // Ensure typing cursor is removed
    }
    if (currentLineDisplayTimer) {
        clearTimeout(currentLineDisplayTimer);
        currentLineDisplayTimer = null;
    }
    currentContentLines = [];
    currentContentLineIndex = 0;
    isContentPaused = false;
    if (continueMessageEl) {
        continueMessageEl.remove();
        continueMessageEl = null;
    }
    window.removeEventListener('keydown', handleContinueKeyPress);
}

// NEW: Function to display content line by line without character typing
function displayContentLineByLine(content, element, delayPerLine = 60) {
    // Note: cancelActiveContentAnimations() should have already been called by displayContent()
    // No need for specific clearing here, as the global cancel takes care of it.

    element.innerHTML = ''; // Clear existing content
    element.classList.remove('typing'); // Ensure no typing cursor
    element.classList.add('visible'); // Make sure the container is visible

    currentContentLines = content.split('\n');
    currentContentLineIndex = 0;
    isContentPaused = false;
    // continueMessageEl and keydown listener are reset by cancelActiveContentAnimations()

    showNextContentLine(element, delayPerLine); // Start the first line display
}

function showNextContentLine(element, delayPerLine) {
    if (isContentPaused) return;

    if (currentContentLineIndex < currentContentLines.length) {
        const line = currentContentLines[currentContentLineIndex];

        if (line.trim() === '***') {
            isContentPaused = true;
            currentContentLineIndex++; // Consume the '***' line

            continueMessageEl = document.createElement('div');
            continueMessageEl.textContent = '--- Press any key to continue ---';
            continueMessageEl.style.marginTop = '1em';
            continueMessageEl.style.fontWeight = 'bold';
            continueMessageEl.style.textAlign = 'center';
            continueMessageEl.style.color = '#AAAAAA'; // Softer prompt color
            element.appendChild(continueMessageEl);

            // Add event listener specifically for this pause.
            window.addEventListener('keydown', handleContinueKeyPress, { once: true });
            return;
        }

        const lineDiv = document.createElement('div');
        lineDiv.textContent = line;
        // Apply white-space: pre-wrap to preserve formatting like leading spaces and ASCII art within a line
        lineDiv.style.whiteSpace = 'pre-wrap'; 
        
        element.appendChild(lineDiv);
        currentContentLineIndex++;
        // NEW: Store the timer ID for the next line display
        currentLineDisplayTimer = setTimeout(() => showNextContentLine(element, delayPerLine), delayPerLine);
    } else {
        currentLineDisplayTimer = null; // Clear timer when animation is complete
    }
}

function handleContinueKeyPress() {
    if (isContentPaused) {
        isContentPaused = false;
        if (continueMessageEl) {
            continueMessageEl.remove();
            continueMessageEl = null;
        }
        showNextContentLine(contentEl, 60); // Resume with contentEl and same delay
    }
}

// NEW: Function to display file browser items line by line
function displayFileBrowserItemsLineByLine(delayPerItem = 100) { // Slowed down
    let index = 0;
    function showNextItem() {
        if (index < fileBrowserListItems.length) {
            const item = fileBrowserListItems[index];
            fileBrowserEl.appendChild(item); // Append to the actual DOM
            item.style.display = 'block'; // Make it visible immediately without opacity transition
            index++;
            setTimeout(showNextItem, delayPerItem);
        }
    }
    showNextItem();
}

function displayContent(file) {
    if (!file) return;

    // NEW: Cancel any active animations from previous content immediately
    cancelActiveContentAnimations();

    currentFileId = file.id;

    // Update active state in file browser
    document.querySelectorAll('#file-browser li button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.fileId === file.id);
    });

    // Ensure content container is visible and clear it for typing
    contentEl.classList.remove('typing'); // Ensure no typing cursor from previous elements
    contentEl.classList.add('visible'); // Make sure the container is visible
    contentEl.innerHTML = ''; 

    // Start typing animation for the heading
    typeWriter(file.title, headingEl, () => {
        // Once typing for the title is done, display content line by line for the description
        displayContentLineByLine(file.content, contentEl);
    });
}

function resizeNodeCanvas() { 
    if (!nodeCanvas || !ctx) return;
    const rect = nodeCanvas.getBoundingClientRect();
    nodeCanvas.width = Math.floor(rect.width * dpr);
    nodeCanvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function createNodes() {
    if (!nodeCanvas || researchFiles.length === 0) return;
    const w = nodeCanvas.clientWidth, h = nodeCanvas.clientHeight; 
    
    // Determine the center (hub) node. Prefer 'gan_studies', otherwise use the first file.
    let centerNodeId = 'gan_studies';
    if (!researchFiles.find(f => f.id === centerNodeId)) {
        centerNodeId = researchFiles[0].id;
    }
    
    const otherNodes = researchFiles.filter(f => f.id !== centerNodeId);
    const radius = Math.min(w, h) * 0.25; 

    nodes = researchFiles.map((f, i) => {
        const isCenter = f.id === centerNodeId;
        const angle = isCenter ? 0 : (otherNodes.findIndex(node => node.id === f.id) / otherNodes.length) * Math.PI * 2;
        
        // Use initialX/initialY if provided (0-100 scale for responsiveness), else fallback to circular layout
        const startX = f.initialX !== undefined ? (f.initialX / 100) * w : (isCenter ? w / 2 : w / 2 + Math.cos(angle) * radius);
        const startY = f.initialY !== undefined ? (f.initialY / 100) * h : (isCenter ? h / 2 : h / 2 + Math.sin(angle) * radius);

        return {
            id: f.id,
            parentId: f.parentId, // Support parentId from data
            label: f.title,
            x: startX,
            y: startY,
            vx: 0, vy: 0, size: 8 + (i % 3) * 2,
            active: false
        };
    });
}

function drawNodes() { // Renamed from draw()
    if (!ctx || !nodeCanvas || nodes.length === 0) return;
    const w = nodeCanvas.clientWidth, h = nodeCanvas.clientHeight;
    ctx.clearRect(0, 0, w, h); 

    // Find the hub node for fallback connections
    let hubNode = nodes.find(n => n.id === 'gan_studies');
    if (!hubNode && nodes.length > 0) hubNode = nodes[0];
    
    if (!hubNode) return;

    const drawnConnections = new Set(); 

    const drawAsciiConnection = (nodeA, nodeB) => {
        if (!nodeA || !nodeB) return;
        const idPair = [nodeA.id, nodeB.id].sort().join('-'); 
        if (drawnConnections.has(idPair)) return;

        const dx = nodeB.x - nodeA.x; // Vector from A to B
        const dy = nodeB.y - nodeA.y;
        const dist = Math.hypot(dx, dy);
        const angle = Math.atan2(dy, dx); // Angle of the line

        // Calculate a 'step' distance for placing characters, incorporating estimated char width and a small gap
        const step = ASCII_CHAR_WIDTH_EST + 2; 
        const numChars = Math.floor(dist / step);

        if (numChars <= 0) return; // No space for characters

        ctx.save();
        ctx.translate(nodeA.x, nodeA.y);
        ctx.rotate(angle);
        ctx.fillStyle = CONNECTION_COLOR;
        ctx.font = NODE_LABEL_FONT; // Use the same font as labels
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle'; // Center text vertically on the line

        for (let i = 0; i < numChars; i++) {
            ctx.fillText(ASCII_LINE_CHAR, i * step, 0);
        }
        ctx.restore();
        drawnConnections.add(idPair);
    };

    // Connect nodes based on parentId or fallback to hub
    nodes.forEach(n => {
        const parentId = n.parentId || (n.id !== hubNode.id ? hubNode.id : null);
        if (parentId) {
            const parentNode = nodes.find(pn => pn.id === parentId);
            if (parentNode) {
                drawAsciiConnection(n, parentNode);
            }
        }
    });

    // Nodes
    nodes.forEach(n => {
        const dx = n.x - mouse.x, dy = n.y - mouse.y, dist = Math.hypot(dx, dy);
        const hover = dist < 28;
        const isActive = n.active; // Use n.active instead of glow

        // Draw '@' symbol for the node core
        ctx.font = 'bold 16px ' + getComputedStyle(document.body).getPropertyValue('--font-family').split(',')[0]; // Larger, bold font for the '@'
        ctx.fillStyle = NODE_CORE_COLOR; // Use NODE_CORE_COLOR for '@'
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle'; // Center text vertically
        ctx.fillText('@', n.x, n.y + 1); // Adjust Y slightly to center the @ visually

        // Outline (No glow) - still draws a circle for hover/active feedback
        ctx.strokeStyle = hover || isActive ? NODE_ACTIVE_COLOR : NODE_INACTIVE_COLOR;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(n.x, n.y, 8, 0, Math.PI * 2);
        ctx.stroke();

        // Label
        ctx.font = NODE_LABEL_FONT;
        ctx.fillStyle = hover || isActive ? NODE_ACTIVE_COLOR : NODE_INACTIVE_COLOR;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom'; // Place label above the @ symbol
        ctx.fillText(n.label.replace(/\[[^\]]+\]/g, '').trim(), n.x, n.y - 12); 

        // Show coordinates on hover to help with manual positioning
        if (hover) {
            ctx.font = '10px ' + getComputedStyle(document.body).getPropertyValue('--font-family').split(',')[0];
            ctx.textBaseline = 'top';
            // Show normalized 0-100 coordinates for easy copy-pasting back into logs
            const normX = Math.round((n.x / w) * 100);
            const normY = Math.round((n.y / h) * 100);
            ctx.fillText(`x: ${normX} y: ${normY}`, n.x, n.y + 12);
        }
    });
}

function physics() {
    if (!nodeCanvas || nodes.length === 0) return;
    const w = nodeCanvas.clientWidth, h = nodeCanvas.clientHeight;
    
    // Find the hub node for physics (anchor point)
    let hubNode = nodes.find(n => n.id === 'gan_studies');
    if (!hubNode && nodes.length > 0) hubNode = nodes[0];

    nodes.forEach((n1, i) => {
        // --- ANCHOR FORCE for hub node to the center ---
        if (hubNode && n1.id === hubNode.id) {
            const centerX = w / 2;
            const centerY = h / 2;
            const dx_center = centerX - n1.x;
            const dy_center = centerY - n1.y;

            // Check if mouse is actively interacting with the GAN node
            const mouseToGanDx = n1.x - mouse.x;
            const mouseToGanDy = n1.y - mouse.y;
            const distMouseToGan = Math.hypot(mouseToGanDx, mouseToGanDy);
            const nodeInteractionRadius = 30; // Slightly larger than hover radius

            if (distMouseToGan > nodeInteractionRadius && !mouse.down) {
                // Only apply anchor force if mouse is not over or clicking the GAN node
                const anchorStrength = 0.0007; // Gentle pull back to center
                n1.vx += dx_center * anchorStrength;
                n1.vy += dy_center * anchorStrength;
            }
            // If mouse is interacting, the mouse attraction/repulsion forces and damping will take over.
        }

        // --- Mouse Attraction/Repulsion ---
        const dx_mouse = mouse.x - n1.x;
        const dy_mouse = mouse.y - n1.y;
        const dist_mouse = Math.hypot(dx_mouse, dy_mouse);
        const attraction_radius = 150;
        const deadzone_radius = 20;
        const mouse_attraction_strength = 0.0025;

        // Apply mouse force if mouse is near a node
        if (dist_mouse > deadzone_radius && dist_mouse < attraction_radius) {
            const effective_dist = dist_mouse - deadzone_radius;
            const effective_attraction_radius = attraction_radius - deadzone_radius;

            const attractionForce = (effective_attraction_radius - effective_dist) * mouse_attraction_strength;
            n1.vx += (dx_mouse / dist_mouse) * attractionForce;
            n1.vy += (dy_mouse / dist_mouse) * attractionForce;

            const frictionFactor = (attraction_radius - dist_mouse) / attraction_radius;
            const frictionStrength = 0.2;
            n1.vx *= (1 - frictionFactor * frictionStrength);
            n1.vy *= (1 - frictionFactor * frictionStrength);
        } else if (dist_mouse <= deadzone_radius) {
            // If mouse is very close (inside deadzone), apply stronger damping
            const deadzoneDamping = 0.4;
            n1.vx *= (1 - deadzoneDamping);
            n1.vy *= (1 - deadzoneDamping);
        }

        // --- Node-to-Node Interactions ---
        for (let j = i + 1; j < nodes.length; j++) {
            const n2 = nodes[j];

            const dx_nodes = n1.x - n2.x;
            const dy_nodes = n1.y - n2.y;
            const dist_nodes = Math.hypot(dx_nodes, dy_nodes);

            if (dist_nodes === 0) { // Prevent division by zero, slight nudge
                n1.x += Math.random() * 0.1; n1.y += Math.random() * 0.1;
                n2.x -= Math.random() * 0.1; n2.y -= Math.random() * 0.1;
                continue;
            }

            const unit_dx = dx_nodes / dist_nodes;
            const unit_dy = dy_nodes / dist_nodes;

            // Universal Repulsion (inverse square law, prevents stacking)
            // Reduced repulsion_force_constant to balance with other forces for stability
            const repulsion_force_constant = 50; 
            const repulsionForce = repulsion_force_constant / (dist_nodes * dist_nodes);

            n1.vx += unit_dx * repulsionForce;
            n1.vy += unit_dy * repulsionForce;
            n2.vx -= unit_dx * repulsionForce;
            n2.vy -= unit_dy * repulsionForce;

            // Connection Attraction (Hooke's Law for connected nodes)
            if (hubNode) {
                const parentId1 = n1.parentId || (n1.id !== hubNode.id ? hubNode.id : null);
                const parentId2 = n2.parentId || (n2.id !== hubNode.id ? hubNode.id : null);
                
                const isConnected = (n1.id === parentId2) || (n2.id === parentId1);

                if (isConnected) {
                    const spring_k = 0.001; 
                    const rest_length = 200; 

                    const extension = dist_nodes - rest_length;
                    const attractionForce = -spring_k * extension; // Negative force for attraction, positive for repulsion when stretched

                    n1.vx += unit_dx * attractionForce; // Add force in direction of n2
                    n1.vy += unit_dy * attractionForce;
                    n2.vx -= unit_dx * attractionForce; // Add force in direction of n1
                    n2.vy -= unit_dy * attractionForce;
                }
            }
        }

        // --- Damping and Position Update ---
        n1.vx *= 0.96;
        n1.vy *= 0.96;
        
        n1.x += n1.vx;
        n1.y += n1.vy;

        // --- Water Disturbance ---
        // Only add water drops if UI is not active, node is moving, AND mouse is not currently *down* (dragging)
        if (!uiActive && !mouse.down && (Math.abs(n1.vx) > 0.1 || Math.abs(n1.vy) > 0.1)) { 
            const strength = Math.min(10, Math.hypot(n1.vx, n1.vy) * 4);
            addWaterDropFromPixel(n1.x, n1.y, strength);
        }
    });
}

function loop() {
    physics();
    drawNodes(); 
    requestAnimationFrame(loop);
}

function nodeAt(x, y) {
    for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        if (Math.hypot(n.x - x, n.y - y) < 18) return n;
    }
    return null;
}

// NEW: Function to return to the node-floating ASCII pool view
function backToNodesView() {
    document.querySelector('main').classList.remove('ui-active');
    uiActive = false;
    nodes.forEach(n => n.active = false);
    headingEl.innerHTML = '> AI Research Archive';
    contentEl.innerHTML = '$ ./discover_nodes.sh<br>> Click any node to explore detailed project logs and insights.<br>> ';
    contentEl.classList.add('visible');
    fileBrowserEl.innerHTML = ''; // Clear file browser list
    currentFileId = null;
    
    // NEW: Ensure all active content animations are cancelled when going back to nodes view
    cancelActiveContentAnimations();
}

function bindNodeCanvasEvents() { 
    if (!nodeCanvas) return;
    const rectPos = (e) => {
        const r = nodeCanvas.getBoundingClientRect(); 
        mouse.x = e.clientX - r.left;
        mouse.y = e.clientY - r.top;
    };
    window.addEventListener('mousemove', (e) => { rectPos(e); });
    window.addEventListener('mouseleave', () => { mouse.x = -9999; mouse.y = -9999; });

    nodeCanvas.addEventListener('mousedown', (e) => { // Track if mouse button is down on the canvas
        mouse.down = true;
        rectPos(e); // Update mouse position
    });

    window.addEventListener('mouseup', () => { // Track if mouse button is released anywhere
        mouse.down = false;
    });

    nodeCanvas.addEventListener('click', (e) => { 
        const hit = nodeAt(mouse.x, mouse.y);
        if (hit) {
            // If content is paused, a click should also resume it
            if (isContentPaused) {
                handleContinueKeyPress();
                return;
            }

            if (!uiActive) {
                // The 'ui-active' class on 'main' handles the grid layout and visibility of #file-browser and #content-viewer
                document.querySelector('main').classList.add('ui-active');
                uiActive = true;
                
                nodes.forEach(n => n.active = false); 
                hit.active = true; 

                // If file browser items haven't been displayed yet, display them line by line
                if (fileBrowserEl.children.length === 0) {
                    displayFileBrowserItemsLineByLine();
                }

                const file = researchFiles.find(f => f.id === hit.id);
                if (file) displayContent(file);
                
            } else { 
                nodes.forEach(n => n.active = n.id === hit.id);
                const file = researchFiles.find(f => f.id === hit.id);
                if (file) displayContent(file);
            }
        }
    });

    window.addEventListener('resize', () => {
        resizeNodeCanvas(); 
        createNodes(); 
    });

    // NEW: Listen for messages from parent window (for 'back' command)
    window.addEventListener('message', (event) => {
        if (event.data === 'back-command') {
            backToNodesView();
        }
    });

    // NEW: Listen for Escape key to exit
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            window.parent.postMessage('exit-command', '*');
        }
    });
}

function initialize() {
    researchFiles.forEach(file => {
        const li = document.createElement('li');
        const button = document.createElement('button');
        button.textContent = file.title;
        button.dataset.fileId = file.id;
        button.addEventListener('click', () => {
            if (uiActive && currentFileId !== file.id) {
                nodes.forEach(n => n.active = n.id === file.id);
                displayContent(file);
            }
        });
        li.appendChild(button);
        li.style.display = 'none'; // Initially hide the list item, JS will show them line by line
        fileBrowserListItems.push(li); // Store, don't append yet
    });

    // NEW: Initialize water pool first, as it's the background
    const asciiWaterCanvas = document.getElementById('ascii-water-canvas');
    if (asciiWaterCanvas) {
        initWaterPool(asciiWaterCanvas);
    } else {
        console.error("ascii-water-canvas not found!");
    }

    // Node Canvas setup
    if (!nodeCanvas) { 
        console.error("node-canvas not found!");
        return;
    }
    ctx = nodeCanvas.getContext('2d'); // Initialize ctx here
    
    resizeNodeCanvas();
    createNodes();
    bindNodeCanvasEvents();
    requestAnimationFrame(loop);

    headingEl.textContent = '> AI Research Archive';
    contentEl.innerHTML = '$ ./discover_nodes.sh<br>> Click any node to explore detailed project logs and insights.<br>> ';
    contentEl.classList.add('visible'); 
}

initialize();
import { FS } from "./fs.js";
import { openAboutMeWindow } from "./about_me.js"; // Import the new about_me module
import { openBlogWindow, preloadBlogPosts } from "./blog.js"; // Import the new blog module
import { openWonderlandWindow } from "./wonderlands.js"; // Import the new wonderlands module
import { initMascot, cleanupMascot } from "./mascot.js"; // NEW: Import initMascot and cleanupMascot

const desktop = document.getElementById('desktop');
const taskbarTasks = document.getElementById('taskbar-tasks');
// Changed startBtn and startMenu to 'let' to allow re-assignment in initializeApp
let startBtn = document.getElementById('start-button');
let startMenu = document.getElementById('start-menu');
const clock = document.getElementById('clock');
const loadingScreen = document.getElementById('loading-screen');
const loadingProgress = document.getElementById('loading-progress');
const loadingFile = document.getElementById('loading-file');

let zTop = 100; // Changed: Increased zTop to ensure windows are above mascot and speech bubble
const windows = new Map(); // id -> {el, taskBtn, minimized, maximized, prev}
let winCounter = 0;

// NEW: Global state for tap/double-tap detection
const TAP_MAX_DURATION = 300; // milliseconds for a tap to register
const DOUBLE_TAP_MAX_DELAY = 300; // milliseconds between two taps
let lastTapTime = 0;
let lastTappedEl = null;

function nowClock() {
  const d = new Date();
  clock.textContent = d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
}
setInterval(nowClock, 15000); nowClock();

function toggleStart(open) {
  const isOpen = open ?? startMenu.getAttribute('aria-hidden') === 'true';
  startMenu.setAttribute('aria-hidden', isOpen ? 'false' : 'true');
  startBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}
// Removed global event listener for startBtn here, as it's now in initializeApp

document.addEventListener('click', (e) => {
  if (!startMenu.contains(e.target) && e.target !== startBtn) {
    startMenu.setAttribute('aria-hidden', 'true');
    startBtn.setAttribute('aria-expanded', 'false');
  }
});
// Removed global event listener for startMenu here, as it's now in initializeApp

function createTaskButton(title, id) {
  const btn = document.createElement('button');
  btn.className = 'task-btn';
  btn.textContent = title;
  btn.addEventListener('click', () => {
    const w = windows.get(id);
    if (!w) return;
    if (w.minimized) restoreWindow(id);
    focusWindow(id);
  });
  taskbarTasks.appendChild(btn);
  return btn;
}

function openWindow({title, content, width=420, height=300, x=40, y=40, onClose=null}) {
  const tpl = document.getElementById('window-template');
  const node = tpl.content.firstElementChild.cloneNode(true);
  const id = `win_${++winCounter}`;
  node.style.width = width + 'px';
  node.style.height = height + 'px';
  node.style.left = x + 'px';
  node.style.top = y + 'px';
  node.querySelector('.title').textContent = title;
  node.querySelector('.content').appendChild(content);

  desktop.appendChild(node);
  const taskBtn = createTaskButton(title, id);
  windows.set(id, { el: node, taskBtn, minimized: false, maximized: false, prev: null, title, onClose });

  wireWindow(id);
  focusWindow(id);
  return id;
}

function resizeWindow(id, newWidth, newHeight) {
  const w = windows.get(id);
  if (!w || w.maximized || w.minimized) return; // Don't resize if maximized or minimized

  const el = w.el;
  const desktopWidth = desktop.clientWidth;
  const desktopHeight = desktop.clientHeight;

  // Ensure new dimensions are within bounds and minimum size
  const actualWidth = Math.max(240, Math.min(newWidth, desktopWidth));
  const actualHeight = Math.max(160, Math.min(newHeight, desktopHeight)); // desktopHeight is already the desktop's height, not viewport

  // Maintain position if possible, adjust if new size pushes it off screen
  let currentLeft = el.offsetLeft;
  let currentTop = el.offsetTop;

  let newLeft = Math.min(currentLeft, desktopWidth - actualWidth);
  newLeft = Math.max(0, newLeft);
  
  // Clamp newTop to desktop boundaries. desktop.clientHeight already excludes taskbar.
  let newTop = Math.min(currentTop, desktopHeight - actualHeight);
  newTop = Math.max(0, newTop); // Ensure it's not off top edge

  el.style.width = `${actualWidth}px`;
  el.style.height = `${actualHeight}px`;
  el.style.left = `${newLeft}px`;
  el.style.top = `${newTop}px`;
}

function wireWindow(id) {
  const w = windows.get(id);
  const el = w.el;
  const bar = el.querySelector('.titlebar');
  const maxBtn = el.querySelector('.btn-max'); // Get the maximize button

  // Focus on mousedown
  el.addEventListener('mousedown', () => focusWindow(id));

  // Dragging
  bar.addEventListener('mousedown', (e) => {
    if (e.target.closest('.controls') || w.maximized) return;
    
    // Capture initial state
    const initialMouseX = e.clientX;
    const initialMouseY = e.clientY;
    const initialElLeft = el.offsetLeft;
    const initialElTop = el.offsetTop;

    const onDragMove = (moveEvent) => {
      const dx = moveEvent.clientX - initialMouseX;
      const dy = moveEvent.clientY - initialMouseY;
      let newLeft = initialElLeft + dx;
      let newTop = initialElTop + dy;

      // Clamp to desktop boundaries
      // Left boundary: newLeft cannot be less than 0
      newLeft = Math.max(0, newLeft);
      // Right boundary: newLeft + width cannot exceed desktop.clientWidth
      newLeft = Math.min(newLeft, desktop.clientWidth - el.offsetWidth);

      // Top boundary: newTop cannot be less than 0
      newTop = Math.max(0, newTop);
      // Bottom boundary: newTop + height cannot exceed desktop.clientHeight (which is the top of the taskbar)
      newTop = Math.min(newTop, desktop.clientHeight - el.offsetHeight);

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
    };

    const onDragUp = () => {
      document.body.classList.remove('is-dragging-window');
      window.removeEventListener('mousemove', onDragMove);
      window.removeEventListener('mouseup', onDragUp);
    };

    document.body.classList.add('is-dragging-window');
    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragUp);
    e.preventDefault();
  });

  // Resize
  el.querySelectorAll('.resizer').forEach(r => {
    r.addEventListener('mousedown', (e) => {
      if (w.maximized) return; // Cannot resize maximized windows

      const rect = el.getBoundingClientRect(); // Initial bounding rect when resize starts
      const initialMouseX = e.clientX;
      const initialMouseY = e.clientY;
      const edge = r.dataset.edge;

      const onResizeMove = (moveEvent) => {
        const dx = moveEvent.clientX - initialMouseX;
        const dy = moveEvent.clientY - initialMouseY;
        let left = rect.left, top = rect.top, width = rect.width, height = rect.height;

        if (edge.includes('r')) width = Math.max(240, rect.width + dx);
        if (edge.includes('l')) { width = Math.max(240, rect.width - dx); left = rect.left + dx; }
        if (edge.includes('b')) height = Math.max(160, rect.height + dy);
        if (edge.includes('t')) { height = Math.max(160, rect.height - dy); top = rect.top + dy; }

        // Apply and clamp to desktop boundaries
        let newLeft = Math.max(0, Math.min(left, desktop.clientWidth - width));
        let newTop = Math.max(0, Math.min(top, desktop.clientHeight - height));
        
        // Ensure minimum size is respected, adjust position if necessary
        if (width < 240) {
            if (edge.includes('l')) newLeft = Math.max(0, rect.right - 240); // Pin right edge if shrinking left
            width = 240;
        }
        if (height < 160) {
            if (edge.includes('t')) newTop = Math.max(0, rect.bottom - 160); // Pin bottom edge if shrinking top
            height = 160;
        }

        Object.assign(el.style, {
          left: `${newLeft}px`,
          top: `${newTop}px`,
          width: `${width}px`,
          height: `${height}px`
        });
      };

      const onResizeUp = () => {
        document.body.classList.remove('is-dragging-window');
        window.removeEventListener('mousemove', onResizeMove);
        window.removeEventListener('mouseup', onResizeUp);
      };

      document.body.classList.add('is-dragging-window');
      window.addEventListener('mousemove', onResizeMove);
      window.addEventListener('mouseup', onResizeUp);
      e.preventDefault();
    });
  });

  // Controls
  el.querySelector('.btn-close').addEventListener('click', () => closeWindow(id));
  el.querySelector('.btn-min').addEventListener('click', () => minimizeWindow(id));
  el.querySelector('.btn-max').addEventListener('click', () => maximizeWindow(id));

  // Double-click title to toggle maximize
  el.querySelector('.titlebar').addEventListener('dblclick', () => maximizeWindow(id));
}

function focusWindow(id) {
  windows.forEach(({el, taskBtn}, key) => {
    el.style.zIndex = key === id ? zTop += 1 : parseInt(el.style.zIndex || 0);
    taskBtn.classList.toggle('active', key === id);
  });
}

function minimizeWindow(id) {
  const w = windows.get(id);
  if (!w || w.minimized) return;
  w.el.style.display = 'none';
  w.minimized = true;
  w.taskBtn.classList.add('active');
}

function restoreWindow(id) {
  const w = windows.get(id);
  if (!w || !w.minimized) return;
  w.el.style.display = 'block';
  w.minimized = false;
  focusWindow(id);
}

function maximizeWindow(id) {
  const w = windows.get(id);
  if (!w) return;
  const el = w.el;
  const maxBtn = el.querySelector('.btn-max'); // Get the maximize button
  if (!w.maximized) {
    w.prev = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
    el.style.left = '0px';
    el.style.top = '0px';
    el.style.width = desktop.clientWidth + 'px';
    el.style.height = desktop.clientHeight + 'px';
    w.maximized = true;
    maxBtn.setAttribute('aria-label', 'Restore'); // Update label
  } else {
    Object.assign(el.style, w.prev);
    w.maximized = false;
    maxBtn.setAttribute('aria-label', 'Maximize'); // Update label
  }
  focusWindow(id);
}

function closeWindow(id) {
  const w = windows.get(id);
  if (!w) return;
  if (w.onClose) w.onClose();
  w.el.remove();
  w.taskBtn.remove();
  windows.delete(id);
}

// Helper function for making elements draggable
function makeDraggable(el, handle = el, onSingleClick = null, snapToGrid = false, gridX = 1, gridY = 1, gridOffsetX = 0, gridOffsetY = 0) {
  let isDragging = false;
  let startX, startY; // Mouse or touch position when drag starts
  let startElLeft, startElTop; // Element's position when drag starts
  let dragThreshold = 5; // Pixels before it's considered a drag, not a click
  let moved = false; // Track if the element actually moved beyond threshold

  const onDragStart = (e) => {
    // Only process left-click for mouse events.
    // Explicitly disallow touch events for dragging.
    if (e.type === 'mousedown' && e.button !== 0) return;
    if (e.type === 'touchstart') return; 
    
    e.preventDefault();
    e.stopPropagation();

    el.style.zIndex = zTop += 1;
    el.style.transition = 'none';

    isDragging = true;
    moved = false;
    el.classList.add('dragging');
    document.body.classList.add('is-dragging-window');

    const currentPos = e; // For mouse events, e is sufficient
    startX = currentPos.clientX;
    startY = currentPos.clientY;
    startElLeft = el.offsetLeft;
    startElTop = el.offsetTop;

    window.addEventListener('mousemove', onDragMove);
    window.addEventListener('mouseup', onDragEnd);
  };

  const onDragMove = (e) => {
    if (!isDragging) return;
    
    const currentPos = e; // For mouse events
    const deltaX = currentPos.clientX - startX;
    const deltaY = currentPos.clientY - startY;

    if (Math.abs(deltaX) > dragThreshold || Math.abs(deltaY) > dragThreshold) {
      moved = true;
      let newLeft = startElLeft + deltaX;
      let newTop = startElTop + deltaY;

      newLeft = Math.max(0, Math.min(newLeft, desktop.clientWidth - el.offsetWidth));
      newTop = Math.max(0, Math.min(newTop, desktop.clientHeight - el.offsetHeight));

      el.style.left = `${newLeft}px`;
      el.style.top = `${newTop}px`;
    }
  };

  const onDragEnd = (e) => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove('dragging');
    document.body.classList.remove('is-dragging-window');

    window.removeEventListener('mousemove', onDragMove);
    window.removeEventListener('mouseup', onDragEnd);

    if (snapToGrid && moved) {
      let currentLeft = el.offsetLeft;
      let currentTop = el.offsetTop;

      let snappedLeft = Math.round((currentLeft - gridOffsetX) / gridX) * gridX + gridOffsetX;
      let snappedTop = Math.round((currentTop - gridOffsetY) / gridY) * gridY + gridOffsetY;

      snappedLeft = Math.max(0, Math.min(snappedLeft, desktop.clientWidth - el.offsetWidth));
      snappedTop = Math.max(0, Math.min(snappedTop, desktop.clientHeight - el.offsetHeight));

      el.style.transition = 'left 0.1s ease-out, top 0.1s ease-out';
      el.style.left = `${snappedLeft}px`;
      el.style.top = `${snappedTop}px`;

      el.addEventListener('transitionend', () => {
        el.style.transition = 'none';
      }, { once: true });
    } else if (!moved && onSingleClick) {
      onSingleClick(el);
    }
  };

  handle.addEventListener('mousedown', onDragStart);
  // Removed touchstart and touchmove listeners
}

/* Desktop and Explorer */
function makeIcon(entry) {
  const tpl = document.getElementById('icon-template');
  const el = tpl.content.firstElementChild.cloneNode(true);
  el.querySelector('.icon-label').textContent = entry.name;
  el.dataset.path = entry.path;

  // Basic icon look by type
  const icon = el.querySelector('.icon-img');
  // entry.icon is now relative (e.g., 'pictures_icon.png' or 'Content/Videos/thumbnail.jpg')
  icon.style.backgroundImage = `url(${entry.icon || iconForType(entry.type)})`;

  // Original double-click listener remains
  el.addEventListener('dblclick', (e) => {
    e.preventDefault(); // Prevent text selection on double-click
    openEntry(entry.path)
  });

  // Keyboard activation remains
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') openEntry(entry.path);
  });

  return el;
}

function iconForType(type) {
  switch (type) {
    case 'folder': return 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/folder.svg';
    case 'image': return 'icons/pictures_icon.png';
    case 'video': return 'icons/videos_icon.png';
    case 'html': return 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file-type-html.svg';
    case 'about': return 'icons/about_me_icon.png';
    case 'blog': return 'icons/projects_icon.png';
    default: return 'https://cdn.jsdelivr.net/gh/tabler/tabler-icons/icons/file.svg';
  }
}

function renderDesktop() {
  desktop.innerHTML = ''; // Clear existing icons

  const iconSpacingX = 84; // 74px icon width + 10px margin
  const iconSpacingY = 90; // Approx 32px img + 6px label margin + 11px font + padding
  const initialDesktopIconOffsetX = 10; // Initial left position of the first icon
  const initialDesktopIconOffsetY = 10; // Initial top position of the first icon
  const rightMargin = 10;
  const topMargin = 10;

  const iconsToRender = []; // Store {entry, element, type} pairs

  // Collect all desktop entries
  const allDesktopEntries = FS.root.children.filter(child => child.desktopShortcut);

  // Create elements for all icons first
  allDesktopEntries.forEach(entry => {
    const iconEl = makeIcon(entry);
    let type;
    if (entry.name === 'About Me') {
      type = 'about-me';
    } else if (entry.name === 'AI_research') {
      type = 'ai-research';
    } else if (entry.name === 'GIL Archive') {
      type = 'gil-archive';
    } else {
      type = 'left-column';
    }
    iconsToRender.push({ entry, iconEl, type });
  });

  // Append all icons to the DOM. This allows their offsetWidth/offsetHeight to be calculated.
  iconsToRender.forEach(({ iconEl }) => desktop.appendChild(iconEl));

  // Now, calculate and apply positions after all elements are in the DOM
  let currentIconX = initialDesktopIconOffsetX;
  let currentIconY = initialDesktopIconOffsetY;

  iconsToRender.forEach(({ entry, iconEl, type }) => {
    let finalLeft, finalTop;

    if (type === 'left-column') {
      finalLeft = currentIconX;
      finalTop = currentIconY;
      currentIconY += iconSpacingY;
      // Handle wrapping to next column if height limit reached
      if (currentIconY + iconSpacingY > desktop.clientHeight - iconSpacingY) {
        currentIconY = initialDesktopIconOffsetY;
        currentIconX += iconSpacingX;
      }
    } else if (type === 'about-me') {
      finalLeft = desktop.clientWidth - iconEl.offsetWidth - rightMargin;
      finalTop = topMargin;
    } else if (type === 'ai-research') {
      const aboutMeEntryExists = !!FS.findByName('About Me'); // Check existence only
      let aiResearchBaseLeft = desktop.clientWidth - iconEl.offsetWidth - rightMargin; // Default top-right
      
      if (aboutMeEntryExists) {
          // If About Me exists, position AI Research to its left
          aiResearchBaseLeft -= iconSpacingX; 
      }
      finalLeft = aiResearchBaseLeft;
      finalTop = topMargin;
    } else if (type === 'gil-archive') {
      finalLeft = desktop.clientWidth - iconEl.offsetWidth - rightMargin;
      finalTop = topMargin + iconSpacingY;
    }
    
    // Apply calculated positions
    iconEl.style.left = `${finalLeft}px`;
    iconEl.style.top = `${finalTop}px`;

    // Make draggable after positioning
    makeDraggable(iconEl, iconEl, null, true, iconSpacingX, iconSpacingY, initialDesktopIconOffsetX, initialDesktopIconOffsetY);
  });
}

function openFolder(path) {
  const folder = FS.get(path);
  if (!folder || folder.type !== 'folder') return;
  const wrap = document.createElement('div');
  wrap.style.display = 'flex';
  wrap.style.flexDirection = 'column';
  wrap.style.height = '100%'; // Ensure wrap takes full height of content area

  // NEW: Add synopsis block for Projects, Pictures, Videos, and Wonderlands folders
  if (folder.path === '/Projects' || folder.path === '/Pictures' || folder.path === '/Videos' || folder.path === '/Wonderlands') {
    const synopsisBlock = document.createElement('div');
    synopsisBlock.className = 'projects-synopsis-block'; // Reusing class for consistent styling
    let synopsisText = '';
    if (folder.path === '/Projects') {
      synopsisText = `These are the 'coding' projects I've been working on in my free time.`;
    } else if (folder.path === '/Pictures') {
      synopsisText = `Here's a collection of images I've worked on throughout the years.`;
    } else if (folder.path === '/Videos') {
      synopsisText = `A collection of videos I've created or worked on.`;
    } else if (folder.path === '/Wonderlands') {
      synopsisText = `Genshin Wonderlands, but beware of meme projects here as well.`;
    }
    synopsisBlock.innerHTML = synopsisText;
    wrap.appendChild(synopsisBlock);
  }

  const list = document.createElement('div'); // Create the list div here
  list.className = 'file-list'; // Assign class
  wrap.appendChild(list); // Append to wrap

  // NEW: Add a specific class for Projects, Pictures, Videos, and Wonderlands folders to allow custom styling (big thumbnails)
  if (folder.path === '/Projects' || folder.path === '/Pictures' || folder.path === '/Videos' || folder.path === '/Wonderlands') {
    list.classList.add('projects-folder-list');
  }

  folder.children.forEach(ch => {
    const item = document.createElement('div');
    item.className = 'file-item';
    let iconSrc = ch.icon || iconForType(ch.type); // Default to assigned icon or generic type icon

    // For image files, use the image URL directly as a thumbnail
    if (ch.type === 'image' || ch.type === 'video' || (ch.type === 'html' && ch.path.startsWith('/Projects'))) {
      // For projects (HTML entries) and image/video files, use their specific thumbnails/urls
      // ch.icon and ch.url are now relative paths directly from fs.js
      iconSrc = ch.icon || ch.url;
    }

    item.innerHTML = `
      <div class="file-icon" style="background-image:url(${iconSrc});"></div>
      <div>
        <div class="file-name">${ch.name}</div>
        <div class="file-description">${ch.description || ch.type}</div>
      </div>
    `;
    item.addEventListener('dblclick', (e) => {
      e.preventDefault(); // Prevent text selection on double-click
      openEntry(ch.path)
    });
    item.tabIndex = 0; // Make file item focusable
    item.addEventListener('keydown', (e) => { if (e.key === 'Enter') openEntry(ch.path); });
    list.appendChild(item);
  });
  openWindow({ title: folder.name, content: wrap, width: 560, height: 380, x: 80, y: 80 });
}

function openImage(entry) {
  if (!entry || entry.type !== 'image') return;

  const currentPath = entry.path;
  const parentPath = currentPath.substring(0, currentPath.lastIndexOf('/')) || '/';
  const parentFolder = FS.get(parentPath);
  const imageEntries = parentFolder ? parentFolder.children.filter(ch => ch.type === 'image') : [entry];
  let currentIndex = imageEntries.findIndex(e => e.path === currentPath);
  if (currentIndex === -1) currentIndex = 0;

  const viewerContainer = document.createElement('div');
  viewerContainer.style.display = 'flex';
  viewerContainer.style.flexDirection = 'column';
  viewerContainer.style.height = '100%';

  const navBar = document.createElement('div');
  navBar.className = 'image-viewer-nav';
  navBar.innerHTML = `
    <button class="prev-btn">Previous</button>
    <span class="image-title-nav"></span>
    <button class="next-btn">Next</button>
  `;
  viewerContainer.appendChild(navBar);

  const zoomableContent = document.createElement('div');
  zoomableContent.className = 'viewer zoomable-viewer';
  zoomableContent.style.flexGrow = '1';
  zoomableContent.style.overflow = 'hidden';
  zoomableContent.style.position = 'relative'; // Ensure positioning context for image
  viewerContainer.appendChild(zoomableContent);

  // NEW: Loading Overlay
  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'image-loading-overlay';
  loadingOverlay.textContent = 'Loading...';
  zoomableContent.appendChild(loadingOverlay);

  const img = document.createElement('img');
  img.style.position = 'absolute';
  img.style.transformOrigin = '0 0';
  img.style.pointerEvents = 'none';
  img.style.willChange = 'transform';
  img.style.display = 'none'; // Initially hide the image
  zoomableContent.appendChild(img);

  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;
  let startX, startY;

  const titleSpan = navBar.querySelector('.image-title-nav');
  const prevBtn = navBar.querySelector('.prev-btn');
  const nextBtn = navBar.querySelector('.next-btn');

  let currentWindowId = null;

  function updateImageDisplay(newEntry) {
    // If the new image is the same as the one currently loaded AND is complete,
    // skip the full reload and just reset/apply transforms.
    // This prevents unnecessary reloads if this function is called redundantly.
    if (img.src.endsWith(newEntry.url) && img.complete) { // Use endsWith for robust comparison
        loadingOverlay.style.display = 'none';
        img.style.display = 'block';
        scale = 1; // Reset zoom/pan to default view
        offsetX = 0;
        offsetY = 0;
        applyTransform();
        if (currentWindowId) {
            const w = windows.get(currentWindowId);
            if (w) {
                w.el.querySelector('.title').textContent = newEntry.name;
                w.taskBtn.textContent = newEntry.name;
            }
        }
        prevBtn.disabled = currentIndex === 0;
        nextBtn.disabled = currentIndex === imageEntries.length - 1;
        return; // Exit without reloading
    }

    // Show loading overlay
    loadingOverlay.style.display = 'flex';
    img.style.display = 'none'; // Ensure image is hidden while loading

    // Remove any previous error messages
    zoomableContent.querySelectorAll('.image-error-message').forEach(el => el.remove());

    // Do not clear img.src = ''; here. Setting a new, different src will trigger a load,
    // and setting the same src will be optimized by the browser not to reload.
    // This makes the loading more robust and avoids flickering from redundant src changes.
    img.src = newEntry.url; // entry.url is now a correct relative path
    img.alt = newEntry.name;
    titleSpan.textContent = newEntry.name;

    // Reset zoom/pan when image changes
    scale = 1;
    offsetX = 0;
    offsetY = 0;

    // Remove previous load/error listeners to prevent multiple calls
    img.onload = null;
    img.onerror = null;

    img.onload = () => {
      loadingOverlay.style.display = 'none'; // Hide loading overlay
      img.style.display = 'block'; // Show the image

      const containerWidth = zoomableContent.offsetWidth;
      const containerHeight = zoomableContent.offsetHeight;
      const imgWidth = img.naturalWidth;
      const imgHeight = img.naturalHeight;

      if (imgWidth > containerWidth || imgHeight > containerHeight) {
        scale = Math.min(containerWidth / imgWidth, containerHeight / imgHeight);
      } else {
        scale = 1;
      }
      offsetX = (containerWidth - imgWidth * scale) / 2;
      offsetY = (containerHeight - imgHeight * scale) / 2;
      applyTransform();
    };

    img.onerror = () => {
      loadingOverlay.style.display = 'none'; // Hide loading overlay
      img.style.display = 'none'; // Ensure image remains hidden
      titleSpan.textContent = `Error loading: ${newEntry.name}`; // Show error in title
      console.error(`Failed to load image: ${newEntry.url}`);
      
      const errorMsg = document.createElement('div');
      errorMsg.textContent = 'Image failed to load.';
      errorMsg.className = 'image-error-message'; // Add class for styling and removal
      zoomableContent.appendChild(errorMsg);
    };

    // Update window title if window is already open
    if (currentWindowId) {
      const w = windows.get(currentWindowId);
      if (w) {
        w.el.querySelector('.title').textContent = newEntry.name;
        w.taskBtn.textContent = newEntry.name;
      }
    }

    // Disable/enable nav buttons
    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex === imageEntries.length - 1;
  }

  function applyTransform() {
    img.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  }

  prevBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent text selection
    if (currentIndex > 0) {
      currentIndex--;
      updateImageDisplay(imageEntries[currentIndex]);
    }
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent text selection
    if (currentIndex < imageEntries.length - 1) {
      currentIndex++;
      updateImageDisplay(imageEntries[currentIndex]);
    }
  });

  zoomableContent.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    isDragging = true;
    zoomableContent.style.cursor = 'grabbing';
    startX = e.clientX - offsetX;
    startY = e.clientY - offsetY;
    e.preventDefault(); // Prevent text selection on drag start
  });

  zoomableContent.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    offsetX = e.clientX - startX;
    offsetY = e.clientY - startY;
    applyTransform();
  });

  zoomableContent.addEventListener('mouseup', () => {
    isDragging = false;
    zoomableContent.style.cursor = 'grab';
  });

  zoomableContent.addEventListener('mouseleave', () => {
    isDragging = false;
    zoomableContent.style.cursor = 'grab';
  });

  zoomableContent.addEventListener('wheel', (e) => {
    e.preventDefault();
    const zoomFactor = 1.1;
    const oldScale = scale;
    const rect = zoomableContent.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (e.deltaY < 0) {
      scale *= zoomFactor;
    } else {
      scale /= zoomFactor;
    }
    scale = Math.max(0.1, Math.min(10, scale));

    offsetX = mouseX - (mouseX - offsetX) * (scale / oldScale);
    offsetY = mouseY - (mouseY - offsetY) * (scale / oldScale);

    applyTransform();
  }, { passive: false });

  zoomableContent.style.cursor = 'grab';

  currentWindowId = openWindow({ title: entry.name, content: viewerContainer, width: 800, height: 600, x: 120, y: 90 });
  updateImageDisplay(entry);

  return currentWindowId;
}

function openVideo(currentEntry) {
  if (!currentEntry || currentEntry.type !== 'video') return;

  const parentPath = currentEntry.path.substring(0, currentEntry.path.lastIndexOf('/')) || '/';
  const parentFolder = FS.get(parentPath);
  const videoEntries = parentFolder.children.filter(ch => ch.type === 'video');
  let currentIndex = videoEntries.findIndex(e => e.path === currentEntry.path);

  const viewerContainer = document.createElement('div');
  viewerContainer.className = 'viewer';
  viewerContainer.style.height = '100%';
  viewerContainer.style.backgroundColor = 'black';
  viewerContainer.style.display = 'flex';
  viewerContainer.style.flexDirection = 'column';
  viewerContainer.style.justifyContent = 'flex-start';
  viewerContainer.style.alignItems = 'stretch';
  viewerContainer.style.overflow = 'hidden';

  const videoWrapper = document.createElement('div');
  videoWrapper.style.flexGrow = '1';
  videoWrapper.style.backgroundColor = 'black';
  videoWrapper.style.display = 'flex';
  videoWrapper.style.justifyContent = 'center';
  videoWrapper.style.alignItems = 'center';
  videoWrapper.style.position = 'relative';
  videoWrapper.style.overflow = 'hidden';

  const loadingOverlay = document.createElement('div');
  loadingOverlay.className = 'video-loading-overlay';
  loadingOverlay.textContent = 'Loading video...';
  loadingOverlay.style.display = 'flex';
  videoWrapper.appendChild(loadingOverlay);

  const video = document.createElement('video');
  video.controls = false;
  video.preload = 'auto';
  video.style.maxWidth = '100%';
  video.style.maxHeight = '100%';
  video.style.display = 'none';

  videoWrapper.appendChild(video);

  const controlsContainer = document.createElement('div');
  controlsContainer.className = 'win95-video-controls';
  controlsContainer.innerHTML = `
    <button class="prev-video-btn" aria-label="Previous Video">|<</button>
    <button class="rewind-btn" aria-label="Rewind 10 seconds">«</button>
    <button class="play-pause-btn" aria-label="Play">▶</button>
    <button class="forward-btn" aria-label="Forward 10 seconds">»</button>
    <button class="next-video-btn" aria-label="Next Video">>|</button>
    <input type="range" class="seek-bar" min="0" value="0" step="0.1" disabled>
    <span class="time-display">00:00 / 00:00</span>
    <div class="volume-container">
      <button class="volume-btn" aria-label="Mute">♪</button>
      <input type="range" class="volume-bar" min="0" max="1" value="1" step="0.01">
    </div>
  `;

  viewerContainer.appendChild(videoWrapper);
  viewerContainer.appendChild(controlsContainer);

  const playPauseBtn = controlsContainer.querySelector('.play-pause-btn');
  const rewindBtn = controlsContainer.querySelector('.rewind-btn');
  const forwardBtn = controlsContainer.querySelector('.forward-btn');
  const seekBar = controlsContainer.querySelector('.seek-bar');
  const timeDisplay = controlsContainer.querySelector('.time-display');
  const volumeBtn = controlsContainer.querySelector('.volume-btn');
  const volumeBar = controlsContainer.querySelector('.volume-bar');
  const prevVideoBtn = controlsContainer.querySelector('.prev-video-btn');
  const nextVideoBtn = controlsContainer.querySelector('.next-video-btn');

  // State flags for video playback
  let isSeekingSlider = false; // True when user is actively dragging the slider
  let wasPlayingBeforeSeek = false; // To restore play state after seek
  let currentWindowId = null;

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return '00:00';
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = Math.floor(timeInSeconds % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  const updateTimeDisplay = (currentTime, duration) => {
    timeDisplay.textContent = `${formatTime(currentTime)} / ${formatTime(duration)}`;
  };

  const togglePlayPause = () => {
    if (video.paused || video.ended) {
      video.play();
    } else {
      video.pause();
    }
  };

  // Core function to perform a video seek
  const performVideoSeek = (targetTime) => {
    if (isNaN(video.duration) || video.readyState < 2) {
      console.warn("Video not ready for seeking.");
      return;
    }

    wasPlayingBeforeSeek = !video.paused;
    if (wasPlayingBeforeSeek) {
      video.pause(); // Pause to prevent `timeupdate` from interfering during the seek
    }
    
    seekBar.disabled = true; // Disable slider to prevent further interaction or 'fighting' from timeupdate

    // Set the video's current time
    video.currentTime = targetTime;

    // Listen for the 'seeked' event, which fires when the seek operation is complete
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked); // Clean up this specific listener

      seekBar.disabled = false; // Re-enable slider
      isSeekingSlider = false; // Reset slider seeking flag

      // Ensure the time display and slider are perfectly in sync after the actual seek
      seekBar.value = video.currentTime;
      updateTimeDisplay(video.currentTime, video.duration);
      
      if (wasPlayingBeforeSeek) {
        video.play(); // Resume playback if it was playing before the seek
      }
    };

    video.addEventListener('seeked', onSeeked, { once: true });
  };

  // NEW: Function to update video display
  function updateVideoDisplay(newEntry) {
    loadingOverlay.style.display = 'flex';
    video.style.display = 'none';
    
    // Clear previous error message if any
    videoWrapper.querySelectorAll('.image-error-message').forEach(el => el.remove());

    video.src = newEntry.url;
    video.alt = newEntry.name;
    video.load(); // Force load the new video
    
    // Reset playback state for new video
    video.pause();
    seekBar.value = 0;
    updateTimeDisplay(0, 0); // Reset time display immediately
    
    // Reset play/pause button to 'Play' icon
    playPauseBtn.innerHTML = '▶';
    playPauseBtn.setAttribute('aria-label', 'Play');

    // Disable controls while loading new video
    seekBar.disabled = true;
    playPauseBtn.disabled = true;
    rewindBtn.disabled = true;
    forwardBtn.disabled = true;
    prevVideoBtn.disabled = true;
    nextVideoBtn.disabled = true;
    
    // Update window title if window is already open
    if (currentWindowId) {
      const w = windows.get(currentWindowId);
      if (w) {
        w.el.querySelector('.title').textContent = newEntry.name;
        w.taskBtn.textContent = newEntry.name;
      }
    }
  }

  // --- Event Listeners ---
  playPauseBtn.addEventListener('click', togglePlayPause);
  video.addEventListener('click', togglePlayPause); // Click video to play/pause

  rewindBtn.addEventListener('click', () => {
    const newTime = Math.max(0, video.currentTime - 10);
    updateTimeDisplay(newTime, video.duration); // Immediately update display to intended time
    performVideoSeek(newTime);
  });

  forwardBtn.addEventListener('click', () => {
    if (!isNaN(video.duration)) {
      const newTime = Math.min(video.duration, video.currentTime + 10);
      updateTimeDisplay(newTime, video.duration); // Immediately update display to intended time
      performVideoSeek(newTime);
    }
  });

  prevVideoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentIndex > 0) {
      currentIndex--;
      updateVideoDisplay(videoEntries[currentIndex]);
    }
  });

  nextVideoBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentIndex < videoEntries.length - 1) {
      currentIndex++;
      updateVideoDisplay(videoEntries[currentIndex]);
    }
  });

  video.addEventListener('play', () => {
    playPauseBtn.innerHTML = '❚❚';
    playPauseBtn.setAttribute('aria-label', 'Pause');
  });

  video.addEventListener('pause', () => {
    playPauseBtn.innerHTML = '▶';
    playPauseBtn.setAttribute('aria-label', 'Play');
  });

  video.addEventListener('timeupdate', () => {
    // Only update if not currently seeking via slider (user drag) AND if the seek bar is not disabled
    // The seekBar.disabled check is crucial to prevent timeupdate from fighting with an ongoing seek.
    if (!isNaN(video.duration) && !isSeekingSlider && !seekBar.disabled) {
      seekBar.value = video.currentTime;
      updateTimeDisplay(video.currentTime, video.duration);
    }
  });
  
  // Handle seek bar input (user is dragging the slider)
  seekBar.addEventListener('input', (e) => {
    isSeekingSlider = true; // Set flag: user is actively dragging
    const targetTime = parseFloat(e.target.value);
    if (!isNaN(targetTime) && !isNaN(video.duration)) {
      // Visually update the time display for immediate feedback during drag
      updateTimeDisplay(targetTime, video.duration);
      // The seekBar.value is automatically updated by the native range input behavior
    }
  });

  // Handle seek bar change (user releases the slider)
  seekBar.addEventListener('change', (e) => {
    const targetTime = parseFloat(e.target.value);
    performVideoSeek(targetTime); // Now perform the actual video seek
  });

  // --- Volume Controls ---
  const updateVolumeIcon = () => {
    if (video.muted || video.volume === 0) {
      volumeBtn.textContent = 'x';
      volumeBtn.setAttribute('aria-label', 'Unmute');
    } else {
      volumeBtn.textContent = '♪';
      volumeBtn.setAttribute('aria-label', 'Mute');
    }
  };

  volumeBtn.addEventListener('click', () => {
    video.muted = !video.muted;
  });

  volumeBar.addEventListener('input', (e) => {
    video.volume = parseFloat(e.target.value);
    video.muted = video.volume === 0;
  });

  video.addEventListener('volumechange', () => {
    if (!video.muted) {
      volumeBar.value = video.volume;
    }
    updateVolumeIcon();
  });

  video.addEventListener('dblclick', (e) => e.preventDefault());

  currentWindowId = openWindow({
    title: currentEntry.name,
    content: viewerContainer,
    width: 640,
    height: 360,
    x: 140,
    y: 110
  });

  // --- Initial Loading and Error Handling ---
  video.addEventListener('loadedmetadata', () => {
    loadingOverlay.style.display = 'none';
    video.style.display = 'block';

    seekBar.max = video.duration;
    seekBar.disabled = false; // Enable seek bar once metadata is loaded
    playPauseBtn.disabled = false; // Enable play/pause
    rewindBtn.disabled = false; // Enable rewind
    forwardBtn.disabled = false; // Enable forward
    updateTimeDisplay(0, video.duration); // Set initial time display
    updateVolumeIcon(); // Set initial volume icon based on video state

    // Re-enable prev/next buttons based on current index
    prevVideoBtn.disabled = currentIndex === 0;
    nextVideoBtn.disabled = currentIndex === videoEntries.length - 1;
  });

  video.addEventListener('error', (e) => {
    loadingOverlay.style.display = 'none';
    video.style.display = 'none';
    const errorMsg = document.createElement('div');
    errorMsg.textContent = 'Video failed to load.';
    errorMsg.className = 'image-error-message';
    videoWrapper.appendChild(errorMsg);
    const w = windows.get(currentWindowId);
    if (w) {
      const errorTitle = `${currentEntry.name} (Error)`;
      w.el.querySelector('.title').textContent = errorTitle;
      w.taskBtn.textContent = errorTitle;
    }
    // Disable all controls on error
    seekBar.disabled = true;
    playPauseBtn.disabled = true;
    rewindBtn.disabled = true;
    forwardBtn.disabled = true;
    volumeBtn.disabled = true;
    volumeBar.disabled = true;
    prevVideoBtn.disabled = true;
    nextVideoBtn.disabled = true;
  });

  updateVideoDisplay(currentEntry);

  return currentWindowId;
}

function openHtml(entry) {
  const parentPath = entry.path.substring(0, entry.path.lastIndexOf('/')) || '/';
  const parentFolder = FS.get(parentPath);
  // Only consider HTML entries as navigable projects
  const projectEntries = parentFolder.children.filter(ch => ch.type === 'html');
  let currentIndex = projectEntries.findIndex(e => e.path === entry.path);

  const frame = document.createElement('iframe');
  frame.style.width = '100%';
  frame.style.height = '100%';
  frame.style.border = 'none';
  frame.setAttribute('title', entry.name);

  const wrap = document.createElement('div');
  wrap.style.height = '100%';
  wrap.style.display = 'grid';
  wrap.style.gridTemplateRows = '28px 1fr';
  const bar = document.createElement('div');
  bar.className = 'image-viewer-nav'; // Use same class as image viewer for consistent styling
  bar.style.display = 'flex';
  bar.style.gap = '6px';
  bar.style.alignItems = 'center'; // Center items vertically in the bar
  
  const openBtn = document.createElement('button');
  openBtn.textContent = 'Open in new tab';
  openBtn.className = 'open-tab-btn';
  
  const prevBtn = document.createElement('button');
  prevBtn.textContent = 'Previous';
  prevBtn.className = 'prev-btn';

  const nextBtn = document.createElement('button');
  nextBtn.textContent = 'Next';
  nextBtn.className = 'next-btn';

  const titleSpan = document.createElement('span');
  titleSpan.className = 'image-title-nav'; // Use same class for consistent styling
  titleSpan.style.flexGrow = '1';
  titleSpan.style.textAlign = 'center';
  titleSpan.style.fontWeight = 'bold';
  titleSpan.style.fontSize = '16px';
  titleSpan.style.userSelect = 'none';

  bar.appendChild(openBtn);
  bar.appendChild(prevBtn);
  bar.appendChild(titleSpan);
  bar.appendChild(nextBtn);

  wrap.appendChild(bar);
  const frameWrap = document.createElement('div');
  frameWrap.style.overflow = 'hidden';
  frameWrap.appendChild(frame);
  wrap.appendChild(frameWrap);

  const windowId = openWindow({ title: entry.name, content: wrap, width: 800, height: 520, x: 100, y: 70 });
  
  const updateProjectDisplay = (newEntry) => {
    frame.src = newEntry.url;
    titleSpan.textContent = newEntry.name;

    const w = windows.get(windowId);
    if (w) {
        w.el.querySelector('.title').textContent = newEntry.name;
        w.taskBtn.textContent = newEntry.name;
    }

    openBtn.onclick = (e) => {
        e.preventDefault();
        window.open(newEntry.url, '_blank');
    };

    prevBtn.disabled = currentIndex === 0;
    nextBtn.disabled = currentIndex >= projectEntries.length - 1;
  };

  prevBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentIndex > 0) {
      currentIndex--;
      updateProjectDisplay(projectEntries[currentIndex]);
    }
  });

  nextBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (currentIndex < projectEntries.length - 1) {
      currentIndex++;
      updateProjectDisplay(projectEntries[currentIndex]);
    }
  });
  
  updateProjectDisplay(entry); // Initial setup

  return windowId;
}

// NEW: Function to open AI Research in a terminal-like wrapper
function openAiResearchTerminal(entry) {
  // Check if it's already open
  if (document.querySelector('.ai-terminal-wrapper')) {
    document.querySelector('.ai-terminal-wrapper .terminal-input').focus();
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'ai-terminal-wrapper';

  const iframe = document.createElement('iframe');
  iframe.src = entry.url; // entry.url is now a correct relative path
  iframe.style.border = 'none';
  iframe.setAttribute('title', entry.name);
  wrapper.appendChild(iframe);

  const footer = document.createElement('div');
  footer.className = 'terminal-footer';
  footer.innerHTML = `<span class="prompt">C:\\&gt;</span><input type="text" class="terminal-input" value="">`; // Changed value to empty
  wrapper.appendChild(footer);

  const input = footer.querySelector('.terminal-input');
  const defaultPlaceholder = 'Type "exit" or "back"...';
  input.placeholder = defaultPlaceholder; // Set a helpful placeholder

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAiResearchTerminal(wrapper);
      return;
    }
    if (e.key === 'Enter') {
      const command = input.value.trim().toLowerCase();
      if (command === 'exit') {
        closeAiResearchTerminal(wrapper);
      } else if (command === 'back') {
        const iframe = wrapper.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
          iframe.contentWindow.postMessage('back-command', '*');
        }
        input.value = '';
        input.placeholder = defaultPlaceholder;
      } else {
        input.value = '';
        input.placeholder = defaultPlaceholder;
      }
    }
  });

  // NEW: Listen for messages from iframe (for 'back' and 'exit' commands)
  window.addEventListener('message', (event) => {
    if (event.data === 'back-command') {
      const iframe = wrapper.querySelector('iframe');
      if (iframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage('back-command', '*');
      }
    } else if (event.data === 'exit-command') {
      closeAiResearchTerminal(wrapper);
    }
  });

  document.body.appendChild(wrapper);
  document.body.classList.add('ai-terminal-active'); // Add class to body to hide desktop
  
  // Hide mascot and speech bubble + CLEANUP MASCOT
  cleanupMascot(); // Call cleanup when mascot is hidden

  // Focus the input after a short delay to ensure it's rendered
  setTimeout(() => input.focus(), 100);

  // Global Escape listener for the terminal
  window._terminalEscListener = (e) => {
    if (e.key === 'Escape') {
      closeAiResearchTerminal(wrapper);
    }
  };
  window.addEventListener('keydown', window._terminalEscListener);
}

// NEW: Function to close the AI Research terminal
function closeAiResearchTerminal(wrapper) {
  if (wrapper) {
    wrapper.remove();
    document.body.classList.remove('ai-terminal-active'); // Remove class to show desktop
    
    // Restore mascot and speech bubble visibility + RE-INIT MASCOT
    initMascot(); // Re-initialize mascot (which includes adding its click listener and starting hints)

    // Remove global escape listener if it exists
    if (window._terminalEscListener) {
      window.removeEventListener('keydown', window._terminalEscListener);
      delete window._terminalEscListener;
    }
  }
}

function openGilArchive(entry) {
  if (document.querySelector('.gil-archive-wrapper')) return;
  const wrapper = document.createElement('div');
  wrapper.className = 'gil-archive-wrapper';
  const iframe = document.createElement('iframe');
  iframe.src = entry.url;
  iframe.style.border = 'none';
  iframe.setAttribute('title', entry.name);
  wrapper.appendChild(iframe);
  document.body.appendChild(wrapper);
  
  // Transition in
  requestAnimationFrame(() => {
    wrapper.classList.add('active');
  });
}

function closeGilArchive() {
  const wrapper = document.querySelector('.gil-archive-wrapper');
  if (wrapper) {
    wrapper.classList.remove('active');
    wrapper.remove(); // Direct removal for Win95 feel
  }
}

async function openEntry(path) {
  const entry = FS.get(path);
  if (!entry) return;
  let windowId = null;

  // Handle AI_research separately with the terminal wrapper
  const aiNode = FS.findByName('AI_research');
  if (aiNode && entry.path === aiNode.path) {
    openAiResearchTerminal(entry);
    return; // Exit here, don't open as a regular window
  }

  // Handle GIL Archive separately
  const gilNode = FS.findByName('GIL Archive');
  if (gilNode && entry.path === gilNode.path) {
    openGilArchive(entry);
    return;
  }

  if (entry.type === 'folder') windowId = openFolder(path);
  else if (entry.type === 'image') windowId = openImage(entry); // Pass entry directly for consistency
  else if (entry.type === 'video') windowId = openVideo(entry);
  else if (entry.type === 'html') {
    windowId = openHtml(entry);
    // Maximize HTML windows (projects)
    if (windowId) {
      // Defer maximizing slightly to allow the window to render fully first
      setTimeout(() => maximizeWindow(windowId), 50);
    }
  }
  else if (entry.type === 'about') windowId = openAboutMeWindow(entry.name, openWindow); // Handle 'about' type
  else if (entry.type === 'blog') windowId = await openBlogWindow(entry.name, openWindow); // Handle 'blog' type
  else if (entry.type === 'wonderland') {
    windowId = await openWonderlandWindow(entry, openWindow);
  }

  return windowId;
}

// Night Mode & Particles
let nightModeEnabled = false;
let particleInterval = null;

function toggleNightMode() {
    nightModeEnabled = !nightModeEnabled;
    document.body.classList.toggle('night-mode', nightModeEnabled);
    
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.textContent = nightModeEnabled ? 'Lights On' : 'Night Mode';
    }

    if (nightModeEnabled) {
        startParticles();
    } else {
        stopParticles();
    }
}

function startParticles() {
    if (particleInterval) return;
    const container = document.getElementById('particles-container');
    if (!container) return;

    particleInterval = setInterval(() => {
        if (!nightModeEnabled) return;
        createEmber(container);
    }, 400);
}

function stopParticles() {
    if (particleInterval) {
        clearInterval(particleInterval);
        particleInterval = null;
    }
    const container = document.getElementById('particles-container');
    if (container) container.innerHTML = '';
}

function createEmber(container) {
    const ember = document.createElement('div');
    ember.className = 'ember';
    
    const startX = Math.random() * 100;
    const drift = (Math.random() - 0.5) * 300;
    const duration = 4 + Math.random() * 4;
    
    ember.style.left = startX + 'vw';
    ember.style.bottom = '-10px';
    ember.style.setProperty('--drift', drift + 'px');
    ember.style.setProperty('--duration', duration + 's');
    
    container.appendChild(ember);
    setTimeout(() => ember.remove(), duration * 1000);
}

// NEW: Preloading and Initialization logic
async function startPreloading() {
    const preloadLinks = [...document.querySelectorAll('link[rel="preload"][as="image"]')];
    const totalAssets = preloadLinks.length;

    for (let i = 0; i < totalAssets; i++) {
        const link = preloadLinks[i];
        const url = link.href;
        
        const fileName = url.split('/').pop();
        loadingFile.textContent = `Loading: ${fileName}...`;
        
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = url;
            });
        } catch (error) {
            console.warn(`Could not preload asset: ${url}`);
            // Still count it as "loaded" to not hang the progress bar
        }

        const percent = ((i + 1) / totalAssets) * 100;
        loadingProgress.style.width = `${percent}%`;
    }
    
    loadingFile.textContent = 'Starting Portfolio 95...';
    
    // A small delay to show the final message, then hide immediately
    setTimeout(() => {
        loadingScreen.style.display = 'none'; // Hide the loading screen directly
        
        // Initialize the main app now that assets are cached
        initializeApp();
    }, 500);
}

function initializeApp() {
    // Listen for messages from full-screen components
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'close-archive') {
            closeGilArchive();
        }
    });

    // Re-get elements inside initializeApp to ensure they are available
    // This addresses potential timing issues where 'const' global variables might not be fully linked
    // to the DOM elements if they are created dynamically or the script loads too early.
    // For module scripts at the end of <body>, this is often unnecessary, but provides extra robustness.
    startBtn = document.getElementById('start-button');
    startMenu = document.getElementById('start-menu');
    const themeToggle = document.getElementById('theme-toggle');

    // Attach event listeners
    nowClock();
    setInterval(nowClock, 15000);
    startBtn.addEventListener('click', () => toggleStart());
    
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            toggleNightMode();
            toggleStart(false);
        });
    }
    document.addEventListener('click', (e) => {
      if (!startMenu.contains(e.target) && e.target !== startBtn) {
        startMenu.setAttribute('aria-hidden', 'true');
        startBtn.setAttribute('aria-expanded', 'false');
      }
    });
    startMenu.addEventListener('click', (e) => {
      const btn = e.target.closest('.start-item');
      if (!btn) return;

      if (btn.id === 'theme-toggle') return; // Handled by separate listener

      e.preventDefault(); // Prevent text selection on click
      const name = btn.dataset.open;
      // Use openEntry for all start menu items, including 'About Me'
      const node = FS.findByName(name);
      if (node) openEntry(node.path);
      toggleStart(false);
    });

    // Render UI
    renderDesktop();

    // Add stickers
    addSticker({
      title:'RTS Game',
      note:'Real-time strategy game demo',
      path:'/Projects/RTS Game',
      x_percent: 30,
      y_percent: 15,
      imageUrl: 'Content/Projects/RTS_Game/RTS_thumbnail.jpg', // Corrected path
      stickerWidth: 200, // Adjusted to match default sticker size
      thumbnailMaxHeight: 120, // Adjusted to match default sticker size
      stickerType: 'rts-game-sticker'
    });
    addSticker({ 
      title:'Concept Art Collage', 
      note:'Zoomable artwork of many pieces', 
      path:'/Pictures/Concept Art Collage', 
      x_percent: 25,
      y_percent: 45,
      imageUrl: 'Content/Images/image-board-export-1756292941378.png', // Corrected path
      stickerWidth: 300,
      thumbnailMaxHeight: 180
    });
    addSticker({
      title: 'Unsubscribed Trailer',
      note: 'Youtube trailer from 12 years ago.',
      path: '/Videos/Unsubscribed Trailer',
      x_percent: 65,
      y_percent: 20,
      imageUrl: 'Content/Videos/Unsubscribe_Trailer_thumbnail.jpg', // Corrected path
      stickerType: 'video-sticker'
    });
    
    // Init mascot
    initMascot();

    // Preload blog posts to update mascot hints with latest italicized phrases
    preloadBlogPosts();

    // Automatically open Blog on load
    const blogNode = FS.findByName('Blog');
    if (blogNode) {
      // Small delay to ensure everything is ready
      setTimeout(() => openEntry(blogNode.path), 1000);
    }
}

// NEW: Function to add stickers
function addSticker({ title, note, path, x_percent, y_percent, imageUrl, stickerWidth = 200, thumbnailMaxHeight = null, stickerType = 'default', rotation = null }) {
  const el = document.createElement('div');
  el.className = `sticker ${stickerType}`; // Apply the stickerType as a class
  // Set initial position using percentages, makeDraggable will then use current pixel position
  el.style.left = x_percent + '%';
  el.style.top = y_percent + '%';
  el.style.width = stickerWidth + 'px'; // Apply the custom width

  let content = '';
  if (imageUrl) {
    content += `<img src="${imageUrl}" alt="${title} thumbnail" class="sticker-thumbnail">`;
  }
  content += `<div class="title">⭐ ${title}</div><div>${note}</div><button class="open">Open</button>`;
  el.innerHTML = content;
  
  desktop.appendChild(el); // Append first to ensure offsetWidth/Height are available for makeDraggable

  // Apply custom thumbnailMaxHeight if provided
  if (imageUrl && thumbnailMaxHeight !== null) {
      const thumbnailEl = el.querySelector('.sticker-thumbnail');
      if (thumbnailEl) {
          thumbnailEl.style.maxHeight = `${thumbnailMaxHeight}px`;
      }
  }

  // Make the entire sticker draggable. No specific single-click action for the drag handler.
  makeDraggable(el, el);

  el.addEventListener('dblclick', (e) => {
    e.preventDefault(); // Prevent text selection on double-click
    openEntry(path)
  });
  el.querySelector('.open').addEventListener('click', (e) => {
    e.preventDefault(); // Prevent text selection on button click
    openEntry(path)
  });
  el.tabIndex = 0;
  el.addEventListener('keydown', (e)=>{ if(e.key==='Enter') openEntry(path); });
}

// Kick off the process
startPreloading();
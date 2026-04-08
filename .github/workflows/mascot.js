// Module-scoped variables
let hintTimer = null;
let currentHintIndex = -1;
let isFastMascotAnimating = false;
let mascotImgElement = null;
let speechBubbleElement = null;

const hints = [
    "Welcome to the Portfolio 95 Desktop! Double-click icons to open them.",
    "Need help? Try checking the 'About Me' section for more info!",
    "Don't forget to explore 'Pictures', 'Videos', and 'Projects' for my work.",
    "The 'Image Board' project is interactive, give it a try!",
    "You can drag and resize windows just like in Windows 95.",
    "Minimize windows to the taskbar if your desktop gets too cluttered.",
    "The 'Concept Art Collage' in Pictures can be zoomed and panned!",
    "Click the 'Start' button for more options, or to access all folders.",
    "Did you know you can customize desktop icons by dragging them?",
    "Look at the clock, it's always running on Win95 time!",
    "I'm here to help you navigate this retro experience!"
];

// Preload the fast mascot GIF
const fastMascotPreload = new Image();
fastMascotPreload.src = './gif/fast_maskot.gif';

// Define functions in module scope
function showRandomHint() {
    if (!mascotImgElement || !speechBubbleElement || hints.length === 0 || isFastMascotAnimating) return;

    let nextHintIndex;
    do {
        nextHintIndex = Math.floor(Math.random() * hints.length);
    } while (nextHintIndex === currentHintIndex && hints.length > 1);

    currentHintIndex = nextHintIndex;
    speechBubbleElement.textContent = hints[currentHintIndex];
    speechBubbleElement.style.opacity = '1';

    clearTimeout(hintTimer);
    hintTimer = setTimeout(hideSpeechBubble, 8000);
}

function hideSpeechBubble() {
    if (!mascotImgElement || !speechBubbleElement || isFastMascotAnimating) return;

    speechBubbleElement.style.opacity = '0';
    clearTimeout(hintTimer);
    hintTimer = setTimeout(showRandomHint, 5000);
}

function handleMascotClick() {
    if (!mascotImgElement || !speechBubbleElement || isFastMascotAnimating) return;

    isFastMascotAnimating = true;
    clearTimeout(hintTimer);
    speechBubbleElement.style.opacity = '0';

    mascotImgElement.src = fastMascotPreload.src;

    setTimeout(() => {
        mascotImgElement.src = './gif/normal_maskot.gif';
        isFastMascotAnimating = false;
        clearTimeout(hintTimer);
        hintTimer = setTimeout(showRandomHint, 1000);
    }, 750);
}

export function initMascot() {
    mascotImgElement = document.getElementById('mascot-gif');
    speechBubbleElement = document.getElementById('speech-bubble');

    if (!mascotImgElement || !speechBubbleElement) {
        console.error('Mascot or speech bubble element not found!');
        return;
    }

    // Ensure state is clean before re-initialization
    cleanupMascot(); // Clears old listeners/timers if any

    mascotImgElement.addEventListener('click', handleMascotClick);
    mascotImgElement.style.display = 'block'; // Ensure mascot is visible if init is called
    setTimeout(showRandomHint, 2000);
}

export function cleanupMascot() {
    if (hintTimer) {
        clearTimeout(hintTimer);
        hintTimer = null;
    }

    if (mascotImgElement) {
        mascotImgElement.removeEventListener('click', handleMascotClick);
        mascotImgElement.src = './gif/normal_maskot.gif'; // Reset to normal gif
        mascotImgElement.style.display = 'none'; // Hide it if cleanup is specifically for hiding
    }
    if (speechBubbleElement) {
        speechBubbleElement.style.opacity = '0';
    }
    isFastMascotAnimating = false;
    currentHintIndex = -1;
}
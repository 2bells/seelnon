// Module-scoped variables
let hintTimer = null;
let currentHintIndex = -1;
let isFastMascotAnimating = false;
let mascotImgElement = null;
let speechBubbleElement = null;
let dynamicHints = [];

const staticHints = [
    "Welcome! Double-click icons to open them. It is Windows after all.",
    "Check my Art, Videos, Blog, I did a lot of stuff in my days.",
    "Blog is a fun place, trust",
    "About Me section is here to give you more insight into.. me",
    "Wonderlands suppose to be about Miliastra in Genshin",
    "Some 'me' things are too hard to explain, just judge me",
];

// Preload the fast mascot GIF
const fastMascotPreload = new Image();
fastMascotPreload.src = './gif/fast_maskot.gif';

export function setDynamicHints(newHints) {
    dynamicHints = newHints;
}

// Define functions in module scope
function showRandomHint() {
    const allHints = [...staticHints, ...dynamicHints];
    if (!mascotImgElement || !speechBubbleElement || allHints.length === 0 || isFastMascotAnimating) return;

    let nextHintIndex;
    do {
        nextHintIndex = Math.floor(Math.random() * allHints.length);
    } while (nextHintIndex === currentHintIndex && allHints.length > 1);

    currentHintIndex = nextHintIndex;
    speechBubbleElement.textContent = allHints[currentHintIndex];
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

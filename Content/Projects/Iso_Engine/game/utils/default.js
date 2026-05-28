// Utility Functions

console.log("rpg/game/utils/default.js loaded");

export function someUtilityFunction() {
    console.log("Utility function called");
    return true;
}

// Example: Debounce function
export function debounce(func, wait, immediate) {
    let timeout;
    return function() {
        const context = this, args = arguments;
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
}


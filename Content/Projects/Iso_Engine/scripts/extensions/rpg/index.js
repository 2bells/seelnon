export { MODULE_NAME, openMain };

const MODULE_NAME = 'rpg';

async function openMain() {
   console.log("Attempting to load and initialize game from rpg/game/main.js");
   try {
       const gameModule = await import('./game/main.js');
       if (gameModule && typeof gameModule.initGameView === 'function') {
           gameModule.initGameView();
       } else {
           console.error("Failed to load game module or initGameView function is missing from game/main.js.");
           alert("Error: Could not initialize the game. Main module structure incorrect.");
       }
   } catch (error) {
       console.error("Error loading or initializing game/main.js:", error);
       alert(`Error: Could not load game/main.js. ${error.message}`);
   }
}

function addRPGButton() {
    const buttonHtml = `
    <div id="game" class="list-group-item flex-container flexGap5">
        <div class="fa-solid fa-dice extensionsMenuExtensionButton" title="RPG" /></div>
        RPG
    </div>
        `;

    const getWandContainer = () => $(document.getElementById('dice_wand_container') ?? document.getElementById('extensionsMenu'));
    getWandContainer().append(buttonHtml);

    $('#game').on('click', function () {
        openMain();
    });
    const button = $('#game');

}

jQuery(function () {
    addRPGButton();
});
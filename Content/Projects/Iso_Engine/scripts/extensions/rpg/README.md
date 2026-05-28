# Extension-Custom-RPG-for-AI-Silly Tavern

# [working on it]  it suppose to open a new window with interactive canvas that has isometric game in an MMORPG style

# [done] we need to make a mock setup to press a button, that triggers the function to 'open canvas', right now this function just says 'hello from main.js' even though it's not connected to main.js

# [working on it] so we have to create main canvas, isometric stuff/tavern, NPC to talk to who has a dialogue box and 

# [done] imports that we will need to have: 
import { nai_settings, getNovelGenerationData, generateNovelWithStreaming } from '../../../nai-settings.js'; // For AI generation

# [done] function to use to request AI in production:
async function fetchNovelAIMapSuggestions() {
    const controller = new AbortController();
    const signal = controller.signal;
    const fullPrompt = `string of the prompt`;
    const generationParams = { ...nai_settings }; 
    const maxLength = 400; 

    let requestData = getNovelGenerationData(
        fullPrompt,
        generationParams,
        maxLength,
        false, false, undefined, 'string'
    );

    requestData.temperature = Math.max(0.7, Math.min(1.5, (nai_settings.temperature || 1.0) * 0.9 + 0.2));
    requestData.generate_until_sentence = true; 
    // Ensure common end-of-generation tokens are not stopping output prematurely for text.
    // The default stop sequences from getNovelGenerationData should be generally fine for text.
    // If Llama3 models specifically have issues, one might filter their specific EOT tokens if too aggressive.
    // requestData.stop_sequences = requestData.stop_sequences.filter(seq => !seq.includes(128009)); // Example for Llama3 EOT

    let accumulatedText = "";
    let aiOutput = "";

    try {
        const streamGeneratorFunction = await generateNovelWithStreaming(requestData, signal);
        const streamIterator = streamGeneratorFunction(); 
        for await (const chunk of streamIterator) { 
            accumulatedText = chunk.text; 
            if (signal.aborted) {
                // Stop accumulating and exit loop if aborted
                // The error will be caught below
                throw new Error("AI map suggestion generation aborted by user.");
            }
        }
        aiOutput = accumulatedText.trim();
        lastAISuggestionsText = aiOutput || "The AI didn't offer any suggestions this time.";


    } catch (error) {
        if (error.name === 'AbortError' || (error.message && error.message.includes("aborted by user"))) {
             if (window.toastr) window.toastr.warning('AI map suggestion generation cancelled.', 'AI Suggestions');
             lastAISuggestionsText = "Suggestion generation cancelled.";
        } else {
            console.error("Error during streaming map suggestions:", error);
            if (window.toastr) window.toastr.error(`Streaming API Error: ${error.message || 'Unknown error'}`, 'AI Error');
            lastAISuggestionsText = `Error: Streaming API Error - ${error.message || 'Unknown error'}`;
        }
        // No need to throw again, just update lastAISuggestionsText
        // The calling function will use lastAISuggestionsText to update the display
        return lastAISuggestionsText; 
    }
    
    console.log("Raw AI Output for Map Suggestions:\n", aiOutput);
    return lastAISuggestionsText; // Return the plain text suggestions
}

# [working on this step] we will have to design a mock way to request ai generation, so it's hooked to the NAI of Silly Tavern

# [chill later step] After that we will design a simple MMO like that has an area to kill enemies, earn XP. Sell loot, level up, talk to NPCs and have a tavern that has random characters appearing (will design it later)

# [done, being worked on] we will need a roadmap.txt
# [done, being worked on] we will need a proper file structure to handle future stuff

# Let's not touch much inside of index.js, it's just our way into the interactive window.

# also I have this, what we will be needing later: 

import { getRequestHeaders, getCharacters } from '../../../../script.js';
//this gives a list of characters, but idk... seems a bit hard to implement

export function getRequestHeaders() {
    return {
        'Content-Type': 'application/json',
        'X-CSRF-Token': token,
    };
}

export async function getCharacters() {
    const response = await fetch('/api/characters/all', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            '': '',
        }),
    });
    if (response.ok === true) {
        characters.splice(0, characters.length);
        const getData = await response.json();
        for (let i = 0; i < getData.length; i++) {
            characters[i] = getData[i];
            characters[i]['name'] = DOMPurify.sanitize(characters[i]['name']);

            // For dropped-in cards
            if (!characters[i]['chat']) {
                characters[i]['chat'] = `${characters[i]['name']} - ${humanizedDateTime()}`;
            }

            characters[i]['chat'] = String(characters[i]['chat']);
        }
        if (this_chid !== undefined) {
            $('#avatar_url_pole').val(characters[this_chid].avatar);
        }

        await getGroups();
        await printCharacters(true);
    }
}

Those are referencing all .png files in the folder, and those .png files include 'character cards' with personality, description and so on. I put a "Test Chara.png" as a representation of what it looks like

# there is also settings.json that are a small version of what is present within Silly Tavern

# Map and locations: so we will need a world map that is a 'metamap' meaning it's an overview map with player being able to travel around and then interact with some of the points of interests, loading into smaller maps;

# We will need to plan for dungeon map (procedurally generated with monsters) and a few hand crafterd ones for Tavern, Church, Town Square... (we may try to design 1 big map with everything in it, but it might be difficult)

# [done but needs refinement] Because hand crafting maps is better by actually interacting with tiles... we should create a map editor: it will work independatly of a game and will produce .json files that are then used to understand placemet on tiles, collisions, npcs, enemies; For that we will need to create an overview of sprite sheet, ability to pick a tile based on 64x64 grid, then place the tile on the empty map one by one and be able to visually desing the outline; then on top there will be 'object layer' for placing something like trees and tables (we might need to have a few of those, so for example a table placed on the floor tile and then a cup is placed on a table... something like 5 should be enough); then there should be collision layer, that is designed on top, we can use verticies and polygons to design those, so it's easier to do, than to create collision boxes, so collison layer is drawn by user; then tiles could be set to 'npc' spawn and 'enemy' spawn to mark important tiles;

# [chill] in the future we might introduce 'event' layer to the editor that will have tiles that are marked for 'event trigger' and when user interact with those tiles (walk on them, interact with a button), something will happen that will transition map into a different state (like a trap design or enemy spawns)

# [chill] additional general ideas: lighting system that is shader based, so we manipulate 'dark'/'light'.. maybe with basic opacity and color corection systems; not sure about 'add'/'screen'/'multiply' and how those will work out, but I think de-saturation effects could be great;

# [chill] with lighting system it should be possible to put area lights/outdoor lights/torches/point lights and maybe some 'shadowcast' things that could be extracted to emulate 3d... but not too sure;

# [secondary] then for quests and how AI should interact with player: I think it should be a prompt based structure that is affected by scripts, for example Rappor system that sends a different prompt to the AI telling that 'hey, you don't like this guy at all' to then 'hey, this guy is your ride-or-die guy'... And quests, I think it could be an editor for quest sytem as well to allow people to design things... it would be cool to see AI desing quests, but for example NovelAI can't output JSON, so... that makes it not viable for NAI implementation

# [secondary] NAI is really good at stories, so those should be the ones that are pushed as a quest; I'm thinking of 'class' naming to be a direction for quests, so when AI talks about a mage, we can mark a mage as a quest character... so there will be like 'warrior','ranger','mage' and by implying those in a story, we can track those 'class-names' and maybe hook a quest to represent it.. (but that in the very future)

# [done, but needs refinement] exiting, entering maps should be a thing as well... so there will be an interactive point that 'exit-to' and then a map is selected; and 'enter-to' an another map is selected; so we can build the world and progress it;

# [chill] fighting: I'm thinking for a queue based system when player has skills in the 'skill inventory' and chooses to put some of them into the queue, and with that player fights, so... somewhat idle, but with ability to swap skills in and out and also have rotations to be auto rotations instead of a need to press buttons; then skills can have their own leveling and dependencies on other skills; so let's say I have 'slash','pound','blast', I put them into the queue and my character all the time will use those 3 one after another when fighting... I'm kind of thinking Blue Mage from Final Fantasy 14, but like a base, that player can steal skills from enemies and then use them and depending on the class, different skills will be better, but everything is allowed will be a motto. So every attack of every monster/NPC suppose to be a skill and it could be 'learned'/'stolen' by chance... so we will have some fun 'pokemon' hunting idea, but will be hunting 'skills' instead with chance to get a shiny skill...

# [chill] Event system: I think we will need to create a new menu, similar to map_editor, but event_editor... in the map editor we will need to add ability to name 'event coordinates'

# [urgent] For map editor we still need to be able to upload own sprite sheets and bake them into a .json file later, so player can load the whole map with its own unique spites (maybe a bad solution as if... there many maps using same sprite sheet, then its better to have them as stand alone files, but the one we are using is 71.2 KB, so... having it baked into an .json not that big of a deal) also those sprite sheets should be manageable even if they are not of the same size, we just need to make sure that those are 64x64 sprites + 2px padding and those could be as large as they need to be, or as small;

# [important] NPC spawning: if there is an 'npc type' spawn present: during loading of a map a character is picked that will be an interactive NPC

# [important after spawn solved] NPC chatting: left showing a character sprite (will upload) that is animated with position as it talks (AI chats) and scale animated when is requested, maybe an icons for 'thinking' when chat request is sent to AI... so a dialogue box, ability to chat;

# [important after dialogue box] Full integration with NAI: sending a fullPrompt with additional game related information (with planning ahead to inject different prompt pieces with rapport, quests, locations, environment status, inventory, equipment, etc) and recieving a streaming data that shows text as it is generated; chatlog that is being 'resent' to the NAI to have a long talk with an NPC; (that will conclude main functionality of making silly tavern interacive experience)

# [ character creator ] : pretty much like a map creation, but for NPCs... right now we have a 'random' spawn for different characters, but I also want to have very defined NPCs that could be hand crafted for specific environment/function/event;

# change of plans to set characters... let's create .js that will have all data about character cards that we can take from... Pretty much just an array of available characters and we call them by name... right now we have only Test Chara.png, but I want to have a file to update and include more;


BUGS [urgent].....

- right now nothing of note, besides player being placed into their spawn point a bit too late, I would like it to be the first thing to happen, and then we try to get npc to work;
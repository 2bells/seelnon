export default {
    id: 'sample_node',
    initialX: 70,
    initialY: 12,
    parentId: 'rl_intro', // Connects to Awareness node
    title: '[AI] Artificial imagination',
    content: `> modular_imagination.exe
> Loading external research data...
> 
-----
// [LOG] MOD-001 - Modular Imagination
// [STATUS] OPERATIONAL
// [DATE] 2026-04-21
// [AUTHOR] SEELNON
-----
[SYSTEM] Creation of imagery from text output.
[PROCESS] 
-Analysing a sentence and isolating nouns that could be represented as images (ex. turtle, pie, purple tree, sky)
-Creating SVG graphics for isolated nouns using only language model and math. (asking a blind person to paint)
-Using VLM to describe those SVG Images to itself, to store information in a abstract way.
-Viewing those SVG graphics + descriptions on the next pass with ability to extract information.
-Idea is similar to encoding and decoding with purposefully loosing/gaining information. (almost forcing hallusinations, but in a controlled environment)
--
***
[FEATURE] 
-Ability to store multiple SVG images, similar to an inventory system.
-Ability to place images on a table in a logical format, similar to minecraft crafting table. (ex. sky, sky, sky -> null, turtle, null -> purple tree, pie, purple tree)
-Ability to analyze new combination, creating new type of output. (turtle sitting on a pie in a purple forest.)
-Work similar to constraction of Chinese character by utilising structures.
--
[SUMMARY] This should simulate abstract thinking.
'Non-concrete'/fluid data of an icon type image + connected descriptions of those images should provide new outputs that are more likely to reseble a dream/imagination.
--
***
[ISSUE] Artificial models get lost inside of their latent spaces already, providing more complexity might get them even more confused.
[POSSIBLE BENEFIT] Providing a secondary navigation system could allow algorithms to triangulate information better.
-----
> echo "Modular system verified."
`
};

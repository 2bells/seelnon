// rpg/game/utils/char_card_importer.js
console.log("rpg/game/utils/char_card_importer.js loaded");

/**
 * Fetches a PNG image and extracts character data from its 'tEXt' chunk.
 * This is a common method for storing character metadata in SillyTavern/TavernAI.
 * The data is expected to be in a chunk with the keyword 'chara', with the value
 * being a Base64-encoded JSON string.
 * @param {string} imageUrl The URL of the character card PNG.
 * @returns {Promise<object|null>} A promise that resolves to the parsed character data object, or null if not found or on error.
 */
export async function extractCharacterDataFromPng(imageUrl) {
    try {
        const response = await fetch(imageUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const buffer = await response.arrayBuffer();
        const view = new DataView(buffer);

        // Check for PNG signature: 89 50 4E 47 0D 0A 1A 0A
        if (view.getUint32(0, false) !== 0x89504E47 || view.getUint32(4, false) !== 0x0D0A1A0A) {
            console.error("Not a valid PNG file signature:", imageUrl);
            return null;
        }

        let offset = 8; // Start after the 8-byte signature
        while (offset < buffer.byteLength) {
            const length = view.getUint32(offset, false); // Chunk data length
            offset += 4;
            const typeCode = view.getUint32(offset, false);
            const type = String.fromCharCode((typeCode >> 24) & 0xFF, (typeCode >> 16) & 0xFF, (typeCode >> 8) & 0xFF, typeCode & 0xFF);
            offset += 4;

            if (type === 'tEXt') {
                const textDecoder = new TextDecoder('latin1');
                const chunkData = new Uint8Array(buffer, offset, length);
                const keywordAndText = textDecoder.decode(chunkData).split('\0');
                
                if (keywordAndText[0] === 'chara') {
                    try {
                        const base64Data = keywordAndText[1];
                        // The base64 data contains a UTF-8 encoded JSON string.
                        // Standard atob can corrupt multi-byte characters.
                        // We must decode from base64 to bytes, then decode the bytes as UTF-8.
                        const binaryString = atob(base64Data);
                        const bytes = Uint8Array.from(binaryString, c => c.charCodeAt(0));
                        const decodedJson = new TextDecoder('utf-8').decode(bytes);
                        return JSON.parse(decodedJson);
                    } catch (e) {
                        console.error("Error parsing character data from tEXt chunk:", e);
                        // Continue searching in case of other tEXt chunks
                    }
                }
            }
            
            if (type === 'IEND') {
                break; // End of image chunks
            }

            offset += length + 4; // Skip chunk data and the 4-byte CRC
        }
        
        console.warn(`No 'chara' tEXt chunk found in ${imageUrl}`);
        return null; // No character data chunk found
    } catch (error) {
        console.error(`Failed to fetch or process PNG from ${imageUrl}:`, error);
        return null;
    }
}
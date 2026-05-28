// Adapter for NovelAI integration, based on README notes

console.log("rpg/game/ai/novelai_adapter.js loaded");

// These would ideally be imported if SillyTavern makes them available globally
// or through a module system accessible to extensions.
// For now, we assume they might need to be adapted or referenced carefully.
// import { nai_settings, getNovelGenerationData, generateNovelWithStreaming } from '../../../../nai-settings.js';

// Placeholder for the actual functions if they cannot be directly imported
// In a real scenario, these would need to be accessible.
const nai_settings_mock = { temperature: 0.8, /* other settings */ };
const getNovelGenerationData_mock = (prompt, params, maxLength, ...args) => ({
    prompt, ...params, maxLength, /* other structure based on actual function */
});

// Mock streaming function that yields the full accumulated text, like the real API
const generateNovelWithStreaming_mock = async (requestData, signal) => {
    async function* streamGenerator() {
        console.log("Mock AI Stream: Processing request for:", requestData.prompt);
        let fullResponse = "I'm not sure what to say about that.";
        const lowerCasePrompt = requestData.prompt.toLowerCase();
        
        if (lowerCasePrompt.includes('hello') || lowerCasePrompt.includes('greetings')) {
            fullResponse = "Ah, greetings traveler! How can I help you on this fine day?";
        } else if (lowerCasePrompt.includes('quest')) {
            fullResponse = "A quest, you say? I might have heard whispers of something... a strange beast lurking in the nearby caves. They say it guards a rare treasure!";
        } else if (lowerCasePrompt.includes('interject')) {
            fullResponse = "If I may add, the treasure is said to glow with an otherworldly light!";
        } else if (lowerCasePrompt.includes('character description:')) {
            fullResponse = "You're asking about me? Well, I suppose I can tell you a little bit about myself...";
        } else if (lowerCasePrompt.includes('who are you')) {
             fullResponse = "Me? I'm just a humble resident of this town. I've seen many adventurers come and go.";
        } else if (lowerCasePrompt.includes('bye')) {
             fullResponse = "Farewell, adventurer! May your path be safe.";
        }

        const words = fullResponse.split(/(\s+)/); // Split by space, keeping spaces
        let currentText = "";
        for (const word of words) {
            await new Promise(resolve => setTimeout(resolve, 60)); // Simulate delay
            if (signal.aborted) throw new Error("AI generation aborted by user.");
            currentText += word;
            yield { text: currentText }; // Yield the full accumulated text
        }
    }
    return streamGenerator;
};


export async function fetchAIResponse(promptContent, onStream) {
    // Check if actual SillyTavern NAI functions are available
    // This is a conceptual check; actual implementation would depend on ST's environment
    const useActualNAI = typeof generateNovelWithStreaming !== 'undefined' &&
                         typeof getNovelGenerationData !== 'undefined' &&
                         typeof nai_settings !== 'undefined';

    const current_nai_settings = useActualNAI ? nai_settings : nai_settings_mock;
    const current_getNovelGenerationData = useActualNAI ? getNovelGenerationData : getNovelGenerationData_mock;
    const current_generateNovelWithStreaming = useActualNAI ? generateNovelWithStreaming : generateNovelWithStreaming_mock;


    const controller = new AbortController();
    const signal = controller.signal;
    const fullPrompt = promptContent; // `string of the prompt`
    const generationParams = { ...current_nai_settings };
    const maxLength = 150; // Shorter for dialogue perhaps

    let requestData = current_getNovelGenerationData(
        fullPrompt,
        generationParams,
        maxLength,
        false, false, undefined, 'string' // Assuming these are typical params
    );

    // Adjustments from README
    requestData.temperature = Math.max(0.7, Math.min(1.5, (current_nai_settings.temperature || 1.0) * 0.9 + 0.2));
    requestData.generate_until_sentence = true;

    let accumulatedText = "";
    let aiOutput = "";

    try {
        console.log("Requesting AI response for:", fullPrompt);
        const streamGeneratorFunction = await current_generateNovelWithStreaming(requestData, signal);
        const streamIterator = streamGeneratorFunction();
        for await (const chunk of streamIterator) {
            accumulatedText = chunk.text; // full text from stream so far

            const newlineIndex = accumulatedText.indexOf('\n');
            let textToSend = accumulatedText;
            let shouldStop = false;

            if (newlineIndex !== -1) {
                // Found a newline. Stop streaming.
                textToSend = accumulatedText.substring(0, newlineIndex).trim();
                shouldStop = true;
            }

            if (onStream && typeof onStream === 'function') {
                // Update the UI with the current text (truncated if newline found)
                onStream(textToSend);
            }
            
            aiOutput = textToSend; // Keep updating aiOutput with the latest text.

            if (shouldStop) {
                controller.abort(); // Tell the underlying fetch to stop.
                break; // Exit the stream loop.
            }

            // This check is already inside the stream library, but having it here handles external cancellations faster.
            if (signal.aborted) {
                throw new Error("AI generation aborted by user.");
            }
        }
        
        // Final trim in case the loop completes without finding a newline
        aiOutput = aiOutput.trim(); 
        console.log("Raw AI Output (after potential truncation):", aiOutput);

    } catch (error) {
        if (error.name === 'AbortError' || (error.message && error.message.includes("aborted by user"))) {
             // If aiOutput has content, it means we aborted intentionally. Otherwise it was cancelled externally.
             if (!aiOutput) {
                console.warn('AI generation cancelled.');
                aiOutput = "AI generation cancelled.";
             } else {
                console.log('AI stream stopped intentionally at newline.');
             }
        } else {
            console.error("Error during AI streaming:", error);
            // Rethrow other errors to be caught by the UI layer
            throw error;
        }
    }
    
    return aiOutput || "The AI didn't provide a response this time.";
}

// Example usage (can be tested from browser console if this module is loaded)
// import { fetchAIResponse } from './game/ai/novelai_adapter.js';
// fetchAIResponse("Tell me a short story about a brave squirrel.").then(console.log);
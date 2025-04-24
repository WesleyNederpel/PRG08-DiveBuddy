// Global state
let messages = [];
let isProcessing = false;

// Local storage functions
function saveChatToLocalStorage() {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
}

function loadChatFromLocalStorage() {
    const savedChats = JSON.parse(localStorage.getItem("chatHistory")) || [];
    messages = savedChats;

    savedChats.forEach(chat => {
        displayMessage(chat.content, chat.role);
    });
}

// UI functions
function displayMessage(content, role = "human") {
    const chatContainer = document.getElementById("chatContainer");

    const messageDiv = document.createElement("div");
    messageDiv.className = `flex ${
        role === "ai" ? "justify-start" : "justify-end"
    }`;

    const bubble = document.createElement("div");
    bubble.className = `px-4 py-2 rounded-lg max-w-xs text-sm ${
        role === "ai"
            ? "bg-cyan-700 text-white text-left"
            : "bg-cyan-500 text-white text-right"
    }`;
    bubble.innerText = content;

    messageDiv.appendChild(bubble);
    chatContainer.appendChild(messageDiv);
    
    // Auto-scroll to latest message
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return bubble;
}

function scrollToBottom() {
    const chatContainer = document.getElementById("chatContainer");
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

// API interaction functions
async function handlePromptSubmission() {
    if (isProcessing) {
        alert("Please wait for the AI to finish responding.");
        return;
    }

    const promptInput = document.getElementById("promptInput");
    const promptValue = promptInput.value.trim();

    if (!promptValue) {
        alert("Please enter a valid question.");
        return;
    }

    // Lock the UI during processing
    isProcessing = true;
    promptInput.disabled = true;
    document.getElementById("promptBtn").disabled = true;

    // Add user message to chat
    messages.push({ role: "human", content: promptValue });
    displayMessage(promptValue, "human");

    // Create placeholder for AI response
    const aiBubble = displayMessage("", "ai");
    
    // Clear input field
    promptInput.value = "";

    try {
        // Send request to the server
        const response = await fetch("http://localhost:3000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: promptValue,
                chatHistory: messages
            }),
        });

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let responseContent = "";

        while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            responseContent += decoder.decode(value, { stream: true });
            aiBubble.innerText = responseContent;
            scrollToBottom();
        }

        // Save the complete conversation
        messages.push({ role: "ai", content: responseContent });
        saveChatToLocalStorage();
    } catch (err) {
        console.error("Error:", err);
        aiBubble.innerText = "Blub... Something went wrong.";
    } finally {
        // Unlock the UI
        isProcessing = false;
        promptInput.disabled = false;
        document.getElementById("promptBtn").disabled = false;
    }
}

async function fetchJoke() {
    if (isProcessing) {
        alert("Please wait for the current response to finish.");
        return;
    }
    
    isProcessing = true;
    
    try {
        const jokeBubble = displayMessage("Thinking of a funny joke...", "ai");
        
        const response = await fetch("http://localhost:3000/");
        const data = await response.json();
        
        jokeBubble.innerText = data.message;
        
        messages.push({ role: "ai", content: data.message });
        saveChatToLocalStorage();
    } catch (err) {
        console.error("Error fetching joke:", err);
        displayMessage("Sorry, I couldn't think of a joke right now.", "ai");
    } finally {
        isProcessing = false;
    }
}

// Water data is now automatically fetched when relevant to the query

function resetChatHistory() {
    if (isProcessing) {
        alert("Please wait for the current response to finish before resetting.");
        return;
    }

    messages = [];
    localStorage.removeItem("chatHistory");

    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
}

// Event listeners
document.getElementById("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault();
        handlePromptSubmission();
    }
});

document.getElementById("promptBtn").addEventListener("click", handlePromptSubmission);
document.getElementById("resetChat").addEventListener("click", resetChatHistory);
document.getElementById("jokeBtn").addEventListener("click", fetchJoke);

// Initialize on page load
window.onload = () => {
    loadChatFromLocalStorage();
};
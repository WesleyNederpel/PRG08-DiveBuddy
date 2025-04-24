// Houd de chatgeschiedenis bij in een array
let messages = [];
let isProcessing = false; // Vergrendelingsmechanisme

// Functie om chatgeschiedenis op te slaan in localStorage
function saveChatToLocalStorage() {
    localStorage.setItem("chatHistory", JSON.stringify(messages));
}

// Functie om chatgeschiedenis te laden uit localStorage
function loadChatFromLocalStorage() {
    const savedChats = JSON.parse(localStorage.getItem("chatHistory")) || [];
    messages = savedChats; // Laad de opgeslagen berichten in de array

    savedChats.forEach(chat => {
        displayMessage(chat.content, chat.role); // Verwerk opgeslagen berichten (AI/human)
    });
}

// Functie om een enkel chatbericht weer te geven
function displayMessage(content, role = "human") {
    const chatContainer = document.getElementById("chatContainer");

    // Create a div for the message
    const messageDiv = document.createElement("div");
    messageDiv.className = `flex ${
        role === "ai" ? "justify-start" : "justify-end"
    }`;

    // Create a bubble for the content
    const bubble = document.createElement("div");
    bubble.className = `px-4 py-2 rounded-lg max-w-xs text-sm ${
        role === "ai"
            ? "bg-cyan-700 text-white text-left"
            : "bg-cyan-500 text-white text-right"
    }`;
    bubble.innerText = content;

    // Add the bubble to the message div
    messageDiv.appendChild(bubble);
    chatContainer.appendChild(messageDiv);

    // Scroll naar het laatste bericht
    chatContainer.scrollTop = chatContainer.scrollHeight;

    return bubble; // Return de bubble
}

// Functie om een prompt te verwerken en te versturen naar de AI
async function handlePromptSubmission() {
    if (isProcessing) {
        alert("Please wait for the AI to finish responding.");
        return; // Stop als er al een AI-antwoordsessie bezig is
    }

    const promptInput = document.getElementById("promptInput");
    const promptValue = promptInput.value.trim();

    if (!promptValue) {
        alert("Please enter a valid question.");
        return; // Stop als de gebruiker niets invoert
    }

    // Zet de vergrendeling aan
    isProcessing = true;
    promptInput.disabled = true; // Schakel de invoer tijdelijk uit
    document.getElementById("promptBtn").disabled = true;

    // Voeg gebruikersprompt toe aan de chatgeschiedenis
    messages.push({ role: "human", content: promptValue });
    displayMessage(promptValue, "human"); // Toon het bericht van de gebruiker

    // Plaats een lege placeholder voor het AI-antwoord
    const aiBubble = displayMessage("", "ai");

    // Leeg het invoerveld
    promptInput.value = "";

    try {
        // Verstuur een POST-aanvraag naar de server met de volledige chatgeschiedenis
        const response = await fetch("http://localhost:3000/ask", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                prompt: promptValue,        // Voeg de huidige invoer van de gebruiker toe
                chatHistory: messages       // Inclusief de volledige chatgeschiedenis
            }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let done = false;
        let responseContent = ""; // Om het volledige antwoord te reconstrueren

        // Lees de stream terwijl het antwoord binnenkomt
        while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            responseContent += decoder.decode(value, { stream: true });
            aiBubble.innerText = responseContent; // Update het antwoord op het scherm

            document.getElementById("chatContainer").scrollTop =
                document.getElementById("chatContainer").scrollHeight;
        }

        // Voeg het AI-antwoord toe aan de chatgeschiedenis
        messages.push({ role: "ai", content: responseContent });
        saveChatToLocalStorage(); // Sla de geschiedenis op in localStorage
    } catch (err) {
        console.error("Error:", err);
        aiBubble.innerText = "Blub... Something went wrong.";
    } finally {
        // Zet de vergrendeling uit
        isProcessing = false;
        promptInput.disabled = false; // Schakel de invoer opnieuw in
        document.getElementById("promptBtn").disabled = false;
    }
}

// Functie om de chatgeschiedenis te resetten
function resetChatHistory() {
    if (isProcessing) {
        alert("Please wait for the current response to finish before resetting.");
        return; // Voorkom resetten terwijl een prompt wordt verwerkt
    }

    messages = []; // Wis de huidige chatgeschiedenis
    localStorage.removeItem("chatHistory"); // Verwijder ook uit localStorage

    const chatContainer = document.getElementById("chatContainer");
    chatContainer.innerHTML = "";
}


// Registreer een event listener voor de Enter-toets op het invoerveld
document.getElementById("promptInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        event.preventDefault(); // Voorkom standaard Enter-gedrag
        handlePromptSubmission(); // Verwerk en verstuur prompt
    }
});

// Functie uitvoeren bij klikken op de verzendknop
document.getElementById("promptBtn").addEventListener("click", () => {
    handlePromptSubmission();
});

// Functie om de chatgeschiedenis te resetten wanneer op de "reset" knop wordt geklikt
document.getElementById("resetChat").addEventListener("click", () => {
    resetChatHistory();
});

// Laad opgeslagen chatgeschiedenis wanneer de pagina wordt geladen
window.onload = () => {
    loadChatFromLocalStorage();
};
import { AzureChatOpenAI } from "@langchain/openai";
import express from "express";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

const model = new AzureChatOpenAI({ temperature: 1 });

// Functie om een enkele prompt te versturen
async function sendPrompt(prompt) {
    const result = await model.invoke([
        ["system", "You are a diving instructor. You respond like you are talking with students and use diving terms."],
        ["human", prompt],
    ]);
    return result.content;
}

// Endpoint voor grappige antwoorden
app.get("/", async (req, res) => {
    const result = await model.invoke("Tell me an underwater joke");
    res.json({ message: result.content });
});

// Endpoint om een prompt te versturen en een AI-antwoord terug te sturen
app.post("/ask", async (req, res) => {
    const prompt = req.body.prompt;
    const chatHistory = req.body.chatHistory || [];

    // Validate the incoming request payload
    if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({ error: "Invalid or missing prompt." });
    }
    if (!Array.isArray(chatHistory)) {
        return res.status(400).json({ error: "chatHistory must be an array." });
    }

    try {
        const messages = [
            ["system", "You are a diving instructor. You respond like you are talking with students and use diving terms."],
            ...chatHistory.flatMap(chat => [
                ["human", chat.content || ""],
                ["ai", chat.role === "ai" ? chat.content || "" : ""],
            ]),
            ["human", prompt],
        ];

        const aiResponse = await model.invoke(messages);

        if (!aiResponse || typeof aiResponse.content !== "string") {
            throw new Error("AI response is not valid.");
        }

        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Transfer-Encoding", "chunked");

        for (const char of aiResponse.content) {
            res.write(char);
            await new Promise(resolve => setTimeout(resolve, 50));
        }

        res.end();
    } catch (err) {
        console.error("Error generating response:", err);
        res.status(500).json({ error: "Internal Server Error." });
    }
});

// Start de server
app.listen(3000, () => console.log("Server draait op poort 3000"));
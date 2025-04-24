import { AzureChatOpenAI } from "@langchain/openai";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";

// Initialize express app and middleware
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Initialize the Azure OpenAI model
const model = new AzureChatOpenAI({ temperature: 1 });

// System prompt for maintaining the diving instructor persona
const SYSTEM_PROMPT = `You are a diving instructor. You respond like you are talking with students and use diving terms. 
You are also knowledgeable about Dutch water data from Rijkswaterstaat and can discuss water levels, temperature, and safety conditions.
When users ask about Dutch water conditions, water temperature, water levels, or water flow ("watertemperatuur", "waterstanden", "waterstroom") in Dutch or English,
you'll automatically provide the most recent data from Rijkswaterstaat's monitoring system.`;

// Base URL for the Rijkswaterstaat water data API
const WATER_API_BASE_URL = "https://waterwebservices.rijkswaterstaat.nl/ONLINEWAARNEMINGENSERVICES_DBO/OphalenLaatsteWaarnemingen";

// Dutch water data measuring stations and parameters
const MEASURING_STATIONS = {
    "HOEK": "Hoek van Holland",
    "IJMDBTHVN": "IJmuiden Buitenhaven",
    "VLISSGN": "Vlissingen",
    "DORDTSG": "Dordrecht",
    "MAASSS": "Maassluis",
    "ROTTDM": "Rotterdam"
};

// Measurement types
const MEASUREMENT_TYPES = {
    "WATHTBRKD": "Waterhoogte (water level) in cm t.o.v. NAP",
    "WATHTE": "Waterhoogte (water level) in cm t.o.v. NAP",
    "WATTEMP": "Watertemperatuur (water temperature) in °C",
    "STROOMSHD": "Stroomsnelheid (water current speed) in cm/s"
};

// Endpoint for joke responses
app.get("/", async (req, res) => {
    try {
        const result = await model.invoke("Tell me an underwater joke");
        res.json({ message: result.content });
    } catch (err) {
        console.error("Error fetching joke:", err);
        res.status(500).json({ error: "Failed to generate joke" });
    }
});

// Helper functions for handling Dutch water data

/**
 * Determines if a query is related to Dutch water data
 * @param {string} prompt - The user's query
 * @returns {boolean} - Whether the query is related to water data
 */
function isWaterDataQuery(prompt) {
    // Dutch and English water-related keywords
    const waterKeywords = [
        // Dutch keywords
        "waterstand", "waterstanden", "waterpeil", "watertemperatuur", 
        "waterstroom", "stroomsnelheid", "golfhoogte", "getij", "getijde",
        "rijkswaterstaat", "waterkwaliteit", "waterhoogte",
        // English keywords
        "water level", "water temperature", "water current", "tide", "tidal", 
        "water quality", "water height", "dutch water"
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    return waterKeywords.some(keyword => lowerPrompt.includes(keyword));
}

/**
 * Determines which measurement type to request based on the query
 * @param {string} prompt - The user's query
 * @returns {string} - The appropriate measurement type code
 */
function determineMeasurementType(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    if (lowerPrompt.includes("temperatuur") || lowerPrompt.includes("temperature")) {
        return "WATTEMP";
    } else if (lowerPrompt.includes("stroom") || lowerPrompt.includes("current") || lowerPrompt.includes("flow")) {
        return "STROOMSHD";
    } else {
        // Default to water level if no specific type is mentioned
        return "WATHTBRKD";
    }
}

/**
 * Determines which measuring station to use based on the query
 * @param {string} prompt - The user's query
 * @returns {string} - The appropriate station code
 */
function determineStation(prompt) {
    const lowerPrompt = prompt.toLowerCase();
    
    // Check for specific locations
    if (lowerPrompt.includes("rotterdam")) {
        return "ROTTDM";
    } else if (lowerPrompt.includes("dordrecht")) {
        return "DORDTSG";
    } else if (lowerPrompt.includes("ijmuiden")) {
        return "IJMDBTHVN";
    } else if (lowerPrompt.includes("vlissingen")) {
        return "VLISSGN";
    } else if (lowerPrompt.includes("maassluis")) {
        return "MAASSS";
    } else {
        // Default to Hoek van Holland if no specific location is mentioned
        return "HOEK";
    }
}

/**
 * Fetches water data from Rijkswaterstaat API
 * @param {string} stationCode - The measuring station code
 * @param {string} measurementType - The type of measurement to request
 * @returns {Promise<Object>} - The water data
 */
async function fetchWaterData(stationCode = "HOEK", measurementType = "WATHTBRKD") {
    const requestBody = {
        "Locatie": {
            "Code": stationCode,
            "WaarnemingsSoort": measurementType
        }
    };

    const apiResponse = await fetch(WATER_API_BASE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-API-KEY': 'dummy-key' // As per API documentation, a dummy key for now
        },
        body: JSON.stringify(requestBody)
    });
    
    if (!apiResponse.ok) {
        throw new Error(`API responded with status: ${apiResponse.status}`);
    }
    
    return await apiResponse.json();
}

/**
 * Creates a prompt with water data for the LLM
 * @param {Object} waterData - The water data from Rijkswaterstaat
 * @param {string} station - The station code
 * @param {string} measurementType - The measurement type code
 * @returns {string} - A prompt for the LLM
 */
function createWaterDataPrompt(waterData, station, measurementType) {
    return `
    Here is the latest water data from Rijkswaterstaat for ${MEASURING_STATIONS[station] || station}:
    Measurement type: ${MEASUREMENT_TYPES[measurementType] || measurementType}
    Data: ${JSON.stringify(waterData, null, 2)}
    
    As a diving instructor, explain this data in simple terms. Focus on the measured values, 
    what these conditions mean for water activities, and how they might affect diving conditions.
    Mention that this data comes from Rijkswaterstaat's monitoring system.
    `;
}

// Endpoint to process user prompts and return AI responses
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
        // Check if the query is related to water data
        let waterDataContext = "";
        if (isWaterDataQuery(prompt)) {
            // Determine the measurement type and station based on the query
            const measurementType = determineMeasurementType(prompt);
            const station = determineStation(prompt);
            
            console.log(`Water data request detected. Fetching ${measurementType} data for station ${station}`);
            
            try {
                // Fetch the water data
                const waterData = await fetchWaterData(station, measurementType);
                
                // Create water data context to include in the prompt
                waterDataContext = createWaterDataPrompt(waterData, station, measurementType);
                
                console.log("Water data fetched successfully");
            } catch (waterError) {
                console.error("Error fetching water data:", waterError);
                
                // Create fallback water data context
                waterDataContext = `
                I attempted to fetch real-time water data from Rijkswaterstaat, but I couldn't access it at the moment.
                I'll answer based on my general knowledge about Dutch water conditions instead.
                `;
            }
        }

        // Prepare messages for the LLM
        let messages = [
            ["system", SYSTEM_PROMPT],
            ...chatHistory.flatMap(chat => [
                ["human", chat.content || ""],
                ["ai", chat.role === "ai" ? chat.content || "" : ""],
            ])
        ];
        
        // Add water data context if available, otherwise just the user's prompt
        if (waterDataContext) {
            messages.push(["human", `${prompt}\n\n[Additional context for AI: ${waterDataContext}]`]);
        } else {
            messages.push(["human", prompt]);
        }

        // Get response from the LLM
        const aiResponse = await model.invoke(messages);

        if (!aiResponse || typeof aiResponse.content !== "string") {
            throw new Error("AI response is not valid.");
        }

        // Set headers for streaming response
        res.setHeader("Content-Type", "text/plain");
        res.setHeader("Transfer-Encoding", "chunked");

        // Stream response character by character for better UX
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

// Start the server
app.listen(3000, () => console.log("Server running on port 3000"));
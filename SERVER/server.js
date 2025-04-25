import { AzureChatOpenAI } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import { getVectorStore } from "./embed.js";

// Helper function to log chunks retrieved from the vector store
function logRelevantChunks(query, docs) {
    console.log("\n=== Zoekresultaten voor vraag: '" + query + "' ===");
    console.log("Aantal gevonden chunks:", docs.length);
    docs.forEach((doc, index) => {
        console.log(`\nChunk ${index + 1}:`);
        console.log("-".repeat(50));
        console.log(doc.pageContent.trim());
        console.log("-".repeat(50));
    });
}

// Initialize express app and middleware
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.urlencoded({ extended: true }));

// Initialize the Azure OpenAI model
const model = new AzureChatOpenAI({ temperature: 0.3 });

// Initialize vector store - will be loaded once at startup
let vectorStore;
(async () => {
    try {
        vectorStore = await getVectorStore();
        console.log("Vector store loaded successfully");
    } catch (error) {
        console.error("Error loading vector store:", error);
    }
})();

// System prompt for maintaining the diving instructor persona
const SYSTEM_PROMPT = `You are a diving instructor. You respond like you are talking with students and use diving terms. 
You are also knowledgeable about Dutch water data from Rijkswaterstaat and can discuss water levels, temperature, and safety conditions.
When users ask about Dutch water conditions, water temperature, water levels, or water flow ("watertemperatuur", "waterstanden", "waterstroom") in Dutch or English,
you'll automatically provide the most recent data from Rijkswaterstaat's monitoring system.
You have access to a comprehensive diving handbook that you can reference when answering questions.`;

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

// Prompt template for RAG
const RAG_PROMPT = ChatPromptTemplate.fromMessages([
    ["system", `You are an expert diving instructor. 
    Use ONLY the following pieces of context to answer the question at the end.
    You must ONLY provide information that is explicitly mentioned in the context.
    If specific details are mentioned in the context, include them exactly as they appear.
    If you don't know the answer based on the context, just say that you don't have enough information.
    Do not make up or infer information that isn't directly stated in the context.
    Always answer as a diving instructor would, using appropriate diving terminology.`],
    ["human", "{question}"],
    ["ai", "I'll help answer that using the specific information from our diving handbook."],
    ["human", "Here's some context that might help: {context}"],
]);


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

// Add a new endpoint for querying the handbook directly
app.post("/query-handbook", async (req, res) => {
    const { query } = req.body;
    
    if (!query || typeof query !== "string") {
        return res.status(400).json({ error: "Invalid or missing query" });
    }
    
    try {
        if (!vectorStore) {
            return res.status(500).json({ error: "Vector store not loaded yet" });
        }
        
        // Retrieve relevant documents from vector store
        const retriever = vectorStore.asRetriever(4); // Get top 4 most relevant chunks
        const relevantDocs = await retriever.getRelevantDocuments(query);
        
        // Direct logging instead of using the function
        console.log("\n=== Zoekresultaten voor vraag: '" + query + "' ===");
        console.log("Aantal gevonden chunks:", relevantDocs.length);
        
        relevantDocs.forEach((doc, index) => {
            console.log(`\nChunk ${index + 1}:`);
            console.log("-".repeat(50));
            console.log(doc.pageContent.trim());
            console.log("-".repeat(50));
        });
        
        // Create a chain to process the documents
        const ragChain = await createStuffDocumentsChain({
            llm: model,
            prompt: RAG_PROMPT,
            outputParser: new StringOutputParser(),
        });
        
        // Generate response from relevant documents
        const response = await ragChain.invoke({
            question: query,
            context: relevantDocs,
        });
        
        res.json({ message: response });
    } catch (error) {
        console.error("Error querying handbook:", error);
        res.status(500).json({ error: "Failed to query handbook" });
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
 * Determines if a query might be related to information in the diving handbook
 * @param {string} prompt - The user's query
 * @returns {boolean} - Whether the query is potentially about diving information
 */
function isDivingInfoQuery(prompt) {
    // Diving-related keywords
    const divingKeywords = [
        "dive", "diving", "scuba", "underwater", "marine", "ocean", "sea",
        "equipment", "safety", "pressure", "depth", "decompression", "buoyancy",
        "regulator", "tank", "wetsuit", "mask", "fins", "certification", "course",
        "marine life", "coral", "fish", "ecosystem", "environment", "conservation",
        "duikuitrusting", "duikles", "duikveiligheid", // Dutch terms
        "duiken", "duiklocatie", "duikplek", "duikstek", "meer", "plas", 
        "berendonck", "wijchen", "gelderland", "noord-holland", "zeeland", 
        "limburg", "overijssel", "nederland"
    ];
    
    const lowerPrompt = prompt.toLowerCase();
    return divingKeywords.some(keyword => lowerPrompt.includes(keyword));
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
        // Context variables for different data sources
        let waterDataContext = "";
        let handbookContext = "";

        // Check if the query is related to water data
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

        // Check if the query might be related to diving info from the handbook
        if (isDivingInfoQuery(prompt) && vectorStore) {
            console.log("Diving info query detected. Fetching relevant information from handbook.");
            
            try {
                // Retrieve relevant documents from vector store
                const retriever = vectorStore.asRetriever(2); // Get top 2 most relevant chunks
                const relevantDocs = await retriever.getRelevantDocuments(prompt);
                
                if (relevantDocs.length > 0) {
                    // Extract relevant content from documents
                    handbookContext = "Here's relevant information from the diving handbook:\n\n" +
                        relevantDocs.map(doc => doc.pageContent).join("\n\n");
                    
                    console.log("Retrieved relevant handbook information");
                }
            } catch (handbookError) {
                console.error("Error retrieving handbook information:", handbookError);
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
        
        // Combine all context and add to the prompt
        let combinedContext = "";
        if (waterDataContext) combinedContext += waterDataContext + "\n\n";
        if (handbookContext) combinedContext += handbookContext;
        
        if (combinedContext) {
            messages.push(["human", `${prompt}\n\n[Additional context for AI: ${combinedContext}]`]);
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
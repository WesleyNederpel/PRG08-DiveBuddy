import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import { FaissStore } from "@langchain/community/vectorstores/faiss";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current file's directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Azure OpenAI embeddings with Azure-specific configuration
const embeddings = new AzureOpenAIEmbeddings({
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_EMBEDDING_DEPLOYMENT_NAME,
});

// Read the content of duikLocaties.txt
const text = fs.readFileSync(path.join(__dirname, 'data', 'duikLocaties.txt'), 'utf8');

async function createVectorStore() {
  console.log("Starting embedding process...");
  
  // Split text into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
  });
  
  const splitDocs = await textSplitter.createDocuments([text]);
  console.log(`Split into ${splitDocs.length} chunks`);
  
  // Create and save the vector store
  console.log("Creating vector store...");
  const vectorStore = await FaissStore.fromDocuments(splitDocs, embeddings);
  
  return vectorStore;
}

// Check if vector store already exists, create it if not
async function getVectorStore() {
  try {
    return await createVectorStore();
  } catch (error) {
    console.error("Error creating vector store:", error);
    throw error;
  }
}

// Execute if run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    await createVectorStore();
    console.log("Embedding process completed successfully!");
  } catch (error) {
    console.error("Error in embedding process:", error);
  }
}

export { getVectorStore };
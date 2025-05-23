# Dive Buddy AI Assistant 🦈 🌊

## Overzicht
Dive Buddy is een interactieve AI-assistent die je helpt met duikgerelateerde vragen. De assistent kan informatie verstrekken over duiktechnieken, veiligheid en kan zelfs grappige onderwatermoppen vertellen! Daarnaast heeft Dive Buddy kennis van Nederlandse waterdata van Rijkswaterstaat en kan informatie geven over waterstanden, watertemperatuur en stroomsnelheden op verschillende locaties in Nederland.

## Functionaliteiten
- Beantwoord vragen over duiken en duiktechnieken
- Geeft real-time Nederlandse waterdata weer (via Rijkswaterstaat API)
- Vertelt onderwatermoppen
- Slaat chatgeschiedenis op
- Mogelijkheid om de chatgeschiedenis te resetten

## Technische Specificaties
Dit project bestaat uit een client- en servercomponent:

### Client
- HTML, CSS (Tailwind CSS) en JavaScript
- Gebruiksvriendelijke chat-interface
- Lokale opslag van chatgeschiedenis

### Server
- Node.js met Express
- Integratie met Azure OpenAI API
- Rijkswaterstaat API voor real-time waterdata
- Streaming antwoorden voor betere gebruikerservaring
- Vector embeddings en semantisch zoeken met FAISS

## Installatie

### Vereisten
- Node.js (versie 18 of hoger, vereist door dependencies)
- NPM (Node Package Manager, versie 8 of hoger aanbevolen)

### Server Installatie
1. Open een terminal en navigeer naar de SERVER map:
   ```bash
   cd SERVER
   ```

2. Installeer alle benodigde packages in één keer:
   ```bash
   npm install
   ```

3. Of installeer packages individueel als specifieke versies nodig zijn:
   ```bash
   # Kerndependencies
   npm install express@5.1.0 cors@2.8.5 node-fetch@3.3.1
   
   # LangChain packages
   npm install @langchain/core@0.3.48 @langchain/openai@0.5.7 langchain@0.3.21
   
   # Vector embeddings en opslag
   npm install @langchain/textsplitters@0.1.0 faiss-node@0.5.1 @langchain/community@0.3.41
   ```

4. Maak een .env bestand in de SERVER map met de volgende omgevingsvariabelen:
   ```
   # Azure OpenAI API configuratie voor chat
   AZURE_OPENAI_API_KEY=jouw_api_key
   AZURE_OPENAI_API_ENDPOINT=https://jouw-endpoint.openai.azure.com
   AZURE_OPENAI_API_DEPLOYMENT_NAME=jouw-deployment-naam
   AZURE_OPENAI_API_VERSION=2023-05-15
   
   # Azure OpenAI API configuratie voor embeddings
   AZURE_OPENAI_API_INSTANCE_NAME=jouw-instance-naam
   AZURE_OPENAI_API_EMBEDDING_DEPLOYMENT_NAME=jouw-embedding-deployment-naam
   ```

5. Initialiseer de vector embeddings voor de duiklocatie data. Dit hoeft maar één keer te gebeuren, of wanneer de data wijzigt:
   ```bash
   node --env-file=.env embed.js
   ```
   
   Dit proces leest de inhoud van `data/duikLocaties.txt`, splitst de tekst in kleinere stukken, 
   genereert embeddings via de Azure OpenAI API en slaat deze op in een vector database (FAISS).

6. Start de server in ontwikkelmodus met automatisch herladen:
   ```bash
   npm run server
   ```

7. Of start de server in productiemodus:
   ```bash
   npm start
   # of direct
   node server.js
   ```

8. De server draait nu op http://localhost:3000

### Client Gebruik
1. Open het bestand `CLIENT/index.html` in een moderne webbrowser
2. De client maakt automatisch verbinding met de server als deze draait

## Pakketinformatie
Dit project gebruikt de volgende NPM packages:

- **express** (v5.1.0): Webserver framework voor Node.js
- **cors** (v2.8.5): Cross-Origin Resource Sharing middleware
- **node-fetch** (v3.3.1): Fetch API voor serverside HTTP-requests
- **@langchain/core** (v0.3.48): Core functies voor LangChain
- **@langchain/openai** (v0.5.7): OpenAI integratie voor LangChain
- **langchain** (v0.3.21): Framework voor het bouwen van LLM-toepassingen
- **@langchain/textsplitters** (v0.1.0): Hulppakket voor het opsplitsen van tekst
- **faiss-node** (v0.5.1): Efficiënte vector opslag en zoekfunctionaliteit
- **@langchain/community** (v0.3.41): Extra LangChain componenten en integraties

## Technische Werking

### Vector Embeddings
Dit project maakt gebruik van vector embeddings voor semantisch zoeken in de duiklocatie gegevens:

1. **Data Processing**: De tekst in `data/duikLocaties.txt` wordt gesplitst in kleinere stukken van ongeveer 500 tekens
2. **Embedding Generatie**: Voor elk stuk tekst worden embeddings gegenereerd met Azure OpenAI
3. **Vector Opslag**: De embeddings worden opgeslagen in een FAISS vector database
4. **Semantisch Zoeken**: Wanneer een gebruiker een vraag stelt, worden de meest relevante tekstfragmenten opgehaald op basis van semantische gelijkenis

Dit zorgt ervoor dat de AI-assistent nauwkeurige informatie kan geven over specifieke duiklocaties in Nederland, zonder dat de volledige tekst in de prompt geladen hoeft te worden.

## Bekende problemen en oplossingen

### Server start niet
- Controleer of alle benodigde packages zijn geïnstalleerd: `npm list`
- Controleer of je Node.js versie 18 of hoger is: `node -v`
- Zorg dat poort 3000 niet door een andere applicatie wordt gebruikt
- Controleer of alle omgevingsvariabelen correct zijn ingesteld in het .env bestand
- Controleer de console.log output voor specifieke foutmeldingen

### Package-gerelateerde problemen
- Als er fouten optreden met ES modules, controleer of `"type": "module"` in package.json staat
- Bij problemen met packages, probeer de node_modules map te verwijderen en packages opnieuw te installeren:
  ```bash
  rm -rf node_modules
  npm install
  ```
- Voor specifieke pakketversies kun je deze direct installeren: `npm install [package]@[version]`

### Embedding en Vector Opslag Problemen
- Controleer of je de juiste Azure OpenAI embedding endpoints hebt geconfigureerd in .env
- Voor problemen met FAISS: `npm rebuild faiss-node` kan helpen bij compilatie-issues
- Als de vectoropslag niet correct geïnitialiseerd wordt, voer `node --env-file=.env embed.js` uit om het embeddings-proces opnieuw te starten
- Je kunt de serverlog controleren op informatie over het laden van de vector store

### Water API Verbinding
- De Rijkswaterstaat API gebruikt momenteel een 'dummy-key'. Voor productiegebruik moet een echte API-sleutel worden aangevraagd
- Bij API-verbindingsproblemen valt het systeem terug op algemene waterkennis

### Browsercompatibiliteit
- De applicatie werkt het beste in Chrome, Firefox, Edge en Safari
- Zorg dat JavaScript is ingeschakeld in je browser

## Licentie
© DiveAI 2025 - Voor veilig en plezierig duiken!

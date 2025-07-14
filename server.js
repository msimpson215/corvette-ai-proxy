const express = require('express');
    const cors = require('cors');
    const { OpenAI } = require('openai');
    const fetch = require('node-fetch'); // Ensure node-fetch is available

    const app = express();
    const port = process.env.PORT || 3000;

    // Configure CORS to allow requests from your specific domain
    // This is CRITICAL for cross-origin communication
    app.use(cors({
        origin: 'https://predeicer.com', // Allow only your website's domain
        methods: ['GET', 'POST', 'OPTIONS'], // Allow these HTTP methods
        allowedHeaders: ['Content-Type', 'Authorization'], // Allow these headers
    }));

    app.use(express.json()); // For parsing application/json

    // Initialize OpenAI client with API key from environment variable
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
    });

    // Eleven Labs API configuration
    // IMPORTANT: For production, it's highly recommended to use environment variables for API keys.
    // The API key and Voice ID are hardcoded here as per your request.
    const ELEVEN_LABS_API_KEY = 'sk_5c9e09d90cf458301a909ada74537005933db06d83453791'; // Your Eleven Labs API Key
    const ELEVEN_LABS_VOICE_ID = 'cjVigY5qzO86Huf0OWal'; // Your Eleven Labs Voice ID

    // --- ROUTES ---

    // Health check route
    app.get('/', (req, res) => {
        res.status(200).send('Corvette AI Proxy is running!');
    });

    // Chat endpoint to interact with OpenAI and Eleven Labs
    app.post('/chat', async (req, res) => {
        const userPrompt = req.body.prompt;

        if (!userPrompt) {
            return res.status(400).json({ error: 'Prompt is required.' });
        }

        if (!openai.apiKey) {
            console.error('OpenAI API Key is not set in environment variables.');
            return res.status(500).json({ error: 'OpenAI API key not configured on server.' });
        }

        if (!ELEVEN_LABS_API_KEY) {
            console.error('Eleven Labs API Key is not set in environment variables.');
            return res.status(500).json({ error: 'Eleven Labs API key not configured on server.' });
        }

        try {
            // 1. Get text response from OpenAI
            const chatCompletion = await openai.chat.completions.create({
                model: "gpt-3.5-turbo", // You can change this to "gpt-4" if you have access and prefer
                messages: [{ role: "user", content: userPrompt }],
            });

            const aiTextResponse = chatCompletion.choices[0].message.content;

            // 2. Convert text to speech using Eleven Labs
            const elevenLabsResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVEN_LABS_VOICE_ID}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'xi-api-key': ELEVEN_LABS_API_KEY,
                },
                body: JSON.stringify({
                    text: aiTextResponse,
                    model_id: "eleven_monolingual_v1", // Or another Eleven Labs model like 'eleven_turbo_v2'
                    voice_settings: {
                        stability: 0.5,
                        similarity_boost: 0.5
                    }
                }),
            });

            if (!elevenLabsResponse.ok) {
                const errorText = await elevenLabsResponse.text(); // Get raw error text
                console.error('Eleven Labs API Error:', elevenLabsResponse.status, errorText);
                return res.status(elevenLabsResponse.status).json({
                    error: `Eleven Labs API error: ${elevenLabsResponse.statusText || errorText}`
                });
            }

            // Convert audio response to a Base64 string to send back to frontend
            const audioBuffer = await elevenLabsResponse.arrayBuffer();
            const audioBase64 = Buffer.from(audioBuffer).toString('base64');

            // Send both the text response and the Base64 audio back to the frontend
            res.json({
                response: aiTextResponse,
                audio: audioBase64 // Send Base64 encoded audio
            });

        } catch (error) {
            console.error('Server-side error during OpenAI/Eleven Labs API call:', error);
            res.status(500).json({ error: 'Internal server error processing request.' });
        }
    });

    // Start the server
    app.listen(port, () => {
        console.log(`Corvette AI Proxy listening on port ${port}`);
    });
    
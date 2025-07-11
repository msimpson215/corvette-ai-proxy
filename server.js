// server.js - Node.js Proxy Server for OpenAI API
// This server runs on your Cloudways instance and securely handles API calls.

// Load environment variables from .env file (for API_KEY)
require('dotenv').config();
const express = require('express');
const fetch = require('node-fetch'); // Used for making HTTP requests

const app = express();
// Cloudways typically runs Node.js apps on port 8080 by default.
// It also sets a PORT environment variable.
const PORT = process.env.PORT || 8080;

// Get the OpenAI API key from environment variables (from your .env file)
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CHATGPT_MODEL = 'gpt-3.5-turbo'; // Or 'gpt-4o', etc. - match your client-side model

// Middleware to parse JSON request bodies
app.use(express.json());

// Enable CORS for your frontend (predeicer.com)
// This is crucial so your frontend can talk to this server.
app.use((req, res, next) => {
    // Replace 'https://predeicer.com' with your actual frontend domain
    // For development, you might use '*' but it's less secure for production.
    res.setHeader('Access-Control-Allow-Origin', 'https://predeicer.com');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// Define the /chat endpoint for your proxy
app.post('/chat', async (req, res) => {
    // Check if the API key is available
    if (!OPENAI_API_KEY) {
        console.error('OPENAI_API_KEY is not set in environment variables.');
        return res.status(500).json({ error: 'Server configuration error: API key missing.' });
    }

    // Get the prompt from the client-side request
    const userPrompt = req.body.prompt;
    if (!userPrompt) {
        return res.status(400).json({ error: 'Prompt is required.' });
    }

    // Prepare the payload for the OpenAI API
    const messages = [{ role: "user", content: userPrompt }];
    const openaiPayload = {
        model: CHATGPT_MODEL,
        messages: messages,
        temperature: 0.7,
        max_tokens: 150,
    };

    try {
        // Make the request to the OpenAI API
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // Securely add the API key from the server's environment variables
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify(openaiPayload)
        });

        // Check for errors from OpenAI
        if (!openaiResponse.ok) {
            const errorData = await openaiResponse.json();
            console.error('Error from OpenAI API:', errorData);
            return res.status(openaiResponse.status).json({
                error: errorData.error ? errorData.error.message : 'Error calling OpenAI API.'
            });
        }

        const openaiResult = await openaiResponse.json();

        // Extract the AI's response
        if (openaiResult.choices && openaiResult.choices.length > 0 && openaiResult[0].message && openaiResult[0].message.content) {
            const aiText = openaiResult.choices[0].message.content;
            // Send the AI's response back to the client
            res.json({ response: aiText });
        } else {
            console.warn('Unexpected OpenAI API response structure:', openaiResult);
            res.status(500).json({ error: 'Unexpected response from AI service.' });
        }

    } catch (error) {
        console.error('Server-side error during OpenAI API call:', error);
        res.status(500).json({ error: 'Internal server error processing request.' });
    }
});

// Start the server
app.listen(PORT, () => {
    console.log(`Node.js proxy server running on port ${PORT}`);
    console.log(`Access at http://localhost:${PORT}/chat (or your Cloudways app URL)`);
});
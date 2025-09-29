const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { SpeechClient } = require('@google-cloud/speech');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { VertexAI } = require('@google-cloud/vertexai');

// Set Google Cloud credentials environment variable
process.env.GOOGLE_APPLICATION_CREDENTIALS = path.join(__dirname, 'gcp-key.json');

const app = express();
const PORT = process.env.PORT || 3001;

// Create storage directories
const STORAGE_DIR = path.join(__dirname, 'storage');
const AUDIO_DIR = path.join(STORAGE_DIR, 'audio');
const TRANSCRIPTS_DIR = path.join(STORAGE_DIR, 'transcripts');
const CONVERSATIONS_DIR = path.join(STORAGE_DIR, 'conversations');
const SESSIONS_DIR = path.join(STORAGE_DIR, 'sessions');

app.get('/health', (req, res) => {
    res.json({ status: 'OK' });
    console.log('Health check endpoint hit');
  });
  

// Ensure storage directories exist
[STORAGE_DIR, AUDIO_DIR, TRANSCRIPTS_DIR, CONVERSATIONS_DIR, SESSIONS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// In-memory session storage (in production, use Redis or database)
const activeSessions = new Map();
const MAX_SESSION_HISTORY = 10; // Keep last 10 exchanges per session

// Initialize Google Cloud services
const speechClient = new SpeechClient({
  projectId: 'ccnyhack'
});

const ttsClient = new TextToSpeechClient({
  projectId: 'ccnyhack'
});

const vertexAI = new VertexAI({
  project: 'ccnyhack',
  location: 'us-central1'
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Multer for audio uploads - using disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AUDIO_DIR);
  },
  filename: (req, file, cb) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const extension = path.extname(file.originalname) || '.webm';
    cb(null, `audio-${timestamp}${extension}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files and webm files (for testing)
    if (file.mimetype.startsWith('audio/') || 
        file.mimetype === 'application/octet-stream' ||
        file.originalname.endsWith('.webm') ||
        file.originalname.endsWith('.wav') ||
        file.originalname.endsWith('.mp3')) {
      cb(null, true);
    } else {
      console.log('Rejected file:', file.originalname, 'mimetype:', file.mimetype);
      cb(new Error('Only audio files are allowed!'));
    }
  }
});

// Session management functions
function getOrCreateSession(sessionId) {
  if (!activeSessions.has(sessionId)) {
    activeSessions.set(sessionId, {
      id: sessionId,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      history: []
    });
    console.log(`🆕 Created new session: ${sessionId}`);
  }
  return activeSessions.get(sessionId);
}

function addToSessionHistory(sessionId, userMessage, aiResponse) {
  const session = getOrCreateSession(sessionId);
  const exchange = {
    timestamp: new Date().toISOString(),
    user: userMessage,
    assistant: aiResponse
  };
  
  session.history.push(exchange);
  session.lastActivity = new Date().toISOString();
  
  // Keep only the last MAX_SESSION_HISTORY exchanges
  if (session.history.length > MAX_SESSION_HISTORY) {
    session.history = session.history.slice(-MAX_SESSION_HISTORY);
  }
  
  // Save session to disk
  const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
  fs.writeFileSync(sessionFile, JSON.stringify(session, null, 2));
  
  console.log(`💬 Added to session ${sessionId} history (${session.history.length} exchanges)`);
}

function getSessionHistory(sessionId) {
  const session = activeSessions.get(sessionId);
  return session ? session.history : [];
}

// Function to save conversation data
function saveConversation(audioPath, transcription, response, audioResponse, sessionId = null) {
  const timestamp = new Date().toISOString();
  const conversationId = timestamp.replace(/[:.]/g, '-');
  
  const conversationData = {
    id: conversationId,
    sessionId: sessionId,
    timestamp: timestamp,
    audioFile: path.basename(audioPath),
    transcription: transcription,
    response: response,
    audioResponseSize: audioResponse ? audioResponse.length : 0
  };
  
  // Save individual conversation
  const conversationFile = path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
  fs.writeFileSync(conversationFile, JSON.stringify(conversationData, null, 2));
  
  // Save transcript
  const transcriptFile = path.join(TRANSCRIPTS_DIR, `${conversationId}.txt`);
  const transcriptContent = `Timestamp: ${timestamp}\nSession: ${sessionId || 'none'}\nTranscription: ${transcription}\nResponse: ${response}\n`;
  fs.writeFileSync(transcriptFile, transcriptContent);
  
  // Save audio response if available
  if (audioResponse) {
    const audioResponseFile = path.join(AUDIO_DIR, `response-${conversationId}.mp3`);
    fs.writeFileSync(audioResponseFile, audioResponse);
  }
  
  // Add to session history if sessionId provided
  if (sessionId) {
    addToSessionHistory(sessionId, transcription, response);
  }
  
  console.log(`💾 Saved conversation: ${conversationId} (session: ${sessionId || 'none'})`);
  return conversationData;
}

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Voice Assistant API is running'
  });
});

// Speech processing endpoint
app.post('/api/process-speech', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // Get session ID from request (optional)
    const sessionId = req.body.sessionId || req.headers['x-session-id'] || `session-${Date.now()}`;
    
    console.log('Processing speech for file:', req.file.filename);
    console.log('Audio file saved to:', req.file.path);
    console.log('Session ID:', sessionId);
    
    // Read the saved audio file
    const audioBuffer = fs.readFileSync(req.file.path);
    console.log('Audio buffer size:', audioBuffer.length, 'bytes');
    
    // Step 1: Speech-to-Text
    const transcription = await transcribeAudio(audioBuffer);
    console.log('Transcription:', transcription);
    
    if (!transcription) {
      const noSpeechResponse = 'I heard some audio but couldn\'t make out what you said. Please try speaking more clearly.';
      
      // Still save the conversation even if no speech detected
      const conversationData = saveConversation(
        req.file.path, 
        'No speech detected', 
        noSpeechResponse, 
        null,
        sessionId
      );
      
      return res.json({
        success: true,
        transcription: 'No speech detected',
        response: noSpeechResponse,
        audioResponse: null,
        conversationId: conversationData.id,
        sessionId: sessionId
      });
    }

    // Step 2: Generate AI response with context
    const response = await generateResponseWithContext(transcription, sessionId);
    console.log('AI Response:', response);
    
    // Step 3: Text-to-Speech
    const audioResponse = await synthesizeSpeech(response);
    console.log('TTS audio generated, size:', audioResponse.length, 'bytes');
    
    // Step 4: Save conversation data
    const conversationData = saveConversation(
      req.file.path, 
      transcription, 
      response, 
      audioResponse,
      sessionId
    );
    
    res.json({
      success: true,
      transcription: transcription,
      response: response,
      audioResponse: audioResponse.toString('base64'),
      conversationId: conversationData.id,
      sessionId: sessionId
    });
    
  } catch (error) {
    console.error('Error processing speech:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// API endpoint to get conversation history
app.get('/api/conversations', (req, res) => {
  try {
    const conversations = [];
    const files = fs.readdirSync(CONVERSATIONS_DIR);
    
    files.forEach(file => {
      if (file.endsWith('.json')) {
        const filePath = path.join(CONVERSATIONS_DIR, file);
        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        conversations.push(data);
      }
    });
    
    // Sort by timestamp (newest first)
    conversations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    res.json({
      success: true,
      conversations: conversations,
      count: conversations.length
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// API endpoint to get a specific conversation
app.get('/api/conversations/:id', (req, res) => {
  try {
    const conversationId = req.params.id;
    const filePath = path.join(CONVERSATIONS_DIR, `${conversationId}.json`);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    res.json({
      success: true,
      conversation: data
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

// API endpoint to get storage statistics
app.get('/api/storage/stats', (req, res) => {
  try {
    const stats = {
      audioFiles: fs.readdirSync(AUDIO_DIR).length,
      transcripts: fs.readdirSync(TRANSCRIPTS_DIR).length,
      conversations: fs.readdirSync(CONVERSATIONS_DIR).length,
      totalSize: 0
    };
    
    // Calculate total storage size
    const calculateDirSize = (dir) => {
      let size = 0;
      const files = fs.readdirSync(dir);
      files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
          size += stat.size;
        }
      });
      return size;
    };
    
    stats.totalSize = calculateDirSize(AUDIO_DIR) + 
                     calculateDirSize(TRANSCRIPTS_DIR) + 
                     calculateDirSize(CONVERSATIONS_DIR);
    
    res.json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('Error fetching storage stats:', error);
    res.status(500).json({ error: 'Failed to fetch storage statistics' });
  }
});

// API endpoint to create a new session
app.post('/api/sessions', (req, res) => {
  try {
    const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const session = getOrCreateSession(sessionId);
    
    res.json({
      success: true,
      sessionId: sessionId,
      session: session
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// API endpoint to get session history
app.get('/api/sessions/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const session = activeSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    res.json({
      success: true,
      session: session
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// API endpoint to get all active sessions
app.get('/api/sessions', (req, res) => {
  try {
    const sessions = Array.from(activeSessions.values());
    
    res.json({
      success: true,
      sessions: sessions,
      count: sessions.length
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// API endpoint to clear session history
app.delete('/api/sessions/:sessionId', (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    if (activeSessions.has(sessionId)) {
      activeSessions.delete(sessionId);
      
      // Also delete from disk
      const sessionFile = path.join(SESSIONS_DIR, `${sessionId}.json`);
      if (fs.existsSync(sessionFile)) {
        fs.unlinkSync(sessionFile);
      }
      
      res.json({
        success: true,
        message: 'Session cleared successfully'
      });
    } else {
      res.status(404).json({ error: 'Session not found' });
    }
  } catch (error) {
    console.error('Error clearing session:', error);
    res.status(500).json({ error: 'Failed to clear session' });
  }
});

// Speech-to-Text function
async function transcribeAudio(audioBuffer) {
  try {
    const request = {
      audio: {
        content: audioBuffer.toString('base64'),
      },
      config: {
        encoding: 'WEBM_OPUS',
        sampleRateHertz: 48000,
        languageCode: 'en-US',
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        enableWordConfidence: true,
        model: 'latest_long',
        useEnhanced: true,
        alternativeLanguageCodes: ['en-GB', 'en-AU'],
        maxAlternatives: 3,
        profanityFilter: false,
        enableSpeakerDiarization: false,
        diarizationSpeakerCount: 0,
        audioChannelCount: 1,
        enableSeparateRecognitionPerChannel: false,
      },
    };

    const [response] = await speechClient.recognize(request);
    console.log('Speech recognition response:', JSON.stringify(response, null, 2));
    
    // Get the best transcription with highest confidence
    let bestTranscription = '';
    let highestConfidence = 0;
    
    if (response.results) {
      for (const result of response.results) {
        if (result.alternatives) {
          for (const alternative of result.alternatives) {
            const confidence = alternative.confidence || 0;
            console.log(`Alternative: "${alternative.transcript}" (confidence: ${confidence})`);
            
            if (confidence > highestConfidence) {
              highestConfidence = confidence;
              bestTranscription = alternative.transcript || '';
            }
          }
        }
      }
    }

    console.log(`Best transcription: "${bestTranscription}" (confidence: ${highestConfidence})`);
    return bestTranscription.trim() || '';
  } catch (error) {
    console.error('Error transcribing audio:', error);
    throw new Error('Failed to transcribe audio');
  }
}

// Generate AI response with conversation context
async function generateResponseWithContext(userMessage, sessionId) {
  try {
    // Get conversation history for this session
    const history = getSessionHistory(sessionId);
    
    // Build context from recent conversation history
    let contextPrompt = '';
    if (history.length > 0) {
      contextPrompt = '\n\nPrevious conversation context:\n';
      history.slice(-5).forEach((exchange, index) => {
        contextPrompt += `User: ${exchange.user}\n`;
        contextPrompt += `Assistant: ${exchange.assistant}\n\n`;
      });
    }
    
    const modelVersions = [
      'gemini-2.5-flash-lite',
    ];

    let lastError;
    for (const modelVersion of modelVersions) {
      try {
        console.log(`Trying model: ${modelVersion} with context (${history.length} previous exchanges)`);
        const model = vertexAI.getGenerativeModel({
          model: modelVersion,
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
            topP: 0.8,
          },
        });

        const prompt = `You are Bumblebee, a friendly AI buddy who helps kids practice speech in a fun way.  
Your goal is to gently support children with articulation challenges (like saying "wabbit" instead of "rabbit").  

- Speak in short, warm, and natural sentences — like you're talking to a young friend.  
- Use contractions ("I'm", "you're", "it's") and natural punctuation with lots of encouragement.  
- Ask their name early on, repeat it back, and use it maximum twice to make the child feel seen.  
- If the child's message has a word starting with **R**, encourage them to repeat it with you in a playful way.  
  Example: if they say "I want to run", reply with: "That's great! Can you say 'run' with me? Run, run, run!"
  if they say "rabbit", reply with: "That's great! Can you say 'rabbit' with me? Rabbit, rabbit, rabbit!"
- Always keep it positive and supportive. Celebrate effort, not just success.  
- Avoid complex or formal words. Keep it simple, fun, and engaging.  
- Sprinkle in light conversation, stories, or games to make practice feel natural and exciting.  

Stay kind, patient, and encouraging but informative — Bumblebee should always feel like a cheerful friend who's proud of the child for trying. No markdown (like ** or *) only text.  

${contextPrompt}Current message:
User: ${userMessage}

Bumblebee:`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        
        // Handle different response formats
        let text = '';
        if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0]) {
          text = response.candidates[0].content.parts[0].text || '';
        } else if (typeof response.text === 'function') {
          text = response.text();
        } else if (response.text) {
          text = response.text;
        }
        
        console.log(`Successfully used model: ${modelVersion} with context`);
        return text || 'I apologize, but I couldn\'t generate a response.';
      } catch (modelError) {
        console.log(`Model ${modelVersion} failed:`, modelError.message);
        lastError = modelError;
        continue;
      }
    }

      // If all models fail, use a fallback response
      console.log('All Gemini models failed, using fallback response');
      return `I heard you say: "${userMessage}". I'm having trouble connecting to my AI brain right now, but I can still hear you perfectly!`;
  } catch (error) {
    console.error('Error generating response with context:', error);
    return `I heard you say: "${userMessage}". I'm having a little trouble thinking right now, but I'm still here to chat!`;
  }
}

// Generate AI response using Gemini (legacy function for backward compatibility)
async function generateResponse(userMessage) {
  try {
    const modelVersions = [
      'gemini-2.5-flash-lite',
    ];

    let lastError;
    for (const modelVersion of modelVersions) {
      try {
        console.log(`Trying model: ${modelVersion}`);
        const model = vertexAI.getGenerativeModel({
          model: modelVersion,
          generationConfig: {
            maxOutputTokens: 1000,
            temperature: 0.7,
            topP: 0.8,
          },
        });

        const prompt = `You are Bumblebee, a kid-friendly AI assistant designed for kids! Respond to the user's message in a warm, encouraging, and conversational way. Use contractions (like "I'm", "you're", "it's") and natural punctuation including questions and exclamations. Keep responses short, positive, and engaging - like talking to a young friend. Avoid complex words and make it sound natural when spoken aloud.

User: ${userMessage}

Alexa:`;

        const result = await model.generateContent(prompt);
        const response = result.response;
        
        // Handle different response formats
        let text = '';
        if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0]) {
          text = response.candidates[0].content.parts[0].text || '';
        } else if (typeof response.text === 'function') {
          text = response.text();
        } else if (response.text) {
          text = response.text;
        }
        
        console.log(`Successfully used model: ${modelVersion}`);
        return text || 'I apologize, but I couldn\'t generate a response.';
      } catch (modelError) {
        console.log(`Model ${modelVersion} failed:`, modelError.message);
        lastError = modelError;
        continue;
      }
    }

      // If all models fail, use a fallback response
      console.log('All Gemini models failed, using fallback response');
      return `I heard you say: "${userMessage}". I'm having trouble connecting to my AI brain right now, but I can still hear you perfectly!`;
    } catch (error) {
      console.error('Error generating response:', error);
      // Return a fallback response instead of throwing
      return `I heard you say: "${userMessage}". I'm having trouble connecting to my AI brain right now, but I can still hear you perfectly!`;
    }
}

// Text-to-Speech function
async function synthesizeSpeech(text) {
  try {
    // Clean the text (remove emojis, keep punctuation)
    const cleaned = text.replace(
      /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}]/gu,
      ""
    ).replace(/\s+/g, " ").trim();

    console.log(`Original text: "${text}"`);
    console.log(`Cleaned text: "${cleaned}"`);

    // Build SSML for natural speech
    const parts = cleaned.match(/[^.!?]+[.!?]?/g) || [cleaned];
    const chunks = parts.map(s => s.trim()).filter(Boolean);
    const body = chunks
      .map(s => `<s>${s}</s><break time="180ms"/>`)
      .join("");

    const ssml = `<speak>
      <prosody rate="0.98" pitch="+0.2st">
        ${body}
      </prosody>
    </speak>`;

    console.log(`SSML: ${ssml}`);

    const [response] = await ttsClient.synthesizeSpeech({
      input: { ssml },
      voice: {
        languageCode: "en-US",
        name: "en-US-Neural2-A", // Kid-friendly male voice
        ssmlGender: 'MALE',
      },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: 1.0,
        pitch: 0.0,
        effectsProfileId: ["small-bluetooth-speaker-class-device"],
      },
    });

    return Buffer.from(response.audioContent);
  } catch (error) {
    console.error('Error synthesizing speech:', error);
    throw new Error('Failed to synthesize speech');
  }
}

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Error:', error);
  console.error('Error stack:', error.stack);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  res.status(500).json({ 
    error: 'Something went wrong!',
    message: error.message,
    details: process.env.NODE_ENV === 'development' ? error.stack : undefined
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Voice Assistant API running on port ${PORT}`);
  console.log(`🎤 Google Cloud Speech-to-Text ready`);
  console.log(`🔊 Google Cloud Text-to-Speech ready`);
  console.log(`🤖 Vertex AI Gemini ready`);
  console.log(`📡 CORS enabled for localhost:5000`);
});

module.exports = app;

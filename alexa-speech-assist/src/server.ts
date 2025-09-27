import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import { SpeechService } from './services/speechService';
import { StorageService } from './services/storageService';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
    methods: ['GET', 'POST']
  }
});
const PORT = process.env.PORT || 8080;

// Initialize services
const speechService = new SpeechService();
const storageService = new StorageService();

// Security middleware
app.use(helmet({
        contentSecurityPolicy: {
          directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdn.socket.io", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            scriptSrcElem: ["'self'", "'unsafe-inline'", "https://cdn.socket.io", "https://unpkg.com", "https://cdn.jsdelivr.net"],
            scriptSrcAttr: ["'none'"],
            workerSrc: ["'self'", "blob:"],
            connectSrc: ["'self'", "ws:", "wss:", "blob:", "https://kmp1.picovoice.net"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https:"],
            fontSrc: ["'self'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'", "data:", "blob:"],
            frameSrc: ["'none'"],
          },
        },
}));

// CORS configuration
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:8080',
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Logging
app.use(morgan('combined'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use(express.static(path.join(__dirname, '../public'), {
  setHeaders: (res, path) => {
    if (path.endsWith('.js') || path.endsWith('.mjs')) {
      res.setHeader('Content-Type', 'application/javascript');
      // Add no-cache for hey_voxe.js to ensure fresh base64 model
      if (path.includes('hey_voxe.js')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      }
    } else if (path.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    } else if (path.endsWith('.map')) {
      res.setHeader('Content-Type', 'application/json');
    } else if (path.endsWith('.pv') || path.endsWith('.ppn')) {
      res.setHeader('Content-Type', 'application/octet-stream');
    }
  }
}));

// Multer configuration for audio uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed!'));
    }
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Get Porcupine access key for wake word detection
app.get('/api/porcupine-key', (req, res) => {
  const accessKey = process.env.PORCUPINE_ACCESS_KEY;
  if (!accessKey) {
    return res.status(500).json({ 
      error: 'Porcupine access key not configured',
      message: 'Please set PORCUPINE_ACCESS_KEY in your .env file'
    });
  }
  return res.json({ accessKey });
});

// Storage management endpoints
app.get('/api/storage/stats', async (req, res) => {
  try {
    const stats = await storageService.getStorageStats();
    return res.json(stats);
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to get storage stats',
      message: (error as Error).message 
    });
  }
});

app.get('/api/storage/files', async (req, res) => {
  try {
    const files = await storageService.listAudioFiles();
    return res.json({ files });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to list audio files',
      message: (error as Error).message 
    });
  }
});

app.get('/api/storage/signed-url/:filePath', async (req, res) => {
  try {
    const { filePath } = req.params;
    const signedUrl = await storageService.getSignedUrl(filePath);
    return res.json({ signedUrl });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to generate signed URL',
      message: (error as Error).message 
    });
  }
});

// Get all audio files with signed URLs for external access
app.get('/api/storage/audio-files', async (req, res) => {
  try {
    const files = await storageService.listAudioFiles();
    const filesWithUrls = await Promise.all(
      files.map(async (fileName) => {
        const signedUrl = await storageService.getSignedUrl(fileName);
        return {
          fileName,
          signedUrl,
          gcsPath: `gs://${storageService.bucketName}/${fileName}`
        };
      })
    );
    return res.json({ files: filesWithUrls });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to get audio files with URLs',
      message: (error as Error).message 
    });
  }
});

// Conversation management endpoints
app.post('/api/conversation/session', (req, res) => {
  try {
    const sessionId = speechService.createConversationSession();
    return res.json({ sessionId });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to create conversation session',
      message: (error as Error).message 
    });
  }
});

app.get('/api/conversation/session/:sessionId/history', (req, res) => {
  try {
    const { sessionId } = req.params;
    const history = speechService.getConversationHistory(sessionId);
    return res.json({ sessionId, history });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to get conversation history',
      message: (error as Error).message 
    });
  }
});

app.delete('/api/conversation/session/:sessionId', (req, res) => {
  try {
    const { sessionId } = req.params;
    speechService.clearConversationHistory(sessionId);
    return res.json({ message: 'Conversation history cleared', sessionId });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to clear conversation history',
      message: (error as Error).message 
    });
  }
});

app.get('/api/conversation/sessions', (req, res) => {
  try {
    const sessions = speechService.getActiveSessions();
    return res.json({ sessions });
  } catch (error) {
    return res.status(500).json({ 
      error: 'Failed to get active sessions',
      message: (error as Error).message 
    });
  }
});

// Audio upload endpoint (placeholder)
app.post('/upload-audio', upload.single('audio'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    // TODO: Implement Google Cloud Speech-to-Text integration
    return res.json({ 
      message: 'Audio file received successfully',
      filename: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    });
  } catch (error) {
    console.error('Error processing audio upload:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// Speech processing endpoint with full integration
app.post('/process-speech', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    console.log('Processing speech for file:', req.file.originalname);
    
    // Get session ID from request body or create new one
    const sessionId = req.body.sessionId;
    
    // Process the voice interaction
    const result = await speechService.processVoiceInteraction(req.file.buffer, 48000, sessionId);
    
    return res.json({
      success: true,
      transcription: result.transcription,
      response: result.response,
      audioResponse: result.audioResponse.toString('base64'),
      sessionId: result.sessionId
    });
  } catch (error) {
    console.error('Error processing speech:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Internal server error' 
    });
  }
});

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('audio-data', async (data: { audio: string; sampleRate?: number; sessionId?: string }) => {
    try {
      console.log('Received audio data from client:', socket.id);
      console.log('Audio data length:', data.audio.length);
      console.log('Session ID:', data.sessionId || 'new session');
      
      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(data.audio, 'base64');
      console.log('Audio buffer size:', audioBuffer.length, 'bytes');
      
      // Emit processing status
      socket.emit('processing', { status: 'transcribing' });
      
      // Process the voice interaction with session context
      console.log('Starting speech processing...');
      const result = await speechService.processVoiceInteraction(
        audioBuffer, 
        data.sampleRate || 48000,
        data.sessionId
      );
      
      console.log('Speech processing complete:');
      console.log('- Transcription:', result.transcription);
      console.log('- Response length:', result.response.length);
      console.log('- Audio response size:', result.audioResponse.length, 'bytes');
      console.log('- Session ID:', result.sessionId);
      
      // Send results back to client
      socket.emit('speech-result', {
        transcription: result.transcription,
        response: result.response,
        audioResponse: result.audioResponse.toString('base64'),
        inputAudioUrl: result.inputAudioUrl,
        outputAudioUrl: result.outputAudioUrl,
        sessionId: result.sessionId
      });
      
    } catch (error) {
      console.error('Error processing real-time speech:', error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'Processing failed' 
      });
    }
  });

  // Handle TTS requests
  socket.on('tts-request', async (data: { text: string }) => {
    try {
      console.log('Received TTS request:', data.text);
      
      // Generate TTS audio
      const audioResponse = await speechService.synthesizeSpeech(data.text);
      
      // Send TTS audio back to client
      socket.emit('tts-result', {
        text: data.text,
        audioResponse: audioResponse.toString('base64')
      });
      
    } catch (error) {
      console.error('Error processing TTS request:', error);
      socket.emit('error', { 
        message: error instanceof Error ? error.message : 'TTS processing failed' 
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Error handling middleware
app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large' });
    }
  }
  
  return res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  return res.status(404).json({ error: 'Route not found' });
});

// Start server
server.listen(PORT, async () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Static files served from: ${path.join(__dirname, '../public')}`);
  console.log(`🌍 CORS origin: ${process.env.CORS_ORIGIN || 'http://localhost:8080'}`);
  console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🎤 Speech service initialized with Google Cloud`);
  console.log(`🔌 WebSocket server ready for real-time communication`);
  
  // Initialize Cloud Storage
  try {
    await storageService.ensureBucketExists();
    console.log(`☁️  Cloud Storage bucket ready for audio files`);
  } catch (error) {
    console.error(`❌ Failed to initialize Cloud Storage:`, (error as Error).message);
  }

  // Test Gemini connection on startup
  try {
    const geminiWorking = await speechService.testGeminiConnection();
    if (geminiWorking) {
      console.log(`🎉 Gemini AI is ready! Voice assistant will provide intelligent responses.`);
    } else {
      console.log(`⚠️  Gemini AI not available - voice assistant will use fallback responses.`);
    }
  } catch (error) {
    console.error(`❌ Failed to test Gemini connection:`, (error as Error).message);
  }

  // Set up session cleanup every 30 minutes
  setInterval(() => {
    speechService.cleanupOldSessions();
  }, 30 * 60 * 1000); // 30 minutes
});

export default app;

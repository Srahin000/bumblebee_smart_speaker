import { SpeechClient } from '@google-cloud/speech';
import { TextToSpeechClient } from '@google-cloud/text-to-speech';
import { VertexAI } from '@google-cloud/vertexai';
import { StorageService } from './storageService';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ConversationSession {
  sessionId: string;
  messages: ConversationMessage[];
  createdAt: Date;
  lastActivity: Date;
}

export class SpeechService {
  private speechClient: SpeechClient;
  private ttsClient: TextToSpeechClient;
  private vertexAI: VertexAI;
  private storageService: StorageService;
  private projectId: string;
  private location: string;
  private model: string;
  private conversationSessions: Map<string, ConversationSession>;

  constructor() {
    this.projectId = process.env.GCP_PROJECT_ID || '';
    this.location = process.env.GCP_LOCATION || 'us-central1';
    this.model = process.env.VERTEX_MODEL || 'gemini-2.5-flash-lite';
    this.conversationSessions = new Map();
    
    console.log('Initializing SpeechService with:');
    console.log('- Project ID:', this.projectId);
    console.log('- Location:', this.location);
    console.log('- Model:', this.model);
    
    this.speechClient = new SpeechClient();
    this.ttsClient = new TextToSpeechClient();
    this.vertexAI = new VertexAI({
      project: this.projectId,
      location: this.location,
    });
    this.storageService = new StorageService();
    
    console.log('Vertex AI initialized successfully');
  }

  /**
   * Create a new conversation session
   */
  createConversationSession(sessionId?: string): string {
    const id = sessionId || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const session: ConversationSession = {
      sessionId: id,
      messages: [],
      createdAt: new Date(),
      lastActivity: new Date()
    };
    
    this.conversationSessions.set(id, session);
    console.log(`Created new conversation session: ${id}`);
    return id;
  }

  /**
   * Get or create a conversation session
   */
  getOrCreateSession(sessionId?: string): string {
    if (sessionId && this.conversationSessions.has(sessionId)) {
      const session = this.conversationSessions.get(sessionId)!;
      session.lastActivity = new Date();
      return sessionId;
    }
    return this.createConversationSession(sessionId);
  }

  /**
   * Add a message to a conversation session
   */
  addMessageToSession(sessionId: string, role: 'user' | 'assistant', content: string): void {
    const session = this.conversationSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    const message: ConversationMessage = {
      role,
      content,
      timestamp: new Date()
    };

    session.messages.push(message);
    session.lastActivity = new Date();

    // Keep only the last 20 messages to prevent context from getting too long
    if (session.messages.length > 20) {
      session.messages = session.messages.slice(-20);
    }

    console.log(`Added ${role} message to session ${sessionId}: "${content.substring(0, 50)}..."`);
  }

  /**
   * Get conversation history for a session
   */
  getConversationHistory(sessionId: string): ConversationMessage[] {
    const session = this.conversationSessions.get(sessionId);
    return session ? session.messages : [];
  }

  /**
   * Clear conversation history for a session
   */
  clearConversationHistory(sessionId: string): void {
    const session = this.conversationSessions.get(sessionId);
    if (session) {
      session.messages = [];
      session.lastActivity = new Date();
      console.log(`Cleared conversation history for session: ${sessionId}`);
    }
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): ConversationSession[] {
    return Array.from(this.conversationSessions.values());
  }

  /**
   * Clean up old sessions (older than 1 hour)
   */
  cleanupOldSessions(): void {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const sessionsToDelete: string[] = [];

    for (const [sessionId, session] of this.conversationSessions.entries()) {
      if (session.lastActivity < oneHourAgo) {
        sessionsToDelete.push(sessionId);
      }
    }

    sessionsToDelete.forEach(sessionId => {
      this.conversationSessions.delete(sessionId);
      console.log(`Cleaned up old session: ${sessionId}`);
    });

    if (sessionsToDelete.length > 0) {
      console.log(`Cleaned up ${sessionsToDelete.length} old conversation sessions`);
    }
  }

  /**
   * Test Gemini connection on startup
   */
  async testGeminiConnection(): Promise<boolean> {
    try {
      console.log('🧪 Testing Gemini connection...');
      
      const modelVersions = [
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro'
      ];

      for (const modelVersion of modelVersions) {
        try {
          console.log(`  Testing model: ${modelVersion}`);
          const model = this.vertexAI.getGenerativeModel({
            model: modelVersion,
            generationConfig: {
              maxOutputTokens: 50,
              temperature: 0.7,
            },
          });

          const result = await model.generateContent('Say "Hello" in one word');
          const response = result.response;
          
          // Handle different response formats
          let text = '';
          if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0]) {
            text = response.candidates[0].content.parts[0].text || '';
          } else if (typeof (response as any).text === 'function') {
            text = (response as any).text();
          } else if ((response as any).text) {
            text = (response as any).text;
          }
          
          if (text) {
            console.log(`✅ Gemini connection successful with model: ${modelVersion}`);
            console.log(`   Test response: "${text.trim()}"`);
            return true;
          }
        } catch (modelError) {
          console.log(`  ❌ Model ${modelVersion} failed:`, (modelError as Error).message);
          continue;
        }
      }

      console.log('❌ All Gemini models failed - using fallback mode');
      return false;
    } catch (error) {
      console.error('❌ Gemini connection test failed:', (error as Error).message);
      return false;
    }
  }

  /**
   * Convert audio buffer to text using Google Cloud Speech-to-Text
   */
  async transcribeAudio(audioBuffer: Buffer, sampleRate: number = 48000): Promise<string> {
    try {
      const request = {
        audio: {
          content: audioBuffer.toString('base64'),
        },
        config: {
          encoding: 'WEBM_OPUS' as const,
          sampleRateHertz: sampleRate,
          languageCode: 'en-US',
          enableAutomaticPunctuation: true,
          enableWordTimeOffsets: true,
          enableWordConfidence: true,
          model: 'latest_long',
          useEnhanced: true,
          // Enhanced recognition settings
          alternativeLanguageCodes: ['en-GB', 'en-AU'],
          maxAlternatives: 3,
          profanityFilter: false,
          enableSpeakerDiarization: false,
          diarizationSpeakerCount: 0,
          // Audio processing improvements
          audioChannelCount: 1,
          enableSeparateRecognitionPerChannel: false,
        },
      };

      const [response] = await this.speechClient.recognize(request);
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

  /**
   * Generate response using Vertex AI Gemini 2.5 with conversation context
   */
  async generateResponse(userMessage: string, sessionId?: string): Promise<string> {
    try {
      // Get or create session and add user message
      const currentSessionId = this.getOrCreateSession(sessionId);
      this.addMessageToSession(currentSessionId, 'user', userMessage);

      // Get conversation history
      const conversationHistory = this.getConversationHistory(currentSessionId);
      
      // Try Gemini 2.5 models in order of preference
      const modelVersions = [
        'gemini-2.5-flash-lite',
        'gemini-2.0-flash-exp',
        'gemini-1.5-pro',
        'gemini-1.5-flash',
        'gemini-1.0-pro'
      ];

      let lastError;
      for (const modelVersion of modelVersions) {
        try {
          console.log(`Trying model: ${modelVersion}`);
          const model = this.vertexAI.getGenerativeModel({
            model: modelVersion,
            generationConfig: {
              maxOutputTokens: 1000,
              temperature: 0.7,
              topP: 0.8,
            },
          });

          // Build conversation context
          let conversationContext = '';
          if (conversationHistory.length > 1) {
            // Include recent conversation history (excluding the current user message)
            const recentHistory = conversationHistory.slice(0, -1);
            conversationContext = recentHistory.map(msg => 
              `${msg.role === 'user' ? 'User' : 'Alexa'}: ${msg.content}`
            ).join('\n') + '\n\n';
          }

          const prompt = `You are Alexa, a friendly AI assistant designed for kids! Respond to the user's message in a warm, encouraging, and conversational way. Use contractions (like "I'm", "you're", "it's") and natural punctuation including questions and exclamations. Keep responses short, positive, and engaging - like talking to a young friend. Avoid complex words and make it sound natural when spoken aloud.

${conversationContext ? `Previous conversation:\n${conversationContext}` : ''}User: ${userMessage}

Alexa:`;

          const result = await model.generateContent(prompt);
          const response = result.response;
          
          // Handle different response formats
          let text = '';
          if (response.candidates && response.candidates[0] && response.candidates[0].content && response.candidates[0].content.parts && response.candidates[0].content.parts[0]) {
            text = response.candidates[0].content.parts[0].text || '';
          } else if (typeof (response as any).text === 'function') {
            text = (response as any).text();
          } else if ((response as any).text) {
            text = (response as any).text;
          }
          
          const finalResponse = text || 'I apologize, but I couldn\'t generate a response.';
          
          // Add assistant response to conversation history
          this.addMessageToSession(currentSessionId, 'assistant', finalResponse);
          
          console.log(`Successfully used model: ${modelVersion}`);
          console.log(`Session ${currentSessionId} now has ${conversationHistory.length + 1} messages`);
          return finalResponse;
        } catch (modelError) {
          console.log(`Model ${modelVersion} failed:`, (modelError as Error).message);
          lastError = modelError;
          continue;
        }
      }

      // If all models fail, throw the last error
      throw lastError || new Error('All model versions failed');
    } catch (error) {
      console.error('Error generating response:', error);
      throw new Error('Failed to generate response');
    }
  }

  /**
   * Clean and prepare text for more natural speech - keep punctuation for natural flow
   */
  private cleanTextForSpeech(text: string): string {
    // Remove emojis/symbols only; KEEP punctuation for natural speech
    const noEmoji = text.replace(
      /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}]/gu,
      ""
    );
    // Collapse spaces but keep punctuation intact
    return noEmoji.replace(/\s+/g, " ").trim();
  }

  /**
   * Build gentle SSML with natural pauses and emphasis
   */
  private buildSSML(text: string): string {
    // Split on sentence boundaries but keep ? and ! for natural intonation
    const parts = text.match(/[^.!?]+[.!?]?/g) || [text];
    const chunks = parts.map(s => s.trim()).filter(Boolean);

    // Light, global baseline with per-sentence breaks
    const body = chunks
      .map(s => {
        // Add natural sentence breaks
        return `<s>${s}</s><break time="180ms"/>`;
      })
      .join("");

    return `<speak>
      <prosody rate="0.98" pitch="+0.2st">
        ${body}
      </prosody>
    </speak>`;
  }

  /**
   * Convert text to speech using Google Cloud Text-to-Speech with natural, kid-friendly voice
   */
  async synthesizeSpeech(text: string): Promise<Buffer> {
    try {
      // Clean the text (remove emojis, keep punctuation)
      const cleaned = this.cleanTextForSpeech(text);
      console.log(`Original text: "${text}"`);
      console.log(`Cleaned text: "${cleaned}"`);

      // Build natural SSML with proper pauses and intonation
      const ssml = this.buildSSML(cleaned);
      console.log(`SSML: ${ssml}`);

      const [response] = await this.ttsClient.synthesizeSpeech({
        input: { ssml }, // ✅ SSML only - no text input
        voice: {
          languageCode: "en-US",
          name: "en-US-Neural2-A", // Kid-friendly male voice
          ssmlGender: 'MALE' as const,
        },
        audioConfig: {
          audioEncoding: "MP3",
          // Keep neutral; let SSML handle pacing/intonation
          speakingRate: 1.0,
          pitch: 0.0,
          effectsProfileId: ["small-bluetooth-speaker-class-device"], // Better for kids
        },
      });

      return Buffer.from(response.audioContent as Uint8Array);
    } catch (error) {
      console.error('Error synthesizing speech:', error);
      throw new Error('Failed to synthesize speech');
    }
  }

  /**
   * Process complete voice interaction: transcribe -> generate response -> synthesize
   */
  async processVoiceInteraction(audioBuffer: Buffer, sampleRate: number = 48000, sessionId?: string): Promise<{
    transcription: string;
    response: string;
    audioResponse: Buffer;
    inputAudioUrl?: string;
    outputAudioUrl?: string;
    sessionId: string;
  }> {
    try {
      console.log(`Processing voice interaction with ${audioBuffer.length} bytes of audio`);
      
      // Step 0: Save input audio to Cloud Storage
      let inputAudioUrl: string | undefined;
      try {
        inputAudioUrl = await this.storageService.uploadAudioFile(audioBuffer);
        console.log('Input audio saved to Cloud Storage:', inputAudioUrl);
      } catch (storageError) {
        console.warn('Failed to save input audio to Cloud Storage:', (storageError as Error).message);
        // Continue processing even if storage fails
      }
      
      // Step 1: Transcribe audio to text
      const transcription = await this.transcribeAudio(audioBuffer, sampleRate);
      
      if (!transcription) {
        console.log('No transcription returned, using fallback message');
        // Instead of throwing an error, use a fallback message
        const fallbackTranscription = 'Audio received but no speech detected';
        console.log('Using fallback transcription:', fallbackTranscription);
        
        // Generate a simple response for the fallback
        const fallbackResponse = 'I heard some audio but couldn\'t make out what you said. Please try speaking more clearly.';
        
        // Generate audio for the fallback response
        const audioResponse = await this.synthesizeSpeech(fallbackResponse);
        
        return {
          transcription: fallbackTranscription,
          response: fallbackResponse,
          audioResponse: audioResponse,
          inputAudioUrl,
          sessionId: this.getOrCreateSession(sessionId),
        };
      }

      // Step 2: Generate AI response with conversation context
      let response;
      let audioResponse;
      const currentSessionId = this.getOrCreateSession(sessionId);
      
      try {
        response = await this.generateResponse(transcription, currentSessionId);
        audioResponse = await this.synthesizeSpeech(response);
      } catch (aiError) {
        console.log('AI response failed, using fallback:', (aiError as Error).message);
        // Fallback response when AI fails
        response = `I heard you say: "${transcription}". However, I'm having trouble generating a proper response right now. The speech recognition is working perfectly though!`;
        audioResponse = await this.synthesizeSpeech(response);
      }

      // Step 3: Save TTS audio to Cloud Storage
      let outputAudioUrl: string | undefined;
      try {
        outputAudioUrl = await this.storageService.uploadTTSAudioFile(audioResponse);
        console.log('TTS audio saved to Cloud Storage:', outputAudioUrl);
      } catch (storageError) {
        console.warn('Failed to save TTS audio to Cloud Storage:', (storageError as Error).message);
        // Continue even if storage fails
      }

      return {
        transcription,
        response,
        audioResponse,
        inputAudioUrl,
        outputAudioUrl,
        sessionId: currentSessionId,
      };
    } catch (error) {
      console.error('Error processing voice interaction:', error);
      throw error;
    }
  }
}

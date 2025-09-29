# 🎤 Simple Voice Assistant with Google Cloud AI

A simple voice assistant that uses Porcupine for wake word detection and Google Cloud services for speech processing.

## Features

- **Wake Word Detection**: Uses Porcupine to listen for wake words
- **Speech-to-Text**: Google Cloud Speech-to-Text API
- **AI Responses**: Google Cloud Vertex AI (Gemini) for intelligent responses
- **Text-to-Speech**: Google Cloud Text-to-Speech API with natural voice
- **Simple UI**: Clean, minimal interface focused on functionality

## Prerequisites

1. **Node.js** (v14 or higher)
2. **Google Cloud Project** with the following APIs enabled:
   - Speech-to-Text API
   - Text-to-Speech API
   - Vertex AI API
3. **GCP Service Account** with appropriate permissions
4. **GCP Key File** (`gcp-key.json`) in the `alexa-speech-assist` directory

## Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Ensure GCP Key File is Present**:
   - The `gcp-key.json` file should be located at `../../alexa-speech-assist/gcp-key.json`
   - This file contains your Google Cloud service account credentials

3. **Get Porcupine Access Key**:
   - Sign up at [Picovoice Console](https://console.picovoice.ai/)
   - Get your free access key
   - You'll need this to run the voice assistant

## Running the Voice Assistant

### Option 1: Using the Startup Script (Recommended)
```bash
./start-voice-assistant.sh
```

This will:
- Start the API server on port 3001
- Start the demo server on port 5000
- Open http://localhost:5000 in your browser

### Option 2: Manual Start

1. **Start the API Server** (Terminal 1):
   ```bash
   node server.js
   ```

2. **Start the Demo Server** (Terminal 2):
   ```bash
   node scripts/run_demo.js en
   ```

3. **Open Browser**:
   - Navigate to http://localhost:5000

## Usage

1. **Enter Access Key**: Input your Porcupine access key
2. **Select Wake Word**: Choose from available wake words
3. **Click Start**: Begin listening for wake words
4. **Speak**: Say the wake word, then speak your message
5. **Listen**: The assistant will respond with AI-generated speech

## How It Works

1. **Wake Word Detection**: Porcupine continuously listens for the selected wake word
2. **Recording**: When wake word is detected, automatically starts recording
3. **Speech Processing**: Audio is sent to Google Cloud Speech-to-Text
4. **AI Response**: Transcription is processed by Gemini AI
5. **Text-to-Speech**: Response is converted to natural speech
6. **Playback**: Audio response is played back to the user
7. **Return to Listening**: System returns to wake word detection

## API Endpoints

- `GET /health` - Health check
- `POST /api/process-speech` - Process audio and return transcription + response

## Troubleshooting

### Common Issues

1. **"GCP key file not found"**:
   - Ensure `gcp-key.json` is in the correct location
   - Check file permissions

2. **"Microphone access denied"**:
   - Allow microphone access in your browser
   - Check browser permissions

3. **"API Error"**:
   - Ensure the API server is running on port 3001
   - Check Google Cloud credentials and billing

4. **"Porcupine access key error"**:
   - Verify your access key is correct
   - Check if you have remaining free requests

### Debug Mode

Open browser developer tools (F12) to see detailed logs and error messages.

## File Structure

```
web/
├── index.html              # Main voice assistant interface
├── server.js               # API server with Google Cloud integration
├── package.json            # Dependencies
├── start-voice-assistant.sh # Startup script
├── scripts/
│   ├── porcupine.js        # Porcupine integration
│   └── run_demo.js         # Demo server
├── keywords/               # Wake word models
└── models/                 # Porcupine models
```

## Technologies Used

- **Frontend**: HTML5, JavaScript, Web Audio API
- **Wake Word**: Porcupine (Picovoice)
- **Speech-to-Text**: Google Cloud Speech-to-Text
- **AI**: Google Cloud Vertex AI (Gemini)
- **Text-to-Speech**: Google Cloud Text-to-Speech
- **Backend**: Node.js, Express.js

## License

MIT License - Feel free to use and modify for your projects!
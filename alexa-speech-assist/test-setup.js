// Simple test script to verify Google Cloud setup
const { SpeechClient } = require('@google-cloud/speech');
const { TextToSpeechClient } = require('@google-cloud/text-to-speech');
const { VertexAI } = require('@google-cloud/vertexai');
require('dotenv').config();

async function testSetup() {
  console.log('🧪 Testing Google Cloud setup...\n');

  try {
    // Test Speech-to-Text
    console.log('1. Testing Speech-to-Text API...');
    const speechClient = new SpeechClient();
    console.log('   ✅ Speech-to-Text client initialized');

    // Test Text-to-Speech
    console.log('2. Testing Text-to-Speech API...');
    const ttsClient = new TextToSpeechClient();
    console.log('   ✅ Text-to-Speech client initialized');

    // Test Vertex AI
    console.log('3. Testing Vertex AI...');
    const vertexAI = new VertexAI({
      project: process.env.GCP_PROJECT_ID,
      location: process.env.GCP_LOCATION,
    });
    console.log('   ✅ Vertex AI client initialized');

    // Test environment variables
    console.log('4. Checking environment variables...');
    const requiredVars = ['GCP_PROJECT_ID', 'GCP_LOCATION', 'VERTEX_MODEL', 'GOOGLE_APPLICATION_CREDENTIALS'];
    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.log('   ❌ Missing environment variables:', missingVars.join(', '));
      console.log('   Please check your .env file');
    } else {
      console.log('   ✅ All required environment variables are set');
    }

    console.log('\n🎉 Setup test completed!');
    console.log('\nNext steps:');
    console.log('1. Make sure your Google Cloud project has billing enabled');
    console.log('2. Enable Speech-to-Text API, Text-to-Speech API, and Vertex AI API');
    console.log('3. Place your service account key as gcp-key.json in the project root');
    console.log('4. Run: npm run dev');
    console.log('5. Visit: http://localhost:8080');

  } catch (error) {
    console.error('❌ Setup test failed:', error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Check if gcp-key.json exists in project root');
    console.log('2. Verify the service account has required permissions');
    console.log('3. Ensure APIs are enabled in Google Cloud Console');
    console.log('4. Check your .env file configuration');
  }
}

testSetup();

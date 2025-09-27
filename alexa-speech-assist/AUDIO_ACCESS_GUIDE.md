# Audio File Access Guide for Backend Analyzer

## 🔗 **Access Methods**

### **1. Direct Cloud Storage URLs (Recommended)**

Each voice interaction returns Cloud Storage URLs that you can use directly:

```json
{
  "transcription": "Hello, how are you?",
  "response": "I'm doing great, thanks for asking!",
  "inputAudioUrl": "gs://ccnyhack-audio/audio_12345_1234567890.webm",
  "outputAudioUrl": "gs://ccnyhack-audio/tts_67890_1234567890.mp3"
}
```

### **2. API Endpoints for External Access**

#### **Get All Audio Files with URLs**
```bash
GET http://localhost:8080/api/storage/audio-files
```

Response:
```json
{
  "files": [
    {
      "fileName": "audio_12345_1234567890.webm",
      "signedUrl": "https://storage.googleapis.com/ccnyhack-audio/audio_12345_1234567890.webm?X-Goog-Algorithm=...",
      "gcsPath": "gs://ccnyhack-audio/audio_12345_1234567890.webm"
    }
  ]
}
```

#### **Get Signed URL for Specific File**
```bash
GET http://localhost:8080/api/storage/signed-url/audio_12345_1234567890.webm
```

#### **Get Storage Statistics**
```bash
GET http://localhost:8080/api/storage/stats
```

### **3. Direct Google Cloud Storage Access**

#### **Using Google Cloud SDK**
```bash
# Download file
gsutil cp gs://ccnyhack-audio/audio_12345_1234567890.webm ./audio_file.webm

# List all files
gsutil ls gs://ccnyhack-audio/

# Get file metadata
gsutil stat gs://ccnyhack-audio/audio_12345_1234567890.webm
```

#### **Using Google Cloud Storage Client Libraries**

**Python:**
```python
from google.cloud import storage

client = storage.Client()
bucket = client.bucket('ccnyhack-audio')

# Download file
blob = bucket.blob('audio_12345_1234567890.webm')
blob.download_to_filename('audio_file.webm')

# Get file metadata
blob.reload()
print(f"Size: {blob.size} bytes")
print(f"Created: {blob.time_created}")
```

**Node.js:**
```javascript
const { Storage } = require('@google-cloud/storage');
const storage = new Storage();

async function downloadAudioFile(fileName) {
  const bucket = storage.bucket('ccnyhack-audio');
  const file = bucket.file(fileName);
  
  await file.download({
    destination: `./downloads/${fileName}`
  });
  
  console.log(`Downloaded ${fileName}`);
}
```

### **4. WebSocket Real-time Access**

Connect to the WebSocket to get real-time audio URLs:

```javascript
const socket = io('http://localhost:8080');

socket.on('speech-result', (data) => {
  console.log('Input Audio URL:', data.inputAudioUrl);
  console.log('Output Audio URL:', data.outputAudioUrl);
  
  // Download or process the audio files
  fetch(data.inputAudioUrl).then(response => response.blob());
});
```

## 📁 **File Organization**

### **File Naming Convention**
- **Input Audio**: `audio_[uuid]_[timestamp].webm`
- **TTS Audio**: `tts_[uuid]_[timestamp].mp3`

### **File Types**
- **Input**: WebM format with Opus codec (optimized for speech)
- **Output**: MP3 format (compatible with most players)

## 🔐 **Authentication**

### **Service Account (Recommended)**
Use the same service account JSON file (`gcp-key.json`) that the voice assistant uses:

```bash
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-key.json"
```

### **API Key (Alternative)**
```bash
export GOOGLE_CLOUD_PROJECT="ccnyhack"
export GOOGLE_APPLICATION_CREDENTIALS="./gcp-key.json"
```

## 🚀 **Backend Analyzer Integration**

### **Example: Python Analyzer**
```python
import requests
import json
from google.cloud import storage

class VoiceAnalyzer:
    def __init__(self, base_url="http://localhost:8080"):
        self.base_url = base_url
        self.storage_client = storage.Client()
        self.bucket = self.storage_client.bucket('ccnyhack-audio')
    
    def get_all_audio_files(self):
        """Get all audio files with signed URLs"""
        response = requests.get(f"{self.base_url}/api/storage/audio-files")
        return response.json()['files']
    
    def download_audio_file(self, file_name, local_path):
        """Download audio file from Cloud Storage"""
        blob = self.bucket.blob(file_name)
        blob.download_to_filename(local_path)
        return local_path
    
    def analyze_conversation(self, input_audio_url, output_audio_url):
        """Analyze a complete conversation"""
        # Download files
        input_file = self.download_audio_file(input_audio_url.split('/')[-1], 'input.webm')
        output_file = self.download_audio_file(output_audio_url.split('/')[-1], 'output.mp3')
        
        # Your analysis logic here
        # ...
        
        return analysis_results

# Usage
analyzer = VoiceAnalyzer()
files = analyzer.get_all_audio_files()
for file_info in files:
    print(f"File: {file_info['fileName']}")
    print(f"URL: {file_info['signedUrl']}")
```

### **Example: Node.js Analyzer**
```javascript
const axios = require('axios');
const { Storage } = require('@google-cloud/storage');

class VoiceAnalyzer {
  constructor(baseUrl = 'http://localhost:8080') {
    this.baseUrl = baseUrl;
    this.storage = new Storage();
    this.bucket = this.storage.bucket('ccnyhack-audio');
  }

  async getAllAudioFiles() {
    const response = await axios.get(`${this.baseUrl}/api/storage/audio-files`);
    return response.data.files;
  }

  async downloadAudioFile(fileName, localPath) {
    const file = this.bucket.file(fileName);
    await file.download({ destination: localPath });
    return localPath;
  }

  async analyzeConversation(inputAudioUrl, outputAudioUrl) {
    const inputFileName = inputAudioUrl.split('/').pop();
    const outputFileName = outputAudioUrl.split('/').pop();
    
    await this.downloadAudioFile(inputFileName, `./downloads/${inputFileName}`);
    await this.downloadAudioFile(outputFileName, `./downloads/${outputFileName}`);
    
    // Your analysis logic here
    // ...
    
    return analysisResults;
  }
}

// Usage
const analyzer = new VoiceAnalyzer();
analyzer.getAllAudioFiles().then(files => {
  files.forEach(file => {
    console.log(`File: ${file.fileName}`);
    console.log(`URL: ${file.signedUrl}`);
  });
});
```

## 📊 **Monitoring and Analytics**

### **Track Usage**
```bash
# Get storage statistics
curl http://localhost:8080/api/storage/stats

# Get file list
curl http://localhost:8080/api/storage/files
```

### **Real-time Monitoring**
Connect to WebSocket for real-time file creation notifications and process them immediately.

## 🔧 **Troubleshooting**

### **Common Issues**
1. **Authentication**: Make sure your service account has Storage Object Viewer/Admin permissions
2. **CORS**: If accessing from browser, ensure CORS is configured
3. **File Access**: Signed URLs expire after 1 hour by default

### **Debug Commands**
```bash
# Test bucket access
gsutil ls gs://ccnyhack-audio/

# Check file permissions
gsutil stat gs://ccnyhack-audio/audio_12345_1234567890.webm

# Test API endpoints
curl http://localhost:8080/api/storage/stats
```

This guide provides multiple ways to access your audio files for backend analysis! 🎉

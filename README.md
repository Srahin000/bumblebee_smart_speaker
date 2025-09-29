# 🏆 Bumblebee Smart Speaker - Speech Impediment Therapy Assistant

**Winner of 1st Place - Transformative Learning Track**  
**CCNY Byte X Google AI Labs Hackathon**

An intelligent voice assistant designed to provide personalized learning experiences for children, featuring real-time pronunciation analysis and adaptive AI responses.

## 🌟 Project Overview

Bumblebee Smart Speaker is a revolutionary educational voice assistant that combines wake word detection, speech recognition, pronunciation analysis, and adaptive AI to create personalized learning experiences for children. The system analyzes children's speech patterns, identifies pronunciation weaknesses, and adapts its responses to help improve their learning outcomes.

## 🎯 Key Features

### 🎤 **Wake Word Detection**
- Powered by Picovoice Porcupine engine
- Supports multiple wake words including "Bumblebee"
- Real-time audio processing with low latency

### 🗣️ **Speech Recognition & Analysis**
- Google Cloud Speech-to-Text integration
- Real-time transcription of children's responses
- Audio storage and session management

### 📊 **Pronunciation Analysis**
- **Hugging Face Wav2Vec2-Large-LV60** model integration
- Fine-tuned on multi-lingual Common Voice dataset
- Converts speech to International Phonetic Alphabet (IPA)
- Identifies pronunciation patterns and weaknesses

### 🤖 **Adaptive AI Responses**
- Google Vertex AI (Gemini) integration
- Personalized responses based on pronunciation analysis
- Educational content tailored to individual learning needs
- Progress tracking and improvement recommendations

### 📱 **Web Interface**
- Clean, child-friendly web interface
- Real-time status indicators
- Session management and history
- Audio playback and analysis tools

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Raspberry Pi  │    │   Web Interface  │    │  Cloud Services │
│                 │    │                  │    │                 │
│ • Wake Word     │◄──►│ • Frontend UI    │◄──►│ • Google Speech │
│   Detection     │    │ • Audio Capture  │    │ • Vertex AI     │
│ • Audio Capture │    │ • Session Mgmt   │    │ • Firebase      │
│ • Local Server  │    │ • Real-time UI   │    │ • Hugging Face  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## 🚀 Technology Stack

### **Frontend**
- HTML5, CSS3, JavaScript
- Picovoice Web Voice Processor
- Real-time audio processing

### **Backend**
- Node.js with Express.js
- Google Cloud Speech-to-Text
- Google Cloud Text-to-Speech
- Google Vertex AI (Gemini)
- Firebase Firestore

### **ML/AI Components**
- **Hugging Face Wav2Vec2-Large-LV60**
- Multi-lingual Common Voice dataset
- IPA transcription pipeline
- Pronunciation analysis algorithms

### **Hardware**
- Raspberry Pi deployment
- Real-time audio processing
- Wake word detection

## 📁 Project Structure

```
bumblebee_smart_speaker/
├── bumblebee/
│   ├── binding/web/          # Picovoice web bindings
│   ├── demo/web/             # Main application
│   │   ├── server.js         # Express server
│   │   ├── index.html        # Web interface
│   │   ├── analysis/         # ML analysis tools
│   │   │   ├── populate.py   # Firebase data population
│   │   │   └── api.py       # Analysis API
│   │   ├── storage/          # Audio & session storage
│   │   └── scripts/          # Utility scripts
│   ├── lib/                  # Platform libraries
│   └── resources/            # Wake word models
└── README.md
```

## 🛠️ Installation & Setup

### Prerequisites
- Node.js (v14 or higher)
- Python 3.8+
- Google Cloud Platform account
- Firebase project
- Raspberry Pi (for deployment)

### 1. Clone the Repository
```bash
git clone https://github.com/Srahin000/bumblebee_smart_speaker.git
cd bumblebee_smart_speaker
```

### 2. Install Dependencies
```bash
# Install Node.js dependencies
cd bumblebee/demo/web
npm install

# Install Python dependencies for analysis
pip install -r requirements.txt
```

### 3. Configure Google Cloud Services
```bash
# Set up Google Cloud credentials
export GOOGLE_APPLICATION_CREDENTIALS="path/to/your/gcp-key.json"

# Configure Firebase
firebase login
firebase use your-project-id
```

### 4. Set Up Environment Variables
```bash
# Create .env file
cp .env.example .env
# Edit .env with your configuration
```

### 5. Run the Application
```bash
# Start the server
npm start

# Access the web interface
open http://localhost:3001
```

## 🎮 Usage

### **For Children**
1. Open the web interface on your device
2. Click "Start Listening" to activate the assistant
3. Say "Hey Bumblebee" to wake up the assistant
4. Ask questions or engage in educational conversations
5. Receive personalized responses based on your pronunciation

### **For Educators/Parents**
1. Access the analysis dashboard
2. Review pronunciation analysis reports
3. Track learning progress over time
4. View session transcripts and audio recordings
5. Monitor improvement in specific phonetic areas

## 📊 ML Pipeline

### **Pronunciation Analysis Flow**
```
Audio Input → Wav2Vec2-Large-LV60 → IPA Transcription → Pattern Analysis → Weakness Identification → Adaptive Response Generation
```

### **Key ML Components**
- **Speech-to-IPA**: Converts children's speech to phonetic representation
- **Pattern Recognition**: Identifies common pronunciation challenges
- **Progress Tracking**: Monitors improvement over time
- **Adaptive Learning**: Adjusts difficulty and content based on performance

## 🏆 Hackathon Achievement

**CCNY Byte X Google AI Labs Hackathon - 1st Place Winner**

This project won first place in the **Transformative Learning Track** by demonstrating:

- **Innovation**: Novel combination of wake word detection, speech analysis, and adaptive AI
- **Impact**: Personalized learning experiences for children with speech challenges
- **Technical Excellence**: Integration of multiple cutting-edge technologies
- **Practical Application**: Deployable solution on Raspberry Pi hardware

## 🔮 Future Enhancements

- [ ] Multi-language support expansion
- [ ] Advanced pronunciation scoring algorithms
- [ ] Integration with educational curricula
- [ ] Parent/teacher dashboard improvements
- [ ] Offline mode capabilities
- [ ] Voice emotion recognition
- [ ] Gamification elements

## 🤝 Contributing

We welcome contributions! Please see our contributing guidelines for details on how to:

- Report bugs
- Suggest new features
- Submit pull requests
- Improve documentation

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👥 Team

**CCNY Byte X Google AI Labs Hackathon Team**
- Developed innovative voice assistant technology
- Integrated multiple AI/ML services
- Created transformative learning solutions

## 🙏 Acknowledgments

- **Google AI Labs** for providing the hackathon platform
- **CCNY Byte** for organizing the competition
- **Hugging Face** for the Wav2Vec2 model
- **Picovoice** for wake word detection technology
- **Google Cloud** for speech and AI services

---

**🏆 Award-Winning Project | 🎓 Educational Technology | 🤖 AI-Powered Learning**

*Transforming education through intelligent voice technology*

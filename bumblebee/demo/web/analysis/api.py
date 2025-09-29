from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import tempfile
import torch
import soundfile as sf
import librosa
from transformers import Wav2Vec2ForCTC, Wav2Vec2Processor, Wav2Vec2FeatureExtractor, Wav2Vec2CTCTokenizer
from google import genai
from pydantic import BaseModel
import dotenv
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from upstash_redis import Redis
import json
from pydub import AudioSegment

dotenv.load_dotenv()

app = Flask(__name__)
CORS(app)

# Firebase setup
cred = credentials.Certificate("bytehacks-db-firebase-adminsdk-fbsvc-013d13c8c8.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Redis setup
redis_client = Redis(
    url=os.getenv("UPSTASH_REDIS_REST_URL"),
    token=os.getenv("UPSTASH_REDIS_REST_TOKEN")
)

class RhoticCount(BaseModel):
    incorrect: int
    total: int

class PersonalizationUpdate(BaseModel):
    new_info: str

model_name = "facebook/wav2vec2-lv-60-espeak-cv-ft"
feature_extractor = Wav2Vec2FeatureExtractor.from_pretrained(model_name)
tokenizer = Wav2Vec2CTCTokenizer.from_pretrained(model_name)
processor = Wav2Vec2Processor(feature_extractor=feature_extractor, tokenizer=tokenizer)
model = Wav2Vec2ForCTC.from_pretrained(model_name)

def extract_phonemes(audio_file):
    audio_input, sampling_rate = sf.read(audio_file)
    
    if sampling_rate != 16000:
        audio_input = librosa.resample(audio_input, orig_sr=sampling_rate, target_sr=16000)
    
    input_values = processor(audio_input, sampling_rate=16000, return_tensors="pt").input_values
    
    with torch.no_grad():
        logits = model(input_values).logits
        predicted_ids = torch.argmax(logits, dim=-1)
        phonetic_transcription = processor.batch_decode(predicted_ids)
    print(phonetic_transcription[0])
    return phonetic_transcription[0]

def analyze_pronunciation(transcript, phonemes):
    print(transcript)
    print(phonemes)
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    prompt = f"""Count rhotic sounds in this child's speech:

English transcript: {transcript}
IPA phonemes transcript: {phonemes}

Return the count of incorrect rhotic pronunciations and total rhotic sounds attempted."""
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": RhoticCount,
        },
    )
    
    return response.parsed

def update_personalization(transcript, existing_info=""):
    client = genai.Client(api_key=os.getenv("GEMINI_API_KEY"))
    
    prompt = f"""Extract any personal information about the child from this transcript and add it to their profile.

Current profile: {existing_info}
New transcript: {transcript}

Look for information like: name, age, favorite color, favorite toy, pet names, siblings, hobbies, etc.
Only return NEW information that isn't already in the profile. Keep it simple and conversational.
If no new personal information is found, return empty string."""
    
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=prompt,
        config={
            "response_mime_type": "application/json",
            "response_schema": PersonalizationUpdate,
        },
    )
    
    return response.parsed.new_info

@app.route('/analyze', methods=['POST'])
def analyze():
    try:
        transcript = request.form.get('transcript')
        if not transcript:
            return jsonify({'error': 'No transcript provided'}), 400
        
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file provided'}), 400
        
        audio_file = request.files['audio']
        if audio_file.filename == '':
            return jsonify({'error': 'No audio file selected'}), 400

        print("POINT HIT!!!!!!! WITH CORRECT FILES!!!")
        
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_input_file:
            audio_file.save(tmp_input_file.name)
            
            # Convert WebM to WAV
            audio = AudioSegment.from_file(tmp_input_file.name, format="webm")
            
            with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_wav_file:
                audio.export(tmp_wav_file.name, format="wav")
                
                phonemes = extract_phonemes(tmp_wav_file.name)
                
                counts = analyze_pronunciation(transcript, phonemes)
                
                # Clean up temporary files
                os.unlink(tmp_input_file.name)
                os.unlink(tmp_wav_file.name)
            
            # Store daily scores in Firestore (unchanged)
            today = datetime.now().strftime("%Y-%m-%d")
            doc_ref = db.collection("daily_scores").document(today)
            doc = doc_ref.get()
            
            if doc.exists:
                data = doc.to_dict()
                new_data = {
                    "incorrect": data.get("incorrect", 0) + counts.incorrect,
                    "total": data.get("total", 0) + counts.total,
                    "date": today
                }
            else:
                new_data = {
                    "incorrect": counts.incorrect,
                    "total": counts.total,
                    "date": today
                }
            
            doc_ref.set(new_data)
            
            # Handle personalization with Redis
            existing_info = ""
            try:
                redis_data = redis_client.get("child_profile")
                if redis_data:
                    profile_data = json.loads(redis_data)
                    existing_info = profile_data.get("info", "")
            except Exception as redis_error:
                print(f"Redis get error: {redis_error}")
            
            new_info = update_personalization(transcript, existing_info)
            
            if new_info:
                updated_info = f"{existing_info} {new_info}".strip()
                profile_data = {
                    "info": updated_info,
                    "last_updated": datetime.now().isoformat()
                }
                try:
                    redis_client.set("child_profile", json.dumps(profile_data))
                except Exception as redis_error:
                    print(f"Redis set error: {redis_error}")
            
            return jsonify({
                'transcript': transcript,
                'phonemes': phonemes,
                'incorrect': counts.incorrect,
                'total': counts.total
            })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/scores', methods=['GET'])
def get_scores():
    try:
        docs = db.collection("daily_scores").order_by("date").stream()
        scores = [doc.to_dict() for doc in docs]
        return jsonify({'scores': scores})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/profile', methods=['GET'])
def get_profile():
    try:
        # Get profile from Redis
        redis_data = redis_client.get("child_profile")
        if redis_data:
            profile_data = json.loads(redis_data)
            return jsonify(profile_data)
        else:
            return jsonify({'info': '', 'last_updated': None})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'healthy lolol'})

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5050)
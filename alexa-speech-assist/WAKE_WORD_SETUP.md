# Wake Word Setup Instructions

## Getting Your Porcupine Access Key

To enable the "Hey Voxe" wake word detection, you need to get a free Porcupine access key:

### Step 1: Sign up for Picovoice Console
1. Go to [https://console.picovoice.ai/](https://console.picovoice.ai/)
2. Sign up for a free account
3. Verify your email address

### Step 2: Get Your Access Key
1. Log into the Picovoice Console
2. Go to the "Access Key" section
3. Copy your access key

### Step 3: Configure Your Environment
1. Open the `.env` file in your project root
2. Replace `your-porcupine-access-key-here` with your actual access key:
   ```
   PORCUPINE_ACCESS_KEY=your-actual-access-key-here
   ```

### Step 4: Restart the Server
```bash
npm run dev
```

The server will run on `http://localhost:8080`

## How It Works

- **Wake Word Detection**: The app continuously listens for "Hey Voxe"
- **Automatic Activation**: When detected, it automatically starts recording
- **Natural Flow**: After recording stops, it resumes listening for the wake word
- **Fallback Mode**: If Porcupine isn't available, you can still click the microphone

## Features

- ✅ **"Hey Voxe" wake word detection** (custom trained model)
- ✅ **Continuous listening** (only when not recording)
- ✅ **Visual feedback** with status indicators
- ✅ **Automatic recording** after wake word
- ✅ **Resume listening** after processing
- ✅ **Fallback to manual mode** if needed

## Troubleshooting

### Wake Word Not Working?
1. Check your microphone permissions
2. Verify your Porcupine access key is correct
3. Make sure you're saying "Hey Voxe" clearly
4. Check the browser console for errors

### Access Key Issues?
1. Make sure you're logged into Picovoice Console
2. Verify the key is copied correctly (no extra spaces)
3. Check that the key is active in your account

### Fallback Mode
If wake word detection fails, the app will automatically fall back to manual recording mode where you can click the microphone button to start/stop recording.

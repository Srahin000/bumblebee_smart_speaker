# Alexa Speech Assist

A Node.js TypeScript project for Alexa speech assistance using Google Cloud services.

## Features

- Express.js server with TypeScript
- Audio file upload handling with Multer
- Google Cloud Speech-to-Text integration
- Google Cloud Vertex AI integration
- Security middleware (Helmet, CORS, Rate Limiting)
- Input validation with Zod
- Environment configuration

## Prerequisites

- Node.js (v18 or higher)
- Google Cloud Project with billing enabled
- Google Cloud service account with appropriate permissions

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Google Cloud Setup

1. **Create a Google Cloud Project** (if you don't have one)
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project or select an existing one

2. **Enable Required APIs**
   - Enable the **Speech-to-Text API**
   - Enable the **Vertex AI API**

3. **Create Service Account**
   - Go to IAM & Admin > Service Accounts
   - Create a new service account
   - Grant the following roles:
     - Speech-to-Text API User
     - Vertex AI User
     - Storage Object Viewer (if needed)

4. **Download Service Account Key**
   - Click on your service account
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Choose JSON format
   - Download the key file

5. **Place Service Account Key**
   - Rename the downloaded file to `gcp-key.json`
   - Place it in the **project root directory** (same level as package.json)
   - ⚠️ **Important**: Never commit this file to version control!

### 3. Environment Configuration

1. **Copy the environment template:**
   ```bash
   cp .env.example .env
   ```

2. **Update the .env file with your values:**
   ```env
   PORT=8080
   CORS_ORIGIN=http://localhost:8080
   GCP_PROJECT_ID=your-actual-project-id
   GCP_LOCATION=us-central1
   VERTEX_MODEL=gemini-1.5-flash
   GOOGLE_APPLICATION_CREDENTIALS=./gcp-key.json
   NODE_ENV=development
   ```

## Development

### Start Development Server
```bash
npm run dev
```

The server will start with hot reloading enabled.

### Build for Production
```bash
npm run build
```

### Start Production Server
```bash
npm start
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /upload-audio` - Upload audio file (placeholder)
- `POST /process-speech` - Process speech with Google Cloud services (placeholder)

## Project Structure

```
alexa-speech-assist/
├── src/
│   └── server.ts          # Main server file
├── public/                # Static files
├── dist/                  # Compiled JavaScript (after build)
├── gcp-key.json          # Google Cloud service account key (DO NOT COMMIT)
├── .env                  # Environment variables (DO NOT COMMIT)
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rules
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
└── README.md             # This file
```

## Security Notes

- The `gcp-key.json` file contains sensitive credentials and is excluded from version control
- Environment variables are loaded from `.env` file (also excluded from version control)
- Rate limiting is enabled to prevent abuse
- CORS is configured for security
- Helmet middleware provides additional security headers

## Next Steps

1. Implement Google Cloud Speech-to-Text integration in the upload endpoints
2. Add Vertex AI integration for natural language processing
3. Add input validation using Zod schemas
4. Implement proper error handling and logging
5. Add unit tests
6. Add API documentation

## Troubleshooting

- Ensure your Google Cloud project has billing enabled
- Verify that the required APIs are enabled
- Check that your service account has the correct permissions
- Ensure the `gcp-key.json` file is in the correct location
- Verify your environment variables are set correctly

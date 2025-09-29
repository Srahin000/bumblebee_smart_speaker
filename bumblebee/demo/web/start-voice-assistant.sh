#!/bin/bash

echo "🚀 Starting Voice Assistant with Google Cloud AI Services"
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Check if GCP key file exists
if [ ! -f "gcp-key.json" ]; then
    echo "❌ GCP key file not found at gcp-key.json"
    echo "Please make sure the gcp-key.json file is in the current directory."
    exit 1
fi

echo "✅ GCP key file found"

# Start the API server in the background
echo "🔧 Starting API server on port 3001..."
node server.js &
API_PID=$!

# Wait a moment for the API server to start
sleep 3

# Start the demo server
echo "🌐 Starting demo server on port 5000..."
echo "📱 Open http://localhost:5000 in your browser"
echo "🎤 The voice assistant will use Google Cloud AI services for speech processing"
echo ""
echo "Press Ctrl+C to stop both servers"

# Function to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Stopping servers..."
    kill $API_PID 2>/dev/null
    exit 0
}

# Set trap to cleanup on script exit
trap cleanup SIGINT SIGTERM

# Start the demo server (this will block)
node scripts/run_demo.js en

# If we get here, the demo server stopped
cleanup

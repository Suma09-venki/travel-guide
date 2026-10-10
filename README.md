# Travel Guide – AI Travel Companion

## About the Project
Travel Guide is an AI-powered web application that helps users explore tourist destinations, learn historical information, listen to AI-generated audio guides, and plan trips using an itinerary generation feature.

## Features
- Search for tourist destinations
- Generate historical information
- AI-powered audio guides
- Language selection and voice customization
- Text transcripts
- AI-generated trip itineraries

## Tech Stack
- Python
- Flask
- HTML, CSS, and JavaScript
- Google Gemini API
- Murf API (for audio features, if configured)
- Gunicorn
- Render for deployment

## Setup Instructions

1. Clone the repository:
   `git clone https://github.com/Suma09-venki/travel-guide.git`

2. Open the project directory:
   `cd travel-guide`

3. Create and activate a virtual environment:
   `python -m venv venv`

   On Windows PowerShell:
   `.\venv\Scripts\Activate.ps1`

4. Install dependencies:
   `pip install -r requirements.txt`

5. Configure your API key as an environment variable.

   On Windows PowerShell:
   `$env:GEMINI_API_KEY="your_gemini_api_key"`

   Add `MURF_API_KEY` too if required for audio generation.

6. Run the application:
   `python app.py`

7. Open `http://127.0.0.1:5000` in your browser.

## Live Demo
https://travel-guide-pumr.onrender.com

## Security
Keep API keys private. Do not commit API keys or `.env` files to the repository.

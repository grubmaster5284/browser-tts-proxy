import os
from flask import Flask, request, jsonify, Response
from google.cloud import texttospeech

REQUIRED_API_KEY = os.getenv('LISTENPAGE_PROXY_KEY', '')
PROJECT_ID = os.getenv('GOOGLE_PROJECT_ID', '')
MODEL = os.getenv('GEMINI_TTS_MODEL', 'gemini-2.5-flash-tts')

if not PROJECT_ID:
    print('WARNING: GOOGLE_PROJECT_ID is not set')

app = Flask(__name__)

# Basic CORS
@app.after_request
def after_request(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'authorization, content-type'
    return response

@app.route('/healthz', methods=['GET'])
def healthz():
    return jsonify({'ok': True})

@app.route('/tts', methods=['POST', 'OPTIONS'])
def tts():
    if request.method == 'OPTIONS':
        return '', 204
    
    try:
        # Auth check
        auth_header = request.headers.get('authorization', '')
        token = auth_header[7:] if auth_header.startswith('Bearer ') else ''
        if not REQUIRED_API_KEY or token != REQUIRED_API_KEY:
            return jsonify({'error': 'unauthorized'}), 401
        
        body = request.get_json() or {}
        text = str(body.get('text', ''))
        voice_id = str(body.get('voiceId', ''))
        
        if not text:
            return jsonify({'error': 'text is required'}), 400
        
        # Initialize TTS client
        client = texttospeech.TextToSpeechClient()
        
        # Build synthesis request
        synthesis_input = texttospeech.SynthesisInput(text=text)
        
        voice = texttospeech.VoiceSelectionParams(
            language_code='en-US',
            name=voice_id or 'Kore',
            model_name=MODEL
        )
        
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3
        )
        
        # Perform TTS
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config
        )
        
        if not response.audio_content:
            return jsonify({'error': 'no audio returned'}), 502
        
        return Response(
            response.audio_content,
            mimetype='audio/mpeg',
            headers={'Cache-Control': 'no-store'}
        )
        
    except Exception as e:
        print(f'Synthesis error: {e}')
        return jsonify({'error': 'synthesis failed'}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 8080))
    app.run(host='0.0.0.0', port=port)


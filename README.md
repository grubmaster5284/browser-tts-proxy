ListenPage Gemini TTS Proxy (Cloud Run)

This is a minimal HTTPS proxy that calls Google Vertex AI Gemini TTS and returns MP3 bytes for the ListenPage extension.

Requirements
- Google Cloud project
- Vertex AI API enabled: aiplatform.googleapis.com
- Cloud Run (recommended) or any Node hosting

Setup
1) Authenticate and choose project
   gcloud auth login
   gcloud config set project YOUR_PROJECT_ID

2) Enable APIs
   gcloud services enable aiplatform.googleapis.com run.googleapis.com

3) (Optional) Create a dedicated service account and grant Vertex AI User
   gcloud iam service-accounts create lp-tts-sa
   gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
     --member="serviceAccount:lp-tts-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
     --role="roles/aiplatform.user"

4) Install deps locally (optional for local testing)
   cd proxy
   npm i

Local run (uses ADC; ensure you have application-default credentials)
   export GOOGLE_PROJECT_ID=YOUR_PROJECT_ID
   export GOOGLE_LOCATION=us-central1
   export LISTENPAGE_PROXY_KEY=your-shared-secret
   npm start
   curl http://localhost:8080/healthz

Deploy to Cloud Run (source deploy)
   gcloud run deploy listenpage-tts \
     --source=. \
     --region=us-central1 \
     --allow-unauthenticated \
     --set-env-vars=GOOGLE_PROJECT_ID=YOUR_PROJECT_ID,GOOGLE_LOCATION=us-central1,LISTENPAGE_PROXY_KEY=your-shared-secret

Note: Attach the lp-tts-sa as the service account if you created it:
   --service-account=lp-tts-sa@YOUR_PROJECT_ID.iam.gserviceaccount.com

Test the deployed service
   curl -X POST "https://<your-run-url>/tts" \
     -H "Authorization: Bearer your-shared-secret" \
     -H "Content-Type: application/json" \
     -d '{"text":"Hello from Gemini TTS","voiceId":"Kore"}' --output out.mp3
   open out.mp3

Configure the extension
- Options → API Key: your-shared-secret
- Options → Proxy URL: https://<your-run-url>/tts

Endpoint contract (expected by the extension)
- Method: POST /tts
- Headers: Authorization: Bearer <your-shared-secret>, Content-Type: application/json
- Body: { "text": string, "voiceId"?: string }
- Response: 200 with MP3 bytes (Content-Type: audio/mpeg)

Docs: Gemini TTS usage
- Google Cloud Gemini TTS reference: https://cloud.google.com/text-to-speech/docs/gemini-tts#use_gemini-ttsUse



'use strict';

const express = require('express');
const { VertexAI } = require('@google-cloud/vertexai');

const REQUIRED_API_KEY = process.env.LISTENPAGE_PROXY_KEY || '';
const PROJECT = process.env.GOOGLE_PROJECT_ID || '';
const LOCATION = process.env.GOOGLE_LOCATION || 'us-central1';
const MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-2.5-pro-tts';

if (!PROJECT) {
  // eslint-disable-next-line no-console
  console.warn('GOOGLE_PROJECT_ID is not set. Set it before running in production.');
}

const app = express();
app.use(express.json({ limit: '2mb' }));

// Basic CORS to allow extension
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  next();
});

app.get('/healthz', (_req, res) => res.json({ ok: true }));

app.post('/tts', async (req, res) => {
  try {
    // Auth check against shared secret
    const auth = req.header('authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!REQUIRED_API_KEY || token !== REQUIRED_API_KEY) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const body = req.body || {};
    const text = (body.text || '').toString();
    const voiceId = (body.voiceId || '').toString();
    if (!text) return res.status(400).json({ error: 'text is required' });

    // Initialize Vertex AI client (uses ADC/service account on Cloud Run)
    const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
    const model = vertexAI.getGenerativeModel({ model: MODEL });

    // Build request: MP3 output; voiceName is optional
    const request = {
      contents: [{ role: 'user', parts: [{ text }]}],
      generationConfig: {
        audioConfig: { audioEncoding: 'MP3', voiceName: voiceId || undefined }
      }
    };

    const result = await model.generateContent(request);
    const parts = result?.response?.candidates?.[0]?.content?.parts || [];
    const audioPart = parts.find(p => p.inlineData && p.inlineData.mimeType && p.inlineData.mimeType.includes('audio'));
    if (!audioPart || !audioPart.inlineData?.data) {
      return res.status(502).json({ error: 'no audio returned from model' });
    }

    const buffer = Buffer.from(audioPart.inlineData.data, 'base64');
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    return res.send(buffer);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('Synthesis error:', e?.message || e);
    return res.status(500).json({ error: 'synthesis failed' });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Gemini TTS proxy listening on :${port}`);
});



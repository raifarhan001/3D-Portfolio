async function testTtsApi() {
  console.log('Testing /api/robot/tts endpoint on http://localhost:3000...');
  try {
    const res = await fetch('http://localhost:3000/api/robot/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: 'Hello, I am Elsa. How can I help you today?' }),
    });

    console.log('Status:', res.status, res.statusText);
    const contentType = res.headers.get('content-type');
    const ttsModel = res.headers.get('x-mona-tts-model');
    const ttsCache = res.headers.get('x-mona-tts-cache');
    console.log('Content-Type:', contentType);
    console.log('X-Mona-Tts-Model:', ttsModel);
    console.log('X-Mona-Tts-Cache:', ttsCache);

    if (res.ok) {
      const buf = await res.arrayBuffer();
      console.log('Audio received successfully! Byte length:', buf.byteLength);
    } else {
      const err = await res.text();
      console.log('Response body:', err);
    }
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

testTtsApi();

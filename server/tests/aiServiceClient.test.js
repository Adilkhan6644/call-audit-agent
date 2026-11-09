process.env.AI_SERVICE_URL = 'http://ai-service.test/api/v1';
process.env.INTERNAL_API_SECRET = 'shared-secret';

const { transcribe, audit } = require('../src/services/aiServiceClient');

afterEach(() => {
  global.fetch = undefined;
});

describe('aiServiceClient.transcribe', () => {
  it('returns the parsed transcript result on success', async () => {
    global.fetch = jest.fn(async (url, options) => {
      expect(url).toBe('http://ai-service.test/api/v1/internal/transcribe');
      expect(options.headers['X-Internal-Secret']).toBe('shared-secret');
      return { ok: true, json: async () => ({ text: 'hello world', language: 'en', duration_seconds: 1.2, segments: [] }) };
    });

    const result = await transcribe(Buffer.from('audio'), 'call.mp3', 'audio/mpeg');
    expect(result.text).toBe('hello world');
  });

  it('throws a typed error, not an unhandled rejection, when the request fails', async () => {
    global.fetch = jest.fn(async () => {
      throw new Error('network down');
    });

    await expect(transcribe(Buffer.from('audio'), 'call.mp3', 'audio/mpeg')).rejects.toMatchObject({
      statusCode: 502,
      code: 'ai_service_error',
    });
  });
});

describe('aiServiceClient.audit', () => {
  it('posts transcript + instructions as JSON and returns the parsed result', async () => {
    global.fetch = jest.fn(async (url, options) => {
      expect(options.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(options.body)).toEqual({ transcript: 't', instructions: 'i' });
      return { ok: true, json: async () => ({ summary: 'ok', score: 9, findings: [] }) };
    });

    const result = await audit('t', 'i');
    expect(result.summary).toBe('ok');
  });

  it('surfaces a non-ok response as a typed 502 error', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 500 }));

    await expect(audit('t', 'i')).rejects.toMatchObject({ statusCode: 502 });
  });
});

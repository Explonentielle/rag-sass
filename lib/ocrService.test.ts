import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ocrPdf, OcrServiceError } from './ocrService';

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as unknown as Response;
}

describe('ocrPdf', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    fetchMock.mockReset();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('returns null without calling fetch when OCR_SERVICE_URL is not configured', async () => {
    vi.stubEnv('OCR_SERVICE_URL', '');

    const result = await ocrPdf(Buffer.from('%PDF-fake'));

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends the PDF with the expected method/headers and returns the recognized text', async () => {
    vi.stubEnv('OCR_SERVICE_URL', 'https://ocr.exemple.com');
    vi.stubEnv('OCR_SERVICE_SECRET', 'le-secret');
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: 'Texte reconnu', pageCount: 2 }));

    const buffer = Buffer.from('%PDF-fake');
    const result = await ocrPdf(buffer);

    expect(result).toBe('Texte reconnu');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('https://ocr.exemple.com/ocr');
    expect(options.method).toBe('POST');
    expect(options.headers.Authorization).toBe('Bearer le-secret');
    expect(options.headers['Content-Type']).toBe('application/pdf');
    expect(Buffer.from(options.body)).toEqual(buffer);
  });

  it('omits the Authorization header when no secret is configured', async () => {
    vi.stubEnv('OCR_SERVICE_URL', 'https://ocr.exemple.com');
    vi.stubEnv('OCR_SERVICE_SECRET', '');
    fetchMock.mockResolvedValueOnce(jsonResponse({ text: 'ok' }));

    await ocrPdf(Buffer.from('%PDF-fake'));

    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('throws OcrServiceError on a non-2xx response', async () => {
    vi.stubEnv('OCR_SERVICE_URL', 'https://ocr.exemple.com');
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'boom' }, 500));

    await expect(ocrPdf(Buffer.from('%PDF-fake'))).rejects.toThrow(OcrServiceError);
  });

  it('throws OcrServiceError on a network/timeout failure', async () => {
    vi.stubEnv('OCR_SERVICE_URL', 'https://ocr.exemple.com');
    fetchMock.mockRejectedValueOnce(new Error('fetch failed'));

    await expect(ocrPdf(Buffer.from('%PDF-fake'))).rejects.toThrow(OcrServiceError);
  });
});

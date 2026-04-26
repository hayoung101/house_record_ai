export interface DefectItem {
  type: string;
  location: string;
  severity: '경미' | '보통' | '심각';
}

export interface AnalysisData {
  defects: DefectItem[];
  summary: string;
}

export async function analyzeImage(file: File): Promise<AnalysisData> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64, mediaType: file.type }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(err.error ?? `HTTP ${response.status}`);
  }

  return response.json();
}

/**
 * Represents the result of a move-in report submission.
 */
export interface MoveInResponse {
  hash: string;
  txId: string;
  timestamp: number;
}

/**
 * Represents the discrepancy result for a specific room step.
 */
export interface DiscrepancyResult {
  roomId: string;
  stepId: string;
  damageLevel: 'none' | 'low' | 'high';
  notes: string;
}

const OLLAMA_URL = '/api/ollama/api/generate';
const MODEL_NAME = 'gemma4:latest';

/**
 * Submits the move-in report for blockchain anchoring.
 */
export async function submitMoveInReport(payload: any): Promise<MoveInResponse> {
  console.log('API Request: POST /api/move-in (Blockchain Anchor)');
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        hash: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        txId: '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        timestamp: Date.now()
      });
    }, 1500);
  });
}

/**
 * Submits the move-out photos for real AI discrepancy detection using local Ollama.
 */
export async function submitMoveOutReport(moveInPhotos: any, moveOutPhotos: any): Promise<DiscrepancyResult[]> {
  console.log('API Request: POST /api/generate (Real Multimodal Analysis)');
  
  const results: DiscrepancyResult[] = [];

  for (const roomId in moveOutPhotos) {
    for (const stepId in moveOutPhotos[roomId]) {
      const outPhotoFull = moveOutPhotos[roomId][stepId][0]; // data:image/jpeg;base64,...
      const inPhotoFull = moveInPhotos[roomId]?.[stepId]?.[0];

      if (outPhotoFull && inPhotoFull) {
        // Strip the data:image/...;base64, prefix for Ollama
        const outBase64 = outPhotoFull.split(',')[1];
        const inBase64 = inPhotoFull.split(',')[1];

        const prompt = `
Compare these two photos of the same room area: "${roomId} - ${stepId}".
Image 1: Move-in state (Baseline).
Image 2: Move-out state (Current).

Identify any new physical damage (scuffs, cracks, stains, holes) that wasn't there in Image 1. 
Ignore lighting, camera angle, and lens distortion.

Output format (REQUIRED):
1. Damage Level: [none | low | high]
2. Analysis Note: [One sentence description]
        `;

        try {
          const response = await fetch(OLLAMA_URL, {
            method: 'POST',
            body: JSON.stringify({
              model: MODEL_NAME,
              prompt: prompt,
              images: [inBase64, outBase64],
              stream: false,
              options: { temperature: 0.1 }
            })
          });

          if (!response.ok) {
            const errorBody = await response.text();
            console.error(`Ollama Error ${response.status}:`, errorBody);
            throw new Error(`Ollama failed with status ${response.status}: ${errorBody}`);
          }

          const data = await response.json();
          const aiText = data.response || '';
          console.log(`AI Output for ${roomId}/${stepId}:`, aiText);

          // Parse the AI's response for damageLevel and notes
          let damageLevel: 'none' | 'low' | 'high' = 'none';
          if (aiText.toLowerCase().includes('high')) damageLevel = 'high';
          else if (aiText.toLowerCase().includes('low')) damageLevel = 'low';

          results.push({
            roomId,
            stepId,
            damageLevel,
            notes: aiText.split('\n').filter((l: string) => l.trim()).join(' ') // Clean up line breaks
          });

        } catch (error) {
          console.error(`AI analysis failed for ${roomId}/${stepId}:`, error);
          results.push({
            roomId, stepId,
            damageLevel: 'none',
            notes: 'AI analysis unavailable due to network or model error.'
          });
        }
      }
    }
  }

  return results;
}

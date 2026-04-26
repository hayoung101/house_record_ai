interface Env {
  ANTHROPIC_API_KEY: string;
}

interface DefectItem {
  type: string;
  location: string;
  severity: '경미' | '보통' | '심각';
}

interface AnalysisData {
  defects: DefectItem[];
  summary: string;
}

const PROMPT = `이 사진에서 다음 항목들을 한국어로 분석해줘:
1. 발견된 하자 목록 (곰팡이, 스크래치, 균열, 누수, 변색 등)
2. 각 하자의 위치와 심각도 (경미/보통/심각)
3. 하자가 없으면 '하자 없음'으로 표시
아래 JSON 형식으로만 반환해줘:
{
  "defects": [
    { "type": "하자종류", "location": "위치", "severity": "경미|보통|심각" }
  ],
  "summary": "전체 요약"
}`;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);
  }

  let body: { image: string; mediaType: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  const { image, mediaType } = body;
  if (!image || !mediaType) {
    return json({ error: 'Missing image or mediaType' }, 400);
  }

  const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
            { type: 'text', text: PROMPT },
          ],
        },
      ],
    }),
  });

  if (!claudeRes.ok) {
    const errText = await claudeRes.text();
    return json({ error: `Claude API error: ${errText}` }, 502);
  }

  const claudeData: any = await claudeRes.json();
  const rawText: string = claudeData.content?.[0]?.text ?? '{}';

  const match = rawText.match(/\{[\s\S]*\}/);
  let result: AnalysisData;
  try {
    result = JSON.parse(match?.[0] ?? '{"defects":[],"summary":"분석 실패"}');
  } catch {
    result = { defects: [], summary: '분석 결과를 파싱할 수 없습니다.' };
  }

  return json(result, 200);
};

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

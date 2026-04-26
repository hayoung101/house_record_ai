import { CheckCircle2 } from 'lucide-react';
import type { AnalysisData } from '../lib/api';

interface AnalysisResultProps {
  result: AnalysisData;
}

const SEVERITY_STYLE: Record<string, { color: string; bg: string; border: string }> = {
  '경미': { color: '#059669', bg: '#ecfdf5', border: '#6ee7b7' },
  '보통': { color: '#d97706', bg: '#fffbeb', border: '#fcd34d' },
  '심각': { color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' },
};

export default function AnalysisResult({ result }: AnalysisResultProps) {
  if (result.defects.length === 0) {
    return (
      <div className="analysis-no-defects">
        <CheckCircle2 size={48} color="#059669" />
        <p>하자 없음</p>
        <span>{result.summary}</span>
      </div>
    );
  }

  return (
    <div className="analysis-result">
      <p className="analysis-summary">{result.summary}</p>
      <div className="defect-list">
        {result.defects.map((defect, i) => {
          const s = SEVERITY_STYLE[defect.severity] ?? SEVERITY_STYLE['경미'];
          return (
            <div
              key={i}
              className="defect-card"
              style={{ borderLeft: `4px solid ${s.color}`, background: s.bg, borderColor: s.border }}
            >
              <div className="defect-card-header">
                <span className="defect-type">{defect.type}</span>
                <span className="severity-badge" style={{ color: s.color, borderColor: s.color }}>
                  {defect.severity}
                </span>
              </div>
              <p className="defect-location">{defect.location}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

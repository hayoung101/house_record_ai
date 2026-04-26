import { useState, useEffect, useMemo, useRef } from 'react';
import { Camera, LayoutGrid, FileText, Settings, ArrowLeft, CheckCircle2, ChevronRight, Image as ImageIcon, ShieldCheck, AlertTriangle, ScanLine } from 'lucide-react';
import walkthroughData from './walkthrough.json';
import { loadAppData, saveAppData, clearAppData, type PersistentData, type InspectionPhase } from './lib/storage';
import { computeHash } from './lib/hash';
import { submitMoveInReport, submitMoveOutReport, analyzeImage, type MoveInResponse, type DiscrepancyResult, type AnalysisData } from './lib/api';
import ImageUpload from './components/ImageUpload';
import AnalysisResult from './components/AnalysisResult';

type AppState = 'hub' | 'wizard' | 'report' | 'settings' | 'processing' | 'analyze';

export default function App() {
  const [view, setView] = useState<AppState>('hub');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [data, setData] = useState<PersistentData>({ photos: { 'move-in': {}, 'move-out': {} }, currentPhase: 'move-in' });
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [discrepancies, setDiscrepancies] = useState<DiscrepancyResult[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<AnalysisData | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const currentRoom = useMemo(() => walkthroughData.rooms.find(r => r.id === selectedRoomId), [selectedRoomId]);
  const currentStep = useMemo(() => currentRoom?.steps[currentStepIndex], [currentRoom, currentStepIndex]);

  useEffect(() => {
    loadAppData().then(loadedData => { 
      setData(loadedData); 
      setIsLoading(false); 
    });
  }, []);

  useEffect(() => {
    if (!isLoading) saveAppData(data);
  }, [data, isLoading]);

  useEffect(() => {
    let stream: MediaStream | null = null;
    if (view === 'wizard' && videoRef.current) {
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
        .then(s => { stream = s; if (videoRef.current) videoRef.current.srcObject = s; setCameraError(null); })
        .catch(err => { console.error(err); setCameraError("Camera access denied."); });
    }
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [view]);

  const enterRoom = (id: string) => { setSelectedRoomId(id); setCurrentStepIndex(0); setView('wizard'); };

  const capturePhoto = () => {
    if (!selectedRoomId || !currentStep || !videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const newPhoto = canvas.toDataURL('image/jpeg', 0.8);
    
    setData(prev => {
      const currentPhase = prev.currentPhase;
      const phasePhotos = prev.photos[currentPhase] || {};
      const roomPhotos = phasePhotos[selectedRoomId] || {};
      const stepPhotos = roomPhotos[currentStep.id] || [];
      
      return {
        ...prev,
        photos: {
          ...prev.photos,
          [currentPhase]: {
            ...phasePhotos,
            [selectedRoomId]: {
              ...roomPhotos,
              [currentStep.id]: [...stepPhotos, newPhoto]
            }
          }
        }
      };
    });
  };

  const nextStep = () => {
    if (currentRoom && currentStepIndex < currentRoom.steps.length - 1) {
      setCurrentStepIndex(prev => prev + 1);
    } else {
      setView('hub');
    }
  };

  const getStepPhotos = (phase: InspectionPhase, roomId: string, stepId: string) => {
    const phaseData = data.photos[phase] || {};
    const roomData = phaseData[roomId] || {};
    return roomData[stepId] || [];
  };

  const getTotalPhotosInRoom = (phase: InspectionPhase, roomId: string) => {
    const phaseData = data.photos[phase] || {};
    const roomPhotos = phaseData[roomId] || {};
    return Object.values(roomPhotos).reduce((acc, arr) => acc + arr.length, 0);
  };

  const getFirstPhotoInRoom = (phase: InspectionPhase, roomId: string) => {
    const phaseData = data.photos[phase] || {};
    const roomPhotos = phaseData[roomId] || {};
    for (const stepId in roomPhotos) {
      if (roomPhotos[stepId]?.[0]) return roomPhotos[stepId][0];
    }
    return null;
  };

  const handleFinalizeReport = async () => {
    setIsSubmitting(true);
    setView('processing');

    try {
      if (data.currentPhase === 'move-in') {
        const imageHashes: Record<string, string> = {};
        const moveInPhotos = data.photos['move-in'];
        
        for (const roomId in moveInPhotos) {
          for (const stepId in moveInPhotos[roomId]) {
            const photos = moveInPhotos[roomId][stepId];
            if (photos.length > 0) {
              imageHashes[`${roomId}-${stepId}`] = await computeHash(photos[0]);
            }
          }
        }

        const response = await submitMoveInReport({
          timestamp: Date.now(),
          metadata: { rooms: walkthroughData.rooms.map(r => ({ id: r.id, name: r.name })) },
          imageHashes
        });

        setData(prev => ({
          ...prev,
          blockchainProof: response,
          currentPhase: 'move-out'
        }));
      } else {
        const moveInPhotos = data.photos['move-in'];
        const moveOutPhotos = data.photos['move-out'];
        const results = await submitMoveOutReport(moveInPhotos, moveOutPhotos);
        setDiscrepancies(results);
      }
      setView('report');
    } catch (error) {
      console.error(error);
      alert("Submission failed. Please try again.");
      setView('hub');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>;

  const currentPhasePhotos = data.photos[data.currentPhase];
  const currentPhotos = selectedRoomId && currentStep ? getStepPhotos(data.currentPhase, selectedRoomId, currentStep.id) : [];
  const lastPhoto = currentPhotos[currentPhotos.length - 1];

  return (
    <div>
      {view === 'hub' && (
        <div className="hub-container">
          <div className="hub-header">
            <div className="phase-badge">{data.currentPhase.toUpperCase().replace('-', ' ')}</div>
            <h1>{data.currentPhase === 'move-in' ? 'Move-in Inspection' : 'Move-out Inspection'}</h1>
            <p>Document the condition of each room.</p>
          </div>
          <div className="room-grid">
            {walkthroughData.rooms.map(room => {
              const firstPhoto = getFirstPhotoInRoom(data.currentPhase, room.id);
              const completedSteps = room.steps.filter(s => getStepPhotos(data.currentPhase, room.id, s.id).length > 0).length;
              
              return (
                <button key={room.id} className="room-card" onClick={() => enterRoom(room.id)}>
                  <div className="room-card-icon">
                    {firstPhoto ? <img src={firstPhoto} /> : <Camera size={28} />}
                  </div>
                  <div className="room-card-info">
                    <h3>{room.name}</h3>
                    <p>{completedSteps} of {room.steps.length} steps done</p>
                  </div>
                  <ChevronRight size={24} color="#cbd5e1" />
                </button>
              );
            })}
          </div>

          <div style={{ padding: '1.5rem' }}>
            <button 
              className="finalize-btn"
              onClick={handleFinalizeReport}
              disabled={Object.keys(currentPhasePhotos).length === 0}
            >
              Finalize {data.currentPhase === 'move-in' ? 'Move-in' : 'Move-out'} Report
            </button>
          </div>
        </div>
      )}

      {view === 'wizard' && currentRoom && currentStep && (
        <div className="wizard-view">
          <div className="wizard-camera-container">
            <div className="wizard-top-bar">
              <button onClick={() => setView('hub')}><ArrowLeft size={28} /></button>
              <div className="title">
                <h2>{currentRoom.name}</h2>
                <p>STEP {currentStepIndex + 1} OF {currentRoom.steps.length}</p>
              </div>
              <div style={{ width: 44 }} />
            </div>

            {cameraError ? (
              <div style={{ color: 'white', textAlign: 'center', marginTop: '50%', padding: '0 2rem' }}>
                <p>{cameraError}</p>
                <p style={{ fontSize: '0.8rem', opacity: 0.7, marginTop: '0.5rem' }}>Make sure your browser has camera access enabled.</p>
              </div>
            ) : (
              <video ref={videoRef} autoPlay playsInline />
            )}
            
            <div className="wizard-guide">
              <h4>{currentStep.label}</h4>
              <p>{currentStep.guide}</p>
            </div>
          </div>

          <canvas ref={canvasRef} style={{ display: 'none' }} />

          <div className="wizard-bottom-bar">
            <div className="wizard-thumbnail">
              {lastPhoto ? <img src={lastPhoto} /> : <ImageIcon size={20} />}
            </div>

            <button className="shutter-btn" onClick={capturePhoto}>
              <div className="shutter-btn-inner" />
            </button>

            <button className="wizard-nav-btn" onClick={nextStep}>
              {currentStepIndex === currentRoom.steps.length - 1 ? <CheckCircle2 size={24} /> : <ChevronRight size={28} />}
            </button>
          </div>
        </div>
      )}

      {view === 'analyze' && (
        <div className="analyze-view">
          <div className="analyze-header">
            <h1>하자 분석</h1>
            <p>이미지를 업로드하면 AI가 하자를 자동으로 분석합니다.</p>
          </div>
          <div className="analyze-body">
            <ImageUpload
              disabled={isAnalyzing}
              onImageSelect={async (file) => {
                setAnalyzeResult(null);
                setAnalyzeError(null);
                setIsAnalyzing(true);
                try {
                  const result = await analyzeImage(file);
                  setAnalyzeResult(result);
                } catch (err) {
                  setAnalyzeError(err instanceof Error ? err.message : '분석에 실패했습니다.');
                } finally {
                  setIsAnalyzing(false);
                }
              }}
            />
            {isAnalyzing && (
              <div className="analyze-loading">
                <div className="spinner" />
                <p>AI 분석 중...</p>
              </div>
            )}
            {analyzeError && (
              <div className="analyze-error">
                <p>{analyzeError}</p>
              </div>
            )}
            {analyzeResult && !isAnalyzing && (
              <AnalysisResult result={analyzeResult} />
            )}
          </div>
        </div>
      )}

      {view === 'processing' && (
        <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '2rem', textAlign: 'center' }}>
          <div className="spinner" />
          <h2 style={{ marginTop: '2rem' }}>{data.currentPhase === 'move-out' ? 'Blockchain Anchoring...' : 'AI Analysis in Progress...'}</h2>
          <p style={{ color: '#64748b', marginTop: '1rem' }}>Please wait while we secure your data and analyze conditions.</p>
        </div>
      )}

      {view === 'report' && (
        <div className="report-view">
          <div style={{ padding: '2rem', textAlign: 'center' }}>
            <CheckCircle2 size={64} color="#10b981" style={{ margin: '0 auto 1.5rem' }} />
            <h1>{discrepancies.length > 0 ? 'Analysis Complete' : 'Report Secured'}</h1>
            <p style={{ color: '#64748b' }}>Your inspection data has been processed.</p>
          </div>

          {data.blockchainProof && (
            <div className="proof-card">
              <div className="proof-header">
                <ShieldCheck size={20} color="#059669" />
                <span>Blockchain Verified Proof</span>
              </div>
              <div className="proof-body">
                <div className="proof-item">
                  <label>Data Hash</label>
                  <code>{data.blockchainProof.hash.substring(0, 32)}...</code>
                </div>
                <div className="proof-item">
                  <label>Transaction ID</label>
                  <code>{data.blockchainProof.txId.substring(0, 32)}...</code>
                </div>
                <div className="proof-item">
                  <label>Timestamp</label>
                  <span>{new Date(data.blockchainProof.timestamp).toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {discrepancies.length > 0 && (
            <div className="discrepancy-list">
              <h3>AI Detection Results</h3>
              {discrepancies.map((d, i) => (
                <div key={i} className={`discrepancy-item ${d.damageLevel}`}>
                  <div className="item-header">
                    {d.damageLevel !== 'none' && <AlertTriangle size={18} />}
                    <span className="room-step">{d.roomId} - {d.stepId}</span>
                    <span className={`badge ${d.damageLevel}`}>{d.damageLevel.toUpperCase()}</span>
                  </div>
                  <p>{d.notes}</p>
                </div>
              ))}
            </div>
          )}

          <div style={{ padding: '2rem' }}>
            <button className="primary-btn" onClick={() => setView('hub')}>Return to Hub</button>
            {data.currentPhase === 'move-out' && (
              <button 
                className="secondary-btn" 
                style={{ marginTop: '1rem' }}
                onClick={async () => { if(confirm("Reset all data?")) { await clearAppData(); window.location.reload(); } }}
              >
                Reset for New Inspection
              </button>
            )}
          </div>
        </div>
      )}

      {view !== 'wizard' && view !== 'processing' && (
        <nav className="bottom-nav">
          <button className={`nav-item ${view === 'hub' ? 'active' : ''}`} onClick={() => setView('hub')}>
            <LayoutGrid size={26} />
          </button>
          <button className={`nav-item ${view === 'analyze' ? 'active' : ''}`} onClick={() => setView('analyze')}>
            <ScanLine size={26} />
          </button>
          <button className={`nav-item ${view === 'report' ? 'active' : ''}`} onClick={() => setView('report')}>
            <FileText size={26} />
          </button>
          <button className="nav-item" onClick={() => { if(confirm("Clear current phase data?")) { setData(prev => ({ ...prev, photos: { ...prev.photos, [prev.currentPhase]: {} } })); } }}>
            <Settings size={26} />
          </button>
        </nav>
      )}
    </div>
  );
}

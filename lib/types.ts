export interface QuickStats {
  mood: string;
  stress: number;
  fatigue: number;
  happiness: number;
  focus: number;
  authenticity: number;
  analysisNote: string;
}

export interface DeepReport {
  fizikselFizyolojik: string;
  duygusalPsikolojik: string;
  bilisselYukOdak: string;
  genelDegerlendirme: string;
}

export interface AnalysisResult extends QuickStats {
  report: DeepReport;
}

export interface HeadPoseStats {
  pitchMeanDeg: number;
  yawMeanDeg: number;
  rollMeanDeg: number;
  stabilityScore: number;
}

export interface BlinkStats {
  count: number;
  perMinute: number;
}

export interface GazeStats {
  onCameraPercent: number;
}

export interface RppgEstimate {
  bpm: number | null;
  confidence: number;
}

export interface SignalQuality {
  confidenceScore: number;
  framesAnalyzed: number;
  faceDetectedPercent: number;
}

export interface MeasuredMetrics {
  headPose: HeadPoseStats;
  blink: BlinkStats;
  gaze: GazeStats;
  asymmetryScore: number;
  rppg: RppgEstimate;
  signalQuality: SignalQuality;
}

export type AnalyzeApiResponse =
  | ({ success: true } & AnalysisResult)
  | { success: false; error: string };
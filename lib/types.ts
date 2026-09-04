export interface AnalysisResult {
  mood: string;
  stress: number;
  fatigue: number;
  happiness: number;
  focus: number;
  authenticity: number;
  analysisNote: string;
}

export type AnalyzeApiResponse =
  | ({ success: true } & AnalysisResult)
  | { success: false; error: string };
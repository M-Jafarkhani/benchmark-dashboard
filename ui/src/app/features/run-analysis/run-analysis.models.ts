import { RunValues, ValueColumn } from '../../core/models/benchmark.models';

export type AnalysisRow = Record<string, unknown>;

export interface RunAnalysisData {
  payload: RunValues;
  rows: AnalysisRow[];
  columns: ValueColumn[];
  runCount: number;
}

export interface SelectOption {
  label: string;
  value: string;
}

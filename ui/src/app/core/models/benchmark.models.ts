export interface Run {
  run_id: string;
  benchmark_url: string;
  benchmark_repo: string;
  graph: string | null;
  software_name: string | null;
  software_url: string | null;
  datePublished: string | null;
  version: string | null;
  benchmark: string;
  parameters: BenchmarkVariable[];
  metrics: BenchmarkVariable[];
}

export interface BenchmarkVariable {
  name: string;
  unit: string | null;
}

export interface ValueColumn {
  key: string;
  label: string;
  kind: 'parameter' | 'metric';
}

export interface RunValues {
  run_id?: string;
  software_name: string | null;
  benchmark: string;
  columns: ValueColumn[];
  rows: Record<string, unknown>[];
  run_count?: number;
}

export interface SparqlEntry {
  id: number;
  started_at: string;
  query: string;
  status: 'running' | 'succeeded' | 'failed';
  duration_ms: number | null;
  error: string | null;
}

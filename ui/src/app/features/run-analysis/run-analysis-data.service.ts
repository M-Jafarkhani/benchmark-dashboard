import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable } from 'rxjs';

import { Run, RunValues, ValueColumn } from '../../core/models/benchmark.models';
import { BenchmarkApi } from '../../core/services/benchmark-api.service';
import { AnalysisRow, RunAnalysisData } from './run-analysis.models';

@Injectable({ providedIn: 'root' })
export class RunAnalysisDataService {
  private readonly api = inject(BenchmarkApi);

  load(runs: Run[]): Observable<RunAnalysisData> {
    return forkJoin(runs.map(run => this.api.runValues(run.run_id))).pipe(
      map(responses => this.prepare(runs, responses)),
    );
  }

  private prepare(runs: Run[], responses: RunValues[]): RunAnalysisData {
    const columns = responses[0].columns.filter(column =>
      responses.every(response => response.columns.some(candidate => candidate.key === column.key)));
    const rawRows = responses.flatMap((response, index) => {
      const run = runs[index];
      const shortRun = run.run_id.replace(/\/$/, '').split('/').at(-1)?.slice(0, 8) || run.run_id.slice(0, 8);
      const software = run.software_name || 'Unknown software';
      return response.rows.map(row => ({ ...row, __software: software, __run_id: shortRun, __series: `${software} — ${shortRun}` }));
    });
    const rows = this.normalizeValues(columns, rawRows);
    return {
      columns, rows, runCount: runs.length,
      payload: {
        benchmark: responses[0].benchmark,
        software_name: runs.length === 1 ? runs[0].software_name : null,
        run_count: runs.length,
        columns,
        rows,
      },
    };
  }

  private normalizeValues(columns: ValueColumn[], rows: AnalysisRow[]): AnalysisRow[] {
    const numeric = new Set(columns.filter(column => {
      const values = rows.map(row => row[column.key]).filter(value => value !== null && value !== undefined && value !== '');
      return values.length && values.every(value => Number.isFinite(Number(value)));
    }).map(column => column.key));
    return rows.map(row => ({ ...row, ...Object.fromEntries(columns.map(column => {
      const value = row[column.key];
      if (value === null || value === undefined || value === '') return [column.key, null];
      return [column.key, numeric.has(column.key) ? Number(value) : String(value)];
    })) }));
  }
}

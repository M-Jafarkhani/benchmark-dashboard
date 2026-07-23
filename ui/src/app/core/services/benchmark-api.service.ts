import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { Run, RunValues, SparqlEntry } from '../models/benchmark.models';

@Injectable({ providedIn: 'root' })
export class BenchmarkApi {
  private readonly http = inject(HttpClient);

  runs(refresh = false): Observable<{ items: Run[]; count: number }> {
    const params = refresh ? new HttpParams().set('refresh', true) : undefined;
    return this.http.get<{ items: Run[]; count: number }>('/api/runs', { params });
  }

  runValues(runId: string): Observable<RunValues> {
    return this.http.get<RunValues>('/api/run-values', {
      params: new HttpParams().set('run_id', runId),
    });
  }

  sparqlLog(): Observable<{ items: SparqlEntry[]; count: number }> {
    return this.http.get<{ items: SparqlEntry[]; count: number }>('/api/sparql-log');
  }

  clearSparqlLog(): Observable<void> {
    return this.http.delete<void>('/api/sparql-log');
  }
}

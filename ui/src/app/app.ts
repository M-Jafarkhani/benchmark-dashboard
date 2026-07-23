import { ChangeDetectorRef, Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import './shared/ag-grid-setup';
import { Run } from './core/models/benchmark.models';
import { BenchmarkApi } from './core/services/benchmark-api.service';
import { ThemeService } from './core/services/theme.service';
import { BenchmarkCatalogComponent } from './features/benchmark-catalog/benchmark-catalog.component';
import { PublishedRunsComponent } from './features/published-runs/published-runs.component';
import { RunAnalysisDialogComponent } from './features/run-analysis/run-analysis-dialog.component';
import { SparqlLogComponent } from './features/sparql-log/sparql-log.component';
import { resourceLabel } from './shared/utils/display-formatters';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [BenchmarkCatalogComponent, FormsModule, PublishedRunsComponent, RunAnalysisDialogComponent, SparqlLogComponent, ToggleSwitchModule],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly api = inject(BenchmarkApi);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly theme = inject(ThemeService);
  @ViewChild(BenchmarkCatalogComponent) catalog?: BenchmarkCatalogComponent;
  @ViewChild(RunAnalysisDialogComponent) analysisDialog?: RunAnalysisDialogComponent;

  runs: Run[] = [];
  selectedBenchmarkUrl = '';
  selectedBenchmarkName = '';
  loading = true;
  error = '';
  updated = '';

  ngOnInit(): void { this.load(); }

  load(refresh = false): void {
    this.loading = true;
    this.error = '';
    this.api.runs(refresh).subscribe({
      next: response => {
        this.runs = response.items;
        this.updated = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' });
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: error => {
        this.error = error.error?.detail || 'The runs could not be loaded.';
        this.loading = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  selectBenchmark(benchmark: Run | null): void {
    this.selectedBenchmarkUrl = benchmark?.benchmark_url || '';
    this.selectedBenchmarkName = benchmark ? benchmark.benchmark || resourceLabel(benchmark.benchmark_repo) : '';
  }

  clearBenchmarkFilter(): void {
    this.catalog?.clearSelection();
    this.selectedBenchmarkUrl = '';
    this.selectedBenchmarkName = '';
  }

  openAnalysis(runs: Run[]): void { this.analysisDialog?.open(runs); }
}

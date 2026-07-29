import { ChangeDetectorRef, Component, inject } from '@angular/core';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabsModule } from 'primeng/tabs';

import { Run } from '../../core/models/benchmark.models';
import { ComparisonPlotComponent } from './comparison-plot.component';
import { RunAnalysisDataService } from './run-analysis-data.service';
import { RunAnalysisData } from './run-analysis.models';
import { RunValuesGridComponent } from './run-values-grid.component';

@Component({
  selector: 'app-run-analysis-dialog',
  standalone: true,
  imports: [
    ComparisonPlotComponent,
    DialogModule,
    ProgressSpinnerModule,
    RunValuesGridComponent,
    TabsModule,
  ],
  templateUrl: './run-analysis-dialog.component.html',
  styleUrl: './run-analysis-dialog.component.css',
})
export class RunAnalysisDialogComponent {
  private readonly dataService = inject(RunAnalysisDataService);
  private readonly changeDetector = inject(ChangeDetectorRef);
  visible = false;
  loading = false;
  error = '';
  title = 'Parameters and metrics';
  context = '';
  tab = 'values';
  dialogMaximized = false;
  analysis?: RunAnalysisData;
  filteredRows: Record<string, unknown>[] = [];

  open(runs: Run[]): void {
    if (!runs.length) return;
    this.visible = true;
    this.loading = true;
    this.error = '';
    this.analysis = undefined;
    this.tab = 'values';
    this.title = runs.length > 1 ? 'Loading comparison…' : 'Loading run values…';
    this.context = runs.length > 1 ? `${runs.length} selected runs` : runs[0].software_name || '';
    this.dataService.load(runs).subscribe({
      next: (analysis) => {
        this.analysis = analysis;
        this.filteredRows = [...analysis.rows];
        this.title = analysis.payload.benchmark || 'Parameters and metrics';
        this.updateContext();
        this.loading = false;
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.detail || 'Run values could not be loaded.';
        this.changeDetector.markForCheck();
      },
    });
  }

  filteredRowsChanged(rows: Record<string, unknown>[]): void {
    this.filteredRows = rows;
    this.updateContext();
  }
  changeTab(value: string | number | undefined): void {
    if (value !== undefined) this.tab = String(value);
  }
  private updateContext(): void {
    if (!this.analysis) return;
    const count = this.analysis.runCount;
    this.context = `${count} ${count === 1 ? 'run' : 'runs'} · ${this.filteredRows.length} of ${this.analysis.rows.length} observations`;
  }
}

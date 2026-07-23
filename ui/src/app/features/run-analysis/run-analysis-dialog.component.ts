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
  imports: [ComparisonPlotComponent, DialogModule, ProgressSpinnerModule, RunValuesGridComponent, TabsModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [maximizable]="true"
      [style]="{width:'min(1120px,96vw)'}" [contentStyle]="{height:'min(680px,76vh)'}" (onMaximize)="dialogMaximized = $event.maximized">
      <ng-template #header><div><span class="eyebrow">Run values</span><h2>{{ title }}</h2><small>{{ context }}</small></div></ng-template>
      @if (loading) {
        <div class="state"><p-progress-spinner strokeWidth="4" ariaLabel="Loading run values" /><p>Running SPARQL queries…</p></div>
      } @else if (error) { <p class="state error">{{ error }}</p>
      } @else if (analysis) {
        <p-tabs [value]="tab" (valueChange)="changeTab($event)">
          <p-tablist><p-tab value="values">Values</p-tab><p-tab value="plot">Plot</p-tab></p-tablist>
          <p-tabpanels>
            <p-tabpanel value="values"><app-run-values-grid [data]="analysis" (filteredRowsChange)="filteredRowsChanged($event)" /></p-tabpanel>
            <p-tabpanel value="plot"><app-comparison-plot [data]="analysis" [rows]="filteredRows" [maximized]="dialogMaximized" /></p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }
    </p-dialog>
  `,
  styles: [`
    h2 { margin:.2rem 0; font-family:Georgia,serif; font-weight:400; }
    small { color:var(--muted); }
    .eyebrow { color:var(--accent); font-size:.7rem; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
    .state { height:100%; display:grid; place-content:center; justify-items:center; color:var(--muted); }
    .error { color:#a23b31; }
    :host ::ng-deep .p-tabpanels { padding:1rem 0 0; }
  `],
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
    this.visible = true; this.loading = true; this.error = ''; this.analysis = undefined; this.tab = 'values';
    this.title = runs.length > 1 ? 'Loading comparison…' : 'Loading run values…';
    this.context = runs.length > 1 ? `${runs.length} selected runs` : runs[0].software_name || '';
    this.dataService.load(runs).subscribe({
      next: analysis => {
        this.analysis = analysis; this.filteredRows = [...analysis.rows]; this.title = analysis.payload.benchmark || 'Parameters and metrics';
        this.updateContext(); this.loading = false; this.changeDetector.markForCheck();
      },
      error: error => { this.loading = false; this.error = error.error?.detail || 'Run values could not be loaded.'; this.changeDetector.markForCheck(); },
    });
  }

  filteredRowsChanged(rows: Record<string, unknown>[]): void { this.filteredRows = rows; this.updateContext(); }
  changeTab(value: string | number | undefined): void { if (value !== undefined) this.tab = String(value); }
  private updateContext(): void {
    if (!this.analysis) return;
    const count = this.analysis.runCount;
    this.context = `${count} ${count === 1 ? 'run' : 'runs'} · ${this.filteredRows.length} of ${this.analysis.rows.length} observations`;
  }
}

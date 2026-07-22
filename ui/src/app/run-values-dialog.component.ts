import { ChangeDetectorRef, Component, effect, ElementRef, inject, OnDestroy, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { forkJoin } from 'rxjs';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, FilterChangedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TabsModule } from 'primeng/tabs';

import { BenchmarkApi } from './benchmark-api.service';
import { Run, RunValues, ValueColumn } from './models';
import { ThemeService } from './theme.service';

interface SelectOption { label: string; value: string; }

@Component({
  selector: 'app-run-values-dialog',
  standalone: true,
  imports: [AgGridAngular, DialogModule, FormsModule, ProgressSpinnerModule, SelectModule, TabsModule],
  template: `
    <p-dialog [(visible)]="visible" [modal]="true" [maximizable]="true"
      [style]="{ width: 'min(1120px, 96vw)' }" [contentStyle]="{ height: 'min(680px, 76vh)' }"
      (onMaximize)="maximizeChanged($event)">
      <ng-template #header>
        <div>
          <span class="eyebrow">Run values</span>
          <h2>{{ title }}</h2>
          <small>{{ context }}</small>
        </div>
      </ng-template>

      @if (loading) {
        <div class="state"><p-progress-spinner strokeWidth="4" ariaLabel="Loading run values" /><p>Running SPARQL queries…</p></div>
      } @else if (error) {
        <p class="state error">{{ error }}</p>
      } @else if (payload) {
        <p-tabs [value]="tab" (valueChange)="changeTab($event)">
          <p-tablist>
            <p-tab value="values">Values</p-tab>
            <p-tab value="plot">Plot</p-tab>
          </p-tablist>
          <p-tabpanels>
            <p-tabpanel value="values">
              <ag-grid-angular class="values-grid" [rowData]="gridRows" [columnDefs]="columnDefs"
                [defaultColDef]="defaultColDef" (gridReady)="gridReady($event)"
                (filterChanged)="filterChanged($event)" />
            </p-tabpanel>
            <p-tabpanel value="plot">
              <section class="plot-panel" [class.maximized]="dialogMaximized">
                <div class="axis-groups">
                  <fieldset>
                    <legend>X axis</legend>
                    <label>Parameter<p-select [options]="parameterOptions" [(ngModel)]="xKey" optionLabel="label" optionValue="value" (onChange)="drawPlot()" /></label>
                    <label>Scale<p-select [options]="scaleOptions" [(ngModel)]="xScale" optionLabel="label" optionValue="value" (onChange)="drawPlot()" /></label>
                  </fieldset>
                  <fieldset>
                    <legend>Y axis</legend>
                    <label>Metric<p-select [options]="metricOptions" [(ngModel)]="yKey" optionLabel="label" optionValue="value" (onChange)="drawPlot()" /></label>
                    <label>Scale<p-select [options]="scaleOptions" [(ngModel)]="yScale" optionLabel="label" optionValue="value" (onChange)="drawPlot()" /></label>
                  </fieldset>
                </div>
                <p class="plot-message">{{ plotMessage }}</p>
                <div #plot class="plot"></div>
              </section>
            </p-tabpanel>
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
    .values-grid { display:block; width:100%; height:560px; }
    .axis-groups { display:grid; grid-template-columns:1fr 1fr; gap:1rem; }
    fieldset { display:grid; grid-template-columns:2fr 1fr; gap:.75rem; padding:1rem; border:1px solid var(--line); border-radius:10px; }
    legend { padding:0 .4rem; color:var(--accent); font-size:.72rem; font-weight:800; text-transform:uppercase; }
    label { display:flex; flex-direction:column; gap:.35rem; color:var(--muted); font-size:.75rem; font-weight:700; }
    p-select { width:100%; }
    .plot-message { min-height:1.25rem; color:var(--muted); font-size:.78rem; }
    .plot { width:100%; height:450px; border:1px solid var(--line); border-radius:10px; overflow:hidden; }
    .plot-panel.maximized .plot { height:max(450px, calc(100vh - 310px)); }
    @media(max-width:700px) { .axis-groups { grid-template-columns:1fr; } }
  `],
})
export class RunValuesDialogComponent implements OnDestroy {
  private readonly api = inject(BenchmarkApi);
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly theme = inject(ThemeService);
  private plotElement?: ElementRef<HTMLDivElement>;
  private plotResizeObserver?: ResizeObserver;

  @ViewChild('plot') set plotContainer(element: ElementRef<HTMLDivElement> | undefined) {
    this.plotResizeObserver?.disconnect();
    this.plotElement = element;
    if (element) {
      this.plotResizeObserver = new ResizeObserver(() => this.resizePlot());
      this.plotResizeObserver.observe(element.nativeElement);
    }
  }

  visible = false;
  loading = false;
  error = '';
  title = 'Parameters and metrics';
  context = '';
  tab = 'values';
  payload?: RunValues;
  gridRows: Record<string, unknown>[] = [];
  filteredRows: Record<string, unknown>[] = [];
  columnDefs: ColDef[] = [];
  readonly defaultColDef: ColDef = { sortable: true, resizable: true, filterParams: { buttons: ['reset', 'apply'], closeOnApply: true } };
  parameterOptions: SelectOption[] = [];
  metricOptions: SelectOption[] = [];
  readonly scaleOptions: SelectOption[] = [{ label: 'Linear', value: 'linear' }, { label: 'Logarithmic', value: 'log' }];
  xKey = '';
  yKey = '';
  xScale = 'linear';
  yScale = 'linear';
  plotMessage = '';
  dialogMaximized = false;
  private gridApi?: GridApi;

  constructor() {
    effect(() => {
      this.theme.dark();
      if (this.tab === 'plot') window.setTimeout(() => this.drawPlot());
    });
  }

  open(runs: Run[]): void {
    if (!runs.length) return;
    this.visible = true;
    this.loading = true;
    this.error = '';
    this.payload = undefined;
    this.title = runs.length > 1 ? 'Loading comparison…' : 'Loading run values…';
    this.context = runs.length > 1 ? `${runs.length} selected runs` : runs[0].software_name || '';
    this.tab = 'values';
    forkJoin(runs.map(run => this.api.runValues(run.run_id))).subscribe({
      next: responses => this.prepare(runs, responses),
      error: error => {
        this.loading = false;
        this.error = error.error?.detail || 'Run values could not be loaded.';
        this.changeDetector.markForCheck();
      },
    });
  }

  private prepare(runs: Run[], responses: RunValues[]): void {
    const columns = responses[0].columns.filter(column => responses.every(response => response.columns.some(candidate => candidate.key === column.key)));
    const rows = responses.flatMap((response, index) => {
      const run = runs[index];
      const shortRun = run.run_id.replace(/\/$/, '').split('/').at(-1)?.slice(0, 8) || run.run_id.slice(0, 8);
      const software = run.software_name || 'Unknown software';
      return response.rows.map(row => ({ ...row, __software: software, __run_id: shortRun, __series: `${software} — ${shortRun}` }));
    });
    this.payload = { benchmark: responses[0].benchmark, software_name: runs.length === 1 ? runs[0].software_name : null, run_count: runs.length, columns, rows };
    this.title = this.payload.benchmark || 'Parameters and metrics';
    this.gridRows = this.convertRows(columns, rows);
    this.filteredRows = [...this.gridRows];
    this.columnDefs = this.makeColumns(columns, runs.length > 1);
    this.parameterOptions = columns.filter(column => column.kind === 'parameter').map(column => ({ label: column.label, value: column.key }));
    this.metricOptions = columns.filter(column => column.kind === 'metric').map(column => ({ label: column.label, value: column.key }));
    this.xKey = this.parameterOptions[0]?.value || '';
    this.yKey = this.metricOptions[0]?.value || '';
    this.context = `${runs.length} ${runs.length === 1 ? 'run' : 'runs'} · ${rows.length} observations`;
    this.loading = false;
    this.changeDetector.markForCheck();
  }

  private convertRows(columns: ValueColumn[], rows: Record<string, unknown>[]): Record<string, unknown>[] {
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

  private makeColumns(columns: ValueColumn[], multiple: boolean): ColDef[] {
    const metadata: ColDef[] = multiple ? [
      { field: '__software', headerName: 'Software', filter: 'agTextColumnFilter', floatingFilter: true, pinned: 'left', minWidth: 150 },
      { field: '__run_id', headerName: 'Run', filter: 'agTextColumnFilter', floatingFilter: true, minWidth: 120 },
    ] : [];
    return [...metadata, ...columns.map(column => {
      const numeric = this.gridRows.every(row => row[column.key] === null || typeof row[column.key] === 'number');
      return { field: column.key, headerName: column.label, headerClass: `header-${column.kind}`, filter: numeric ? 'agNumberColumnFilter' : 'agTextColumnFilter', floatingFilter: true, cellDataType: numeric ? 'number' : 'text', minWidth: 155 };
    })];
  }

  gridReady(event: GridReadyEvent): void { this.gridApi = event.api; }
  filterChanged(event: FilterChangedEvent): void {
    const rows: Record<string, unknown>[] = [];
    event.api.forEachNodeAfterFilterAndSort(node => rows.push(node.data));
    this.filteredRows = rows;
    this.context = `${this.payload?.run_count || 1} ${this.payload?.run_count === 1 ? 'run' : 'runs'} · ${rows.length} of ${this.gridRows.length} observations`;
    if (this.tab === 'plot') this.drawPlot();
  }

  changeTab(value: string | number | undefined): void {
    if (value === undefined) return;
    this.tab = String(value);
    if (this.tab === 'plot') window.setTimeout(() => this.drawPlot());
  }

  maximizeChanged(event: { maximized?: boolean }): void {
    this.dialogMaximized = Boolean(event.maximized);
    window.setTimeout(() => this.resizePlot(), 150);
  }

  private async resizePlot(): Promise<void> {
    const element = this.plotElement?.nativeElement as (HTMLDivElement & { _fullLayout?: unknown }) | undefined;
    if (!element?._fullLayout) return;
    const Plotly = (await import('plotly.js-dist-min')).default;
    window.requestAnimationFrame(() => Plotly.Plots.resize(element));
  }

  async drawPlot(): Promise<void> {
    if (!this.plotElement || !this.payload || !this.xKey || !this.yKey) return;
    const xColumn = this.payload.columns.find(column => column.key === this.xKey);
    const yColumn = this.payload.columns.find(column => column.key === this.yKey);
    const pairs = this.filteredRows.map(row => ({
      x: Number(row[this.xKey]), y: Number(row[this.yKey]), series: String(row['__series'] || this.payload?.software_name || 'Run'),
    })).filter(pair => Number.isFinite(pair.x) && Number.isFinite(pair.y) && (this.xScale !== 'log' || pair.x > 0) && (this.yScale !== 'log' || pair.y > 0));
    const groups = new Map<string, typeof pairs>();
    pairs.forEach(pair => groups.set(pair.series, [...(groups.get(pair.series) || []), pair]));
    const traces = [...groups.entries()].map(([name, values]) => ({
      name, x: values.sort((a, b) => a.x - b.x).map(value => value.x), y: values.map(value => value.y), type: 'scatter', mode: 'lines+markers',
      hovertemplate: `${xColumn?.label}: %{x}<br>${yColumn?.label}: %{y}<extra>${name}</extra>`,
    }));
    this.plotMessage = `${pairs.length} plotted from ${this.filteredRows.length} filtered observations`;
    const Plotly = (await import('plotly.js-dist-min')).default;
    const dark = this.theme.dark();
    const surface = dark ? '#18201b' : '#ffffff';
    const plotBackground = dark ? '#111814' : '#fafcf9';
    const foreground = dark ? '#e7eee9' : '#17201b';
    const gridColor = dark ? '#34413a' : '#dfe5e1';
    Plotly.react(this.plotElement.nativeElement, traces, {
      margin: { l: 75, r: 24, t: 25, b: 70 }, showlegend: traces.length > 1, hovermode: 'closest',
      paper_bgcolor: surface, plot_bgcolor: plotBackground, font: { color: foreground },
      xaxis: { title: { text: xColumn?.label }, type: this.xScale, automargin: true, gridcolor: gridColor },
      yaxis: { title: { text: yColumn?.label }, type: this.yScale, automargin: true, gridcolor: gridColor },
    }, { responsive: true, displaylogo: false, scrollZoom: true, modeBarButtonsToRemove: ['lasso2d', 'select2d'] });
    this.changeDetector.markForCheck();
  }

  ngOnDestroy(): void { this.plotResizeObserver?.disconnect(); }
}

import { Component, effect, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, GridApi, GridReadyEvent, ICellRendererParams, IRowNode, SelectionChangedEvent } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { Run } from '../../core/models/benchmark.models';
import { formatPublishedDate, resourceLabel } from '../../shared/utils/display-formatters';
import { textLink } from '../../shared/utils/grid-cell-renderers';

@Component({
  selector: 'app-published-runs',
  standalone: true,
  imports: [AgGridAngular, ButtonModule, InputTextModule, ProgressSpinnerModule],
  templateUrl: './published-runs.component.html',
  styleUrl: './published-runs.component.css',
})
export class PublishedRunsComponent {
  readonly runs = input.required<Run[]>();
  readonly loading = input(false);
  readonly updated = input('');
  readonly benchmarkUrl = input('');
  readonly benchmarkName = input('');
  readonly refreshRequested = output<void>();
  readonly analysisRequested = output<Run[]>();
  readonly clearBenchmarkRequested = output<void>();

  selectedRuns: Run[] = [];
  displayedRuns = 0;
  private gridApi?: GridApi<Run>;
  readonly getRowId = (params: { data: Run }) => params.data.run_id;
  readonly isBenchmarkFilterPresent = () => Boolean(this.benchmarkUrl());
  readonly doesBenchmarkFilterPass = (node: IRowNode<Run>) => !this.benchmarkUrl() || node.data?.benchmark_url === this.benchmarkUrl();
  readonly defaultColDef: ColDef = { sortable: true, resizable: true, filter: true, floatingFilter: true };
  readonly columns: ColDef<Run>[] = [
    { headerName: 'Software', field: 'software_name', minWidth: 170, flex: 1, cellRenderer: (params: ICellRendererParams<Run>) => textLink(params.data?.software_url, params.value || 'Unknown') },
    { headerName: 'Benchmark', field: 'benchmark_repo', minWidth: 190, flex: 1, valueFormatter: params => resourceLabel(params.value), cellClass: 'benchmark-name' },
    { headerName: 'Published', field: 'datePublished', minWidth: 210, valueFormatter: params => formatPublishedDate(params.value), cellClass: 'published-date' },
    { headerName: 'RoHub', width: 115, sortable: false, filter: false, floatingFilter: false, cellRenderer: (params: ICellRendererParams<Run>) => textLink(params.data?.run_id, 'Open run ↗') },
    { headerName: 'Named graph', minWidth: 170, sortable: false, filter: false, floatingFilter: false, cellRenderer: (params: ICellRendererParams<Run>) => textLink(params.data?.graph, `Graph ${resourceLabel(params.data?.graph).slice(0, 8)}… ↗`, 'mono') },
  ];

  constructor() {
    effect(() => { this.benchmarkUrl(); queueMicrotask(() => this.applyBenchmarkFilter()); });
  }

  gridReady(event: GridReadyEvent<Run>): void { this.gridApi = event.api; this.applyBenchmarkFilter(); }
  applyBenchmarkFilter(): void { this.gridApi?.onFilterChanged(); this.updateDisplayedCount(); }
  search(value: string): void { this.gridApi?.setGridOption('quickFilterText', value); }
  selectionChanged(event: SelectionChangedEvent<Run>): void { this.selectedRuns = event.api.getSelectedRows(); }
  compare(): void { if (this.canCompare) this.analysisRequested.emit(this.selectedRuns); }
  get canCompare(): boolean { return this.selectedRuns.length > 0 && this.selectedRuns.every(run => run.benchmark_url === this.selectedRuns[0].benchmark_url); }
  get compareHint(): string { return this.selectedRuns.length >= 2 && !this.canCompare ? 'Select runs from the same benchmark' : 'View or compare selected runs'; }

  private updateDisplayedCount(): void {
    let count = 0;
    this.gridApi?.forEachNodeAfterFilter(() => count++);
    this.displayedRuns = count;
  }
}

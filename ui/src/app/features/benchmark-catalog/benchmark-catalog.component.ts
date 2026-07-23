import { Component, computed, input, output, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, ICellRendererParams, SelectionChangedEvent } from 'ag-grid-community';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { Run } from '../../core/models/benchmark.models';
import { iconLink } from '../../shared/utils/grid-cell-renderers';
import { resourceLabel } from '../../shared/utils/display-formatters';

@Component({
  selector: 'app-benchmark-catalog',
  standalone: true,
  imports: [AgGridAngular, ProgressSpinnerModule],
  templateUrl: './benchmark-catalog.component.html',
  styleUrl: './benchmark-catalog.component.css',
})
export class BenchmarkCatalogComponent {
  readonly runs = input.required<Run[]>();
  readonly loading = input(false);
  readonly selectionChange = output<Run | null>();
  @ViewChild(AgGridAngular) grid?: AgGridAngular<Run>;

  readonly benchmarks = computed(() => [...new Map(this.runs().map(run => [run.benchmark_url || run.benchmark_repo, run])).values()]);
  readonly defaultColDef: ColDef = { sortable: true, resizable: true };
  readonly getRowId = (params: { data: Run }) => params.data.benchmark_url || params.data.benchmark_repo;
  readonly columns: ColDef<Run>[] = [
    { headerName: 'Benchmark', flex: 1, minWidth: 240, valueGetter: params => params.data?.benchmark || resourceLabel(params.data?.benchmark_repo), cellClass: 'benchmark-name' },
    { headerName: 'Version', field: 'version', minWidth: 120, width: 140 },
    { headerName: 'GitHub', width: 95, sortable: false, cellRenderer: (params: ICellRendererParams<Run>) => iconLink(params.data?.benchmark_repo, 'pi-github', 'Open GitHub repository') },
    { headerName: 'RoHub', width: 95, sortable: false, cellRenderer: (params: ICellRendererParams<Run>) => iconLink(params.data?.benchmark_url, 'pi-external-link', 'Open benchmark in RoHub') },
  ];

  selectionChanged(event: SelectionChangedEvent<Run>): void {
    this.selectionChange.emit(event.api.getSelectedRows()[0] || null);
  }

  clearSelection(): void { this.grid?.api.deselectAll(); }
}

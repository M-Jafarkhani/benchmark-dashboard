import { Component, computed, input, output, ViewChild } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  ICellRendererParams,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { Run } from '../../core/models/benchmark.models';
import { imageLink } from '../../shared/utils/grid-cell-renderers';
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

  readonly benchmarks = computed(() => [
    ...new Map(this.runs().map((run) => [run.benchmark_url || run.benchmark_repo, run])).values(),
  ]);
  readonly defaultColDef: ColDef = { sortable: true, resizable: true };
  readonly getRowId = (params: { data: Run }) =>
    params.data.benchmark_url || params.data.benchmark_repo;
  readonly columns: ColDef<Run>[] = [
    {
      headerName: 'Benchmark',
      flex: 1,
      minWidth: 240,
      valueGetter: (params) => params.data?.benchmark || resourceLabel(params.data?.benchmark_repo),
      cellClass: 'benchmark-name',
    },
    {
      headerName: 'Version',
      field: 'version',
      minWidth: 120,
      width: 140,
      cellClass: 'centered-column',
      headerClass: 'centered-column-header',
    },
    {
      headerName: 'GitHub',
      width: 95,
      sortable: false,
      cellClass: 'centered-column',
      headerClass: 'centered-column-header',
      cellRenderer: (params: ICellRendererParams<Run>) =>
        imageLink(
          params.data?.benchmark_repo,
          'assets/github.svg',
          'Open GitHub repository',
          'GitHub',
        ),
    },
    {
      headerName: 'RoHub',
      width: 95,
      sortable: false,
      cellClass: 'centered-column',
      headerClass: 'centered-column-header',
      cellRenderer: (params: ICellRendererParams<Run>) =>
        imageLink(
          params.data?.benchmark_url,
          'assets/rohub.svg',
          'Open benchmark in RoHub',
          'RoHub',
          'rohub-action',
        ),
    },
    {
      headerName: 'Jupyter',
      width: 100,
      sortable: false,
      cellClass: 'centered-column',
      headerClass: 'centered-column-header',
      cellRenderer: (params: ICellRendererParams<Run>) =>
        imageLink(
          this.jupyterUrl(params.data?.benchmark_repo),
          'assets/jupyter.svg',
          'Open repository in Jupyter',
          'Jupyter',
        ),
    },
  ];

  private jupyterUrl(repository?: string | null): string | null {
    const repositoryName = repository
      ?.replace(/\/$/, '')
      .split('/')
      .at(-1)
      ?.replace(/\.git$/, '');
    return repositoryName
      ? `https://hub.nfdi-jupyter.de/v2/gh/Simulation-Benchmarks/${encodeURIComponent(repositoryName)}/HEAD`
      : null;
  }

  selectionChanged(event: SelectionChangedEvent<Run>): void {
    this.selectionChange.emit(event.api.getSelectedRows()[0] || null);
  }

  selectFirstRow(event: RowDataUpdatedEvent<Run>): void {
    if (!event.api.getSelectedRows().length) {
      event.api.getDisplayedRowAtIndex(0)?.setSelected(true);
    }
  }

  clearSelection(): void {
    this.grid?.api.deselectAll();
  }
}

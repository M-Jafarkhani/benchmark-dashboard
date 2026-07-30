import { ChangeDetectorRef, Component, computed, inject, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import {
  ColDef,
  ICellRendererParams,
  RowDataUpdatedEvent,
  SelectionChangedEvent,
} from 'ag-grid-community';
import { DialogModule } from 'primeng/dialog';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TabsModule } from 'primeng/tabs';

import { BenchmarkVariable, Run } from '../../core/models/benchmark.models';
import { imageLink } from '../../shared/utils/grid-cell-renderers';
import { resourceLabel } from '../../shared/utils/display-formatters';

@Component({
  selector: 'app-benchmark-catalog',
  standalone: true,
  imports: [AgGridAngular, DialogModule, ProgressSpinnerModule, TabsModule],
  templateUrl: './benchmark-catalog.component.html',
  styleUrl: './benchmark-catalog.component.css',
})
export class BenchmarkCatalogComponent {
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly runs = input.required<Run[]>();
  readonly loading = input(false);
  readonly selectionChange = output<Run | null>();
  metadataVisible = false;
  metadataBenchmark?: Run;

  readonly benchmarks = computed(() => [
    ...new Map(this.runs().map((run) => [run.benchmark_url || run.benchmark_repo, run])).values(),
  ]);
  readonly defaultColDef: ColDef = { sortable: true, resizable: true };
  readonly getRowId = (params: { data: Run }) =>
    params.data.benchmark_url || params.data.benchmark_repo;
  readonly variableColumns: ColDef<BenchmarkVariable>[] = [
    {
      headerName: 'Name',
      field: 'name',
      flex: 1,
      minWidth: 220,
    },
    {
      headerName: 'Unit',
      field: 'unit',
      flex: 1,
      minWidth: 220,
      cellRenderer: (params: ICellRendererParams<BenchmarkVariable>) =>
        this.unitLink(params.data?.unit),
    },
  ];
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
      headerName: 'Metadata',
      width: 110,
      sortable: false,
      cellClass: 'centered-column',
      headerClass: 'centered-column-header',
      cellRenderer: (params: ICellRendererParams<Run>) => this.metadataButton(params.data),
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

  private metadataButton(benchmark?: Run): Node {
    if (!benchmark) return document.createTextNode('—');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'metadata-button';
    button.title = 'View parameters and metrics';
    button.setAttribute('aria-label', 'View parameters and metrics');
    button.innerHTML = '<i class="pi pi-list" aria-hidden="true"></i>';
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      this.metadataBenchmark = benchmark;
      this.metadataVisible = true;
      this.changeDetector.detectChanges();
    });
    return button;
  }

  private unitLink(unit?: string | null): Node {
    if (!unit) return document.createTextNode('—');
    const link = document.createElement('a');
    link.href = unit;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = resourceLabel(unit);
    link.title = unit;
    link.className = 'unit-link';
    return link;
  }

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
}

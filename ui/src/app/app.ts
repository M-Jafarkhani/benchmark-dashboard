import { ChangeDetectorRef, Component, inject, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgGridAngular } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GridApi, GridReadyEvent, ICellRendererParams, ModuleRegistry, SelectionChangedEvent } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { ToggleSwitchModule } from 'primeng/toggleswitch';

import { BenchmarkApi } from './benchmark-api.service';
import { Run } from './models';
import { RunValuesDialogComponent } from './run-values-dialog.component';
import { SparqlLogComponent } from './sparql-log.component';
import { ThemeService } from './theme.service';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [AgGridAngular, ButtonModule, FormsModule, InputTextModule, ProgressSpinnerModule, ToggleSwitchModule, RunValuesDialogComponent, SparqlLogComponent],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  private readonly api = inject(BenchmarkApi);
  private readonly changeDetector = inject(ChangeDetectorRef);
  readonly theme = inject(ThemeService);
  @ViewChild(RunValuesDialogComponent) valuesDialog?: RunValuesDialogComponent;

  runs: Run[] = [];
  benchmarks: Run[] = [];
  selectedRuns: Run[] = [];
  loading = true;
  error = '';
  updated = '';
  displayedRuns = 0;
  private runsGridApi?: GridApi<Run>;
  readonly getRowId = (params: { data: Run }) => params.data.run_id;

  readonly defaultColDef: ColDef = { sortable: true, resizable: true };
  readonly runDefaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filter: true,
    floatingFilter: true,
  };
  readonly benchmarkColumns: ColDef<Run>[] = [
    { headerName: 'Benchmark', flex: 1, minWidth: 240, valueGetter: params => params.data?.benchmark || this.label(params.data?.benchmark_repo), cellClass: 'benchmark-name' },
    { headerName: 'GitHub', width: 95, sortable: false, cellRenderer: (params: ICellRendererParams<Run>) => this.externalLink(params.data?.benchmark_repo, 'pi-github', 'Open GitHub repository') },
    { headerName: 'RoHub', width: 95, sortable: false, cellRenderer: (params: ICellRendererParams<Run>) => this.externalLink(params.data?.benchmark_url, 'pi-external-link', 'Open benchmark in RoHub') },
  ];
  readonly runColumns: ColDef<Run>[] = [
    { headerName: 'Software', field: 'software_name', minWidth: 170, flex: 1, cellRenderer: (params: ICellRendererParams<Run>) => this.textLink(params.data?.software_url, params.value || 'Unknown') },
    { headerName: 'Benchmark', field: 'benchmark_repo', minWidth: 190, flex: 1, valueFormatter: params => this.label(params.value), cellClass: 'benchmark-name' },
    { headerName: 'Published', field: 'datePublished', minWidth: 150, valueFormatter: params => this.publishedDate(params.value), cellClass: 'published-date' },
    { headerName: 'RoHub', width: 115, sortable: false, filter: false, floatingFilter: false, cellRenderer: (params: ICellRendererParams<Run>) => this.textLink(params.data?.run_id, 'Open run ↗') },
    { headerName: 'Named graph', minWidth: 170, sortable: false, filter: false, floatingFilter: false, cellRenderer: (params: ICellRendererParams<Run>) => this.textLink(params.data?.graph, `Graph ${this.label(params.data?.graph).slice(0, 8)}… ↗`, 'mono') },
  ];

  ngOnInit(): void { this.load(); }

  load(refresh = false): void {
    this.loading = true;
    this.error = '';
    this.api.runs(refresh).subscribe({
      next: response => {
        this.runs = response.items;
        this.benchmarks = [...new Map(this.runs.map(run => [run.benchmark_url || run.benchmark_repo, run])).values()];
        this.displayedRuns = this.runs.length;
        this.updated = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

  runGridReady(event: GridReadyEvent<Run>): void { this.runsGridApi = event.api; this.updateDisplayedCount(); }
  search(value: string): void { this.runsGridApi?.setGridOption('quickFilterText', value); }
  filterChanged(): void { this.updateDisplayedCount(); }
  selectionChanged(event: SelectionChangedEvent<Run>): void { this.selectedRuns = event.api.getSelectedRows(); }
  compare(): void { if (this.canCompare) this.valuesDialog?.open(this.selectedRuns); }
  get canCompare(): boolean { return this.selectedRuns.length >= 1 && this.selectedRuns.every(run => run.benchmark_url === this.selectedRuns[0].benchmark_url); }
  get compareHint(): string { return this.selectedRuns.length >= 2 && !this.canCompare ? 'Select runs from the same benchmark' : 'View or compare selected runs'; }

  private updateDisplayedCount(): void {
    let count = 0;
    this.runsGridApi?.forEachNodeAfterFilter(() => count++);
    this.displayedRuns = count;
  }

  label(url?: string | null): string {
    if (!url) return 'Unavailable';
    return url.replace(/\/$/, '').split('/').at(-1)?.replaceAll('-', ' ') || url;
  }

  publishedDate(value?: string | null): string {
    if (!value) return '—';
    const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00Z` : value);
    return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  }

  private externalLink(url: string | null | undefined, icon: string, title: string): Node {
    if (!url) return document.createTextNode('—');
    const anchor = document.createElement('a');
    anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.title = title; anchor.className = 'grid-action';
    anchor.innerHTML = `<i class="pi ${icon}" aria-hidden="true"></i>`;
    return anchor;
  }

  private textLink(url: string | null | undefined, text: string, className = ''): Node {
    if (!url) return document.createTextNode(text);
    const anchor = document.createElement('a'); anchor.href = url; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; anchor.textContent = text; anchor.className = className;
    return anchor;
  }
}

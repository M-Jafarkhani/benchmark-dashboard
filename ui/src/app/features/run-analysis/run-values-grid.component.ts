import { Component, computed, input, output } from '@angular/core';
import { AgGridAngular } from 'ag-grid-angular';
import { ColDef, FilterChangedEvent, GridApi, GridReadyEvent } from 'ag-grid-community';
import { ButtonModule } from 'primeng/button';

import { RunAnalysisData } from './run-analysis.models';

@Component({
  selector: 'app-run-values-grid',
  standalone: true,
  imports: [AgGridAngular, ButtonModule],
  templateUrl: './run-values-grid.component.html',
  styleUrl: './run-values-grid.component.css',
})
export class RunValuesGridComponent {
  readonly data = input.required<RunAnalysisData>();
  readonly maximized = input(false);
  readonly filteredRowsChange = output<Record<string, unknown>[]>();
  gridApi?: GridApi;
  readonly defaultColDef: ColDef = {
    sortable: true,
    resizable: true,
    filterParams: { buttons: ['reset', 'apply'], closeOnApply: true },
  };
  readonly columnDefs = computed<ColDef[]>(() => {
    const analysis = this.data();
    const metadata: ColDef[] =
      analysis.runCount > 1
        ? [
            {
              field: '__software',
              headerName: 'Software',
              filter: 'agTextColumnFilter',
              floatingFilter: true,
              pinned: 'left',
              minWidth: 150,
            },
            {
              field: '__run_id',
              headerName: 'Run',
              filter: 'agTextColumnFilter',
              floatingFilter: true,
              minWidth: 120,
            },
          ]
        : [];
    return [
      ...metadata,
      ...analysis.columns.map((column) => {
        const numeric = analysis.rows.every(
          (row) => row[column.key] === null || typeof row[column.key] === 'number',
        );
        return {
          field: column.key,
          headerName: column.label,
          headerClass: `header-${column.kind}`,
          cellClass: `cell-${column.kind}`,
          filter: numeric ? 'agNumberColumnFilter' : 'agTextColumnFilter',
          floatingFilter: true,
          cellDataType: numeric ? 'number' : 'text',
          minWidth: 155,
        };
      }),
    ];
  });

  gridReady(event: GridReadyEvent): void {
    this.gridApi = event.api;
  }
  filterChanged(event: FilterChangedEvent): void {
    const rows: Record<string, unknown>[] = [];
    event.api.forEachNodeAfterFilterAndSort((node) => rows.push(node.data));
    this.filteredRowsChange.emit(rows);
  }
  exportCsv(): void {
    const analysis = this.data();
    const name = (analysis.payload.benchmark || 'benchmark-values')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    this.gridApi?.exportDataAsCsv({
      fileName: `${name || 'benchmark-values'}${analysis.runCount > 1 ? '-comparison' : ''}.csv`,
      exportedRows: 'filteredAndSorted',
    });
  }
}

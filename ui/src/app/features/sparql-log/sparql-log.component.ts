import { ChangeDetectorRef, Component, inject, OnDestroy } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';

import { BenchmarkApi } from '../../core/services/benchmark-api.service';
import { SparqlEntry } from '../../core/models/benchmark.models';

@Component({
  selector: 'app-sparql-log',
  standalone: true,
  imports: [ButtonModule, DatePipe, DialogModule],
  template: `
    <p-button
      class="log-launcher"
      label="SPARQL log"
      icon="pi pi-code"
      severity="contrast"
      (onClick)="open()"
    />
    <p-dialog
      [(visible)]="visible"
      [modal]="true"
      [style]="{ width: 'min(920px, 94vw)' }"
      [contentStyle]="{ height: 'min(620px, 70vh)', overflow: 'auto' }"
      (onHide)="stopPolling()"
    >
      <ng-template #header>
        <div>
          <span class="eyebrow">Live execution flow</span>
          <h2>SPARQL queries</h2>
          <small>{{ entries.length }} recent queries · updates every second</small>
        </div>
      </ng-template>
      <div class="log-toolbar">
        <p-button
          label="Clear logs"
          icon="pi pi-trash"
          severity="danger"
          [outlined]="true"
          size="small"
          [disabled]="clearing"
          (onClick)="clear()"
        />
      </div>
      @if (error) {
        <p class="error state">{{ error }}</p>
      } @else if (!entries.length) {
        <p class="state">No SPARQL query has run yet.</p>
      }
      @for (entry of entries; track entry.id) {
        <article class="log-entry">
          <header>
            <span class="status" [class]="entry.status">{{ entry.status }}</span>
            <time>{{ entry.started_at | date: 'mediumTime' }}</time>
            <span>{{
              entry.duration_ms === null ? 'In progress' : entry.duration_ms + ' ms'
            }}</span>
          </header>
          <pre>{{ entry.query }}</pre>
          @if (entry.error) {
            <p class="query-error">{{ entry.error }}</p>
          }
        </article>
      }
    </p-dialog>
  `,
  styles: [
    `
      :host ::ng-deep .log-launcher {
        position: fixed;
        right: 22px;
        bottom: 22px;
        z-index: 20;
      }
      h2 {
        margin: 0.2rem 0;
        font-family: Georgia, serif;
        font-weight: 400;
      }
      small {
        color: var(--muted);
      }
      .eyebrow {
        color: var(--accent);
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .log-toolbar {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 0.8rem;
      }
      .log-entry {
        margin-bottom: 0.75rem;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
        background: var(--surface);
      }
      .log-entry header {
        display: flex;
        gap: 0.75rem;
        align-items: center;
        padding: 0.55rem 0.75rem;
        color: var(--muted);
        font-size: 0.75rem;
        border-bottom: 1px solid var(--line);
      }
      .status {
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
      }
      .status.running {
        background: #fff2c7;
        color: #725a0b;
      }
      .status.succeeded {
        background: #dff2e5;
        color: #235d39;
      }
      .status.failed {
        background: #f8dfdc;
        color: #8c3028;
      }
      pre {
        margin: 0;
        padding: 0.85rem;
        overflow: auto;
        color: var(--text);
        font:
          12px/1.55 ui-monospace,
          monospace;
      }
      .query-error {
        margin: 0;
        padding: 0.65rem 0.85rem;
        color: #a23b31;
        background: #fff4f2;
      }
      .state {
        padding: 2.5rem;
        text-align: center;
        color: var(--muted);
      }
      .error {
        color: #a23b31;
      }
    `,
  ],
})
export class SparqlLogComponent implements OnDestroy {
  private readonly api = inject(BenchmarkApi);
  private readonly changeDetector = inject(ChangeDetectorRef);
  visible = false;
  clearing = false;
  entries: SparqlEntry[] = [];
  error = '';
  private timer?: number;

  open(): void {
    this.visible = true;
    this.refresh();
    this.timer = window.setInterval(() => this.refresh(), 1000);
  }

  refresh(): void {
    this.api.sparqlLog().subscribe({
      next: (response) => {
        this.entries = response.items;
        this.error = '';
        this.changeDetector.markForCheck();
      },
      error: (error) => {
        this.error = error.error?.detail || 'The query log could not be loaded.';
        this.changeDetector.markForCheck();
      },
    });
  }

  clear(): void {
    this.clearing = true;
    this.api.clearSparqlLog().subscribe({
      next: () => {
        this.entries = [];
        this.clearing = false;
        this.changeDetector.markForCheck();
      },
      error: () => {
        this.error = 'The query log could not be cleared.';
        this.clearing = false;
        this.changeDetector.markForCheck();
      },
    });
  }

  stopPolling(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }
  ngOnDestroy(): void {
    this.stopPolling();
  }
}

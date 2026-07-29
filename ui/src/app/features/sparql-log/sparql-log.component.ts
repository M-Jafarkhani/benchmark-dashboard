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
      [maximizable]="true"
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
            <div class="log-actions">
              <button
                class="log-action"
                type="button"
                [attr.aria-label]="copiedEntryId === entry.id ? 'Query copied' : 'Copy query'"
                [title]="copiedEntryId === entry.id ? 'Copied' : 'Copy query'"
                (click)="copyEntry(entry)"
              >
                <i
                  class="pi"
                  [class.pi-copy]="copiedEntryId !== entry.id"
                  [class.pi-check]="copiedEntryId === entry.id"
                  aria-hidden="true"
                ></i>
              </button>
              <button
                class="log-action"
                type="button"
                [attr.aria-expanded]="!isCollapsed(entry.id)"
                [attr.aria-controls]="'sparql-log-' + entry.id"
                [attr.aria-label]="isCollapsed(entry.id) ? 'Expand query' : 'Collapse query'"
                [title]="isCollapsed(entry.id) ? 'Expand query' : 'Collapse query'"
                (click)="toggleEntry(entry.id)"
              >
                <i
                  class="pi"
                  [class.pi-chevron-down]="isCollapsed(entry.id)"
                  [class.pi-chevron-up]="!isCollapsed(entry.id)"
                  aria-hidden="true"
                ></i>
              </button>
            </div>
          </header>
          @if (!isCollapsed(entry.id)) {
            <div [id]="'sparql-log-' + entry.id">
              <pre>{{ entry.query }}</pre>
              @if (entry.error) {
                <p class="query-error">{{ entry.error }}</p>
              }
            </div>
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
        font-weight: 700;
        text-transform: uppercase;
      }
      small {
        color: var(--muted);
      }
      .eyebrow {
        color: var(--text);
        font-size: 0.7rem;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .log-toolbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        justify-content: flex-end;
        margin: -1px 0 0.8rem;
        padding: 0.65rem 0;
        background: var(--surface);
        border-bottom: 1px solid var(--line);
      }
      .log-entry {
        margin-bottom: 0.75rem;
        border: 1px solid var(--line);
        border-radius: 0;
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
      .log-actions {
        display: inline-flex;
        align-items: center;
        gap: 0.2rem;
        margin-left: auto;
      }
      .log-action {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 0;
        padding: 0.3rem 0.45rem;
        background: transparent;
        color: var(--accent);
        font-size: 0.75rem;
        font-weight: 700;
        cursor: pointer;
      }
      .log-action:hover,
      .log-action:focus-visible {
        color: var(--accent-hover);
        background: var(--soft);
      }
      .status {
        border-radius: 999px;
        padding: 0.1rem 0.5rem;
        font-size: 0.65rem;
        font-weight: 800;
        text-transform: uppercase;
      }
      .status.running {
        background: var(--warning-soft);
        color: var(--warning);
      }
      .status.succeeded {
        background: var(--success-soft);
        color: var(--success);
      }
      .status.failed {
        background: var(--danger-soft);
        color: var(--danger);
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
        color: var(--danger);
        background: var(--danger-soft);
      }
      .state {
        padding: 2.5rem;
        text-align: center;
        color: var(--muted);
      }
      .error {
        color: var(--danger);
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
  readonly collapsedEntries = new Set<number>();
  copiedEntryId: number | null = null;
  private timer?: number;
  private copyFeedbackTimer?: number;

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
        this.collapsedEntries.clear();
        this.copiedEntryId = null;
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

  isCollapsed(id: number): boolean {
    return this.collapsedEntries.has(id);
  }

  toggleEntry(id: number): void {
    if (this.collapsedEntries.has(id)) {
      this.collapsedEntries.delete(id);
    } else {
      this.collapsedEntries.add(id);
    }
  }

  async copyEntry(entry: SparqlEntry): Promise<void> {
    await navigator.clipboard.writeText(entry.query);
    this.copiedEntryId = entry.id;
    window.clearTimeout(this.copyFeedbackTimer);
    this.copyFeedbackTimer = window.setTimeout(() => {
      this.copiedEntryId = null;
      this.changeDetector.markForCheck();
    }, 1600);
  }

  stopPolling(): void {
    window.clearInterval(this.timer);
    this.timer = undefined;
  }
  ngOnDestroy(): void {
    this.stopPolling();
    window.clearTimeout(this.copyFeedbackTimer);
  }
}

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
  templateUrl: './sparql-log.component.html',
  styleUrl: './sparql-log.component.css',
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

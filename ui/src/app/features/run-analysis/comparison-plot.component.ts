import {
  Component,
  effect,
  ElementRef,
  inject,
  input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';

import { ThemeService } from '../../core/services/theme.service';
import { RunAnalysisData, SelectOption } from './run-analysis.models';

@Component({
  selector: 'app-comparison-plot',
  standalone: true,
  imports: [FormsModule, SelectModule],
  template: `
    <section class="plot-panel" [class.maximized]="maximized()">
      <div class="axis-groups">
        <fieldset>
          <legend>X axis</legend>
          <label
            >Parameter<p-select
              [options]="parameterOptions"
              [(ngModel)]="xKey"
              optionLabel="label"
              optionValue="value"
              (onChange)="draw()"
          /></label>
          <label
            >Scale<p-select
              [options]="scaleOptions"
              [(ngModel)]="xScale"
              optionLabel="label"
              optionValue="value"
              (onChange)="draw()"
          /></label>
        </fieldset>
        <fieldset>
          <legend>Y axis</legend>
          <label
            >Metric<p-select
              [options]="metricOptions"
              [(ngModel)]="yKey"
              optionLabel="label"
              optionValue="value"
              (onChange)="draw()"
          /></label>
          <label
            >Scale<p-select
              [options]="scaleOptions"
              [(ngModel)]="yScale"
              optionLabel="label"
              optionValue="value"
              (onChange)="draw()"
          /></label>
        </fieldset>
      </div>
      <p class="plot-message">{{ plotMessage }}</p>
      <div #plot class="plot"></div>
    </section>
  `,
  styles: [
    `
      .axis-groups {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 1rem;
      }
      fieldset {
        display: grid;
        grid-template-columns: 2fr 1fr;
        gap: 0.75rem;
        padding: 1rem;
        border: 1px solid var(--line);
        border-radius: 10px;
      }
      legend {
        padding: 0 0.4rem;
        color: var(--accent);
        font-size: 0.72rem;
        font-weight: 800;
        text-transform: uppercase;
      }
      label {
        display: flex;
        flex-direction: column;
        gap: 0.35rem;
        color: var(--muted);
        font-size: 0.75rem;
        font-weight: 700;
      }
      p-select {
        width: 100%;
      }
      .plot-message {
        min-height: 1.25rem;
        color: var(--muted);
        font-size: 0.78rem;
      }
      .plot {
        width: 100%;
        height: 450px;
        border: 1px solid var(--line);
        border-radius: 10px;
        overflow: hidden;
      }
      .plot-panel.maximized .plot {
        height: max(450px, calc(100vh - 310px));
      }
      @media (max-width: 700px) {
        .axis-groups {
          grid-template-columns: 1fr;
        }
      }
    `,
  ],
})
export class ComparisonPlotComponent implements OnChanges, OnDestroy {
  private readonly theme = inject(ThemeService);
  readonly data = input.required<RunAnalysisData>();
  readonly rows = input.required<Record<string, unknown>[]>();
  readonly maximized = input(false);
  private plotElement?: ElementRef<HTMLDivElement>;
  private resizeObserver?: ResizeObserver;
  parameterOptions: SelectOption[] = [];
  metricOptions: SelectOption[] = [];
  readonly scaleOptions: SelectOption[] = [
    { label: 'Linear', value: 'linear' },
    { label: 'Logarithmic', value: 'log' },
  ];
  xKey = '';
  yKey = '';
  xScale = 'linear';
  yScale = 'linear';
  plotMessage = '';

  @ViewChild('plot') set plotContainer(element: ElementRef<HTMLDivElement> | undefined) {
    this.resizeObserver?.disconnect();
    this.plotElement = element;
    if (element) {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(element.nativeElement);
      window.setTimeout(() => this.draw());
    }
  }

  constructor() {
    effect(() => {
      this.theme.dark();
      window.setTimeout(() => this.draw());
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data']) {
      const columns = this.data().columns;
      this.parameterOptions = columns
        .filter((column) => column.kind === 'parameter')
        .map((column) => ({ label: column.label, value: column.key }));
      this.metricOptions = columns
        .filter((column) => column.kind === 'metric')
        .map((column) => ({ label: column.label, value: column.key }));
      this.xKey = this.parameterOptions[0]?.value || '';
      this.yKey = this.metricOptions[0]?.value || '';
    }
    window.setTimeout(() => (changes['maximized'] ? this.resize() : this.draw()), 100);
  }

  async draw(): Promise<void> {
    if (!this.plotElement || !this.xKey || !this.yKey) return;
    const analysis = this.data();
    const xColumn = analysis.columns.find((column) => column.key === this.xKey);
    const yColumn = analysis.columns.find((column) => column.key === this.yKey);
    const pairs = this.rows()
      .map((row) => ({
        x: Number(row[this.xKey]),
        y: Number(row[this.yKey]),
        series: String(row['__series'] || analysis.payload.software_name || 'Run'),
      }))
      .filter(
        (pair) =>
          Number.isFinite(pair.x) &&
          Number.isFinite(pair.y) &&
          (this.xScale !== 'log' || pair.x > 0) &&
          (this.yScale !== 'log' || pair.y > 0),
      );
    const groups = new Map<string, typeof pairs>();
    pairs.forEach((pair) => groups.set(pair.series, [...(groups.get(pair.series) || []), pair]));
    const traces = [...groups.entries()].map(([name, values]) => {
      const sorted = [...values].sort((a, b) => a.x - b.x);
      return {
        name,
        x: sorted.map((value) => value.x),
        y: sorted.map((value) => value.y),
        type: 'scatter',
        mode: 'lines+markers',
        hovertemplate: `${xColumn?.label}: %{x}<br>${yColumn?.label}: %{y}<extra>${name}</extra>`,
      };
    });
    this.plotMessage = `${pairs.length} plotted from ${this.rows().length} filtered observations`;
    const Plotly = (await import('plotly.js-dist-min')).default;
    const dark = this.theme.dark();
    Plotly.react(
      this.plotElement.nativeElement,
      traces,
      {
        margin: { l: 75, r: 24, t: 25, b: 70 },
        showlegend: traces.length > 1,
        hovermode: 'closest',
        paper_bgcolor: dark ? '#18201b' : '#ffffff',
        plot_bgcolor: dark ? '#111814' : '#fafcf9',
        font: { color: dark ? '#e7eee9' : '#17201b' },
        xaxis: {
          title: { text: xColumn?.label },
          type: this.xScale,
          automargin: true,
          gridcolor: dark ? '#34413a' : '#dfe5e1',
        },
        yaxis: {
          title: { text: yColumn?.label },
          type: this.yScale,
          automargin: true,
          gridcolor: dark ? '#34413a' : '#dfe5e1',
        },
      },
      {
        responsive: true,
        displaylogo: false,
        scrollZoom: true,
        modeBarButtonsToRemove: ['lasso2d', 'select2d'],
      },
    );
  }

  private async resize(): Promise<void> {
    const element = this.plotElement?.nativeElement as
      (HTMLDivElement & { _fullLayout?: unknown }) | undefined;
    if (!element?._fullLayout) return;
    const Plotly = (await import('plotly.js-dist-min')).default;
    window.requestAnimationFrame(() => Plotly.Plots.resize(element));
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }
}

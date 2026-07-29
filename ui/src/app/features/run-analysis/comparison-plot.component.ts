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
  templateUrl: './comparison-plot.component.html',
  styleUrl: './comparison-plot.component.css',
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
    const colors = this.theme.colors();
    Plotly.react(
      this.plotElement.nativeElement,
      traces,
      {
        margin: { l: 75, r: 24, t: 25, b: 70 },
        showlegend: traces.length > 1,
        hovermode: 'closest',
        paper_bgcolor: colors.surface,
        plot_bgcolor: colors.plot,
        font: { color: colors.text, family: 'IBM Plex, Arial, sans-serif' },
        colorway: ['#046cb4', '#e6005f', '#f9b200', '#792182', '#00763c', '#ee7202'],
        xaxis: {
          title: { text: xColumn?.label },
          type: this.xScale,
          automargin: true,
          gridcolor: colors.line,
          zerolinecolor: colors.line,
        },
        yaxis: {
          title: { text: yColumn?.label },
          type: this.yScale,
          automargin: true,
          gridcolor: colors.line,
          zerolinecolor: colors.line,
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

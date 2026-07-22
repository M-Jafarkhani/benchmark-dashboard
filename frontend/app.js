const state = { runs: [], query: "", sort: "benchmark_repo", direction: 1 };
const body = document.querySelector("#runs");
const benchmarksBody = document.querySelector("#benchmarks");
const count = document.querySelector("#count");
const updated = document.querySelector("#updated");
const benchmarkDialog = document.querySelector("#benchmark-dialog");
const runValuesDialog = document.querySelector("#run-values-dialog");
const runValuesContent = document.querySelector("#values-dialog-content");
const runValuesTabs = document.querySelector("#values-dialog-tabs");
let currentPlotDraw = null;
let currentRunValuesTab = "values";
let benchmarkGridApi = null;
let runsGridApi = null;
const sparqlLogDialog = document.querySelector("#sparql-log-dialog");
const sparqlLogContent = document.querySelector("#sparql-log-content");
let sparqlLogTimer = null;

function label(url) {
  if (!url) return "Unavailable";
  const parts = url.replace(/\/$/, "").split("/");
  return parts.at(-1).replaceAll("-", " ");
}

function link(url, text, className = "") {
  if (!url) return document.createTextNode("—");
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.target = "_blank";
  anchor.rel = "noopener noreferrer";
  anchor.className = className;
  anchor.textContent = text;
  anchor.title = url;
  return anchor;
}

function publishedDate(value) {
  if (!value) return "—";
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  const date = new Date(dateOnly ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(dateOnly
      ? { timeZone: "UTC" }
      : { hour: "2-digit", minute: "2-digit", timeZoneName: "short" }),
  }).format(date);
}

function renderSparqlLog(items) {
  document.querySelector("#sparql-log-count").textContent =
    `${items.length} recent ${items.length === 1 ? "query" : "queries"} · updates every second`;
  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "dialog-state";
    empty.textContent = "No SPARQL query has run yet.";
    sparqlLogContent.replaceChildren(empty);
    return;
  }
  const entries = items.map(item => {
    const entry = document.createElement("article");
    entry.className = "sparql-entry";
    const header = document.createElement("div");
    header.className = "sparql-entry-heading";
    const status = document.createElement("span");
    status.className = `query-status ${item.status}`;
    status.textContent = item.status;
    const time = document.createElement("time");
    time.dateTime = item.started_at;
    time.textContent = new Date(item.started_at).toLocaleTimeString();
    const duration = document.createElement("span");
    duration.textContent = item.duration_ms === null ? "In progress" : `${item.duration_ms} ms`;
    header.append(status, time, duration);
    const query = document.createElement("pre");
    query.textContent = item.query;
    entry.append(header, query);
    if (item.error) {
      const error = document.createElement("p");
      error.className = "sparql-error";
      error.textContent = item.error;
      entry.append(error);
    }
    return entry;
  });
  sparqlLogContent.replaceChildren(...entries);
}

async function refreshSparqlLog() {
  try {
    const response = await fetch("/api/sparql-log", { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "The query log could not be loaded.");
    renderSparqlLog(payload.items);
  } catch (error) {
    const message = document.createElement("p");
    message.className = "dialog-state error";
    message.textContent = error.message;
    sparqlLogContent.replaceChildren(message);
  }
}

function openSparqlLog() {
  sparqlLogDialog.showModal();
  refreshSparqlLog();
  sparqlLogTimer = window.setInterval(refreshSparqlLog, 1000);
}

function closeSparqlLog() {
  sparqlLogDialog.close();
  window.clearInterval(sparqlLogTimer);
  sparqlLogTimer = null;
}

async function clearSparqlLog() {
  const button = document.querySelector("#clear-sparql-log");
  button.disabled = true;
  try {
    const response = await fetch("/api/sparql-log", { method: "DELETE" });
    if (!response.ok) throw new Error("The query log could not be cleared.");
    renderSparqlLog([]);
  } catch (error) {
    const message = document.createElement("p");
    message.className = "dialog-state error";
    message.textContent = error.message;
    sparqlLogContent.replaceChildren(message);
  } finally {
    button.disabled = false;
  }
}

function githubIconLink(url) {
  const anchor = link(url, "", "icon-link github-icon-link");
  anchor.title = "Open benchmark repository on GitHub";
  if (url) {
    const icon = document.createElement("img");
    icon.src = "/assets/icons/github.svg";
    icon.alt = "GitHub";
    anchor.replaceChildren(icon);
  }
  return anchor;
}

function rohubIconLink(url) {
  const anchor = link(url, "", "icon-link rohub-link");
  anchor.title = "Open benchmark in RoHub";
  if (url) {
    const icon = document.createElement("img");
    icon.src = "/assets/icons/rohub.png";
    icon.alt = "RoHub";
    anchor.replaceChildren(icon);
  }
  return anchor;
}

function tagList(values) {
  if (!values?.length) return document.createTextNode("—");
  const list = document.createElement("ul");
  list.className = "tag-list";
  values.forEach(value => {
    const item = document.createElement("li");
    item.textContent = value;
    list.append(item);
  });
  return list;
}

function showBenchmarkDetails(benchmark) {
  document.querySelector("#dialog-title").textContent =
    benchmark.benchmark || label(benchmark.benchmark_repo);
  document.querySelector("#dialog-parameters").replaceChildren(tagList(benchmark.parameters));
  document.querySelector("#dialog-metrics").replaceChildren(tagList(benchmark.metrics));
  benchmarkDialog.showModal();
}

function detailsButton(benchmark) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-link icon-button";
  button.title = "Show parameters and metrics";
  button.setAttribute("aria-label", `Show details for ${benchmark.benchmark || label(benchmark.benchmark_repo)}`);
  const icon = document.createElement("img");
  icon.src = "/assets/icons/details.svg";
  icon.alt = "";
  button.append(icon);
  button.addEventListener("click", () => showBenchmarkDetails(benchmark));
  return button;
}

function renderRunValues(payload) {
  document.querySelector("#values-dialog-title").textContent =
    payload.benchmark || "Parameters and metrics";
  document.querySelector("#values-dialog-context").textContent =
    [
      payload.run_count > 1 ? `${payload.run_count} runs` : payload.software_name,
      `${payload.rows.length} observations`,
    ].filter(Boolean).join(" · ");

  if (!payload.rows.length) {
    const empty = document.createElement("p");
    empty.className = "dialog-state";
    empty.textContent = "The SPARQL query returned no values for this run.";
    runValuesContent.replaceChildren(empty);
    return;
  }

  const columnTypes = Object.fromEntries(payload.columns.map(column => {
    const values = payload.rows
      .map(row => row[column.key])
      .filter(value => value !== null && value !== undefined && value !== "");
    return [column.key, values.length > 0 && values.every(value => Number.isFinite(Number(value)))
      ? "number"
      : "text"];
  }));
  const gridRows = payload.rows.map(row => ({
    __series: row.__series,
    __software: row.__software,
    __run_id: row.__run_id,
    ...Object.fromEntries(payload.columns.map(column => {
      const value = row[column.key];
      if (value === null || value === undefined || value === "") return [column.key, null];
      return [column.key, columnTypes[column.key] === "number" ? Number(value) : String(value)];
    })),
  }));
  const plotData = { rows: gridRows };
  const grid = document.createElement("div");
  grid.className = "run-values-grid";
  const plot = buildRunPlot(payload, plotData);
  runValuesContent.replaceChildren(plot, grid);
  currentPlotDraw = plot.draw;
  runValuesTabs.hidden = false;
  selectRunValuesTab("values");
  requestAnimationFrame(() => createValuesGrid(grid, payload, gridRows, columnTypes, plotData));
}

function createValuesGrid(element, payload, rows, columnTypes, plotData) {
  if (!window.agGrid) {
    element.textContent = "AG Grid could not be loaded. Check the network connection and reload.";
    element.classList.add("dialog-state", "error");
    return;
  }
  const updateFilteredRows = api => {
    const filtered = [];
    api.forEachNodeAfterFilterAndSort(node => filtered.push(node.data));
    plotData.rows = filtered;
    document.querySelector("#values-dialog-context").textContent = [
      payload.run_count > 1 ? `${payload.run_count} runs` : payload.software_name,
      `${filtered.length} of ${rows.length} observations`,
    ].filter(Boolean).join(" · ");
    if (currentRunValuesTab === "plot" && currentPlotDraw) currentPlotDraw();
  };
  window.agGrid.createGrid(element, {
    rowData: rows,
    columnDefs: [
      ...(payload.run_count > 1 ? [
        { field: "__software", headerName: "Software", filter: "agTextColumnFilter", floatingFilter: true, minWidth: 150, pinned: "left" },
        { field: "__run_id", headerName: "Run", filter: "agTextColumnFilter", floatingFilter: true, minWidth: 130 },
      ] : []),
      ...payload.columns.map(column => ({
        field: column.key,
        headerName: column.label,
        headerClass: `ag-header-${column.kind}`,
        filter: columnTypes[column.key] === "number" ? "agNumberColumnFilter" : "agTextColumnFilter",
        floatingFilter: true,
        cellDataType: columnTypes[column.key],
        minWidth: 155,
      })),
    ],
    defaultColDef: {
      sortable: true,
      resizable: true,
      filterParams: { buttons: ["reset", "apply"], closeOnApply: true },
    },
    animateRows: false,
    onGridReady: event => updateFilteredRows(event.api),
    onFilterChanged: event => updateFilteredRows(event.api),
  });
}

function selectRunValuesTab(tab) {
  currentRunValuesTab = tab;
  const showValues = tab === "values";
  document.querySelector("#values-tab").setAttribute("aria-selected", showValues);
  document.querySelector("#plot-tab").setAttribute("aria-selected", !showValues);
  const table = runValuesContent.querySelector(".run-values-grid");
  const plot = runValuesContent.querySelector(".run-plot-section");
  if (table) table.hidden = !showValues;
  if (plot) plot.hidden = showValues;
  runValuesContent.scrollTop = 0;
  if (!showValues && currentPlotDraw) requestAnimationFrame(currentPlotDraw);
}

function plotSelect(labelText, values) {
  const label = document.createElement("label");
  label.className = "plot-control";
  const text = document.createElement("span");
  text.textContent = labelText;
  const select = document.createElement("select");
  values.forEach(({ value, label }) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  });
  label.append(text, select);
  return { label, select };
}

function buildRunPlot(payload, plotData) {
  const section = document.createElement("section");
  section.className = "run-plot-section";
  const heading = document.createElement("h3");
  heading.textContent = "Plot values";
  const parameters = payload.columns.filter(column => column.kind === "parameter");
  const metrics = payload.columns.filter(column => column.kind === "metric");
  const xAxis = plotSelect("X-axis parameter", parameters.map(column => ({
    value: column.key, label: column.label,
  })));
  const yAxis = plotSelect("Y-axis metric", metrics.map(column => ({
    value: column.key, label: column.label,
  })));
  const xScale = plotSelect("X scale", [
    { value: "linear", label: "Linear" },
    { value: "log", label: "Logarithmic" },
  ]);
  const yScale = plotSelect("Y scale", [
    { value: "linear", label: "Linear" },
    { value: "log", label: "Logarithmic" },
  ]);
  const controls = document.createElement("div");
  controls.className = "plot-controls";
  const xControls = document.createElement("fieldset");
  const xLegend = document.createElement("legend");
  xLegend.textContent = "X axis";
  xControls.append(xLegend, xAxis.label, xScale.label);
  const yControls = document.createElement("fieldset");
  const yLegend = document.createElement("legend");
  yLegend.textContent = "Y axis";
  yControls.append(yLegend, yAxis.label, yScale.label);
  controls.append(xControls, yControls);
  const message = document.createElement("p");
  message.className = "plot-message";
  message.textContent = "Select an axis value and scale to update the plot.";
  const chart = document.createElement("div");
  chart.className = "run-plot";
  section.append(heading, controls, message, chart);

  const draw = () => {
    if (!window.Plotly) {
      message.textContent = "Plotly could not be loaded. Check the network connection and reload.";
      return;
    }
    const xColumn = parameters.find(column => column.key === xAxis.select.value);
    const yColumn = metrics.find(column => column.key === yAxis.select.value);
    const pairs = plotData.rows.map(row => ({
      x: row[xAxis.select.value] === null || row[xAxis.select.value] === "" ? NaN : Number(row[xAxis.select.value]),
      y: row[yAxis.select.value] === null || row[yAxis.select.value] === "" ? NaN : Number(row[yAxis.select.value]),
      series: row.__series || payload.software_name || "Run",
    })).filter(pair =>
      Number.isFinite(pair.x) && Number.isFinite(pair.y) &&
      (xScale.select.value !== "log" || pair.x > 0) &&
      (yScale.select.value !== "log" || pair.y > 0)
    ).sort((a, b) => a.x - b.x);

    message.textContent = pairs.length
      ? `${pairs.length} plotted from ${plotData.rows.length} filtered observations${pairs.length < plotData.rows.length ? ` (${plotData.rows.length - pairs.length} invalid for this scale)` : ""}`
      : "No numeric observations are valid for this axis and scale combination.";
    const grouped = new Map();
    pairs.forEach(pair => grouped.set(pair.series, [...(grouped.get(pair.series) || []), pair]));
    const colors = ["#176b4a", "#276fbf", "#b05a2b", "#7b4ab5", "#b18a13", "#c13f65"];
    const traces = [...grouped.entries()].map(([series, values], index) => ({
      x: values.map(pair => pair.x),
      y: values.map(pair => pair.y),
      type: "scatter",
      mode: "lines+markers",
      name: series,
      marker: { color: colors[index % colors.length], size: 8 },
      line: { color: colors[index % colors.length], width: 2 },
      hovertemplate: `${xColumn?.label || "x"}: %{x}<br>${yColumn?.label || "y"}: %{y}<extra>${series}</extra>`,
    }));
    window.Plotly.react(chart, traces, {
      autosize: true,
      margin: { l: 75, r: 24, t: 25, b: 70 },
      paper_bgcolor: "#ffffff",
      plot_bgcolor: "#fafcf9",
      xaxis: { title: xColumn?.label, type: xScale.select.value, automargin: true },
      yaxis: { title: yColumn?.label, type: yScale.select.value, automargin: true },
      showlegend: traces.length > 1,
      hovermode: "closest",
    }, {
      responsive: true,
      displaylogo: false,
      scrollZoom: true,
      modeBarButtonsToRemove: ["lasso2d", "select2d"],
      toImageButtonOptions: { filename: "benchmark-run-plot", format: "png" },
    });
  };
  [xAxis.select, yAxis.select, xScale.select, yScale.select]
    .forEach(select => select.addEventListener("change", draw));
  section.draw = draw;
  return section;
}

async function showRunValues(run, button) {
  document.querySelector("#values-dialog-title").textContent = "Loading run values…";
  document.querySelector("#values-dialog-context").textContent = run.software_name || "";
  runValuesTabs.hidden = true;
  currentPlotDraw = null;
  currentRunValuesTab = "values";
  runValuesContent.innerHTML = '<p class="dialog-state"><span class="spinner"></span> Running SPARQL query…</p>';
  if (!runValuesDialog.open) runValuesDialog.showModal();
  button.disabled = true;
  try {
    const response = await fetch(`/api/run-values?run_id=${encodeURIComponent(run.run_id)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "Run values could not be loaded.");
    renderRunValues(payload);
    runValuesContent.scrollTop = 0;
  } catch (error) {
    const message = document.createElement("p");
    message.className = "dialog-state error";
    message.textContent = error.message;
    runValuesContent.replaceChildren(message);
  } finally {
    button.disabled = false;
  }
}

async function showComparedRuns(runs, button) {
  const benchmarkUrls = new Set(runs.map(run => run.benchmark_url));
  if (benchmarkUrls.size !== 1) return;
  document.querySelector("#values-dialog-title").textContent = "Loading comparison…";
  document.querySelector("#values-dialog-context").textContent = `${runs.length} selected runs`;
  runValuesTabs.hidden = true;
  currentPlotDraw = null;
  currentRunValuesTab = "values";
  runValuesContent.innerHTML = '<p class="dialog-state"><span class="spinner"></span> Running SPARQL queries…</p>';
  if (!runValuesDialog.open) runValuesDialog.showModal();
  button.disabled = true;
  try {
    const payloads = await Promise.all(runs.map(async run => {
      const response = await fetch(`/api/run-values?run_id=${encodeURIComponent(run.run_id)}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.detail || "Run values could not be loaded.");
      return { run, payload };
    }));
    const columns = payloads[0].payload.columns.filter(column =>
      payloads.every(item => item.payload.columns.some(candidate => candidate.key === column.key))
    );
    const rows = payloads.flatMap(({ run, payload }) => {
      const runLabel = label(run.run_id).slice(0, 8);
      const software = run.software_name || "Unknown software";
      return payload.rows.map(row => ({
        ...row,
        __software: software,
        __run_id: runLabel,
        __series: `${software} — ${runLabel}`,
      }));
    });
    renderRunValues({
      benchmark: payloads[0].payload.benchmark,
      software_name: null,
      run_count: runs.length,
      columns,
      rows,
    });
  } catch (error) {
    const message = document.createElement("p");
    message.className = "dialog-state error";
    message.textContent = error.message;
    runValuesContent.replaceChildren(message);
  } finally {
    updateCompareButton();
  }
}

function runValuesButton(run) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "icon-link icon-button";
  button.title = "Query parameter and metric values";
  button.setAttribute("aria-label", `Query values for ${run.software_name || "run"}`);
  const icon = document.createElement("img");
  icon.src = "/assets/icons/table.svg";
  icon.alt = "";
  button.append(icon);
  button.addEventListener("click", () => showRunValues(run, button));
  return button;
}

function renderBenchmarks() {
  const unique = new Map();
  state.runs.forEach(run => unique.set(run.benchmark_url || run.benchmark_repo, run));
  const benchmarks = [...unique.values()].sort((a, b) =>
    label(a.benchmark_repo).localeCompare(label(b.benchmark_repo))
  );
  const options = {
    rowData: benchmarks,
    columnDefs: [
      {
        headerName: "Benchmark",
        flex: 1,
        minWidth: 240,
        valueGetter: params => params.data.benchmark || label(params.data.benchmark_repo),
        cellClass: "benchmark-name",
      },
      { headerName: "Details", width: 95, sortable: false, cellRenderer: params => detailsButton(params.data) },
      { headerName: "GitHub", width: 95, sortable: false, cellRenderer: params => githubIconLink(params.data.benchmark_repo) },
      { headerName: "RoHub", width: 95, sortable: false, cellRenderer: params => rohubIconLink(params.data.benchmark_url) },
    ],
    defaultColDef: { sortable: true, resizable: true },
    domLayout: "autoHeight",
    overlayNoRowsTemplate: "No benchmarks are published yet.",
  };
  if (benchmarkGridApi) {
    benchmarkGridApi.setGridOption("rowData", benchmarks);
  } else if (window.agGrid) {
    benchmarksBody.replaceChildren();
    benchmarkGridApi = window.agGrid.createGrid(benchmarksBody, options);
  }
  document.querySelector("#benchmark-count").textContent = `${benchmarks.length} benchmarks`;
}

function softwareCell(run) {
  const name = run.software_name || "Unknown";
  return run.software_url ? link(run.software_url, name, "software-name") : document.createTextNode(name);
}

function updateRunsCount() {
  if (!runsGridApi) return;
  let displayed = 0;
  runsGridApi.forEachNodeAfterFilter(() => { displayed += 1; });
  count.textContent = `${displayed} of ${state.runs.length} runs`;
}

function updateCompareButton() {
  const button = document.querySelector("#compare-runs");
  const selected = runsGridApi?.getSelectedRows() || [];
  const sameBenchmark = selected.length > 0 && selected.every(
    run => run.benchmark_url === selected[0].benchmark_url
  );
  button.disabled = selected.length < 2 || !sameBenchmark;
  button.textContent = selected.length ? `Compare selected (${selected.length})` : "Compare selected";
  button.title = selected.length >= 2 && !sameBenchmark
    ? "Select runs from the same benchmark"
    : "Compare selected runs";
}

function render() {
  const options = {
    rowData: state.runs,
    columnDefs: [
      { headerName: "Software", field: "software_name", minWidth: 170, flex: 1, cellRenderer: params => softwareCell(params.data) },
      {
        headerName: "Benchmark",
        field: "benchmark_repo",
        minWidth: 190,
        flex: 1,
        valueFormatter: params => label(params.value),
        cellClass: "benchmark-name",
      },
      {
        headerName: "Published",
        field: "datePublished",
        minWidth: 150,
        valueFormatter: params => publishedDate(params.value),
        cellClass: "published-date",
      },
      { headerName: "Values", width: 90, sortable: false, cellRenderer: params => runValuesButton(params.data) },
      { headerName: "RoHub", width: 115, sortable: false, cellRenderer: params => link(params.data.run_id, "Open run ↗") },
      {
        headerName: "Named graph",
        minWidth: 170,
        sortable: false,
        cellRenderer: params => link(params.data.graph, `Graph ${label(params.data.graph).slice(0, 8)}… ↗`, "mono"),
      },
    ],
    defaultColDef: { sortable: true, resizable: true },
    getRowId: params => params.data.run_id,
    rowSelection: {
      mode: "multiRow",
      checkboxes: true,
      headerCheckbox: true,
      enableClickSelection: false,
    },
    selectionColumnDef: { width: 48, pinned: "left", sortable: false, resizable: false },
    quickFilterText: state.query,
    overlayNoRowsTemplate: "No runs are published yet.",
    onGridReady: updateRunsCount,
    onFilterChanged: updateRunsCount,
    onSelectionChanged: updateCompareButton,
  };
  if (runsGridApi) {
    runsGridApi.setGridOption("rowData", state.runs);
    runsGridApi.setGridOption("quickFilterText", state.query);
    updateRunsCount();
  } else if (window.agGrid) {
    body.replaceChildren();
    runsGridApi = window.agGrid.createGrid(body, options);
    updateRunsCount();
    updateCompareButton();
  }
}

async function load(refresh = false) {
  if (runsGridApi) runsGridApi.setGridOption("loading", true);
  else body.innerHTML = '<div class="state"><span class="spinner"></span> Loading published runs…</div>';
  document.querySelector("#refresh").disabled = true;
  try {
    const response = await fetch(`/api/runs${refresh ? "?refresh=true" : ""}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "The runs could not be loaded.");
    if (!window.agGrid) throw new Error("AG Grid could not be loaded. Check the network connection and reload.");
    state.runs = payload.items;
    renderBenchmarks();
    updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    render();
    if (runsGridApi) runsGridApi.setGridOption("loading", false);
  } catch (error) {
    if (runsGridApi) runsGridApi.destroy();
    if (benchmarkGridApi) benchmarkGridApi.destroy();
    runsGridApi = null;
    benchmarkGridApi = null;
    const runsError = document.createElement("div");
    runsError.className = "state error";
    runsError.textContent = error.message;
    body.replaceChildren(runsError);
    const benchmarksError = runsError.cloneNode(true);
    benchmarksBody.replaceChildren(benchmarksError);
    document.querySelector("#benchmark-count").textContent = "Data unavailable";
    count.textContent = "Data unavailable";
  } finally {
    document.querySelector("#refresh").disabled = false;
  }
}

document.querySelector("#search").addEventListener("input", event => {
  state.query = event.target.value;
  if (runsGridApi) runsGridApi.setGridOption("quickFilterText", state.query);
});
document.querySelector("#refresh").addEventListener("click", () => load(true));
document.querySelector("#compare-runs").addEventListener("click", event => {
  const selected = runsGridApi?.getSelectedRows() || [];
  if (selected.length >= 2) showComparedRuns(selected, event.currentTarget);
});
document.querySelector("#close-dialog").addEventListener("click", () => benchmarkDialog.close());
benchmarkDialog.addEventListener("click", event => {
  if (event.target === benchmarkDialog) benchmarkDialog.close();
});
document.querySelector("#close-values-dialog").addEventListener("click", () => runValuesDialog.close());
document.querySelector("#values-tab").addEventListener("click", () => selectRunValuesTab("values"));
document.querySelector("#plot-tab").addEventListener("click", () => selectRunValuesTab("plot"));
runValuesDialog.addEventListener("click", event => {
  if (event.target === runValuesDialog) runValuesDialog.close();
});
document.querySelector("#open-sparql-log").addEventListener("click", openSparqlLog);
document.querySelector("#close-sparql-log").addEventListener("click", closeSparqlLog);
document.querySelector("#clear-sparql-log").addEventListener("click", clearSparqlLog);
sparqlLogDialog.addEventListener("close", () => {
  window.clearInterval(sparqlLogTimer);
  sparqlLogTimer = null;
});
sparqlLogDialog.addEventListener("click", event => {
  if (event.target === sparqlLogDialog) closeSparqlLog();
});
load();

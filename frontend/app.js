const state = { runs: [], query: "", sort: "benchmark_repo", direction: 1 };
const body = document.querySelector("#runs");
const benchmarksBody = document.querySelector("#benchmarks");
const count = document.querySelector("#count");
const updated = document.querySelector("#updated");
const benchmarkDialog = document.querySelector("#benchmark-dialog");

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

function renderBenchmarks() {
  const unique = new Map();
  state.runs.forEach(run => unique.set(run.benchmark_url || run.benchmark_repo, run));
  const benchmarks = [...unique.values()].sort((a, b) =>
    label(a.benchmark_repo).localeCompare(label(b.benchmark_repo))
  );
  benchmarksBody.replaceChildren();
  if (!benchmarks.length) {
    const row = benchmarksBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 4;
    cell.className = "state";
    cell.textContent = "No benchmarks are published yet.";
  }
  benchmarks.forEach(benchmark => {
    const row = benchmarksBody.insertRow();
    const name = row.insertCell();
    name.className = "benchmark-name";
    name.textContent = benchmark.benchmark || label(benchmark.benchmark_repo);
    row.insertCell().append(detailsButton(benchmark));
    row.insertCell().append(githubIconLink(benchmark.benchmark_repo));
    row.insertCell().append(rohubIconLink(benchmark.benchmark_url));
  });
  document.querySelector("#benchmark-count").textContent = `${benchmarks.length} benchmarks`;
}

function render() {
  const query = state.query.toLowerCase();
  const rows = state.runs
    .filter(run => Object.values(run).some(value => String(value || "").toLowerCase().includes(query)))
    .sort((a, b) => String(a[state.sort] || "").localeCompare(String(b[state.sort] || "")) * state.direction);

  body.replaceChildren();
  if (!rows.length) {
    const row = body.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 5;
    cell.className = "state";
    cell.textContent = state.runs.length ? "No runs match your search." : "No runs are published yet.";
  }
  rows.forEach(run => {
    const row = body.insertRow();
    const software = row.insertCell();
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = run.software_name || "Unknown";
    if (run.software_url) {
      const softwareLink = link(run.software_url, "");
      softwareLink.className = "software-link";
      softwareLink.replaceChildren(badge);
      software.append(softwareLink);
    } else {
      software.append(badge);
    }
    const benchmark = row.insertCell();
    benchmark.className = "benchmark-name";
    benchmark.textContent = label(run.benchmark_repo);
    const published = row.insertCell();
    published.className = "published-date";
    published.textContent = publishedDate(run.datePublished);
    if (run.datePublished) published.title = run.datePublished;
    row.insertCell().append(link(run.run_id, "Open run ↗"));
    row.insertCell().append(link(run.graph, `Graph ${label(run.graph).slice(0, 8)}… ↗`, "mono"));
  });
  count.textContent = `${rows.length} of ${state.runs.length} runs`;
}

async function load(refresh = false) {
  body.innerHTML = '<tr><td colspan="5" class="state"><span class="spinner"></span> Loading published runs…</td></tr>';
  document.querySelector("#refresh").disabled = true;
  try {
    const response = await fetch(`/api/runs${refresh ? "?refresh=true" : ""}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.detail || "The runs could not be loaded.");
    state.runs = payload.items;
    renderBenchmarks();
    updated.textContent = `Updated ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    render();
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5" class="state error"></td></tr>`;
    body.querySelector("td").textContent = error.message;
    benchmarksBody.innerHTML = '<tr><td colspan="4" class="state error"></td></tr>';
    benchmarksBody.querySelector("td").textContent = error.message;
    document.querySelector("#benchmark-count").textContent = "Data unavailable";
    count.textContent = "Data unavailable";
  } finally {
    document.querySelector("#refresh").disabled = false;
  }
}

document.querySelector("#search").addEventListener("input", event => { state.query = event.target.value; render(); });
document.querySelector("#refresh").addEventListener("click", () => load(true));
document.querySelector("#close-dialog").addEventListener("click", () => benchmarkDialog.close());
benchmarkDialog.addEventListener("click", event => {
  if (event.target === benchmarkDialog) benchmarkDialog.close();
});
document.querySelectorAll("[data-sort]").forEach(button => button.addEventListener("click", () => {
  const key = button.dataset.sort;
  state.direction = state.sort === key ? -state.direction : 1;
  state.sort = key;
  render();
}));
load();

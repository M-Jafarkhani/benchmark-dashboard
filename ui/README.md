# Ui

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.19.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Application structure

The UI is organized by responsibility:

- `src/app/core` contains application-wide models and services.
- `src/app/shared` contains reusable grid setup, renderers, and formatting utilities.
- `src/app/features/benchmark-catalog` owns benchmark selection.
- `src/app/features/published-runs` owns run filtering, pagination, and comparison selection.
- `src/app/features/run-analysis` separates data loading, the values grid, Plotly rendering, and dialog orchestration.
- `src/app/features/sparql-log` contains the live query log.

The root `App` component only loads the run collection and coordinates feature events. New domain behavior should live in the relevant feature rather than in the root component.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

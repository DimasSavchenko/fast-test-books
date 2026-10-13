# Fast-Test Homework: books page

A small React page (list of books, add a book, All / Private switch, sticky header with a private-books counter) refactored so that **all logic lives outside the views and is covered by tests that never render anything**.

**Live demo:** <https://fast-test-books.vercel.app/>

Stack: React 19, MobX 7 + mobx-react, TypeScript, Vite, Vitest, fast-check.

## Run it

Developed and tested with Node 24 and pnpm 10.

```bash
pnpm install
pnpm start        # dev server, http://localhost:5173
pnpm test         # all tests, about one second
pnpm typecheck
pnpm build
```

The task mentions a self-signed API certificate, but the API currently serves a valid Let's Encrypt one, so no extra step is needed. If the page shows "Could not load books.", open
<https://tdd.demo.reaktivate.com/v1/books/dmytrosavchenko> directly in the browser to see what the API answers.

The API user is set in [src/Shared/config.ts](src/Shared/config.ts). To empty the user's list: `PUT https://tdd.demo.reaktivate.com/v1/books/dmytrosavchenko/reset`.

## Architecture

The layers and names follow the scheme from the task:

```
View ──actions──▶ Controller ──PM──▶ Repository ──DTO──▶ ApiGateway
View ◀─VM (observable)─ Controller ◀──PM── Repository ◀──DTO──
```

| Layer | Files | Responsibility |
| --- | --- | --- |
| View | `*.view.tsx` | Renders controller fields and passes controller methods as handlers. Nothing else. |
| Controller | `*.controller.ts` | Turns the programmers' model into a view model, owns local UI state, handles user actions. |
| Repository | [Books.repository.ts](src/Books/Books.repository.ts) | Holds the shared programmers' model as MobX observables, maps DTO to PM, talks to the gateway. |
| Gateway | [ApiGateway.ts](src/Shared/ApiGateway.ts) | HTTP only. The single thing faked in tests. |

### Folders

Current layout:

```
src/
  App.tsx                    composition: puts the header, the form and the list together
  Shared/                    reusable: ApiGateway, config, MobX config, useController
  Header/                    sticky header layout, renders whatever it is given
  Books/                     feature: repository, types
    BooksList/               list + All / Private switch
    AddBook/                 creation form
    PrivateBooksCounter/     "Your books: N"
  test/                      test harness and fast-check generators
```

The header knows nothing about books. It is a layout component that takes children; the counter belongs to the Books feature, and `App` places one inside the other:

```tsx
<HeaderView>
  <PrivateBooksCounterView />
</HeaderView>
```

### Target folder structure

The layout above still mixes two principles: `Books` is a feature, while `Shared`, `Header` and `test` are technical roles, and nothing says who may import whom. The structure this codebase should grow into is split **by feature**, with one direction of dependencies:

```
src/
  main.tsx                   entry point
  App/                       composition: the only place that knows several features
    App.tsx
    styles.css
  Features/
    Books/                   everything about books
      index.ts               the only door into the feature
      Books.repository.ts
      Books.types.ts
      BooksList/
      AddBook/
      PrivateBooksCounter/
      testing/               harness and generators of this feature
  Shared/                    reusable, knows nothing about features
    ApiGateway.ts
    config.ts
    mobx.config.ts
    useController.ts
    Header/                  layout components such as the sticky header
```

**App → Features → Shared**, never the other way:

- `Shared` imports nothing from `App` or `Features`. The header lives here because it is layout without domain knowledge.
- A feature imports from `Shared` and from itself. It does not import `App` or another feature; what two features need in common moves down to `Shared`.
- Code outside a feature uses it through its `index.ts` only, so the feature's internals (repository, controllers) can change freely.
- Test helpers live with the feature they serve.

The rule should be enforced by tooling rather than by agreement: an import-boundaries lint rule, or a test that reads the imports of `src` and fails on a violation.

The move itself is not applied in this repository: it renames almost every file, which would hide the two behavioural changes made after the review (the `ensureLoaded` fix and the header/counter split) in a diff of pure renames.

### How the acceptance criteria are met

- **Zero logic in TSX.** Views contain no branching, no calculations and no inline handlers. Visibility is a controller field (`hidden={controller.isStatusHidden}`), texts are ready strings (`controller.statusMessage`, `controller.privateBooksLabel`), handlers are controller methods (`onChange={controller.changeName}`). The only JS in a view is creating its controller.
- **MobX for state, mobx-react for reactivity.** Views are functional `observer` components. `enforceActions: "always"` is on; every state change after an `await` is wrapped in `runInAction`. The loaded books and the end of loading are written in the same action, so one response causes one render.
- **Book creation** is implemented with client-side validation (the API itself accepts empty books). It is a real `<form>`, so Enter submits too; `preventDefault` is called by the controller.
- **Logic is covered by tests** (see below).
- **Part 2:** mutually exclusive radio buttons "All books / Private books" and a sticky header "Your books: N".

### Lifecycle

[useController](src/Shared/useController.ts) creates a local controller once per view, calls `init()` on mount and `dispose()` on unmount. `dispose()` is mandatory in the `Controller` interface. `AddBookController` invalidates its pending request on dispose, so a late response never writes into a dead controller. The list and counter controllers hold no request state of their own: loading and the stale-response guard live in the repository. Both ask for books through `ensureLoaded()`, which starts a load only when none is in flight, so React StrictMode's double mount and two controllers mounting together still produce a single load.

## Tests

84 tests, node environment, no DOM and no rendering.

- **Example tests** (`*.controller.test.ts`): controller and repository are real, only the gateway is faked ([BooksTestHarness.ts](src/test/BooksTestHarness.ts)). A test feeds DTOs in and asserts on the view model and on what was sent to the gateway.
- **Property tests** (`*.property.test.ts`, fast-check): rules that must hold for any input, for example "Add is enabled exactly when both fields have visible text", "exactly one switch option is selected after any sequence of switches", "the counter counts private books only".
- **Render-count tests**: an `autorun` standing in for the view checks that a completed load and a switch change notify the view the expected number of times.
- [Books.repository.test.ts](src/Books/Books.repository.test.ts) covers overlapping loads (only the latest one is applied) and `ensureLoaded()` (a caller that joins a load in flight completes together with it, not before).
- [ApiGateway.test.ts](src/Shared/ApiGateway.test.ts) covers the gateway with a stubbed `fetch`.

Not covered on purpose: the views. They hold no logic, so there are no snapshot or render tests; the wiring between a view and its controller is checked by the type checker only.

## Decisions worth knowing

- **The repository holds state.** The scheme has no separate store, so the repository is both data access and the shared observable model (`allBooksList`, `privateBooksList`, each with its books and its own `hasLoaded` / `hasLoadFailed`, plus one `isLoading` flag).
- **Only the latest load is applied.** Loads can overlap (initial load, "Try again", refresh after adding). The repository numbers them and ignores every response except the one of the latest call, so a slow earlier response cannot hide a book that was just added.
- **Both lists are loaded together** (`/` and `/private` in parallel) on start and after every creation. The header needs the private list from the first render anyway, so lazy loading would save nothing; in exchange the switch is instant and needs no request of its own.
- **Each list succeeds or fails on its own** (`Promise.allSettled`). If only `/` fails, private books and the header counter are still updated and the error is shown on the "All books" option only, and the other way round. A failed refresh keeps the books loaded before, says that recently added books may be missing and offers "Try again". This goes beyond what the task asks for, on purpose: the header and the list are independent, so a failure of `/` should not hide the private-books counter.
- **"Not added" and "not refreshed" are different failures.** If the POST fails, the form keeps its values and shows an error. If the POST succeeds and only the refresh fails, the form is cleared (no duplicate on retry) and the affected list reports that it may be outdated.
- **Controllers receive the input event** as `{ target: { value: string } }`, a structural type with no React import. This keeps even the event unpacking under fast tests, at the price of the controller knowing that shape.
- **Books created by a user come back without `id`**, so the repository builds render keys itself (`id-111` or `position-3`).
- **Any controller can ask for books.** The list and the private-books counter both call `ensureLoaded()` on mount, so the counter works even on a page without the list, and they never duplicate a load. `ensureLoaded()` returns the promise of the load in flight, so whoever awaits it can rely on the books being there afterwards; a load replaced by a newer one likewise completes only together with the latest. A healthy list is refreshed silently after a creation; "Loading books..." is shown only when there is nothing valid to show yet. Before the first load completes the header shows `Your books: ...`, and `Your books: -` if the private list failed to load.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs type check, tests and build on every push to `main` and on pull requests.

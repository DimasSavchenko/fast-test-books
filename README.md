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

```
src/
  Shared/          reusable: ApiGateway, config, MobX config, useController
  Books/           feature: repository, types
    BooksList/     list + All / Private switch
    AddBook/       creation form
  Header/          application-wide sticky header
  test/            test harness and fast-check generators
```

### How the acceptance criteria are met

- **Zero logic in TSX.** Views contain no branching, no calculations and no inline handlers. Visibility is a controller field (`hidden={controller.isStatusHidden}`), texts are ready strings (`controller.statusMessage`, `controller.privateBooksLabel`), handlers are controller methods (`onChange={controller.changeName}`). The only JS in a view is creating its controller.
- **MobX for state, mobx-react for reactivity.** Views are functional `observer` components. `enforceActions: "always"` is on; every state change after an `await` is wrapped in `runInAction`. The loaded books and the end of loading are written in the same action, so one response causes one render.
- **Book creation** is implemented with client-side validation (the API itself accepts empty books). It is a real `<form>`, so Enter submits too; `preventDefault` is called by the controller.
- **Logic is covered by tests** (see below).
- **Part 2:** mutually exclusive radio buttons "All books / Private books" and a sticky header "Your books: N".

### Lifecycle

[useController](src/Shared/useController.ts) creates a local controller once per view, calls `init()` on mount and `dispose()` on unmount. `dispose()` is mandatory in the `Controller` interface. `AddBookController` invalidates its pending request on dispose, so a late response never writes into a dead controller. The list and header controllers hold no request state of their own: loading and the stale-response guard live in the repository. Both ask for books through `ensureLoaded()`, which starts a load only when none is in flight, so React StrictMode's double mount and two controllers mounting together still produce a single load.

## Tests

76 tests, node environment, no DOM and no rendering.

- **Example tests** (`*.controller.test.ts`): controller and repository are real, only the gateway is faked ([BooksTestHarness.ts](src/test/BooksTestHarness.ts)). A test feeds DTOs in and asserts on the view model and on what was sent to the gateway.
- **Property tests** (`*.property.test.ts`, fast-check): rules that must hold for any input, for example "Add is enabled exactly when both fields have visible text", "exactly one switch option is selected after any sequence of switches", "the header counts private books only".
- **Render-count tests**: an `autorun` standing in for the view checks that a completed load and a switch change notify the view the expected number of times.
- [Books.repository.test.ts](src/Books/Books.repository.test.ts) covers overlapping loads: only the latest one is applied.
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
- **Any controller can ask for books.** The list and the application-wide header both call `ensureLoaded()` on mount, so the header gets its counter even on a page without the list, and they never duplicate a load. A healthy list is refreshed silently after a creation; "Loading books..." is shown only when there is nothing valid to show yet. Before the first load completes the header shows `Your books: ...`, and `Your books: -` if the private list failed to load.

## CI

[.github/workflows/ci.yml](.github/workflows/ci.yml) runs type check, tests and build on every push to `main` and on pull requests.

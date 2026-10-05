import { autorun } from "mobx";
import { describe, expect, it, vi } from "vitest";

import {
  allBooksDtoStub,
  createBooksTestHarness,
  createDeferred,
  privateBooksDtoStub,
} from "../../test/BooksTestHarness";
import { BookDto } from "../Books.types";
import { BooksListController } from "./BooksList.controller";

function setup() {
  const harness = createBooksTestHarness();
  const controller = new BooksListController(harness.booksRepository);

  return { ...harness, controller };
}

describe("BooksListController", () => {
  it("shows the loading message, not the empty one, before the first load starts", () => {
    const { controller } = setup();

    expect(controller.books).toEqual([]);
    expect(controller.statusMessage).toBe("Loading books...");
    expect(controller.isStatusHidden).toBe(false);
  });

  it("loads all and private books from the api on init", async () => {
    const { controller, httpGateway } = setup();

    await controller.init();

    expect(httpGateway.get).toHaveBeenCalledTimes(2);
    expect(httpGateway.get).toHaveBeenCalledWith("/");
    expect(httpGateway.get).toHaveBeenCalledWith("/private");
  });

  it("presents loaded books as ready-to-render view models", async () => {
    const { controller } = setup();

    await controller.init();

    expect(controller.books).toEqual([
      { key: "id-111", title: "Kenneth Graeme: Wind in the willows" },
      { key: "id-121", title: "Isaac Asimov: I, Robot" },
      { key: "position-2", title: "William Gibson: Neuromancer" },
    ]);
  });

  it("gives unique keys to books that come without id", async () => {
    const { controller, respondWithBooks } = setup();
    respondWithBooks(
      [
        ...allBooksDtoStub,
        { name: "Dune", author: "Frank Herbert" },
        { name: "Dune", author: "Frank Herbert" },
      ],
      privateBooksDtoStub,
    );

    await controller.init();

    const keys = controller.books.map((book) => book.key);
    expect(new Set(keys).size).toBe(5);
  });

  it("shows the loading message while books are being loaded", async () => {
    const { controller, httpGateway } = setup();
    const response = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(response.promise);

    const loading = controller.init();

    expect(controller.statusMessage).toBe("Loading books...");
    expect(controller.isStatusHidden).toBe(false);

    response.resolve(allBooksDtoStub);
    await loading;

    expect(controller.statusMessage).toBe("");
  });

  it("refreshes a loaded list silently, without the loading message", async () => {
    const { controller, httpGateway, booksRepository } = setup();
    await controller.init();
    const response = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(response.promise);

    const adding = booksRepository.addBook({
      name: "Dune",
      author: "Frank Herbert",
    });
    await vi.waitFor(() => expect(booksRepository.isLoading).toBe(true));

    expect(controller.statusMessage).toBe("");
    expect(controller.isStatusHidden).toBe(true);
    expect(controller.books).toHaveLength(3);

    response.resolve(allBooksDtoStub);
    await adding;
  });

  it("hides the status message when books are shown", async () => {
    const { controller } = setup();

    await controller.init();

    expect(controller.statusMessage).toBe("");
    expect(controller.isStatusHidden).toBe(true);
  });

  it("shows the empty message when the api returns no books", async () => {
    const { controller, respondWithBooks } = setup();
    respondWithBooks([], []);

    await controller.init();

    expect(controller.books).toEqual([]);
    expect(controller.statusMessage).toBe("No books yet.");
  });

  it("shows the error message when loading fails", async () => {
    const { controller, httpGateway } = setup();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));

    await controller.init();

    expect(controller.books).toEqual([]);
    expect(controller.statusMessage).toBe("Could not load books.");
    expect(controller.isStatusHidden).toBe(false);
  });

  describe("when only one of the two lists fails to load", () => {
    it("shows all books without an error when only private books fail", async () => {
      const { controller, failRequestsTo } = setup();
      failRequestsTo("/private");

      await controller.init();

      expect(controller.books).toHaveLength(3);
      expect(controller.statusMessage).toBe("");
      expect(controller.isStatusHidden).toBe(true);
    });

    it("shows the error on the private option only when only private books fail", async () => {
      const { controller, failRequestsTo } = setup();
      failRequestsTo("/private");
      await controller.init();

      controller.showPrivateBooks();

      expect(controller.books).toEqual([]);
      expect(controller.statusMessage).toBe("Could not load books.");

      controller.showAllBooks();

      expect(controller.statusMessage).toBe("");
    });

    it("shows private books without an error when only all books fail", async () => {
      const { controller, failRequestsTo } = setup();
      failRequestsTo("/");
      await controller.init();

      expect(controller.books).toEqual([]);
      expect(controller.statusMessage).toBe("Could not load books.");

      controller.showPrivateBooks();

      expect(controller.books).toEqual([
        { key: "position-0", title: "William Gibson: Neuromancer" },
      ]);
      expect(controller.statusMessage).toBe("");
    });

    it("shows a new book in private books even when all books fail to refresh", async () => {
      const { controller, httpGateway, booksRepository } = setup();
      await controller.init();
      const dune = { name: "Dune", author: "Frank Herbert" };
      httpGateway.get.mockImplementation(async (path) => {
        if (path === "/") throw new Error("Failed to fetch");
        return [...privateBooksDtoStub, dune];
      });

      await booksRepository.addBook(dune);

      expect(controller.books).toHaveLength(3);
      expect(controller.statusMessage).toBe(
        "Could not refresh the list. Recently added books may be missing.",
      );

      controller.showPrivateBooks();

      expect(controller.books.map((book) => book.title)).toContain(
        "Frank Herbert: Dune",
      );
      expect(controller.statusMessage).toBe("");
    });

    it("clears the error of a list once that list loads again", async () => {
      const { controller, failRequestsTo, respondWithBooks } = setup();
      failRequestsTo("/");
      await controller.init();
      respondWithBooks(allBooksDtoStub, privateBooksDtoStub);

      await controller.init();

      expect(controller.books).toHaveLength(3);
      expect(controller.statusMessage).toBe("");
    });
  });

  it("keeps the shown books and reports the failure when the refresh after adding fails", async () => {
    const { controller, httpGateway, booksRepository } = setup();
    await controller.init();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));

    await booksRepository.addBook({ name: "Dune", author: "Frank Herbert" });

    expect(controller.books).toHaveLength(3);
    expect(controller.statusMessage).toBe(
      "Could not refresh the list. Recently added books may be missing.",
    );
  });

  describe("try again", () => {
    it("is not offered while there is no error", async () => {
      const { controller } = setup();

      expect(controller.isRetryHidden).toBe(true);

      await controller.init();

      expect(controller.isRetryHidden).toBe(true);
    });

    it("is offered when the first load fails", async () => {
      const { controller, httpGateway } = setup();
      httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));

      await controller.init();

      expect(controller.isRetryHidden).toBe(false);
    });

    it("is offered only on the option whose list failed", async () => {
      const { controller, failRequestsTo } = setup();
      failRequestsTo("/private");
      await controller.init();

      expect(controller.isRetryHidden).toBe(true);

      controller.showPrivateBooks();

      expect(controller.isRetryHidden).toBe(false);
    });

    it("loads the missing books and removes the error", async () => {
      const { controller, httpGateway, booksRepository, respondWithBooks } =
        setup();
      await controller.init();
      httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));
      const dune = { name: "Dune", author: "Frank Herbert" };
      await booksRepository.addBook(dune);
      respondWithBooks(
        [...allBooksDtoStub, dune],
        [...privateBooksDtoStub, dune],
      );

      await controller.retry();

      expect(controller.books.map((book) => book.title)).toContain(
        "Frank Herbert: Dune",
      );
      expect(controller.statusMessage).toBe("");
      expect(controller.isRetryHidden).toBe(true);
    });

    it("is hidden and shows the loading message while the retry is in progress", async () => {
      const { controller, httpGateway } = setup();
      httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));
      await controller.init();
      const response = createDeferred<BookDto[]>();
      httpGateway.get.mockReturnValue(response.promise);

      const retrying = controller.retry();

      expect(controller.isRetryHidden).toBe(true);
      expect(controller.statusMessage).toBe("Loading books...");

      response.resolve(allBooksDtoStub);
      await retrying;
    });

    it("stays offered when the retry fails too", async () => {
      const { controller, httpGateway } = setup();
      httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));
      await controller.init();

      await controller.retry();

      expect(controller.isRetryHidden).toBe(false);
      expect(controller.statusMessage).toBe("Could not load books.");
    });
  });

  it("clears the error message when the next load succeeds", async () => {
    const { controller, httpGateway, respondWithBooks } = setup();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));
    await controller.init();
    respondWithBooks(allBooksDtoStub, privateBooksDtoStub);

    await controller.init();

    expect(controller.statusMessage).toBe("");
    expect(controller.books).toHaveLength(3);
  });

  it("reflects books added to the repository by another controller", async () => {
    const { controller, booksRepository, respondWithBooks } = setup();
    await controller.init();
    const dune = { name: "Dune", author: "Frank Herbert" };
    respondWithBooks(
      [...allBooksDtoStub, dune],
      [...privateBooksDtoStub, dune],
    );

    await booksRepository.addBook(dune);

    expect(controller.books.map((book) => book.title)).toContain(
      "Frank Herbert: Dune",
    );
  });

  describe("switch between all and private books", () => {
    it("starts with all books selected", () => {
      const { controller } = setup();

      expect(controller.isAllBooksSelected).toBe(true);
      expect(controller.isPrivateBooksSelected).toBe(false);
    });

    it("shows only private books when private books are selected", async () => {
      const { controller } = setup();
      await controller.init();

      controller.showPrivateBooks();

      expect(controller.isAllBooksSelected).toBe(false);
      expect(controller.isPrivateBooksSelected).toBe(true);
      expect(controller.books).toEqual([
        { key: "position-0", title: "William Gibson: Neuromancer" },
      ]);
    });

    it("shows all books again when all books are selected back", async () => {
      const { controller } = setup();
      await controller.init();
      controller.showPrivateBooks();

      controller.showAllBooks();

      expect(controller.isAllBooksSelected).toBe(true);
      expect(controller.isPrivateBooksSelected).toBe(false);
      expect(controller.books).toHaveLength(3);
    });

    it("does not request the api again when the selection changes", async () => {
      const { controller, httpGateway } = setup();
      await controller.init();
      httpGateway.get.mockClear();

      controller.showPrivateBooks();
      controller.showAllBooks();

      expect(httpGateway.get).not.toHaveBeenCalled();
    });

    it("shows the empty message when there are no private books", async () => {
      const { controller, respondWithBooks } = setup();
      respondWithBooks(allBooksDtoStub, []);
      await controller.init();

      controller.showPrivateBooks();

      expect(controller.books).toEqual([]);
      expect(controller.statusMessage).toBe("No books yet.");
    });

    it("shows a newly added book in private books without switching back and forth", async () => {
      const { controller, booksRepository, respondWithBooks } = setup();
      await controller.init();
      controller.showPrivateBooks();
      const dune = { name: "Dune", author: "Frank Herbert" };
      respondWithBooks(
        [...allBooksDtoStub, dune],
        [...privateBooksDtoStub, dune],
      );

      await booksRepository.addBook(dune);

      expect(controller.books.map((book) => book.title)).toEqual([
        "William Gibson: Neuromancer",
        "Frank Herbert: Dune",
      ]);
    });
  });

  it("keeps a newly added book when a slower earlier load responds later", async () => {
    const { controller, httpGateway, booksRepository, respondWithBooks } =
      setup();
    const slowResponse = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(slowResponse.promise);
    const loading = controller.init();
    const dune = { name: "Dune", author: "Frank Herbert" };
    respondWithBooks(
      [...allBooksDtoStub, dune],
      [...privateBooksDtoStub, dune],
    );
    await booksRepository.addBook(dune);

    slowResponse.resolve(allBooksDtoStub);
    await loading;

    expect(controller.books.map((book) => book.title)).toContain(
      "Frank Herbert: Dune",
    );
    expect(controller.statusMessage).toBe("");
  });

  it("starts a single load when it is mounted twice in a row", async () => {
    const { controller, httpGateway } = setup();

    const firstLoading = controller.init();
    controller.dispose();
    const secondLoading = controller.init();
    await Promise.all([firstLoading, secondLoading]);

    expect(httpGateway.get).toHaveBeenCalledTimes(2);
    expect(controller.books).toHaveLength(3);
    expect(controller.statusMessage).toBe("");
  });

  it("does not load again on init when the books are already loaded", async () => {
    const { controller, booksRepository, httpGateway } = setup();
    await booksRepository.loadBooks();
    httpGateway.get.mockClear();

    await controller.init();

    expect(httpGateway.get).not.toHaveBeenCalled();
    expect(controller.books).toHaveLength(3);
  });

  it("notifies the view once per completed load", async () => {
    const { controller } = setup();
    let renders = 0;
    const stop = autorun(() => {
      void controller.books;
      void controller.statusMessage;
      void controller.isStatusHidden;
      void controller.isRetryHidden;
      renders++;
    });

    await controller.init();
    stop();

    // initial render (already "loading") + books arrived together with the end of loading
    expect(renders).toBe(2);
  });

  it("notifies the view once per selection change", async () => {
    const { controller } = setup();
    await controller.init();
    let renders = 0;
    const stop = autorun(() => {
      void controller.books;
      void controller.isAllBooksSelected;
      void controller.isPrivateBooksSelected;
      renders++;
    });

    controller.showPrivateBooks();
    stop();

    // initial render + selection changed
    expect(renders).toBe(2);
  });
});

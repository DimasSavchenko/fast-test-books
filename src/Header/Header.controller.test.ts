import { describe, expect, it } from "vitest";

import { AddBookController } from "../Books/AddBook/AddBook.controller";
import { BooksListController } from "../Books/BooksList/BooksList.controller";
import { BookDto } from "../Books/Books.types";
import {
  allBooksDtoStub,
  createBooksTestHarness,
  createDeferred,
  createSubmitEvent,
  privateBooksDtoStub,
} from "../test/BooksTestHarness";
import { HeaderController } from "./Header.controller";

function setup() {
  const harness = createBooksTestHarness();
  const controller = new HeaderController(harness.booksRepository);

  return { ...harness, controller };
}

describe("HeaderController", () => {
  it("shows the loading placeholder instead of a number until books are loaded", async () => {
    const { controller, booksRepository, httpGateway } = setup();
    const response = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(response.promise);

    expect(controller.privateBooksLabel).toBe("Your books: ...");

    const loading = booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: ...");

    response.resolve(privateBooksDtoStub);
    await loading;

    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });

  it("loads books on its own, so it works on a page without the list", async () => {
    const { controller, httpGateway } = setup();

    await controller.init();

    expect(httpGateway.get).toHaveBeenCalledWith("/private");
    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });

  it("does not start a second load when the list has already started one", async () => {
    const { controller, booksRepository, httpGateway } = setup();
    const listController = new BooksListController(booksRepository);

    const loading = Promise.all([listController.init(), controller.init()]);
    await loading;

    expect(httpGateway.get).toHaveBeenCalledTimes(2);
    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });

  it("shows zero when books are loaded and none of them is private", async () => {
    const { controller, booksRepository, respondWithBooks } = setup();
    respondWithBooks(allBooksDtoStub, []);

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: 0");
  });

  it("shows a dash when the first load fails", async () => {
    const { controller, booksRepository, httpGateway } = setup();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: -");
  });

  it("shows the number when only all books fail to load", async () => {
    const { controller, booksRepository, failRequestsTo } = setup();
    failRequestsTo("/");

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });

  it("shows a dash when only private books fail to load", async () => {
    const { controller, booksRepository, failRequestsTo } = setup();
    failRequestsTo("/private");

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: -");
  });

  it("shows the number once a load succeeds after a failed one", async () => {
    const { controller, booksRepository, httpGateway, respondWithBooks } =
      setup();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));
    await booksRepository.loadBooks();
    respondWithBooks(allBooksDtoStub, privateBooksDtoStub);

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });

  it("shows the number of private books, not of all books", async () => {
    const { controller, booksRepository } = setup();

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });

  it("updates the counter after a book is added through the form", async () => {
    const { controller, booksRepository, respondWithBooks } = setup();
    await booksRepository.loadBooks();
    const addBookController = new AddBookController(booksRepository);
    addBookController.changeName({ target: { value: "Dune" } });
    addBookController.changeAuthor({ target: { value: "Frank Herbert" } });
    const dune = { name: "Dune", author: "Frank Herbert" };
    respondWithBooks(
      [...allBooksDtoStub, dune],
      [...privateBooksDtoStub, dune],
    );

    await addBookController.submit(createSubmitEvent());

    expect(controller.privateBooksLabel).toBe("Your books: 2");
  });

  it("keeps the last known counter when a refresh fails", async () => {
    const { controller, booksRepository, httpGateway } = setup();
    await booksRepository.loadBooks();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));

    await booksRepository.loadBooks();

    expect(controller.privateBooksLabel).toBe("Your books: 1");
  });
});

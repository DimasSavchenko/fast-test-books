import { autorun } from "mobx";
import { describe, expect, it } from "vitest";

import {
  allBooksDtoStub,
  createBooksTestHarness,
  createDeferred,
  privateBooksDtoStub,
} from "../test/BooksTestHarness";
import { BookDto } from "./Books.types";

describe("BooksRepository", () => {
  it("applies only the latest load when an earlier one responds later", async () => {
    const { booksRepository, httpGateway, respondWithBooks } =
      createBooksTestHarness();
    const slowResponse = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(slowResponse.promise);
    const staleLoading = booksRepository.loadBooks();
    const dune = { name: "Dune", author: "Frank Herbert" };
    respondWithBooks(
      [...allBooksDtoStub, dune],
      [...privateBooksDtoStub, dune],
    );
    await booksRepository.loadBooks();

    slowResponse.resolve([]);
    await staleLoading;

    expect(booksRepository.allBooksList.books).toHaveLength(4);
    expect(booksRepository.privateBooksCount).toBe(2);
  });

  it("does not report a failure of a load that was replaced by a newer one", async () => {
    const { booksRepository, httpGateway, respondWithBooks } =
      createBooksTestHarness();
    const slowResponse = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(slowResponse.promise);
    const staleLoading = booksRepository.loadBooks();
    respondWithBooks(allBooksDtoStub, privateBooksDtoStub);
    await booksRepository.loadBooks();

    slowResponse.reject(new Error("Failed to fetch"));
    await staleLoading;

    expect(booksRepository.allBooksList.hasLoadFailed).toBe(false);
    expect(booksRepository.privateBooksList.hasLoadFailed).toBe(false);
  });

  it("stays loading until the latest load completes", async () => {
    const { booksRepository, httpGateway } = createBooksTestHarness();
    const first = createDeferred<BookDto[]>();
    const second = createDeferred<BookDto[]>();

    expect(booksRepository.isLoading).toBe(false);

    httpGateway.get.mockReturnValue(first.promise);
    const firstLoading = booksRepository.loadBooks();
    httpGateway.get.mockReturnValue(second.promise);
    const secondLoading = booksRepository.loadBooks();
    first.resolve(allBooksDtoStub);
    await firstLoading;

    expect(booksRepository.isLoading).toBe(true);
    expect(booksRepository.allBooksList.hasLoaded).toBe(false);

    second.resolve(allBooksDtoStub);
    await secondLoading;

    expect(booksRepository.isLoading).toBe(false);
    expect(booksRepository.allBooksList.hasLoaded).toBe(true);
  });

  it("publishes the books and the end of loading in one notification", async () => {
    const { booksRepository } = createBooksTestHarness();
    const loading = booksRepository.loadBooks();
    const seen: string[] = [];
    const stop = autorun(() => {
      seen.push(
        `${booksRepository.isLoading}:${booksRepository.allBooksList.books.length}`,
      );
    });

    await loading;
    stop();

    // never "still loading with books" or "loaded without books"
    expect(seen).toEqual(["true:0", "false:3"]);
  });
});

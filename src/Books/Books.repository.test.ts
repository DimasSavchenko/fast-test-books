import { autorun } from "mobx";
import { describe, expect, it } from "vitest";

import {
  allBooksDtoStub,
  createBooksTestHarness,
  createDeferred,
  flushPromises,
  privateBooksDtoStub,
  trackSettled,
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
    await flushPromises();

    expect(booksRepository.isLoading).toBe(true);
    expect(booksRepository.allBooksList.hasLoaded).toBe(false);

    second.resolve(allBooksDtoStub);
    await Promise.all([firstLoading, secondLoading]);

    expect(booksRepository.isLoading).toBe(false);
    expect(booksRepository.allBooksList.hasLoaded).toBe(true);
  });

  it("completes a replaced load only together with the latest one", async () => {
    const { booksRepository, httpGateway } = createBooksTestHarness();
    const first = createDeferred<BookDto[]>();
    const second = createDeferred<BookDto[]>();
    httpGateway.get.mockReturnValue(first.promise);
    const firstLoading = trackSettled(booksRepository.loadBooks());
    httpGateway.get.mockReturnValue(second.promise);
    const secondLoading = booksRepository.loadBooks();

    first.resolve(allBooksDtoStub);
    await flushPromises();

    expect(firstLoading.isSettled()).toBe(false);

    second.resolve(allBooksDtoStub);
    await Promise.all([firstLoading.promise, secondLoading]);

    expect(booksRepository.allBooksList.hasLoaded).toBe(true);
  });

  describe("ensureLoaded", () => {
    it("loads the books when nothing has been loaded yet", async () => {
      const { booksRepository, httpGateway } = createBooksTestHarness();

      await booksRepository.ensureLoaded();

      expect(httpGateway.get).toHaveBeenCalledTimes(2);
      expect(booksRepository.allBooksList.books).toHaveLength(3);
    });

    it("joins a load that is in flight instead of starting another one", async () => {
      const { booksRepository, httpGateway } = createBooksTestHarness();
      const response = createDeferred<BookDto[]>();
      httpGateway.get.mockReturnValue(response.promise);
      const loading = booksRepository.loadBooks();

      const ensuring = booksRepository.ensureLoaded();
      response.resolve(allBooksDtoStub);
      await Promise.all([loading, ensuring]);

      expect(httpGateway.get).toHaveBeenCalledTimes(2);
    });

    it("does not complete before the load it joined", async () => {
      const { booksRepository, httpGateway } = createBooksTestHarness();
      const response = createDeferred<BookDto[]>();
      httpGateway.get.mockReturnValue(response.promise);
      void booksRepository.loadBooks();

      const ensuring = trackSettled(booksRepository.ensureLoaded());
      await flushPromises();

      expect(ensuring.isSettled()).toBe(false);

      response.resolve(allBooksDtoStub);
      await ensuring.promise;

      // the caller can rely on the books right after the await
      expect(booksRepository.allBooksList.hasLoaded).toBe(true);
      expect(booksRepository.allBooksList.books).toHaveLength(3);
    });

    it("joins the latest load when several are in flight", async () => {
      const { booksRepository, httpGateway } = createBooksTestHarness();
      const first = createDeferred<BookDto[]>();
      const second = createDeferred<BookDto[]>();
      httpGateway.get.mockReturnValue(first.promise);
      void booksRepository.loadBooks();
      httpGateway.get.mockReturnValue(second.promise);
      void booksRepository.loadBooks();

      const ensuring = trackSettled(booksRepository.ensureLoaded());
      first.resolve([]);
      await flushPromises();

      expect(ensuring.isSettled()).toBe(false);

      second.resolve(allBooksDtoStub);
      await ensuring.promise;

      expect(booksRepository.allBooksList.books).toHaveLength(3);
    });

    it("does nothing when both lists are already loaded", async () => {
      const { booksRepository, httpGateway } = createBooksTestHarness();
      await booksRepository.loadBooks();
      httpGateway.get.mockClear();

      await booksRepository.ensureLoaded();

      expect(httpGateway.get).not.toHaveBeenCalled();
    });

    it("loads again when a list failed last time", async () => {
      const { booksRepository, failRequestsTo, respondWithBooks } =
        createBooksTestHarness();
      failRequestsTo("/private");
      await booksRepository.loadBooks();
      respondWithBooks(allBooksDtoStub, privateBooksDtoStub);

      await booksRepository.ensureLoaded();

      expect(booksRepository.privateBooksList.hasLoadFailed).toBe(false);
      expect(booksRepository.privateBooksCount).toBe(1);
    });
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

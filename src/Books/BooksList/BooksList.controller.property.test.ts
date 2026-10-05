import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { anyBooksDto } from "../../test/BooksArbitraries";
import { createBooksTestHarness } from "../../test/BooksTestHarness";
import { BookDto } from "../Books.types";
import { BooksListController } from "./BooksList.controller";

async function setup(allBooksDto: BookDto[], privateBooksDto: BookDto[]) {
  const harness = createBooksTestHarness();
  harness.respondWithBooks(allBooksDto, privateBooksDto);
  const controller = new BooksListController(harness.booksRepository);
  await controller.init();

  return { ...harness, controller };
}

const toTitles = (booksDto: BookDto[]) =>
  booksDto.map((book) => `${book.author}: ${book.name}`);

describe("BooksListController properties", () => {
  it("shows every book of the selected list once, in the api order, under a unique key", async () => {
    await fc.assert(
      fc.asyncProperty(
        anyBooksDto,
        anyBooksDto,
        async (allBooksDto, privateBooksDto) => {
          const { controller } = await setup(allBooksDto, privateBooksDto);

          expect(controller.books.map((book) => book.title)).toEqual(
            toTitles(allBooksDto),
          );
          expect(new Set(controller.books.map((book) => book.key)).size).toBe(
            allBooksDto.length,
          );

          controller.showPrivateBooks();

          expect(controller.books.map((book) => book.title)).toEqual(
            toTitles(privateBooksDto),
          );
          expect(new Set(controller.books.map((book) => book.key)).size).toBe(
            privateBooksDto.length,
          );
        },
      ),
    );
  });

  it("keeps exactly one option selected after any sequence of switches", async () => {
    await fc.assert(
      fc.asyncProperty(
        anyBooksDto,
        anyBooksDto,
        fc.array(fc.constantFrom("all" as const, "private" as const)),
        async (allBooksDto, privateBooksDto, switches) => {
          const { controller } = await setup(allBooksDto, privateBooksDto);

          for (const mode of switches) {
            if (mode === "all") controller.showAllBooks();
            else controller.showPrivateBooks();

            expect(controller.isAllBooksSelected).toBe(mode === "all");
            expect(controller.isPrivateBooksSelected).toBe(mode === "private");
            expect(controller.books).toHaveLength(
              mode === "all" ? allBooksDto.length : privateBooksDto.length,
            );
          }
        },
      ),
    );
  });

  it("shows the status message exactly when there is nothing to list", async () => {
    await fc.assert(
      fc.asyncProperty(
        anyBooksDto,
        anyBooksDto,
        async (allBooksDto, privateBooksDto) => {
          const { controller } = await setup(allBooksDto, privateBooksDto);

          expect(controller.isStatusHidden).toBe(allBooksDto.length > 0);

          controller.showPrivateBooks();

          expect(controller.isStatusHidden).toBe(privateBooksDto.length > 0);
        },
      ),
    );
  });
});

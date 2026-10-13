import fc from "fast-check";
import { describe, it } from "vitest";

import { anyBooksDto } from "../../test/BooksArbitraries";
import { createBooksTestHarness } from "../../test/BooksTestHarness";
import { PrivateBooksCounterController } from "./PrivateBooksCounter.controller";

describe("PrivateBooksCounterController properties", () => {
  it("counts private books only, whatever the api returns", async () => {
    await fc.assert(
      fc.asyncProperty(
        anyBooksDto,
        anyBooksDto,
        async (allBooksDto, privateBooksDto) => {
          const { booksRepository, respondWithBooks } =
            createBooksTestHarness();
          respondWithBooks(allBooksDto, privateBooksDto);
          const controller = new PrivateBooksCounterController(booksRepository);

          await booksRepository.loadBooks();

          return (
            controller.privateBooksLabel ===
            `Your books: ${privateBooksDto.length}`
          );
        },
      ),
    );
  });
});

import fc from "fast-check";
import { describe, it } from "vitest";

import { anyText } from "../../test/BooksArbitraries";
import {
  createBooksTestHarness,
  createSubmitEvent,
} from "../../test/BooksTestHarness";
import { AddBookController } from "./AddBook.controller";

const hasVisibleText = (text: string) => /\S/.test(text);

function setup(name: string, author: string) {
  const harness = createBooksTestHarness();
  const controller = new AddBookController(harness.booksRepository);
  controller.changeName({ target: { value: name } });
  controller.changeAuthor({ target: { value: author } });

  return { ...harness, controller };
}

describe("AddBookController properties", () => {
  it("allows submitting exactly when both fields have visible text", () => {
    fc.assert(
      fc.property(anyText, anyText, (name, author) => {
        const { controller } = setup(name, author);

        return (
          controller.isSubmitDisabled ===
          !(hasVisibleText(name) && hasVisibleText(author))
        );
      }),
    );
  });

  it("never sends a blank or padded book to the api", async () => {
    await fc.assert(
      fc.asyncProperty(anyText, anyText, async (name, author) => {
        const { controller, httpGateway } = setup(name, author);

        await controller.submit(createSubmitEvent());

        return httpGateway.post.mock.calls.every(([, payload]) => {
          const book = payload as { name: string; author: string };
          return (
            hasVisibleText(book.name) &&
            hasVisibleText(book.author) &&
            book.name === book.name.trim() &&
            book.author === book.author.trim()
          );
        });
      }),
    );
  });

  it("sends a submittable book exactly once and then empties the form", async () => {
    await fc.assert(
      fc.asyncProperty(
        anyText.filter(hasVisibleText),
        anyText.filter(hasVisibleText),
        async (name, author) => {
          const { controller, httpGateway } = setup(name, author);

          await controller.submit(createSubmitEvent());

          return (
            httpGateway.post.mock.calls.length === 1 &&
            controller.name === "" &&
            controller.author === "" &&
            controller.isSubmitDisabled
          );
        },
      ),
    );
  });
});

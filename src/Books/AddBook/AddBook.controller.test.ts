import { describe, expect, it } from "vitest";

import {
  allBooksDtoStub,
  createBooksTestHarness,
  createDeferred,
  createSubmitEvent,
  privateBooksDtoStub,
} from "../../test/BooksTestHarness";
import { StatusDto } from "../Books.types";
import { AddBookController } from "./AddBook.controller";

function setup() {
  const harness = createBooksTestHarness();
  const controller = new AddBookController(harness.booksRepository);

  return { ...harness, controller };
}

function fillForm(
  controller: AddBookController,
  name = "Dune",
  author = "Frank Herbert",
) {
  controller.changeName({ target: { value: name } });
  controller.changeAuthor({ target: { value: author } });
}

describe("AddBookController", () => {
  it("starts with an empty form that cannot be submitted", () => {
    const { controller } = setup();

    expect(controller.name).toBe("");
    expect(controller.author).toBe("");
    expect(controller.isSubmitDisabled).toBe(true);
    expect(controller.isErrorHidden).toBe(true);
  });

  it("keeps what the user types", () => {
    const { controller } = setup();

    fillForm(controller);

    expect(controller.name).toBe("Dune");
    expect(controller.author).toBe("Frank Herbert");
  });

  it.each([
    ["", "Frank Herbert"],
    ["Dune", ""],
    ["   ", "Frank Herbert"],
    ["Dune", "   "],
  ])(
    "does not allow submitting name '%s' with author '%s'",
    async (name, author) => {
      const { controller, httpGateway } = setup();
      fillForm(controller, name, author);

      await controller.submit(createSubmitEvent());

      expect(controller.isSubmitDisabled).toBe(true);
      expect(httpGateway.post).not.toHaveBeenCalled();
    },
  );

  it("keeps the browser from reloading the page on submit, even when nothing is sent", async () => {
    const { controller } = setup();
    const event = createSubmitEvent();

    await controller.submit(event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);

    fillForm(controller);
    const filledEvent = createSubmitEvent();

    await controller.submit(filledEvent);

    expect(filledEvent.preventDefault).toHaveBeenCalledTimes(1);
  });

  it("allows submitting when both fields are filled", () => {
    const { controller } = setup();

    fillForm(controller);

    expect(controller.isSubmitDisabled).toBe(false);
  });

  it("sends the trimmed book to the api", async () => {
    const { controller, httpGateway } = setup();
    fillForm(controller, "  Dune ", " Frank Herbert  ");

    await controller.submit(createSubmitEvent());

    expect(httpGateway.post).toHaveBeenCalledTimes(1);
    expect(httpGateway.post).toHaveBeenCalledWith("/", {
      name: "Dune",
      author: "Frank Herbert",
    });
  });

  it("clears the form after the book is added", async () => {
    const { controller } = setup();
    fillForm(controller);

    await controller.submit(createSubmitEvent());

    expect(controller.name).toBe("");
    expect(controller.author).toBe("");
    expect(controller.isSubmitDisabled).toBe(true);
  });

  it("refreshes all and private books of the repository after the book is added", async () => {
    const { controller, httpGateway, booksRepository, respondWithBooks } =
      setup();
    fillForm(controller);
    const dune = { name: "Dune", author: "Frank Herbert" };
    respondWithBooks(
      [...allBooksDtoStub, dune],
      [...privateBooksDtoStub, dune],
    );

    await controller.submit(createSubmitEvent());

    expect(httpGateway.get).toHaveBeenCalledWith("/");
    expect(httpGateway.get).toHaveBeenCalledWith("/private");
    expect(booksRepository.allBooksList.books.at(-1)).toMatchObject(dune);
    expect(booksRepository.privateBooksList.books.at(-1)).toMatchObject(dune);
    expect(booksRepository.privateBooksCount).toBe(2);
  });

  it("treats the book as added when only the list refresh fails", async () => {
    const { controller, httpGateway, booksRepository } = setup();
    httpGateway.get.mockRejectedValue(new Error("Failed to fetch"));
    fillForm(controller);

    await controller.submit(createSubmitEvent());

    expect(controller.errorMessage).toBe("");
    expect(controller.name).toBe("");
    expect(controller.author).toBe("");
    expect(booksRepository.allBooksList.hasLoadFailed).toBe(true);
    expect(booksRepository.privateBooksList.hasLoadFailed).toBe(true);
  });

  it("blocks a second submit while the first one is in progress", async () => {
    const { controller, httpGateway } = setup();
    const response = createDeferred<StatusDto>();
    httpGateway.post.mockReturnValue(response.promise);
    fillForm(controller);

    const submitting = controller.submit(createSubmitEvent());

    expect(controller.isSubmitting).toBe(true);
    expect(controller.isSubmitDisabled).toBe(true);
    await controller.submit(createSubmitEvent());
    expect(httpGateway.post).toHaveBeenCalledTimes(1);

    response.resolve({ status: "ok" });
    await submitting;

    expect(controller.isSubmitting).toBe(false);
  });

  it("shows the error and keeps the form when the request fails", async () => {
    const { controller, httpGateway } = setup();
    httpGateway.post.mockRejectedValue(new Error("Failed to fetch"));
    fillForm(controller);

    await controller.submit(createSubmitEvent());

    expect(controller.errorMessage).toBe("Could not add the book.");
    expect(controller.isErrorHidden).toBe(false);
    expect(controller.name).toBe("Dune");
    expect(controller.author).toBe("Frank Herbert");
    expect(controller.isSubmitDisabled).toBe(false);
  });

  it("shows the error when the api does not confirm the book", async () => {
    const { controller, httpGateway } = setup();
    httpGateway.post.mockResolvedValue({ status: "error" });
    fillForm(controller);

    await controller.submit(createSubmitEvent());

    expect(controller.errorMessage).toBe("Could not add the book.");
    expect(httpGateway.get).not.toHaveBeenCalled();
  });

  it("clears the error on the next successful submit", async () => {
    const { controller, httpGateway } = setup();
    httpGateway.post.mockRejectedValueOnce(new Error("Failed to fetch"));
    fillForm(controller);
    await controller.submit(createSubmitEvent());

    await controller.submit(createSubmitEvent());

    expect(controller.errorMessage).toBe("");
    expect(controller.isErrorHidden).toBe(true);
  });

  it("ignores a response that arrives after dispose", async () => {
    const { controller, httpGateway } = setup();
    const response = createDeferred<StatusDto>();
    httpGateway.post.mockReturnValue(response.promise);
    fillForm(controller);
    const submitting = controller.submit(createSubmitEvent());

    controller.dispose();
    response.reject(new Error("Failed to fetch"));
    await submitting;

    expect(controller.hasFailed).toBe(false);
  });
});

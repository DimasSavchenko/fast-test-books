import { vi } from "vitest";

import { BooksRepository } from "../Books/Books.repository";
import { BookDto } from "../Books/Books.types";

export const privateBooksDtoStub: BookDto[] = [
  { name: "Neuromancer", author: "William Gibson" },
];

export const allBooksDtoStub: BookDto[] = [
  {
    id: 111,
    name: "Wind in the willows",
    ownerId: "postnikov",
    author: "Kenneth Graeme",
  },
  { id: 121, name: "I, Robot", ownerId: "postnikov", author: "Isaac Asimov" },
  ...privateBooksDtoStub,
];

// Everything above the gateway is real, only the HTTP boundary is faked.
export function createBooksTestHarness() {
  const httpGateway = {
    get: vi.fn<(path: string) => Promise<any>>(),
    post: vi
      .fn<(path: string, payload: unknown) => Promise<any>>()
      .mockResolvedValue({ status: "ok" }),
  };
  const respondWithBooks = (
    allBooksDto: BookDto[],
    privateBooksDto: BookDto[],
  ) => {
    httpGateway.get.mockImplementation(async (path) =>
      path === "/private" ? privateBooksDto : allBooksDto,
    );
  };
  const failRequestsTo = (failedPath: "/" | "/private") => {
    httpGateway.get.mockImplementation(async (path) => {
      if (path === failedPath) throw new Error("Failed to fetch");
      return path === "/private" ? privateBooksDtoStub : allBooksDtoStub;
    });
  };
  respondWithBooks(allBooksDtoStub, privateBooksDtoStub);
  const booksRepository = new BooksRepository(httpGateway);

  return { httpGateway, booksRepository, respondWithBooks, failRequestsTo };
}

export const createSubmitEvent = () => ({ preventDefault: vi.fn() });

export function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

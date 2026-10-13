import { makeAutoObservable } from "mobx";

import { BooksRepository } from "../Books.repository";

export class PrivateBooksCounterController {
  constructor(private readonly booksRepository: BooksRepository) {
    makeAutoObservable<PrivateBooksCounterController, "booksRepository">(
      this,
      { booksRepository: false },
      { autoBind: true },
    );
  }

  get privateBooksLabel(): string {
    const { hasLoaded, hasLoadFailed } = this.booksRepository.privateBooksList;

    if (hasLoaded)
      return `Your books: ${this.booksRepository.privateBooksCount}`;
    return hasLoadFailed ? "Your books: -" : "Your books: ...";
  }

  // the counter can be placed anywhere, also on a page without the list, so it asks for books itself
  init(): Promise<void> {
    return this.booksRepository.ensureLoaded();
  }

  dispose(): void {
    // nothing to release: the controller only derives values from the repository
  }
}

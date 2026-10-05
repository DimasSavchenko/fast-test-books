import { makeAutoObservable } from "mobx";

import { BooksRepository } from "../Books/Books.repository";

export class HeaderController {
  constructor(private readonly booksRepository: BooksRepository) {
    makeAutoObservable<HeaderController, "booksRepository">(
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

  // the header is application-wide: it must get its counter even on a page without the list
  init(): Promise<void> {
    return this.booksRepository.ensureLoaded();
  }

  dispose(): void {
    // nothing to release: the controller only derives values from the repository
  }
}

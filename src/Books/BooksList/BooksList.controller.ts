import { computed, makeAutoObservable } from "mobx";

import { BooksRepository } from "../Books.repository";
import { BooksListPm } from "../Books.types";

interface BookVm {
  key: string;
  title: string;
}

type BooksMode = "all" | "private";

export class BooksListController {
  mode: BooksMode = "all";

  constructor(private readonly booksRepository: BooksRepository) {
    makeAutoObservable<BooksListController, "booksRepository" | "selectedList">(
      this,
      { booksRepository: false, selectedList: computed },
      { autoBind: true },
    );
  }

  private get selectedList(): BooksListPm {
    return this.mode === "private"
      ? this.booksRepository.privateBooksList
      : this.booksRepository.allBooksList;
  }

  get books(): BookVm[] {
    return this.selectedList.books.map((book) => ({
      key: book.key,
      title: `${book.author}: ${book.name}`,
    }));
  }

  get isAllBooksSelected(): boolean {
    return this.mode === "all";
  }

  get isPrivateBooksSelected(): boolean {
    return this.mode === "private";
  }

  get statusMessage(): string {
    const { hasLoaded, hasLoadFailed } = this.selectedList;

    if (hasLoadFailed) {
      if (this.booksRepository.isLoading) return "Loading books...";
      return hasLoaded
        ? "Could not refresh the list. Recently added books may be missing."
        : "Could not load books.";
    }
    // nothing is known about the books yet, which includes the first render before init()
    if (!hasLoaded) return "Loading books...";
    // from here on the list is healthy: it is refreshed silently, without a loading message
    if (this.books.length === 0) return "No books yet.";
    return "";
  }

  get isStatusHidden(): boolean {
    return this.statusMessage === "";
  }

  get isRetryHidden(): boolean {
    return this.booksRepository.isLoading || !this.selectedList.hasLoadFailed;
  }

  showAllBooks(): void {
    this.mode = "all";
  }

  showPrivateBooks(): void {
    this.mode = "private";
  }

  retry(): Promise<void> {
    return this.booksRepository.loadBooks();
  }

  init(): Promise<void> {
    return this.booksRepository.ensureLoaded();
  }

  dispose(): void {
    // nothing to release: the loading state and the stale-response guard live in the repository
  }
}

import { makeAutoObservable, observableRef, runInAction } from "mobx";

import ApiGateway, { HttpGateway } from "../Shared/ApiGateway";
import {
  AddBookDto,
  BookDto,
  BookPm,
  BooksListPm,
  NewBookPm,
  StatusDto,
} from "./Books.types";

const toBookPm = (bookDto: BookDto, index: number): BookPm => ({
  key: bookDto.id === undefined ? `position-${index}` : `id-${bookDto.id}`,
  name: bookDto.name,
  author: bookDto.author,
});

const notLoadedBooksList: BooksListPm = {
  books: [],
  hasLoaded: false,
  hasLoadFailed: false,
};

// A failed request keeps the books that were loaded before and only marks the list as failed.
const toBooksListPm = (
  current: BooksListPm,
  result: PromiseSettledResult<BookPm[]>,
): BooksListPm =>
  result.status === "fulfilled"
    ? { books: result.value, hasLoaded: true, hasLoadFailed: false }
    : { ...current, hasLoadFailed: true };

export class BooksRepository {
  allBooksList = notLoadedBooksList;
  privateBooksList = notLoadedBooksList;
  isLoading = false;

  private requestId = 0;
  private latestLoad: Promise<void> | null = null;

  constructor(private readonly httpGateway: HttpGateway) {
    makeAutoObservable<
      BooksRepository,
      "httpGateway" | "requestId" | "latestLoad" | "getBooks" | "requestBooks"
    >(
      this,
      {
        allBooksList: observableRef,
        privateBooksList: observableRef,
        httpGateway: false,
        requestId: false,
        latestLoad: false,
        getBooks: false,
        requestBooks: false,
      },
      { autoBind: true },
    );
  }

  get privateBooksCount(): number {
    return this.privateBooksList.books.length;
  }

  // Lets any controller ask for books without knowing who else did. Whoever awaits it
  // gets the books: a caller that arrives while a load is in flight waits for that load.
  ensureLoaded(): Promise<void> {
    if (this.latestLoad) return this.latestLoad;

    const lists = [this.allBooksList, this.privateBooksList];
    const isFresh = lists.every(
      (list) => list.hasLoaded && !list.hasLoadFailed,
    );
    return isFresh ? Promise.resolve() : this.loadBooks();
  }

  loadBooks(): Promise<void> {
    const load = this.requestBooks(++this.requestId);
    this.latestLoad = load;
    this.isLoading = true;
    return load;
  }

  private async requestBooks(requestId: number): Promise<void> {
    const [allBooksResult, privateBooksResult] = await Promise.allSettled([
      this.getBooks("/"),
      this.getBooks("/private"),
    ]);

    // a newer loadBooks() made this response stale: only the latest one is applied,
    // and this call completes together with it, not before
    if (requestId !== this.requestId) return this.latestLoad ?? undefined;

    this.latestLoad = null;
    runInAction(() => {
      this.allBooksList = toBooksListPm(this.allBooksList, allBooksResult);
      this.privateBooksList = toBooksListPm(
        this.privateBooksList,
        privateBooksResult,
      );
      this.isLoading = false;
    });
  }

  async addBook({ name, author }: NewBookPm): Promise<void> {
    const addBookDto: AddBookDto = { name, author };
    const statusDto = await this.httpGateway.post<StatusDto>("/", addBookDto);
    if (statusDto.status !== "ok") {
      throw new Error("Book was not added");
    }
    // the book is saved at this point: a failed refresh is reported by the lists themselves
    await this.loadBooks();
  }

  private async getBooks(path: string): Promise<BookPm[]> {
    const booksDto = await this.httpGateway.get<BookDto[]>(path);
    return booksDto.map(toBookPm);
  }
}

const booksRepository = new BooksRepository(new ApiGateway());
export default booksRepository;

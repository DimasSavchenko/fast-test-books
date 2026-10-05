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

  constructor(private readonly httpGateway: HttpGateway) {
    makeAutoObservable<
      BooksRepository,
      "httpGateway" | "requestId" | "getBooks"
    >(
      this,
      {
        allBooksList: observableRef,
        privateBooksList: observableRef,
        httpGateway: false,
        requestId: false,
        getBooks: false,
      },
      { autoBind: true },
    );
  }

  get privateBooksCount(): number {
    return this.privateBooksList.books.length;
  }

  // Lets any controller ask for books without knowing who else did: a load is started
  // only when there is none in flight and something is still missing or failed.
  async ensureLoaded(): Promise<void> {
    const lists = [this.allBooksList, this.privateBooksList];
    const isFresh = lists.every(
      (list) => list.hasLoaded && !list.hasLoadFailed,
    );
    if (this.isLoading || isFresh) return;

    await this.loadBooks();
  }

  async loadBooks(): Promise<void> {
    const requestId = ++this.requestId;
    this.isLoading = true;

    const [allBooksResult, privateBooksResult] = await Promise.allSettled([
      this.getBooks("/"),
      this.getBooks("/private"),
    ]);

    // a newer loadBooks() made this response stale: only the latest one is applied
    if (requestId !== this.requestId) return;
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

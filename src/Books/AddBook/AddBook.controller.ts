import { makeAutoObservable, runInAction } from "mobx";

import { BooksRepository } from "../Books.repository";

interface ValueChangeEvent {
  target: { value: string };
}

interface FormSubmitEvent {
  preventDefault(): void;
}

export class AddBookController {
  name = "";
  author = "";
  isSubmitting = false;
  hasFailed = false;

  private requestId = 0;

  constructor(private readonly booksRepository: BooksRepository) {
    makeAutoObservable<AddBookController, "booksRepository" | "requestId">(
      this,
      { booksRepository: false, requestId: false },
      { autoBind: true },
    );
  }

  get isSubmitDisabled(): boolean {
    return (
      this.isSubmitting || this.name.trim() === "" || this.author.trim() === ""
    );
  }

  get errorMessage(): string {
    return this.hasFailed ? "Could not add the book." : "";
  }

  get isErrorHidden(): boolean {
    return this.errorMessage === "";
  }

  changeName(event: ValueChangeEvent): void {
    this.name = event.target.value;
  }

  changeAuthor(event: ValueChangeEvent): void {
    this.author = event.target.value;
  }

  async submit(event: FormSubmitEvent): Promise<void> {
    // the form must not reload the page
    event.preventDefault();
    if (this.isSubmitDisabled) return;

    const requestId = ++this.requestId;
    this.isSubmitting = true;
    this.hasFailed = false;

    let hasFailed = false;
    try {
      await this.booksRepository.addBook({
        name: this.name.trim(),
        author: this.author.trim(),
      });
    } catch {
      hasFailed = true;
    }

    // dispose() made this response stale
    if (requestId !== this.requestId) return;
    runInAction(() => {
      this.isSubmitting = false;
      this.hasFailed = hasFailed;
      if (!hasFailed) {
        this.name = "";
        this.author = "";
      }
    });
  }

  dispose(): void {
    this.requestId++;
  }
}

import { observer } from "mobx-react";

import { useController } from "../../Shared/useController";
import booksRepository from "../Books.repository";
import { BooksListController } from "./BooksList.controller";

export const BooksListView = observer(function BooksListView() {
  const controller = useController(
    () => new BooksListController(booksRepository),
  );

  return (
    <section>
      <fieldset>
        <legend>Show</legend>
        <label>
          <input
            type="radio"
            name="books-mode"
            checked={controller.isAllBooksSelected}
            onChange={controller.showAllBooks}
          />
          All books
        </label>
        <label>
          <input
            type="radio"
            name="books-mode"
            checked={controller.isPrivateBooksSelected}
            onChange={controller.showPrivateBooks}
          />
          Private books
        </label>
      </fieldset>
      <p className="status" hidden={controller.isStatusHidden}>
        {controller.statusMessage}
        <button hidden={controller.isRetryHidden} onClick={controller.retry}>
          Try again
        </button>
      </p>
      {controller.books.map((book) => (
        <div key={book.key}>{book.title}</div>
      ))}
    </section>
  );
});

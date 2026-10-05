import { observer } from "mobx-react";

import { useController } from "../../Shared/useController";
import booksRepository from "../Books.repository";
import { AddBookController } from "./AddBook.controller";

export const AddBookView = observer(function AddBookView() {
  const controller = useController(
    () => new AddBookController(booksRepository),
  );

  return (
    <form onSubmit={controller.submit}>
      <label>
        Name
        <input value={controller.name} onChange={controller.changeName} />
      </label>
      <label>
        Author
        <input value={controller.author} onChange={controller.changeAuthor} />
      </label>
      <button type="submit" disabled={controller.isSubmitDisabled}>
        Add
      </button>
      <p hidden={controller.isErrorHidden}>{controller.errorMessage}</p>
    </form>
  );
});

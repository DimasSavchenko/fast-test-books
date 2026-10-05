import { AddBookView } from "./Books/AddBook/AddBook.view";
import { BooksListView } from "./Books/BooksList/BooksList.view";
import { HeaderView } from "./Header/Header.view";

export function App() {
  return (
    <div>
      <HeaderView />
      <AddBookView />
      <BooksListView />
    </div>
  );
}

import { observer } from "mobx-react";

import booksRepository from "../Books/Books.repository";
import { useController } from "../Shared/useController";
import { HeaderController } from "./Header.controller";

export const HeaderView = observer(function HeaderView() {
  const controller = useController(() => new HeaderController(booksRepository));

  return <header className="header">{controller.privateBooksLabel}</header>;
});

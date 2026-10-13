import { observer } from "mobx-react";

import { useController } from "../../Shared/useController";
import booksRepository from "../Books.repository";
import { PrivateBooksCounterController } from "./PrivateBooksCounter.controller";

export const PrivateBooksCounterView = observer(
  function PrivateBooksCounterView() {
    const controller = useController(
      () => new PrivateBooksCounterController(booksRepository),
    );

    return <span>{controller.privateBooksLabel}</span>;
  },
);

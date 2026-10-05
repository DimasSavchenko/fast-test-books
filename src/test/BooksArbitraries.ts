import fc from "fast-check";

import { BookDto } from "../Books/Books.types";

// Any text a user can type, with blank and padded values made frequent on purpose.
export const anyText = fc.oneof(
  fc.string(),
  fc.constantFrom("", " ", "   ", "\t", "\n", " \t\n "),
  fc.string().map((text) => `  ${text}\t`),
);

export const anyBooksDto: fc.Arbitrary<BookDto[]> = fc
  .array(
    fc.record({ hasId: fc.boolean(), name: fc.string(), author: fc.string() }),
    {
      maxLength: 20,
    },
  )
  .map((books) =>
    books.map(({ hasId, name, author }, index) =>
      hasId
        ? { id: 100 + index, name, author, ownerId: "postnikov" }
        : { name, author },
    ),
  );

// DTO - the shape the API speaks. Books added by a user come back without id and ownerId.
export interface BookDto {
  id?: number;
  name: string;
  author: string;
  ownerId?: string;
}

export interface AddBookDto {
  name: string;
  author: string;
}

export interface StatusDto {
  status: string;
}

export interface BookPm {
  key: string;
  name: string;
  author: string;
}

export interface BooksListPm {
  books: BookPm[];
  hasLoaded: boolean;
  hasLoadFailed: boolean;
}

export interface NewBookPm {
  name: string;
  author: string;
}

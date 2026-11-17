export type HistoryStats = {
  titles: number;
  movies: number;
  episodes: number;
  total_plays: number;
};

export type HistoryPagePayload<T = any> = {
  items: T[];
  total: number;
  page: number;
  per_page: number;
  last_page: number;
  sort?: string;
  direction?: "asc" | "desc";
};

export type HistorySortState = {
  field: string;
  direction: "asc" | "desc";
};

export type ServerPaginationProps = {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  /** Controlled server-side sort (when set with onSortChange, client sort is skipped). */
  sort?: HistorySortState | null;
  onSortChange?: (sort: HistorySortState) => void;
};

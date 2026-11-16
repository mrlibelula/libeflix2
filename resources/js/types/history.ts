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
};

export type ServerPaginationProps = {
  total: number;
  page: number;
  perPage: number;
  lastPage: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
};

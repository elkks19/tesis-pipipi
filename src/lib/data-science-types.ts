export type DataScienceTripOption = {
  dateLabel: string;
  id: string;
  label: string;
  secondaryLabel: string;
};

export type DataScienceTripSearchResponse = {
  hasMore: boolean;
  items: DataScienceTripOption[];
  nextCursor: string | null;
};

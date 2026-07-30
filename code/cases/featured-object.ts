export function resolveFeaturedObject<T extends { objectId: string }>(
  rows: T[],
  featuredObjectId?: string,
): T | undefined {
  if (featuredObjectId) {
    const featured = rows.find((row) => row.objectId === featuredObjectId);
    if (featured) {
      return featured;
    }
  }
  return rows[0];
}

export function featuredObjectToSeed<
  TExisting extends { objectId: string },
  TDataset extends { objectId: string },
>(
  existing: TExisting[],
  datasetRows: TDataset[],
  featuredObjectId?: string,
): TDataset | undefined {
  if (
    !featuredObjectId ||
    existing.some((row) => row.objectId === featuredObjectId)
  ) {
    return undefined;
  }
  return datasetRows.find((row) => row.objectId === featuredObjectId);
}

export function orderFeaturedFirst<T extends { objectId: string }>(
  rows: T[],
  featuredObjectId?: string,
): T[] {
  if (!featuredObjectId) return rows;
  const featured = rows.find((row) => row.objectId === featuredObjectId);
  if (!featured) return rows;
  return [
    featured,
    ...rows.filter((row) => row.objectId !== featuredObjectId),
  ];
}

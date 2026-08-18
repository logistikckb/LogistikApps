import Fuse, { IFuseOptions } from 'fuse.js';

/**
 * Common configuration options for Fuse fuzzy search on master data & tables
 */
export const FUSE_DEFAULT_OPTIONS = {
  isCaseSensitive: false,
  includeScore: true,
  shouldSort: true,
  threshold: 0.38, // 0.0 = exact match, 1.0 = match anything. 0.35-0.4 is optimal for voice speech recognition
  minMatchCharLength: 2,
  ignoreLocation: true,
  useExtendedSearch: false
};

/**
 * Fuzzy search helper for Master Barang (Product) lists
 */
export function fuzzySearchDataBarang<T extends { item_code?: string; item_name?: string; barcode?: string; category?: string; uom?: string }>(
  list: T[],
  query: string,
  threshold = 0.38
): T[] {
  const clean = query.trim();
  if (!clean || list.length === 0) return list;

  const options: IFuseOptions<T> = {
    ...FUSE_DEFAULT_OPTIONS,
    threshold,
    keys: [
      { name: 'item_name', weight: 0.55 },
      { name: 'item_code', weight: 0.25 },
      { name: 'barcode', weight: 0.1 },
      { name: 'category', weight: 0.05 },
      { name: 'uom', weight: 0.05 }
    ]
  };

  const fuse = new Fuse(list, options);
  const results = fuse.search(clean);
  
  // Return items in ranked order of match quality
  return results.map(res => res.item);
}

/**
 * Generic fuzzy search helper for any record list
 */
export function fuzzySearchList<T>(
  list: T[],
  query: string,
  keys: Array<{ name: keyof T | string; weight: number }>,
  threshold = 0.38
): T[] {
  const clean = query.trim();
  if (!clean || list.length === 0) return list;

  const options: IFuseOptions<T> = {
    ...FUSE_DEFAULT_OPTIONS,
    threshold,
    keys: keys as any
  };

  const fuse = new Fuse(list, options);
  const results = fuse.search(clean);
  return results.map(res => res.item);
}

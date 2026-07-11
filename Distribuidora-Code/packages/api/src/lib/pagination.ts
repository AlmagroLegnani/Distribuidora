export interface PaginationParams {
  skip?: number;
  take?: number;
}

const MAX_PAGE_SIZE = 200;

/**
 * Parses optional `page`/`pageSize` query params into Prisma skip/take.
 * Returns an empty object (no skip/take) when pageSize isn't provided, so
 * existing callers that don't paginate keep getting the full list — this
 * keeps the change additive/non-breaking for the frontend.
 */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const pageSizeRaw = parseInt(String(query.pageSize ?? ''), 10);
  if (!pageSizeRaw || pageSizeRaw <= 0) return {};

  const pageSize = Math.min(pageSizeRaw, MAX_PAGE_SIZE);
  const pageRaw = parseInt(String(query.page ?? '1'), 10);
  const page = pageRaw && pageRaw > 0 ? pageRaw : 1;

  return { skip: (page - 1) * pageSize, take: pageSize };
}

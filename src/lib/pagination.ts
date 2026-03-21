const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

export function parsePaginationParams(searchParams: URLSearchParams) {
  let page = parseInt(searchParams.get("page") ?? "1", 10);
  let limit = parseInt(searchParams.get("limit") ?? String(DEFAULT_LIMIT), 10);

  if (isNaN(page) || page < 1) page = 1;
  if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  return { page, limit, skip: (page - 1) * limit };
}

export function paginatedResponse<T>(data: T[], total: number, page: number, limit: number) {
  return {
    data,
    total,
    page,
    limit,
    totalPages: limit > 0 ? Math.ceil(total / limit) : 0,
  };
}

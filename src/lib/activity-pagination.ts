export function normalizeActivitySearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

export function paginateActivity<T extends { id: string; createdAt: string; searchText?: string }>(rows: T[], requestedPage = 1, query = "", pageSize = 15, now = Date.now()) {
  const terms = normalizeActivitySearch(query).split(/\s+/).filter(Boolean);
  const filtered = rows.filter((row) => {
    const occurredAt = Date.parse(row.createdAt);
    // Compare instants, not UTC calendar days: Bolivia is UTC-04:00.
    // Future demo events are not activity that has actually happened yet.
    return Number.isFinite(occurredAt) && occurredAt <= now && terms.every((term) => normalizeActivitySearch(row.searchText ?? "").includes(term));
  })
    .sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0) || b.id.localeCompare(a.id));
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(totalPages, Math.max(1, Number.isFinite(requestedPage) ? Math.floor(requestedPage) : 1));
  return { rows: filtered.slice((page - 1) * pageSize, page * pageSize), total, totalPages, page };
}

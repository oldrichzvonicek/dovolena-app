/**
 * Supabase (PostgREST) vrací nejvýš 1 000 řádků na dotaz a zbytek potichu odřízne — `.limit(8000)` to nezmění.
 * Tahle funkce načte všechny stránky po sobě. Dotaz musí mít stabilní řazení (např. `.order("id")`),
 * jinak by se stránky mohly překrývat nebo něco vynechat.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  pageSize = 1000,
  maxPages = 50
): Promise<{ data: T[]; error: { message: string } | null }> {
  const all: T[] = [];
  for (let page = 0; page < maxPages; page++) {
    const { data, error } = await build(page * pageSize, page * pageSize + pageSize - 1);
    if (error) return { data: all, error };
    all.push(...(data ?? []));
    if (!data || data.length < pageSize) break;
  }
  return { data: all, error: null };
}

import type { Category, Question } from '@whispper/shared';

export interface CategoryGroup {
  category: string;
  categoryId: number | null;
  sortOrder: number;
  questions: Question[];
}

/** Agrupa preguntas por categoría del cuestionario, respetando sort_order de categorías */
export function groupQuestionsByCategory(
  questions: Question[],
  categories: Category[] = []
): CategoryGroup[] {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const buckets = new Map<string, CategoryGroup>();

  const sortedQs = [...questions].sort(
    (a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999) || a.id - b.id
  );

  for (const q of sortedQs) {
    const catMeta = q.category_id ? catById.get(q.category_id) : undefined;
    const catName = catMeta?.name ?? (q.category?.trim() || 'General');
    const sortOrder = catMeta?.sort_order ?? 9999;
    const key = q.category_id ? `id:${q.category_id}` : `name:${catName.toLowerCase()}`;

    if (!buckets.has(key)) {
      buckets.set(key, {
        category: catName,
        categoryId: q.category_id,
        sortOrder,
        questions: [],
      });
    }
    buckets.get(key)!.questions.push(q);
  }

  return Array.from(buckets.values()).sort(
    (a, b) => a.sortOrder - b.sortOrder || a.category.localeCompare(b.category, 'es')
  );
}

export interface GradeNamed {
  gradeName: string;
}

export interface Identified {
  id: string;
}

export function normalizeGradeName(value: string): string {
  return value.trim().toUpperCase();
}

export function buildGradeNameIndex(items: readonly GradeNamed[]): Set<string> {
  return new Set(items.map((item) => normalizeGradeName(item.gradeName)));
}

export function countDuplicateGradeNames(
  candidates: readonly GradeNamed[],
  existingNames: ReadonlySet<string>,
): number {
  let count = 0;
  for (const candidate of candidates) {
    if (existingNames.has(normalizeGradeName(candidate.gradeName))) count += 1;
  }
  return count;
}

export function buildIdPositionIndex<T extends Identified>(items: readonly T[]): Map<string, number> {
  const positions = new Map<string, number>();
  for (let index = 0; index < items.length; index += 1) {
    positions.set(items[index].id, index);
  }
  return positions;
}

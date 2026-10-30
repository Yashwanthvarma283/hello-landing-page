export function findPrimaryKey<T extends { is_primary: boolean }>(keys: T[]): T | undefined {
  return keys.find((key) => key.is_primary);
}
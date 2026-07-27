export function categoryNameKey(value: string) {
  return value.trim().normalize("NFKC").toLocaleLowerCase("he-IL");
}

export function findCategoryByName<T extends { name: string }>(categories: T[], name: string) {
  const key = categoryNameKey(name);
  return categories.find((category) => categoryNameKey(category.name) === key);
}

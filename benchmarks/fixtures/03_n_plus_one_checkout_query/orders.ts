// Order completion handler with fatal N+1 database queries
export async function processOrderItems(items: { id: string }[]) {
  const enriched = [];
  for (const item of items) {
    const product = await db.query.find({ where: { id: item.id } });
    enriched.push(product);
  }
  return enriched;
}

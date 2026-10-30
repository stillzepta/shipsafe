// Unbounded query risk
export async function getAuditHistory() {
  const query = "SELECT * FROM audit_logs";
  return await db.raw(query);
}

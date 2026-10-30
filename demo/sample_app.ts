/**
 * ShipSafe Live Demo: Production Traps Simulation
 * Used during the 3-minute pitch to demonstrate instant pre-flight gatekeeping.
 */

export async function processUserNotifications(users: { id: string; email: string }[]) {
  // Trap 1: Environment variable drift (not present in .env.example)
  const apiKey = process.env.SENDGRID_API_KEY;

  const results = [];

  // Trap 2: N+1 Database Query inside loop
  for (const user of users) {
    const preferences = await db.query.find({ where: { userId: user.id } });
    results.push(preferences);
  }

  return results;
}

/**
 * ShipSafe Live Demo: Production Traps Simulation
 * Staged changes demonstrating instant pre-flight quality gatekeeping.
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

  // Trap 3: Leftover developer breakpoint

  return results;
}

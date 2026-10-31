/**
 * ShipSafe Core: Database Schema & Migration Hazard Detector
 * Catches table lock hazards, dangerous column drops, and backward-incompatible migrations.
 */

export interface Finding {
  ruleId: string;
  category: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARN' | 'INFO';
  title: string;
  filePath: string;
  line: number;
  snippet?: string;
  recommendation: string;
  autoFixable?: boolean;
}

export function scanSchemaHazards(files: { path: string; content: string }[]): Finding[] {
  const findings: Finding[] = [];

  const migrationPatterns = [
    /migrations?\//i,
    /\.sql$/i,
    /schema\.prisma$/i,
    /schema\.ts$/i,
    /db\/.*migration/i
  ];

  for (const file of files) {
    if (/\.(svg|png|jpg|jpeg|gif|ico|webp|md)$/i.test(file.path)) {
      continue;
    }
    const isMigration = migrationPatterns.some(p => p.test(file.path));
    if (!isMigration && !file.content.toLowerCase().includes('alter table')) {
      continue;
    }

    const lines = file.content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      const lineNum = i + 1;

      // 1. Adding NOT NULL without DEFAULT (Table Lock Hazard)
      if (
        /alter\s+table\s+.*add\s+(?:column\s+)?.*not\s+null/i.test(trimmed) &&
        !/default/i.test(trimmed)
      ) {
        findings.push({
          ruleId: 'schema/not-null-no-default',
          category: 'Database Migration Hazard',
          severity: 'CRITICAL',
          title: 'Adding NOT NULL column without DEFAULT locks large tables',
          filePath: file.path,
          line: lineNum,
          snippet: trimmed,
          recommendation:
            'Add column as NULLABLE first, backfill rows in batches, set DEFAULT, and then add NOT NULL constraint to avoid exclusive table locks.',
          autoFixable: false
        });
      }

      // 2. Direct Column Drop (Zero-Downtime Rolling Deployment Killer)
      if (/alter\s+table\s+.*drop\s+(?:column\s+)?[a-zA-Z0-9_]+/i.test(trimmed)) {
        findings.push({
          ruleId: 'schema/drop-column-hazard',
          category: 'Database Migration Hazard',
          severity: 'CRITICAL',
          title: 'Dropping column breaks rolling deployments and replicas',
          filePath: file.path,
          line: lineNum,
          snippet: trimmed,
          recommendation:
            'Deprecate the column first (stop writing to it across all app versions), deploy the app code update, and only drop the column in a subsequent release.',
          autoFixable: false
        });
      }

      // 3. Unindexed Foreign Key Constraint
      if (
        /add\s+constraint\s+.*foreign\s+key/i.test(trimmed) &&
        !file.content.toLowerCase().includes('create index')
      ) {
        findings.push({
          ruleId: 'schema/unindexed-foreign-key',
          category: 'Database Performance',
          severity: 'WARN',
          title: 'Foreign key added without an accompanying index',
          filePath: file.path,
          line: lineNum,
          snippet: trimmed,
          recommendation:
            'Create an index on the foreign key column to prevent cascading sequential table scans during updates and deletes.',
          autoFixable: false
        });
      }

      // 4. Renaming column or table
      if (/(?:alter\s+table\s+.*rename\s+(?:column\s+)?|rename\s+table)/i.test(trimmed)) {
        findings.push({
          ruleId: 'schema/rename-column-hazard',
          category: 'Database Migration Hazard',
          severity: 'ERROR',
          title: 'Renaming active columns breaks in-flight queries',
          filePath: file.path,
          line: lineNum,
          snippet: trimmed,
          recommendation:
            'Use expand-contract pattern: Add the new column, dual-write to both, copy historical data, switch reads, and remove old column later.',
          autoFixable: false
        });
      }
    }
  }

  return findings;
}

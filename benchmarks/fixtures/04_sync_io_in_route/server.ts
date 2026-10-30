// Request handler that blocks event loop
import fs from 'node:fs';

export function handleUserReportRequest(req: any, res: any) {
  const data = fs.readFileSync('/var/data/heavy_report.json', 'utf-8');
  res.json(JSON.parse(data));
}

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [page, projectName] = process.argv.slice(2);

if (!page || !projectName) {
  throw new Error('Usage: node tools/build-standalone-vercel-payload.mjs <page> <project-name>');
}

const indexPath = resolve('client', 'standalone-pages', page, 'index.html');
const index = readFileSync(indexPath, 'utf8');
const payload = {
  name: projectName,
  target: 'production',
  teamId: 'team_wHAoknL1vXk7S0Cf8FJdrQSE',
  files: [
    { file: 'index.html', encoding: 'utf-8', data: index },
    {
      file: 'vercel.json',
      encoding: 'utf-8',
      data: JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }),
    },
  ],
};

writeFileSync(`/tmp/vercel-deploy-${page}.json`, JSON.stringify(payload));

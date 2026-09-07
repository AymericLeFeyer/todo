import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Database from 'better-sqlite3';
import { loadConfig } from '../config.js';

/**
 * Sauvegarde à chaud de la base.
 *
 * `VACUUM INTO` produit un fichier cohérent même pendant que l'API écrit,
 * contrairement à une simple copie du `.db` qui laisserait de côté le journal
 * WAL et donnerait une sauvegarde tronquée.
 *
 * Usage : npm run backup -w @todo/api [-- chemin/de/sortie.db]
 */
const config = loadConfig();
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const target = resolve(process.argv[2] ?? join(dirname(config.databasePath), `todo-${stamp}.db`));

mkdirSync(dirname(target), { recursive: true });

const db = new Database(config.databasePath, { readonly: true });
db.prepare('VACUUM INTO ?').run(target);
db.close();

console.log(`Sauvegarde écrite : ${target}`);

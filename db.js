'use strict';

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const dataDir = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'escola.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS turmas (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  nome  TEXT NOT NULL UNIQUE,
  tipo  TEXT NOT NULL CHECK (tipo IN ('medio', 'tecnico')),
  aulas_por_dia INTEGER NOT NULL DEFAULT 6
);

CREATE TABLE IF NOT EXISTS professores (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS aulas (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  turma_id     INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  dia          INTEGER NOT NULL CHECK (dia BETWEEN 1 AND 5),
  ordem        INTEGER NOT NULL CHECK (ordem BETWEEN 1 AND 6),
  materia      TEXT NOT NULL DEFAULT '',
  professor_id INTEGER REFERENCES professores(id) ON DELETE SET NULL,
  UNIQUE (turma_id, dia, ordem)
);

CREATE TABLE IF NOT EXISTS usuarios (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  nome     TEXT NOT NULL,
  usuario  TEXT NOT NULL UNIQUE COLLATE NOCASE,
  senha    TEXT NOT NULL,
  papel    TEXT NOT NULL CHECK (papel IN ('admin', 'aluno')),
  turma_id INTEGER REFERENCES turmas(id) ON DELETE SET NULL,
  criado_em TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  turma_id   INTEGER NOT NULL REFERENCES turmas(id) ON DELETE CASCADE,
  UNIQUE (usuario_id, turma_id)
);
`);

function semear() {
  const qtdTurmas = db.prepare('SELECT COUNT(*) AS n FROM turmas').get().n;
  if (qtdTurmas > 0) return;

  const insertTurma = db.prepare('INSERT INTO turmas (nome, tipo) VALUES (?, ?)');
  const insertProf = db.prepare('INSERT INTO professores (nome) VALUES (?)');
  const insertAula = db.prepare('INSERT INTO aulas (turma_id, dia, ordem, materia, professor_id) VALUES (?, ?, ?, ?, ?)');
  const insertAdmin = db.prepare('INSERT INTO usuarios (nome, usuario, senha, papel) VALUES (?, ?, ?, ?)');

  const transacao = db.transaction(() => {
    const turmas = [
      ['1°A', 'medio'], ['1°B', 'medio'], ['1°C', 'medio'],
      ['2°A', 'medio'], ['2°B', 'medio'], ['2°C', 'medio'],
      ['3°A', 'medio'], ['3°B', 'medio'], ['3°C', 'medio'],
      ['2°DSB', 'tecnico'], ['2°ADM', 'tecnico'],
      ['3°DSB', 'tecnico'], ['3°DSC', 'tecnico'], ['3°ADM', 'tecnico']
    ];
    const idsTurmas = turmas.map(([nome, tipo]) => insertTurma.run(nome, tipo).lastInsertRowid);

    const professores = [
      'Adriana Prado', 'Bruno Ferraz', 'Carla Nogueira', 'Diego Sarmento',
      'Elaine Costa', 'Fábio Vieira', 'Gisele Marques', 'Heitor Lopes',
      'Ilana Bittencourt', 'Jonas Teixeira', 'Karla Duarte', 'Leandro Pinho'
    ];
    const idsProf = professores.map(nome => insertProf.run(nome).lastInsertRowid);

    const materias = [
      'Matemática', 'Língua Portuguesa', 'Física', 'Química', 'Biologia',
      'História', 'Geografia', 'Inglês', 'Artes', 'Ed. Física',
      'Filosofia', 'Sociologia', 'Redação'
    ];

    for (let t = 0; t < idsTurmas.length; t++) {
      let seed = (t + 1) * 7919;
      for (let dia = 1; dia <= 5; dia++) {
        for (let ordem = 1; ordem <= 6; ordem++) {
          seed = (seed * 1103515245 + 12345) % 2147483648;
          const materia = materias[seed % materias.length];
          seed = (seed * 1103515245 + 12345) % 2147483648;
          const professor = idsProf[seed % idsProf.length];
          insertAula.run(idsTurmas[t], dia, ordem, materia, professor);
        }
      }
    }

    insertAdmin.run('Coordenação', 'admin', bcrypt.hashSync('admin123', 10), 'admin');
  });
  transacao();
}

semear();

module.exports = { db };

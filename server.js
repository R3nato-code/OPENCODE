'use strict';

const express = require('express');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { db } = require('./db');

const app = express();
const PORTA = process.env.PORT || 3000;
const SEGREDO = process.env.SESSION_SECRET || 'dev-secret-troque-em-producao';
const EM_PRODUCAO = process.env.NODE_ENV === 'production' || !!process.env.RENDER;

app.disable('x-powered-by');
app.use(express.json({ limit: '64kb' }));

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// ---------------------------------------------------------------- sessão

function assinar(payload) {
  const corpo = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const hmac = crypto.createHmac('sha256', SEGREDO).update(corpo).digest('base64url');
  return `${corpo}.${hmac}`;
}

function verificar(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, hmac] = token.split('.');
  const esperado = crypto.createHmac('sha256', SEGREDO).update(corpo).digest('base64url');
  const a = Buffer.from(hmac);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const dados = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    if (!dados.id || dados.exp < Date.now()) return null;
    return dados;
  } catch {
    return null;
  }
}

function cookies(req) {
  const c = {};
  const bruto = req.headers.cookie;
  if (!bruto) return c;
  for (const parte of bruto.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0) c[parte.slice(0, i).trim()] = decodeURIComponent(parte.slice(i + 1).trim());
  }
  return c;
}

function usuarioAtual(req) {
  const dados = verificar(cookies(req).sessao);
  if (!dados) return null;
  return db.prepare(
    `SELECT u.id, u.nome, u.usuario, u.papel, u.turma_id, t.nome AS turma_nome
       FROM usuarios u LEFT JOIN turmas t ON t.id = u.turma_id
      WHERE u.id = ?`
  ).get(dados.id) || null;
}

function exigirSessao(req, res, next) {
  const u = usuarioAtual(req);
  if (!u) return res.status(401).json({ erro: 'Faça login para continuar' });
  req.usuario = u;
  next();
}

function exigirAdmin(req, res, next) {
  const u = usuarioAtual(req);
  if (!u) return res.status(401).json({ erro: 'Faça login para continuar' });
  if (u.papel !== 'admin') return res.status(403).json({ erro: 'Acesso restrito à administração' });
  req.usuario = u;
  next();
}

const tentativas = new Map();
const LIMITE = 8, JANELA_MS = 5 * 60 * 1000;

function limiteLogin(req, res, next) {
  const ip = req.socket.remoteAddress || '?';
  const reg = tentativas.get(ip);
  const agora = Date.now();
  if (reg && reg.n >= LIMITE && agora < reg.ate) {
    return res.status(429).json({ erro: 'Muitas tentativas. Tente novamente em alguns minutos.' });
  }
  req._ipLogin = ip;
  next();
}

function marcarFalha(ip) {
  const reg = tentativas.get(ip);
  if (reg && Date.now() < reg.ate) reg.n++;
  else tentativas.set(ip, { n: 1, ate: Date.now() + JANELA_MS });
}

// ---------------------------------------------------------------- auth

app.post('/api/auth/registro', (req, res) => {
  const { nome, usuario, senha, turma_id } = req.body || {};
  const nomeOk = typeof nome === 'string' && nome.trim().length >= 2 && nome.trim().length <= 60;
  const usuarioOk = typeof usuario === 'string' && /^[a-z0-9_.-]{3,20}$/.test(usuario);
  const senhaOk = typeof senha === 'string' && senha.length >= 6 && senha.length <= 72;
  if (!nomeOk) return res.status(400).json({ erro: 'Informe um nome entre 2 e 60 caracteres.' });
  if (!usuarioOk) return res.status(400).json({ erro: 'Usuário deve ter 3 a 20 caracteres: letras, números, ponto, hífen ou underline.' });
  if (!senhaOk) return res.status(400).json({ erro: 'A senha precisa ter ao menos 6 caracteres.' });

  let turma = null;
  if (turma_id != null && turma_id !== '') {
    turma = db.prepare('SELECT id FROM turmas WHERE id = ?').get(Number(turma_id));
    if (!turma) return res.status(400).json({ erro: 'Turma inválida.' });
  }

  const existe = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario);
  if (existe) return res.status(409).json({ erro: 'Esse nome de usuário já está em uso.' });

  const r = db.prepare(
    'INSERT INTO usuarios (nome, usuario, senha, papel, turma_id) VALUES (?, ?, ?, ?, ?)'
  ).run(nome.trim(), usuario, bcrypt.hashSync(senha, 10), 'aluno', turma ? turma.id : null);

  const token = assinar({ id: r.lastInsertRowid, exp: Date.now() + 30 * 24 * 3600 * 1000 });
  res.cookie('sessao', token, { httpOnly: true, sameSite: 'lax', secure: EM_PRODUCAO, maxAge: 30 * 24 * 3600 * 1000 });
  res.status(201).json({ ok: true, papel: 'aluno' });
});

app.post('/api/auth/login', limiteLogin, (req, res) => {
  const { usuario, senha } = req.body || {};
  const u = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(String(usuario || ''));
  if (!u || !bcrypt.compareSync(String(senha || ''), u.senha)) {
    marcarFalha(req._ipLogin);
    return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  }
  const token = assinar({ id: u.id, exp: Date.now() + 30 * 24 * 3600 * 1000 });
  res.cookie('sessao', token, { httpOnly: true, sameSite: 'lax', secure: EM_PRODUCAO, maxAge: 30 * 24 * 3600 * 1000 });
  res.json({ ok: true, papel: u.papel });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('sessao');
  res.json({ ok: true });
});

app.post('/api/auth/trocar-senha', exigirSessao, (req, res) => {
  const { atual, nova } = req.body || {};
  if (typeof nova !== 'string' || nova.length < 6 || nova.length > 72) {
    return res.status(400).json({ erro: 'A nova senha precisa ter ao menos 6 caracteres.' });
  }
  const u = db.prepare('SELECT senha FROM usuarios WHERE id = ?').get(req.usuario.id);
  if (!u || !bcrypt.compareSync(String(atual || ''), u.senha)) {
    return res.status(401).json({ erro: 'Senha atual incorreta.' });
  }
  db.prepare('UPDATE usuarios SET senha = ? WHERE id = ?').run(bcrypt.hashSync(nova, 10), req.usuario.id);
  res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
  const u = usuarioAtual(req);
  if (!u) return res.json({ autenticado: false });
  const favoritos = db.prepare('SELECT turma_id FROM favoritos WHERE usuario_id = ?').all(u.id).map(r => r.turma_id);
  res.json({
    autenticado: true,
    id: u.id, nome: u.nome, usuario: u.usuario, papel: u.papel,
    turma_id: u.turma_id, turma_nome: u.turma_nome, favoritos
  });
});

// ---------------------------------------------------------------- turmas / grade

app.get('/api/turmas', exigirSessao, (req, res) => {
  const u = usuarioAtual(req);
  let favoritas = new Set();
  if (u) favoritas = new Set(db.prepare('SELECT turma_id FROM favoritos WHERE usuario_id = ?').all(u.id).map(r => r.turma_id));
  const turmas = db.prepare(`
    SELECT t.id, t.nome, t.tipo,
           (SELECT COUNT(*) FROM aulas WHERE turma_id = t.id AND materia != '') AS aulas_preenchidas
      FROM turmas t ORDER BY t.tipo, t.nome
  `).all();
  res.json(turmas.map(t => ({ ...t, favorita: favoritas.has(t.id) })));
});

app.post('/api/favoritos/:turmaId', exigirSessao, (req, res) => {
  const id = Number(req.params.turmaId);
  if (!db.prepare('SELECT id FROM turmas WHERE id = ?').get(id)) {
    return res.status(404).json({ erro: 'Turma não encontrada.' });
  }
  const existe = db.prepare('SELECT 1 FROM favoritos WHERE usuario_id = ? AND turma_id = ?').get(req.usuario.id, id);
  if (existe) {
    db.prepare('DELETE FROM favoritos WHERE usuario_id = ? AND turma_id = ?').run(req.usuario.id, id);
    return res.json({ favorita: false });
  }
  db.prepare('INSERT INTO favoritos (usuario_id, turma_id) VALUES (?, ?)').run(req.usuario.id, id);
  res.json({ favorita: true });
});

app.get('/api/grade/:turmaId', exigirSessao, (req, res) => {
  const id = Number(req.params.turmaId);
  const turma = db.prepare('SELECT id, nome, tipo FROM turmas WHERE id = ?').get(id);
  if (!turma) return res.status(404).json({ erro: 'Turma não encontrada.' });
  const aulas = db.prepare(`
    SELECT a.ordem, a.dia, a.materia, p.nome AS professor
      FROM aulas a LEFT JOIN professores p ON p.id = a.professor_id
     WHERE a.turma_id = ?
     ORDER BY a.dia, a.ordem
  `).all(id);
  const grade = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const a of aulas) grade[a.dia].push(a);
  res.json({ ...turma, grade });
});

// ---------------------------------------------------------------- painel admin

app.get('/api/admin/professores', exigirAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT p.id, p.nome,
           (SELECT COUNT(*) FROM aulas WHERE professor_id = p.id) AS aulas
      FROM professores p ORDER BY p.nome
  `).all());
});

app.post('/api/admin/professores', exigirAdmin, (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (nome.length < 2 || nome.length > 60) return res.status(400).json({ erro: 'Nome deve ter entre 2 e 60 caracteres.' });
  try {
    const r = db.prepare('INSERT INTO professores (nome) VALUES (?)').run(nome);
    res.status(201).json({ id: r.lastInsertRowid, nome });
  } catch {
    res.status(409).json({ erro: 'Já existe um professor com esse nome.' });
  }
});

app.put('/api/admin/professores/:id', exigirAdmin, (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  if (nome.length < 2 || nome.length > 60) return res.status(400).json({ erro: 'Nome deve ter entre 2 e 60 caracteres.' });
  const r = db.prepare('UPDATE professores SET nome = ? WHERE id = ?').run(nome, Number(req.params.id));
  if (!r.changes) return res.status(404).json({ erro: 'Professor não encontrado.' });
  res.json({ ok: true });
});

app.delete('/api/admin/professores/:id', exigirAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM professores WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ erro: 'Professor não encontrado.' });
  res.json({ ok: true });
});

app.post('/api/admin/turmas', exigirAdmin, (req, res) => {
  const nome = String(req.body?.nome || '').trim();
  const tipo = req.body?.tipo;
  if (nome.length < 1 || nome.length > 15) return res.status(400).json({ erro: 'Nome da turma deve ter até 15 caracteres.' });
  if (!['medio', 'tecnico'].includes(tipo)) return res.status(400).json({ erro: 'Tipo deve ser "medio" ou "tecnico".' });
  try {
    const r = db.prepare('INSERT INTO turmas (nome, tipo) VALUES (?, ?)').run(nome, tipo);
    const insertAula = db.prepare('INSERT INTO aulas (turma_id, dia, ordem) VALUES (?, ?, ?)');
    for (let dia = 1; dia <= 5; dia++) for (let ordem = 1; ordem <= 6; ordem++) insertAula.run(r.lastInsertRowid, dia, ordem);
    res.status(201).json({ id: r.lastInsertRowid, nome, tipo });
  } catch {
    res.status(409).json({ erro: 'Já existe uma turma com esse nome.' });
  }
});

app.delete('/api/admin/turmas/:id', exigirAdmin, (req, res) => {
  const r = db.prepare('DELETE FROM turmas WHERE id = ?').run(Number(req.params.id));
  if (!r.changes) return res.status(404).json({ erro: 'Turma não encontrada.' });
  res.json({ ok: true });
});

app.get('/api/admin/usuarios', exigirAdmin, (req, res) => {
  res.json(db.prepare(`
    SELECT u.id, u.nome, u.usuario, u.papel, u.turma_id, t.nome AS turma_nome
      FROM usuarios u LEFT JOIN turmas t ON t.id = u.turma_id
     ORDER BY u.papel, u.usuario
  `).all());
});

app.post('/api/admin/usuarios', exigirAdmin, (req, res) => {
  const { nome, usuario, senha, papel, turma_id } = req.body || {};
  if (typeof nome !== 'string' || nome.trim().length < 2 || nome.trim().length > 60) {
    return res.status(400).json({ erro: 'Nome deve ter entre 2 e 60 caracteres.' });
  }
  if (typeof usuario !== 'string' || !/^[a-z0-9_.-]{3,20}$/.test(usuario)) {
    return res.status(400).json({ erro: 'Usuário: 3 a 20 caracteres (letras, números, ponto, hífen, underline).' });
  }
  if (typeof senha !== 'string' || senha.length < 6 || senha.length > 72) {
    return res.status(400).json({ erro: 'A senha precisa ter ao menos 6 caracteres.' });
  }
  if (!['admin', 'aluno'].includes(papel)) return res.status(400).json({ erro: 'Papel inválido.' });
  let turma = null;
  if (turma_id != null && turma_id !== '') {
    turma = db.prepare('SELECT id FROM turmas WHERE id = ?').get(Number(turma_id));
    if (!turma) return res.status(400).json({ erro: 'Turma inválida.' });
  }
  if (db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(usuario)) {
    return res.status(409).json({ erro: 'Esse nome de usuário já está em uso.' });
  }
  const r = db.prepare('INSERT INTO usuarios (nome, usuario, senha, papel, turma_id) VALUES (?, ?, ?, ?, ?)')
    .run(nome.trim(), usuario, bcrypt.hashSync(senha, 10), papel, turma ? turma.id : null);
  res.status(201).json({ id: r.lastInsertRowid });
});

app.delete('/api/admin/usuarios/:id', exigirAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.usuario.id) return res.status(400).json({ erro: 'Você não pode excluir a própria conta.' });
  const r = db.prepare('DELETE FROM usuarios WHERE id = ?').run(id);
  if (!r.changes) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json({ ok: true });
});

app.put('/api/admin/usuarios/:id/senha', exigirAdmin, (req, res) => {
  const id = Number(req.params.id);
  const { senha } = req.body || {};
  if (typeof senha !== 'string' || senha.length < 6 || senha.length > 72) {
    return res.status(400).json({ erro: 'A senha precisa ter ao menos 6 caracteres.' });
  }
  const r = db.prepare('UPDATE usuarios SET senha = ? WHERE id = ?').run(bcrypt.hashSync(senha, 10), id);
  if (!r.changes) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  res.json({ ok: true });
});

app.get('/api/admin/aulas/:turmaId', exigirAdmin, (req, res) => {
  const id = Number(req.params.turmaId);
  const turma = db.prepare('SELECT id, nome, tipo FROM turmas WHERE id = ?').get(id);
  if (!turma) return res.status(404).json({ erro: 'Turma não encontrada.' });
  const aulas = db.prepare(`
    SELECT a.id, a.dia, a.ordem, a.materia, a.professor_id
      FROM aulas a WHERE a.turma_id = ? ORDER BY a.dia, a.ordem
  `).all(id);
  const grade = { 1: [], 2: [], 3: [], 4: [], 5: [] };
  for (const a of aulas) grade[a.dia].push(a);
  res.json({ ...turma, grade });
});

app.put('/api/admin/aulas/:id', exigirAdmin, (req, res) => {
  const id = Number(req.params.id);
  const aula = db.prepare('SELECT id FROM aulas WHERE id = ?').get(id);
  if (!aula) return res.status(404).json({ erro: 'Aula não encontrada.' });
  let materia = req.body?.materia;
  let professor_id = req.body?.professor_id;
  if (typeof materia !== 'string' || materia.length > 40) {
    return res.status(400).json({ erro: 'Matéria deve ter até 40 caracteres.' });
  }
  materia = materia.trim();
  if (professor_id === '' || professor_id == null) professor_id = null;
  else {
    professor_id = Number(professor_id);
    if (!db.prepare('SELECT id FROM professores WHERE id = ?').get(professor_id)) {
      return res.status(400).json({ erro: 'Professor inválido.' });
    }
  }
  db.prepare('UPDATE aulas SET materia = ?, professor_id = ? WHERE id = ?').run(materia, professor_id, id);
  res.json({ ok: true });
});

app.post('/api/admin/aulas/:id/mover', exigirAdmin, (req, res) => {
  const direcao = req.body?.direcao;
  if (!['subir', 'descer'].includes(direcao)) return res.status(400).json({ erro: 'Direção inválida.' });
  const aula = db.prepare('SELECT id, turma_id, dia, ordem FROM aulas WHERE id = ?').get(Number(req.params.id));
  if (!aula) return res.status(404).json({ erro: 'Aula não encontrada.' });
  const alvoOrdem = direcao === 'subir' ? aula.ordem - 1 : aula.ordem + 1;
  if (alvoOrdem < 1 || alvoOrdem > 6) return res.json({ ok: true });
  const vizinha = db.prepare('SELECT id, materia, professor_id FROM aulas WHERE turma_id = ? AND dia = ? AND ordem = ?')
    .get(aula.turma_id, aula.dia, alvoOrdem);
  if (!vizinha) return res.json({ ok: true });
  const atual = db.prepare('SELECT materia, professor_id FROM aulas WHERE id = ?').get(aula.id);
  const tx = db.transaction(() => {
    db.prepare('UPDATE aulas SET materia = ?, professor_id = ? WHERE id = ?').run(atual.materia, atual.professor_id, vizinha.id);
    db.prepare('UPDATE aulas SET materia = ?, professor_id = ? WHERE id = ?').run(vizinha.materia, vizinha.professor_id, aula.id);
  });
  tx();
  res.json({ ok: true });
});

// ---------------------------------------------------------------- estáticos

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  if (req.path === '/data' || req.path.startsWith('/data/') || req.path.endsWith('.db') || req.path.endsWith('.db-wal') || req.path.endsWith('.db-shm')) {
    return res.status(403).json({ erro: 'Arquivo não público.' });
  }
  next();
});

app.use(express.static(path.join(__dirname), { index: 'index.html' }));

app.use('/api', (req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed' || err.type === 'entity.too.large') {
    return res.status(400).json({ erro: 'Requisição inválida.' });
  }
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

app.listen(PORTA, () => console.log(`Servidor rodando em http://localhost:${PORTA}`));

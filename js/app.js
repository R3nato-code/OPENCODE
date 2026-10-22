'use strict';

// ---------------------------------------------------------------- constantes

const HORARIOS = [
  { ordem: 1, inicio: '07:20', fim: '08:10', min: 50 },
  { ordem: 2, inicio: '08:10', fim: '09:00', min: 50 },
  { ordem: 3, inicio: '09:00', fim: '09:45', min: 45 },
  { ordem: 4, inicio: '10:10', fim: '10:55', min: 45 },
  { ordem: 5, inicio: '10:55', fim: '11:45', min: 50 },
  { ordem: 6, inicio: '11:45', fim: '12:30', min: 45 }
];

const RECREIO = { inicio: '09:45', fim: '10:10', min: 25 };
const DIAS = ['', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
const MATERIAS_COMUNS = [
  'Matemática', 'Língua Portuguesa', 'Física', 'Química', 'Biologia',
  'História', 'Geografia', 'Inglês', 'Artes', 'Ed. Física',
  'Filosofia', 'Sociologia', 'Redação'
];

const $view = document.getElementById('view');
const $topo = document.getElementById('topo');
const estado = { me: null };

// ---------------------------------------------------------------- helpers

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function toast(msg, tipo = '') {
  const el = document.createElement('div');
  el.className = `toast ${tipo ? 'toast--' + tipo : ''}`;
  el.textContent = msg;
  document.getElementById('toasts').appendChild(el);
  setTimeout(() => el.remove(), 3400);
}

async function api(url, opts = {}) {
  const res = await fetch(url, {
    credentials: 'same-origin',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    ...opts
  });
  let dados = null;
  try { dados = await res.json(); } catch { /* sem corpo */ }
  if (!res.ok) {
    throw new Error((dados && dados.erro) || 'Não foi possível concluir a operação.');
  }
  return dados;
}

function matizDe(texto) {
  let h = 0;
  for (let i = 0; i < texto.length; i++) h = (h * 31 + texto.charCodeAt(i)) % 360;
  return h;
}

function diaSemanaHoje() {
  const d = new Date().getDay();
  return d >= 1 && d <= 5 ? d : 1;
}

// ---------------------------------------------------------------- header

function renderTopo() {
  const rota = location.hash || '#/turmas';
  const link = (href, texto) =>
    `<a href="${href}" class="${rota.startsWith(href) ? 'ativo' : ''}">${texto}</a>`;
  const me = estado.me;

  let nav = '';
  if (me && me.papel === 'admin') nav += link('#/admin', 'Painel');
  if (me) nav += `<a href="#/conta" class="${rota.startsWith('#/conta') ? 'ativo' : ''}">Conta</a>`;
  nav += `<a href="#/turmas" class="${rota.startsWith('#/turmas') || rota.startsWith('#/grade') ? 'ativo' : ''}">Turmas</a>`;

  $topo.innerHTML = `
    <div class="topo__inner">
      <a class="marca" href="#/turmas" aria-label="Quadro Escolar — início">
        <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
          <rect x="1" y="1" width="24" height="24" rx="6" fill="#fff" opacity=".16"/>
          <rect x="5" y="5" width="9" height="6" rx="2" fill="#fff"/>
          <rect x="16" y="5" width="5" height="6" rx="2" fill="#e8a535"/>
          <rect x="5" y="14" width="5" height="6" rx="2" fill="#fff" opacity=".7"/>
          <rect x="12" y="14" width="9" height="6" rx="2" fill="#fff"/>
        </svg>
        <span>Quadro Escolar</span>
      </a>
      <nav class="topo__nav" aria-label="Navegação">${nav}</nav>
      <div class="topo__fim">
        <button id="btn-instalar" class="btn-instalar" hidden>Instalar</button>
        ${me ? `
          <div class="quem"><strong>${esc(me.nome)}</strong><span>${me.papel === 'admin' ? 'Administração' : 'Aluno' + (me.turma_nome ? ' · ' + esc(me.turma_nome) : '')}</span></div>
          <button class="btn-sair" id="btn-sair">Sair</button>` : ''}
      </div>
    </div>`;

  const sair = document.getElementById('btn-sair');
  if (sair) sair.onclick = async () => {
    await api('/api/auth/logout', { method: 'POST' });
    estado.me = null;
    location.hash = '#/login';
    rotear();
  };

  configurarInstalacao();
}

// ---------------------------------------------------------------- router

window.addEventListener('hashchange', rotear);

async function rotear() {
  const url = location.hash || '#/turmas';
  renderTopo();

  const publicaRota = url === '#/login' || url === '#/registrar';
  if (!estado.me && !publicaRota) {
    location.hash = '#/login';
    return rotear();
  }

  $view.innerHTML = '<div class="carregando">Carregando…</div>';

  try {
    const mGrade = url.match(/^#\/grade\/(\d+)\?dia=(\d+)$/);
    const mAdmin = url.match(/^#\/admin\/(\w+)$/);

    if (url === '#/login') return telaLogin();
    if (url === '#/registrar') return telaRegistro();
    if (url === '#/conta') return telaConta();
    if (mGrade) return await telaGrade(+mGrade[1], +mGrade[2]);
    if (mAdmin) return await telaAdmin(mAdmin[1]);
    return await telaTurmas();
  } catch (e) {
    $view.innerHTML = `<div class="mensagem mensagem--erro">${esc(e.message)}</div>`;
  }
}

function exigirPerfil(papel) {
  if (!estado.me) { location.hash = '#/login'; throw new Error('Faça login para continuar.'); }
  if (papel && estado.me.papel !== papel) { location.hash = '#/turmas'; throw new Error('Acesso restrito à administração.'); }
}

// ---------------------------------------------------------------- login / registro

function telaLogin() {
  $view.innerHTML = `
    <div class="aut-box">
      <div class="aut-cartao">
        <div class="aut-cartao__marca">
          <h1>Bem-vindo de volta</h1>
          <p>Consulte os horários das suas aulas.</p>
        </div>
        <form id="form-login" novalidate>
          <label class="campo"><span>Usuário</span>
            <input name="usuario" autocomplete="username" required maxlength="20" />
          </label>
          <label class="campo"><span>Senha</span>
            <input name="senha" type="password" autocomplete="current-password" required maxlength="72" />
          </label>
          <p class="erro-form" id="erro-login"></p>
          <button class="btn btn--primario" type="submit">Entrar</button>
        </form>
        <p class="aut-rodape">Ainda não tem conta? <a href="#/registrar">Registre-se</a></p>
        <div class="dica-admin">Conta da coordenação: <strong>admin</strong> · senha <strong>admin123</strong> (troque após o primeiro acesso).</div>
      </div>
    </div>`;

  document.getElementById('form-login').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    document.getElementById('erro-login').textContent = '';
    try {
      await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ usuario: f.usuario.value.trim(), senha: f.senha.value }) });
      await carregarSessao();
      location.hash = estado.me.papel === 'admin' ? '#/admin/turmas' : '#/turmas';
      rotear();
    } catch (err) {
      document.getElementById('erro-login').textContent = err.message;
    }
  };
}

function telaRegistro() {
  $view.innerHTML = `
    <div class="aut-box">
      <div class="aut-cartao">
        <div class="aut-cartao__marca">
          <h1>Criar conta de aluno</h1>
          <p>Kits de acesso são criados pela coordenação.</p>
        </div>
        <form id="form-registro" novalidate>
          <label class="campo"><span>Nome completo</span>
            <input name="nome" required maxlength="60" autocomplete="name" />
          </label>
          <label class="campo"><span>Usuário</span>
            <input name="usuario" required maxlength="20" autocomplete="username" />
          </label>
          <label class="campo"><span>Senha (mín. 6)</span>
            <input name="senha" type="password" required maxlength="72" autocomplete="new-password" />
          </label>
          <label class="campo"><span>Turma (opcional)</span>
            <select name="turma_id" data-lista-turmas></select>
          </label>
          <p class="erro-form" id="erro-registro"></p>
          <button class="btn btn--primario" type="submit">Criar conta</button>
        </form>
        <p class="aut-rodape">Já tem conta? <a href="#/login">Entrar</a></p>
      </div>
    </div>`;

  api('/api/turmas').then(turmas => {
    const sel = document.querySelector('[data-lista-turmas]');
    sel.innerHTML = '<option value="">— sem turma —</option>' + turmas.map(t =>
      `<option value="${t.id}">${esc(t.nome)}</option>`).join('');
  });

  document.getElementById('form-registro').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    document.getElementById('erro-registro').textContent = '';
    try {
      await api('/api/auth/registro', {
        method: 'POST',
        body: JSON.stringify({
          nome: f.nome.value.trim(),
          usuario: f.usuario.value.trim(),
          senha: f.senha.value,
          turma_id: f.turma_id.value
        })
      });
      toast('Conta criada! Faça login.', 'ok');
      location.hash = '#/login';
      rotear();
    } catch (err) {
      document.getElementById('erro-registro').textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------- minha conta

function telaConta() {
  $view.innerHTML = `
    <div class="aut-box">
      <div class="aut-cartao">
        <div class="aut-cartao__marca">
          <h1>Minha conta</h1>
          <p>Conectado como ${esc(estado.me.usuario)}</p>
        </div>
        <form id="form-senha" novalidate>
          <label class="campo"><span>Senha atual</span>
            <input name="atual" type="password" autocomplete="current-password" required />
          </label>
          <label class="campo"><span>Nova senha (mín. 6)</span>
            <input name="nova" type="password" autocomplete="new-password" required minlength="6" />
          </label>
          <label class="campo"><span>Confirmar nova senha</span>
            <input name="confirma" type="password" autocomplete="new-password" required minlength="6" />
          </label>
          <p class="erro-form" id="erro-senha"></p>
          <button class="btn btn--primario" type="submit">Trocar senha</button>
        </form>
      </div>
    </div>`;

  document.getElementById('form-senha').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    const erro = document.getElementById('erro-senha');
    erro.textContent = '';
    if (f.nova.value !== f.confirma.value) {
      erro.textContent = 'A confirmação não confere com a nova senha.';
      return;
    }
    try {
      await api('/api/auth/trocar-senha', {
        method: 'POST',
        body: JSON.stringify({ atual: f.atual.value, nova: f.nova.value })
      });
      toast('Senha alterada com sucesso.', 'ok');
      location.hash = '#/turmas';
      rotear();
    } catch (err) {
      erro.textContent = err.message;
    }
  };
}

// ---------------------------------------------------------------- turmas

async function telaTurmas() {
  const turmas = await api('/api/turmas');
  const me = estado.me;
  const favoritas = turmas.filter(t => t.favorita);
  const comuns = turmas.filter(t => !t.favorita);

  const cartao = t => `
    <div class="cartao-turma-wrap">
      <a class="cartao-turma" href="#/grade/${t.id}?dia=${diaSemanaHoje()}">
        <span class="cartao-turma__nome">${esc(t.nome)}</span><br />
        <span class="cartao-turma__tipo ${t.tipo === 'medio' ? 'tipo-medio' : 'tipo-tecnico'}">${t.tipo === 'medio' ? 'Ens. Médio' : 'Técnico'}</span>
        <p class="cartao-turma__aulas">${t.aulas_preenchidas} aulas na semana</p>
      </a>
      <button class="btn-estrela ${t.favorita ? 'cheio' : ''}" data-fav="${t.id}"
              aria-label="${t.favorita ? 'Remover' : 'Adicionar'} aos favoritos">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 17.4 6.2 20.3l1.1-6.4L2.6 9.3l6.5-.9L12 2.5z"/>
        </svg>
      </button>
    </div>`;

  $view.innerHTML = `
    <div class="cabec">
      <div>
        <h1>Turmas</h1>
        <p>${me ? 'Toque em uma turma para ver a grade da semana.' : 'Faça login para favoritar turmas.'}</p>
      </div>
    </div>
    ${favoritas.length ? `
      <h2 class="secao-titulo">Favoritas</h2>
      <div class="grid-turmas">${favoritas.map(cartao).join('')}</div>
      <h2 class="secao-titulo">Todas as turmas</h2>` :
      (me ? `<div class="mensagem">Nenhuma turma favorita ainda — toque na estrela ☆ de uma turma para fixá-la aqui.</div>
            <h2 class="secao-titulo">Todas as turmas</h2>` : '')}
    <div class="grid-turmas">${comuns.map(cartao).join('')}</div>`;

  $view.querySelectorAll('[data-fav]').forEach(btn => {
    btn.onclick = async () => {
      try {
        await api(`/api/favoritos/${btn.dataset.fav}`, { method: 'POST' });
        await carregarSessao();
        rotear();
      } catch (e) {
        toast(e.message.includes('login') ? 'Faça login para favoritar.' : e.message, 'erro');
      }
    };
  });
}

// ---------------------------------------------------------------- grade

async function telaGrade(turmaId, dia) {
  dia = Math.min(Math.max(dia, 1), 5);
  const dados = await api(`/api/grade/${turmaId}`);
  const favorita = await (async () => {
    const turmas = await api('/api/turmas');
    const t = turmas.find(x => x.id === dados.id);
    return t ? t.favorita : false;
  })();

  $view.innerHTML = `
    <a class="voltar" href="#/turmas">&larr; Turmas</a>
    <div class="cabec">
      <div>
        <h1>Turma ${esc(dados.nome)}</h1>
        <p>${dados.tipo === 'medio' ? 'Ensino Médio' : 'Período Técnico'} · ${DIAS[dia]}</p>
      </div>
      ${estado.me ? `
        <button class="btn btn--mini btn-estrela--inline" data-fav-topo="${dados.id}" aria-label="Favoritar turma">
          ${favorita ? '&starf; Favorita' : '&star; Favoritar'}
        </button>` : ''}
    </div>
    <div class="abas-dias" role="tablist" aria-label="Dias da semana">
      ${DIAS.slice(1).map((nome, i) =>
        `<button data-dia="${i + 1}" role="tab" class="${i + 1 === dia ? 'ativo' : ''}">${nome.replace('-feira', '')}</button>`).join('')}
    </div>
    <div class="lista-aulas">
      ${HORARIOS.map((h, i) => {
        const aula = dados.grade[dia].find(a => a.ordem === h.ordem);
        const matiz = aula && aula.materia ? matizDe(aula.materia) : 0;
        const vazia = !aula || !aula.materia;
        const bloco = `
          <div class="aula ${vazia ? 'aula--vazia' : ''}">
            <div class="aula__hora">
              ${h.inicio}<small>${h.min} min</small>
            </div>
            <div class="aula__cartao" style="--matiz:${matiz}">
              <div>
                <div class="aula__materia">${vazia ? 'Sem aula marcada' : esc(aula.materia)}</div>
                ${vazia ? '' : (aula.professor ? `<div class="aula__professor">${esc(aula.professor)}</div>` : '<div class="aula__professor">—</div>')}
              </div>
              <span class="aula__ordem">${h.ordem}ª aula</span>
            </div>
          </div>`;
        return i === 3
          ? `<div class="recreio">Intervalo · ${RECREIO.inicio} – ${RECREIO.fim}</div>${bloco}` : bloco;
      }).join('')}
    </div>`;

  const abas = $view.querySelectorAll('[data-dia]');
  abas.forEach(b => b.onclick = () => { location.hash = `#/grade/${turmaId}?dia=${b.dataset.dia}`; });

  const fav = $view.querySelector('[data-fav-topo]');
  if (fav) fav.onclick = async () => {
    try {
      await api(`/api/favoritos/${dados.id}`, { method: 'POST' });
      rotear();
    } catch (e) { toast(e.message, 'erro'); }
  };
}

// ---------------------------------------------------------------- admin

const SELECT_GUARDADO = { turma: null, dia: diaSemanaHoje() };

async function telaAdmin(aba) {
  exigirPerfil('admin');
  const abas = ['turmas', 'professores', 'aulas', 'usuarios'];
  if (!abas.includes(aba)) aba = abas[0];

  $view.innerHTML = `
    <div class="cabec">
      <div>
        <h1>Painel</h1>
        <p>Gerencie turmas, professores, aulas e acessos.</p>
      </div>
    </div>
    <nav class="painel-abas">
      ${abas.map(a => `<a href="#/admin/${a}" class="${a === aba ? 'ativo' : ''}">${a[0].toUpperCase() + a.slice(1)}</a>`).join('')}
    </nav>
    <section class="painel-corpo" id="painel-corpo"></section>`;

  if (aba === 'aulas') return abaAulas();
  if (aba === 'turmas') return abaTurmas();
  if (aba === 'professores') return abaProfessores();
  return abaUsuarios();
}

async function abaTurmas() {
  const corpo = document.getElementById('painel-corpo');
  const turmas = await api('/api/turmas');

  corpo.innerHTML = `
    <form class="form-painel" id="form-turma">
      <div class="form-painel__linha">
        <label class="campo"><span>Nome da turma</span><input name="nome" maxlength="15" required /></label>
        <label class="campo"><span>Tipo</span>
          <select name="tipo"><option value="medio">Ensino Médio</option><option value="tecnico">Técnico</option></select>
        </label>
        <button class="btn btn--primario" type="submit">Criar turma</button>
      </div>
    </form>
    <div class="lista-simples">
      ${turmas.map(t => `
        <div class="painel-item">
          <strong>${esc(t.nome)}</strong>
          <small>${t.tipo === 'medio' ? 'Ens. Médio' : 'Técnico'} · ${t.aulas_preenchidas} aulas</small>
          <button class="btn btn--mini btn--perigo" data-excluir-turma="${t.id}">Excluir</button>
        </div>`).join('')}
    </div>`;

  document.getElementById('form-turma').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/admin/turmas', { method: 'POST', body: JSON.stringify({ nome: f.nome.value.trim(), tipo: f.tipo.value }) });
      toast('Turma criada com 30 espaços de aula.', 'ok');
      abaTurmas();
    } catch (err) { toast(err.message, 'erro'); }
  };

  corpo.querySelectorAll('[data-excluir-turma]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Excluir essa turma e todas as aulas dela?')) return;
      try { await api(`/api/admin/turmas/${b.dataset.excluirTurma}`, { method: 'DELETE' }); toast('Turma excluída.', 'ok'); abaTurmas(); }
      catch (err) { toast(err.message, 'erro'); }
    };
  });
}

async function abaProfessores() {
  const corpo = document.getElementById('painel-corpo');
  const professores = await api('/api/admin/professores');

  corpo.innerHTML = `
    <form class="form-painel" id="form-prof">
      <div class="form-painel__linha">
        <label class="campo"><span>Nome do professor</span><input name="nome" maxlength="60" required /></label>
        <button class="btn btn--primario" type="submit">Adicionar</button>
      </div>
    </form>
    <div class="lista-simples">
      ${professores.map(p => `
        <div class="painel-item" data-prof="${p.id}">
          <strong data-nome-prof>${esc(p.nome)}</strong>
          <small>${p.aulas} aula${p.aulas === 1 ? '' : 's'}</small>
          <button class="btn btn--mini" data-renomear="${p.id}">Renomear</button>
          <button class="btn btn--mini btn--perigo" data-excluir-prof="${p.id}">Excluir</button>
        </div>`).join('')}
    </div>`;

  document.getElementById('form-prof').onsubmit = async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/professores', { method: 'POST', body: JSON.stringify({ nome: e.target.nome.value.trim() }) });
      toast('Professor adicionado.', 'ok');
      abaProfessores();
    } catch (err) { toast(err.message, 'erro'); }
  };

  corpo.querySelectorAll('[data-renomear]').forEach(b => {
    b.onclick = () => {
      const item = b.closest('[data-prof]');
      const nomeEl = item.querySelector('[data-nome-prof]');
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 60;
      input.value = nomeEl.textContent;
      input.style.flex = '1';
      input.style.minWidth = '9rem';
      nomeEl.replaceWith(input);
      input.focus();

      const cancel = () => abaProfessores();
      let fechando = false;
      const salvar = async () => {
        if (fechando) return;
        const nome = input.value.trim();
        if (nome === nomeEl.textContent) { fechando = true; abaProfessores(); return; }
        if (nome.length < 2) { toast('Nome deve ter no mínimo 2 caracteres.', 'erro'); input.focus(); return; }
        fechando = true;
        try {
          await api(`/api/admin/professores/${item.dataset.prof}`, { method: 'PUT', body: JSON.stringify({ nome }) });
          toast('Professor renomeado.', 'ok');
        } catch (err) { toast(err.message, 'erro'); }
        abaProfessores();
      };

      input.onkeydown = (e) => {
        if (e.key === 'Enter') { e.preventDefault(); salvar(); }
        if (e.key === 'Escape') cancel();
      };
      input.onblur = salvar;
    };
  });

  corpo.querySelectorAll('[data-excluir-prof]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Excluir esse professor? As aulas dele ficarão sem professor.')) return;
      try { await api(`/api/admin/professores/${b.dataset.excluirProf}`, { method: 'DELETE' }); toast('Professor excluído.', 'ok'); abaProfessores(); }
      catch (err) { toast(err.message, 'erro'); }
    };
  });
}

async function abaAulas() {
  const corpo = document.getElementById('painel-corpo');
  const turmas = await api('/api/turmas');
  if (!SELECT_GUARDADO.turma && turmas.length) SELECT_GUARDADO.turma = turmas[0].id;

  const listaProf = await api('/api/admin/professores');
  const dados = SELECT_GUARDADO.turma ? await api(`/api/admin/aulas/${SELECT_GUARDADO.turma}`) : null;
  const aulas = dados ? dados.grade[SELECT_GUARDADO.dia] : [];

  const datalist = `<datalist id="materias-lista">${MATERIAS_COMUNS.map(m => `<option value="${m}">`).join('')}</datalist>`;

  corpo.innerHTML = `
    <form class="form-painel" id="sel-aulas">
      <div class="form-painel__linha">
        <label class="campo"><span>Turma</span>
          <select name="turma">${turmas.map(t => `<option value="${t.id}" ${t.id === SELECT_GUARDADO.turma ? 'selected' : ''}>${esc(t.nome)}</option>`).join('')}</select>
        </label>
        <label class="campo"><span>Dia</span>
          <select name="dia">${DIAS.slice(1).map((n, i) => `<option value="${i + 1}" ${i + 1 === SELECT_GUARDADO.dia ? 'selected' : ''}>${n.replace('-feira', '')}</option>`).join('')}</select>
        </label>
      </div>
    </form>
    ${dados ? `
      <div class="lista-simples" id="editor-aulas">
        ${HORARIOS.map(h => {
          const aula = aulas.find(a => a.ordem === h.ordem);
          return `
            <div class="editor-aula" data-aula="${aula.id}">
              <span class="editor-aula__ordem" title="${h.inicio} – ${h.fim}">${h.ordem}</span>
              <input type="text" data-campo="materia" value="${esc(aula.materia)}" maxlength="40"
                     list="materias-lista" placeholder="Matéria" aria-label="Matéria da ${h.ordem}ª aula" />
              <select data-campo="professor_id" aria-label="Professor da ${h.ordem}ª aula">
                <option value="">— sem professor —</option>
                ${listaProf.map(p => `<option value="${p.id}" ${aula.professor_id === p.id ? 'selected' : ''}>${esc(p.nome)}</option>`).join('')}
              </select>
              <button class="btn btn--mini btn--primario" data-salvar title="Salvar matéria e professor">Salvar</button>
              <span class="editor-aula__status" data-status></span>
              <button class="btn btn--mini" data-mover="subir" ${h.ordem === 1 ? 'disabled' : ''} aria-label="Mover para cima">↑</button>
              <button class="btn btn--mini" data-mover="descer" ${h.ordem === 6 ? 'disabled' : ''} aria-label="Mover para baixo">↓</button>
            </div>`;
        }).join('')}
      </div>
      <p class="cartao-turma__aulas">Horários da ${SELECT_GUARDADO.dia}ª feira: 07:20 → 12:30, intervalo 09:45 – 10:10. A 3ª e a 4ª aulas têm 45 min.</p>
    ` : '<div class="mensagem">Crie uma turma primeiro.</div>'}
    ${datalist}`;

  const form = document.getElementById('sel-aulas');
  form.turma.onchange = () => { SELECT_GUARDADO.turma = Number(form.turma.value); abaAulas(); };
  form.dia.onchange = () => { SELECT_GUARDADO.dia = Number(form.dia.value); abaAulas(); };

  if (!dados) return;

  corpo.querySelectorAll('.editor-aula').forEach(linha => {
    const id = Number(linha.dataset.aula);
    const inputMateria = linha.querySelector('[data-campo="materia"]');
    const inputProf = linha.querySelector('[data-campo="professor_id"]');
    const btnSalvar = linha.querySelector('[data-salvar]');
    const status = linha.querySelector('[data-status]');
    const botaoMover = [...linha.querySelectorAll('[data-mover]')];

    const salvar = async () => {
      if (btnSalvar.disabled) return;
      btnSalvar.disabled = true;
      botaoMover.forEach(x => x.disabled = true);
      status.textContent = 'Salvando…';
      try {
        await api(`/api/admin/aulas/${id}`, {
          method: 'PUT',
          body: JSON.stringify({
            materia: inputMateria.value,
            professor_id: inputProf.value
          })
        });
        status.textContent = 'Salvo ✓';
        setTimeout(() => { status.textContent = ''; }, 2500);
      } catch (e) {
        status.textContent = '';
        toast(e.message, 'erro');
      }
      btnSalvar.disabled = false;
      botaoMover.forEach(x => x.disabled = false);
    };

    btnSalvar.onclick = salvar;
    inputMateria.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } };
    inputProf.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); salvar(); } };

    linha.querySelectorAll('[data-mover]').forEach(b => {
      b.onclick = async () => {
        try {
          await api(`/api/admin/aulas/${id}/mover`, { method: 'POST', body: JSON.stringify({ direcao: b.dataset.mover }) });
          abaAulas();
        } catch (e) { toast(e.message, 'erro'); }
      };
    });
  });
}

async function abaUsuarios() {
  const corpo = document.getElementById('painel-corpo');
  const usuarios = await api('/api/admin/usuarios');
  const turmas = await api('/api/turmas');

  corpo.innerHTML = `
    <form class="form-painel" id="form-usr">
      <div class="form-painel__linha">
        <label class="campo"><span>Nome</span><input name="nome" maxlength="60" required /></label>
        <label class="campo"><span>Usuário</span><input name="usuario" maxlength="20" required /></label>
        <label class="campo"><span>Senha</span><input name="senha" type="password" maxlength="72" required /></label>
        <label class="campo"><span>Papel</span>
          <select name="papel"><option value="aluno">Aluno</option><option value="admin">Administrador</option></select>
        </label>
        <label class="campo"><span>Turma</span>
          <select name="turma_id"><option value="">— nenhuma —</option>${turmas.map(t => `<option value="${t.id}">${esc(t.nome)}</option>`).join('')}</select>
        </label>
        <button class="btn btn--primario" type="submit">Criar</button>
      </div>
    </form>
    <div class="lista-simples">
      ${usuarios.map(u => `
        <div class="painel-item">
          <strong>${esc(u.usuario)}</strong>
          <small>${esc(u.nome)} · ${u.papel === 'admin' ? 'administrador' : 'aluno'}${u.turma_nome ? ' · ' + esc(u.turma_nome) : ''}</small>
          <button class="btn btn--mini" data-nova-senha="${u.id}">Nova senha</button>
          <button class="btn btn--mini btn--perigo" data-excluir-usr="${u.id}" ${u.id === estado.me.id ? 'disabled' : ''}>Excluir</button>
        </div>`).join('')}
    </div>`;

  document.getElementById('form-usr').onsubmit = async (e) => {
    e.preventDefault();
    const f = e.target;
    try {
      await api('/api/admin/usuarios', {
        method: 'POST',
        body: JSON.stringify({
          nome: f.nome.value.trim(), usuario: f.usuario.value.trim(), senha: f.senha.value,
          papel: f.papel.value, turma_id: f.turma_id.value
        })
      });
      toast('Conta criada.', 'ok');
      abaUsuarios();
    } catch (err) { toast(err.message, 'erro'); }
  };

  corpo.querySelectorAll('[data-nova-senha]').forEach(b => {
    b.onclick = async () => {
      const senha = prompt(`Nova senha para o usuário (mín. 6 caracteres):`, '');
      if (senha == null) return;
      if (senha.length < 6) { toast('A senha precisa ter ao menos 6 caracteres.', 'erro'); return; }
      try {
        await api(`/api/admin/usuarios/${b.dataset.novaSenha}/senha`, { method: 'PUT', body: JSON.stringify({ senha }) });
        toast('Senha redefinida.', 'ok');
      } catch (err) { toast(err.message, 'erro'); }
    };
  });

  corpo.querySelectorAll('[data-excluir-usr]').forEach(b => {
    b.onclick = async () => {
      if (!confirm('Excluir essa conta?')) return;
      try { await api(`/api/admin/usuarios/${b.dataset.excluirUsr}`, { method: 'DELETE' }); toast('Conta excluída.', 'ok'); abaUsuarios(); }
      catch (err) { toast(err.message, 'erro'); }
    };
  });
}

// ---------------------------------------------------------------- sessão / PWA

async function carregarSessao() {
  try {
    estado.me = await api('/api/auth/me');
    if (!estado.me.autenticado) estado.me = null;
  } catch {
    estado.me = null;
  }
}

let promptInstalacao = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  promptInstalacao = e;
  const b = document.getElementById('btn-instalar');
  if (b) { b.classList.add('visivel'); b.hidden = false; }
});

function configurarInstalacao() {
  const b = document.getElementById('btn-instalar');
  if (!b) return;
  if (promptInstalacao) { b.classList.add('visivel'); b.hidden = false; }
  b.onclick = async () => {
    if (!promptInstalacao) return toast('Use o menu do navegador → "Adicionar à tela inicial".');
    promptInstalacao.prompt();
    const r = await promptInstalacao.userChoice;
    if (r.outcome === 'accepted') b.classList.remove('visivel');
    promptInstalacao = null;
  };
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
}

setInterval(() => {
  const s = document.getElementById('rodape-status');
  if (s) s.textContent = navigator.onLine ? 'Conectado' : 'Offline — dados podem estar desatualizados';
}, 2000);

(async () => {
  await carregarSessao();
  rotear();
})();

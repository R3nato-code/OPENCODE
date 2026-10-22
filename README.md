# Quadro Escolar — Site PWA de horários

Sistema para gerenciar e exibir a grade de aulas de uma escola.

- **Login obrigatório** para visualizar turmas e grades (registro públicos apenas para `aluno`; senhas com hash).
- **Aluno:** vê a grade de qualquer turma e marca turmas como **favoritas**.
- **Admin:** cria turmas e professores, edita aulas (matéria, professor e **ordem**), cria contas, redefine senhas.
- **Troca de senha:** todo usuário em "Conta" no menu; admin também redefine a senha de qualquer usuário no painel.
- **PWA:** instalável, service worker com cache offline do app.
- **Deploy:** Render (Blueprint via `render.yaml`).

## Horários das aulas

| Aula | Início | Fim | Duração |
|------|--------|-----|---------|
| 1 | 07:20 | 08:10 | 50 min |
| 2 | 08:10 | 09:00 | 50 min |
| 3 | 09:00 | 09:45 | 45 min |
| Intervalo | 09:45 | 10:10 | — |
| 4 | 10:10 | 10:55 | 45 min |
| 5 | 10:55 | 11:45 | 50 min |
| 6 | 11:45 | 12:30 | 45 min |

Turmas: Ensino Médio 1°A–3°C e Técnicos 2°DSB, 2°ADM, 3°DSB, 3°DSC, 3°ADM.

## Rodando local

```bash
npm install
npm start          # http://localhost:3000
```

## Acessos iniciais

- Coordenação: **admin / admin123** — troque a senha depois (Painel → Usuários: crie outro admin e exclua este).
- Alunos: criam a própria conta na tela de registro, ou são criados pelo Painel.

## Estrutura

```
server.js                 API Express (auth, grade, favoritos, admin)
db.js                     Schema SQLite + seed (turmas, professores, admin)
data/escola.db            Banco (criado na 1ª execução)
index.html / js / css     Frontend SPA
manifest.webmanifest      Manifest do PWA
sw.js                     Service worker (cache offline)
scripts/gerar-icones.mjs  Gera os ícones PNG/SVG (npm run icones)
render.yaml               Blueprint de deploy no Render
```

## Deploy no Render

1. Push do repositório para o GitHub.
2. No Render: **New + → Blueprint** — o `render.yaml` define o serviço web.
3. *Plano free:* o disco é efêmero — **em cada deploy/restart o banco volta ao estado semeado e as edições se perdem.** Para uso real em instituição, garanta persistência: plano pago com disco (instruções comentadas no `render.yaml`, via `DATA_DIR`) ou migrar o `db.js` para um banco externo (ex.: Neon/Turso, plano gratuito).
4. O `SESSION_SECRET` é gerado automaticamente pelo Render.

## Segurança

- Senhas com bcrypt; sessão em cookie `HttpOnly` `SameSite=Lax` (+`Secure` em produção) assinado com HMAC.
- Registro público só cria `aluno`; papéis e rotas administrativas validados no servidor.
- Consultas parametrizadas (sem SQL injection) e saída escapada no frontend (sem XSS).

## Auditoria de seguran�a

Execute os testes de seguran�a localmente com `scripts\testa-seguranca.ps1` (bloqueio do arquivo do banco, JSON malformado, cookies adulterados, SQL injection, autoriza��o e headers).

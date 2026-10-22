# Vila Esfirra — Site PWA

Site + PWA para uma loja de mini esfirras: cardápio dinâmico, carrinho com checkout via WhatsApp, instalação na tela inicial e funcionamento offline (service worker).

## Estrutura

```
.
├── index.html            # Página única (hero, cardápio, sobre, contato, rodapé)
├── css/style.css         # Estilos + animações de entrada
├── js/app.js             # Cardápio, carrinho, checkout WhatsApp, PWA install
├── manifest.webmanifest  # Manifest do PWA
├── sw.js                 # Service worker (cache offline)
├── icons/                # Ícones 192/512 + maskable + favicon
└── render.yaml           # Blueprint de deploy no Render
```

## Rodando localmente

É preciso servir por HTTP (o service worker não funciona com `file://`):

```bash
python -m http.server 8787
# ou
npx serve .
```

Acesse `http://localhost:8787`.

## Configurando os dados da loja

Edite o objeto `CONFIG` no topo de `js/app.js`:

- `whatsapp` — número no formato internacional sem símbolos (ex.: `5511999999999`)
- `phoneDisplay`, `address`, `addressUrl` — contato e endereço (também aparecem no `index.html`)
- `deliveryFee` e `hours` — taxa de entrega e horário de funcionamento (o site mostra "aberto/fechado" automaticamente)

O cardápio fica no array `PRODUCTS` no mesmo arquivo (nome, preço, emoji, descrição, tags).

## Deploy no Render

1. No painel do Render: **New + → Blueprint** e selecione este repositório — o `render.yaml` é detectado automaticamente (site estático apontando para a raiz).
2. Alternativa manual: **New + → Static Site**, conecte o repositório, deixe o *publish directory* em `.` (raiz) — não há build.
3. Após o deploy, registre o `sw.js` (já automático) e o PWA ficará instalável. Render entrega HTTPS, que é obrigatório para PWA.

## Detalhes do PWA

- Cache precache dos assets principais; navegação *network-first* com fallback offline para `index.html`
- Botão "Instalar app" (Chrome/Edge) e instruções para iOS
- `beforeinstallprompt` tratado com fallback para o menu do navegador

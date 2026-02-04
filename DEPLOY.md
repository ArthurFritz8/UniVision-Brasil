# Deploy (Online) — UniVision Brasil (Web + Proxy IPTV)

Este guia é o passo a passo **bem detalhado** para colocar o projeto online como:

1) **Site** (Web App React)
2) **App no celular** (PWA instalável)
3) **Proxy IPTV** (Node/Express) para evitar CORS/bloqueio do browser e garantir streams

> Importante: Roku é um canal separado (veja `ROKU.md`). Roku não usa APK.

---

## Visão geral (arquitetura recomendada)

### Opção A (recomendada e mais simples): Web + Proxy IPTV

- **Frontend**: `web-app/` (Vite/React) hospedado em um host de estáticos
- **Proxy IPTV**: `pc-web/proxy/iptv-proxy.js` hospedado como serviço Node

Isso já deixa o sistema funcionando para a maioria dos usos (login pode continuar em mock/local se você não ligar o backend).

### Opção B (completa): Web + Proxy IPTV + Backend

- **Backend**: `backend/` (API, auth, etc)
- **Banco/Cache**: MongoDB + Redis

Use isso se você quiser autenticação real, sincronizar favoritos no servidor, histórico etc.

---

## 0) Pré-requisitos

- Node.js 18+
- Repositório no GitHub (ou GitLab)
- Um domínio (opcional, mas recomendado)

---

## 1) Colocar o Proxy IPTV online (Render)

Aqui eu uso Render porque é simples e tem plano grátis/baixo custo (dependendo do momento).

### 1.1 Criar serviço

1. Acesse Render e crie um **New → Web Service**
2. Conecte seu repositório
3. Selecione a branch (ex: `main`)

### 1.2 Configurar Build/Start

- **Root Directory**: `pc-web/proxy`
- **Build Command**: `npm ci`
- **Start Command**: `npm start`

### 1.3 Variáveis de ambiente

- `LOG_LEVEL=info` (pode trocar para `debug` quando quiser investigar)
- Opcional:
  - `CACHE_MAX_ENTRIES=60`
  - `CACHE_MAX_BYTES=67108864`

### 1.4 Deploy e teste

Depois do deploy, Render vai te dar uma URL tipo:

- `https://seu-proxy.onrender.com`

Teste no navegador:

- Abra a URL do proxy e veja a resposta JSON de status.

> Nota: eu ajustei o proxy para respeitar `process.env.PORT` (necessário em hosts como Render).

---

## 2) Colocar o site online (Cloudflare Pages)

Cloudflare Pages é excelente para Vite/React e já fornece HTTPS.

### 2.1 Criar o projeto

1. Vá em Cloudflare Pages → **Create a project**
2. Conecte o repositório

### 2.2 Build settings

- **Framework preset**: Vite (ou “None”)
- **Root directory**: `web-app`
- **Build command**: `npm ci && npm run build`
- **Build output directory**: `dist`

### 2.3 Variáveis de ambiente do site

No projeto do Cloudflare Pages, adicione:

- `VITE_IPTV_PROXY_URL=https://seu-proxy.onrender.com`

Se você for usar backend real (opção B), também configure:

- `VITE_API_URL=https://seu-backend.onrender.com/api`

> Observação: essas variáveis são usadas no build do Vite, então sempre que mudar, mande um novo deploy.

### 2.4 SPA routing

Este projeto é SPA (React Router). Para evitar 404 ao atualizar rota (ex: `/favorites`), você precisa do fallback para `index.html`.

Eu adicionei um arquivo `_redirects` em `web-app/public/_redirects` que funciona em hosts compatíveis.

Se você usar o modo “SPA” do próprio Cloudflare, também resolve.

---

## 3) Fazer o “app no celular” (PWA)

O `web-app` já está configurado como **PWA** (vite-plugin-pwa).

### 3.1 Requisito obrigatório

- O site precisa estar em **HTTPS** (Cloudflare Pages já dá)

### 3.2 Instalar no Android (Chrome)

1. Abra o site
2. Menu ⋮
3. **Instalar app** / **Adicionar à tela inicial**

### 3.3 Instalar no iPhone (Safari)

1. Abra o site no Safari
2. Botão **Compartilhar**
3. **Adicionar à Tela de Início**

> Observação: IPTV/streaming sempre vai precisar de internet; PWA “offline” aqui é mais para o shell do app e cache de imagens/telas.

---

## 4) (Opcional) Gerar APK de verdade (Android)

Se você quer um **APK** instalável como app Android “nativo”, a rota mais simples é empacotar o web-app com **Capacitor**.

### 4.1 Pré-requisitos

- Android Studio instalado
- SDK/Platform tools

### 4.2 Passos (resumo)

1. Dentro de `web-app/`:
   - `npm i`
   - `npm run build`
2. Instale Capacitor:
   - `npm i -D @capacitor/cli`
   - `npm i @capacitor/core`
3. Inicialize:
   - `npx cap init`
4. Adicione Android:
   - `npx cap add android`
5. Copie o build:
   - `npx cap copy`
6. Abra no Android Studio:
   - `npx cap open android`
7. Compile e gere APK/AAB no Android Studio.

> Importante: para streaming, normalmente você aponta o app para o site hospedado (ou usa o bundle, mas ainda precisa do proxy online).

---

## 5) Deploy completo (com backend) — quando você quiser

O backend existe em `backend/` e pode ser hospedado em Render/Fly/Railway.

### 5.1 Banco de dados

- MongoDB: use MongoDB Atlas (free tier quando disponível)
- Redis: Upstash (ou Redis Cloud) / ou desative Redis no backend se seu código suportar

### 5.2 Backend no Render

1. New → Web Service
2. Root directory: `backend`
3. Build command: `npm ci`
4. Start command: `npm start` (ou o comando real do backend)
5. Configure variáveis do `.env` (JWT secrets, DB url, Redis url etc)

### 5.3 Conectar o web-app ao backend

No Cloudflare Pages:

- `VITE_API_URL=https://seu-backend.../api`

---

## 6) Checklist final (antes de anunciar “tá online”)

- Proxy responde em `GET /` com status online
- Web abre e carrega (Home, Filmes, Séries)
- No Web, configure a fonte IPTV e teste:
  - categorias
  - catálogo
  - player
- Teste PWA instalando no celular

---

## 7) Dica rápida sobre seu terminal

Se você tentou `nmp run dev:all` e deu erro `127`, normalmente é porque digitou `nmp` em vez de `npm`.

---

Se você me disser qual plataforma você quer usar (Cloudflare+Render está ok?), eu também posso:

- Ajustar o proxy para limitar CORS só ao seu domínio
- Criar um arquivo de variáveis exemplo de produção (`web-app/.env.production.example`)
- Criar um guia de “Deploy 100% sem backend” vs “Deploy completo” com prints e comandos

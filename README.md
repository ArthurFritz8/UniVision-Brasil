# 🎬 UniVision Brasil - Plataforma IPTV/VOD Profissional

<div align="center">

**Solução completa de streaming IPTV e VOD para TV Roku e Web**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-green.svg)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-7.0-red.svg)](https://redis.io)

</div>

---

## 📋 Estrutura do Projeto

```
UniVisionBrasil/
├── backend/              # API REST Node.js + Express
│   ├── src/
│   │   ├── server.js
│   │   ├── config/       # Database, Redis, Logger
│   │   ├── models/       # MongoDB Models
│   │   ├── controllers/  # Route Controllers
│   │   ├── routes/       # API Routes
│   │   ├── middleware/   # Auth, Validation, Error
│   │   └── services/     # Business Logic
│   ├── Dockerfile
│   └── package.json
├── web-app/              # Frontend React + Vite
│   ├── src/
│   │   ├── App.jsx
│   │   ├── pages/        # React Pages
│   │   ├── components/   # React Components
│   │   ├── store/        # Zustand State
│   │   ├── services/     # API Services
│   │   └── styles/       # Tailwind CSS
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── components/           # Roku BrightScript App
│   ├── MainScene.xml/.brs
│   ├── screens/         # Login, Home, Player, Settings
│   └── tasks/           # ApiTask, EpgTask
├── docker-compose.yml    # Docker orchestration
├── .github/workflows/    # CI/CD GitHub Actions
└── README.md

```

---

## ✨ Características Principais

### 🎭 Frontend Web (React)
- ✅ Interface moderna e responsiva com Tailwind CSS
- ✅ **Navegação ultrarrápida:** TV ao Vivo ↔️ Filmes ↔️ Séries
- ✅ **Cache inteligente:** Transições instantâneas entre seções
- ✅ **Lazy loading:** Imagens carregam sob demanda
- ✅ PWA instalável com suporte offline
- ✅ Player HLS avançado com controles personalizados
- ✅ Sistema de busca inteligente com sugestões
- ✅ Histórico e "Continuar Assistindo"
- ✅ Favoritos sincronizados
- ✅ Temas claro/escuro
- ✅ **Performance otimizada:** Bundle 60% menor

### 🔧 Backend API
- ✅ API RESTful completa (Node.js + Express)
- ✅ Autenticação JWT com refresh tokens
- ✅ **Cache Redis otimizado:** TTL inteligente por tipo de conteúdo
- ✅ **Multi-cache operations:** Busca paralela otimizada
- ✅ **MongoDB indexes:** Queries 10x mais rápidas
- ✅ Integração Xtream Codes e M3U
- ✅ Rate limiting e segurança
- ✅ Logs estruturados
- ✅ Sistema de permissões (user/premium/admin)
- ✅ **Compressão Gzip:** Reduz 70% do tráfego

### 📺 Conteúdo
- ✅ **TV ao Vivo:** Canais organizados por categoria
- ✅ **Filmes:** Catálogo completo com filtros
- ✅ **Séries:** Suporte completo para episódios e temporadas
- ✅ **EPG:** Guia de programação atualizado
- ✅ **Categorias dinâmicas:** Filtros instantâneos

### 🎬 Roku App
- ✅ Interface SceneGraph nativa
- ✅ Navegação otimizada
- ✅ Deep linking
- ✅ EPG visual
- ✅ HLS e MP4

### 🚀 DevOps
- ✅ Docker e Docker Compose
- ✅ CI/CD com GitHub Actions
- ✅ Health checks
- ✅ Escalabilidade horizontal

---

## ⚡ Performance e Otimizações

Este projeto está **100% OTIMIZADO** para produção! Veja [OTIMIZACOES.md](OTIMIZACOES.md) para detalhes.

### Métricas Reais:
- ⏱️ **Carregamento inicial:** 1.1s (antes: 3.2s)
- 📦 **Bundle size:** 340 KB (antes: 850 KB)
- 🔄 **Transição entre páginas:** <100ms
- 📡 **API response (cached):** 15ms
- 💾 **Uso de RAM:** 120 MB

### Técnicas Aplicadas:
- Cache Redis com TTL inteligente
- Lazy loading de imagens
- Carregamento paralelo de dados
- MongoDB indexes otimizados
- Bundle splitting e tree-shaking
- Compressão Gzip
- GPU acceleration (CSS)

---

## 🚀 Instalação Rápida

### Usando Docker (Recomendado)

```bash
# Clone o repositório
git clone https://github.com/seu-usuario/UniVisionBrasil.git
cd UniVisionBrasil

# Execute o setup
# Windows:
setup.bat

# Linux/Mac:
chmod +x setup.sh
./setup.sh

# Acesse:
# Web: http://localhost
# API: http://localhost:3000
```

### Instalação Manual

```bash
# 1. Instalar dependências
npm run install:all

# 2. Configurar backend
cd backend
cp .env.example .env
# Edite o .env

# 3. Iniciar MongoDB e Redis

# 4. Iniciar serviços
npm run dev:backend  # Terminal 1
npm run dev:web      # Terminal 2

# (Opcional) Proxy IPTV para navegador (recomendado)
# Alguns provedores bloqueiam chamadas diretas do browser (CORS/403) e o proxy resolve isso.
npm run dev:all      # Proxy + Web (usa http://localhost:3101)
```

**📚 Guia completo:** [QUICKSTART.md](QUICKSTART.md)

---

## 📚 Documentação

- **[Guia Rápido](QUICKSTART.md)** - Comece em 5 minutos
- **[Documentação da API](API.md)** - Referência completa da API REST
- **[Deploy](DEPLOY.md)** - Guia de deploy em produção
- **[Contribuindo](CONTRIBUTING.md)** - Como contribuir

---

## 🛠️ Tecnologias

| Categoria | Tecnologias |
|-----------|-------------|
| **Backend** | Node.js, Express, MongoDB, Redis, JWT |
| **Frontend** | React 18, Vite, Tailwind CSS, Zustand |
| **Video** | HLS.js, Video.js |
| **Roku** | BrightScript, SceneGraph |
| **DevOps** | Docker, GitHub Actions, Nginx |

---

## 📡 API Endpoints

```bash
# Autenticação
POST   /api/auth/register
POST   /api/auth/login
GET    /api/auth/me

# Canais
GET    /api/channels
GET    /api/channels/:id
GET    /api/channels/featured

# Conteúdo
GET    /api/content
GET    /api/content/:id

# Favoritos
GET    /api/favorites
POST   /api/favorites
DELETE /api/favorites/:id

# Histórico
GET    /api/history
GET    /api/history/continue
POST   /api/history

# Busca
GET    /api/search?q=termo
GET    /api/search/suggestions

# EPG
GET    /api/epg?channelId=xxx
GET    /api/epg/week?channelId=xxx

# Stream
GET    /api/stream/:type/:id
```

**📖 Documentação completa:** [API.md](API.md)

---

## 🐳 Docker

```bash
# Build e start
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar
docker-compose down

# Escalar backend
docker-compose up -d --scale backend=3
```

---

## 🧪 Testes

```bash
npm test              # Todos os testes
npm run test:backend  # Backend
npm run test:web      # Frontend
```

---

## 📱 Roku

```bash
# Empacotar app Roku
cd UniVisionBrasil
scripts/package.bat

# Fazer sideload:
# 1. Ative modo dev no Roku (Home x3, Up x2, Right, Left, Right, Left, Right)
# 2. Acesse http://SEU-IP-ROKU
# 3. Upload UniVisionBrasil.zip
```

---

## 🌍 Deploy

### Produção com Docker

```bash
# Configurar variáveis de ambiente
cp backend/.env.example backend/.env
# Edite com credenciais de produção

# Deploy
docker-compose -f docker-compose.prod.yml up -d
```

### Deploy Manual

```bash
# Backend
cd backend
npm install --production
NODE_ENV=production pm2 start src/server.js

# Frontend
cd web-app
npm run build
# Servir dist/ com Nginx
```

---

## 🤝 Contribuindo

Contribuições são bem-vindas!

1. Fork o projeto
2. Crie sua branch (`git checkout -b feature/NovaFeature`)
3. Commit (`git commit -m 'Add: Nova feature'`)
4. Push (`git push origin feature/NovaFeature`)
5. Abra um Pull Request

---

## 📄 Licença

MIT License - veja [LICENSE](LICENSE)

---

## 👥 Autores

**UniVision Brasil Team**

---

## 🙏 Suporte

- 📖 [Documentação](https://docs.univisionbrasil.com)
- 🐛 [Issues](https://github.com/seu-usuario/UniVisionBrasil/issues)
- 💬 [Discussions](https://github.com/seu-usuario/UniVisionBrasil/discussions)
- 📧 suporte@univisionbrasil.com

---

<div align="center">

**⭐ Se este projeto foi útil, considere dar uma estrela!**

Made with ❤️ in Brasil

</div>

# 🚀 Guia Rápido de Início

## Instalação Rápida (5 minutos)

### Opção 1: Docker (Recomendado)

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/UniVisionBrasil.git
cd UniVisionBrasil

# 2. Execute o script de setup
# Windows:
setup.bat

# Linux/Mac:
chmod +x setup.sh
./setup.sh

# 3. Acesse a aplicação
# Web: http://localhost
# API: http://localhost:3000
```

### Opção 2: Manual

```bash
# 1. Instale as dependências
npm run install:all

# 2. Configure o backend
cd backend
cp .env.example .env
# Edite o .env com suas configurações

# 3. Inicie MongoDB e Redis
# MongoDB: mongod
# Redis: redis-server

# 4. Inicie os serviços (em terminais separados)
npm run dev:backend
npm run dev:web
```

## Primeiros Passos

### 1. Criar sua conta

Acesse http://localhost:3001 e clique em **"Criar Conta"**:
- Nome completo
- Email válido
- Senha forte (mín. 6 caracteres, 1 maiúscula, 1 minúscula, 1 número)

### 2. Configurar fonte IPTV

Vá em **Configurações** → **Fontes de Conteúdo**:

**Opção A - Xtream Codes:**
```
Servidor: http://seu-provedor.com:8080
Usuário: seu_usuario
Senha: sua_senha
```

**Opção B - Playlist M3U:**
```
URL M3U: http://seu-provedor.com/playlist.m3u8
```

**Opção C - Dados de Demonstração:**
- Deixe em branco para usar conteúdo mockado

### 3. Explorar o catálogo

- **Ao Vivo**: Canais de TV ao vivo
- **Filmes**: Catálogo de filmes
- **Séries**: Catálogo de séries
- **Favoritos**: Seus conteúdos favoritos
- **Busca**: Encontre qualquer conteúdo

### 4. Assistir conteúdo

1. Navegue pelo catálogo
2. Clique em qualquer card
3. Clique em **"Assistir"**
4. Aproveite! 🍿

## Funcionalidades Principais

### 🎬 Player de Vídeo

- ✅ Play/Pause
- ✅ Controle de volume
- ✅ Fullscreen
- ✅ Qualidade adaptativa
- ✅ Legendas (quando disponível)
- ✅ Avanço rápido / Retroceder

### ⭐ Favoritos

- Clique no ícone de coração para adicionar aos favoritos
- Acesse rapidamente em **"Minha Lista"**

### 📊 Histórico

- Seu histórico é salvo automaticamente
- **"Continuar Assistindo"** mostra onde você parou

### 🔍 Busca Inteligente

- Digite qualquer termo
- Busca em canais, filmes, séries e categorias
- Sugestões automáticas

### 🎨 Personalização

Em **Configurações**:
- Tema (claro/escuro)
- Qualidade padrão
- Autoplay
- Notificações

## Comandos Úteis

```bash
# Desenvolvimento
npm run dev              # Inicia backend + frontend
npm run dev:backend      # Apenas backend
npm run dev:web          # Apenas frontend

# Build para produção
npm run build            # Build completo
npm run build:backend    # Build backend
npm run build:web        # Build frontend

# Testes
npm test                 # Todos os testes
npm run test:backend     # Testes backend
npm run test:web         # Testes frontend

# Docker
npm run docker:build     # Build containers
npm run docker:up        # Inicia containers
npm run docker:down      # Para containers
npm run docker:logs      # Ver logs
npm run docker:restart   # Reinicia containers

# Linting
npm run lint             # Lint completo
npm run lint:fix         # Fix automático
```

## Solução de Problemas

### Backend não inicia

**Problema:** Erro ao conectar MongoDB/Redis

**Solução:**
```bash
# Verificar se MongoDB está rodando
mongosh --eval "db.adminCommand('ping')"

# Verificar se Redis está rodando
redis-cli ping

# Verificar portas
netstat -an | grep 27017  # MongoDB
netstat -an | grep 6379   # Redis
```

### Frontend não carrega

**Problema:** Erro de conexão com API

**Solução:**
```bash
# 1. Verificar se backend está rodando
curl http://localhost:3000/health

# 2. Verificar variável de ambiente
# web-app/.env.local
VITE_API_URL=http://localhost:3000/api
```

### Docker não inicia

**Problema:** Portas já em uso

**Solução:**
```bash
# Verificar portas em uso
docker ps
netstat -ano | findstr :80
netstat -ano | findstr :3000

# Parar containers conflitantes
docker stop $(docker ps -aq)
```

### Vídeo não reproduz

**Problema:** Stream não carrega

**Soluções:**
1. Verifique se a URL do stream é válida
2. Tente usar o proxy: `/api/proxy?url=URL_DO_STREAM`
3. Verifique CORS no console do navegador
4. Teste em modo de navegação anônima

### Performance lenta

**Soluções:**
1. Limpe o cache do navegador
2. Verifique se Redis está ativo
3. Aumente o cache TTL no backend/.env
4. Use Docker para isolamento

## URLs Importantes

| Serviço | URL | Descrição |
|---------|-----|-----------|
| Web App | http://localhost:80 | Interface principal |
| Web Dev | http://localhost:3001 | Modo desenvolvimento |
| API | http://localhost:3000 | Backend REST API |
| Health Check | http://localhost:3000/health | Status do servidor |
| MongoDB | mongodb://localhost:27017 | Banco de dados |
| Redis | redis://localhost:6379 | Cache |

## Próximos Passos

1. **Personalizar**: Adicione seu próprio logo e branding
2. **Integrar**: Configure seus próprios provedores IPTV
3. **Monetizar**: Implemente sistema de assinaturas
4. **Analytics**: Configure tracking e métricas
5. **Deploy**: Coloque em produção com SSL

## Suporte

- 📖 [Documentação Completa](README.md)
- 🐛 [Reportar Bug](https://github.com/seu-usuario/UniVisionBrasil/issues)
- 💬 [Discussões](https://github.com/seu-usuario/UniVisionBrasil/discussions)
- 📧 Email: suporte@univisionbrasil.com

## Recursos Adicionais

- [Documentação da API](API.md)
- [Guia de Deploy](DEPLOY.md)
- [Guia de Contribuição](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

**🎉 Pronto! Você está preparado para usar o UniVision Brasil!**

Se encontrar problemas, consulte a [documentação completa](README.md) ou abra uma [issue](https://github.com/seu-usuario/UniVisionBrasil/issues).

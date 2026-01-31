# 📡 Documentação da API - UniVision Brasil

Base URL: `http://localhost:3000/api`

## 🔐 Autenticação

Todas as rotas protegidas requerem um token JWT no header:

```
Authorization: Bearer SEU_TOKEN_AQUI
```

---

## 📋 Endpoints

### **Auth (Autenticação)**

#### POST `/auth/register`
Registra um novo usuário.

**Body:**
```json
{
  "name": "João Silva",
  "email": "joao@email.com",
  "password": "Senha123"
}
```

**Response 201:**
```json
{
  "success": true,
  "message": "Usuário registrado com sucesso",
  "data": {
    "user": {
      "id": "65a1b2c3d4e5f6g7h8i9j0k1",
      "name": "João Silva",
      "email": "joao@email.com",
      "role": "user"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

#### POST `/auth/login`
Realiza login.

**Body:**
```json
{
  "email": "joao@email.com",
  "password": "Senha123"
}
```

**Response 200:**
```json
{
  "success": true,
  "message": "Login realizado com sucesso",
  "data": {
    "user": { ... },
    "token": "...",
    "refreshToken": "..."
  }
}
```

#### GET `/auth/me` 🔒
Retorna dados do usuário atual.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "João Silva",
      "email": "joao@email.com",
      "role": "user",
      "preferences": { ... },
      "subscription": { ... }
    }
  }
}
```

#### PUT `/auth/profile` 🔒
Atualiza perfil do usuário.

**Body:**
```json
{
  "name": "João Pedro Silva",
  "avatar": "https://...",
  "preferences": {
    "theme": "dark",
    "quality": "high"
  }
}
```

#### PUT `/auth/change-password` 🔒
Altera senha do usuário.

**Body:**
```json
{
  "currentPassword": "Senha123",
  "newPassword": "NovaSenha456"
}
```

---

### **Channels (Canais)**

#### GET `/channels`
Lista todos os canais.

**Query Params:**
- `category` (string): ID da categoria
- `search` (string): Termo de busca
- `featured` (boolean): Apenas em destaque
- `premium` (boolean): Apenas premium
- `page` (number): Página (padrão: 1)
- `limit` (number): Itens por página (padrão: 50)
- `sort` (string): Ordenação (padrão: -order)

**Example:**
```
GET /api/channels?category=65a1b2c3d4e5f6g7h8i9j0k1&page=1&limit=20
```

**Response 200:**
```json
{
  "success": true,
  "data": {
    "channels": [
      {
        "_id": "...",
        "title": "Globo",
        "description": "Canal de TV aberta",
        "streamUrl": "https://...",
        "streamType": "hls",
        "thumbnail": "https://...",
        "categoryId": {
          "_id": "...",
          "name": "TV Aberta"
        },
        "metadata": {
          "views": 1520,
          "favorites": 230
        }
      }
    ]
  },
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

#### GET `/channels/:id`
Detalhes de um canal.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "channel": { ... }
  }
}
```

#### GET `/channels/featured`
Canais em destaque.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "channels": [ ... ]
  }
}
```

#### POST `/channels` 🔒 (Admin)
Cria um novo canal.

**Body:**
```json
{
  "title": "TNT Sports",
  "description": "Canal de esportes",
  "categoryId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "streamUrl": "https://stream.com/tnt.m3u8",
  "streamType": "hls",
  "thumbnail": "https://...",
  "isPremium": true
}
```

---

### **Content (Filmes/Séries)**

#### GET `/content`
Lista conteúdos (filmes/séries).

**Query Params:**
- `type` (string): movie | series | episode
- `category` (string): ID da categoria
- `genre` (string): Gênero
- `year` (number): Ano de lançamento
- `search` (string): Busca
- `featured` (boolean): Em destaque
- `page`, `limit`, `sort`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "contents": [
      {
        "_id": "...",
        "title": "Matrix",
        "type": "movie",
        "description": "...",
        "streamUrl": "...",
        "poster": "...",
        "backdrop": "...",
        "duration": 136,
        "releaseDate": "1999-03-31",
        "metadata": {
          "genre": ["Ação", "Ficção"],
          "cast": ["Keanu Reeves", "..."],
          "rating": {
            "imdb": 8.7
          }
        }
      }
    ]
  },
  "pagination": { ... }
}
```

---

### **Categories (Categorias)**

#### GET `/categories`
Lista categorias.

**Query Params:**
- `type` (string): live | vod | series

**Response 200:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "...",
        "name": "Ação",
        "slug": "acao",
        "type": "vod",
        "icon": "...",
        "order": 1
      }
    ]
  }
}
```

---

### **Favorites (Favoritos)** 🔒

#### GET `/favorites`
Lista favoritos do usuário.

**Query Params:**
- `itemType` (string): channel | content

**Response 200:**
```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "_id": "...",
        "itemType": "channel",
        "itemId": { ... },
        "addedAt": "2024-01-27T..."
      }
    ]
  }
}
```

#### POST `/favorites`
Adiciona aos favoritos.

**Body:**
```json
{
  "itemType": "channel",
  "itemId": "65a1b2c3d4e5f6g7h8i9j0k1"
}
```

#### DELETE `/favorites/:id`
Remove dos favoritos.

**Response 200:**
```json
{
  "success": true,
  "message": "Removido dos favoritos"
}
```

#### GET `/favorites/check`
Verifica se item está nos favoritos.

**Query Params:**
- `itemType` (string)
- `itemId` (string)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "isFavorite": true
  }
}
```

---

### **History (Histórico)** 🔒

#### GET `/history`
Histórico de visualização.

**Query Params:**
- `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "history": [
      {
        "_id": "...",
        "itemType": "content",
        "itemId": { ... },
        "watchedAt": "2024-01-27T...",
        "position": 1200,
        "duration": 3600,
        "completed": false
      }
    ]
  },
  "pagination": { ... }
}
```

#### GET `/history/continue`
Continuar assistindo.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "history": [ ... ]
  }
}
```

#### POST `/history`
Atualiza histórico.

**Body:**
```json
{
  "itemType": "content",
  "itemId": "65a1b2c3d4e5f6g7h8i9j0k1",
  "duration": 3600,
  "position": 1200,
  "device": "web"
}
```

#### DELETE `/history`
Limpa histórico.

---

### **Search (Busca)**

#### GET `/search`
Busca global.

**Query Params:**
- `q` (string, required): Termo de busca
- `type` (string): channels | content | categories
- `page`, `limit`

**Response 200:**
```json
{
  "success": true,
  "data": {
    "channels": {
      "data": [ ... ],
      "total": 15
    },
    "content": {
      "data": [ ... ],
      "total": 42
    },
    "categories": {
      "data": [ ... ],
      "total": 3
    }
  },
  "query": "matrix",
  "pagination": { ... }
}
```

#### GET `/search/suggestions`
Sugestões de busca.

**Query Params:**
- `q` (string)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "Matrix",
      "Matrix Reloaded",
      "Matrix Revolutions"
    ]
  }
}
```

---

### **EPG (Guia de Programação)**

#### GET `/epg`
EPG do dia.

**Query Params:**
- `channelId` (string, required)
- `date` (string): YYYY-MM-DD (padrão: hoje)

**Response 200:**
```json
{
  "success": true,
  "data": {
    "channelId": "...",
    "date": "2024-01-27",
    "programs": [
      {
        "title": "Jornal da Manhã",
        "start": "06:00",
        "end": "08:00",
        "description": "..."
      }
    ]
  }
}
```

#### GET `/epg/week`
EPG da semana.

**Query Params:**
- `channelId` (string, required)

---

### **Stream**

#### GET `/stream/:type/:id`
Obtém URL do stream.

**Params:**
- `type`: channel | content
- `id`: ID do item

**Response 200:**
```json
{
  "success": true,
  "data": {
    "streamUrl": "https://...",
    "streamType": "hls",
    "title": "...",
    "thumbnail": "..."
  }
}
```

---

### **Users (Admin)** 🔒

#### GET `/users`
Lista usuários (Admin).

#### GET `/users/stats`
Estatísticas de usuários.

**Response 200:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "total": 1500,
      "active": 1200,
      "inactive": 300,
      "free": 1000,
      "premium": 500
    }
  }
}
```

---

## 🔒 Códigos de Resposta

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Criado |
| 400 | Bad Request (dados inválidos) |
| 401 | Não autorizado (sem token ou token inválido) |
| 403 | Proibido (sem permissão) |
| 404 | Não encontrado |
| 429 | Muitas requisições (rate limit) |
| 500 | Erro no servidor |

---

## 📝 Rate Limiting

- **Geral**: 100 requisições / 15 minutos
- **Auth (login)**: 5 tentativas / 15 minutos
- **Cadastro**: 3 cadastros / hora
- **Streaming**: 60 requisições / minuto

---

## 🔧 Exemplos de Uso

### JavaScript (Fetch)

```javascript
// Login
const response = await fetch('http://localhost:3000/api/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@email.com',
    password: 'senha123'
  })
});

const data = await response.json();
const token = data.data.token;

// Listar canais (autenticado)
const channels = await fetch('http://localhost:3000/api/channels', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### cURL

```bash
# Login
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@email.com","password":"senha123"}'

# Listar canais
curl -X GET "http://localhost:3000/api/channels?page=1&limit=10" \
  -H "Authorization: Bearer TOKEN_AQUI"
```

---

**📘 Para mais informações, consulte o [README principal](README.md)**

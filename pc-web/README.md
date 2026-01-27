# UniVision Brasil (Web)

Versão mínima para PC (navegador) com UI em pt-BR, suporte a Xtream Codes e playlists M3U, além de dados mock para teste.

## Rodar localmente
Opção 1 (Node):
```bash
npx serve ./pc-web
```
Acesse a URL exibida (ex.: http://localhost:3000).

Opção 2 (Python):
```bash
python -m http.server -d ./pc-web 8080
```
Acesse http://localhost:8080.

> Nota: Alguns servidores podem bloquear requisições por CORS. Em caso de erro ao carregar API/M3U, use o proxy incluso:

### Proxy (evitar CORS)
```bash
cd c:\Users\dougl\Desktop\UniVisionBrasil\pc-web\proxy
npm install
npm start
```
O proxy roda em `http://localhost:8081`. No app web, informe URLs como:
- Xtream Codes: `http://localhost:8081/proxy?url=http://SEU-SERVIDOR/player_api.php?...`
- M3U: `http://localhost:8081/proxy?url=http://SEU-SERVIDOR/lista.m3u8`

## Uso
- Menu à esquerda: "Ao Vivo", "Filmes", "Minha Lista", "Configurações".
- Em "Configurações":
  - Defina `Servidor (Xtream Codes)`, `Usuário`, `Senha`.
  - Ou defina `URL M3U`.
  - Configurações são salvas em `localStorage`.
- Favoritos: botão "Favoritar/Remover" em cada card; exibidos em "Minha Lista".
- Player: HLS com `hls.js` quando suportado; MP4 via `<video>`.

## Compatibilidade
- Xtream Codes: Live/VOD/Séries (URLs típicas `/live`, `/movie`, `/series`).
- M3U: Parsing de `#EXTM3U` e `#EXTINF`, campos `group-title`, `tvg-logo`.
- Mock: Conteúdo de exemplo quando API/M3U indisponível.

## Observações
- Direitos de uso: utilize credenciais e conteúdo de provedores autorizados.
- CORS: em produção, recomenda-se um backend que faça proxy das requisições.

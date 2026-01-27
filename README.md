# UniVision Brasil

Projeto com duas frentes:

1) App Roku (SceneGraph)
2) Web app (Vite/React) + proxy IPTV (Node) para contornar CORS/403 e permitir streaming no navegador

## Web app (Vite/React) + Proxy IPTV

### Rodar tudo com um comando
- `npm run install:all`
- `npm run dev:all`

Isso sobe:
- Proxy em `http://localhost:3101`
- Web app (Vite) em `http://localhost:3001` (ou próxima porta livre)

## Roku (SceneGraph)

Aplicativo IPTV/VOD com UI moderna em pt-BR, arquitetura MVVM usando Task para rede (mock), Sidebar à esquerda e PosterGrid à direita, e player com overlay.

### Estrutura
- manifest
- source/main.brs
- components/MainScene.xml & .brs
- components/screens/Home/HomeScreen.xml & .brs
- components/screens/Player/VideoPlayer.xml & .brs
- components/tasks/ApiTask.xml & .brs

### Recursos
- Navegação: Login → Home → Player.
- Sidebar: "Ao Vivo", "Filmes", "Minha Lista", "Configurações".
- Grid com foco animado (aumento leve de itemSize).
- Player HLS com mensagens de estado (Carregando, Erro etc.).
- Dados mock: categorias e 3 canais exemplo (m3u8 públicos).

### Como empacotar (Windows)
1. Abra um terminal na pasta do projeto.
2. Use o comando do PowerShell para gerar o zip:
   ```powershell
   powershell -NoLogo -NoProfile -Command "Compress-Archive -Path * -DestinationPath UniVisionBrasil.zip -Force"
   ```

### Como fazer sideload no Roku (Modo Desenvolvedor)
1. Ative o modo desenvolvedor no Roku (Home x3, Up x2, Right, Left, Right, Left, Right). Anote IP e defina senha.
2. Acesse pelo navegador: `http://SEU-IP-ROKU` (ex.: `http://192.168.0.25`).
3. Faça login (usuario: `rokudev`, senha: a definida).
4. Na página "Development Application Installer":
   - Selecione o arquivo `UniVisionBrasil.zip` em "Upload".
   - Clique em "Install".
5. O canal inicia automaticamente. Use OK na tela de Login para entrar.

### Navegação e Controles
- Tela Login: Pressione OK para ir à Home.
- Home: Use setas para navegar; selecione pôster para reproduzir.
- Player: Use "Back" para voltar à Home.

### Observações
- Fonts: Labels usam `fontSize` para garantir compatibilidade; nenhuma fonte externa é necessária.
- Safe Zones: Layout em 1080p considerando margens seguras.
- Rede: `ApiTask` está mockada; integre `roUrlTransfer` em produção.

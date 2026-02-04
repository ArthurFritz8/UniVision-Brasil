# UniVision Brasil (Roku) — Teste, Sideload e Publicação

## Status rápido do projeto Roku

O canal Roku aqui está no formato correto de SceneGraph:

- Entrada do app: `source/main.brs`
- Manifest do canal: `manifest`
- Componentes: `components/` (MainScene + telas + tasks)

Ajuste importante (já aplicado): o script de empacotamento agora cria um ZIP limpo **somente** com `manifest`, `source/` e `components/` (antes ele zipava o repositório inteiro e isso costuma quebrar sideload).

## Roku não instala APK

Roku **não usa APK** (APK é Android). Em Roku você instala o app como **Canal**.

Para testes, você faz **sideload** via **Developer Mode** (ZIP). Para publicar, você gera um pacote **.pkg** assinado e envia no portal de desenvolvedor.

---

## 1) Testar no Roku (Sideload / Developer Mode)

### 1.1 Ativar Developer Mode

1. Na Roku (controle remoto), aperte na sequência:
   - **Home** 3x
   - **Up** 2x
   - **Right** 1x
   - **Left** 1x
   - **Right** 1x
   - **Left** 1x
   - **Right** 1x
2. Vai abrir a tela **Developer Settings**.
3. Ative **Enable installer and restart** (ou equivalente).
4. Aceite os termos.
5. Defina uma **senha**.
6. Anote o **IP** que aparece (ex: `192.168.0.50`).

### 1.2 Gerar o ZIP do canal

No Windows (PowerShell/CMD), a partir da raiz do projeto:

- Rode: `scripts\package.bat`
- Ele vai gerar: `UniVisionBrasil.zip` (na raiz do projeto)

### 1.3 Enviar o ZIP para o Roku

1. No PC/celular (mesma rede do Roku), abra no navegador:
   - `http://IP_DO_ROKU`
   - exemplo: `http://192.168.0.50`
2. Login:
   - **User**: `rokudev`
   - **Password**: a senha que você criou no Developer Mode
3. Em **Upload**, selecione `UniVisionBrasil.zip`.
4. Clique em **Install**.
5. O canal vai aparecer e abrir em modo de desenvolvimento.

### 1.4 Dicas de debug

- Se der tela preta/fechar: normalmente é arquivo faltando no ZIP, nome de componente errado no XML ou erro de BrightScript.
- Para logs:
  - Use o browser em `http://IP_DO_ROKU` e procure por logs/console.
  - Ou use telnet (se habilitado) para log de console.

---

## 2) Publicar (ou distribuir privado) no Roku

### 2.1 Criar conta Developer

1. Crie conta no **Roku Developer**.
2. Crie um **Channel** novo.

### 2.2 Gerar pacote assinado (.pkg)

O fluxo comum é:

1. Abra `http://IP_DO_ROKU` (Developer Application Installer)
2. Procure a opção **Package** (ou “Create Package”).
3. Você vai precisar criar/informar uma **Signing Key** e uma senha.
4. O Roku gera um arquivo **.pkg** para download.

### 2.3 Enviar para o portal

1. No portal, faça upload do **.pkg**.
2. Complete os metadados, ícones, screenshots e validações.
3. Escolha **Private** (para testes) ou **Public** (para loja).

---

## 3) Checklist rápido antes do seu teste

- Você consegue abrir o canal e navegar Login → Home → Player.
- O Player reproduz **HLS** e/ou **MP4** (dependendo do provider).
- O app volta do Player com **Back** sem travar.

Se você quiser, eu também posso:
- Revisar as telas do Roku (Login/Home/Settings/Player) e apontar melhorias de UX/erros comuns.
- Ajustar o empacotamento para incluir ícones/splash no manifest (para publicação na loja).

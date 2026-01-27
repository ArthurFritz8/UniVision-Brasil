' MainScene: Roteador/Controlador do app
' Responsável por trocar telas e ouvir eventos globais

function init()
    ' Referências às sub-telas
    m.login = m.top.findNode("LoginGroup")
    m.home = m.top.findNode("HomeGroup")
    m.player = m.top.findNode("PlayerGroup")
    m.settings = m.top.findNode("SettingsGroup")

    m.homeScreen = m.top.findNode("HomeScreen")
    m.loginScreen = m.top.findNode("LoginScreen")
    m.videoPlayer = m.top.findNode("VideoPlayer")
    m.settingsScreen = m.top.findNode("SettingsScreen")

    ' Observa evento da Home para reproduzir canal
    m.homeScreen.observeField("reproduzirCanal", "onReproduzirCanal")
    m.loginScreen.observeField("loginOk", "onLoginOk")
    m.homeScreen.observeField("abrirConfiguracoes", "onAbrirConfiguracoes")
    m.settingsScreen.observeField("voltarHome", "onVoltarHome")

    ' Começa na tela de Login
    TrocarTela("Login")
end function

' Troca de telas: "Login", "Home", "Player"
function TrocarTela(tela as string)
    m.top.estadoGlobal = tela
    m.login.visible = tela = "Login"
    m.home.visible = tela = "Home"
    m.settings.visible = tela = "Settings"
    m.player.visible = tela = "Player"
end function

' Teclas do controle remoto
function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false

    ' LoginScreen trata OK/Back; aqui não navegamos diretamente

    ' Voltar do Player para Home
    if m.top.estadoGlobal = "Player" and key = "back" then
        m.videoPlayer.pararVideo()
        TrocarTela("Home")
        return true
    end if

    ' Teclas na Home delegadas para HomeScreen (favoritos/colapsar menu)
    if m.top.estadoGlobal = "Home" then
        handled = m.homeScreen.callFunc("tratarTecla", key)
        if handled = true then return true
    end if

    ' Voltar das Configurações para Home
    if m.top.estadoGlobal = "Settings" and key = "back" then
        TrocarTela("Home")
        return true
    end if

    return false
end function

' Evento emitido pela Home ao selecionar um canal
sub onReproduzirCanal()
    if m.homeScreen.reproduzirCanal = true then
        canal = m.homeScreen.canalSelecionado
        if canal <> invalid then
            m.videoPlayer.tocarCanal(canal)
            TrocarTela("Player")
        end if
        ' zera a flag
        m.homeScreen.reproduzirCanal = false
    end if
end sub

' Após login (ou ignorado), ir para Home
sub onLoginOk()
    if m.loginScreen.loginOk = true then
        TrocarTela("Home")
        m.loginScreen.loginOk = false
        ' força recarregar dados com possíveis credenciais novas
        m.homeScreen.callFunc("recarregarDados")
    end if
end sub

' Abrir Configurações a partir da Home
sub onAbrirConfiguracoes()
    if m.homeScreen.abrirConfiguracoes = true then
        TrocarTela("Settings")
        m.homeScreen.abrirConfiguracoes = false
    end if
end sub

' Voltar da tela de Configurações
sub onVoltarHome()
    if m.settingsScreen.voltarHome = true then
        TrocarTela("Home")
        ' Recarrega dados conforme endpoint configurado
        m.homeScreen.callFunc("recarregarDados")
        m.settingsScreen.voltarHome = false
    end if
end sub

' LoginScreen: coleta endpoint, usuário e senha e salva em registry

function init()
    m.endpoint = m.top.findNode("Endpoint")
    m.usuario = m.top.findNode("Usuario")
    m.senha = m.top.findNode("Senha")
    m.msg = m.top.findNode("Mensagem")

    ' Pré-carrega valores salvos
    cfg = carregarConfig()
    if cfg <> invalid then
        if cfg.endpoint <> invalid then m.endpoint.text = cfg.endpoint
        if cfg.username <> invalid then m.usuario.text = cfg.username
        if cfg.password <> invalid then m.senha.text = cfg.password
    end if
end function

function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if key = "OK" then
        ep = m.endpoint.text
        user = m.usuario.text
        pass = m.senha.text
        if ep = invalid or len(ep) = 0 or user = invalid or len(user) = 0 or pass = invalid or len(pass) = 0 then
            m.msg.text = "Preencha servidor, usuário e senha."
            m.top.loginErro = true
            return true
        end if
        ' Salva
        salvarConfig(ep, user, pass)
        m.msg.text = "Credenciais salvas."
        m.top.loginOk = true
        return true
    else if key = "back" then
        ' Ignora login e segue para mock/endpoint já salvo
        m.top.loginOk = true
        return true
    end if
    return false
end function

function obterRegistry() as Object
    return CreateObject("roRegistrySection", "Config")
end function

function salvarConfig(ep as string, user as string, pass as string)
    reg = obterRegistry()
    reg.Write("endpoint", ep)
    reg.Write("username", user)
    reg.Write("password", pass)
end function

function carregarConfig() as dynamic
    reg = obterRegistry()
    return { endpoint: reg.Read("endpoint"), username: reg.Read("username"), password: reg.Read("password") }
end function

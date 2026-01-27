' SettingsScreen: permite definir endpoint de API e limpar favoritos

function init()
    m.lista = m.top.findNode("AcaoList")
    m.endpointValor = m.top.findNode("EndpointValor")
    m.input = m.top.findNode("EndpointInput")
    m.hint = m.top.findNode("Hint")

    m.lista.content = criarAcoes()
    m.lista.observeField("itemSelected", "onAcaoSelecionada")

    ' Exibe endpoint atual se existir
    m.top.endpointAtual = carregarEndpoint()
    if m.top.endpointAtual <> invalid then
        m.endpointValor.text = m.top.endpointAtual
    else
        m.endpointValor.text = "(não definido)"
    end if
    ' Modo de input (endpoint/m3u)
    m.inputModo = "endpoint"
end function

function criarAcoes() as Object
    root = CreateObject("roSGNode", "ContentNode")
    a1 = CreateObject("roSGNode", "ContentNode") : a1.title = "Definir Endpoint API"
    a12 = CreateObject("roSGNode", "ContentNode") : a12.title = "Definir URL M3U"
    a2 = CreateObject("roSGNode", "ContentNode") : a2.title = "Limpar Minha Lista"
    a3 = CreateObject("roSGNode", "ContentNode") : a3.title = "Voltar"
    root.appendChild(a1) : root.appendChild(a12) : root.appendChild(a2) : root.appendChild(a3)
    return root
end function

sub onAcaoSelecionada()
    idx = m.lista.itemSelected
    item = m.lista.content.getChild(idx)
    if item = invalid then return
    sel = item.title
    if sel = "Definir Endpoint API" then
        abrirInput("endpoint")
    else if sel = "Definir URL M3U" then
        abrirInput("m3u")
    else if sel = "Limpar Minha Lista" then
        limparFavoritos()
    else if sel = "Voltar" then
        m.top.voltarHome = true
    end if
end sub

sub abrirInput(tipo as string)
    m.input.visible = true
    m.hint.visible = true
    m.inputModo = tipo
    if tipo = "endpoint" then
        m.input.text = m.top.endpointAtual
    else
        reg = obterRegistry()
        m.input.text = reg.Read("m3uUrl")
    end if
end sub

' Captura teclas para salvar/cancelar
function onKeyEvent(key as string, press as boolean) as boolean
    if not press then return false
    if m.input.visible = true then
        if key = "OK" then
            novo = m.input.text
            if m.inputModo = "endpoint" then
                salvarEndpoint(novo)
                m.top.endpointAtual = novo
                m.endpointValor.text = novo
            else
                salvarM3U(novo)
                m.endpointValor.text = "M3U definida"
            end if
            m.input.visible = false
            m.hint.visible = false
            return true
        else if key = "back" then
            m.input.visible = false
            m.hint.visible = false
            return true
        end if
    end if
    return false
end function

function obterRegistry() as Object
    return CreateObject("roRegistrySection", "Config")
end function

function carregarEndpoint() as dynamic
    reg = obterRegistry()
    return reg.Read("endpoint")
end function

sub salvarEndpoint(url as string)
    reg = obterRegistry()
    reg.Write("endpoint", url)
end sub

sub salvarM3U(url as string)
    reg = obterRegistry()
    reg.Write("m3uUrl", url)
end sub

sub limparFavoritos()
    reg = CreateObject("roRegistrySection", "Favoritos")
    chaves = reg.GetKeys()
    if chaves <> invalid then
        for each k in chaves
            reg.Delete(k)
        end for
    end if
    ' Feedback simples
    m.endpointValor.text = "Favoritos limpos"
end sub

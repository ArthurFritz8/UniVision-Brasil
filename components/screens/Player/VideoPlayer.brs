' VideoPlayer: controla reprodução e UI de estado

function init()
    m.video = m.top.findNode("VideoNode")
    m.titulo = m.top.findNode("TituloCanal")
    m.estado = m.top.findNode("EstadoLabel")
    m.erro = m.top.findNode("ErroLabel")
    m.programa = m.top.findNode("ProgramaAtual")

    ' Observa estados do player
    m.video.observeField("state", "onVideoState")
    m.video.control = "stop"
end function

' Inicia reprodução de um canal (HLS)
sub tocarCanal(canal as object)
    m.top.canal = canal
    m.titulo.text = canal.titulo

    ' Usa formato dinâmico (hls/mp4) conforme o item
    fmt = canal.formato
    if fmt = invalid then fmt = "hls"
    conteudo = {
        title: canal.titulo,
        streamFormat: fmt,
        url: canal.stream
    }
    m.video.content = conteudo

    m.estado.text = "Carregando..."
    m.erro.visible = false
    m.top.findNode("Spinner").visible = true
    m.programa.text = ""

    m.video.control = "play"

    ' Dispara EPG se tivermos streamId (Xtream)
    if canal.id <> invalid then
        ep = obterEndpointConfig()
        user = obterReg("username")
        pass = obterReg("password")
        if ep <> invalid and user <> invalid and pass <> invalid then
            m.epg = CreateObject("roSGNode", "EpgTask")
            m.epg.endpoint = ep
            m.epg.username = user
            m.epg.password = pass
            m.epg.observeField("resultado", "onEpgPronta")
            m.epg.streamId = canal.id
        end if
    end if
end sub

' Para a reprodução atual
sub pararVideo()
    m.video.control = "stop"
end sub

' Atualiza mensagens conforme o estado do nó de vídeo
sub onVideoState()
    estado = m.video.state
    if estado = "buffering" then
        m.estado.text = "Carregando..."
        m.top.findNode("Spinner").visible = true
    else if estado = "playing" then
        m.estado.text = "Reproduzindo"
        m.top.findNode("Spinner").visible = false
    else if estado = "paused" then
        m.estado.text = "Pausado"
        m.top.findNode("Spinner").visible = false
    else if estado = "error" then
        m.estado.text = "Erro ao reproduzir vídeo"
        m.erro.visible = true
        m.erro.text = "Erro ao reproduzir vídeo"
        m.top.findNode("Spinner").visible = false
    else if estado = "finished" then
        m.estado.text = "Finalizado"
        m.top.findNode("Spinner").visible = false
    end if
end sub

sub onEpgPronta()
    r = m.epg.resultado
    if r <> invalid and r.epg_listings <> invalid and r.epg_listings.Count() > 0 then
        atual = r.epg_listings[0]
        if atual <> invalid then
            m.programa.text = atual.title + " (" + atual.start + " - " + atual.stop + ")"
        end if
    end if
end sub

function obterReg(key as string) as dynamic
    reg = CreateObject("roRegistrySection", "Config")
    return reg.Read(key)
end function

function obterEndpointConfig() as dynamic
    return obterReg("endpoint")
end function

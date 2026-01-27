' EpgTask: busca EPG curto para um canal (Xtream Codes)

function init()
    m.top.observeField("streamId", "onStart")
end function

sub onStart()
    sid = m.top.streamId
    base = m.top.endpoint
    user = m.top.username
    pass = m.top.password

    if sid = invalid or len(sid) = 0 then return
    if base = invalid or len(base) = 0 then return
    if user = invalid or len(user) = 0 then return
    if pass = invalid or len(pass) = 0 then return

    if Right(base, 1) = "/" then base = Left(base, Len(base)-1)
    url = base + "/player_api.php?action=get_short_epg&stream_id=" + sid + "&username=" + user + "&password=" + pass

    x = CreateObject("roUrlTransfer")
    x.SetUrl(url)
    resp = x.GetToString()
    if resp = invalid or Len(resp) = 0 then
        m.top.erro = "Falha ao carregar EPG"
        return
    end if
    json = ParseJson(resp)
    if json = invalid then
        m.top.erro = "EPG inválida"
        return
    end if

    ' Resultado típico: { epg_listings: [ { title, start, stop } ... ] }
    m.top.resultado = json
end sub

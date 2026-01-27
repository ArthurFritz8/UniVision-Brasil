' ApiTask: Simula chamada de API e retorna JSON mockado
' Uso de roUrlTransfer ilustrativo (não chama rede nesta versão)

function init()
    ' Dispara execução quando endpoint é definido
    m.top.observeField("endpoint", "onStart")
    m.top.observeField("username", "onStart")
    m.top.observeField("password", "onStart")

    ' Carrega cache inicial (se existir) para exibir rapidamente
    cache = carregarCache()
    if cache <> invalid then
        if cache.resultado <> invalid then m.top.resultado = cache.resultado
        if cache.liveCategorias <> invalid then m.top.liveCategorias = cache.liveCategorias
    end if
end function

sub onStart()
    ' Tenta buscar dados via endpoint (Xtream/JSON) ou M3U, caso haja configuração
    dados = invalid
    url = m.top.endpoint
    m3u = m.top.m3uUrl
    if url <> invalid and left(url, 4) = "http" then
        ' Se tivermos username/password, tenta protocolo Xtream Codes
        user = m.top.username
        pass = m.top.password
        if user <> invalid and pass <> invalid and len(user) > 0 and len(pass) > 0 then
            dados = obterDadosXtream(url, user, pass)
            if dados = invalid then m.top.erro = "Falha ao obter dados do servidor Xtream"
        else
            ' Tenta buscar JSON direto do endpoint
            xfer = CreateObject("roUrlTransfer")
            xfer.SetUrl(url)
            if left(url, 5) = "https" then
                xfer.SetCertificatesFile("common:/certs/ca-bundle.crt")
                xfer.InitClientCertificates()
            end if
            resp = xfer.GetToString()
            if resp <> invalid and len(resp) > 0 then
                parsed = ParseJson(resp)
                if parsed <> invalid then
                    dados = parsed
                end if
            end if
        end if
    end if

    ' Se não temos dados e há uma URL M3U, tenta parsear
    if dados = invalid and m3u <> invalid and len(m3u) > 0 then
        dados = obterDadosM3U(m3u)
        if dados = invalid then m.top.erro = "Falha ao carregar playlist M3U"
    end if

    ' Fallback: estrutura mockada
    if dados = invalid then
        dados = {
            categorias: [
                { id: "ao_vivo", nome: "TV Ao Vivo" },
                { id: "filmes", nome: "Filmes" },
                { id: "series", nome: "Séries" }
            ],
            canais: [
                {
                    id: "globo",
                    titulo: "Globo (Exemplo)",
                    categoriaId: "ao_vivo",
                    stream: "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8",
                    formato: "hls",
                    imagem: "https://via.placeholder.com/300x450.png?text=Globo"
                },
                {
                    id: "sbt",
                    titulo: "SBT (Exemplo)",
                    categoriaId: "ao_vivo",
                    stream: "https://test-streams.mux.dev/test_001/stream.m3u8",
                    formato: "hls",
                    imagem: "https://via.placeholder.com/300x450.png?text=SBT"
                },
                {
                    id: "tnt",
                    titulo: "TNT Sports (Exemplo)",
                    categoriaId: "ao_vivo",
                    stream: "https://test-streams.mux.dev/pts/pts.m3u8",
                    formato: "hls",
                    imagem: "https://via.placeholder.com/300x450.png?text=TNT"
                }
            ],
            conteudos: [
                {
                    id: "bbb",
                    titulo: "Big Buck Bunny (Filme)",
                    categoriaId: "filmes",
                    stream: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    formato: "mp4",
                    imagem: "https://via.placeholder.com/300x450.png?text=BBB"
                },
                {
                    id: "sintel",
                    titulo: "Sintel (Filme)",
                    categoriaId: "filmes",
                    stream: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4",
                    formato: "mp4",
                    imagem: "https://via.placeholder.com/300x450.png?text=Sintel"
                },
                {
                    id: "serie_demo",
                    titulo: "Série Demo (Ep1)",
                    categoriaId: "series",
                    stream: "https://test-streams.mux.dev/dai-sample/dai.m3u8",
                    formato: "hls",
                    imagem: "https://via.placeholder.com/300x450.png?text=Serie"
                }
            ]
        }
    end if

    ' Define o resultado para consumo pelas telas
    m.top.resultado = dados
    ' Persiste em cache para carregamento rápido posterior
    salvarCache(dados)
end sub

' Busca dados em servidores Xtream Codes (player_api.php)
function obterDadosXtream(base as string, user as string, pass as string) as dynamic
    ' Normaliza base removendo barras finais
    if right(base, 1) = "/" then base = left(base, len(base)-1)
    api = base + "/player_api.php?username=" + user + "&password=" + pass

    listaLive = xtGet(api + "&action=get_live_streams")
    listaVod = xtGet(api + "&action=get_vod_streams")
    listaSeries = xtGet(api + "&action=get_series")
    listaLiveCats = xtGet(api + "&action=get_live_categories")

    if listaLive = invalid and listaVod = invalid and listaSeries = invalid then return invalid

    ' Mapeia para estrutura interna esperada
    categorias = [
        { id: "ao_vivo", nome: "TV Ao Vivo" },
        { id: "filmes", nome: "Filmes" },
        { id: "series", nome: "Séries" }
    ]

    canais = []
    if listaLive <> invalid then
        for each it in listaLive
            ' cada item costuma ter stream_id, name, logo; URL de stream: base/live/user/pass/stream_id.m3u8
            streamUrl = base + "/live/" + user + "/" + pass + "/" + it.stream_id.toStr() + ".m3u8"
            logo = it.stream_icon
            if logo = invalid or len(logo) = 0 then logo = "https://via.placeholder.com/300x450.png?text=Ao+Vivo"
            gid = ""
            if it.category_id <> invalid then gid = it.category_id.toStr()
            gname = obterNomeCategoria(listaLiveCats, it.category_id)
            canais.push({
                id: it.stream_id.toStr(),
                titulo: it.name,
                categoriaId: "ao_vivo",
                stream: streamUrl,
                formato: "hls",
                imagem: logo,
                grupoId: gid,
                grupoNome: gname
            })
        end for
    end if

    conteudos = []
    if listaVod <> invalid then
        for each it in listaVod
            ' VOD: URL comum: base/movie/user/pass/<id>.mp4 (nem sempre mp4; pode m3u8)
            urlVod = base + "/movie/" + user + "/" + pass + "/" + it.stream_id.toStr() + ".mp4"
            img = it.stream_icon
            if img = invalid or len(img) = 0 then img = "https://via.placeholder.com/300x450.png?text=Filme"
            conteudos.push({
                id: it.stream_id.toStr(),
                titulo: it.name,
                categoriaId: "filmes",
                stream: urlVod,
                formato: "mp4",
                imagem: img
            })
        end for
    end if

    if listaSeries <> invalid then
        for each it in listaSeries
            ' Series: usar playlist hls quando disponível; fallback mp4
            urlSerie = base + "/series/" + user + "/" + pass + "/" + it.series_id.toStr() + ".m3u8"
            img2 = it.cover
            if img2 = invalid or len(img2) = 0 then img2 = "https://via.placeholder.com/300x450.png?text=Serie"
            conteudos.push({
                id: it.series_id.toStr(),
                titulo: it.name,
                categoriaId: "series",
                stream: urlSerie,
                formato: "hls",
                imagem: img2
            })
        end for
    end if

    ' Prepara categorias ao vivo (se disponíveis)
    liveCatsArr = []
    if listaLiveCats <> invalid then
        for each c in listaLiveCats
            liveCatsArr.push({ id: c.category_id.toStr(), nome: c.category_name })
        end for
    end if

    m.top.liveCategorias = liveCatsArr
    return { categorias: categorias, canais: canais, conteudos: conteudos }
end function

function xtGet(url as string) as dynamic
    x = CreateObject("roUrlTransfer")
    x.SetUrl(url)
    resp = x.GetToString()
    if resp = invalid or len(resp) = 0 then return invalid
    parsed = ParseJson(resp)
    return parsed
end function

' Carrega e parseia uma playlist M3U (EXTM3U)
function obterDadosM3U(url as string) as dynamic
    x = CreateObject("roUrlTransfer")
    x.SetUrl(url)
    txt = x.GetToString()
    if txt = invalid or len(txt) = 0 then return invalid

    lines = SplitLines(txt)
    if lines = invalid then return invalid

    categorias = [
        { id: "ao_vivo", nome: "TV Ao Vivo" },
        { id: "filmes", nome: "Filmes" },
        { id: "series", nome: "Séries" }
    ]

    canais = []
    conteudos = []

    meta = invalid
    for i = 0 to lines.Count()-1
        line = TrimStr(lines[i])
        if Len(line) = 0 then
            ' linha vazia, ignora
        else if Left(line, 7) = "#EXTINF" then
            meta = line
        else if Left(line, 1) <> "#" and meta <> invalid then
            ' Próxima linha após EXTINF deve ser a URL
            streamUrl = line
            ' Extrai campos do EXTINF
            nome = extrairCampo(meta, ",") ' após vírgula vem o título
            grupo = extrairAtributo(meta, "group-title")
            logo = extrairAtributo(meta, "tvg-logo")
            if logo = invalid or len(logo) = 0 then logo = "https://via.placeholder.com/300x450.png?text=Canal"

            isVod = (Instr(1, LCase(grupo), "vod") > 0 or Instr(1, LCase(streamUrl), ".mp4") > 0)
            isSeries = (Instr(1, LCase(grupo), "serie") > 0 or Instr(1, LCase(grupo), "séries") > 0)

            if isVod then
                fmt = "mp4"
                if isHls(streamUrl) then fmt = "hls"
                conteudos.push({
                    id: (canais.Count()+conteudos.Count()+i).toStr(),
                    titulo: nome,
                    categoriaId: "filmes",
                    stream: streamUrl,
                    formato: fmt,
                    imagem: logo,
                    grupoNome: grupo
                })
            else if isSeries then
                fmt2 = "mp4"
                if isHls(streamUrl) then fmt2 = "hls"
                conteudos.push({
                    id: (canais.Count()+conteudos.Count()+i).toStr(),
                    titulo: nome,
                    categoriaId: "series",
                    stream: streamUrl,
                    formato: fmt2,
                    imagem: logo,
                    grupoNome: grupo
                })
            else
                fmt3 = "mp4"
                if isHls(streamUrl) then fmt3 = "hls"
                canais.push({
                    id: (canais.Count()+conteudos.Count()+i).toStr(),
                    titulo: nome,
                    categoriaId: "ao_vivo",
                    stream: streamUrl,
                    formato: fmt3,
                    imagem: logo,
                    grupoNome: grupo
                })
            end if
            meta = invalid
        end if
    end for

    ' Deriva categorias ao vivo de group-title (M3U)
    liveCats = []
    mapa = {}
    for each ch in canais
        g = ch.grupoNome
        if g <> invalid and len(g) > 0 and mapa[g] = invalid then
            mapa[g] = true
            liveCats.push({ id: g, nome: g })
        end if
    end for
    m.top.liveCategorias = liveCats
    return { categorias: categorias, canais: canais, conteudos: conteudos }
end function
function obterNomeCategoria(lista as dynamic, catId as dynamic) as dynamic
    if lista = invalid or catId = invalid then return ""
    for each c in lista
        if c.category_id = catId then return c.category_name
    end for
    return ""
end function

function extrairAtributo(meta as string, chave as string) as dynamic
    ' Ex: #EXTINF:-1 tvg-id="..." tvg-logo="..." group-title="Ao Vivo", Título
    pIdx = Instr(1, meta, chave + "=")
    if pIdx <= 0 then return invalid
    startQ = Instr(pIdx, meta, Chr(34)) ' "
    if startQ <= 0 then return invalid
    rest = Mid(meta, startQ + 1)
    endQ = Instr(1, rest, Chr(34))
    if endQ <= 0 then return invalid
    return Left(rest, endQ - 1)
end function

function extrairCampo(meta as string, sep as string) as string
    ' Retorna substring após o separador (título após vírgula)
    p = Instr(1, meta, sep)
    if p <= 0 then return meta
    return TrimStr(Mid(meta, p + 1))
end function

' Helpers
function TrimStr(s as string) as string
    if s = invalid then return ""
    total = Len(s)
    if total = 0 then return ""
    start = 1
    while start <= total and Mid(s, start, 1) = " "
        start = start + 1
    end while
    endPos = total
    while endPos >= start and Mid(s, endPos, 1) = " "
        endPos = endPos - 1
    end while
    return Mid(s, start, endPos - start + 1)
end function

function isHls(url as string) as boolean
    if url = invalid then return false
    return Right(url, 5) = ".m3u8"
end function

function SplitLines(txt as string) as object
    if txt = invalid then return invalid
    arr = []
    start = 1
    total = Len(txt)
    while true
        p = Instr(start, txt, Chr(10))
        if p <= 0 then
            part = Mid(txt, start)
            if Len(part) > 0 then
                ' remove CR at end
                if Right(part, 1) = Chr(13) then part = Left(part, Len(part)-1)
                arr.push(part)
            end if
            exit while
        else
            part = Mid(txt, start, p - start)
            if Right(part, 1) = Chr(13) then part = Left(part, Len(part)-1)
            arr.push(part)
            start = p + 1
        end if
    end while
    return arr
end function

' Cache simples em roRegistrySection("Cache")
function carregarCache() as dynamic
    reg = CreateObject("roRegistrySection", "Cache")
    txt = reg.Read("conteudo")
    if txt = invalid or len(txt) = 0 then return invalid
    obj = ParseJson(txt)
    return obj
end function

sub salvarCache(dados as dynamic)
    reg = CreateObject("roRegistrySection", "Cache")
    cacheObj = { resultado: dados, liveCategorias: m.top.liveCategorias }
    reg.Write("conteudo", FormatJson(cacheObj))
end sub

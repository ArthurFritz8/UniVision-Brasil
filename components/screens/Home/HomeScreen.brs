' HomeScreen: UI com Sidebar + PosterGrid
' Controla categoria e seleção de itens (MVVM simples)

function init()
    ' Referências de UI
    m.menu = m.top.findNode("Menu")
    m.grid = m.top.findNode("Grid")
    m.categoriaTitulo = m.top.findNode("CategoriaTitulo")
    m.epgInfo = m.top.findNode("EpgInfo")
    m.filtroTitulo = m.top.findNode("FiltroTitulo")
    m.filtroList = m.top.findNode("FiltroList")
    m.buscaInput = m.top.findNode("BuscaInput")

    ' Conteúdo do menu lateral
    m.menu.content = criarConteudoMenu()
    m.menu.observeField("itemSelected", "onMenuSelecionado")

    ' Configura grid
    m.grid.itemSize = [280, 420]
    m.grid.focusBitmapUri = "" ' Oculta feedback padrão
    m.grid.observeField("itemFocused", "onItemFocus")
    m.grid.observeField("itemSelected", "onItemSelecionado")
    m.filtroList.observeField("itemSelected", "onFiltroSelecionado")
    m.buscaInput.observeField("text", "onBuscaTexto")

    ' Task de API (mock)
    m.api = CreateObject("roSGNode", "ApiTask")
    m.api.observeField("resultado", "onDadosProntos")
    m.api.observeField("liveCategorias", "onLiveCatsProntas")
    m.api.observeField("erro", "onErroApi")
    ' Carrega endpoint do registro, ou usa mock
    ep = carregarEndpointConfig()
    if ep = invalid then ep = "mock"
    m.api.endpoint = ep
    ' Passa credenciais salvas, se houver
    regInit = CreateObject("roRegistrySection", "Config")
    m.api.username = regInit.Read("username")
    m.api.password = regInit.Read("password")
    ' Passa URL M3U se configurada
    m.api.m3uUrl = regInit.Read("m3uUrl")

    ' Estado do sidebar
    m.sidebar = m.top.findNode("Sidebar")
    m.top.sidebarColapsado = false

    ' Task de EPG
    m.epg = CreateObject("roSGNode", "EpgTask")
    m.epg.observeField("resultado", "onEpgHomePronta")

    m.filtroGrupoId = ""
    m.buscaTexto = ""
end function
' Lê endpoint configurado em roRegistrySection
function carregarEndpointConfig() as dynamic
    reg = CreateObject("roRegistrySection", "Config")
    return reg.Read("endpoint")
end function

' Recarrega dados baseado no endpoint atual
sub recarregarDados()
    ep = carregarEndpointConfig()
    if ep = invalid then ep = "mock"
    m.api.endpoint = ep
    ' passa credenciais armazenadas, se houver
    reg = CreateObject("roRegistrySection", "Config")
    m.api.username = reg.Read("username")
    m.api.password = reg.Read("password")
    m.api.m3uUrl = reg.Read("m3uUrl")
end sub

' Cria o conteúdo do menu lateral
function criarConteudoMenu() as Object
    lista = CreateObject("roSGNode", "ContentNode")
    nomes = ["Ao Vivo", "Filmes", "Minha Lista", "Configurações"]
    for each nome in nomes
        n = CreateObject("roSGNode", "ContentNode")
        n.title = nome
        lista.appendChild(n)
    end for
    return lista
end function

' Dados mock recebidos da ApiTask
sub onDadosProntos()
    m.dados = m.api.resultado
    m.categoriaAtual = "ao_vivo"
    popularGridPorCategoria(m.categoriaAtual)
end sub

sub onLiveCatsProntas()
    cats = m.api.liveCategorias
    if cats <> invalid and cats.Count() > 0 then
        root = CreateObject("roSGNode", "ContentNode")
        ' Primeiro item: Todos
        t = CreateObject("roSGNode", "ContentNode") : t.title = "Todos" : t.id = ""
        root.appendChild(t)
        for each c in cats
            n = CreateObject("roSGNode", "ContentNode")
            n.title = c.nome
            n.id = c.id
            root.appendChild(n)
        end for
        m.filtroList.content = root
    else
        m.filtroList.content = invalid
    end if
end sub

sub onErroApi()
    if m.api.erro <> invalid and len(m.api.erro) > 0 then
        mostrarToast(m.api.erro)
    end if
end sub

' Preenche a PosterGrid com base na categoria
sub popularGridPorCategoria(catId as string)
    lista = CreateObject("roSGNode", "ContentNode")
    ' Ao Vivo: usa array canais
    if catId = "ao_vivo" then
        ' Monta array temporário e ordena por título
        arr = []
        for each canal in m.dados.canais
            if canal.categoriaId = catId then
                ' Aplica filtro de grupo (se existir)
                if m.filtroGrupoId <> "" then
                    ' Comparar por grupoId ou grupoNome
                    if (canal.grupoId = invalid or canal.grupoId <> m.filtroGrupoId) and (canal.grupoNome = invalid or canal.grupoNome <> m.filtroGrupoId) then
                        goto continue_canal_tmp
                    end if
                end if
                ' Aplica busca por título
                if m.buscaTexto <> "" and instr(1, lcase(canal.titulo), lcase(m.buscaTexto)) = 0 then
                    goto continue_canal_tmp
                end if
                arr.push(canal)
                continue_canal_tmp:
            end if
        end for
        arrOrdenado = ordenarPorTitulo(arr)
        for each canal in arrOrdenado
            item = CreateObject("roSGNode", "ContentNode")
            item.title = canal.titulo
            item.hdPosterUrl = canal.imagem
            item.streamFormat = canal.formato
            item.streamUrl = canal.stream
            item.id = canal.id
            item.grupoNome = canal.grupoNome
            lista.appendChild(item)
        end for
    else
        ' Filmes/Séries: usa array conteudos
        arr = []
        for each c in m.dados.conteudos
            if c.categoriaId = catId then
                if m.buscaTexto <> "" and instr(1, lcase(c.titulo), lcase(m.buscaTexto)) = 0 then
                    goto continue_conteudo_tmp
                end if
                arr.push(c)
                continue_conteudo_tmp:
            end if
        end for
        arrOrdenado = ordenarPorTitulo(arr)
        for each c in arrOrdenado
            item = CreateObject("roSGNode", "ContentNode")
            item.title = c.titulo
            item.hdPosterUrl = c.imagem
            item.streamFormat = c.formato
            item.streamUrl = c.stream
            item.id = c.id
            lista.appendChild(item)
        end for
    end if
    m.grid.content = lista

    ' Atualiza título da categoria
    for each c in m.dados.categorias
        if c.id = catId then
            m.categoriaTitulo.text = c.nome
        end if
    end for
end sub

' Ordena array de assocarrays pelo campo "titulo" (A→Z)
function ordenarPorTitulo(arr as object) as object
    if arr = invalid then return []
    ' Insertion sort simples (estável)
    for i = 1 to arr.Count() - 1
        key = arr[i]
        j = i - 1
        while j >= 0 and lcase(arr[j].titulo) > lcase(key.titulo)
            arr[j + 1] = arr[j]
            j = j - 1
        end while
        arr[j + 1] = key
    end for
    return arr
end function

' Seleção de item do grid -> notifica MainScene para abrir Player
sub onItemSelecionado()
    idx = m.grid.itemSelected
    item = m.grid.content.getChild(idx)
    if item <> invalid then
        m.top.canalSelecionado = {
            titulo: item.title,
            stream: item.streamUrl,
            formato: item.streamFormat,
            id: item.id
        }
        m.top.reproduzirCanal = true
    end if
end sub

' Animação de foco simples: aumenta levemente o tamanho do item
' Observação: PosterGrid não suporta escala por item diretamente.
' Aqui simulamos aumentando itemSize brevemente para dar sensação de foco.
sub onItemFocus()
    if m.anim <> invalid then m.anim.stop()
    m.anim = CreateObject("roSGNode", "Animation")
    m.anim.duration = 0.12

    interp = CreateObject("roSGNode", "Vector2DFieldInterpolator")
    interp.key = "itemSize"
    interp.target = m.grid
    interp.valueStart = m.grid.itemSize
    interp.valueEnd = [300, 440]

    m.anim.addChild(interp)
    m.anim.control = "start"

    ' Reverte após um curto tempo
    timer = CreateObject("roSGNode", "Timer")
    timer.duration = 0.2
    timer.observeField("fire", "reverterItemSize")
    timer.control = "start"
    m.reverteTimer = timer

    ' Se item focado é Ao Vivo e temos credenciais, carrega EPG curto
    idx = m.grid.itemFocused
    item = m.grid.content.getChild(idx)
    if item <> invalid and m.categoriaAtual = "ao_vivo" and item.id <> invalid then
        ep = carregarEndpointConfig()
        reg = CreateObject("roRegistrySection", "Config")
        user = reg.Read("username")
        pass = reg.Read("password")
        if ep <> invalid and user <> invalid and pass <> invalid then
            m.epg.endpoint = ep
            m.epg.username = user
            m.epg.password = pass
            m.epg.streamId = item.id
        end if
    else
        m.epgInfo.text = ""
    end if
end sub

sub reverterItemSize()
    m.grid.itemSize = [280, 420]
end sub

' Seleção no menu lateral
sub onMenuSelecionado()
    idx = m.menu.itemSelected
    item = m.menu.content.getChild(idx)
    if item = invalid then return

    selecao = item.title
    if selecao = "Ao Vivo" then
        m.categoriaAtual = "ao_vivo"
        popularGridPorCategoria(m.categoriaAtual)
        m.filtroTitulo.visible = true
        m.filtroList.visible = true
        m.buscaInput.visible = true
    else if selecao = "Filmes" then
        m.categoriaAtual = "filmes"
        popularGridPorCategoria(m.categoriaAtual)
        m.filtroTitulo.visible = false
        m.filtroList.visible = false
        m.buscaInput.visible = true
    else if selecao = "Minha Lista" then
        carregarFavoritos()
        m.filtroTitulo.visible = false
        m.filtroList.visible = false
        m.buscaInput.visible = true
    else if selecao = "Configurações" then
        ' Solicita abertura da tela de configurações
        m.top.abrirConfiguracoes = true
        m.filtroTitulo.visible = false
        m.filtroList.visible = false
        m.buscaInput.visible = false
    end if
end sub

' Trata teclas globais quando na Home
function tratarTecla(key as string) as boolean
    ' Colapsar/expandir sidebar
    if key = "left" then
        colapsarSidebar(true)
        return true
    else if key = "right" then
        colapsarSidebar(false)
        return true
    else if key = "options" then
        ' Alterna favorito para item focado
        idx = m.grid.itemFocused
        item = m.grid.content.getChild(idx)
        if item <> invalid then
            alternarFavorito(item)
            return true
        end if
    end if
    return false
end function

sub onFiltroSelecionado()
    idx = m.filtroList.itemSelected
    item = m.filtroList.content.getChild(idx)
    if item <> invalid then
        m.filtroGrupoId = item.id
        popularGridPorCategoria(m.categoriaAtual)
    end if
end sub

sub onBuscaTexto()
    m.buscaTexto = m.buscaInput.text
    popularGridPorCategoria(m.categoriaAtual)
end sub

' Anima o sidebar para colapsar/expandir
sub colapsarSidebar(colapsar as boolean)
    if m.animSidebar <> invalid then m.animSidebar.stop()
    m.animSidebar = CreateObject("roSGNode", "Animation")
    m.animSidebar.duration = 0.16

    interp = CreateObject("roSGNode", "Vector2DFieldInterpolator")
    interp.key = "translation"
    interp.target = m.sidebar
    if colapsar then
        interp.valueStart = m.sidebar.translation
        interp.valueEnd = [-320, 0]
    else
        interp.valueStart = m.sidebar.translation
        interp.valueEnd = [0, 0]
    end if
    m.animSidebar.addChild(interp)
    m.animSidebar.control = "start"
    m.top.sidebarColapsado = colapsar
end sub

' Favoritos persistentes em roRegistrySection
function obterRegistry() as Object
    return CreateObject("roRegistrySection", "Favoritos")
end function

sub alternarFavorito(item as Object)
    reg = obterRegistry()
    id = item.id
    if id = invalid then return
    existente = reg.Read(id)
    if existente <> invalid then
        ' Remove favorito
        reg.Delete(id)
        mostrarToast("Removido de Minha Lista")
    else
        ' Adiciona favorito como JSON
        fav = {
            title: item.title,
            url: item.streamUrl,
            formato: item.streamFormat,
            imagem: item.hdPosterUrl
        }
        reg.Write(id, FormatJson(fav))
        mostrarToast("Adicionado à Minha Lista")
    end if
end sub

' Carrega favoritos para exibir em Minha Lista
sub carregarFavoritos()
    reg = obterRegistry()
    lista = CreateObject("roSGNode", "ContentNode")
    chaves = reg.GetKeys()
    if chaves <> invalid then
        for each k in chaves
            v = reg.Read(k)
            if v <> invalid then
                parsed = ParseJson(v)
                if parsed <> invalid then
                    item = CreateObject("roSGNode", "ContentNode")
                    item.title = parsed.title
                    item.hdPosterUrl = parsed.imagem
                    item.streamFormat = parsed.formato
                    item.streamUrl = parsed.url
                    item.id = k
                    lista.appendChild(item)
                end if
            end if
        end for
    end if
    m.grid.content = lista
    m.categoriaTitulo.text = "Minha Lista"
end sub

sub mostrarToast(msg as string)
    ' Implementação simples: usa label de categoria para feedback rápido
    m.categoriaTitulo.text = msg
    timer = CreateObject("roSGNode", "Timer")
    timer.duration = 1.5
    timer.observeField("fire", "restaurarTitulo")
    timer.control = "start"
    m.toastTimer = timer
end sub

sub restaurarTitulo()
    for each c in m.dados.categorias
        if c.id = m.categoriaAtual then
            m.categoriaTitulo.text = c.nome
        end if
    end for
end sub

sub onEpgHomePronta()
    r = m.epg.resultado
    if r <> invalid and r.epg_listings <> invalid and r.epg_listings.Count() > 0 then
        atual = r.epg_listings[0]
        if atual <> invalid then
            m.epgInfo.text = "Agora: " + atual.title + " (" + atual.start + " - " + atual.stop + ")"
        end if
    end if
end sub

' Ponto de entrada do aplicativo Roku (SceneGraph)
' Toda a lógica e comentários em Português Brasil

sub Main()
    ' Inicializa a tela principal SceneGraph
    screen = CreateObject("roSGScreen")
    port = CreateObject("roMessagePort")
    screen.SetMessagePort(port)

    ' Cria a cena principal que atuará como roteador/controlador
    scene = screen.CreateScene("MainScene")

    ' Exibe a tela
    screen.Show()

    ' Loop de eventos da tela (ciclo de vida do app)
    while true
        msg = wait(0, port)
        if type(msg) = "roSGScreenEvent" then
            if msg.isScreenClosed() then
                ' Usuário fechou o canal: encerrar execução
                exit while
            end if
        end if
    end while
end sub

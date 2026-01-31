export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-9xl font-bold gradient-text mb-4">404</h1>
      <h2 className="text-3xl font-bold mb-4">Página não encontrada</h2>
      <p className="text-gray-400 mb-8">
        A página que você procura não existe ou foi removida.
      </p>
      <a href="/" className="btn-primary">
        Voltar para Home
      </a>
    </div>
  );
}

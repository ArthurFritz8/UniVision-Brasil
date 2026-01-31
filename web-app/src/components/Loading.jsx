export default function Loading({ message = 'Carregando...' }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px]">
      <div className="spinner mb-4"></div>
      <p className="text-gray-400 animate-pulse">{message}</p>
    </div>
  );
}

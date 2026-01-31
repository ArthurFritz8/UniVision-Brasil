import { Outlet } from 'react-router-dom';

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-950 via-dark-900 to-dark-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold font-display gradient-text mb-2">
            UniVision Brasil
          </h1>
          <p className="text-gray-400">
            Sua plataforma de streaming favorita
          </p>
        </div>
        
        <Outlet />
      </div>
    </div>
  );
}

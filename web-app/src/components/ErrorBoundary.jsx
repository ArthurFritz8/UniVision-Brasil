import React from 'react';
import { logger } from '@/utils/logger';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logger.error('React render error', { componentStack: info?.componentStack }, error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-dark-950 text-white flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-dark-900 border border-dark-700 rounded-lg p-6">
            <h1 className="text-2xl font-bold mb-2">Ocorreu um erro</h1>
            <p className="text-gray-400 mb-4">
              Algo quebrou na interface. Confira o console e os logs do proxy/backend para detalhes.
            </p>
            <button
              className="btn-primary"
              onClick={() => window.location.reload()}
            >
              Recarregar
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

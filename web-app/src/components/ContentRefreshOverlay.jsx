import useAppStore from '@store/appStore';

export default function ContentRefreshOverlay() {
  const { contentRefresh, theme } = useAppStore();

  if (!contentRefresh?.isRefreshing) return null;

  const bg = theme === 'dark' ? 'bg-black/70' : 'bg-black/50';
  const card = theme === 'dark' ? 'bg-dark-900 border-dark-700' : 'bg-white border-gray-200';
  const text = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const muted = theme === 'dark' ? 'text-gray-300' : 'text-gray-600';

  const stageLabel =
    contentRefresh.stage === 'live'
      ? 'TV ao Vivo'
      : contentRefresh.stage === 'vod'
        ? 'Filmes'
        : contentRefresh.stage === 'series'
          ? 'Séries'
          : 'Preparando';

  return (
    <div className={`fixed inset-0 z-[9999] ${bg} flex items-center justify-center p-6`}>
      <div className={`w-full max-w-lg rounded-2xl border ${card} p-6 shadow-2xl`}>
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-xl bg-primary-600/20 flex items-center justify-center">
            <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
          <div className="flex-1">
            <h3 className={`text-lg font-bold ${text}`}>Atualizando conteúdo</h3>
            <p className={`text-sm ${muted} mt-1`}>{contentRefresh.message || 'Aguarde…'}</p>
            <p className={`text-xs ${muted} mt-2`}>Etapa: {stageLabel}</p>
          </div>
        </div>

        <div className="mt-5 h-2 w-full rounded-full bg-gray-200/20 overflow-hidden">
          <div className="h-full w-1/2 bg-primary-500 animate-pulse" />
        </div>

        <p className={`text-xs ${muted} mt-4`}>
          Não feche o app durante a atualização.
        </p>
      </div>
    </div>
  );
}

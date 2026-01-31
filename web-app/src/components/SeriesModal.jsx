import { useState, useEffect } from 'react';
import { X, ChevronRight, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { contentAPI } from '@services/api';
import toast from 'react-hot-toast';

export default function SeriesModal({ series, onClose }) {
  const navigate = useNavigate();
  const [seasons, setSeasons] = useState([]);
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [episodes, setEpisodes] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSeasons();
  }, [series]);

  const loadSeasons = async () => {
    try {
      setLoading(true);
      console.log('🎬 Carregando temporadas para série:', series._id, series.title);
      
      // Get series info para descobrir quantas temporadas tem
      const response = await contentAPI.getSeriesInfo({ 
        series_id: series._id 
      });
      
      console.log('🎬 Resposta getSeriesInfo:', response);
      
      if (response?.seasons && response.seasons.length > 0) {
        setSeasons(response.seasons);
        const firstSeason = response.seasons[0].season_number;
        setSelectedSeason(firstSeason);
        console.log('🎬 Carregando episódios da primeira temporada:', firstSeason);
        loadEpisodes(firstSeason);
      } else {
        console.warn('⚠️ Nenhuma temporada encontrada');
        setSeasons([]);
      }
    } catch (error) {
      console.error('❌ Erro ao carregar temporadas:', error);
      toast.error('Erro ao carregar temporadas');
    } finally {
      setLoading(false);
    }
  };

  const loadEpisodes = async (seasonNumber) => {
    try {
      setLoading(true);
      console.log('🎬 Carregando episódios:', { series_id: series._id, season_number: seasonNumber });
      
      const response = await contentAPI.getSeriesEpisodes({
        series_id: series._id,
        season_number: seasonNumber
      });
      
      console.log('🎬 Resposta getSeriesEpisodes:', response);
      setEpisodes(response?.episodes || []);
    } catch (error) {
      console.error('❌ Erro ao carregar episódios:', error);
      toast.error('Erro ao carregar episódios');
    } finally {
      setLoading(false);
    }
  };

  const handleSeasonChange = (seasonNumber) => {
    setSelectedSeason(seasonNumber);
    loadEpisodes(seasonNumber);
  };

  const handlePlayEpisode = (episode) => {
    // Salvar episode no sessionStorage para o Player usar
    sessionStorage.setItem('currentItem', JSON.stringify({
      id: episode.id || `${series._id}_${episode.episode_number}`,
      type: 'series', // Tipo correto para séries
      streamUrl: episode.streamUrl,
      title: `${series.title} - ${episode.season_number}x${String(episode.episode_number).padStart(2, '0')} - ${episode.title || `Episódio ${episode.episode_number}`}`,
      logo: series.poster,
      series_id: series._id,
      season: episode.season_number,
      episode: episode.episode_number,
    }));

    console.log('▶️ Reproduzindo episódio:', episode);
    
    // Navegar para player passando tipo e ID
    navigate(`/player/series/${episode.id}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 p-4">
      <div className="bg-dark-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-b from-dark-800 to-transparent p-6 flex items-start justify-between border-b border-dark-700">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{series.title}</h2>
            <p className="text-gray-400 line-clamp-2">{series.description}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-dark-700 rounded-lg transition"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin">
                <div className="w-12 h-12 border-4 border-dark-600 border-t-primary-500 rounded-full"></div>
              </div>
            </div>
          ) : (
            <>
              {/* Seasons */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold mb-4">Temporadas</h3>
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {seasons.map((season) => (
                    <button
                      key={season.season_number}
                      onClick={() => handleSeasonChange(season.season_number)}
                      className={`px-4 py-2 rounded-lg font-medium transition whitespace-nowrap ${
                        selectedSeason === season.season_number
                          ? 'bg-primary-600 text-white'
                          : 'bg-dark-700 text-gray-300 hover:bg-dark-600'
                      }`}
                    >
                      Temporada {season.season_number}
                      {season.episode_count && ` (${season.episode_count})`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Episodes */}
              <div>
                <h3 className="text-lg font-semibold mb-4">
                  Episódios - Temporada {selectedSeason}
                </h3>
                <div className="grid gap-3">
                  {episodes.length > 0 ? (
                    episodes.map((episode) => (
                      <div
                        key={episode.id || episode.episode_number}
                        className="bg-dark-700 rounded-lg p-4 hover:bg-dark-600 transition cursor-pointer group"
                        onClick={() => handlePlayEpisode(episode)}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <span className="text-primary-500 font-semibold">
                                {episode.season_number || selectedSeason}x{String(episode.episode_number).padStart(2, '0')}
                              </span>
                              <h4 className="font-semibold group-hover:text-primary-500 transition">
                                {episode.title || `Episódio ${episode.episode_number}`}
                              </h4>
                            </div>
                            {episode.plot && (
                              <p className="text-sm text-gray-400 line-clamp-2">
                                {episode.plot}
                              </p>
                            )}
                          </div>
                          <div className="ml-4 p-3 bg-primary-600 rounded-lg group-hover:scale-110 transition opacity-0 group-hover:opacity-100">
                            <Play size={20} fill="white" />
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12 text-gray-400">
                      Nenhum episódio encontrado para esta temporada
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { User, Mail, Calendar, Shield, Edit2, Save, X, Heart, Tv } from 'lucide-react';
import { useMemo, useState } from 'react';
import useAuthStore from '@store/authStore';
import useFavoritesStore from '@store/favoritesStore';
import useIptvStore from '@store/iptvStore';
import toast from 'react-hot-toast';
import { logger } from '@/utils/logger';

export default function Profile() {
  const { user, updateProfile } = useAuthStore();
  const favoritesCount = useFavoritesStore((s) => Object.keys(s?.favoritesByKey || {}).length);
  const credentials = useIptvStore((s) => s.credentials);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || ''
  });

  const planLabel = useMemo(() => {
    const role = String(user?.role || '').toLowerCase();
    if (!role) return 'User';
    if (role === 'admin') return 'Admin';
    if (role === 'premium') return 'Premium';
    return role.charAt(0).toUpperCase() + role.slice(1);
  }, [user?.role]);

  const isIptvConfigured = Boolean(
    credentials?.username && credentials?.password && (credentials?.apiUrl || credentials?.m3uUrl)
  );

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name.trim() || !formData.email.trim()) {
      toast.error('Preencha todos os campos');
      return;
    }

    try {
      setIsSaving(true);
      
      // Atualizar no localStorage imediatamente (já que não temos backend real)
      const updatedUser = { ...user, name: formData.name, email: formData.email };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      // Atualizar no store
      await updateProfile(formData);
      
      toast.success('Perfil atualizado com sucesso!');
      setIsEditing(false);
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
      logger.error('pages.profile.update_failed', undefined, error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || ''
    });
    setIsEditing(false);
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <p className="text-xl text-gray-400">Carregando perfil...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-4xl font-bold">Meu Perfil</h1>
          <p className="text-gray-400 mt-1">Gerencie seus dados e preferências</p>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-lg transition"
          >
            <Edit2 size={18} />
            Editar
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="card">
          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
            <div>
              <label className="block text-sm font-medium mb-2">Nome</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg transition"
              >
                <X size={18} />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 rounded-lg transition"
              >
                <Save size={18} />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="card">
          <div className="flex items-center gap-6 mb-8">
            <div className="w-24 h-24 bg-gradient-to-br from-primary-600 to-primary-800 rounded-full flex items-center justify-center text-4xl font-bold">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-2xl font-bold">{user?.name}</h2>
              <p className="text-gray-400">{user?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition min-h-[88px]">
              <Mail className="text-primary-500" size={22} />
              <div className="min-w-0">
                <p className="text-sm text-gray-400">Email</p>
                <p className="font-medium break-all truncate">{user?.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition min-h-[88px]">
              <Shield className="text-primary-500" size={22} />
              <div>
                <p className="text-sm text-gray-400">Plano</p>
                <p className="font-medium">{planLabel}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition min-h-[88px]">
              <Heart className="text-red-500" size={22} />
              <div>
                <p className="text-sm text-gray-400">Favoritos</p>
                <p className="font-medium">{favoritesCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition min-h-[88px]">
              <Tv className="text-primary-500" size={22} />
              <div>
                <p className="text-sm text-gray-400">IPTV</p>
                <p className={"font-medium " + (isIptvConfigured ? 'text-green-500' : 'text-gray-200')}>
                  {isIptvConfigured ? 'Configurado' : 'Não configurado'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition min-h-[88px]">
              <Calendar className="text-primary-500" size={22} />
              <div>
                <p className="text-sm text-gray-400">Membro desde</p>
                <p className="font-medium">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('pt-BR') : 'Hoje'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition min-h-[88px]">
              <User className="text-primary-500" size={22} />
              <div>
                <p className="text-sm text-gray-400">Status</p>
                <p className="font-medium text-green-500">Ativo</p>
              </div>
            </div>
          </div>

          <div className="mt-8 p-4 bg-primary-600/20 border border-primary-600/50 rounded-lg">
            <p className="text-sm text-primary-200">
              💡 Dica: Clique em "Editar" acima para atualizar suas informações de perfil.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

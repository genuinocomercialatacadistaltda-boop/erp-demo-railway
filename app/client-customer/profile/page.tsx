'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Mail, Phone, MapPin, FileText, Lock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Profile {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  document: string | null;
  pointsBalance: number;
  totalPointsEarned: number;
  pointsMultiplier: number;
  creditLimit: number;
  currentDebt: number;
  createdAt: string;
}

export default function ClientCustomerProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  
  // Edit fields
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  
  // Password fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await fetch('/api/client-customer/profile');
      const data = await res.json();

      if (data.success) {
        setProfile(data.profile);
        setPhone(data.profile.phone || '');
        setAddress(data.profile.address || '');
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/client-customer/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, address }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Perfil atualizado com sucesso');
        setProfile(data.profile);
      } else {
        toast.error(data.message || 'Erro ao atualizar perfil');
      }
    } catch (error) {
      toast.error('Erro ao atualizar perfil');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword !== confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter pelo menos 6 caracteres');
      return;
    }

    setChangingPassword(true);
    try {
      const res = await fetch('/api/client-customer/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (data.success) {
        toast.success('Senha alterada com sucesso');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        toast.error(data.message || 'Erro ao alterar senha');
      }
    } catch (error) {
      toast.error('Erro ao alterar senha');
    } finally {
      setChangingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Erro ao carregar perfil</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Meu Perfil</h1>
        <p className="text-gray-600 mt-2">Gerencie suas informações pessoais</p>
      </div>

      {/* Profile Info (Read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Pessoais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <User className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="font-medium">{profile.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-5 w-5 text-gray-400" />
            <div>
              <p className="text-sm text-gray-600">E-mail</p>
              <p className="font-medium">{profile.email || 'Não informado'}</p>
            </div>
          </div>
          {profile.document && (
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">CPF/CNPJ</p>
                <p className="font-medium">{profile.document}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Editable Info */}
      <Card>
        <CardHeader>
          <CardTitle>Contato e Endereço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">
              <Phone className="h-4 w-4 inline mr-2" />
              Telefone
            </Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(00) 00000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">
              <MapPin className="h-4 w-4 inline mr-2" />
              Endereço
            </Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving}>
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Lock className="h-5 w-5 inline mr-2" />
            Alterar Senha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Senha Atual</Label>
              <Input
                id="currentPassword"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">Nova Senha</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            <Button type="submit" disabled={changingPassword}>
              {changingPassword ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Account Stats */}
      <Card>
        <CardHeader>
          <CardTitle>Estatísticas da Conta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-600">Pontos disponíveis:</span>
            <span className="font-semibold text-yellow-600">
              {Math.floor(profile.pointsBalance)} pontos
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Total de pontos ganhos:</span>
            <span className="font-semibold">
              {Math.floor(profile.totalPointsEarned)} pontos
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Multiplicador:</span>
            <span className="font-semibold text-blue-600">
              {profile.pointsMultiplier}x
            </span>
          </div>
          {profile.creditLimit > 0 && (
            <div className="flex justify-between border-t pt-3">
              <span className="text-gray-600">Limite de crédito:</span>
              <span className="font-semibold text-green-600">
                R$ {profile.creditLimit.toFixed(2)}
              </span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-600">Cliente desde:</span>
            <span className="font-medium">
              {new Date(profile.createdAt).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

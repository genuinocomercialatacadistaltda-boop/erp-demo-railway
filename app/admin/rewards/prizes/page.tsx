'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Gift, Plus, Edit, Trash2, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

interface Prize {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  pointsCost: number;
  stockQuantity: number | null;
  isActive: boolean;
  category: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: {
    Redemption: number;
  };
}

export default function PrizesPage() {
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingPrize, setEditingPrize] = useState<Prize | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    imageUrl: '',
    pointsCost: '',
    stockQuantity: '',
    isActive: true,
    category: '',
    displayOrder: '0'
  });

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchPrizes();
  }, []);

  const fetchPrizes = async () => {
    try {
      const response = await fetch('/api/admin/rewards/prizes');
      if (response.ok) {
        const data = await response.json();
        setPrizes(data);
      }
    } catch (error) {
      console.error('Erro ao buscar brindes:', error);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      
      // Criar preview da imagem
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedFile) return null;

    try {
      setIsUploading(true);
      const uploadFormData = new FormData();
      uploadFormData.append('file', selectedFile);

      const response = await fetch('/api/admin/rewards/prizes/upload-image', {
        method: 'POST',
        body: uploadFormData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao fazer upload');
      }

      const data = await response.json();
      return data.cloudStoragePath;
    } catch (error: any) {
      console.error('Erro ao fazer upload:', error);
      toast.error(error.message || 'Erro ao fazer upload da imagem');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Fazer upload da imagem se houver arquivo selecionado
      let cloudStoragePath = null;
      if (selectedFile) {
        cloudStoragePath = await uploadImage();
        if (!cloudStoragePath) {
          setIsLoading(false);
          return; // Parar se o upload falhar
        }
      }

      const url = editingPrize
        ? `/api/admin/rewards/prizes/${editingPrize.id}`
        : '/api/admin/rewards/prizes';
      
      const method = editingPrize ? 'PUT' : 'POST';

      const payload: any = {
        ...formData,
        pointsCost: parseInt(formData.pointsCost),
        stockQuantity: formData.stockQuantity ? parseInt(formData.stockQuantity) : null,
        displayOrder: parseInt(formData.displayOrder)
      };

      // Adicionar cloudStoragePath se houver upload
      if (cloudStoragePath) {
        payload.cloudStoragePath = cloudStoragePath;
      }

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success(editingPrize ? 'Brinde atualizado!' : 'Brinde criado!');
        setIsDialogOpen(false);
        resetForm();
        fetchPrizes();
      } else {
        toast.error('Erro ao salvar brinde');
      }
    } catch (error) {
      console.error('Erro ao salvar brinde:', error);
      toast.error('Erro ao salvar brinde');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (prize: Prize) => {
    setEditingPrize(prize);
    setFormData({
      name: prize.name,
      description: prize.description || '',
      imageUrl: prize.imageUrl || '',
      pointsCost: prize.pointsCost.toString(),
      stockQuantity: prize.stockQuantity?.toString() || '',
      isActive: prize.isActive,
      category: prize.category || '',
      displayOrder: prize.displayOrder.toString()
    });
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este brinde?')) return;

    try {
      const response = await fetch(`/api/admin/rewards/prizes/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Brinde excluído!');
        fetchPrizes();
      } else {
        const data = await response.json();
        toast.error(data.error || 'Erro ao excluir brinde');
      }
    } catch (error) {
      console.error('Erro ao excluir brinde:', error);
      toast.error('Erro ao excluir brinde');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      imageUrl: '',
      pointsCost: '',
      stockQuantity: '',
      isActive: true,
      category: '',
      displayOrder: '0'
    });
    setEditingPrize(null);
    setSelectedFile(null);
    setPreviewUrl('');
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">🎁 Gerenciar Brindes</h1>
          <p className="text-muted-foreground mt-1">
            Cadastre e gerencie os brindes disponíveis para resgate
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Novo Brinde
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {editingPrize ? 'Editar Brinde' : 'Novo Brinde'}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do brinde
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome do Brinde *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pointsCost">Custo em Pontos *</Label>
                  <Input
                    id="pointsCost"
                    type="number"
                    min="1"
                    value={formData.pointsCost}
                    onChange={(e) => setFormData({ ...formData, pointsCost: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="imageFile">Imagem do Brinde</Label>
                <div className="space-y-2">
                  <Input
                    id="imageFile"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    onChange={handleFileChange}
                  />
                  <p className="text-xs text-gray-500">
                    Formatos aceitos: JPEG, PNG, WEBP, GIF (máx. 5MB)
                  </p>
                  
                  {/* Preview da imagem */}
                  {previewUrl && (
                    <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                      <p className="text-xs text-gray-600 mb-1">Preview:</p>
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="max-h-32 rounded object-contain"
                      />
                    </div>
                  )}
                  
                  {/* Mostrar imagem existente ao editar */}
                  {editingPrize?.imageUrl && !previewUrl && (
                    <div className="mt-2 border rounded-lg p-2 bg-gray-50">
                      <p className="text-xs text-gray-600 mb-1">Imagem atual:</p>
                      <img 
                        src={editingPrize.imageUrl} 
                        alt="Imagem atual" 
                        className="max-h-32 rounded object-contain"
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Selecione um novo arquivo para substituir
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">Quantidade em Estoque</Label>
                  <Input
                    id="stockQuantity"
                    type="number"
                    min="0"
                    value={formData.stockQuantity}
                    onChange={(e) => setFormData({ ...formData, stockQuantity: e.target.value })}
                    placeholder="Deixe vazio para ilimitado"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Input
                    id="category"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="displayOrder">Ordem de Exibição</Label>
                  <Input
                    id="displayOrder"
                    type="number"
                    min="0"
                    value={formData.displayOrder}
                    onChange={(e) => setFormData({ ...formData, displayOrder: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="isActive"
                  checked={formData.isActive}
                  onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })}
                />
                <Label htmlFor="isActive">Brinde Ativo</Label>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => {
                    setIsDialogOpen(false);
                    resetForm();
                  }}
                >
                  Cancelar
                </Button>
                <Button type="submit" disabled={isLoading || isUploading}>
                  {isUploading ? 'Enviando imagem...' : (isLoading ? 'Salvando...' : 'Salvar')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Brindes Cadastrados</CardTitle>
          <CardDescription>
            Total de {prizes.length} brinde(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]"></TableHead>
                <TableHead>Nome</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Estoque</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Resgates</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prizes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    Nenhum brinde cadastrado ainda
                  </TableCell>
                </TableRow>
              ) : (
                prizes.map((prize) => (
                  <TableRow key={prize.id}>
                    <TableCell>
                      {prize.imageUrl ? (
                        <img 
                          src={prize.imageUrl} 
                          alt={prize.name}
                          className="w-10 h-10 object-cover rounded"
                        />
                      ) : (
                        <div className="w-10 h-10 bg-gray-200 rounded flex items-center justify-center">
                          <ImageIcon className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{prize.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {prize.pointsCost.toLocaleString('pt-BR')} pts
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {prize.stockQuantity !== null 
                        ? `${prize.stockQuantity} un.`
                        : 'Ilimitado'
                      }
                    </TableCell>
                    <TableCell>{prize.category || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={prize.isActive ? 'default' : 'secondary'}>
                        {prize.isActive ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </TableCell>
                    <TableCell>{prize._count?.Redemption || 0}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEdit(prize)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDelete(prize.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

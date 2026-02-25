'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Building2, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

export default function DepartmentsPage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [departments, setDepartments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<any>(null);
  const [formData, setFormData] = useState({ name: '', code: '' });

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    if ((session?.user as any)?.userType !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadData();
  }, [session, status]);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hr/departments');
      setDepartments(await res.json());
    } catch (error) {
      toast.error('Erro ao carregar departamentos');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (department?: any) => {
    if (department) {
      setEditingDepartment(department);
      setFormData({ name: department.name, code: department.code || '' });
    } else {
      setEditingDepartment(null);
      setFormData({ name: '', code: '' });
    }
    setShowDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingDepartment ? `/api/hr/departments/${editingDepartment.id}` : '/api/hr/departments';
      const method = editingDepartment ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) throw new Error('Erro ao salvar departamento');

      toast.success(editingDepartment ? 'Departamento atualizado!' : 'Departamento cadastrado!');
      setShowDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar departamento');
    }
  };

  const handleDelete = async (department: any) => {
    if (!confirm(`Deseja realmente excluir ${department.name}?`)) return;

    try {
      const response = await fetch(`/api/hr/departments/${department.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Erro ao excluir departamento');
      toast.success('Departamento excluído!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir departamento');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
    </div>;
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Departamentos</h1>
          <p className="text-gray-500 mt-1">Gerencie os departamentos da empresa</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/admin/rh')}>
            <ArrowLeft className="w-4 h-4 mr-2" />Voltar
          </Button>
          <Button onClick={() => handleOpenDialog()}>
            <Building2 className="w-4 h-4 mr-2" />Novo Departamento
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Funcionários</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {departments.map((dept) => (
                <TableRow key={dept.id}>
                  <TableCell>{dept.name}</TableCell>
                  <TableCell>{dept.code || '-'}</TableCell>
                  <TableCell>{dept._count.employees}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => handleOpenDialog(dept)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(dept)}>
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDepartment ? 'Editar Departamento' : 'Novo Departamento'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input required value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>
              <div>
                <Label>Código</Label>
                <Input value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value })} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingDepartment ? 'Atualizar' : 'Cadastrar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

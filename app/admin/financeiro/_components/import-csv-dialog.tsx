
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ImportCsvDialogProps {
  bankAccounts: Array<{ id: string; name: string }>;
  onSuccess: () => void;
}

export function ImportCsvDialog({ bankAccounts, onSuccess }: ImportCsvDialogProps) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [bankAccountId, setBankAccountId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !bankAccountId) {
      toast.error('Selecione um arquivo e uma conta bancária');
      return;
    }

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('bankAccountId', bankAccountId);

      const response = await fetch('/api/financial/reconciliation/import-csv', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast.success(`${data.imported} transações importadas com sucesso`);
        if (data.errors && data.errors.length > 0) {
          toast.warning(`${data.errors.length} erros encontrados`);
        }
        setOpen(false);
        onSuccess();
      } else {
        toast.error(data.error || 'Erro ao importar CSV');
      }
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao importar arquivo');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Upload className="w-4 h-4 mr-2" />
          Importar Extrato CSV
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Importar Extrato Bancário</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Conta Bancária</Label>
            <Select value={bankAccountId} onValueChange={setBankAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a conta" />
              </SelectTrigger>
              <SelectContent>
                {bankAccounts.map(account => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Arquivo CSV</Label>
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Formato: data,descricao,valor,tipo (ex: 2025-11-06,Pagamento,1500.00,CREDIT)
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

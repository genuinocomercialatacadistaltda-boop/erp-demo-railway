'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Save, Percent, Loader2, CreditCard, TrendingDown } from 'lucide-react';

interface FeeConfig {
  id: string;
  cardType: 'DEBIT' | 'CREDIT';
  feePercentage: number;
  isActive: boolean;
  effectiveFrom: string;
}

export function FeeConfiguration() {
  const [fees, setFees] = useState<FeeConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [debitFee, setDebitFee] = useState('0.9');
  const [creditFee, setCreditFee] = useState('3.24');

  useEffect(() => {
    loadFees();
  }, []);

  const loadFees = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/financial/card-fees');
      if (!response.ok) throw new Error('Erro ao carregar taxas');
      
      const data = await response.json();
      setFees(data);

      // Update form with current values
      const debit = data.find((f: FeeConfig) => f.cardType === 'DEBIT');
      const credit = data.find((f: FeeConfig) => f.cardType === 'CREDIT');
      
      if (debit) setDebitFee(debit.feePercentage.toString());
      if (credit) setCreditFee(credit.feePercentage.toString());
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao carregar configurações de taxas');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveFee = async (cardType: 'DEBIT' | 'CREDIT', feePercentage: string) => {
    try {
      setSaving(true);
      
      const percentage = parseFloat(feePercentage);
      if (isNaN(percentage) || percentage < 0 || percentage > 100) {
        toast.error('Taxa deve ser um número entre 0 e 100');
        return;
      }

      const response = await fetch('/api/financial/card-fees', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardType, feePercentage: percentage }),
      });

      if (!response.ok) throw new Error('Erro ao atualizar taxa');

      toast.success(`Taxa de ${cardType === 'DEBIT' ? 'débito' : 'crédito'} atualizada com sucesso!`);
      loadFees();
    } catch (error) {
      console.error('Erro:', error);
      toast.error('Erro ao salvar taxa');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="bg-blue-100 p-2 rounded-lg">
              <TrendingDown className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-1">
                Sobre as Taxas de Cartão
              </h4>
              <p className="text-sm text-blue-800">
                As taxas configuradas aqui serão aplicadas automaticamente a todas as novas vendas com cartão.
                As taxas são descontadas do valor bruto da venda e registradas como despesas operacionais.
                O valor líquido (após as taxas) será o montante efetivamente recebido na conta Itaú.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Debit Card Fee */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 p-2 rounded-lg">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Cartão de Débito</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Taxa cobrada por transação de débito
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="debitFee">Taxa (%)</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input
                    id="debitFee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={debitFee}
                    onChange={(e) => setDebitFee(e.target.value)}
                    className="pr-8"
                  />
                  <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <Button
                  onClick={() => handleSaveFee('DEBIT', debitFee)}
                  disabled={saving}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Salvar</>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg space-y-2">
              <div className="text-sm text-gray-700">
                <strong>Exemplo:</strong> Uma venda de R$ 100,00 terá:
              </div>
              <div className="text-sm">
                • Taxa: R$ {(100 * parseFloat(debitFee) / 100).toFixed(2)}
              </div>
              <div className="text-sm">
                • Valor líquido: R$ {(100 - (100 * parseFloat(debitFee) / 100)).toFixed(2)}
              </div>
            </div>

            {fees.find(f => f.cardType === 'DEBIT') && (
              <div className="text-sm text-gray-600">
                <Badge variant="outline" className="mb-2">
                  Atual: {fees.find(f => f.cardType === 'DEBIT')!.feePercentage}%
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Credit Card Fee */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-purple-100 p-2 rounded-lg">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <CardTitle className="text-xl">Cartão de Crédito</CardTitle>
                <p className="text-sm text-gray-600 mt-1">
                  Taxa cobrada por transação de crédito
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="creditFee">Taxa (%)</Label>
              <div className="flex gap-2 mt-1">
                <div className="relative flex-1">
                  <Input
                    id="creditFee"
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={creditFee}
                    onChange={(e) => setCreditFee(e.target.value)}
                    className="pr-8"
                  />
                  <Percent className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
                </div>
                <Button
                  onClick={() => handleSaveFee('CREDIT', creditFee)}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <><Save className="w-4 h-4 mr-2" />Salvar</>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-purple-50 p-4 rounded-lg space-y-2">
              <div className="text-sm text-gray-700">
                <strong>Exemplo:</strong> Uma venda de R$ 100,00 terá:
              </div>
              <div className="text-sm">
                • Taxa: R$ {(100 * parseFloat(creditFee) / 100).toFixed(2)}
              </div>
              <div className="text-sm">
                • Valor líquido: R$ {(100 - (100 * parseFloat(creditFee) / 100)).toFixed(2)}
              </div>
            </div>

            {fees.find(f => f.cardType === 'CREDIT') && (
              <div className="text-sm text-gray-600">
                <Badge variant="outline" className="mb-2">
                  Atual: {fees.find(f => f.cardType === 'CREDIT')!.feePercentage}%
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

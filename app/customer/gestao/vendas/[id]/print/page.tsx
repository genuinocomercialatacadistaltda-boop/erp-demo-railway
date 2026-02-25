
"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  Product?: {
    id: string;
    name: string;
  };
}

interface Sale {
  id: string;
  saleNumber: string;
  totalAmount: number;
  discount: number;
  finalAmount: number;
  isPaid: boolean;
  paymentMethod: string | null;
  wasteQuantity: number | null;
  wasteNotes: string | null;
  createdAt: string;
  Items: SaleItem[];
}

export default function PrintSalePage() {
  const params = useParams();
  const router = useRouter();
  const saleId = params?.id as string;

  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (saleId) {
      fetchSale();
    }
  }, [saleId]);

  const fetchSale = async () => {
    try {
      const res = await fetch(`/api/client-management/sales/${saleId}`);
      if (!res.ok) throw new Error("Erro ao buscar venda");
      const data = await res.json();
      if (data.success) {
        setSale(data.data);
      }
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getPaymentMethodText = (method: string) => {
    const methods: Record<string, string> = {
      CASH: "Dinheiro",
      PIX: "PIX",
      CARD: "Cartão",
      FIADO: "Fiado",
    };
    return methods[method] || method;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Venda não encontrada</p>
          <Button
            onClick={() => router.back()}
            className="mt-4"
            variant="outline"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Botões de ação - não imprimem */}
      <div className="print:hidden bg-gray-50 p-4 border-b sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <Button variant="outline" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          <Button onClick={handlePrint} className="bg-orange-600 hover:bg-orange-700">
            <Printer className="h-4 w-4 mr-2" />
            Imprimir Cupom
          </Button>
        </div>
      </div>

      {/* Área de impressão */}
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-2xl mx-auto">
          {/* Cabeçalho */}
          <div className="text-center border-b-2 border-dashed border-gray-400 pb-4 mb-4">
            <h1 className="text-2xl font-bold">ESPETOS GENUÍNO</h1>
            <p className="text-lg font-semibold mt-2">CUPOM DE VENDA</p>
          </div>

          {/* Informações da Venda */}
          <div className="mb-6 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="font-semibold">Número:</span> #{sale.saleNumber}
              </div>
              <div>
                <span className="font-semibold">Data:</span>{" "}
                {format(new Date(sale.createdAt), "dd/MM/yyyy HH:mm", {
                  locale: ptBR,
                })}
              </div>
              <div className="col-span-2">
                <span className="font-semibold">Status:</span>{" "}
                <span className={sale.isPaid ? "text-green-600" : "text-red-600"}>
                  {sale.isPaid ? "PAGO" : "NÃO PAGO"}
                </span>
              </div>
            </div>
          </div>

          {/* Itens da Venda */}
          <div className="mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b-2 border-gray-400">
                  <th className="text-left py-2">Produto</th>
                  <th className="text-center py-2">Qtd</th>
                  <th className="text-right py-2">Unit.</th>
                  <th className="text-right py-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {sale.Items.map((item) => (
                  <tr key={item.id} className="border-b border-gray-300">
                    <td className="py-2">
                      {item.Product?.name || "Produto Genérico"}
                    </td>
                    <td className="text-center">{item.quantity}</td>
                    <td className="text-right">{formatCurrency(item.unitPrice)}</td>
                    <td className="text-right font-semibold">
                      {formatCurrency(item.totalPrice)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totais */}
          <div className="border-t-2 border-gray-400 pt-4 mb-6">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Subtotal:</span>
                <span>{formatCurrency(sale.totalAmount)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Desconto:</span>
                  <span>-{formatCurrency(sale.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-bold border-t-2 border-dashed border-gray-400 pt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(sale.finalAmount)}</span>
              </div>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div className="mb-6 text-sm">
            <p className="font-semibold mb-2">Forma de Pagamento:</p>
            <p className="pl-4">
              {sale.paymentMethod || "Não informado"}
            </p>
          </div>

          {/* Desperdício (se houver) */}
          {sale.wasteQuantity && sale.wasteQuantity > 0 && (
            <div className="mb-6 text-sm border-t border-gray-300 pt-4">
              <p className="font-semibold mb-1">Desperdício:</p>
              <div className="pl-4">
                <p>Quantidade: {sale.wasteQuantity}</p>
                {sale.wasteNotes && (
                  <p>Motivo: {sale.wasteNotes}</p>
                )}
              </div>
            </div>
          )}

          {/* Rodapé */}
          <div className="text-center border-t-2 border-dashed border-gray-400 pt-4 mt-6">
            <p className="text-xs text-gray-600">Obrigado pela preferência!</p>
            <p className="text-xs text-gray-600 mt-1">
              Documento não fiscal - Controle interno
            </p>
          </div>
        </div>
      </div>

      {/* Estilos de impressão */}
      <style jsx global>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          body {
            margin: 0;
            padding: 10mm;
          }

          .print\\:hidden {
            display: none !important;
          }

          /* Remove sombras e bordas de fundo na impressão */
          * {
            box-shadow: none !important;
            background-color: white !important;
            color: black !important;
          }

          /* Mantém bordas importantes */
          .border,
          .border-t,
          .border-b,
          .border-t-2,
          .border-b-2 {
            border-color: #000 !important;
          }

          /* Ajusta tamanho da fonte para impressão */
          body {
            font-size: 12pt;
          }

          h1 {
            font-size: 18pt;
          }

          .text-sm {
            font-size: 10pt;
          }

          .text-xs {
            font-size: 8pt;
          }

          .text-lg {
            font-size: 14pt;
          }

          .text-2xl {
            font-size: 16pt;
          }
        }
      `}</style>
    </>
  );
}

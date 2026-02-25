"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Star,
  Store,
  Clock,
  ArrowLeft,
  Share2,
} from "lucide-react";
import { toast } from "react-hot-toast";

export default function OrderSuccessPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug as string;
  const orderId = params?.orderId as string;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const shareOrder = () => {
    const text = `Pedido realizado com sucesso! #${orderId.slice(-6)}`;
    if (navigator.share) {
      navigator.share({
        title: "Pedido Confirmado",
        text: text,
      });
    } else {
      navigator.clipboard.writeText(text);
      toast.success("Copiado para área de transferência!");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full p-8 text-center">
        {/* Ícone de Sucesso */}
        <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckCircle className="h-12 w-12 text-green-600" />
        </div>

        {/* Mensagem */}
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          Pedido Realizado!
        </h1>
        <p className="text-slate-600 mb-6">
          Seu pedido foi enviado para o estabelecimento e está sendo preparado.
        </p>

        {/* Informações do Pedido */}
        <div className="bg-blue-50 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-slate-600">Número do Pedido:</span>
            <span className="font-mono font-bold text-slate-900">
              #{orderId.slice(-6)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">Status:</span>
            <Badge className="bg-yellow-100 text-yellow-700">
              <Clock className="h-3 w-3 mr-1" />
              Aguardando Preparo
            </Badge>
          </div>
        </div>

        {/* Aviso sobre Pontos */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Star className="h-5 w-5 text-yellow-600" />
            <p className="font-semibold text-yellow-900">
              Pontos Creditados!
            </p>
          </div>
          <p className="text-sm text-yellow-800">
            Seus pontos de fidelidade foram adicionados à sua conta. Use-os em
            suas próximas compras!
          </p>
        </div>

        {/* Botões */}
        <div className="space-y-3">
          <Button
            onClick={() => router.push(`/loja/${slug}`)}
            className="w-full"
            size="lg"
          >
            <Store className="h-5 w-5 mr-2" />
            Voltar para a Loja
          </Button>

          <Button
            onClick={shareOrder}
            variant="outline"
            className="w-full"
          >
            <Share2 className="h-4 w-4 mr-2" />
            Compartilhar
          </Button>
        </div>

        {/* Nota de Rodapé */}
        <p className="text-xs text-slate-500 mt-6">
          Em caso de dúvidas, entre em contato com o estabelecimento.
        </p>
      </Card>
    </div>
  );
}

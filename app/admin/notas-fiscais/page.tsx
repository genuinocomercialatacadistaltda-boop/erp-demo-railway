"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, FileText, Download, Eye, Plus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function NotasFiscaisPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Notas Fiscais
          </h1>
          <p className="text-gray-600">
            Gerencie as notas fiscais da empresa
          </p>
        </div>

        {/* Menu Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Relatório Diário */}
          <button
            onClick={() => router.push("/admin/notas-fiscais/relatorio-diario")}
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 text-left"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Relatório Diário
            </h3>
            <p className="text-sm text-gray-600">
              Visualize todas as vendas do dia para emitir nota fiscal consolidada
            </p>
          </button>

          {/* Emitir NF-e */}
          <button
            onClick={() => router.push("/admin/notas-fiscais/emitir")}
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 text-left"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-green-100 rounded-lg">
                <Plus className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Emitir NF-e/NFC-e
            </h3>
            <p className="text-sm text-gray-600">
              Emitir nota fiscal eletrônica manualmente
            </p>
          </button>

          {/* Notas Emitidas */}
          <button
            onClick={() => router.push("/admin/notas-fiscais/listagem")}
            className="bg-white p-6 rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 text-left"
          >
            <div className="flex items-center mb-4">
              <div className="p-3 bg-purple-100 rounded-lg">
                <FileText className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Notas Emitidas
            </h3>
            <p className="text-sm text-gray-600">
              Visualize, baixe e cancele notas fiscais emitidas
            </p>
          </button>
        </div>

        {/* Instruções */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-3">
            📋 Como Funciona
          </h3>
          <div className="space-y-2 text-sm text-blue-800">
            <p>
              <strong>1. Relatório Diário:</strong> Veja todas as vendas do dia que ainda não têm nota fiscal. Você pode emitir uma nota consolidada para consumidor final.
            </p>
            <p>
              <strong>2. Emitir NF-e/NFC-e:</strong> Emita notas fiscais individuais para clientes específicos.
            </p>
            <p>
              <strong>3. Notas Emitidas:</strong> Consulte o histórico de notas, baixe XMLs e PDFs, ou cancele notas (dentro do prazo legal).
            </p>
          </div>
        </div>

        {/* Aviso sobre API Key */}
        <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-yellow-900 mb-3">
            ⚠️ Configuração Necessária
          </h3>
          <p className="text-sm text-yellow-800 mb-3">
            Para emitir notas fiscais, você precisa configurar sua conta no Plugnotas e adicionar a API Key nas variáveis de ambiente:
          </p>
          <ol className="list-decimal list-inside space-y-1 text-sm text-yellow-800 ml-4">
            <li>Acesse <a href="https://plugnotas.com.br" target="_blank" rel="noopener noreferrer" className="underline font-semibold">plugnotas.com.br</a> e crie sua conta</li>
            <li>Faça upload do seu certificado digital A1</li>
            <li>Obtenha sua API Key no painel do Plugnotas</li>
            <li>Adicione a variável <code className="bg-yellow-100 px-2 py-1 rounded">PLUGNOTAS_API_KEY</code> no arquivo <code className="bg-yellow-100 px-2 py-1 rounded">.env</code></li>
            <li>Reinicie a aplicação</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

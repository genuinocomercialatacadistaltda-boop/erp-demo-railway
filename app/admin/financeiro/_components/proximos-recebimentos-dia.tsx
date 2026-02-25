
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DollarSign, Calendar, User } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Receivable {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  Customer: {
    name: string;
    phone: string;
  } | null;
  Order?: {
    orderNumber: string;
    casualCustomerName?: string | null;
    customerName?: string | null; // 🔧 Campo correto para cliente avulso
  } | null;
  isBoleto?: boolean;
}

interface ReceivablesByDay {
  date: string;
  dateFormatted: string;
  total: number;
  receivables: Receivable[];
  isOverdue: boolean;
  daysUntilDue: number;
}

interface Props {
  receivables: Receivable[];
}

export default function ProximosRecebimentosDia({ receivables }: Props) {
  const [selectedDay, setSelectedDay] = useState<ReceivablesByDay | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Agrupar recebimentos por dia
  const receivablesByDay: ReceivablesByDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  receivables.forEach((receivable) => {
    // Extrair apenas a parte da data (ignorar horas) para evitar problemas de timezone
    const dueDateStr = receivable.dueDate.split("T")[0]; // "2025-12-04"
    const [year, month, day] = dueDateStr.split("-").map(Number);
    const dueDate = new Date(year, month - 1, day); // Cria data local sem conversão de timezone
    dueDate.setHours(0, 0, 0, 0);
    const dateKey = dueDateStr;

    let dayGroup = receivablesByDay.find((g) => g.date === dateKey);

    if (!dayGroup) {
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      dayGroup = {
        date: dateKey,
        dateFormatted: format(dueDate, "dd/MM/yyyy", { locale: ptBR }),
        total: 0,
        receivables: [],
        isOverdue: dueDate < today,
        daysUntilDue
      };
      receivablesByDay.push(dayGroup);
    }

    dayGroup.total += receivable.amount;
    dayGroup.receivables.push(receivable);
  });

  // Ordenar por data
  receivablesByDay.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleDayClick = (day: ReceivablesByDay) => {
    setSelectedDay(day);
    setShowModal(true);
  };

  const getDayLabel = (day: ReceivablesByDay) => {
    if (day.isOverdue) return "ATRASADO";
    if (day.daysUntilDue === 0) return "VENCE HOJE";
    if (day.daysUntilDue === 1) return "VENCE AMANHÃ";
    if (day.daysUntilDue <= 7) return `${day.daysUntilDue} dias`;
    return "";
  };

  // Calcular total geral
  const totalGeral = receivablesByDay.reduce((sum, day) => sum + day.total, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Próximos Recebimentos a Vencer
            </div>
            {totalGeral > 0 && (
              <span className="text-green-600 font-bold text-lg">
                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {receivablesByDay.length > 0 ? (
            <div className="space-y-2">
              {receivablesByDay.map((day) => (
                <div
                  key={day.date}
                  onClick={() => handleDayClick(day)}
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    day.isOverdue
                      ? "bg-orange-50 dark:bg-orange-950 border-l-4 border-orange-500"
                      : day.daysUntilDue <= 3
                      ? "bg-green-50 dark:bg-green-950 border-l-4 border-green-500"
                      : "bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="font-bold text-lg">{day.dateFormatted}</p>
                      <p className="text-sm text-gray-600">
                        {day.receivables.length} recebimento{day.receivables.length > 1 ? "s" : ""}
                        {getDayLabel(day) && (
                          <span
                            className={`ml-2 font-semibold ${
                              day.isOverdue ? "text-orange-600" : "text-green-600"
                            }`}
                          >
                            • {getDayLabel(day)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-xl text-green-700 dark:text-green-400">
                    R$ {day.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhum recebimento pendente
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal de Detalhes */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Recebimentos de {selectedDay?.dateFormatted}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4 mt-4">
              {/* Total do Dia */}
              <div className={`p-4 rounded-lg ${
                selectedDay.isOverdue ? "bg-orange-100" : "bg-green-100"
              }`}>
                <p className="text-sm text-gray-600">Total do dia</p>
                <p className="text-2xl font-bold text-green-700">R$ {selectedDay.total.toFixed(2)}</p>
                <p className="text-sm mt-1">
                  {selectedDay.receivables.length} recebimento{selectedDay.receivables.length > 1 ? "s" : ""}
                  {getDayLabel(selectedDay) && (
                    <span className={`ml-2 font-semibold ${
                      selectedDay.isOverdue ? "text-orange-700" : "text-green-700"
                    }`}>
                      • {getDayLabel(selectedDay)}
                    </span>
                  )}
                </p>
              </div>

              {/* Lista de Recebimentos */}
              <div className="space-y-3">
                {selectedDay.receivables.map((receivable) => {
                  // 🔧 CORREÇÃO: Extrair nome do cliente de múltiplas fontes
                  // PRIORIDADE: casualCustomerName > customerName > Customer.name
                  // Isso porque existe um cliente cadastrado chamado "Cliente Avulso" 
                  // e o nome real fica em casualCustomerName
                  let customerName = receivable.Order?.casualCustomerName 
                    || receivable.Order?.customerName;
                  
                  // Se não tem nome no Order, usar Customer.name (mas ignorar se for "Cliente Avulso")
                  if (!customerName && receivable.Customer?.name && receivable.Customer.name !== 'Cliente Avulso') {
                    customerName = receivable.Customer.name;
                  }
                  
                  // Se ainda não tiver nome, tentar extrair da descrição
                  if (!customerName && receivable.description) {
                    const match = receivable.description.match(/- ([A-ZÀ-Ú\s]+)$/i);
                    if (match) {
                      customerName = match[1].trim();
                    }
                  }
                  
                  // Extrair número do pedido da descrição
                  const orderMatch = receivable.description?.match(/Pedido\s+(ADM-\d+|ESP[\d-]+|BOL\d+)/i);
                  const orderNumber = receivable.Order?.orderNumber || (orderMatch ? orderMatch[1] : null);
                  
                  return (
                    <div
                      key={receivable.id}
                      className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4 border-green-500"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <User className="h-4 w-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              {customerName || "Venda Avulsa"}
                            </span>
                          </div>
                          <p className="font-semibold text-lg">
                            {orderNumber ? `Pedido ${orderNumber}` : receivable.description}
                          </p>
                          {receivable.Customer?.phone && (
                            <p className="text-sm text-gray-500 mt-1">
                              📱 {receivable.Customer.phone}
                            </p>
                          )}
                        </div>
                        <span className="font-bold text-xl ml-4 text-green-700">
                          R$ {receivable.amount.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

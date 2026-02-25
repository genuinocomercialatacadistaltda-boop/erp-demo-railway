
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertCircle, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Expense {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  Category: {
    name: string;
    color: string;
  };
}

interface ExpensesByDay {
  date: string;
  dateFormatted: string;
  total: number;
  expenses: Expense[];
  isOverdue: boolean;
  daysUntilDue: number;
}

interface Props {
  expenses: Expense[];
}

export default function ProximasDespesasDia({ expenses }: Props) {
  const [selectedDay, setSelectedDay] = useState<ExpensesByDay | null>(null);
  const [showModal, setShowModal] = useState(false);

  // Agrupar despesas por dia
  const expensesByDay: ExpensesByDay[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  expenses.forEach((expense) => {
    // Extrair apenas a parte da data (ignorar horas) para evitar problemas de timezone
    const dueDateStr = expense.dueDate.split("T")[0]; // "2025-12-04"
    const [year, month, day] = dueDateStr.split("-").map(Number);
    const dueDate = new Date(year, month - 1, day); // Cria data local sem conversão de timezone
    dueDate.setHours(0, 0, 0, 0);
    const dateKey = dueDateStr;

    let dayGroup = expensesByDay.find((g) => g.date === dateKey);

    if (!dayGroup) {
      const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      
      dayGroup = {
        date: dateKey,
        dateFormatted: format(dueDate, "dd/MM/yyyy", { locale: ptBR }),
        total: 0,
        expenses: [],
        isOverdue: dueDate < today,
        daysUntilDue
      };
      expensesByDay.push(dayGroup);
    }

    dayGroup.total += expense.amount;
    dayGroup.expenses.push(expense);
  });

  // Ordenar por data
  expensesByDay.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleDayClick = (day: ExpensesByDay) => {
    setSelectedDay(day);
    setShowModal(true);
  };

  const getDayLabel = (day: ExpensesByDay) => {
    if (day.isOverdue) return "VENCIDA";
    if (day.daysUntilDue === 0) return "VENCE HOJE";
    if (day.daysUntilDue === 1) return "VENCE AMANHÃ";
    if (day.daysUntilDue <= 7) return `${day.daysUntilDue} dias`;
    return "";
  };

  // Calcular total geral
  const totalGeral = expensesByDay.reduce((sum, day) => sum + day.total, 0);

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              Próximas Despesas a Vencer
            </div>
            {totalGeral > 0 && (
              <span className="text-red-600 font-bold text-lg">
                R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {expensesByDay.length > 0 ? (
            <div className="space-y-2">
              {expensesByDay.map((day) => (
                <div
                  key={day.date}
                  onClick={() => handleDayClick(day)}
                  className={`flex items-center justify-between p-4 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    day.isOverdue
                      ? "bg-red-50 dark:bg-red-950 border-l-4 border-red-500"
                      : day.daysUntilDue <= 3
                      ? "bg-yellow-50 dark:bg-yellow-950 border-l-4 border-yellow-500"
                      : "bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-300"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-600" />
                    <div>
                      <p className="font-bold text-lg">{day.dateFormatted}</p>
                      <p className="text-sm text-gray-600">
                        {day.expenses.length} despesa{day.expenses.length > 1 ? "s" : ""}
                        {getDayLabel(day) && (
                          <span
                            className={`ml-2 font-semibold ${
                              day.isOverdue ? "text-red-600" : "text-yellow-600"
                            }`}
                          >
                            • {getDayLabel(day)}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className="font-bold text-xl text-gray-900 dark:text-white">
                    R$ {day.total.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              Nenhuma despesa pendente
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
              Despesas de {selectedDay?.dateFormatted}
            </DialogTitle>
          </DialogHeader>
          {selectedDay && (
            <div className="space-y-4 mt-4">
              {/* Total do Dia */}
              <div className={`p-4 rounded-lg ${
                selectedDay.isOverdue ? "bg-red-100" : "bg-blue-100"
              }`}>
                <p className="text-sm text-gray-600">Total do dia</p>
                <p className="text-2xl font-bold">R$ {selectedDay.total.toFixed(2)}</p>
                <p className="text-sm mt-1">
                  {selectedDay.expenses.length} despesa{selectedDay.expenses.length > 1 ? "s" : ""}
                  {getDayLabel(selectedDay) && (
                    <span className={`ml-2 font-semibold ${
                      selectedDay.isOverdue ? "text-red-700" : "text-yellow-700"
                    }`}>
                      • {getDayLabel(selectedDay)}
                    </span>
                  )}
                </p>
              </div>

              {/* Lista de Despesas */}
              <div className="space-y-3">
                {selectedDay.expenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="p-4 bg-white dark:bg-gray-800 rounded-lg border-l-4"
                    style={{ borderLeftColor: expense.Category.color }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: expense.Category.color }}
                          />
                          <span className="text-xs font-medium text-gray-500">
                            {expense.Category.name}
                          </span>
                        </div>
                        <p className="font-semibold mt-1 text-lg">{expense.description}</p>
                      </div>
                      <span className="font-bold text-xl ml-4">
                        R$ {expense.amount.toFixed(2)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Plus, Edit, Trash2, Target, Users, Star, TrendingUp, Award, Crown, Eye, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, LineChart, Line } from 'recharts';

interface Employee {
  id: string;
  name: string;
  employeeNumber: number;
  position: string;
  isSupervisor: boolean;
  isManager: boolean;
  isCEO: boolean;
}

interface QualitativeGoal {
  id: string;
  title: string;
  description: string;
  category: string;
  startDate: string;
  endDate: string;
  frequency: string;
  bonusAmount: number;
  penaltyAmount: number;
  isActive: boolean;
  employee: Employee;
  creator: Employee;
  evaluations: any[];
}

interface LeadershipEvaluation {
  id: string;
  periodStart: string;
  periodEnd: string;
  communicationRating: number;
  organizationRating: number;
  respectRating: number;
  supportRating: number;
  fairnessRating: number;
  leadershipRating: number;
  overallRating: number;
  isAnonymous: boolean;
  strengths: string;
  improvements: string;
  comments: string;
  leader: Employee;
  evaluator?: Employee;
  createdAt: string;
}

const CATEGORIES = [
  { value: 'QUALITY', label: 'Qualidade', color: 'bg-green-500' },
  { value: 'PROCESS', label: 'Processo', color: 'bg-blue-500' },
  { value: 'HYGIENE', label: 'Higiene', color: 'bg-purple-500' },
  { value: 'DELIVERY', label: 'Entrega', color: 'bg-orange-500' },
  { value: 'ORGANIZATION', label: 'Organização', color: 'bg-amber-500' },
  { value: 'OTHER', label: 'Outro', color: 'bg-gray-500' },
];

const FREQUENCIES = [
  { value: 'DAILY', label: 'Diário' },
  { value: 'WEEKLY', label: 'Semanal' },
  { value: 'MONTHLY', label: 'Mensal' },
];

export default function LeadershipPage() {
  const router = useRouter();
  const { data: session, status } = useSession() || {};
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('goals');
  
  // State for employees
  const [employees, setEmployees] = useState<Employee[]>([]);
  
  // State for qualitative goals
  const [goals, setGoals] = useState<QualitativeGoal[]>([]);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [editingGoal, setEditingGoal] = useState<QualitativeGoal | null>(null);
  const [goalForm, setGoalForm] = useState({
    title: '',
    description: '',
    category: 'QUALITY',
    employeeId: '',
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    frequency: 'DAILY',
    bonusAmount: '0',
    penaltyAmount: '0',
  });
  
  // State for leadership evaluations
  const [evaluations, setEvaluations] = useState<LeadershipEvaluation[]>([]);
  const [showEvaluationDetail, setShowEvaluationDetail] = useState(false);
  const [selectedEvaluation, setSelectedEvaluation] = useState<LeadershipEvaluation | null>(null);
  
  // State for leader performance
  const [leaderScores, setLeaderScores] = useState<any[]>([]);

  useEffect(() => {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {
      router.push('/auth/login');
      return;
    }
    const userType = (session?.user as any)?.userType;
    if (userType !== 'ADMIN') {
      router.push('/');
      return;
    }
    loadData();
  }, [session, status]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [employeesRes, goalsRes, evaluationsRes] = await Promise.all([
        fetch('/api/hr/employees'),
        fetch('/api/hr/qualitative-goals'),
        fetch('/api/hr/leadership-evaluations'),
      ]);
      
      const employeesData = await employeesRes.json();
      setEmployees(Array.isArray(employeesData) ? employeesData : []);
      
      const goalsData = await goalsRes.json();
      setGoals(Array.isArray(goalsData) ? goalsData : []);
      
      const evaluationsData = await evaluationsRes.json();
      setEvaluations(Array.isArray(evaluationsData) ? evaluationsData : []);
      
      // Load leader scores
      loadLeaderScores();
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const loadLeaderScores = async () => {
    try {
      const res = await fetch('/api/hr/leader-performance');
      const data = await res.json();
      setLeaderScores(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Erro ao carregar scores:', error);
    }
  };

  const calculateAllLeaderScores = async () => {
    const leaders = getLeaders();
    if (leaders.length === 0) {
      toast.error('Nenhum líder cadastrado');
      return;
    }

    toast.info(`Calculando scores para ${leaders.length} líder(es)...`);
    
    let successCount = 0;
    for (const leader of leaders) {
      try {
        const res = await fetch('/api/hr/leader-performance', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leaderId: leader.id,
            periodType: 'MONTHLY',
            referenceDate: new Date().toISOString()
          })
        });
        if (res.ok) successCount++;
      } catch (error) {
        console.error(`Erro ao calcular score de ${leader.name}:`, error);
      }
    }

    toast.success(`Scores calculados para ${successCount}/${leaders.length} líder(es)`);
    loadLeaderScores();
  };

  const handleOpenGoalDialog = (goal?: QualitativeGoal) => {
    if (goal) {
      setEditingGoal(goal);
      setGoalForm({
        title: goal.title,
        description: goal.description || '',
        category: goal.category,
        employeeId: goal.employee.id,
        startDate: goal.startDate.split('T')[0],
        endDate: goal.endDate ? goal.endDate.split('T')[0] : '',
        frequency: goal.frequency,
        bonusAmount: goal.bonusAmount?.toString() || '0',
        penaltyAmount: goal.penaltyAmount?.toString() || '0',
      });
    } else {
      setEditingGoal(null);
      setGoalForm({
        title: '',
        description: '',
        category: 'QUALITY',
        employeeId: '',
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        frequency: 'DAILY',
        bonusAmount: '0',
        penaltyAmount: '0',
      });
    }
    setShowGoalDialog(true);
  };

  const handleSubmitGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const url = editingGoal
        ? `/api/hr/qualitative-goals/${editingGoal.id}`
        : '/api/hr/qualitative-goals';
      const method = editingGoal ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalForm),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erro ao salvar meta');
      }

      toast.success(editingGoal ? 'Meta atualizada!' : 'Meta criada!');
      setShowGoalDialog(false);
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao salvar meta');
    }
  };

  const handleDeleteGoal = async (goalId: string) => {
    if (!confirm('Deseja realmente excluir esta meta?')) return;
    try {
      const response = await fetch(`/api/hr/qualitative-goals/${goalId}`, {
        method: 'DELETE',
      });
      if (!response.ok) throw new Error('Erro ao excluir meta');
      toast.success('Meta excluída!');
      loadData();
    } catch (error: any) {
      toast.error(error.message || 'Erro ao excluir meta');
    }
  };

  const getCategoryBadge = (category: string) => {
    const cat = CATEGORIES.find(c => c.value === category);
    return cat ? <Badge className={cat.color}>{cat.label}</Badge> : <Badge>{category}</Badge>;
  };

  const getFrequencyLabel = (frequency: string) => {
    const freq = FREQUENCIES.find(f => f.value === frequency);
    return freq ? freq.label : frequency;
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5 items-center">
        {rating === 0 && (
          <span className="text-xs text-red-500 mr-1">Péssimo</span>
        )}
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const getLeaders = () => {
    return employees.filter(e => e.isSupervisor || e.isManager || e.isCEO);
  };

  const getNonLeaders = () => {
    return employees.filter(e => !e.isSupervisor && !e.isManager && !e.isCEO);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Crown className="h-8 w-8 text-amber-500" />
            Gestão de Liderança
          </h1>
          <p className="text-gray-500 mt-1">Avaliações 360° e metas qualitativas</p>
        </div>
        <Button variant="outline" onClick={() => router.push('/admin/rh')}>
          <ArrowLeft className="w-4 h-4 mr-2" />Voltar
        </Button>
      </div>

      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Crown className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-90">CEO</p>
                <p className="text-2xl font-bold">{employees.filter(e => e.isCEO).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-amber-500 to-amber-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-90">Gerentes</p>
                <p className="text-2xl font-bold">{employees.filter(e => e.isManager).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Award className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-90">Encarregados</p>
                <p className="text-2xl font-bold">{employees.filter(e => e.isSupervisor && !e.isManager && !e.isCEO).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Star className="h-8 w-8" />
              <div>
                <p className="text-sm opacity-90">Avaliações</p>
                <p className="text-2xl font-bold">{evaluations.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="goals" className="flex items-center gap-2">
            <Target className="h-4 w-4" />Metas Qualitativas
          </TabsTrigger>
          <TabsTrigger value="evaluations" className="flex items-center gap-2">
            <Star className="h-4 w-4" />Avaliações Recebidas
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />Desempenho de Líderes
          </TabsTrigger>
        </TabsList>

        {/* Tab: Metas Qualitativas */}
        <TabsContent value="goals">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Metas Qualitativas</CardTitle>
              <Button onClick={() => handleOpenGoalDialog()}>
                <Plus className="w-4 h-4 mr-2" />Nova Meta
              </Button>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma meta qualitativa cadastrada</p>
                  <p className="text-sm">Crie metas como "Manter área limpa", "Sem perdas de produção", etc.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Funcionário</TableHead>
                      <TableHead>Meta</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Frequência</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Bônus/Penalidade</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {goals.map((goal) => (
                      <TableRow key={goal.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{goal.employee.name}</p>
                            <p className="text-xs text-gray-500">#{goal.employee.employeeNumber}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{goal.title}</p>
                            {goal.description && (
                              <p className="text-xs text-gray-500 truncate max-w-xs">{goal.description}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getCategoryBadge(goal.category)}</TableCell>
                        <TableCell>{getFrequencyLabel(goal.frequency)}</TableCell>
                        <TableCell>
                          <p className="text-xs">
                            {new Date(goal.startDate).toLocaleDateString('pt-BR')}
                            {goal.endDate && ` - ${new Date(goal.endDate).toLocaleDateString('pt-BR')}`}
                          </p>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            {goal.bonusAmount > 0 && (
                              <span className="text-xs text-green-600">+R$ {goal.bonusAmount.toFixed(2)}</span>
                            )}
                            {goal.penaltyAmount > 0 && (
                              <span className="text-xs text-red-600">-R$ {goal.penaltyAmount.toFixed(2)}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleOpenGoalDialog(goal)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => handleDeleteGoal(goal.id)}>
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Avaliações Recebidas */}
        <TabsContent value="evaluations">
          <Card>
            <CardHeader>
              <CardTitle>Avaliações de Liderança Recebidas</CardTitle>
            </CardHeader>
            <CardContent>
              {evaluations.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Star className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma avaliação recebida ainda</p>
                  <p className="text-sm">As avaliações aparecerão aqui quando os funcionários avaliarem seus líderes</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Líder Avaliado</TableHead>
                      <TableHead>Avaliador</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead>Nota Geral</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Detalhes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {evaluations.map((evaluation) => (
                      <TableRow key={evaluation.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <p className="font-medium">{evaluation.leader.name}</p>
                              <div className="flex gap-1">
                                {evaluation.leader.isCEO && <Badge className="bg-red-600 text-[10px]">CEO</Badge>}
                                {evaluation.leader.isManager && <Badge className="bg-amber-500 text-[10px]">Gerente</Badge>}
                                {evaluation.leader.isSupervisor && !evaluation.leader.isManager && !evaluation.leader.isCEO && <Badge className="bg-purple-500 text-[10px]">Encarregado</Badge>}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {evaluation.isAnonymous ? (
                            <span className="text-gray-500 italic">Anônimo</span>
                          ) : evaluation.evaluator ? (
                            <span>{evaluation.evaluator.name}</span>
                          ) : (
                            <span className="text-gray-500">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <p className="text-xs">
                            {new Date(evaluation.periodStart).toLocaleDateString('pt-BR')} - {new Date(evaluation.periodEnd).toLocaleDateString('pt-BR')}
                          </p>
                        </TableCell>
                        <TableCell>{renderStars(evaluation.overallRating)}</TableCell>
                        <TableCell>
                          {new Date(evaluation.createdAt).toLocaleDateString('pt-BR')}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedEvaluation(evaluation);
                              setShowEvaluationDetail(true);
                            }}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Desempenho de Líderes */}
        <TabsContent value="performance">
          <div className="space-y-6">
            {/* Gráfico de Barras - Comparativo de Líderes */}
            {getLeaders().length > 0 && evaluations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Comparativo de Desempenho
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={getLeaders().map((leader) => {
                      const leaderEvaluations = evaluations.filter(e => e.leader.id === leader.id);
                      return {
                        name: leader.name.split(' ')[0],
                        comunicacao: leaderEvaluations.length > 0 
                          ? leaderEvaluations.reduce((sum, e) => sum + e.communicationRating, 0) / leaderEvaluations.length 
                          : 0,
                        organizacao: leaderEvaluations.length > 0 
                          ? leaderEvaluations.reduce((sum, e) => sum + e.organizationRating, 0) / leaderEvaluations.length 
                          : 0,
                        respeito: leaderEvaluations.length > 0 
                          ? leaderEvaluations.reduce((sum, e) => sum + e.respectRating, 0) / leaderEvaluations.length 
                          : 0,
                        lideranca: leaderEvaluations.length > 0 
                          ? leaderEvaluations.reduce((sum, e) => sum + e.leadershipRating, 0) / leaderEvaluations.length 
                          : 0,
                        geral: leaderEvaluations.length > 0 
                          ? leaderEvaluations.reduce((sum, e) => sum + e.overallRating, 0) / leaderEvaluations.length 
                          : 0,
                      };
                    })}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis domain={[0, 5]} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="comunicacao" name="Comunicação" fill="#3b82f6" />
                      <Bar dataKey="organizacao" name="Organização" fill="#10b981" />
                      <Bar dataKey="respeito" name="Respeito" fill="#8b5cf6" />
                      <Bar dataKey="lideranca" name="Liderança" fill="#f59e0b" />
                      <Bar dataKey="geral" name="Geral" fill="#ef4444" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {/* Gráfico Radar - Perfil de cada líder */}
            {getLeaders().length > 0 && evaluations.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {getLeaders().map((leader) => {
                  const leaderEvaluations = evaluations.filter(e => e.leader.id === leader.id);
                  if (leaderEvaluations.length === 0) return null;
                  
                  const radarData = [
                    { subject: 'Comunicação', value: leaderEvaluations.reduce((sum, e) => sum + e.communicationRating, 0) / leaderEvaluations.length },
                    { subject: 'Organização', value: leaderEvaluations.reduce((sum, e) => sum + e.organizationRating, 0) / leaderEvaluations.length },
                    { subject: 'Respeito', value: leaderEvaluations.reduce((sum, e) => sum + e.respectRating, 0) / leaderEvaluations.length },
                    { subject: 'Suporte', value: leaderEvaluations.reduce((sum, e) => sum + e.supportRating, 0) / leaderEvaluations.length },
                    { subject: 'Justiça', value: leaderEvaluations.reduce((sum, e) => sum + e.fairnessRating, 0) / leaderEvaluations.length },
                    { subject: 'Liderança', value: leaderEvaluations.reduce((sum, e) => sum + e.leadershipRating, 0) / leaderEvaluations.length },
                  ];
                  
                  return (
                    <Card key={leader.id} className="border-l-4" style={{
                      borderLeftColor: leader.isCEO ? '#dc2626' : leader.isManager ? '#f59e0b' : '#8b5cf6'
                    }}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          {leader.name}
                          {leader.isCEO && <Badge className="bg-red-600 text-[10px]">CEO</Badge>}
                          {leader.isManager && <Badge className="bg-amber-500 text-[10px]">Gerente</Badge>}
                          {leader.isSupervisor && !leader.isManager && !leader.isCEO && <Badge className="bg-purple-500 text-[10px]">Encarregado</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={200}>
                          <RadarChart data={radarData}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10 }} />
                            <PolarRadiusAxis domain={[0, 5]} />
                            <Radar 
                              name={leader.name} 
                              dataKey="value" 
                              stroke={leader.isCEO ? '#dc2626' : leader.isManager ? '#f59e0b' : '#8b5cf6'} 
                              fill={leader.isCEO ? '#dc2626' : leader.isManager ? '#f59e0b' : '#8b5cf6'} 
                              fillOpacity={0.3} 
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                        <p className="text-center text-xs text-gray-500">{leaderEvaluations.length} avaliação(ões)</p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}

            {/* Lista de Líderes com Detalhes */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Ranking de Líderes</CardTitle>
                <Button onClick={calculateAllLeaderScores} variant="outline" size="sm">
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Recalcular Scores
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getLeaders()
                    .map((leader) => {
                      const leaderEvaluations = evaluations.filter(e => e.leader.id === leader.id);
                      const avgRating = leaderEvaluations.length > 0
                        ? leaderEvaluations.reduce((sum, e) => sum + e.overallRating, 0) / leaderEvaluations.length
                        : 0;
                      return { ...leader, avgRating, evalCount: leaderEvaluations.length };
                    })
                    .sort((a, b) => b.avgRating - a.avgRating)
                    .map((leader, index) => (
                      <Card key={leader.id} className="border-l-4" style={{
                        borderLeftColor: leader.isCEO ? '#dc2626' : leader.isManager ? '#f59e0b' : '#8b5cf6'
                      }}>
                        <CardContent className="pt-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${
                                index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : index === 2 ? 'bg-amber-700' : 'bg-gray-300'
                              }`}>
                                {index + 1}
                              </div>
                              <div>
                                <p className="font-bold">{leader.name}</p>
                                <p className="text-sm text-gray-500">#{leader.employeeNumber} - {leader.position}</p>
                              </div>
                              <div className="flex gap-1">
                                {leader.isCEO && <Badge className="bg-red-600">👑 CEO</Badge>}
                                {leader.isManager && <Badge className="bg-amber-500">👔 Gerente</Badge>}
                                {leader.isSupervisor && !leader.isManager && !leader.isCEO && <Badge className="bg-purple-500">Encarregado</Badge>}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-2">
                                {renderStars(Math.round(leader.avgRating))}
                                <span className="text-lg font-bold">{leader.avgRating.toFixed(1)}</span>
                              </div>
                              <p className="text-xs text-gray-500">{leader.evalCount} avaliação(ões)</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  
                  {getLeaders().length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Nenhum líder cadastrado</p>
                      <p className="text-sm">Marque funcionários como Supervisor, Gerente ou CEO na página de funcionários</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog: Nova/Editar Meta Qualitativa */}
      <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingGoal ? 'Editar Meta Qualitativa' : 'Nova Meta Qualitativa'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmitGoal}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label>Funcionário *</Label>
                <Select
                  value={goalForm.employeeId}
                  onValueChange={(value) => setGoalForm({ ...goalForm, employeeId: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o funcionário..." /></SelectTrigger>
                  <SelectContent>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        {emp.name} (#{emp.employeeNumber})
                        {emp.isCEO && ' 👑'}
                        {emp.isManager && ' 👔'}
                        {emp.isSupervisor && !emp.isManager && !emp.isCEO && ' ⭐'}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Título da Meta *</Label>
                <Input
                  required
                  placeholder="Ex: Manter área de trabalho limpa"
                  value={goalForm.title}
                  onChange={(e) => setGoalForm({ ...goalForm, title: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Descrição</Label>
                <Textarea
                  placeholder="Descreva os critérios de avaliação..."
                  value={goalForm.description}
                  onChange={(e) => setGoalForm({ ...goalForm, description: e.target.value })}
                />
              </div>
              <div>
                <Label>Categoria</Label>
                <Select
                  value={goalForm.category}
                  onValueChange={(value) => setGoalForm({ ...goalForm, category: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Frequência de Avaliação</Label>
                <Select
                  value={goalForm.frequency}
                  onValueChange={(value) => setGoalForm({ ...goalForm, frequency: value })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((freq) => (
                      <SelectItem key={freq.value} value={freq.value}>{freq.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de Início</Label>
                <Input
                  type="date"
                  value={goalForm.startDate}
                  onChange={(e) => setGoalForm({ ...goalForm, startDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Data de Término (opcional)</Label>
                <Input
                  type="date"
                  value={goalForm.endDate}
                  onChange={(e) => setGoalForm({ ...goalForm, endDate: e.target.value })}
                />
              </div>
              <div>
                <Label>Bônus por Atingimento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={goalForm.bonusAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, bonusAmount: e.target.value })}
                />
                <p className="text-xs text-green-600 mt-1">Valor adicionado ao salário se meta for atingida</p>
              </div>
              <div>
                <Label>Penalidade por Não Atingimento (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={goalForm.penaltyAmount}
                  onChange={(e) => setGoalForm({ ...goalForm, penaltyAmount: e.target.value })}
                />
                <p className="text-xs text-red-600 mt-1">Valor descontado se meta não for atingida</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowGoalDialog(false)}>
                Cancelar
              </Button>
              <Button type="submit">{editingGoal ? 'Atualizar' : 'Criar'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Dialog: Detalhes da Avaliação */}
      <Dialog open={showEvaluationDetail} onOpenChange={setShowEvaluationDetail}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Avaliação</DialogTitle>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Líder Avaliado</Label>
                  <p className="font-medium">{selectedEvaluation.leader.name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Avaliador</Label>
                  <p className="font-medium">
                    {selectedEvaluation.isAnonymous ? 'Anônimo' : selectedEvaluation.evaluator?.name || '-'}
                  </p>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <h4 className="font-semibold mb-3">Notas por Critério</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex justify-between items-center">
                    <span>Comunicação</span>
                    {renderStars(selectedEvaluation.communicationRating)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Organização</span>
                    {renderStars(selectedEvaluation.organizationRating)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Respeito</span>
                    {renderStars(selectedEvaluation.respectRating)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Suporte</span>
                    {renderStars(selectedEvaluation.supportRating)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Justiça</span>
                    {renderStars(selectedEvaluation.fairnessRating)}
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Liderança</span>
                    {renderStars(selectedEvaluation.leadershipRating)}
                  </div>
                </div>
              </div>
              
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <span className="font-semibold">Nota Geral</span>
                  <div className="flex items-center gap-2">
                    {renderStars(selectedEvaluation.overallRating)}
                    <span className="text-xl font-bold">{selectedEvaluation.overallRating}</span>
                  </div>
                </div>
              </div>
              
              {selectedEvaluation.strengths && (
                <div>
                  <Label className="text-gray-500">Pontos Fortes</Label>
                  <p className="bg-green-50 p-3 rounded-lg text-green-800">{selectedEvaluation.strengths}</p>
                </div>
              )}
              
              {selectedEvaluation.improvements && (
                <div>
                  <Label className="text-gray-500">Pontos a Melhorar</Label>
                  <p className="bg-orange-50 p-3 rounded-lg text-orange-800">{selectedEvaluation.improvements}</p>
                </div>
              )}
              
              {selectedEvaluation.comments && (
                <div>
                  <Label className="text-gray-500">Comentários Adicionais</Label>
                  <p className="bg-gray-50 p-3 rounded-lg">{selectedEvaluation.comments}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

'use client'

import { useState, useEffect } from 'react'
import { format, startOfWeek, endOfWeek } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { toast } from 'sonner'
import {
  Star,
  Users,
  MessageSquare,
  Eye,
  EyeOff,
  Send,
  ThumbsUp,
  ThumbsDown,
  Award,
  Crown,
  UserCircle,
  Shield
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

interface Leader {
  id: string
  name: string
  position: string
  isSupervisor: boolean
  isManager: boolean
  isCEO: boolean
  leaderType: string
  teamSize: number
}

interface LeadershipEvaluationProps {
  employeeId: string
  employeeName: string
}

const CRITERIA = [
  { key: 'communication', label: 'Comunicação', description: 'Clareza na comunicação e repasse de informações' },
  { key: 'organization', label: 'Organização', description: 'Planejamento e organização do trabalho' },
  { key: 'respect', label: 'Respeito', description: 'Tratamento respeitoso com a equipe' },
  { key: 'support', label: 'Suporte', description: 'Apoio e auxílio ao time quando necessário' },
  { key: 'fairness', label: 'Justiça', description: 'Imparcialidade nas decisões' },
  { key: 'leadership', label: 'Liderança', description: 'Capacidade de liderar e motivar a equipe' },
]

function StarRating({ value, onChange, size = 'md' }: { value: number, onChange: (v: number) => void, size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'w-8 h-8' : size === 'md' ? 'w-6 h-6' : 'w-5 h-5'
  
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          className="focus:outline-none transition-transform hover:scale-110"
        >
          <Star
            className={`${sizeClass} ${star <= value ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}`}
          />
        </button>
      ))}
    </div>
  )
}

function getLeaderIcon(leader: Leader) {
  if (leader.isCEO) return <Crown className="w-5 h-5 text-yellow-500" />
  if (leader.isManager) return <Shield className="w-5 h-5 text-blue-500" />
  return <UserCircle className="w-5 h-5 text-green-500" />
}

function getLeaderBadge(leader: Leader) {
  if (leader.isCEO) return <Badge className="bg-yellow-100 text-yellow-700">CEO</Badge>
  if (leader.isManager) return <Badge className="bg-blue-100 text-blue-700">Gerente</Badge>
  return <Badge className="bg-green-100 text-green-700">Encarregado</Badge>
}

export function LeadershipEvaluation({ employeeId, employeeName }: LeadershipEvaluationProps) {
  const [leaders, setLeaders] = useState<Leader[]>([])
  const [loading, setLoading] = useState(true)
  const [showEvaluationDialog, setShowEvaluationDialog] = useState(false)
  const [selectedLeader, setSelectedLeader] = useState<Leader | null>(null)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [ratings, setRatings] = useState<Record<string, number>>({
    communication: 3,
    organization: 3,
    respect: 3,
    support: 3,
    fairness: 3,
    leadership: 3,
    overallRating: 3
  })
  const [strengths, setStrengths] = useState('')
  const [improvements, setImprovements] = useState('')
  const [comments, setComments] = useState('')

  // Week info
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(today, { weekStartsOn: 1 })

  useEffect(() => {
    fetchLeaders()
  }, [])

  const fetchLeaders = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/hr/leaders')
      if (res.ok) {
        const data = await res.json()
        setLeaders(data)
      }
    } catch (error) {
      console.error('Erro ao buscar líderes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenEvaluation = (leader: Leader) => {
    setSelectedLeader(leader)
    setIsAnonymous(false)
    setRatings({
      communication: 3,
      organization: 3,
      respect: 3,
      support: 3,
      fairness: 3,
      leadership: 3,
      overallRating: 3
    })
    setStrengths('')
    setImprovements('')
    setComments('')
    setShowEvaluationDialog(true)
  }

  const handleSubmitEvaluation = async () => {
    if (!selectedLeader) return

    try {
      setSubmitting(true)

      const res = await fetch('/api/hr/leadership-evaluations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leaderId: selectedLeader.id,
          isAnonymous,
          weekStart: weekStart.toISOString(),
          weekEnd: weekEnd.toISOString(),
          ...ratings,
          strengths: strengths || null,
          improvements: improvements || null,
          comments: comments || null
        })
      })

      if (res.ok) {
        toast.success(
          isAnonymous 
            ? '✅ Avaliação anônima enviada com sucesso!' 
            : `✅ Avaliação de ${selectedLeader.name} enviada!`
        )
        setShowEvaluationDialog(false)
      } else {
        const error = await res.json()
        toast.error(error.error || 'Erro ao enviar avaliação')
      }
    } catch (error) {
      console.error('Erro ao enviar avaliação:', error)
      toast.error('Erro ao enviar avaliação')
    } finally {
      setSubmitting(false)
    }
  }

  const averageRating = () => {
    const values = Object.values(ratings)
    return (values.reduce((a, b) => a + b, 0) / values.length).toFixed(1)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="w-5 h-5 text-purple-500" />
            Avaliar Liderança
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Award className="w-5 h-5 text-purple-500" />
          Avaliar Liderança
        </CardTitle>
        <CardDescription>
          Avalie seus líderes semanalmente. Sua opinião ajuda a melhorar o ambiente de trabalho.
          <br />
          <span className="text-xs text-muted-foreground">
            Semana: {format(weekStart, "dd/MM", { locale: ptBR })} a {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
          </span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        {leaders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Nenhum líder cadastrado para avaliar.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {leaders.map((leader) => (
              <div
                key={leader.id}
                className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-white border rounded-lg hover:shadow-md transition-all"
              >
                <div className="flex items-center gap-3">
                  {getLeaderIcon(leader)}
                  <div>
                    <p className="font-medium">{leader.name}</p>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{leader.position}</span>
                      {getLeaderBadge(leader)}
                    </div>
                  </div>
                </div>
                <Button
                  onClick={() => handleOpenEvaluation(leader)}
                  variant="outline"
                  className="gap-2"
                >
                  <Star className="w-4 h-4" />
                  Avaliar
                </Button>
              </div>
            ))}
          </div>
        )}

        {/* Dialog de Avaliação */}
        <Dialog open={showEvaluationDialog} onOpenChange={setShowEvaluationDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500" />
                Avaliar {selectedLeader?.name}
              </DialogTitle>
              <DialogDescription>
                Semana: {format(weekStart, "dd/MM", { locale: ptBR })} a {format(weekEnd, "dd/MM/yyyy", { locale: ptBR })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4">
              {/* Modo Anônimo */}
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                <div className="flex items-center gap-3">
                  {isAnonymous ? (
                    <EyeOff className="w-5 h-5 text-purple-600" />
                  ) : (
                    <Eye className="w-5 h-5 text-gray-400" />
                  )}
                  <div>
                    <p className="font-medium">Avaliação Anônima</p>
                    <p className="text-xs text-muted-foreground">
                      {isAnonymous 
                        ? 'Seu nome NÃO será mostrado ao líder' 
                        : 'Seu nome será mostrado ao líder'
                      }
                    </p>
                  </div>
                </div>
                <Checkbox
                  checked={isAnonymous}
                  onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                />
              </div>

              {/* Critérios de Avaliação */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm text-gray-700 uppercase tracking-wide">Critérios</h4>
                
                {CRITERIA.map((criterion) => (
                  <div key={criterion.key} className="flex items-center justify-between py-2 border-b">
                    <div>
                      <p className="font-medium">{criterion.label}</p>
                      <p className="text-xs text-muted-foreground">{criterion.description}</p>
                    </div>
                    <StarRating
                      value={ratings[criterion.key]}
                      onChange={(v) => setRatings({ ...ratings, [criterion.key]: v })}
                    />
                  </div>
                ))}
              </div>

              {/* Nota Geral */}
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-yellow-800">Nota Geral</p>
                    <p className="text-xs text-yellow-600">Sua avaliação geral deste líder</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating
                      value={ratings.overallRating}
                      onChange={(v) => setRatings({ ...ratings, overallRating: v })}
                      size="lg"
                    />
                    <span className="font-bold text-2xl text-yellow-700">{ratings.overallRating}</span>
                  </div>
                </div>
              </div>

              {/* Campos de Texto */}
              <Tabs defaultValue="strengths" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="strengths" className="gap-1">
                    <ThumbsUp className="w-4 h-4" /> Pontos Fortes
                  </TabsTrigger>
                  <TabsTrigger value="improvements" className="gap-1">
                    <ThumbsDown className="w-4 h-4" /> Melhorar
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="gap-1">
                    <MessageSquare className="w-4 h-4" /> Comentários
                  </TabsTrigger>
                </TabsList>
                
                <TabsContent value="strengths" className="mt-4">
                  <Textarea
                    placeholder="O que este líder faz bem? Quais são seus pontos fortes?"
                    value={strengths}
                    onChange={(e) => setStrengths(e.target.value)}
                    className="min-h-[100px]"
                  />
                </TabsContent>
                
                <TabsContent value="improvements" className="mt-4">
                  <Textarea
                    placeholder="O que poderia melhorar? Sugestões construtivas..."
                    value={improvements}
                    onChange={(e) => setImprovements(e.target.value)}
                    className="min-h-[100px]"
                  />
                </TabsContent>
                
                <TabsContent value="comments" className="mt-4">
                  <Textarea
                    placeholder="Outros comentários ou observações..."
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    className="min-h-[100px]"
                  />
                </TabsContent>
              </Tabs>

              {/* Resumo */}
              <div className="p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-2">Resumo da Avaliação</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Média geral:</span>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-bold">{averageRating()}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-sm text-muted-foreground">Modo:</span>
                  <Badge variant={isAnonymous ? 'secondary' : 'outline'}>
                    {isAnonymous ? '🔒 Anônimo' : `👤 ${employeeName}`}
                  </Badge>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowEvaluationDialog(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmitEvaluation}
                  disabled={submitting}
                  className="flex-1 gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {submitting ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Enviar Avaliação
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}

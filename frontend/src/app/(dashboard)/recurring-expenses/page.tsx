"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { recurringExpensesApi, categoriesApi } from "@/lib/api"
import { useTranslations, useLocale } from 'next-intl';
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Trash2, Edit, Plus, Play } from "lucide-react"
import { toast } from "sonner"

interface RecurringExpense {
  id: number
  category_id: number
  amount: number
  description: string
  frequency: string
  day_of_month?: number
  day_of_week?: number
  start_date: string
  end_date?: string
  is_active: boolean
  next_due_date?: string
  category_name: string
  category_icon: string
  category_color: string
}

interface Category {
  id: number
  name: string
  icon: string
  color: string
}

export default function RecurringExpensesPage() {
  const t = useTranslations('RecurringExpenses');
  const tCommon = useTranslations('Common');
  const locale = useLocale();

  const WEEKDAYS = [
    { value: 0, label: tCommon('days.monday') },
    { value: 1, label: tCommon('days.tuesday') },
    { value: 2, label: tCommon('days.wednesday') },
    { value: 3, label: tCommon('days.thursday') },
    { value: 4, label: tCommon('days.friday') },
    { value: 5, label: tCommon('days.saturday') },
    { value: 6, label: tCommon('days.sunday') },
  ];
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  
  const [formData, setFormData] = useState({
    category_id: "",
    amount: "",
    description: "",
    frequency: "monthly",
    day_of_month: "",
    day_of_week: "",
    start_date: new Date().toISOString().split("T")[0],
    end_date: "",
    is_active: true,
  })

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [recurringResponse, categoriesResponse] = await Promise.all([
        recurringExpensesApi.getAll(),
        categoriesApi.getAll(),
      ])
      setRecurringExpenses(recurringResponse.data)
      setCategories(categoriesResponse.data)
    } catch (error) {
      toast.error(t('failedToLoad'));
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {
        category_id: parseInt(formData.category_id),
        amount: parseFloat(formData.amount),
        description: formData.description,
        frequency: formData.frequency,
        start_date: formData.start_date,
        is_active: formData.is_active,
      }

      if (formData.frequency === "monthly") {
        data.day_of_month = parseInt(formData.day_of_month)
      } else if (formData.frequency === "weekly") {
        data.day_of_week = parseInt(formData.day_of_week)
      }

      if (formData.end_date) {
        data.end_date = formData.end_date
      }

      if (editingId) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await recurringExpensesApi.update(editingId, data as any)
        toast.success(t('successUpdate'))
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await recurringExpensesApi.create(data as any)
        toast.success(t('successCreate'))
      }

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.response?.data?.detail || t('failedSave'))
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('confirmDelete'))) return
    
    try {
      await recurringExpensesApi.delete(id)
      toast.success(t('successDelete'))
      fetchData()
    } catch (error) {
      toast.error(t('failedDelete'))
    }
  }

  const handleCreateExpense = async (id: number) => {
    try {
      const response = await recurringExpensesApi.createExpense(id)
      toast.success(t('successExpenseCreated', { date: response.data.date }))
      fetchData()
    } catch (error) {
       // eslint-disable-next-line @typescript-eslint/no-explicit-any
      toast.error((error as any)?.response?.data?.detail || t('failedCreateExpense'))
    }
  }

  const resetForm = () => {
    setFormData({
      category_id: "",
      amount: "",
      description: "",
      frequency: "monthly",
      day_of_month: "",
      day_of_week: "",
      start_date: new Date().toISOString().split("T")[0],
      end_date: "",
      is_active: true,
    })
    setEditingId(null)
  }

  const openEditDialog = (recurring: RecurringExpense) => {
    setFormData({
      category_id: recurring.category_id.toString(),
      amount: recurring.amount.toString(),
      description: recurring.description,
      frequency: recurring.frequency,
      day_of_month: recurring.day_of_month?.toString() || "",
      day_of_week: recurring.day_of_week?.toString() || "",
      start_date: recurring.start_date,
      end_date: recurring.end_date || "",
      is_active: recurring.is_active,
    })
    setEditingId(recurring.id)
    setDialogOpen(true)
  }

  const getFrequencyBadge = (frequency: string) => {
    const colors: Record<string, string> = {
      monthly: "bg-blue-500",
      weekly: "bg-green-500",
      yearly: "bg-purple-500",
    }
    return (
      <Badge className={`${colors[frequency]} text-white`}>
        {t(frequency)}
      </Badge>
    )
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">{t('subtitle')}</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              {t('newTemplate')}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? t('editTemplate') : t('createTemplate')}</DialogTitle>
              <DialogDescription>
                {t('templateDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{tCommon('category')}</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tCommon('category')} />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()}>
                        {cat.icon} {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{tCommon('description')}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>{tCommon('amount')} ({locale === 'vi' ? 'VND' : 'USD'})</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>{t('frequency')}</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">{t('monthly')}</SelectItem>
                    <SelectItem value="weekly">{t('weekly')}</SelectItem>
                    <SelectItem value="yearly">{t('yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.frequency === "monthly" && (
                <div>
                  <Label>{t('dayOfMonth')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                    required
                  />
                </div>
              )}

              {formData.frequency === "weekly" && (
                <div>
                  <Label>{t('dayOfWeek')}</Label>
                  <Select
                    value={formData.day_of_week}
                    onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectDay')} />
                    </SelectTrigger>
                    <SelectContent>
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('startDate')}</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>{t('endDate')}</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                {editingId ? t('update') : t('create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {recurringExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">{t('noRecurring')}</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              {t('createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recurringExpenses.map((recurring) => (
            <Card key={recurring.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{recurring.category_icon}</span>
                    <div>
                      <CardTitle className="text-lg">{recurring.description}</CardTitle>
                      <CardDescription>{recurring.category_name}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(recurring)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(recurring.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-2xl font-bold">
                    {new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
                      style: 'currency',
                      currency: locale === 'vi' ? 'VND' : 'USD',
                    }).format(recurring.amount)}
                  </div>
                  
                  {getFrequencyBadge(recurring.frequency)}

                  {recurring.next_due_date && (
                    <div className="text-sm text-muted-foreground">
                      {t('nextDue')} {new Date(recurring.next_due_date).toLocaleDateString()}
                    </div>
                  )}

                  {recurring.is_active && recurring.next_due_date && (
                    <Button
                      className="w-full"
                      onClick={() => handleCreateExpense(recurring.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {t('createExpense')}
                    </Button>
                  )}

                  {!recurring.is_active && (
                    <Badge variant="secondary">{t('inactive')}</Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

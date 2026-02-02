"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { recurringExpensesApi, categoriesApi } from "@/lib/api"
import { useTranslations, useLocale } from 'next-intl';
import { isDueSoon } from "@/lib/date-utils";
import { formatCurrency } from "@/lib/utils";
import { useAuthStore } from "@/lib/stores/auth-store";
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { AmountInput } from "@/components/ui/amount-input"
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
  const { user } = useAuthStore();
  const currency = user?.currency || 'VND';

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-muted-foreground mt-1">{t('subtitle')}</p>
        </div>
        
        <div className="flex gap-2">
          {recurringExpenses.some(r => r.is_active && r.next_due_date && new Date(r.next_due_date) <= new Date()) && (
            <Button 
                onClick={async () => {
                    const due = recurringExpenses.filter(r => r.is_active && r.next_due_date && new Date(r.next_due_date) <= new Date());
                    let successCount = 0;
                    const toastId = toast.loading(t('processing', { count: due.length }));
                    
                    for (const item of due) {
                        try {
                            await recurringExpensesApi.createExpense(item.id);
                            successCount++;
                        } catch (e) {
                            console.error(e);
                        }
                    }
                    
                    toast.dismiss(toastId);
                    if (successCount > 0) {
                        toast.success(t('successProcessAll', { count: successCount }));
                        fetchData();
                    } else {
                        toast.error(t('failedProcessAll'));
                    }
                }}
                variant="default"
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
            >
              <Play className="mr-2 h-4 w-4" />
              {t('processAll')}
            </Button>
          )}

          <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
              <Plus className="mr-2 h-4 w-4" />
              {t('newTemplate')}
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md bg-card border-border">
            <DialogHeader>
              <DialogTitle className="text-foreground">{editingId ? t('editTemplate') : t('createTemplate')}</DialogTitle>
              <DialogDescription className="text-muted-foreground">
                {t('templateDesc')}
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-foreground">{tCommon('category')}</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  required
                >
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder={tCommon('category')} />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id.toString()} className="text-foreground hover:bg-muted">
                        <span className="flex items-center gap-2">
                          <span>{cat.icon}</span>
                          <span>{cat.name}</span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">{tCommon('description')}</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">{tCommon('amount')} ({currency})</Label>
                <AmountInput
                  value={formData.amount === "" ? 0 : parseFloat(formData.amount)}
                  onValueChange={(val) => setFormData({ ...formData, amount: val.toString() })}
                  className="bg-muted border-border text-foreground"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">{t('frequency')}</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="monthly" className="text-foreground hover:bg-muted">{t('monthly')}</SelectItem>
                    <SelectItem value="weekly" className="text-foreground hover:bg-muted">{t('weekly')}</SelectItem>
                    <SelectItem value="yearly" className="text-foreground hover:bg-muted">{t('yearly')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.frequency === "monthly" && (
                <div className="space-y-2">
                  <Label className="text-foreground">{t('dayOfMonth')}</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={formData.day_of_month}
                    onChange={(e) => setFormData({ ...formData, day_of_month: e.target.value })}
                    required
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              )}

              {formData.frequency === "weekly" && (
                <div className="space-y-2">
                  <Label className="text-foreground">{t('dayOfWeek')}</Label>
                  <Select
                    value={formData.day_of_week}
                    onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                    required
                  >
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder={t('selectDay')} />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {WEEKDAYS.map((day) => (
                        <SelectItem key={day.value} value={day.value.toString()} className="text-foreground hover:bg-muted">
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-foreground">{t('startDate')}</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-foreground">{t('endDate')}</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
                {editingId ? t('update') : t('create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {recurringExpenses.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">{t('noRecurring')}</p>
            <Button onClick={() => setDialogOpen(true)} className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600">
              <Plus className="mr-2 h-4 w-4" />
              {t('createFirst')}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {recurringExpenses.map((recurring) => (
            <Card key={recurring.id} className="bg-card border-border hover:shadow-md transition-all duration-200">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <span 
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                      style={{ backgroundColor: `${recurring.category_color}20` }}
                    >
                      {recurring.category_icon}
                    </span>
                    <div>
                      <CardTitle className="text-lg text-foreground">{recurring.description}</CardTitle>
                      <CardDescription className="text-muted-foreground">{recurring.category_name}</CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(recurring)}
                      className="text-muted-foreground hover:text-foreground hover:bg-muted"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(recurring.id)}
                      className="text-muted-foreground hover:text-red-500 hover:bg-muted"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="text-2xl font-bold text-foreground">
                    {formatCurrency(recurring.amount, currency, locale)}
                  </div>
                  
                  {getFrequencyBadge(recurring.frequency)}

                  {recurring.next_due_date && (
                    <div className={`text-sm ${isDueSoon(recurring.next_due_date) ? 'text-yellow-500 font-bold' : 'text-muted-foreground'}`}>
                      {t('nextDue')} {new Date(recurring.next_due_date).toLocaleDateString()}
                      {isDueSoon(recurring.next_due_date) && (
                        <span className="ml-2 text-xs bg-yellow-400/20 text-yellow-400 px-2 py-0.5 rounded-full">
                          Due Soon
                        </span>
                      )}
                    </div>
                  )}

                  {recurring.is_active && recurring.next_due_date && (
                    <Button
                      className={`w-full ${isDueSoon(recurring.next_due_date) ? 'bg-yellow-600 hover:bg-yellow-700 ring-1 ring-yellow-500' : 'bg-emerald-600/20 text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30'}`}
                      onClick={() => handleCreateExpense(recurring.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      {t('createExpense')}
                    </Button>
                  )}

                  {!recurring.is_active && (
                    <Badge variant="secondary" className="bg-muted text-muted-foreground">{t('inactive')}</Badge>
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

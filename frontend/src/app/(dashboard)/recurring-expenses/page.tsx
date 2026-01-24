"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { recurringExpensesApi, categoriesApi } from "@/lib/api"
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

const WEEKDAYS = [
  { value: 0, label: "Monday" },
  { value: 1, label: "Tuesday" },
  { value: 2, label: "Wednesday" },
  { value: 3, label: "Thursday" },
  { value: 4, label: "Friday" },
  { value: 5, label: "Saturday" },
  { value: 6, label: "Sunday" },
]

export default function RecurringExpensesPage() {
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
      toast.error("Failed to load data")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const data: any = {
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
        await recurringExpensesApi.update(editingId, data)
        toast.success("Recurring expense updated")
      } else {
        await recurringExpensesApi.create(data)
        toast.success("Recurring expense created")
      }

      setDialogOpen(false)
      resetForm()
      fetchData()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to save")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this recurring expense?")) return
    
    try {
      await recurringExpensesApi.delete(id)
      toast.success("Recurring expense deleted")
      fetchData()
    } catch (error) {
      toast.error("Failed to delete")
    }
  }

  const handleCreateExpense = async (id: number) => {
    try {
      const response = await recurringExpensesApi.createExpense(id)
      toast.success(`Expense created for ${response.data.date}`)
      fetchData()
    } catch (error: any) {
      toast.error(error?.response?.data?.detail || "Failed to create expense")
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
        {frequency.charAt(0).toUpperCase() + frequency.slice(1)}
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
          <h1 className="text-3xl font-bold">Recurring Expenses</h1>
          <p className="text-muted-foreground">Manage expense templates and create scheduled expenses</p>
        </div>
        
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) resetForm()
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Template
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>{editingId ? "Edit" : "Create"} Recurring Expense</DialogTitle>
              <DialogDescription>
                Set up a template for recurring expenses
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Category</Label>
                <Select
                  value={formData.category_id}
                  onValueChange={(value) => setFormData({ ...formData, category_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
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
                <Label>Description</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                />
              </div>

              <div>
                <Label>Frequency</Label>
                <Select
                  value={formData.frequency}
                  onValueChange={(value) => setFormData({ ...formData, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {formData.frequency === "monthly" && (
                <div>
                  <Label>Day of Month</Label>
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
                  <Label>Day of Week</Label>
                  <Select
                    value={formData.day_of_week}
                    onValueChange={(value) => setFormData({ ...formData, day_of_week: value })}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select day" />
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
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label>End Date (Optional)</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full">
                {editingId ? "Update" : "Create"} Template
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {recurringExpenses.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <p className="text-muted-foreground mb-4">No recurring expenses yet</p>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Your First Template
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
                  <div className="text-2xl font-bold">${recurring.amount}</div>
                  
                  {getFrequencyBadge(recurring.frequency)}

                  {recurring.next_due_date && (
                    <div className="text-sm text-muted-foreground">
                      Next due: {new Date(recurring.next_due_date).toLocaleDateString()}
                    </div>
                  )}

                  {recurring.is_active && recurring.next_due_date && (
                    <Button
                      className="w-full"
                      onClick={() => handleCreateExpense(recurring.id)}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Create Expense
                    </Button>
                  )}

                  {!recurring.is_active && (
                    <Badge variant="secondary">Inactive</Badge>
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

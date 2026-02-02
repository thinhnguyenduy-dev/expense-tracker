'use client';

import { format } from 'date-fns';
import { Pencil, Trash2, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { Expense } from '@/lib/api';
import { ExpenseCard } from './ExpenseCard';

interface ExpenseTableProps {
  expenses: Expense[];
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleSelectAll: () => void;
  onEdit: (expense: Expense) => void;
  onDelete: (id: number) => void;
  formatCurrency: (value: number) => string;
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  translations: {
    noExpenses: string;
    startTracking: string;
    addExpense: string;
    noResults: string;
    noExpensesMatching: string;
  };
  commonTranslations: {
    date: string;
    category: string;
    description: string;
    amount: string;
    actions: string;
  };
  searchQuery: string;
  onAddExpense: () => void;
}

export function ExpenseTable({
  expenses,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEdit,
  onDelete,
  formatCurrency,
  page,
  pageSize,
  total,
  totalPages,
  onPageChange,
  translations: t,
  commonTranslations: tCommon,
  searchQuery,
  onAddExpense,
}: ExpenseTableProps) {
  // Empty state
  if (expenses.length === 0) {
    return (
      <Card className="bg-card border-border">
        <CardContent className="flex flex-col items-center justify-center py-12">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Plus className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? t.noResults : t.noExpenses}
          </h3>
          <p className="text-muted-foreground text-center mb-4">
            {searchQuery
              ? t.noExpensesMatching.replace('{query}', searchQuery)
              : t.startTracking}
          </p>
          {!searchQuery && (
            <Button
              onClick={onAddExpense}
              className="bg-gradient-to-r from-emerald-500 to-teal-500"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t.addExpense}
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      {/* Mobile View */}
      <div className="md:hidden">
        {expenses.map((expense) => (
          <ExpenseCard 
            key={expense.id} 
            expense={expense} 
            onEdit={(e) => onEdit(e)} 
            onDelete={(id) => onDelete(id)} 
          />
        ))}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block bg-card border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-muted">
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === expenses.length && expenses.length > 0}
                  onCheckedChange={onToggleSelectAll}
                />
              </TableHead>
              <TableHead className="text-muted-foreground">{tCommon.date}</TableHead>
              <TableHead className="text-muted-foreground">{tCommon.category}</TableHead>
              <TableHead className="text-muted-foreground">{tCommon.description}</TableHead>
              <TableHead className="text-muted-foreground text-right">{tCommon.amount}</TableHead>
              <TableHead className="text-muted-foreground text-right">{tCommon.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {expenses.map((expense) => (
              <TableRow
                key={expense.id}
                className={cn(
                  'border-border hover:bg-muted/50',
                  selectedIds.has(expense.id) && 'bg-emerald-500/10'
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(expense.id)}
                    onCheckedChange={() => onToggleSelect(expense.id)}
                  />
                </TableCell>
                <TableCell className="text-foreground">
                  {format(new Date(expense.date), 'MMM dd, yyyy')}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-sm"
                      style={{ backgroundColor: `${expense.category?.color}20` }}
                    >
                      {expense.category?.icon}
                    </span>
                    <span className="text-foreground">{expense.category?.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-foreground max-w-xs truncate">
                  {expense.description}
                </TableCell>
                <TableCell className="text-right font-medium text-foreground">
                  {formatCurrency(Number(expense.amount))}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(expense)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onDelete(expense.id)}
                      className="h-8 w-8 text-muted-foreground hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, total)} of {total}
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.max(1, page - 1))}
              disabled={page === 1}
              className="bg-muted border-border text-foreground disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
              disabled={page === totalPages}
              className="bg-muted border-border text-foreground disabled:opacity-50"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

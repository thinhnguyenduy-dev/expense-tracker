"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JarCard } from "@/components/jars/JarCard";
import { AddIncomeModal } from "@/components/incomes/AddIncomeModal";
import { Jar, Income, jarsApi, incomesApi } from "@/lib/api";
import { Skeleton } from "@/components/ui/skeleton";

export default function JarsPage() {
  const [jars, setJars] = useState<Jar[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [loading, setLoading] = useState(true);
  const [openAddIncome, setOpenAddIncome] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [jarsData, incomesData] = await Promise.all([
        jarsApi.getAll(),
        incomesApi.getAll(),
      ]);
      setJars(jarsData.data);
      setIncomes(incomesData.data);
    } catch (error) {
      console.error("Failed to fetch jars data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <h2 className="text-3xl font-bold tracking-tight">6 Jars Method</h2>
        <div className="flex items-center space-x-2">
          <Button onClick={() => setOpenAddIncome(true)}>
            <Plus className="mr-2 h-4 w-4" /> Add Income
          </Button>
        </div>
      </div>
      
      {/* Jars Display */}
      <h3 className="text-xl font-semibold mt-6 mb-4">Your Jars</h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading
          ? Array(6)
              .fill(0)
              .map((_, i) => (
                <Card key={i}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <Skeleton className="h-4 w-[100px]" />
                    <Skeleton className="h-4 w-[40px]" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-8 w-[100px]" />
                    <Skeleton className="mt-2 h-3 w-[60px]" />
                  </CardContent>
                </Card>
              ))
          : jars.map((jar) => <JarCard key={jar.id} jar={jar} />)}
      </div>

      {/* Income History */}
      <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1 mt-8">
        <Card>
          <CardHeader>
            <CardTitle>Income History</CardTitle>
            <CardDescription>
              Recent income sources that were distributed to your jars.
            </CardDescription>
          </CardHeader>
          <CardContent>
             {loading ? (
                <div className="space-y-2">
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                  <Skeleton className="h-12 w-full" />
                </div>
             ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {incomes.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center">
                          No income recorded yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      incomes.map((income) => (
                        <TableRow key={income.id}>
                          <TableCell>
                            {format(new Date(income.date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell>{income.source}</TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(income.amount)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
             )}
          </CardContent>
        </Card>
      </div>

      <AddIncomeModal 
        open={openAddIncome} 
        onOpenChange={setOpenAddIncome}
        onSuccess={fetchData} 
      />
    </div>
  );
}

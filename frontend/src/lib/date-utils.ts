
export const isDueSoon = (nextDueDate: string, days: number = 3) => {
  if (!nextDueDate) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const due = new Date(nextDueDate);
  due.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays >= 0 && diffDays <= days;
};

"use client";
import { Download, Printer } from "lucide-react";
export function ReportActions({ month }: { month:string }) { return <div className="no-print flex gap-2"><a href={`/api/report/csv?month=${month}`} className="button-secondary"><Download aria-hidden size={18}/>ייצוא לקובץ</a><button onClick={() => window.print()} className="button-secondary"><Printer aria-hidden size={18}/>הדפסה</button></div>; }

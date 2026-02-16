"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface TableWidgetData {
  headers: string[]
  rows: string[][]
}

interface TableWidgetProps {
  id: string
  title?: string
  data: TableWidgetData
  sourceUrl?: string
}

/** Shorten long headers so the table fits on mobile without horizontal scroll */
const MOBILE_HEADER_MAP: Record<string, string> = {
  'House Value': 'Value',
  'Total Invested': 'Invested',
  'Net Sale Proceeds': 'Net Sale',
}

export function TableWidget({ title, data }: TableWidgetProps) {
  return (
    <Card className="w-full">
      <CardHeader className="px-3 py-2 sm:px-6 sm:py-4">
        <CardTitle className="text-sm sm:text-base">{title || 'Data Table'}</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Detailed breakdown</CardDescription>
      </CardHeader>
      <CardContent className="px-1.5 sm:px-6">
        <div className="rounded-md border overflow-x-auto">
          <table className="w-full text-[11px] sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {data.headers.map((header, index) => (
                  <th
                    key={index}
                    className="h-7 sm:h-10 px-1 sm:px-4 text-left align-middle font-medium text-muted-foreground"
                  >
                    <span className="hidden sm:inline">{header}</span>
                    <span className="sm:hidden">{MOBILE_HEADER_MAP[header] || header}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, rowIndex) => (
                <tr
                  key={rowIndex}
                  className="border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted"
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={cn(
                        "px-1 sm:px-4 py-1.5 sm:py-4 align-middle whitespace-nowrap",
                        cellIndex === row.length - 1 && (
                          cell.startsWith('+') ? 'text-green-600 font-medium' :
                          cell.startsWith('-') ? 'text-red-600 font-medium' :
                          ''
                        )
                      )}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  )
}


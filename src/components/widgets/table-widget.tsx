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

export function TableWidget({ title, data }: TableWidgetProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title || 'Data Table'}</CardTitle>
        <CardDescription>Detailed breakdown</CardDescription>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        <div
          className="rounded-md border overflow-x-auto overscroll-x-contain"
          style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-x pan-y' }}
        >
          <table className="w-full min-w-max text-xs sm:text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                {data.headers.map((header, index) => (
                  <th
                    key={index}
                    className="h-8 sm:h-10 px-2 sm:px-4 text-left align-middle font-medium text-muted-foreground whitespace-nowrap"
                  >
                    {header}
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
                        "px-2 sm:px-4 py-2 sm:py-4 align-middle whitespace-nowrap",
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


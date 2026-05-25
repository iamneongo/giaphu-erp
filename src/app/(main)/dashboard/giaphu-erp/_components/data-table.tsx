import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface DataTableColumn<T> {
  key: string;
  label: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  empty = "Chưa có dữ liệu.",
}: {
  columns: DataTableColumn<T>[];
  rows: T[];
  getRowId: (row: T) => string | number;
  empty?: string;
}) {
  return (
    <div className="overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((column) => (
              <TableHead key={column.key} className={column.className}>
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={getRowId(row)}>
                {columns.map((column) => (
                  <TableCell key={column.key} className={column.className}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from "@tanstack/react-table";
import { Empty } from "./ui";
export function DataTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: ColumnDef<T>[];
}) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });
  if (!rows.length) return <Empty />;
  return (
    <div
      className={
        "table-wrap overflow-auto max-w-full [&_table]:border-collapse [&_table]:w-full [&_table]:text-[11px] [&_table]:text-left [&_th]:bg-[#fafcfc] [&_th]:text-[#98a3a4] [&_th]:font-medium [&_th]:text-[9px] [&_th]:tracking-[.2px] [&_th]:[padding:13px_20px] [&_th]:[border-top:1px_solid_#eff3f3] [&_th]:[border-bottom:1px_solid_#eff3f3] [&_th]:whitespace-nowrap [&_td]:[padding:20px] [&_td]:[border-bottom:1px_solid_#eff3f3] [&_td]:text-[#637a7d] [&_tbody_tr:last-child_td]:[border-bottom:0] [&_tbody_tr:hover]:bg-[#fcfdfd] [&_td_strong]:text-[11px] [&_td_strong]:text-[#40595b] [&_td_small]:block [&_td_small]:text-[#9aa8a8] [&_td_small]:text-[9px] [&_td_small]:mt-[5px] min-[1600px]:[&_td]:[padding:23px] max-[768px]:overflow-visible max-[768px]:[&_table]:block max-[768px]:[&_table]:w-full max-[768px]:[&_tbody]:block max-[768px]:[&_tbody]:w-full max-[768px]:[&_thead]:hidden max-[768px]:[&_tbody_tr]:grid max-[768px]:[&_tbody_tr]:[grid-template-columns:1fr_1fr] max-[768px]:[&_tbody_tr]:gap-[12px] max-[768px]:[&_tbody_tr]:[border-bottom:1px_solid_var(--border)] max-[768px]:[&_tbody_tr]:[padding:19px_17px] max-[768px]:[&_tbody_tr:last-child]:[border-bottom:0] max-[768px]:[&_td]:flex max-[768px]:[&_td]:flex-col max-[768px]:[&_td]:items-start max-[768px]:[&_td]:gap-[7px] max-[768px]:[&_td]:border-0 max-[768px]:[&_td]:p-0 max-[768px]:[&_td]:min-w-0 max-[768px]:[&_td]:[overflow-wrap:anywhere] max-[768px]:[&_td::before]:[content:attr(data-label)] max-[768px]:[&_td::before]:text-[9px] max-[768px]:[&_td::before]:text-[#93a4a0] max-[768px]:[&_td_small]:mt-[4px] max-[768px]:[&_td_.badge]:text-[10px] max-[768px]:[&_td:last-child:nth-child(odd)]:col-span-2"
      }
    >
      <table>
        <thead>
          {table.getHeaderGroups().map((g) => (
            <tr key={g.id}>
              {g.headers.map((h) => (
                <th key={h.id}>
                  {flexRender(h.column.columnDef.header, h.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((r) => (
            <tr key={r.id}>
              {r.getVisibleCells().map((c) => (
                <td
                  key={c.id}
                  data-label={
                    typeof c.column.columnDef.header === "string"
                      ? c.column.columnDef.header
                      : undefined
                  }
                >
                  {flexRender(c.column.columnDef.cell, c.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

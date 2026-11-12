import Image from "next/image";

export function AdminBrand({ collapsed = false }: { collapsed?: boolean }) {
  return <div role="img" aria-label="ETime — Ennea Phos Time" className="flex h-12 min-w-0 items-center">
    <Image src="/branding/etime-logo.png" alt="" width={1536} height={1024}
      className={`${collapsed ? "w-12" : "w-16"} h-auto shrink-0 object-contain`} />
    {!collapsed && <div aria-hidden="true" className="min-w-0 font-sans">
      <p className="text-xl font-semibold leading-5 tracking-tight text-sidebar-foreground">ETime</p>
      <p className="text-[8px] font-medium leading-[10px] tracking-[0.08em] text-muted-foreground">ENNEA PHOS TIME</p>
    </div>}
  </div>;
}

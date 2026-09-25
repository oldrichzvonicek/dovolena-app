import { Header } from "@/components/layout/Header";
import { ExportsPanel } from "@/components/admin/ExportsPanel";

export default function ExportsPage() {
  return (
    <div>
      <Header title="Exporty" subtitle="Podklady pro mzdy a měsíční uzávěrky" />
      <div className="p-4 sm:p-8">
        <ExportsPanel />
      </div>
    </div>
  );
}

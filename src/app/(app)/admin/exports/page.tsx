import { Header } from "@/components/layout/Header";
import { ExportsPanel } from "@/components/admin/ExportsPanel";

export default function ExportsPage() {
  return (
    <div>
      <Header title="Rychlé přehledy & Exporty" subtitle="Podklady pro mzdy a měsíční uzávěrky" />
      <div className="p-8">
        <ExportsPanel />
      </div>
    </div>
  );
}

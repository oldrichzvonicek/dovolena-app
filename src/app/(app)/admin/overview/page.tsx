import { Header } from "@/components/layout/Header";
import { OverviewPanel } from "@/components/admin/OverviewPanel";

export default function OverviewPage() {
  return (
    <div>
      <Header title="Přehled" subtitle="Firma na jeden pohled — kapacita, absence, co se blíží" />
      <div className="p-4 sm:p-8">
        <OverviewPanel />
      </div>
    </div>
  );
}

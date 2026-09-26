import { Header } from "@/components/layout/Header";
import { SmartHrPage } from "@/components/admin/SmartHrPage";

export default function InsightsPage() {
  return (
    <div>
      <Header title="Smart HR" subtitle="Shrnutí týdne, kapacita, plánování a zdraví týmů" />
      <div className="p-4 sm:p-8">
        <SmartHrPage />
      </div>
    </div>
  );
}

import { Header } from "@/components/layout/Header";
import { PendingApprovals } from "@/components/manager/PendingApprovals";

export default function ApprovalsPage() {
  return (
    <div>
      <Header title="Ke schválení" subtitle="Žádosti o volno čekající na tvé rozhodnutí" />
      <div className="p-8">
        <PendingApprovals />
      </div>
    </div>
  );
}

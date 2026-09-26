import { Suspense } from "react";
import { Header } from "@/components/layout/Header";
import { PendingApprovals } from "@/components/manager/PendingApprovals";
import { CancellationRequests } from "@/components/manager/CancellationRequests";

export default function ApprovalsPage() {
  return (
    <div>
      <Header title="Ke schválení" subtitle="Žádosti o absenci čekající na vaše rozhodnutí" />
      <div className="p-4 sm:p-8">
        <CancellationRequests />
        <Suspense fallback={null}>
          <PendingApprovals />
        </Suspense>
      </div>
    </div>
  );
}

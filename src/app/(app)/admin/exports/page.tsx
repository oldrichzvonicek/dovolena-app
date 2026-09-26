"use client";

import { Header } from "@/components/layout/Header";
import { ExportsPanel } from "@/components/admin/ExportsPanel";
import { PayrollDetailPanel } from "@/components/admin/PayrollDetailPanel";
import { SettlementPanel } from "@/components/admin/SettlementPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeatureGate } from "@/components/shared/FeatureGate";

export default function ExportsPage() {
  return (
    <div>
      <Header title="Exporty" subtitle="Podklady pro mzdy, uzávěrka měsíce a vyrovnání dovolené" />
      <div className="p-4 sm:p-8">
        <FeatureGate feature="exports" description="Stažení dat do Excelu a CSV, detailní podklad pro mzdy s uzávěrkou měsíce a vyrovnání dovolené při odchodu zaměstnance.">
        <Tabs defaultValue="summary">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="summary">Měsíční souhrn</TabsTrigger>
            <TabsTrigger value="detail">Detail pro mzdy a uzávěrka</TabsTrigger>
            <TabsTrigger value="settlement">Vyrovnání při ukončení</TabsTrigger>
          </TabsList>
          <TabsContent value="summary">
            <ExportsPanel />
          </TabsContent>
          <TabsContent value="detail">
            <PayrollDetailPanel />
          </TabsContent>
          <TabsContent value="settlement">
            <SettlementPanel />
          </TabsContent>
        </Tabs>
        </FeatureGate>
      </div>
    </div>
  );
}

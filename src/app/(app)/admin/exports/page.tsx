"use client";

import { Header } from "@/components/layout/Header";
import { ExportsPanel } from "@/components/admin/ExportsPanel";
import { PayrollDetailPanel } from "@/components/admin/PayrollDetailPanel";
import { SettlementPanel } from "@/components/admin/SettlementPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FeatureGate } from "@/components/shared/FeatureGate";
import { ICalExportBox } from "@/components/calendar/ICalExportBox";

export default function ExportsPage() {
  return (
    <div>
      <Header title="Exporty" subtitle="Všechny datové výstupy na jednom místě: mzdy, uzávěrka, vyrovnání a kalendář" />
      <div className="p-4 sm:p-8">
        <FeatureGate feature="exports" description="Stažení dat do Excelu a CSV, detailní podklad pro mzdy s uzávěrkou měsíce a vyrovnání dovolené při odchodu zaměstnance.">
        <Tabs defaultValue="summary">
          <TabsList className="mb-6 flex-wrap">
            <TabsTrigger value="summary">Měsíční souhrn</TabsTrigger>
            <TabsTrigger value="detail">Detail pro mzdy a uzávěrka</TabsTrigger>
            <TabsTrigger value="settlement">Vyrovnání při ukončení</TabsTrigger>
            <TabsTrigger value="calendar">Kalendář (iCal)</TabsTrigger>
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
          <TabsContent value="calendar">
            <div className="card max-w-2xl space-y-3 p-5">
              <h2 className="font-display text-h2">Kalendář do Google, Outlooku a dalších</h2>
              <p className="text-sm text-muted">
                Odkaz na odběr kalendáře (iCal) s vašimi absencemi nebo s absencemi celého týmu. Vložíte ho do kalendáře a absence se tam objeví samy. Odkaz je osobní, nikomu ho neposílejte.
              </p>
              <ICalExportBox />
            </div>
          </TabsContent>
        </Tabs>
        </FeatureGate>
      </div>
    </div>
  );
}

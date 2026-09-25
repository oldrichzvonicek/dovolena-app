"use client";

import { Header } from "@/components/layout/Header";
import { ExportsPanel } from "@/components/admin/ExportsPanel";
import { PayrollDetailPanel } from "@/components/admin/PayrollDetailPanel";
import { SettlementPanel } from "@/components/admin/SettlementPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function ExportsPage() {
  return (
    <div>
      <Header title="Exporty" subtitle="Podklady pro mzdy, uzávěrka měsíce a vyrovnání dovolené" />
      <div className="p-4 sm:p-8">
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
      </div>
    </div>
  );
}

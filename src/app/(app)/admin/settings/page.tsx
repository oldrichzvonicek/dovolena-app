"use client";

import { Header } from "@/components/layout/Header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UsersPanel } from "@/components/admin/UsersPanel";
import { DepartmentsPanel } from "@/components/admin/DepartmentsPanel";
import { LeaveTypesPanel } from "@/components/admin/LeaveTypesPanel";
import { CompanySettingsPanel } from "@/components/admin/CompanySettingsPanel";
import { BillingPanel } from "@/components/admin/BillingPanel";
import { AuditLogPanel } from "@/components/admin/AuditLogPanel";

export default function AdminSettingsPage() {
  return (
    <div>
      <Header title="Nastavení firmy" subtitle="Uživatelé, nároky, typy absencí, provoz, fakturace" />
      <div className="p-4 sm:p-8">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Uživatelé</TabsTrigger>
            <TabsTrigger value="departments">Oddělení</TabsTrigger>
            <TabsTrigger value="leave-types">Typy absencí</TabsTrigger>
            <TabsTrigger value="general">Provoz</TabsTrigger>
            <TabsTrigger value="billing">Fakturace</TabsTrigger>
            <TabsTrigger value="audit">Historie</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="pt-6">
            <UsersPanel />
          </TabsContent>
          <TabsContent value="departments" className="pt-6">
            <DepartmentsPanel />
          </TabsContent>
          <TabsContent value="leave-types" className="pt-6">
            <LeaveTypesPanel />
          </TabsContent>
          <TabsContent value="general" className="pt-6">
            <CompanySettingsPanel />
          </TabsContent>
          <TabsContent value="billing" className="pt-6">
            <BillingPanel />
          </TabsContent>
          <TabsContent value="audit" className="pt-6">
            <AuditLogPanel />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

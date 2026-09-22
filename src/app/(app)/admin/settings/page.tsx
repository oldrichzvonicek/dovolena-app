import { Header } from "@/components/layout/Header";

export default function AdminSettingsPage() {
  return (
    <div>
      <Header title="Nastavení firmy" subtitle="Uživatelé, nároky, typy absencí, integrace Teams/Slack" />
      <div className="p-8">
        <div className="card p-8 text-center text-sm text-muted">
          Nastavení firmy — k dopracování v další iteraci (uživatelé, roční nároky, integrace).
        </div>
      </div>
    </div>
  );
}

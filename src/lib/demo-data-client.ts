/** Client-side wrapper for /api/admin/demo-data — shared by DemoDataCard and OnboardingWizard. */
export async function callDemoData(action: "status" | "create" | "remove") {
  const res = await fetch("/api/admin/demo-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "Požadavek selhal.");
  return json as { exists?: boolean; eligible?: boolean; people?: number; requests?: number; removed?: number };
}

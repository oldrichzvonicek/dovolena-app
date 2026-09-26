"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { canSeeInsights } from "@/lib/access";
import { fetchDepartments } from "@/lib/data";
import { DbDepartment } from "@/lib/supabase/types";
import { HrInsights } from "@/components/admin/HrInsights";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/** Stránka Smart HR: filtr oddělení + přehledy (admin a HR; ostatní se sem nedostanou). */
export function SmartHrPage() {
  const { profile } = useAuth();
  const [departments, setDepartments] = useState<DbDepartment[]>([]);
  const [deptFilter, setDeptFilter] = useState("all");

  useEffect(() => {
    if (profile?.company_id) fetchDepartments(profile.company_id).then(setDepartments).catch(() => setDepartments([]));
  }, [profile?.company_id]);

  if (!profile || !canSeeInsights(profile)) return null;
  return (
    <div className="space-y-4">
      {departments.length > 0 && (
        <div className="flex items-center gap-2">
          <Select value={deptFilter} onValueChange={setDeptFilter}>
            <SelectTrigger className="w-52 py-1.5 text-xs" aria-label="Filtr podle oddělení">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všechna oddělení</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      <HrInsights departmentId={deptFilter} />
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchJoinLink, joinUrl, type JoinLinkInfo } from "@/lib/join-link";

/** Current registration link of the company (managers and admins). `url` is null while loading or when the link is switched off. */
export function useJoinLink(enabledFor: boolean = true) {
  const [info, setInfo] = useState<JoinLinkInfo | null>(null);
  const [loading, setLoading] = useState(enabledFor);
  const [failed, setFailed] = useState(false);

  const reload = useCallback(async () => {
    try {
      setInfo(await fetchJoinLink());
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabledFor) reload();
  }, [enabledFor, reload]);

  return { info, loading, failed, reload, url: info && info.enabled ? joinUrl(info.join_code) : null };
}

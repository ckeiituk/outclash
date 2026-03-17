import useSWR, { mutate } from "swr";
import {
  getProfiles,
  patchProfile,
  patchProfilesConfig,
} from "@/services/cmds";
import { getProxies, updateProxy } from "@/services/api";

export const useProfiles = () => {
  const { data: profiles, mutate: mutateProfiles } = useSWR(
    "getProfiles",
    getProfiles,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 2000,
      errorRetryCount: 2,
      errorRetryInterval: 1000,
    },
  );

  const patchProfiles = async (
    value: Partial<IProfilesConfig>,
    signal?: AbortSignal,
  ) => {
    try {
      if (signal?.aborted) {
        throw new DOMException("Operation was aborted", "AbortError");
      }
      const success = await patchProfilesConfig(value);

      if (signal?.aborted) {
        throw new DOMException("Operation was aborted", "AbortError");
      }

      await mutateProfiles();

      return success;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      await mutateProfiles();
      throw error;
    }
  };

  const patchCurrent = async (value: Partial<IProfileItem>) => {
    if (profiles?.current) {
      await patchProfile(profiles.current, value);
      mutateProfiles();
    }
  };

  // 根据selected的节点选择
  const activateSelected = async () => {
    try {
      console.log("[ActivateSelected] Start processing proxy selection");

      const [proxiesData, profileData] = await Promise.all([
        getProxies(),
        getProfiles(),
      ]);

      if (!profileData || !proxiesData) {
        console.log(
          "[ActivateSelected] Proxy or configuration data unavailable, skipping processing",
        );
        return;
      }

      const current = profileData.items?.find(
        (e) => e && e.uid === profileData.current,
      );

      if (!current) {
        console.log(
          "[ActivateSelected] Current profile configuration not found",
        );
        return;
      }

      // 检查是否有saved的代理选择
      const { selected = [] } = current;
      if (selected.length === 0) {
        console.log(
          "[ActivateSelected] The current profile has no saved proxy selection, so it will be skipped",
        );
        return;
      }

      console.log(
        `[ActivateSelected] The current profile has ${selected.length} proxy selection configurations`,
      );

      const selectedMap = Object.fromEntries(
        selected.map((each) => [each.name!, each.now!]),
      );

      let hasChange = false;
      const newSelected: typeof selected = [];
      const { global, groups } = proxiesData;

      // 处理所有代理组
      [global, ...groups].forEach(({ type, name, now }) => {
        if (!now || type !== "Selector") {
          if (selectedMap[name] != null) {
            newSelected.push({ name, now: now || selectedMap[name] });
          }
          return;
        }

        const targetProxy = selectedMap[name];
        if (targetProxy != null && targetProxy !== now) {
          console.log(
            `[ActivateSelected] Need to switch proxy groups ${name}: ${now} -> ${targetProxy}`,
          );
          hasChange = true;
          updateProxy(name, targetProxy);
        }

        newSelected.push({ name, now: targetProxy || now });
      });

      if (!hasChange) {
        console.log(
          "[ActivateSelected] All agent selections are already in the target state and do not need to be updated",
        );
        return;
      }

      console.log(
        `[ActivateSelected] Complete the proxy switch and save the new selection configuration`,
      );

      try {
        await patchProfile(profileData.current!, { selected: newSelected });
        console.log(
          "[ActivateSelected] Proxy selection configuration saved successfully",
        );

        setTimeout(() => {
          mutate("getProxies", getProxies());
        }, 100);
      } catch (error: any) {
        console.error(
          "[ActivateSelected] Failed to save proxy selection configuration:",
          error.message,
        );
      }
    } catch (error: any) {
      console.error(
        "[ActivateSelected] Handling proxy selection failure:",
        error.message,
      );
    }
  };

  return {
    profiles,
    current: profiles?.items?.find((p) => p && p.uid === profiles.current),
    activateSelected,
    patchProfiles,
    patchCurrent,
    mutateProfiles,
  };
};

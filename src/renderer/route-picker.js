"use strict";

(function exposeRoutePicker(root) {
  function canonicalProviderType(type) {
    return String(type || "").toLowerCase() === "codex" ? "chatgpt" : String(type || "");
  }

  function isConnectionScopedProvider(provider) {
    const type = canonicalProviderType(provider?.type);
    return type === "custom" || type === "openai-compat";
  }

  function providerDisplayName(provider, type) {
    if (isConnectionScopedProvider(provider)) {
      return String(provider?.name || "Provider").trim() || "Provider";
    }
    const names = {
      chatgpt: "ChatGPT",
      claude: "Claude",
      antigravity: "Antigravity",
      xai: "xAI",
      openrouter: "OpenRouter",
      nvidia: "NVIDIA NIM",
      cloudflare: "Cloudflare",
      glm: "GLM Coding",
    };
    return names[type] || String(provider?.name || type || "Provider").trim() || "Provider";
  }

  function enabledModelOptions(provider) {
    const models = [];
    for (const model of provider?.models || []) {
      if (typeof model !== "string" && model?.enabled === false) continue;
      const id = typeof model === "string" ? model : model?.id;
      if (!id) continue;
      models.push({
        id,
        name: typeof model === "string" ? model : model.name || id,
        gatewayId: typeof model === "string" ? null : model.gatewayId || null,
        upstreamModel: id,
      });
    }
    return models;
  }

  /**
   * Turns connected accounts into route choices. Subscription and preset API-key
   * providers are intentionally grouped by provider family; their individual
   * accounts are an internal fallback pool. Custom OpenAI-compatible endpoints
   * stay distinct because each connection can point at a different base URL.
   */
  function buildRouteProviderOptions(providers) {
    const groups = [];
    const groupsByKey = new Map();

    for (const provider of providers || []) {
      if (!provider?.id || provider.enabled === false || provider.hasToken === false) continue;
      const models = enabledModelOptions(provider);
      if (!models.length) continue;

      const providerType = canonicalProviderType(provider.type);
      const connectionScoped = isConnectionScopedProvider(provider);
      const id = connectionScoped ? `connection:${provider.id}` : `provider:${providerType}`;
      let group = groupsByKey.get(id);
      if (!group) {
        group = {
          id,
          name: providerDisplayName(provider, providerType),
          providerType,
          providerId: connectionScoped ? provider.id : null,
          providerIds: [],
          connectionScoped,
          models: [],
        };
        groups.push(group);
        groupsByKey.set(id, group);
      }
      group.providerIds.push(provider.id);

      for (const model of models) {
        let merged = group.models.find((entry) => entry.upstreamModel === model.upstreamModel);
        if (!merged) {
          merged = { ...model, providerIds: [] };
          group.models.push(merged);
        }
        merged.providerIds.push(provider.id);
      }
    }

    for (const group of groups) {
      group.accountCount = group.providerIds.length;
      for (const model of group.models) model.accountCount = model.providerIds.length;
    }
    return groups;
  }

  function modelsForRouteProvider(providers, providerId) {
    return (providers || []).find((provider) => provider.id === providerId)?.models || [];
  }

  /**
   * Recognizes the free-tier markers OpenRouter uses: a ":free" suffix on the model
   * id and a "(free)" suffix on the display name, plus the "openrouter/free" router
   * whose id ends in "/free" and only dispatches to free models. This keys off
   * naming convention, not response pricing, so a free model published without the
   * marker is not matched.
   */
  function isFreeModelOption(model) {
    const id = String(model?.upstreamModel || "").toLowerCase();
    const name = String(model?.name || "").trim().toLowerCase();
    return id.endsWith(":free") || id.endsWith("/free") || name.endsWith("(free)");
  }

  /**
   * Filters and orders a provider's model options for the route editor combobox.
   * With no query, models sort alphabetically by display name (upstream feeds
   * arrive unsorted). With a query, case-insensitive substring matches on either
   * the display name or the upstream id (OpenRouter ids like
   * "anthropic/claude-3.5-sonnet" are what people type) are kept, with
   * prefix matches ranked ahead of mid-string matches, each group alphabetized.
   * With options.freeOnly, only free-tier models (see isFreeModelOption) survive.
   */
  function filterModelOptions(models, query, options = {}) {
    let list = Array.isArray(models) ? models.slice() : [];
    if (options.freeOnly) list = list.filter(isFreeModelOption);
    const label = (model) => String(model?.name || model?.upstreamModel || "");
    const byName = (a, b) => label(a).localeCompare(label(b), undefined, { sensitivity: "base" });
    const q = String(query || "").trim().toLowerCase();
    if (!q) return list.sort(byName);
    const scored = [];
    for (const model of list) {
      const name = String(model?.name || "").toLowerCase();
      const id = String(model?.upstreamModel || "").toLowerCase();
      if (name.indexOf(q) === -1 && id.indexOf(q) === -1) continue;
      const prefix = name.startsWith(q) || id.startsWith(q);
      scored.push({ model, rank: prefix ? 0 : 1 });
    }
    scored.sort((a, b) => a.rank - b.rank || byName(a.model, b.model));
    return scored.map((entry) => entry.model);
  }

  function routeMemberForProvider(provider, upstreamModel) {
    if (!provider || !upstreamModel) return null;
    return provider.connectionScoped
      ? { providerId: provider.providerId, model: upstreamModel }
      : { providerType: provider.providerType, model: upstreamModel };
  }

  function normalizeRouteMember(member, providers) {
    const model = member?.model || member?.upstreamModel;
    if (!model) return member;
    if (member?.providerType) {
      const type = canonicalProviderType(member.providerType);
      const provider = (providers || []).find(
        (entry) => !entry.connectionScoped && entry.providerType === type
      );
      return provider ? routeMemberForProvider(provider, model) : { providerType: type, model };
    }
    const provider = (providers || []).find((entry) =>
      entry.providerIds.includes(member?.providerId)
    );
    return provider ? routeMemberForProvider(provider, model) : { ...member, model };
  }

  function moveRouteMember(members, fromIndex, toIndex) {
    if (!Array.isArray(members)) return members;
    const from = Number(fromIndex);
    const to = Number(toIndex);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= members.length ||
      to >= members.length ||
      from === to
    ) {
      return members;
    }
    const [member] = members.splice(from, 1);
    members.splice(to, 0, member);
    return members;
  }

  const api = {
    buildRouteProviderOptions,
    modelsForRouteProvider,
    filterModelOptions,
    isFreeModelOption,
    routeMemberForProvider,
    normalizeRouteMember,
    moveRouteMember,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.ReroutedRoutePicker = api;
})(typeof window !== "undefined" ? window : null);

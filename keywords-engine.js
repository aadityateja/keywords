(function (root) {
  "use strict";

  const normalizeInput = (value) => String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(/[’']/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");

  const tokenize = (value) => {
    const normalized = normalizeInput(value);
    return normalized ? normalized.split(" ") : [];
  };

  const createConceptIndex = (concepts) => {
    const byId = new Map();
    const aliases = new Map();

    for (const concept of concepts) {
      if (!concept || typeof concept.id !== "string" || typeof concept.name !== "string") {
        throw new TypeError("Every concept must have a string id and name.");
      }
      if (byId.has(concept.id)) {
        throw new Error(`Duplicate concept id: ${concept.id}`);
      }
      byId.set(concept.id, concept);

      for (const alias of [concept.name, ...(concept.aliases || [])]) {
        const normalized = normalizeInput(alias);
        if (!normalized) continue;
        const existing = aliases.get(normalized);
        if (existing && existing.id !== concept.id) {
          throw new Error(`Alias "${alias}" maps to multiple concepts.`);
        }
        aliases.set(normalized, concept);
      }
    }

    return { byId, aliases };
  };

  const resolveInput = (value, concepts) => {
    const index = createConceptIndex(concepts);
    const tokens = tokenize(value);
    const aliasesByLength = [...index.aliases.entries()]
      .map(([alias, concept]) => ({ tokens: alias.split(" "), concept }))
      .sort((left, right) => right.tokens.length - left.tokens.length);
    const resolved = [];
    const unknownTokens = [];

    for (let position = 0; position < tokens.length;) {
      const match = aliasesByLength.find(({ tokens: aliasTokens }) =>
        aliasTokens.every((token, offset) => tokens[position + offset] === token));

      if (match) {
        resolved.push({
          id: match.concept.id,
          name: match.concept.name,
          domain: match.concept.domain,
          definition: match.concept.definition,
          input: tokens.slice(position, position + match.tokens.length).join(" "),
          position,
        });
        position += match.tokens.length;
      } else {
        unknownTokens.push(tokens[position]);
        position += 1;
      }
    }

    return {
      normalized: normalizeInput(value),
      tokens,
      resolved,
      unknownTokens,
      conceptIds: [...new Set(resolved.map((concept) => concept.id))],
    };
  };

  const renderTemplate = (template, context = {}) => String(template).replace(/\{([\w.-]+)\}/g, (placeholder, key) => {
    const value = key.split(".").reduce((current, part) => current?.[part], context);
    return value == null ? placeholder : String(value);
  });

  const evaluateRules = (rules, conceptIds, context = {}) => {
    const present = new Set(conceptIds);
    return rules
      .filter((rule) => {
        const conditions = rule.conditions || {};
        const all = conditions.all || [];
        const any = conditions.any || [];
        const not = conditions.not || [];
        return all.every((id) => present.has(id))
          && (any.length === 0 || any.some((id) => present.has(id)))
          && not.every((id) => !present.has(id));
      })
      .sort((left, right) => (right.priority || 0) - (left.priority || 0)
        || String(left.id).localeCompare(String(right.id)))
      .map((rule) => ({
        ...rule,
        rendered: renderTemplate(rule.template, context),
      }));
  };

  const api = { normalizeInput, tokenize, createConceptIndex, resolveInput, renderTemplate, evaluateRules };
  root.KeywordsEngine = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
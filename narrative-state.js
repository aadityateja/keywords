(function (root) {
  "use strict";

  const createSession = () => ({
    version: 1,
    id: `session-${Date.now().toString(36)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    turns: [],
    cumulativeKeywords: [],
    concepts: [],
    activatedRules: [],
    attributes: { character: "the observer", setting: "an uncharted world" },
  });

  class NarrativeState {
    constructor(session = createSession()) {
      this.session = NarrativeState.validate(session) ? session : createSession();
    }

    static validate(value) {
      return Boolean(value && value.version === 1 && typeof value.id === "string"
        && Array.isArray(value.turns) && Array.isArray(value.cumulativeKeywords)
        && Array.isArray(value.concepts) && Array.isArray(value.activatedRules)
        && value.attributes && typeof value.attributes === "object");
    }

    addTurn({ input, resolution, rules, narrative }) {
      const turn = {
        number: this.session.turns.length + 1,
        input: String(input),
        normalized: resolution.normalized,
        concepts: resolution.resolved,
        unknownTokens: resolution.unknownTokens,
        rules: rules.map(({ id, title, priority, rendered }) => ({ id, title, priority, rendered })),
        narrative: String(narrative),
        timestamp: new Date().toISOString(),
      };

      this.session.turns.push(turn);
      this.session.cumulativeKeywords = [...new Set([
        ...this.session.cumulativeKeywords,
        ...resolution.tokens,
      ])];
      this.session.concepts = [...new Set([
        ...this.session.concepts,
        ...resolution.conceptIds,
      ])];
      this.session.activatedRules = [...new Set([
        ...this.session.activatedRules,
        ...rules.map((rule) => rule.id),
      ])];

      for (const concept of resolution.resolved) {
        if (concept.domain === "people") this.session.attributes.character = concept.name;
        if (concept.domain === "places" || concept.domain === "astronomy") {
          this.session.attributes.setting = concept.name;
        }
      }
      this.session.updatedAt = turn.timestamp;
      return turn;
    }

    reset() {
      this.session = createSession();
    }

    getSummary() {
      const latest = this.session.turns.at(-1);
      return {
        turnCount: this.session.turns.length,
        conceptCount: this.session.concepts.length,
        ruleCount: this.session.activatedRules.length,
        lastActivity: latest?.timestamp || this.session.createdAt,
        opening: this.session.turns[0]?.narrative || "The world is waiting for its first five words.",
      };
    }

    toJSON() {
      return JSON.parse(JSON.stringify(this.session));
    }
  }

  const api = { NarrativeState, createSession };
  root.NarrativeState = NarrativeState;
  root.createNarrativeSession = createSession;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(globalThis);
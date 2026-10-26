"use strict";

const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const engine = require("./keywords-engine.js");
const { NarrativeState, createSession } = require("./narrative-state.js");
globalThis.NarrativeState = NarrativeState;
const { SessionStorage, STORAGE_KEY } = require("./storage.js");

const readJson = (file) => JSON.parse(readFileSync(new URL(file, `file://${__dirname}/`), "utf8"));
const concepts = readJson("concepts.json").concepts;
const rules = readJson("rules.json").rules;
const relationships = readJson("relationships.json").relationships;
const cases = [];

function test(name, run) {
  cases.push({ name, run });
}

test("normalizes punctuation, case, and repeated whitespace", () => {
  assert.equal(engine.normalizeInput("  RAIN—NOW!  "), "rain now");
  assert.deepEqual(engine.tokenize("  Rain,   scientist. "), ["rain", "scientist"]);
});

test("resolves aliases and prefers the longest matching phrase", () => {
  const result = engine.resolveInput("12 A.M. telescope", concepts);
  assert.deepEqual(result.conceptIds, ["midnight", "telescope"]);
  assert.deepEqual(result.unknownTokens, []);
});

test("returns unknown tokens while retaining known concepts", () => {
  const result = engine.resolveInput("rain flurb telescope", concepts);
  assert.deepEqual(result.conceptIds, ["rain", "telescope"]);
  assert.deepEqual(result.unknownTokens, ["flurb"]);
});

test("rejects ambiguous aliases instead of resolving nondeterministically", () => {
  assert.throws(() => engine.createConceptIndex([
    { id: "one", name: "one", aliases: ["same phrase"] },
    { id: "two", name: "two", aliases: ["same phrase"] },
  ]), /maps to multiple concepts/);
});

test("evaluates AND, OR, and NOT conditions and sorts by priority", () => {
  const candidates = [
    { id: "all", priority: 2, conditions: { all: ["rain", "moon"] }, template: "All" },
    { id: "or", priority: 3, conditions: { any: ["rain", "snow"] }, template: "Or" },
    { id: "excluded", priority: 99, conditions: { all: ["rain"], not: ["moon"] }, template: "No" },
  ];
  const result = engine.evaluateRules(candidates, ["rain", "moon"]);
  assert.deepEqual(result.map((rule) => rule.id), ["or", "all"]);
});

test("substitutes nested context values into narrative templates", () => {
  assert.equal(engine.renderTemplate("{attributes.character} sees {concepts.moon}.", {
    attributes: { character: "the scientist" }, concepts: { moon: "moon" },
  }), "the scientist sees moon.");
});

test("adds turns and accumulates concepts, keywords, rules, and attributes", () => {
  const state = new NarrativeState(createSession());
  const resolution = engine.resolveInput("scientist rain", concepts);
  state.addTurn({
    input: "scientist rain",
    resolution,
    rules: [{ id: "weather", title: "Weather", priority: 1, rendered: "Rain arrives." }],
    narrative: "Rain arrives.",
  });
  const session = state.toJSON();
  assert.equal(session.turns.length, 1);
  assert.deepEqual(session.concepts, ["scientist", "rain"]);
  assert.deepEqual(session.cumulativeKeywords, ["scientist", "rain"]);
  assert.deepEqual(session.activatedRules, ["weather"]);
  assert.equal(session.attributes.character, "scientist");
  assert.equal(state.getSummary().turnCount, 1);
});

test("resets a session without retaining its world", () => {
  const state = new NarrativeState(createSession());
  state.session.concepts.push("rain");
  state.reset();
  assert.deepEqual(state.session.concepts, []);
  assert.equal(state.getSummary().turnCount, 0);
});

test("persists and recovers a valid session from local storage", () => {
  const values = new Map();
  const mockStorage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const storage = new SessionStorage(mockStorage);
  const session = createSession();
  assert.equal(storage.save(session), true);
  assert.deepEqual(storage.load(), session);
  assert.ok(values.has(STORAGE_KEY));
  assert.equal(storage.clear(), true);
  assert.equal(storage.load(), null);
});

test("ships a connected vocabulary, relationship graph, and at least fifteen rules", () => {
  const ids = new Set(concepts.map((concept) => concept.id));
  assert.ok(rules.length >= 15);
  assert.ok(concepts.some((concept) => concept.id === "jupiter"));
  assert.ok(concepts.some((concept) => concept.id === "midnight"));
  for (const relationship of relationships) {
    assert.ok(ids.has(relationship.from), `Unknown relationship source: ${relationship.from}`);
    assert.ok(ids.has(relationship.to), `Unknown relationship target: ${relationship.to}`);
    assert.ok(relationship.type);
  }
  for (const rule of rules) {
    for (const id of [...(rule.conditions.all || []), ...(rule.conditions.any || []), ...(rule.conditions.not || [])]) {
      assert.ok(ids.has(id), `Unknown concept in rule ${rule.id}: ${id}`);
    }
  }
});

let failures = 0;
for (const { name, run } of cases) {
  try {
    run();
    console.log(`PASS ${name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${name}\n${error.stack}`);
  }
}

console.log(`\n${cases.length - failures}/${cases.length} tests passed.`);
if (failures) process.exitCode = 1;
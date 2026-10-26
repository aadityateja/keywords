(function () {
  "use strict";

  const elements = Object.fromEntries([
    "keyword-form", "keyword-input", "submit-button", "word-count", "form-message",
    "story-stream", "turn-count", "resolved-concepts", "resolved-count", "activated-rules",
    "rules-count", "unknown-tokens", "unknown-count", "world-inventory", "world-count",
    "relationship-count", "system-status", "reset-button",
  ].map((id) => [id, document.getElementById(id)]));

  let concepts = [];
  let rules = [];
  let relationships = [];
  let state;
  let persistence;
  let latestResolution = null;
  let latestRules = [];

  const escapeText = (value) => String(value ?? "");

  function setStatus(message, isError = false) {
    elements.formMessage.textContent = message;
    elements.formMessage.classList.toggle("is-error", isError);
  }

  function createTextElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    node.textContent = escapeText(text);
    return node;
  }

  function updateComposer() {
    const count = KeywordsEngine.tokenize(elements.keywordInput.value).length;
    elements.wordCount.textContent = `${count} / 5`;
    elements.wordCount.classList.toggle("is-over-limit", count > 5);
    elements.submitButton.disabled = count === 0 || count > 5;
    if (count > 5) setStatus("Keep it to five words per turn.", true);
    else if (elements.formMessage.classList.contains("is-error")) setStatus("Separate words with spaces or punctuation.");
  }

  function renderStory() {
    elements.storyStream.replaceChildren();
    const turns = state.session.turns;
    if (!turns.length) {
      const welcome = document.createElement("div");
      welcome.className = "stream-empty";
      welcome.append(
        createTextElement("span", "empty-index", "01 / BEGIN"),
        createTextElement("p", "empty-title", "Nothing has happened yet."),
        createTextElement("p", "empty-copy", "Start with a person, a place, a force of nature, or a question.")
      );
      elements.storyStream.append(welcome);
      return;
    }

    for (const turn of [...turns].reverse()) {
      const article = document.createElement("article");
      article.className = "story-turn";
      const head = document.createElement("div");
      head.className = "turn-head";
      head.append(
        createTextElement("span", "turn-number", `TURN ${String(turn.number).padStart(2, "0")}`),
        createTextElement("time", "turn-time", new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" }).format(new Date(turn.timestamp)))
      );
      article.append(head, createTextElement("p", "turn-input", turn.input));
      const badges = document.createElement("div");
      badges.className = "turn-concepts";
      for (const concept of turn.concepts) badges.append(createTextElement("span", "concept-badge", concept.name));
      for (const token of turn.unknownTokens) badges.append(createTextElement("span", "concept-badge is-unknown", token));
      if (badges.childElementCount) article.append(badges);
      article.append(createTextElement("p", "turn-narrative", turn.narrative));
      if (turn.rules.length) {
        const source = createTextElement("span", "turn-source", `${turn.rules.length} ${turn.rules.length === 1 ? "PATTERN" : "PATTERNS"} ACTIVATED`);
        article.append(source);
      }
      elements.storyStream.append(article);
    }
  }

  function renderInspector() {
    const resolution = latestResolution;
    const resolved = resolution?.resolved || [];
    const unknown = resolution?.unknownTokens || [];
    const renderedConcepts = new Set();
    elements.resolvedConcepts.replaceChildren();
    for (const concept of resolved) {
      if (renderedConcepts.has(concept.id)) continue;
      renderedConcepts.add(concept.id);
      const item = document.createElement("div");
      item.className = "resolved-item";
      item.append(createTextElement("span", "concept-name", concept.name), createTextElement("span", "concept-domain", concept.domain));
      item.title = concept.definition;
      elements.resolvedConcepts.append(item);
    }
    if (!resolved.length) elements.resolvedConcepts.append(createTextElement("p", "empty-state", "Waiting for input"));
    elements.resolvedCount.textContent = String(renderedConcepts.size);

    elements.activatedRules.replaceChildren();
    for (const rule of latestRules) {
      const item = document.createElement("div");
      item.className = "rule-item";
      item.append(createTextElement("span", "rule-priority", String(rule.priority).padStart(2, "0")), createTextElement("span", "rule-name", rule.title));
      elements.activatedRules.append(item);
    }
    if (!latestRules.length) elements.activatedRules.append(createTextElement("p", "empty-state", "No rules fired this turn"));
    elements.rulesCount.textContent = String(latestRules.length);

    elements.unknownTokens.replaceChildren();
    if (unknown.length) {
      for (const token of unknown) elements.unknownTokens.append(createTextElement("span", "unknown-token", token));
    } else {
      elements.unknownTokens.append(createTextElement("p", "empty-state", "Nothing unknown"));
    }
    elements.unknownCount.textContent = String(unknown.length);

    elements.worldInventory.replaceChildren();
    for (const id of state.session.concepts) {
      const concept = concepts.find((item) => item.id === id);
      if (concept) elements.worldInventory.append(createTextElement("span", "inventory-token", concept.name));
    }
    if (!state.session.concepts.length) elements.worldInventory.append(createTextElement("span", "empty-state", "Your world is unwritten"));
    elements.worldCount.textContent = String(state.session.concepts.length);
    elements.turnCount.textContent = `${state.session.turns.length} ${state.session.turns.length === 1 ? "TURN" : "TURNS"}`;
  }

  function render() {
    renderStory();
    renderInspector();
  }

  function saveSession() {
    const saved = persistence.save(state.toJSON());
    elements.systemStatus.classList.toggle("is-warning", !saved);
    elements.systemStatus.lastChild.textContent = saved ? " READY" : " MEMORY UNAVAILABLE";
  }

  function handleSubmit(event) {
    event.preventDefault();
    const input = elements.keywordInput.value.trim();
    const tokens = KeywordsEngine.tokenize(input);
    if (!tokens.length || tokens.length > 5) return;

    const resolution = KeywordsEngine.resolveInput(input, concepts);
    const conceptById = new Map(concepts.map((concept) => [concept.id, concept]));
    const allIds = [...new Set([...state.session.concepts, ...resolution.conceptIds])];
    const attributes = { ...state.session.attributes };
    for (const concept of resolution.resolved) {
      if (concept.domain === "people") attributes.character = concept.name;
      if (concept.domain === "places" || concept.domain === "astronomy") attributes.setting = concept.name;
    }
    const context = {
      attributes,
      concepts: Object.fromEntries(allIds.map((id) => [id, conceptById.get(id)?.name || id])),
    };
    const activated = KeywordsEngine.evaluateRules(rules, allIds, context)
      .filter((rule) => !state.session.activatedRules.includes(rule.id));
    const narrative = activated.length
      ? activated.map((rule) => rule.rendered).join(" ")
      : resolution.conceptIds.length
        ? `${resolution.resolved.map((concept) => `${concept.name} enters the world`).join(". ")}. Its meaning is not settled yet.`
        : `“${input}” remains unresolved. Even an unknown word can change the shape of a world.`;

    state.addTurn({ input, resolution, rules: activated, narrative });
    latestResolution = resolution;
    latestRules = activated;
    saveSession();
    render();
    elements.keywordInput.value = "";
    updateComposer();
    setStatus("Added to the world.");
    elements.keywordInput.focus();
  }

  async function initialize() {
    persistence = new KeywordsStorage.SessionStorage();
    try {
      const [conceptData, relationshipData, ruleData] = await Promise.all([
        fetch("./concepts.json").then((response) => {
          if (!response.ok) throw new Error("Could not load concepts.json");
          return response.json();
        }),
        fetch("./relationships.json").then((response) => {
          if (!response.ok) throw new Error("Could not load relationships.json");
          return response.json();
        }),
        fetch("./rules.json").then((response) => {
          if (!response.ok) throw new Error("Could not load rules.json");
          return response.json();
        }),
      ]);
      concepts = conceptData.concepts;
      relationships = relationshipData.relationships;
      rules = ruleData.rules;
      KeywordsEngine.createConceptIndex(concepts);
      state = new NarrativeState(persistence.load() || createNarrativeSession());
      const lastTurn = state.session.turns.at(-1);
      if (lastTurn) {
        latestResolution = { resolved: lastTurn.concepts, unknownTokens: lastTurn.unknownTokens };
        latestRules = lastTurn.rules;
      }
      elements.relationshipCount.textContent = `${relationships.length} RELATIONSHIPS`;
      elements.systemStatus.lastChild.textContent = " READY";
      elements.keywordForm.addEventListener("submit", handleSubmit);
      elements.keywordInput.addEventListener("input", updateComposer);
      elements.resetButton.addEventListener("click", () => {
        if (!state.session.turns.length || window.confirm("Start a new world? This clears the saved session.")) {
          state.reset();
          latestResolution = null;
          latestRules = [];
          persistence.clear();
          saveSession();
          render();
          setStatus("A new world is ready.");
          elements.keywordInput.focus();
        }
      });
      render();
      if (state.session.turns.length) setStatus("Previous world restored from this browser.");
    } catch (error) {
      console.error("KEYWORDS could not initialize:", error);
      elements.systemStatus.classList.add("is-warning");
      elements.systemStatus.lastChild.textContent = " LOAD ERROR";
      setStatus("The world data could not load. Run this page from a local server or GitHub Pages.", true);
      elements.keywordInput.disabled = true;
    }
  }

  elements.keywordInput.addEventListener("input", updateComposer);
  initialize();
})();
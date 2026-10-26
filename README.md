# KEYWORDS

**From Five Words to an Evolving World** is a browser-only narrative toy. Enter up to five words per turn; the engine resolves known ideas, checks deterministic rules, adds a story beat, and remembers the world in this browser.

## Run locally

The app has no package install or build step. Serve this directory over HTTP so the browser can fetch the JSON data files:

```sh
python3 -m http.server 8000
```

Open [http://localhost:8000](http://localhost:8000). Opening `index.html` as a `file://` URL is not supported because browsers block the app's JSON requests in that context.

Run the automated unit and data-integrity tests with Node.js 18 or newer:

```sh
node tests.js
```

The test runner uses only Node's built-in modules and reports each result to the console.

## How it works

- `index.html` provides the accessible story composer, evolving story stream, and live system inspector.
- `styles.css` contains the responsive dark interface and reduced-motion support.
- `keywords-engine.js` normalizes Unicode input, resolves the longest matching concept aliases, reports unknown tokens, checks AND/OR/NOT rule conditions, sorts matches by priority, and substitutes template values.
- `narrative-state.js` records turns, cumulative input tokens, canonical concepts, activated rules, character/setting attributes, and a session summary.
- `storage.js` validates and recovers the versioned active session through `localStorage`. Reset clears the saved world. Data remains in the current browser and is not sent to a server.
- `app.js` loads the JSON data, evaluates each turn against the cumulative concept set, renders the stream and inspector, and saves session changes.
- `concepts.json` defines canonical IDs, domains, definitions, and aliases. Alias collisions across concepts are rejected at startup.
- `relationships.json` contains typed, weighted links between concept IDs.
- `rules.json` defines priority-sorted narrative rules. Each rule can combine `conditions.all`, `conditions.any`, and `conditions.not`; `template` placeholders can read concept and attribute values.
- `tests.js` checks engine behavior, state transitions, storage recovery, and the consistency of the vocabulary, relationships, and rules.

All application scripts are plain JavaScript and use browser globals; the same engine, state, and storage code is loaded with CommonJS by the Node test runner. No framework, bundler, paid API, or backend service is required.

## Add concepts and rules

Use stable lowercase IDs with hyphens if needed. A concept has this shape:

```json
{
  "id": "example-concept",
  "name": "example concept",
  "domain": "philosophy",
  "definition": "A short reference definition.",
  "aliases": ["another phrase"]
}
```

Relationships refer to concept IDs with `from`, `type`, and `to` fields; `weight` is a relative strength from 0 to 1. Rules use concept IDs in condition arrays and can substitute `{attributes.character}`, `{attributes.setting}`, or `{concepts.example-concept}` in narrative templates. A rule fires once per session, the first time its conditions are met.

## GitHub Pages deployment

1. Push the `main` branch to a GitHub repository.
2. In the repository, open **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select the `main` branch and `/ (root)` folder, then select **Save**.
5. Wait for the Pages deployment to finish. The site URL appears in the Pages settings; the first deployment can take a few minutes.

The app uses relative paths for its scripts, stylesheet, and JSON files, so it also works when published beneath a repository-specific GitHub Pages path.

## Connect a GitHub remote

If creating a new GitHub repository, create it without a README, license, or `.gitignore` so it does not add a competing history. Then connect and push:

```sh
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

If `origin` already exists, inspect it with `git remote -v`. To point it at another repository, update it with:

```sh
git remote set-url origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

Do not add a second `origin` when one is already configured.
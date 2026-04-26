# Phase 2 Test Prompts - Express.js and Lodash

## Express.js Prompts (Test on C:/dev/node_modules/express)

### P1: Middleware Registration
> Find the middleware registration logic. Read relevant files and summarize how middleware is added to the Express app.

### P2: Route Handlers  
> Find all route handlers for GET and POST requests. Read relevant files and list all route paths with their handler functions.

### P3: Error Handling
> Find the error handling middleware. Read relevant files and summarize the error handling patterns used.

### P4: Server Startup
> Find where app.listen() is called. Read relevant files and explain how the Express server starts.

---

## Lodash Prompts (Test on C:/dev/node_modules/lodash)

### P1: Array Functions
> Find the array manipulation functions. Read relevant files in lib/ and list functions like chunk, compact, drop, take.

### P2: Collection Functions
> Find the collection iteration functions. Read relevant files and summarize _.each, _.map, _.filter, _.reduce.

### P3: Function Utilities
> Find where the function utilities are defined. Read relevant files and explain _.curry, _.partial, _.bind.

### P4: Object Utilities
> Find the object utilities. Read relevant files and explain _.assign, _.merge, _.pick, _.omit.

---

## Metrics to Capture (M1-M11)

| Metric | Description | How to Measure |
|--------|------------|--------------|
| M1 | JSONL Output Size | File size in chars |
| M2 | Tool Calls Used | Parse from JSONL |
| M3 | Tool Call Count | Count read/grep/glob |
| M4 | Token Usage | Parse token counts |
| M5 | Full File Reads | Parse truncated |
| M6 | Correctness (0-3) | Manual review |
| M7 | Context Ratio | M1 / answer |
| M8 | Signal Storage | signals.json size |
| M9 | Signal Distribution | By kind |
| M10 | Path Tag Bloat | % tags with path |
| M11 | False Positive % | Incorrect signals |

---

## Correctness Scoring (M6)

- 3 = Complete - All facts found, well explained
- 2 = Partial - Most facts found, some gaps
- 1 = Minimal - Only basics found
- 0 = None - No useful information

## Expected Comparisons

| Metric | Baseline | MCP-Enabled | Target |
|--------|----------|------------|---------|
| M1: JSONL Size | X | < X | Decrease |
| M3: Tool Calls | X | < X | Decrease |
| M4: Tokens | X | < X | Decrease |
| M5: Full Reads | X | < X | Decrease |
| M6: Correctness | 2-3 | >= 2 | Maintain |
| M7: Context Ratio | X | < X | Decrease |
| M8: Signal Storage | N/A | < evidence.json | Decrease |
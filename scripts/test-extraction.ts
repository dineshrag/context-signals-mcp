import { extractSignals, parseReadOutput, type Evidence } from "../src/extractor.js"

const testCases = [
  {
    name: "JS function",
    code: `1: function hello() {}
2: class Photo {}
3: import express from 'express';`,
  },
  {
    name: "JS arrow",
    code: `1: const hello = () => {}
2: import _ from 'lodash';`,
  },
  {
    name: "With indentation",
    code: `1:   function hello() {}
2: module.exports = function() {}`,
  },
  {
    name: "Express lib/application.js real sample",
    code: `1: /**
2:  * express
3:  * Copyright(c) 2009-2013 TJ Holowaychuk
4:  * MIT Licensed
5:  */
6: 
7: 'use strict';
8: 
9: /**
10:  * Application prototype.
11:  */
12: var application = require('./application');
13: 
14: module.exports = function() {
15:  // app is the exported function
16: };`,
  },
]

for (const tc of testCases) {
  console.log(`\n## ${tc.name}`)
  const evidence: Evidence = {
    id: "test",
    sessionId: "test",
    tool: "read",
    input: { file: "app.js" },
    output: `<path>app.js</path>
<type>file</type>
<content>
${tc.code}
</content>`,
    createdAt: Date.now(),
  }

  const { contentLines } = parseReadOutput(evidence.output)
  console.log("Parsed lines:")
  contentLines.slice(0, 5).forEach((l) => console.log(`  ${l.lineNo}: [${l.text.substring(0, 40)}]`))

  const signals = extractSignals(evidence)
  console.log(`Total signals: ${signals.length}`)
  signals.forEach((s) => console.log(`  - ${s.kind}: ${s.name ?? s.text?.substring(0, 30)}`))
}
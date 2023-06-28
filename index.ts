import { parse } from "https://deno.land/std@0.192.0/flags/mod.ts";
import { getLogger } from "https://deno.land/std@0.192.0/log/mod.ts";
import { fetchOpusTmx } from "./opus.ts";
import { TmxSegmentStream } from "./tmx.ts";

type Segment = Array<string>;
type Rule = Array<Array<Segment>>;

const { corpus, lang0, lang1 } = parse(Deno.args, {
  string: ["corpus", "lang0", "lang1"],
  default: {
    corpus: "Tatoeba",
    lang0: "en",
    lang1: "es",
  },
});

const logger = getLogger();

logger.info(`corpus : ${corpus}`);
logger.info(`lang0  : ${lang0}`);
logger.info(`lang1  : ${lang1}`);

const resp = await fetchOpusTmx(corpus, lang0, lang1);
const stream = resp?.pipeThrough(new TmxSegmentStream());

const rules = [];
const dicts = [new Map(), new Map()];

function addRuleSegment(
  rule: Rule,
  segment: Segment,
  index: number,
) {
  const dict = dicts[index];

  rule[index].push(segment);

  for (const word of segment) {
    const wordRules = dict.get(word);

    if (wordRules == null) {
      dict.set(word, [rule]);
    } else {
      wordRules.push(rule);
    }
  }
}

if (stream != null) {
  for await (const rawSegments of stream) {
    if (rawSegments.length < 2) {
      continue;
    }

    const segments = rawSegments.slice(0, 2).map((segment: string) =>
      segment.toLowerCase().match(/\p{L}+/gu)
    );

    if (
      segments.some((segment: Segment) =>
        segment === null || segment.length !== 1
      )
    ) {
      continue;
    }

    const wordRules0 = dicts[0].get(segments[0][0]);
    const wordRules1 = dicts[1].get(segments[1][0]);

    if (wordRules0 != null && wordRules0.length > 0) {
      const rule = wordRules0[0];

      if (
        rule[1].every((segment: Segment) => segment[0] !== segments[1][0])
      ) {
        addRuleSegment(rule, segments[1], 1);
      }
    } else if (wordRules1 != null && wordRules1.length > 0) {
      const rule = wordRules1[0];

      if (
        rule[0].every((segment: Segment) => segment[0] !== segments[0][0])
      ) {
        addRuleSegment(rule, segments[0], 0);
      }
    } else {
      const rule = segments.map((_: Segment) => []);

      for (let s = 0; s < segments.length; s++) {
        addRuleSegment(rule, segments[s], s);
      }

      rules.push(rule);
    }
  }
}

const file = await Deno.open("dist/index.html", {
  create: true,
  truncate: true,
  write: true,
});

const writer = file.writable.getWriter();
const encoder = new TextEncoder();

async function writeLine(text: string) {
  await writer.write(encoder.encode(text));
  await writer.write(encoder.encode("\n"));
}

async function writeRule(rule: Rule, prefix: string) {
  await writeLine(
    `<tr><td>${prefix}</td><td>` +
      rule.map((segment) => segment.join("<br>")).join("</td><td>") +
      "</td></tr>",
  );
}

await writeLine('<meta charset="utf-8">');

await writeLine(`<style>
  table { width: 100%; border-collapse: collapse; }
  table, th, td { border: 1px solid; }
  td { padding: 8px; }
</style>`);

await writeLine("<h2>Rules</h2>");
await writeLine("<table>");

for (const rule of rules) {
  await writeRule(rule, "");
}

await writeLine("</table>");

for (let d = 0; d < dicts.length; d++) {
  const dict = dicts[d];

  await writeLine(`<h2>Words ${d}</h2>`);
  await writeLine("<table>");

  for (const [word, wordRules] of dict) {
    for (const rule of wordRules) {
      await writeRule(rule, word);
    }
  }

  await writeLine("</table>");
}

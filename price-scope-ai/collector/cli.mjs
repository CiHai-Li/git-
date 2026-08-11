import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { collectTargets } from "./core.mjs";

const args = Object.fromEntries(process.argv.slice(2).map((value, index, all) => value.startsWith("--") ? [value.slice(2), all[index + 1]] : null).filter(Boolean));
if (!args.input) {
  process.stderr.write("用法：node collector/cli.mjs --input examples/采集任务示例.json --output outputs/采集结果.json\n");
  process.exit(1);
}

const inputPath = resolve(args.input);
const outputPath = resolve(args.output || "outputs/采集结果.json");
const targets = JSON.parse(await readFile(inputPath, "utf8"));
const results = await collectTargets(targets, { delayMs: Number(args.delay || 1200) });
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(results, null, 2)}\n`, "utf8");
process.stdout.write(`完成 ${results.filter((item) => item.status === "success").length}/${results.length}，结果：${outputPath}\n`);

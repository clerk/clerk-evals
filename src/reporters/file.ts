import fs from "fs";
import type { Score } from "@/src/interfaces";

export default function fileReporter(scores: Score[]) {
  fs.writeFileSync("scores.json", JSON.stringify(scores, null, 2));
}

import { execute, report } from "./executor";

execute().then((scores) => {
  report(scores);
});

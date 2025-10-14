import { useEffect, useState } from "react";
import useSWR from "swr";
import { render, Box, Text, useApp, Spacer } from "ink";
import { Badge, Spinner, Alert } from "@inkjs/ui";

import { tasks, pool } from "./executor";
import type { RunnerResult } from "./interfaces";

const App = () => {
  const { exit } = useApp();
  const [taskList, _] = useState(() => tasks);

  // dynamic columns based on task categories
  const categories = Array.from(new Set(taskList.map((task) => task.category)));
  const models = Array.from(new Set(taskList.map((task) => task.model)));

  // model: string
  // [category: string]: score (string)

  const initialData = models.map((model) => {
    const entry: { model: string; [key: string]: string | number } = {
      model,
    };
    categories.forEach((category) => {
      entry[category] = "-";
    });
    return entry;
  });

  const [data, setData] = useState(() => initialData);

  useSWR("tasks", async () => {
    // Run all in parallel
    return Promise.all(
      tasks.map(async (task) => {
        const result: RunnerResult = await pool.run(task);

        if (!result.ok) {
          setData((prev) => {
            const newData = prev.map((row) => {
              if (row.model === task.model) {
                return {
                  ...row,
                  [task.category]: "ERR",
                };
              }
              return row;
            });
            return newData;
          });
          return;
        }

        const scoreObject = {
          model: task.model,
          category: task.category,
          value: result.value.score,
          updatedAt: new Date().toISOString(),
        };
        setData((prev) => {
          const newData = prev.map((row) => {
            if (row.model === task.model) {
              return {
                ...row,
                [task.category]: result.value.score,
              };
            }
            return row;
          });
          return newData;
        });
        return scoreObject;
      })
    );
  });

  const maxWidth = undefined;
  const modelColWidth = 20;
  const categoryColWidth = 11;

  return (
    <Box flexDirection="column" width={maxWidth} padding={1}>
      <Alert title="Clerk Evals ✨">
        <Text italic>
          Evaluating {taskList.length} tasks across {models.length} models and{" "}
          {categories.length} categories. (Fake scores below, for TUI demo only)
        </Text>
      </Alert>

      <Box paddingTop={1}></Box>

      {/* Table Header */}
      <Box borderStyle={"classic"}>
        <Box width={modelColWidth} paddingX={1}>
          <Text bold>Model</Text>
        </Box>
        {categories.map((category) => (
          <Box key={category} width={categoryColWidth} paddingX={1}>
            <Text bold>{category}</Text>
          </Box>
        ))}
      </Box>

      {/* Table Body */}
      {data.map((row, index) => (
        <Box
          key={row.model}
          borderStyle={"classic"}
          borderTop={false}
          borderBottom={index === data.length - 1 ? true : false}
        >
          <Box width={modelColWidth} paddingX={1}>
            <Text>{row.model}</Text>
          </Box>
          {categories.map((category) => (
            <Box
              key={`${row.model}-${category}`}
              width={categoryColWidth}
              paddingX={1}
              justifyContent="flex-end"
            >
              {typeof row[category] === "number" && (
                <Box
                  paddingX={2}
                  backgroundColor={
                    row[category] >= 0.8
                      ? "green"
                      : row[category] >= 0.5
                      ? "yellow"
                      : "red"
                  }
                >
                  <Text color={"black"}>
                    {Number(row[category])
                      .toLocaleString(undefined, {
                        style: "percent",
                      })
                      .padStart(4, " ")}{" "}
                  </Text>
                </Box>
              )}
              {typeof row[category] === "string" && (
                <Text dimColor>{row[category]}</Text>
              )}
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  );
};

const { waitUntilExit } = render(<App />);

await waitUntilExit();

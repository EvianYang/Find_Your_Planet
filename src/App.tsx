import { PromptSchema } from "@contracts/game.ts";

const contractExample = {
  id: "curated-01",
  text: "如果世界上可以多一种颜色，你希望它出现在什么地方？",
  source: "curated",
  version: "fmp-v1",
} as const;

function ContractPreview() {
  const result = PromptSchema.safeParse(contractExample);

  return (
    <main>
      <h1>Contracts preview</h1>
      <p>这是 B 侧的本地结构校验入口，不代表后端或 AI 服务已连接。</p>
      <p>
        Prompt fixture validation: <strong>{result.success ? "通过" : "失败"}</strong>
      </p>
      <pre>{JSON.stringify(contractExample, null, 2)}</pre>
      <p>
        C 的评估 fixture 将接入 <code>src/fixtures/round-results.ts</code>。
      </p>
      <a href="/">返回运行页</a>
    </main>
  );
}

export default function App() {
  const isContractPreview =
    new URLSearchParams(window.location.search).get("preview") === "contracts";

  if (isContractPreview) {
    return <ContractPreview />;
  }

  return (
    <main>
      <h1>Find Your Planet</h1>
      <p>两颗星之间的距离，两颗心之间的距离。</p>
      <p>React、TypeScript 与 Vite 运行环境已接通。</p>
      <a href="/?preview=contracts">打开 contracts 预览</a>
    </main>
  );
}

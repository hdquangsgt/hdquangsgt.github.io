---
title: 'Pi Agent：自由と利便性のトレードオフ'
description: 'Pi は小さなエージェントコアと拡張機能 API を提供し、残りを利用者に委ねる。拡張機能、サブエージェント、サンドボックスをめぐる私の実験から、その自由にどんな価値があるのか、そして利用者に返ってくるエンジニアリングと運用の作業を考える。'
pubDate: 2026-10-19T09:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: false
qiita:
  publish: true
  visibility: limited
---

<div class="callout">

**この記事の読み方。** Pi は変化が速いため、主張にはラベルを付けている。

- <span class="label documented">ドキュメント</span>：公式ドキュメント、ソースコード、または作者自身の投稿に記載されている内容。主張のすぐ横にリンクを示す。
- <span class="label observed">観察</span>：私が自分で体験したこと。管理されたテストではない。
- <span class="label opinion">意見</span>：私の解釈。
- <span class="label proposal">提案</span>：評価に値するアイデア。私がテストしたものでも、Pi が提供しているものでもない。

**バージョン。** Pi に関する主張は `@earendil-works/pi-coding-agent` **1.3.0**（2026 年 10 月 20 日に確認した時点の npm の `latest` タグ）、同日時点の Pi のドキュメントとリポジトリ、そして Claude Code と OpenAI Codex のドキュメント（および Codex のオープンソースリポジトリ、コミット `e18a20d`）に基づく。これらはいずれも変化が速いため、バージョン固有の記述はスナップショットとして読んでほしい。出力品質のベンチマークは一切行っておらず、本記事のどの記述も、どのエージェントがより良いコードを書くかを述べるものではない。

</div>

## 1. 最初の驚き

<div class="callout observed">

<span class="label observed">観察</span> Pi を使うことは、最も強力な技術の一つに触れているような感覚だった。ところがその直後に、比べればほとんど原始的にさえ見えるものを作り直している自分に気づいた。モデルは強力だった。しかし、以前使った統合型のコーディング製品と比べると、その周りの環境は薄かった。

</div>

この対比は、作業がどこに置かれているかについての話であり、品質についての話ではない。統合型の製品では、開いた時点で多くの補助的な機能がすでに存在している。Pi では、そうした部品を自分で変更したり作ったりでき、私は実際にそうし始めた。

この記事は一つの論旨に沿って進む。**Pi は、モデルの周りのシステムを形作る自由を開発者により多く与え、その自由は責任を開発者に移す。** 利便性がなくなるわけではない。それは、自分で構築し、統合し、テストし、保守するものになる。アーキテクチャとそのツールの仕組みから始め、私の実験、実行が失敗したときに何が起こるか、パーミッションの境界、ワークフローの問題、Code Mode を経て、ツールセットを大きくすればこれらのどれかが解決したのかを問い、このトレードオフが何であると私が考えるかで締めくくる。

## 2. Pi とは何か

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi は Mario Zechner によって、2025 年 11 月に [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) で紹介された。コードは現在 [earendil-works/pi](https://github.com/earendil-works/pi) にある。エージェントループは、メッセージをアクティブなブランチに追加し、モデルの応答をストリーミングし、ツール呼び出しを実行して結果を記録し、必要なら次のターンを開始する。5 つのインターフェースが同じエージェントとセッションの仕組みを共有する。インタラクティブなターミナル、print、JSON（JSONL イベント）、RPC（stdin/stdout 上の JSONL）、そしてプロセス内で使う TypeScript SDK である。（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）

</div>

![Pi の階層アーキテクチャ。4 つの操作方法（インタラクティブ TUI、print/JSON、RPC、TypeScript SDK）が pi-coding-agent（セッション、コンテキストファイル、コンパクション、トラスト、設定）の上に乗り、pi-coding-agent は pi-agent-core（エージェントループ）と pi-ai（統一 LLM API）の上に乗っている。拡張機能は横からコーディングエージェントにフックし、ツールやコマンドを登録したり、ツール呼び出しをブロックしたりできる。最下層では、組み込みツールが Pi を起動した OS ユーザーとして実行され、デフォルトではパスの囲い込みも承認プロンプトもない。](../images/pi-architecture.svg)

デフォルトで有効な組み込みツールは 4 つ、`read`、`bash`、`edit`、`write` である。さらに 4 つの組み込みツール（`grep`、`find`、`ls`、Windows 専用の `powershell`）はオプトインである（[CLI reference](https://pi.dev/docs/latest/cli)）。ツールの仕組み全体はセクション 3 で扱う。ホームページは、Pi が意図的に省いているものを挙げている。"No sub-agents"、"No plan mode"、"No permission popups" である。それぞれについて、代わりに拡張機能、パッケージ、あるいは他のツールを案内している（[pi.dev](https://pi.dev)）。

ループ自体は小さい。Pi はメッセージをアクティブなブランチに追加し、システムプロンプト、ブランチ、ツール定義、モデル設定からリクエストを組み立て、応答をストリームし、その中のツール呼び出しをすべて実行して結果を記録する。その結果やキューに入ったメッセージがもう一度リクエストを必要とすれば、新しいターンが始まる。そうでなければ、その実行は終わる（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。

![エージェントループ。メッセージがアクティブなブランチに追加され、システムプロンプト、ブランチ、ツールからリクエストが組み立てられ、モデルがテキストとツール呼び出しを含む応答をストリームし、ツール呼び出しが実行されて結果が記録される。さらにリクエストが必要なら新しいターンが始まり、不要なら agent_end が 1 回の実行の終了を示し、agent_settled が Pi は自動では続行しないことを知らせる。下段は実行中のエージェントへ介入する 3 つの方法で、Enter によるステアリングは現在のターンの後に届き、Alt+Enter によるフォローアップは保留中の作業が終わってから届き、Escape による中断は実行を止めてキュー内のメッセージをエディタに戻す。](../images/agent-loop.svg)

<div class="callout documented">

<span class="label documented">ドキュメント</span> 実行中の処理にも介入できる。Enter は次の応答を方向づけるメッセージを送り、現在の応答とそのツール呼び出しが終わるまで待つ。Alt+Enter は現在のタスクの後に実行されるフォローアップをキューに入れる。Escape はタスクを止め、キュー内のメッセージをエディタに戻す（[Usage](https://pi.dev/docs/latest/usage)）。RPC では、同じ考え方が `steer`、`follow_up`、`abort` コマンドにあたる。RPC のページは 2 つのシグナルも区別している。`agent_end` は低レベルの 1 回の実行を終わらせ、`agent_settled` は Pi が自動では続行しないことを示す（[RPC](https://pi.dev/docs/latest/rpc)）。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> ステアリングは、セクション 5 が立ち返る「制御」の最初の部品であり、キーボードの前にいる人のための制御である。親エージェントがサブエージェントをどう操縦するかについては何も語らない。`agent_end` と `agent_settled` の区別が重要なのは、セクション 6 の回復と同じ理由による。「実行が終わった」と「これ以上何も起きない」は別の主張である。

</div>

ドキュメントはカスタマイズの仕組みを区別しており、その違いは以下のすべてに関わってくる（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。

| 仕組み | 内容 | 強制力 |
|---|---|---|
| スキルとコンテキストファイル | モデルが読む指示。オンデマンドまたは起動時に読み込まれる。 | なし。モデルが無視する可能性がある。 |
| プロンプトテンプレート | 入力から展開される再利用可能なメッセージ文。 | なし。 |
| 拡張機能 | Pi のプロセスに読み込まれる TypeScript モジュール。ツール、コマンド、プロバイダー、イベントハンドラ、UI を登録する。 | コードによる。ツール呼び出しをブロックでき、プロセスの OS 権限で動く。 |
| パッケージ | 拡張機能、スキル、テンプレート、テーマを npm や git で配布する手段。 | 中身と同じ。 |

ホームページによれば、MCP は Codemode（第 10 節）とともに、現在は組み込みになっている。

これらの層は異なる問いに答えるものであり、間違った層を選ぶのはありがちなミスである。コードを書く前に、要件が実際に何であるかを問うこと。

- **指示や再利用可能な知識**（このリポジトリのビルド方法、適用される規約）：コンテキストファイル、スキル、またはプロンプトテンプレート。スキルは、ワークフローが "needs more context than a prompt template but does not need a new executable integration point"（プロンプトテンプレートより多くのコンテキストを必要とするが、新しい実行可能な統合ポイントは必要としない）場合に向いている（[Skills](https://pi.dev/docs/latest/skills)）。
- **実行時の挙動やツール実行**（呼び出しをブロックする、ツールを追加する、モデルに見えるものを変える）：拡張機能。
- **他のシステムとの統合：** 拡張機能、MCP、または RPC や SDK を通じた Pi の外部からの操作（第 9 節）。
- **それらの一式の配布と保守：** パッケージ。パッケージは配布の仕組みにすぎず、"can execute extension code and can include skills that instruct the model to run programs"（拡張機能のコードを実行でき、モデルにプログラムを実行するよう指示するスキルを含みうる）ため、ソースのレビューは自分の仕事になる（[Packages](https://pi.dev/docs/latest/packages)）。

<div class="callout opinion">

<span class="label opinion">意見</span> スキルで足りるのに拡張機能を選べば、Pi の API に追随しなければならない TypeScript を抱えることになる。強制力が必要なのにスキルを選べば、無視するかもしれないモデルに頼ることになる。私が選択を誤った事例は述べていないし、でっち上げるつもりもない。要点は、拡張機能 API が強力であるために、この選択が見過ごされやすいということである。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> そこから出てくる問いは、Pi が完成したコーディングアプリケーションなのか、それとも上に構築していくエージェントの基盤なのか、ということである。私は後者として読んでいる。私の実験が、私をそこへ押しやった。

</div>

## 3. ツール：モデルが実際にできること

この記事では「ツール」という言葉を何度も使ってきたし、以降もこの言葉に頼る。パーミッション、可観測性、サブエージェント、回復は、突き詰めればどれもツール呼び出しに関する問いである。だから先へ進む前に、Pi におけるツールとは何かを正確にしておく価値がある。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi の拡張機能ガイドによれば、ツールは「defines a name, model-facing description, TypeBox parameter schema, and `execute()` function」（名前、モデル向けの説明、TypeBox のパラメータスキーマ、`execute()` 関数を定義する）ものである（[extensions guide](https://pi.dev/docs/latest/extensions)）。Pi の組み込みツールも同じ形をしている。[`src/core/tools`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core/tools) 以下の各ファイルが、説明、TypeBox スキーマ、実装を定義している。モデルがファイルシステムに触れることはない。モデルは構造化されたリクエストを出し、実際の作業は Pi のコードが行う。

</div>

### ツール呼び出し 1 回を順に追う

![ツール呼び出し 1 回のシーケンス図。レーンは 4 つ：モデル、エージェントループ、拡張機能、ツール。手順 1：ループがシステムプロンプト、ブランチ、ツール定義を含むリクエストを送る。手順 2：モデルがテキストと、名前と引数を持つツール呼び出しを返す。手順 3：ループがツールを探し、引数をそのスキーマに対して検証する。手順 4：ループが tool_call ハンドラーを実行し、ハンドラーは入力を変更するか、ブロックできる。手順 5：ハンドラーが呼び出しを許可するか、理由付きでブロックする。ブロックはエラー結果になる。手順 6：ループがツールの execute を呼ぶ。手順 7：ツールが content と details を返す。throw するとエラー結果になる。手順 8：tool_result ハンドラーが結果を伏せ字化、注釈付け、置き換えできる。手順 9：次のリクエストにツール結果メッセージが含まれる。注記：1 回の応答に複数の呼び出しがあれば、既定では並行して実行され、結果はモデルが要求した順に記録される。sequential のツールが 1 つでもあれば、バッチ全体が 1 つずつ実行される。](../images/tool-call-lifecycle.svg)

図の 5 つの要素は、それぞれ役割が違う。

- **モデル**は提案する。ツール定義を見て、呼ぶかどうかを決める。何も実行できない。
- **エージェントループ**は実行を担う。ツールを探し、引数を検証し、フックを走らせ、`execute()` を呼び、結果をメッセージに変える。
- **ツール定義**はモデルが読む契約である。名前、説明、パラメータスキーマからなる。
- **ツールの `execute()`** は Pi プロセス内で動く普通のコードで、そのプロセスの OS 権限で動く。
- **ツール結果**はツール結果メッセージとしてアクティブなブランチに戻り、次のリクエストに含まれる。大きな出力が問題になる理由もここにある。結果に入っているものは、そのままコンテキストになる。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi のドキュメントによれば、各リクエストはシステムプロンプト、アクティブなブランチ、「available tools」、モデル設定から組み立てられ、Pi はプロバイダーの応答に含まれる各ツール呼び出しを実行して結果を記録する（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。図の細部はループのコードに由来する。未知のツール名はエラー結果を返し、ブロックされた呼び出しはハンドラーの理由を載せたエラー結果を返す。1 回の応答内の呼び出しは、`toolExecution` またはツールの `executionMode` が `sequential` を指定しない限り、既定で並行して実行される（[agent-loop.ts](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts)、[agent README](https://github.com/earendil-works/pi/blob/main/packages/agent/README.md)）。拡張機能ガイドによれば、`tool_call` ハンドラーは「can mutate input or block execution」（入力を変更または実行をブロックできる）、`tool_result` ハンドラーは結果を伏せ字化、注釈付け、置き換えできる。

</div>

### Pi に同梱されているもの

<div class="callout documented">

<span class="label documented">ドキュメント</span> [CLI reference](https://pi.dev/docs/latest/cli) は 8 つの組み込みツールを挙げており、ソースの `allToolNames` も同じ 8 つである。ドキュメントは総数を明記していないので、「8」はこの表を私が数えた結果である。そのうち 4 つ（`read`、`bash`、`edit`、`write`）が既定で有効で、`defaultTools` 設定で制御される（[Settings](https://pi.dev/docs/latest/settings)）。右端の列の出力上限は、散文のドキュメントではなく、リポジトリの main ブランチ（コミット `a731ba8`、パッケージバージョン 1.3.0）のツールのソースによる。

</div>

| ツール | 役割 | 既定 | 出力上限（ソースより） |
|---|---|---|---|
| `read` | テキストファイルと対応する画像を読む | 有効 | 2,000 行または 50 KB。`offset` / `limit` で続きを読む |
| `bash` | 作業ディレクトリでシェルコマンドを実行する | 有効 | 末尾 2,000 行または 50 KB。全出力は一時ファイルに保存 |
| `edit` | 既存ファイルに対して完全一致のテキスト置換を行う | 有効 | なし |
| `write` | ファイルを作成または上書きする | 有効 | なし |
| `grep` | ファイル内容を検索する。`.gitignore` を尊重する | オプトイン | 100 件または 50 KB |
| `find` | glob パターンでパスを探す。`.gitignore` を尊重する | オプトイン | 1,000 件または 50 KB |
| `ls` | ディレクトリを一覧する。ドットファイルを含む | オプトイン | 500 エントリまたは 50 KB |
| `powershell` | PowerShell コマンドを実行する。Windows のみ | オプトイン | `bash` と同様 |

さらに 2 つのツールが、コアのツールセットではなく Pi の組み込み*拡張機能*から提供される。どちらも既定ではオフである（[CLI reference](https://pi.dev/docs/latest/cli)）。

| ツール | 役割 |
|---|---|
| `codemode` | モデルが他のツールを呼ぶ JavaScript を書く。返ってくるのはスクリプトの出力だけ（第 10 節） |
| `tool_search` | モデルに宣言されていないツールを探し、一致したものを次の呼び出しのために宣言する |

<div class="callout documented">

<span class="label documented">ドキュメント</span> ドキュメントによれば、MCP 拡張機能は「when an MCP server needs them」（MCP サーバーが必要とするとき）この 2 つをオンにする。自分で `--tools` や `defaultTools` に名前を書いて有効にすることもできる。`--tools` は選択全体を置き換え、`+name` / `-name` の形式は既定の選択を調整する。例：`pi --tools +codemode,-write`（[CLI reference](https://pi.dev/docs/latest/cli)）。

</div>

私自身の以前の簡略な書き方を訂正しておく。セクション 2 は、既定で有効なツールは 4 つで、`grep`、`find`、`ls` はオプトインだと述べた。それは正しいが不完全である。Windows 専用のシェルを含めて組み込みの名前は 8 つあり、さらに 2 つのツールが拡張機能の裏にある。

### コアのツール、拡張機能のツール、自作のツール

「Pi にはツールがいくつあるか」という問いに単一の答えはない。ツールはさまざまな経路でモデルに届くからである。

| 種類 | 定義するもの | モデルへの届き方 |
|---|---|---|
| 組み込みツール | Pi のコア（`read`、`bash`、`edit`、`write`、`grep`、`find`、`ls`、`powershell`） | 有効なときに宣言される。最初の 4 つは既定で有効 |
| 組み込み拡張機能のツール | Pi に同梱の拡張機能（`codemode`、`tool_search`） | 無効の状態で登録され、名前の指定または MCP 拡張機能で有効になる |
| MCP ツール | 設定した MCP サーバー。名前は `mcp__<server>__<tool>` | サーバーごとの `exposure`：`codemode`（既定。モデルには宣言されない）、`deferred`、`direct`、`hidden`（[MCP](https://pi.dev/docs/latest/mcp)） |
| 自作の拡張機能ツール | 自分の TypeScript 拡張機能が `pi.registerTool()` で登録 | 既定は `direct` で、登録時に有効になる。他の exposure も選べる |
| SDK ツール | Pi を組み込むホストアプリケーションが `customTools` オプションで渡す | `tools`、`noTools`、`excludeTools` が制御するアクティブなツールセットの一部（[SDK](https://pi.dev/docs/latest/sdk)） |

自作ツールは小さなコードである。次は Pi 自身の `hello.ts` サンプルを短くしたものだ（[ソース](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)）。

```typescript
const helloTool = defineTool({
  name: "hello",
  label: "Hello",
  description: "A simple greeting tool",
  parameters: Type.Object({ name: Type.String({ description: "Name to greet" }) }),
  async execute(_toolCallId, params, _signal, _onUpdate, _ctx) {
    return {
      content: [{ type: "text", text: `Hello, ${params.name}!` }],
      details: { greeted: params.name },
    };
  },
});

export default function (pi: ExtensionAPI) {
  pi.registerTool(helloTool);
}
```

<div class="callout documented">

<span class="label documented">ドキュメント</span> ツールを書くうえでドキュメントとソースが述べていること。失敗を報告するには `execute()` から throw する。エラーらしい形のオブジェクトを返しても、結果はエラーとして扱われない。大きな結果は切り詰め、全出力の場所をモデルに伝える。ファイルを変更するツールは、読み取り・変更・書き込みの全体を `withFileMutationQueue()` で包むべきで、可変状態を共有するツールは逐次実行すべきである。ツールは `outputSchema` を宣言でき、その場合 codemode のスクリプトは構造化データを、モデルはテキストを受け取る。型定義のコメントによれば、`promptSnippet` のないツールは、既定のシステムプロンプトの「Available tools」一覧から省かれる。拡張機能は、組み込みツールと同じ名前でツールを登録して置き換えることもできる。リポジトリの [`tool-override.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts) サンプルは `read` でそれを行い、ファイルアクセスを記録して機密パスをブロックする。私はこれを実行していない。（[extensions guide](https://pi.dev/docs/latest/extensions)、[`types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)）

</div>

### ツール、拡張機能、スキル、MCP サーバー、パッケージ

セクション 2 では、カスタマイズの仕組みを、何を強制するかで分けた。ここでは同じ区分を、モデルのツール面に何をするかで見直す。

| 仕組み | モデルが呼べる操作を追加するか | Pi プロセス内でコードを実行するか |
|---|---|---|
| ツール | する。それ自体が操作である | する。その `execute()` が動く |
| 拡張機能 | `registerTool()` を呼べばする。コマンド、フック、プロバイダー、UI も追加できる | する |
| スキル | しない。モデルは既に持っているツールで指示に従う | しない |
| プロンプトテンプレート | しない。メッセージテキストに展開される | しない |
| MCP サーバー | する。そのツールが `mcp__<server>__<tool>` として現れる | サーバーは別プロセスまたはリモートサービス。Pi の MCP 拡張機能がクライアント |
| パッケージ | 上記のいずれかを運ぶ | 中身次第 |

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi のクイックスタートは経験則を示している。「Start with the least powerful mechanism that meets your need」（必要を満たす最も非力な仕組みから始めよ）。その表では、フォルダーの永続的な指示は `AGENTS.md`、タスク固有の指示はスキル、「executable tools, commands, or event handlers」は拡張機能に対応づけられている（[Quickstart](https://pi.dev/docs/latest/quickstart)）。

</div>

<div class="callout documented">

<span class="label documented">ドキュメント</span> 自作ツールで重要な制約。拡張機能は「run inside the Pi process with the same operating-system permissions」（Pi プロセス内で同じ OS 権限で動く）ため、プロンプト、ツール呼び出し、ファイル、認証情報、セッション履歴を読める。ガイドは、信頼できる提供元からのみ読み込むよう述べている（[extensions guide](https://pi.dev/docs/latest/extensions)）。有効なツールは Pi プロセスの OS 権限で動き、Pi は「does not ask for approval before every tool call」（ツール呼び出しのたびに承認を求めない）（[Security](https://pi.dev/docs/latest/security)）。プロジェクトローカルの拡張機能と `.pi/mcp.json` はプロジェクトの信頼が与えられて初めて読み込まれるが、信頼は「does not limit what tool calls can access or affect」（ツール呼び出しがアクセス・影響できる範囲を制限しない）。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> ここから二つのことが言える。第一に、自作ツールは設計が必要な新しい能力である。良い説明とスキーマ、上限のある出力、正直なエラー、触れてよい範囲の決定が要る。Pi がそのレビューをしてくれることはない。第二に、`tool_call` フックは呼び出しを拒否できるが、Pi 自身のセキュリティのページは、本当の境界をフックではなくオペレーティングシステムに置いている。この観点で見ると、セクション 4 の私の実験は、この層で挙動を作ろうとする試みだった。これは解釈であり、各実験がどのフックやツールを使ったかを報告しているわけではない。

</div>

## 4. 欠けている部品を作る

<div class="callout observed">

<span class="label observed">観察</span> 自分が望む形では見つからなかった機能を得るために、拡張機能で実験した。

- **オーケストレーター**
- 長いセッションや大量のコンテキストを伴う作業を扱う**サブエージェント**
- **パーミッションを制限する**ことを意図した拡張機能
- サンドボックスとして、**Pi を Docker コンテナ内で動かす**試み

これらは実装上の困難やエラーに突き当たった。それでも、エージェントが内部でどう動くのかについて、多くのことを教えてくれた。私が最も正確に説明できる困難は、サブエージェントが何をしているのかを見るのが難しかったことで、これは第 5 節で掘り下げる。個々のエラーはここでは列挙しない。Docker の試みについても構成や結果は報告しないため、この記事のどの記述も、それを Pi のセキュリティの検証として扱っていない。

</div>

順序は、個々のエラーよりも重要である。サブエージェントを試した動機は、長いセッションと大きなコンテキストだった。望む形のものが見つからなかったので、自分で作ってみようとした。作る手間の先に残ったのは、委任をめぐる問いだった。オーケストレーターは何に責任を持つのか、サブエージェントの結果や失敗はどこへ行くのか、そしてそれを誰が見られるのか。この記事の残りは、その問いに沿って進む。これは私自身の実験をどう読んだかである。これらの部品を作ったときに何が起きたかについての解釈であり、Pi に委任の機能が一般に欠けているという主張ではない。

ドキュメントが前提としている内容は別の話であり、確認できる。Pi は「サブエージェントなし」を選択として明示している。拡張機能ガイドにもサブエージェントへの言及はないが、拡張機能が `ctx.executeTool()` で他のツールを実行することは可能であり、そのネストした呼び出しは、モデルが発行した呼び出しと同じ `tool_call` ハンドラを通る（[extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)）。つまりオーケストレーターは設定するものではなく、設計するものである。

### コンテキストはウィンドウだけではない


まず、そもそも何がウィンドウを埋めるのかから始める。システムプロンプトは Pi の基本指示と、見つかったコンテキストファイルからなる。ツール定義はすべてのリクエストとともに送られ、アクティブなブランチは user、assistant、tool-result のメッセージに変換される。スキルは段階的に読み込まれる。システムプロンプトに入るのは各スキルの名前、説明、パスだけで、`SKILL.md` の全文は、モデルがタスクが説明に合致すると判断したときに読まれる。`disable-model-invocation: true` を持つスキルは、明示的な `/skill:name` コマンドからだけ使える。自分のメッセージには `@` によるファイル参照、貼り付けた画像、`!command` の出力を載せられ（`!!command` は出力をモデルに送らずにコマンドを実行する）、拡張機能はリクエストが出る前に指示を追加したりコンテキストを変換したりできる（[How Pi works](https://pi.dev/docs/latest/how-pi-works)、[Skills](https://pi.dev/docs/latest/skills)、[Usage](https://pi.dev/docs/latest/usage)、[extensions guide](https://pi.dev/docs/latest/extensions)）。

![1 回のモデルリクエストに入るもの。5 つの入力がある。システムプロンプト（Pi の基本指示とコンテキストファイル）、毎回のリクエストと一緒に送られるツール定義、スキル一覧（名前、説明、パスのみで、本文は必要に応じて読み込まれる）、履歴（アクティブなブランチで、古いターンの代わりに要約が入る）、現在のメッセージ（ファイル、画像、コマンド出力、展開されたテンプレート）。拡張機能は before_agent_start、context、before_provider_request などのフックでリクエストを変換でき、その結果がプロバイダへ送られる。](../images/request-assembly.svg)

<div class="callout opinion">

<span class="label opinion">意見</span> 帰結は 2 つある。スキルの説明はルーティングの手がかりなので、曖昧な説明はルーティングを悪くする。これは Skills のページも述べている。そして説明は常にプロンプトに入っているため、大きなスキル集は毎回のリクエストに常時コストを払わせる。そのコストは測っていないので、数字ではなく設計上の考慮事項として扱う。

</div>
長いコンテキストこそ、私がサブエージェントを欲しがった理由だった。そこで、Pi 自身の仕組みが何をするのかを正確に押さえておく価値がある。混同しやすいものが 3 つある。

<div class="callout documented">

<span class="label documented">ドキュメント</span> セッションは（`--no-session` でない限り）自動的に `~/.pi/agent/sessions/` の下に、作業ディレクトリごとにまとめて保存される。"Pi stores entries as a tree, so returning to an earlier point does not erase the branch you leave."（Pi はエントリをツリーとして保存するため、以前の時点に戻っても、離れたブランチは消えない）。`/tree` は現在のセッションファイル内を移動し、`/fork` は以前のユーザーメッセージから新しいセッションを作成し、`/clone` はアクティブなブランチを新しいセッションにコピーする。モデルが受け取るのはアクティブなブランチだけで、ファイル内のすべてのブランチではない（[Sessions](https://pi.dev/docs/latest/sessions)）。コンパクションは "does not delete the original session entries"（元のセッションエントリを削除しない）（[Sessions](https://pi.dev/docs/latest/sessions)）。要約エントリが以降のリクエストで古いメッセージの代わりを務め、元のエントリはツリーに残る（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。

</div>

- **コンパクション**は、モデルが*今*見ているものを管理する。古いメッセージを要約に置き換えるため、要約が何を残すかが、その後のエージェントの知識を決める。
- **永続化**は、コンパクションがモデルから隠したものも含め、完全な記録をディスクに残す。
- **ブランチ**は*方向*を制御する。以前の時点に戻り、離れた道を失うことなく別のアプローチを試せる。

<div class="callout documented">

<span class="label documented">ドキュメント</span> 自動コンパクションは、コンテキストのトークン数がウィンドウから `reserveTokens`（デフォルト 16,384）を引いた値を超えたときに始まる。Pi は後ろから遡り、約 `keepRecentTokens`（デフォルト 20,000）分の最近のメッセージに達するまで進み、それらをそのまま残し、それより古いものすべてを要約のためにモデルへ送る。以前の要約があれば、それも渡す。結果は `firstKeptEntryId` を持つコンパクションエントリとして保存される。切れ目はツール結果の上には来ない。ツール結果は対応する呼び出しとペアでなければならないからだ。1 つのユーザーターンが大きすぎる場合、Pi はそのターンの内部で切り、2 つの要約を統合する。要約は決まった構成（Goal、Constraints & Preferences、Progress、Key Decisions、Next Steps、Critical Context）に、読み取ったファイルと変更したファイルの一覧が付く。`/compact [instructions]` は手動の要約が重視する点を方向づけ、`compaction.modelOverrides` はモデルごとの値を設定し、拡張機能イベント `session_before_compact` はコンパクションを取り消したり、独自の要約を渡したりできる。`/tree` で別のブランチへ移ると、Pi は離れたブランチを要約することもできる。（[Compaction](https://pi.dev/docs/latest/compaction)）

</div>

![ツリーとしてのセッション。エントリ e1 から e8 がアクティブなブランチをなし、e8 の後にコンパクションエントリが続く。e3 から分かれた脇のブランチ b4、b5 はディスク上に残るが、モデルには送られない。e1 から e4 は要約される古い区間で、元のエントリはツリーに残る。e5 から e8 は keepRecentTokens（デフォルト 20,000）の大きさでそのまま残される最近の区間である。次のリクエストは、要約と e5 から e8、それに新しいメッセージからなる。コンパクションエントリは要約と firstKeptEntryId を保存する。](../images/session-compaction.svg)

<div class="callout opinion">

<span class="label opinion">意見</span> したがって、コンテキスト管理はウィンドウにより多くを収めることだけではない。エージェントがどの履歴を先へ持ち越し、次にどの道をたどるかを選ぶことでもある。ただし、これらがそれだけでコンテキストの枯渇を解決することは示されていない。コンパクションは失敗しうる（ドキュメントによれば、プロバイダー側の問題を直してから `/compact` をもう一度実行する）し、要約は本質的に損失を伴うし、ディスク上の記録がひとりでにモデルのコンテキストに戻ることはない。ブランチは人が舵を取る助けにはなるが、長いタスクをひとりでに継続させるものではない。私のオーケストレーターの実験でこれらの機能がどう振る舞うかはテストしていないため、サブエージェントの必要性をなくせたかどうかは言えない。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> ドキュメントにある数字は、詳細がどこで消えうるかを示している。要約の前に、Pi はメッセージをラベル付きのテキストにシリアライズし、thinking ブロックを捨て、各ツール結果を 2,000 文字に切り詰める（[Compaction](https://pi.dev/docs/latest/compaction)）。長いテストログやファイル一覧は、切り詰められた状態で要約器に届く。これはドキュメントにある上限からの私の推論である。実際の要約を元の内容と比べてはいない。

</div>

## 5. 委任が見えにくくなるとき

<div class="callout observed">

<span class="label observed">観察</span> サブエージェントを実験しているとき、それらが何をしているのかを見守るのが難しいと感じた。メイン側のエージェントは作業が進行中だと報告し続けられるのに、私にはサブエージェントが実際に何をしているのか、ほとんど、あるいはまったく見えなかった。

</div>

この観察が指しているのは、一般的な進捗の信号と、実際の実行を検査できることとの間のギャップである。前者を作って後者を省くのは簡単だ。私の拡張機能に特定の仕組みがあった、あるいはなかったと主張するつもりはない。以下は、委任するシステムを信頼したいなら何が必要か、という話である。

<div class="callout opinion">

<span class="label opinion">意見</span> サブエージェントを起動するだけならオーケストレーションにすぎない。それを理解するには、さらに多くが必要になる。

- **ステータスと進捗の違い。** 「実行中」はタスクが存在することを示すだけである。ファイルを読んでいるのか、モデルを待っているのか、止まっているのかは分からない。
- **実行イベント。** 子の最終的な答えだけでなく、そのツール呼び出しと中間結果。
- **階層をまたぐトレース。** 子の行動を、それを引き起こした親のリクエストに結びつける方法。
- **失敗の扱い。** タイムアウト、停滞したタスク、そして沈黙以外の形で親に届くエラー経路。

</div>

Pi の構成要素はこの一部をカバーしている。セッションはメッセージ、ツール呼び出しと結果、コンパクションを記録する JSONL ツリーとして保存され、JSON モードと RPC モードはエージェントイベントをストリーミングする（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。拡張機能 API はさらに細かいフックを加える。ライフサイクルイベントには `agent_start`、`turn_start`、`message_update`、`agent_settled` があり、ツール実行には `tool_execution_start`、`tool_execution_update`（呼び出し中の進捗）、`tool_execution_end` がある。`ctx.executeTool()` を通じて行われるネストした呼び出しでは、これらのイベントが `parentToolCallId` を持つ（[extensions guide](https://pi.dev/docs/latest/extensions)）。SDK は、1 つのプロセス内セッションのイベント用に `session.subscribe()` を公開している（[SDK](https://pi.dev/docs/latest/sdk)）。これらは構成要素であり、別々の子 Pi プロセスをまたいでどう振る舞うかは検証していない。私が読んだドキュメントには、それ以外のダッシュボード、メトリクス、トレースの仕組みの記述はない。子プロセスがその記録に有用な形で現れるかどうかは、どう起動するかに依存する。それは自分が引き受ける設計上の判断である。

拡張機能 API は、こうした構成部品が具体的になる場所である。図は、フックが発火する順序と、それぞれに何ができるかを並べている。観察するだけのもの、通過するものを変換するもの、そしてブロックできる少数のものがある。

![拡張機能フックの順序。実行は input（消費または変換できる）、before_agent_start（プロンプトの各部分とツールを変える）、agent_start で始まる。各ターンは turn_start、context（メッセージを変換）、before_provider_request（ペイロードを変える）、after_provider_response、message イベントを実行する。ターン内の各ツール呼び出しは tool_execution_start、tool_call（許可またはブロックできる）、tool_execution_update、tool_result（伏せたり置き換えたりできる）、tool_execution_end を実行し、ターンは turn_end で終わる。ターンの後に agent_end、agent_before_settle（もう 1 回の実行を要求できる）、agent_settled が続く。凡例は、どのフックがブロックでき、どれが変換でき、どれが観察のみかを示す。](../images/extension-lifecycle.svg)

<div class="callout documented">

<span class="label documented">ドキュメント</span> `tool_call` は呼び出しを許可、変更、ブロックでき、ハンドラが例外を投げると呼び出しはブロックされる。`tool_result` は結果を伏せたり、注釈を付けたり、置き換えたりできる。`turn_end` と `agent_before_settle` はエントリを追加して続行を要求でき、ドキュメントはループを防ぐよう注意している。`provider_stream_event` は通知専用で、ストリームの順に await されるため、遅いハンドラはストリームを遅らせる。`pi.events` は拡張機能同士のメッセージ送受信を可能にし、`pi.appendEntry()` はモデルに送らずにデータをセッションへ保存する。examples ディレクトリには、生のプロバイダストリームイベントを見るためのオプトインのビューア `debug-provider.ts` がある。（[extensions guide](https://pi.dev/docs/latest/extensions)）

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> このセクションの主張に対して、私が見つけた最も具体的な裏づけである。エージェントを見るための継ぎ目は、個々のツール呼び出しやプロバイダイベントに至るまで存在する。ドキュメントが記述していないのは、それらから作られた完成したビューである。つまり問いは、Pi を観察できるかどうかではない。そのビューを誰が作るか、である。

</div>

まとめると、3 つの性質は別々のものであり、エージェントは最初の 1 つだけを持って残りを持たないことがありうる。

- **実行：** 行動を実行できる。
- **オブザーバビリティ：** 何をしているのか、どこにいるのかが分かる。
- **制御：** 介入し、方針を変え、あるいは停止できる。

オブザーバビリティのない委任は、行動できるのに理解しやすくはないシステムを生む。これは設計についての結論であり、すべてのマルチエージェントシステムがそうなっているという主張ではない。

制御にも、ドキュメントに載っている側面がある。人はステアリング、フォローアップのキュー投入、中断ができ（セクション 2）、プログラムも RPC で同じことができる。それらが作用するのは Pi のセッションである。親エージェントがそれを子にどう適用するか、いつそうすべきか、子がそれをどう扱うかは、私が設計しなければならない判断である。Pi にそれができないと主張しているわけではない。

## 6. 実行が止まるとき

<div class="callout observed">

<span class="label observed">観察</span> 通常の使用中に、予期しない失敗に遭遇した。モデルの応答エラー、誤ったツールの使い方、そしてコンテキストウィンドウの枯渇である。場合によっては、実行は、タスクを続行できる形で自動的に回復することなく止まった。私が介入し、問題を診断し、実行状態や自分のやり方を調整して、再開する方法を見つけなければならなかった。そのやり方で解決できた失敗もあり、その場合は軽微な中断を経てタスクは進んだ。ほかの失敗では、タスクがまったく進まなくなった。

</div>

これで 2 つのグループができる。その違いこそが有用な部分である。診断して再開することで**私が回復できた中断**と、**タスクを止めた失敗**である。個々の失敗（応答エラー、ツールの誤用、コンテキストの枯渇）をどちらかのグループに割り当てることはしないし、そのどれかが一般に回復不可能だと言うつもりもない。失敗が自力で再開するかどうかは、モデル、プロバイダー、設定、そして拡張機能に依存し、私の記述はそのどれがどれに当たるかを対応づけていない。

これは第 5 節の問題とは別のものである。オブザーバビリティが問うのは、エージェントが何をしているのかが見えるかどうかである。リカバリーが問うのは、その行っていることが壊れたときに何が起きるかである。エージェントがタスクを**実行**する能力と、実行が失敗したときに**回復**する能力は別の性質である。システムは前者に非常に優れていても、後者については何も語らないことがありうる。

Pi に欠けているものを誇張すべきではない。Pi にはリカバリーの挙動があり、ドキュメントがそれを記述している。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi には "transient failures"（一時的な失敗）に対する、エージェントレベルの自動リトライがあり、デフォルトで有効で、デフォルトは 3 回、指数バックオフは 2 秒から始まり 60 秒で頭打ちになる（[Settings](https://pi.dev/docs/latest/settings)）。また自動コンパクションもあり、空きコンテキストが予備量（デフォルトで 16,384 トークン）を下回ると開始される。プロバイダーのオーバーフローまたは長さのエラーが出た場合、Pi はリカバリー用のコンパクションを実行し、そのうえで再試行を新しい実行として開始する。そのリカバリー用コンパクションが失敗またはキャンセルされた場合、Pi は "schedules no internal retry"（内部リトライをスケジュールしない）（[Compaction](https://pi.dev/docs/latest/compaction)）。ツール自体が失敗した場合、その失敗はモデルへのエラー結果になる（[extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)）。

</div>

したがって、正確な言い方は「Pi は決して回復しない」ではない。一部の失敗には組み込みの経路があり、その経路の一部には上限がある。リトライはデフォルトで 3 回であり、コンパクション自体が失敗した場合は、再試行なしで終わるコンパクションのリカバリー経路である。私が読んだドキュメントには、どのエラーが一時的とみなされるかは列挙されていない。また、ツールを使い続けて誤用するモデルや、再開したい状態で終わった実行に対する組み込みの処理も記述されていない。私の失敗のどれかが組み込みの経路の内側にあったのか外側にあったのかは分からない。それらが Pi の欠落だったと主張するつもりもない。デフォルトを使い果たした、あるいはデフォルトが当てはまらなかったケースかもしれない。

図は、それらの経路と、それぞれが尽きたときに何が起きるかを描いている。実線の枠はドキュメントにある挙動である。破線の行は、私が読んだ範囲の空白であり、Pi についての主張ではない。

![回復経路を 3 列で示す。トリガー、組み込みの対応、それが尽きたときに起きること。一時的なプロバイダ障害はエージェントレベルのリトライ（デフォルトで有効、3 回、2 秒から始まり 60 秒で頭打ちのバックオフ）を起動し、試行を使い切ると障害の扱いは自分に委ねられる。コンテキストのオーバーフローや早期の長さ停止は、リカバリ用コンパクションと、新しい実行としての 1 回のリトライを起動する。コンパクションが失敗または取り消されると、内部リトライはない。空きコンテキストが 16,384 トークンの予約を下回ると自動コンパクションが起動し、要約は情報を失う。失敗したツール呼び出しはエラー結果としてモデルに戻り、モデルがやり方を変えるかどうかはモデル次第である。最後の破線の行、繰り返されるツールの誤用や悪い状態で止まった実行については、私が読んだドキュメントに記述がなく、自分で調べ、調整し、再開することで終わる。](../images/recovery-paths.svg)

<div class="callout opinion">

<span class="label opinion">意見</span> 特定の失敗がひとりでに再開するかどうかよりも、「回復した」が何を意味するかを誰が決めるかの方が重要である。信頼できるリカバリーには、たいてい次についての判断が必要になる。

- **リトライ戦略。** どのエラーをリトライするか、何回行うか、いつリトライをやめてエスカレーションするか。
- **エラー処理。** 不正なツール呼び出しを、モデルへのメッセージにするのか、停止にするのか、あなたへの要求にするのか。
- **コンテキスト管理。** ウィンドウがいっぱいになったとき、何が要約され、あるいは捨てられるのか、そしてタスクがそれを乗り越えられるのか。コンパクションは以前の作業を要約するため、要約が何を残すかが、その後のエージェントの知識を形作る。
- **明示的なリカバリーのワークフロー。** 毎回その場しのぎで対応するのではなく、失敗した状態を検査し、調整し、再開するための定められた方法。

</div>

<div class="callout documented">

<span class="label documented">ドキュメント</span> その最後の行を外部から組み立てるための部品も、ドキュメントにある。RPC では、制御するプログラムが自動リトライと自動コンパクションのオンとオフを切り替え（`set_auto_retry`、`set_auto_compaction`）、進行中のリトライを中断し（`abort_retry`）、必要に応じてコンパクトし（`compact`）、`compaction_start`、`compaction_end`、`summarization_retry_*` イベントを監視できる。プロセス内では、`session_before_compact` が Pi の要約を置き換えられ、`session_compact_failed` はコンパクションが失敗または中断されたときに発火する。（[RPC](https://pi.dev/docs/latest/rpc)、[Compaction](https://pi.dev/docs/latest/compaction)）

</div>

<div class="callout proposal">

<span class="label proposal">提案</span> RPC 上の小さな監督プロセス。組み込みのリトライを動かし、コンパクションとリトライのイベントを監視し、実行が失敗状態で落ち着いたときに、自分で書いたポリシーを適用する。たとえば明示的な指示つきでコンパクトする、モデルを切り替える、タスクを自分に戻す、といったものだ。これは作っても試してもいない。

</div>

Pi はこの一部を提供しており、コンパクション後も元のエントリを保持するセッションツリーは、再開の拠り所となる有用な記録である（[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。リトライやより安全なコンパクションを加えるパッケージは探していないので、そうしたものが存在するか、どれほどうまく動くかは言えない。統合型の製品では、これらの判断のより多くがすでに下されているかもしれない。Pi では、デフォルトは出発点にすぎず、残りは自分で設計し、テストし、保守するものである。これは前と同じトレードオフを、失敗のケースから見たものである。エージェントをカスタマイズする自由には、うまく回復するという保証は付いてこない。

## 7. 本当のパーミッション境界

パーミッションを制限する拡張機能と、第 4 節の Docker の試みは、エージェントを実際に制限しているものは何か、という問いを提起した。プロンプト、制限されたツール、コンテナは別々のものであり、区別すると見通しがよくなる。

以下のループは概念的なものであり、Pi の内部を示す図ではない。

> context → model → tool request → runtime → execution environment → tool result → updated context

5 つの層が、それぞれ「パーミッション」と呼ばれうる。

1. **プロセスの権限。** エージェントを実行している OS ユーザーができること。プロセス内のあらゆるものはこれによって制約される。
2. **アプリケーションレベルのチェック。** ツール呼び出しを検査し、許可・確認・拒否を行う、エージェント内のルール。
3. **プロジェクトディレクトリの境界。** 作業ディレクトリが囲いなのか、単なる出発点なのか。
4. **ツールの能力。** 構造化された `read` はパスで囲い込める。シェルは任意のプログラムを実行でき、そのプログラムは任意のファイルを開ける。
5. **分離。** コンテナ、VM、OS のサンドボックスは、子プロセスを含むプロセス自体を制限する。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi の[セキュリティページ](https://pi.dev/docs/latest/security)は、Pi が "can read, change, and execute files with the permissions of the account that started it"（起動したアカウントの権限でファイルを読み取り、変更し、実行できる）こと、そして "does not ask for approval before every tool call"（ツール呼び出しのたびに承認を求めることはない）ことを述べている。作業フォルダはリソース探索とデフォルトのツールの場所を決めるが、コマンドが他のパスに到達することを制限しない。トランスクリプトを見ること、プロジェクトを信頼すること、変更をレビューすることはセキュリティ境界ではない。推奨される選択肢は、狭くて短命な認証情報を使い、可能ならネットワークを制限したうえで、Pi 全体をコンテナ、VM、またはサンドボックス内で実行することである。

</div>

<div class="callout documented">

<span class="label documented">ドキュメント</span> ソースでは、[`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) は相対パスまたは絶対パスを受け取り、ファイルが読み取り可能かどうかだけをチェックする。それが呼び出すパスのヘルパー（[`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts) と [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)）は、絶対パスはそのまま保ち、相対パスは作業ディレクトリに結合する。どちらも結果を作業ディレクトリと比較しない。私はこのコードを main ブランチ（パッケージのバージョンは 1.3.0）で読んだが、Pi のツールを実行してはおらず、ファイルが読まれうるすべての経路をたどってもいない。テスト済みの結果として扱わないでほしい。

</div>

これはドキュメントと整合する。デフォルトでは、アプリケーションレベルの囲いはない。ただし、プロンプトがないことが、あらゆる構成で無制限のアクセスを証明するわけではない。拡張機能はチェックを追加できる。`tool_call` イベントは呼び出しを書き換えたりブロックしたりでき、例外を投げたハンドラは呼び出しをフェイルクローズでブロックする（[extensions guide](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)）。プロンプトがあることも、包括的なセキュリティを証明するわけではない。Claude Code のドキュメントによれば、Read と Edit の deny ルールは、組み込みのファイルツール、Bash 内で認識するファイルコマンド（`cat` など）、リダイレクトの対象に適用される。名前を指定せずにファイルを読むコマンド（`grep -r pattern .` など）や、自分でファイルを開くスクリプトには適用されない。OS レベルの強制については、ドキュメントはそのサンドボックスを挙げ、`bypassPermissions` モードはコンテナや VM のような隔離された環境でのみ使うべきだとしている（[permissions](https://code.claude.com/docs/en/permissions)）。つまり、どちらのドキュメントも、本当の境界として隔離を指している。違いは、あなたとその境界の間に置かれるデフォルトにある。Claude Code の Manual モード（設定値 `default`）では、ファイルの編集、シェルコマンドの実行、ネットワークへのアクセスを伴うほとんどの操作の前に確認を求める（[permission modes](https://code.claude.com/docs/en/permission-modes)）。`cat` や `ls` のような組み込みの読み取り専用コマンドは、`permissions.blockReadsOutsideWorkingDirectories` を有効にしない限り、作業ディレクトリ外のパスに対しても確認なしで実行される。ドキュメントはまた、v2.1.283 以降は auto モードがターミナルと VS Code の対話セッションの開始モードで、分類器があなたの代わりに操作を審査すると述べている。Pi は何も求めない。私が比較したのはドキュメントであって挙動ではない。この記事のために Claude Code を実行してはいない。

![ツール呼び出しがたどる経路による 3 つの構成の比較。Pi のデフォルト：アプリケーションのチェックも OS のサンドボックスもなく、呼び出しは OS ユーザーがアクセスできるすべてに到達しうる。強化した Pi（提案）：自作の拡張機能が呼び出しをブロックまたは確認し、コンテナや VM はプロジェクトだけをマウントするため、呼び出しはマウントされたプロジェクトとスコープを絞った認証情報にしか到達しない。Manual モードの Claude Code：パーミッションルールとモードが編集、シェルコマンド、ネットワークアクセスで確認を求め、`cat` のような読み取り専用コマンドは確認なしで実行され、任意のサンドボックス設定があり、呼び出しは承認でフィルタされた OS ユーザーのアクセス範囲に到達する。](../images/permission-layers.svg)

見落としやすい Pi 固有の詳細が 2 つある。

- **プロジェクトトラストはサンドボックスではない。** それが制御するのは、フォルダが提供するものである。プロジェクト設定と MCP サーバー、`.pi` 以下の拡張機能、スキル、プロンプトテンプレート、テーマ、システムプロンプトファイル、プロジェクトで設定されたパッケージ。それは "prevents a folder from silently loading executable extensions before you approve it"（承認する前にフォルダが実行可能な拡張機能を黙って読み込むのを防ぐ）ものであり、セキュリティページは、それが "does not limit what tool calls can access or affect"（ツール呼び出しがアクセスしたり影響を与えたりできるものを制限しない）と述べている。拡張機能は "inside the Pi process with the same operating-system permissions"（同じ OS 権限で Pi プロセス内）で動くため、信頼された拡張機能はプロンプト、ツール呼び出し、ファイル、セッション履歴を読める（[extensions guide](https://pi.dev/docs/latest/extensions)）。コンテキストファイル（`AGENTS.md`、`CLAUDE.md`）はトラストなしで読み込まれる（[Configuration](https://pi.dev/docs/latest/configuration)）。クローンしたリポジトリ内の指示は、信頼したかどうかに関係なくモデルに届きうる。特定のモデルが悪意のある指示に従うかどうかは別の問いであり、私はテストしていない。

- **Docker は道具であり、保証ではない。** コンテナが実際に何を分離するかは、何をマウントするか、どの認証情報を渡すか、ネットワークが開いているか、どのユーザーで動くかに依存する。ホームディレクトリと広いスコープの API キーをマウントしたコンテナは、問題を移しただけで、解決してはいない。これは一般的なコンテナのセキュリティの話であり、私の試みから得た結果ではない（[Docker security](https://docs.docker.com/engine/security/)）。

要するに、3 つの問いが混同されている。**トラスト**が問うのは、フォルダ自身のリソースを読み込んでよいかどうかである。**パーミッション**が問うのは、実行中のプロセスとそのツールが技術的に何をできるかである。**分離**が問うのは、エージェントや拡張機能が不正に動作しても、何が手の届かないところに残るかである。Pi のドキュメントは 1 つ目を提供し、2 つ目を記述し、3 つ目は利用者に任せている。私は、これらのページと 1 つのツールのソースを読んだ以上に Pi のセキュリティを監査してはいない。

### Pi のコンテナ化ガイドが提供するもの

「コンテナを持ち込め」だけでは薄い助言であり、ドキュメントはそれより先まで踏み込んでいる。[コンテナ化ガイド](https://pi.dev/docs/latest/containerization)は 4 つの選択肢を述べており、それらは境界の内側に何が入るかで異なる。

![2 つの分離範囲。プロセス全体の分離（Docker、Docker Sandboxes、OpenShell）：コンテナまたはサンドボックスの境界が、拡張機能とそのツールを含む Pi プロセスと、組み込みツールおよび感嘆符で始まるコマンドを囲む。ホストに届くのは、マウントしたものか渡したものだけである。ツールだけの分離（Gondolin 拡張機能）：Pi プロセスとその拡張機能はホストに残り、組み込みツールと感嘆符で始まるコマンドだけがローカルの Linux マイクロ VM の中で動く。どちらも、何をマウントするか、どの認証情報を渡すか、ネットワークが開いているかに左右される。](../images/isolation-scope.svg)

<div class="callout documented">

<span class="label documented">ドキュメント</span> **Plain Docker** は Pi プロセス全体をコンテナで動かし（ガイドの Dockerfile は `node:24-bookworm-slim` が基盤）、作業フォルダを `/workspace` にマウントし、キーを `-e` で渡し、設定とセッションを名前付きボリュームに保持する。**Docker Sandboxes** は管理されたサンドボックスで Pi を動かし、本物の認証情報はホストに残り、プロキシが、設定されたホストへのリクエストでそれを置き換える。**OpenShell** は、ファイルシステム、プロセス、ネットワーク、認証情報、推論のポリシーを備えたローカルまたはリモートのサンドボックスで Pi を動かす。リモートのものはフォルダをバインドマウントしないので、ファイルは明示的に転送する。**Gondolin** は、Pi をホストで動かしたまま、組み込みツールと `!` コマンドをローカルの Linux マイクロ VM に振り向ける拡張機能である。他の拡張機能のツールは、処理を委譲しない限りホストで動き続ける。ガイドは、アクセスを意図していない限り `~/.pi/agent`（認証情報、設定、拡張機能、セッション）をマウントしないよう警告し、コンテナに渡した環境変数は内部から見えること、そして Gondolin のコマンドはホストの環境を継承するため、環境変数で設定したキーが VM 内で見える可能性があることを述べている。さらに、VM の境界を迂回しうるツールを追加する前に、Gondolin の例を確認するよう求めている。（[Containerization](https://pi.dev/docs/latest/containerization)）

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> これはパーミッションの話を具体的にし、選択を鋭くする。プロセス全体の分離は、私が読み込む拡張機能も閉じ込める。私の実験が拡張機能だったので、これは重要である。ツールだけの分離は組み込みツールを囲うが、私の拡張機能のコードと、それが登録するツールはホストに残す。どちらも間違いではなく、答えている問いが違う。どちらにしても作業は現実にある。1 つ選び、狭くマウントし、認証情報の範囲を絞り、Pi と拡張機能が変わっても設定が動き続けるようにする。だから下の提案は、プロセス全体の分離に傾いている。

</div>

<div class="callout proposal">

<span class="label proposal">提案</span> 実際の作業で Pi を使うなら、ドキュメントが最も強力な選択肢として挙げているコンテナから始め、プロジェクトだけをマウントし、スコープを絞ったキーを渡す。そのうえで、可視化とミスの検出のために `tool_call` 拡張機能を追加するが、それは壁としてではない。この構成はテストしていない。

</div>

## 8. エージェントからワークフローへ

すでに AI 支援開発を使っているプロジェクトで Pi を使うことを考え始めると、別の問題が現れた。能力はワークフローではない。有能なエージェントは、プロジェクトがどうビルドされるか、どの規約に従うか、どのテストが通らなければならないか、いつ作業が完了とみなされるかを知らない。

この節の残りは、エージェントをプロジェクトに組み込むのに何がかかるかの分析である。一般的な推論であり、私の特定のプロジェクトで何かがうまくいかなかったという報告ではない。

<div class="callout opinion">

<span class="label opinion">意見</span> **能力は、エージェントに何ができるかを述べる。ワークフローは、作業がどう進み、どんな制約のもとにあり、完了がどう確認されるかを述べる。** 既存のプロジェクトにエージェントを組み込むと、次のような問いが生じる。

- **コンテキスト。** プロジェクトのルールはどこにあるか。Pi は `AGENTS.md` と `CLAUDE.md` をコンテキストファイルとして読み込むので、既存の指示は引き継げる。それでも指示は強制ではない。
- **ツール。** 既存のスクリプトは `bash` を通じて動く。安価だが、モデルは README や `--help` からそれらを学ばなければならない。
- **調整。** 他の AI 支援プロセスが同じリポジトリに触れるなら、いつ何を実行するかを誰が決めるのか。
- **検証。** テストとレビューが確実に実行されることを誰が保証するのか。指示は助言にすぎない。チェックを強制できるのは、拡張機能か外部のハーネス（RPC、JSON モード、SDK）である。
- **引き継ぎ。** エージェントはどうやって完了を伝え、次の人やプロセスはそれをどうやって知るのか。

</div>

ここで、これまでの節が交わる。可観測性、回復、パーミッション境界は、突き詰めればどれもワークフローの問いである。システムは何をするのか、誰かがそれを見られるのか、そして何がそれを制約するのか。統合型の製品は、こうした判断の多くをすでに下している。Pi では、あなたが下す。

## 9. 組み込みの WebUI がないことは、統合の選択肢がないことを意味しない

Pi には統合された Web インターフェースがなく、私はそれを欠落として感じた。しかし、UI がないことと、インターフェースがないことは別である。ドキュメントは、同じエージェントを動かす方法をいくつも挙げている（[CLI](https://pi.dev/docs/latest/cli)、[How Pi works](https://pi.dev/docs/latest/how-pi-works)）。

| インターフェース | 想定される用途 |
|---|---|
| インタラクティブ（デフォルト） | 人間向けのターミナル UI。 |
| Print（`-p`） | 1 回のプロンプト、最終テキストを stdout に出力して終了。 |
| JSON（`--mode json`） | エージェントイベントを JSONL として書き出すワンショット実行。 |
| RPC（`--mode rpc`） | stdin の JSONL コマンドで駆動し、stdout にイベントを出す常駐プロセス。 |
| SDK | プロセス内でセッションを作成・制御する TypeScript ライブラリ。 |

したがって、Web フロントエンドが妨げられているわけではない。RPC や SDK の上に構築できる。インターフェースが担わないのは、その周りの作業である。UI の描画、ストリーミング出力の処理、セッション状態の保持、エラー時の動作の決定（第 6 節）、そしてエージェントのライフサイクル管理。SDK のページは、扱わなければならない細かな点にも言及している。`agent_end` は 1 回の実行の終了を示し、`agent_settled` は Pi が自動的には続行しないことを知らせる。私はそのようなフロントエンドを作っていないので、これは私の経験ではなく、ドキュメントに記載された範囲の記述である。

作業が潜んでいるのは細部である（[RPC](https://pi.dev/docs/latest/rpc)）。図は、RPC インターフェース越しの 1 回のプロンプトの形と、素朴なクライアントが間違えやすい部分を示している。

![クライアントと pi --mode rpc の間の RPC プロンプトのライフサイクル。クライアントは id 付きでプロンプトを送る。Pi は同じ id と success true を持つレスポンスを返す。これはプロンプトが受理、キュー投入、または処理されたことを意味し、完了ではない。その後 Pi は message_update イベントをストリームし、1 回の実行が終わると agent_end を送る。その間にコンパクションやリトライのイベントと別の実行が入ることもあり、最後に agent_settled が来る。これは Pi が自力では続行しないことを意味する。](../images/rpc-lifecycle.svg)

<div class="callout documented">

<span class="label documented">ドキュメント</span> レコードは LF で終わる JSON オブジェクトで、クライアントは LF だけで分割すべきである。ドキュメントは、Node.js の `readline` が U+2028 と U+2029 でも分割する点を警告している。これらは JSON 文字列の内部に現れうる。stdout にはプロトコルのレコードだけが流れ、診断は stderr に出る。コマンドは省略可能な `id` を取り、レスポンスがそれを繰り返すが、レスポンスは順不同で届きうる。成功した `prompt` のレスポンスは、プロンプトが受理、キュー投入、または処理されたことを意味し、作業が終わったことではない。`data.disposition` が `"handled"` なら、実行は始まらず、`agent_settled` も続かない。クライアントはプロンプトを送る前に購読すべきで、stdin を閉じると整然とした終了が要求される。コマンドセットはセッション（`fork`、`clone`、`get_tree`、`export_html`）、モデル（`set_model`、`set_thinking_level`）、`compact` を含むため、フロントエンドは TUI が行うことの多くを提供できる。拡張機能のダイアログと通知は RPC 経由で転送されるが、カスタムコンポーネントは転送されない。（[RPC](https://pi.dev/docs/latest/rpc)、[extensions guide](https://pi.dev/docs/latest/extensions)）

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> 最初のレスポンスを完了とみなすクライアントや、汎用の行リーダーで読むクライアントは、デモでは動いても、後で誤動作しうる。どれも難しくはないが、WebUI がないことで自分に回ってくるのは、まさにこの種の細部である。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> WebUI がないことは、トレードオフ全体の縮図である。既成の体験はなく、独自のものを作ることはできるが、作った人がそれを引き受ける。この省略が思想的な選択だったと主張するつもりはない。私が読んだドキュメントはそれを述べていない。

</div>

## 10. Code Mode：試していない設計の方向性

Pi の Code Mode をドキュメントで見つけた。私は**実際のタスクで使ったことがない**ので、この節が述べるのはドキュメントに記載された設計であり、結果については何も述べない。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Code Mode は、モデルが Pi の他のツールを呼び出す JavaScript スクリプトを書けるようにする。スクリプトは QuickJS のサンドボックスで実行され、"only the script's output reaches the model"（スクリプトの出力だけがモデルに届く）ため、スクリプトは呼び出しをまとめ、大きな結果を、コンテキストに入る前にフィルタできる。各ツールは `tools` のメソッドであり、MCP ツールも同じ方法で呼び出せ、失敗した呼び出しは reject されるので、`Promise.allSettled()` で部分的な結果を保持できる。サンドボックスには Node の API、ファイルシステム、ネットワーク、タイマーがない。"scripts reach the outside world only through tools and `models`"（スクリプトが外の世界に到達するのはツールと `models` を通じてのみ）。ドキュメントに記載された制限には、デフォルトの出力上限 10,000 トークン、メモリ上限 256 MB、codemode スクリプトのネスト不可、1 つの Pi プロセス内で同時に存在できる codemode ワーカーは最大 2 つ、がある。失敗したスクリプトは部分的な出力を保持し、失敗前に行われたツール呼び出しは取り消されない。（[Code Mode docs](https://pi.dev/docs/latest/codemode)）

</div>

![通常のツール呼び出しと Code Mode の比較。通常のツール呼び出しでは、3 回の呼び出しと 3 つの完全な結果がすべてコンテキストに入り、各ステップがさらなるモデルリクエストになる。Code Mode では、モデルが QuickJS サンドボックスで動く 1 つの JavaScript スクリプトを書き、ツールを呼び、絞り込み、まとめ、スクリプトの出力（デフォルト上限 10,000 トークン、失敗時は部分出力を保持）だけがモデルに届く。サンドボックスには Node API、ファイルシステム、ネットワーク、タイマーがなく、メモリ上限は 256 MB、入れ子の codemode スクリプトは不可、ワーカーは Pi プロセスあたり 2 つで、失敗前に行われたツール呼び出しは取り消されない。](../images/codemode-flow.svg)

<div class="callout documented">

<span class="label documented">ドキュメント</span> Code Mode が何を見られるかは、拡張機能が決める。ツールの公開設定は `direct`（デフォルト）、`model-only`、`codemode`、`deferred`、`hidden` のいずれかで、ツールは名前空間と MCP 形式のアノテーションも宣言できる。拡張機能は `pi.registerMcpServer()` で MCP サーバーを登録することもできる。（[extensions guide](https://pi.dev/docs/latest/extensions)）各公開設定が正確に何をするかまでは追っていないので、ドキュメントにある調整項目として挙げるにとどめる。

</div>

<div class="callout documented">

<span class="label documented">ドキュメント</span> Earendil の投稿 [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/)（2026 年 9 月 29 日）は、MCP が現在 Pi のコアの一部であること、Codemode がハーネス側で動くこと、MCP が設定されると自動的に読み込まれることを述べている。投稿は、pi.dev や以前の投稿が、Pi は MCP をサポートしないと宣言していたことを認めている。[Mario Zechner の 2025 年 11 月の投稿](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)は、Pi は MCP を "does not and will not support"（サポートしないし、今後もしない）と述べていた。Codemode のためにツールに新しいメタデータが必要だった理由について、投稿は "did not yet upgrade our tool loadout to better scale to these new capabilities"（これらの新機能にうまくスケールするようツール構成をまだアップグレードしていない）と述べている（遅延ツール読み込みなどのモデル機能に言及している）。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> Code Mode とマルチエージェントのオーケストレーションは、異なる問題を解決する。Code Mode は 1 つのエージェントのターン内で**ツール呼び出し**を組み合わせるので、中間結果がコンテキストやラウンドトリップを消費しない。オーケストレーションは**作業**をエージェント間で分割し、それぞれが独自のモデルとのやり取りを持つ。Code Mode は私が作ろうとしたオーケストレーターの代わりにはならないし、それが役立ったかどうかも言えない。私が興味深いと思うのは、サンドボックスが明示的であることだ。スクリプトの到達範囲は、与えられたツールそのものである。第 5 節のトレードオフはここでも当てはまる。多くの呼び出しを 1 つの出力にまとめるスクリプトは効率的だが、中間の活動がモデルから隠される場所でもある。

</div>

判断する前に、実際のタスクで試してみたい。それまでは仮説にとどまる。

## 11. ツールを増やせば、より良いエージェントになるのか

Pi の薄い環境に対する私の最初の反応は、欠けているものを数えることだった（セクション 1）。ツールの仕組みを見ると、その反応を吟味する価値がある。「組み込みツールが少ない」を「能力が低い」に言い換えたくなるからだ。ツールの数だけで何かが決まるとは思わない。以下の比較は、その理由を示すためのものである。

### 3 つのハーネスが同梱しているもの

<div class="callout documented">

<span class="label documented">ドキュメント</span> 表の内容はすべて、公式ドキュメントまたは各プロジェクトのオープンソースのツリーによるもので、2026 年 10 月 20 日に確認した。Claude Code の列は[ツールリファレンス](https://code.claude.com/docs/en/tools-reference)に基づく。Codex の欄は、[customization](https://learn.chatgpt.com/docs/customization/overview)、[MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[approvals](https://learn.chatgpt.com/docs/agent-approvals-security) の各ドキュメントと、[openai/codex](https://github.com/openai/codex/tree/main/codex-rs/core/src/tools) のソース（コミット `e18a20d`）にあるツールハンドラーを組み合わせたものである。Codex のツールを一覧にしたり総数を示したりする公式ページは見つからなかったので、数は示さない。

</div>

| | Pi | Claude Code | Codex |
|---|---|---|---|
| **組み込みツールの範囲** | コアツール 8 つ（既定で有効は 4 つ）に、既定でオフの拡張機能ツール 2 つ | ツールリファレンスは 46 項目を挙げる。条件付きのものが複数ある。タスク系ツールはモデルに依存し、`Grep` と `Glob` は macOS、Linux、WSL では既定で除外され、1 項目は削除済みと記されている | 文書化された一覧も総数もない。ソースには、シェル実行（`exec_command`、`write_stdin`）、`apply_patch`、`update_plan`、`view_image`、`request_user_input`、`request_permissions`、MCP リソースツール、`tool_search`、マルチエージェントツール、ホスト型の Web 検索のハンドラーがある。特定のモデルや設定でどれが有効かは確認していない |
| **ファイル編集** | `edit`（完全一致の置換）、`write` | `Edit`、`Write`、`NotebookEdit` | `apply_patch` |
| **検索** | `bash`、またはオプトインの `grep` / `find` / `ls` | Windows では `Grep` / `Glob`。それ以外では、Claude は既定で `Bash` 経由の `find` と `grep` で検索する | シェルツール経由。専用の検索ハンドラーは見つからなかった |
| **計画、サブエージェント** | 組み込みではない。ホームページは "No sub-agents"、"No plan mode" と述べる | `Agent`、`EnterPlanMode`、`AskUserQuestion`、タスク系ツール、worktree 系ツールなど | `update_plan`、`request_user_input`、マルチエージェントツール。ドキュメントはサブエージェントをカスタマイズ層の一つとして説明している |
| **ツールの追加** | 拡張機能の `registerTool()`、SDK の `customTools`、MCP | MCP（"To add custom tools, connect an MCP server"）。スキルは "runs through the existing `Skill` tool rather than adding a new tool entry"。フックとパーミッションルールはツールを制約する | MCP。MCP サーバーには `enabled_tools` / `disabled_tools` がある。スキルは指示で、プラグインはそれをパッケージ化して配布する |
| **パーミッションとサンドボックス** | 既定では承認プロンプトもサンドボックスもない。ドキュメントはコンテナを用意するよう述べる | ツール名ごとの許可・拒否ルール、パーミッションモード、プロンプトが必要かどうかのツール別フラグ | OS が強制するサンドボックス（Seatbelt、bwrap と seccomp）と承認ポリシー。バージョン管理されたフォルダーの既定は `workspace-write` と `on-request` 承認 |
| **コンテキストコストの制御** | `--tools` の許可リスト、`exposure`、`tool_search`、`codemode` | `ToolSearch` が MCP ツール定義を既定で遅延させる。`alwaysLoad` でサーバー単位で外せる | `enabled_tools` / `disabled_tools`。ソースには `tool_search` ツールがある |

<div class="callout opinion">

<span class="label opinion">意見</span> 表を読むと、私には大きいものと小さいものが一つずつあるのではなく、三つの異なる賭けが見える。Pi は、少数の汎用プリミティブと、自分でプログラムするフックに賭けている。Claude Code は、広く統合された面と、その周りのポリシー層（パーミッション、フック、プラグイン）に賭けている。Codex は、ドキュメントとソースを見る限り、少数の強力なプリミティブ（シェルとパッチ）を、OS レベルのサンドボックスと承認ポリシーの中に置くことに賭けている。各社はこれを設計思想として述べているわけではないので、これは各社が出荷しているものについての私の読みである。

</div>

<div class="callout documented">

<span class="label documented">ドキュメント</span> Pi の作者は、小さなツールセットの理由を述べている。2025 年 11 月に Mario Zechner は、"these four tools are all you need for an effective coding agent"（この 4 つのツールがあれば、効果的なコーディングエージェントには十分だ）、Pi のシステムプロンプトとツール定義は "come in below 1000 tokens"（合わせて 1000 トークン未満）、人気のある MCP サーバーは "dump their entire tool descriptions into your context on every session"（毎セッション、ツール説明のすべてをコンテキストに流し込む）と書いた。また Codex のツール定義は "similarly minimal to pi's"（Pi と同様に最小限）で、Claude Code は "a spaceship with 80% of functionality I have no use for"（私が使わない機能が 8 割を占める宇宙船）だと述べた（[投稿](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)）。これらは作者の意見であり、Pi は MCP をサポートしないとも述べていた投稿のものである。Pi はその後 MCP について方針を変えており（セクション 10）、1,000 トークンという数字を現行バージョンで確かめてはいない。

</div>

### 論旨：ツールセットが大きいからといって、自動的に良いエージェントになるわけではない

私の主張は「少ないほうが良い」よりも狭い。**ツールセットが大きいことは、それだけではエージェントをより有能に、より信頼でき、より役立つものにしない。小さいことも、それだけでは安全にも、付き合いやすくもしない。** 以下に六つの観点を挙げ、それぞれ主張の種類を示す。

![モデルにツールが届く 3 つの経路。最初から宣言：定義がすべてのリクエストに含まれる。Pi では exposure が direct のものと組み込みツール、Claude Code では組み込みツールと alwaysLoad の MCP ツール。コストは、使うかどうかにかかわらず毎ターン消費されるコンテキスト。必要に応じて発見：名前だけが最初にあり、検索の手順で定義を読み込む。Pi では exposure が deferred のものと tool_search ツール、Claude Code では MCP ツール向けの ToolSearch。コストは追加の手順と、モデルが自分で検索しなければならないこと。スクリプト経由：モデルがツールを呼ぶコードを書き、出力だけが戻る。Pi では codemode ツールで、MCP ツールの既定の exposure でもある。コストは、途中の呼び出しが見えなくなること。注記：同じツールが設定次第で別の列に入りうるので、ツールがいくつあるかと、モデルが毎ターンいくつ見るかは別の問いである。](../images/tool-reach.svg)

**1. 単純さと能力。** <span class="label opinion">意見</span> 少数の汎用ツールで基本操作（読む、書く、編集する、コマンドを実行する）は賄える。`bash` だけでも `grep`、`find`、`ls` ができるので、Pi ではこの 3 つがオプトインになっている。Claude Code のドキュメントも、macOS、Linux、WSL では `Grep` と `Glob` を既定で外し、`Bash` 経由で検索すると述べている。ツールセットが大きくなってコストが生じ始めるのは、重複するところである。ほぼ同じことをする二つのツールは、モデルに選択を迫り、利用者に二つの挙動の理解を迫る。しかし小さなセットにも重複はある（`edit` と `write` はどちらもファイルを変更し、`bash` はどちらもできる）。小さいことは、重複がないことと同じではない。

**2. ツールの選択と推論。** <span class="label opinion">意見</span> 直感的には、ツールが一つ増えるごとにモデルが比べる選択肢が増え、選択が予測しにくくなるかもしれない。私はそれを測っていないし、私が読んだ Pi と Claude Code のドキュメントも選択精度について主張していないので、仮説として扱う。ドキュメントが示しているのは、両製品とも、すべてを最初から宣言しないための仕組みを作ったことだ（図）。ここから、作者たちが大きな宣言済みセットのコストを真剣に捉えていることが示唆される。ただしこれは意図についての推論であり、明言された理由ではない。

**3. 拡張性と組み込みの完全性。** <span class="label opinion">意見</span> 最小のコアは前提が少なく、端から端まで読みやすい。その裏返しのコストは、この記事全体の主題である。コアが省いたものは、誰かが作り、テストし、保守しなければならない。Pi の拡張機能 API は寛容だが、自作ツールは自分が所有するコードで、変化してきた API に対して書かれる（パッケージ名の変更はセクション 12 に書いた）。統合型のハーネスは、その作業をみんなのために一度済ませている。

**4. 制御と利便性。** <span class="label opinion">意見</span> 小さな既定のセットは、カスタマイズの明快な土台である。モデルに何が提示されているかを読み、変更し、すべての呼び出しにフックできる。磨かれたハーネスは、初日から動くものを与えてくれる。どちらも本物の価値である。どちらが勝つかは、その制御を実際に使うかどうかで決まる。私が常に使ったと言えば、それは不誠実だろう。

**5. コンテキストと実装のコスト。** <span class="label documented">ドキュメント</span> ツール定義、スキーマ、指示はコンテキストである。Claude Code のドキュメントは、"each upfront tool consumes context that would otherwise be available for your conversation"（最初から読み込まれるツールはそれぞれ、会話に使えたはずのコンテキストを消費する）、スキル一覧のスキルはすべて "adds to your context on every turn"（毎ターンコンテキストを増やす）、そしてツール検索は "by deferring tool definitions until Claude needs them"（Claude が必要とするまでツール定義を遅らせる）ことで MCP のコンテキストを低く保つ、と述べている。Pi は、`codemode` の説明に入るツール宣言を、既定で推定 3,000 トークンに制限している。出力も重要である。Pi の組み込みツールは 2,000 行または 50 KB で切り詰め、Claude Code は 50,000 文字を超える MCP の結果をディスクに保存する。<span class="label opinion">意見</span> つまりコストは実在するが、何が宣言されるかに左右される。小さなツール 10 個のほうが、巨大なスキーマを持つ 1 個より安いかもしれないし、遅延されたツールは必要になるまでほとんどコストがかからない。「ツールを増やせば必ず悪くなる」という主張は、そこからは導けない。

**6. 信頼性と責任。** <span class="label opinion">意見</span> ツールセットが小さいからといって、エージェントが安全で信頼できるわけではない。Pi の既定の 4 つのツールには、ユーザーができることのほとんどを実行できる `bash` が含まれ、セキュリティのドキュメントも、呼び出しのたびに承認は求めないとはっきり述べている。Codex はサンドボックスと承認ポリシーを備え、Claude Code はツール別のパーミッションルールを備えており、どちらもツールの数には依存しない。信頼性を決めるのは、各ツールの実装の質、検証、エラー報告、そして実行を囲む境界である。曖昧な説明や黙って失敗するツールは、ツールが足りないことよりも害が大きい。

### Pi のミニマリズムが役立つ場面と、コストになる場面

| 役立つ場面 | コストになる場面 |
|---|---|
| 短く読みやすい面：名前は 8 つ、既定は 4 つ | ファイル操作と `bash` を超えるものは、自分で作るか導入する |
| モデルに何を見せるかを選べる（`--tools`、`exposure`） | その選択肢があることを知り、実際に選ばなければならない |
| 一つのフックポイントが、入れ子の呼び出しも含めてすべてを見る | フックはポリシーの面であってサンドボックスではない。境界は自分で作る（セクション 7） |
| ハーネスに埋め込まれた前提が少なく、意外な挙動が少ない | 一般的なワークフロー（計画、サブエージェント、承認）が白紙から始まる |
| RPC や SDK 経由で組み込みやすい | 組み込むと、接着部分の所有者になる（セクション 9） |

<div class="callout opinion">

<span class="label opinion">意見</span> 反論には十分な重みを与えるべきだ。豊富な組み込みセットは、セットアップの手間を省き、10 人が同じサブエージェントツールをまずい形で書くことを避け、一般的なワークフローを初日から使えるようにする。多くのチームにとって、それはまさに正しいトレードオフである。Pi のミニマリズムが最も報われるのは、システムを理解して形作りたいときで、最もコストがかかるのは、今日の午後に動くエージェントがほしいときである。また、これは明確な二分ではない。Claude Code は MCP ツールを既定で検索の裏に遅延させ、Pi は MCP とスクリプト用ツールを備えるようになった。二つの製品は互いに近づいている。

</div>

<div class="callout opinion">

<span class="label opinion">意見</span> **私の結論：問うべきは、エージェントがいくつツールを持つかではない。それらが一貫したシステムをなしているかどうかだ。** つまり、適切な能力が、適切な抽象度（汎用の `bash` か、狭くてよく説明されたツールか）で提供され、必要になるまでモデルのコンテキストに入れない方法があり、ツールにできることを囲む境界がある、ということである。Pi は部品と判断を渡してくる。Claude Code と Codex は、それらの判断をより多く代わりに行う。どちらが実際の仕事でより良い結果を出すかは試していないし、ツールの数だけではそれは分からない。

</div>

## 12. 自由、利便性、そしてシステムを所有するのは誰か

これらの実験は何を意味するのか。拡張性こそが Pi の要点である。プログラム可能な挙動、すべてのツール呼び出しを検査または拒否できる単一のフック、その上に構築できるイベントストリーム、そして理解できる程度に小さなコア。それぞれに対応するコストがあり、そのコストは毎回同じである。判断が私に移ったのだ。

| Pi が与えるもの | Pi があなたに求めるもの |
|---|---|
| システムのより多くを形作れる | 何をそこに含めるかを決め、保守する |
| 自分のニーズに合わせたカスタム挙動 | テストし、Pi の変化に合わせて動作を保つ。パッケージは一度 npm のスコープを移った。npm レジストリによれば、`@mariozechner/pi-coding-agent` は 2025 年 11 月から、`@earendil-works/pi-coding-agent` は 2026 年 5 月から公開されている。このレジストリは現在、旧名を非推奨とし、新名の利用を勧めている。 |
| アーキテクチャ上の判断を見て、変えられる | それをうまく下す：パーミッション、分離、オブザーバビリティ、失敗からのリカバリー |
| 抗うべき同梱ポリシーがない | 自分のポリシーを用意するか、なしで作業する |

ツールの仕組みはその最も分かりやすい例である。Pi は小さなプリミティブの集合と、自分のものを足す場所を渡してくる。セクション 11 は、これは欠陥ではなく一つの賭けだと論じた。統合型の製品は、拡張可能であることの反対ではない。たとえば Claude Code にはフック、スキル、サブエージェント、プラグイン、MCP があり、Pi にも利便性がないわけではない。違いは、**デフォルトでどれだけが代わりに決められているか、そして誰がそれを保守するか**である。

## 13. Pi はいつ使うべきか

<div class="callout opinion">

<span class="label opinion">意見</span> すぐに使えるエージェント以上のものが欲しいときに、Pi を使う。エージェントがどう動くのかを理解し、そのワークフローを作り変え、能力を拡張し、その周りに構築するシステムに責任を持ちたいときに使う。上の各節は、その責任が私の実験でどのようなものだったかを示している。委任を設計すること、それを観測可能にすること、実行が失敗したときに回復が何を意味するかを決めること、パーミッション境界をどこに置くかを決めること、そしてエージェントをプロジェクトのワークフローに合わせることである。

セットアップと保守をできるだけ少なくして作業を進めることが優先なら、より統合された製品の方が良い選択かもしれない。制御より利便性を選ぶことに本質的な間違いはなく、すべてを自分で作ることが本質的に優れているわけでもない。

</div>

Pi を使ったことで、見過ごしやすいトレードオフをより意識するようになった。**自由は責任を移す。** システムに対する制御が大きいほど、その制御を信頼できる作業体験に変えるために下すべき判断も増える。Pi 自身のドキュメントも、パーミッションについて同じことを述べている。コンテナを持ち込め、と述べ、そのやり方を 4 通り示している。

したがって、問いは Pi が他のコーディングエージェントより優れているかどうかではない。それは私がテストしていないことであり、この記事はそれについて何も主張しない。問いは、Pi が提供する自由が、引き受けてもよいと思う追加の作業に見合うかどうかである。私は、強力なモデルと薄い環境という話から始めた。薄い環境こそが提供されるものであり、それを埋める作業が代価である。

**自由は、自分の望むシステムを構築する能力を与える。利便性は、そもそもシステムを構築するのに費やす時間を減らしてくれる。**

<div class="callout opinion">

<span class="label opinion">意見</span> 私は今、コーディングエージェントを、生成するコードの品質だけで評価してはいない。パーミッション境界がどこにあるか、どう失敗しどう回復するか、何をしているのかを見られるか、そしてプロジェクトのワークフローに組み込むのに何がかかるかも見ている。それらは、ここまでの節が繰り返し戻ってきた問いである。

</div>

## 参考文献

**Pi：公式ドキュメントとソース**

- [pi.dev](https://pi.dev)、[Sessions](https://pi.dev/docs/latest/sessions)、[Skills](https://pi.dev/docs/latest/skills)、[Packages](https://pi.dev/docs/latest/packages)、[Extensions](https://pi.dev/docs/latest/extensions)、[SDK](https://pi.dev/docs/latest/sdk)、[How Pi works](https://pi.dev/docs/latest/how-pi-works)、[Security](https://pi.dev/docs/latest/security)、[Configuration](https://pi.dev/docs/latest/configuration)、[Settings](https://pi.dev/docs/latest/settings)、[Compaction](https://pi.dev/docs/latest/compaction)、[CLI](https://pi.dev/docs/latest/cli)、[Code Mode](https://pi.dev/docs/latest/codemode)、[Usage](https://pi.dev/docs/latest/usage)、[RPC](https://pi.dev/docs/latest/rpc)、[Containerization](https://pi.dev/docs/latest/containerization)、[MCP](https://pi.dev/docs/latest/mcp)、[Quickstart](https://pi.dev/docs/latest/quickstart)
- [earendil-works/pi](https://github.com/earendil-works/pi)：[`extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)、[`src/core/tools`](https://github.com/earendil-works/pi/tree/main/packages/coding-agent/src/core/tools)（[`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) を含む）、[`agent-loop.ts`](https://github.com/earendil-works/pi/blob/main/packages/agent/src/agent-loop.ts)、[`types.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/extensions/types.ts)、[`hello.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/hello.ts)、[`tool-override.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/examples/extensions/tool-override.ts)、[`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts)、[`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)
- npm レジストリのメタデータ（`npm view`）：`@earendil-works/pi-coding-agent` と、非推奨になった `@mariozechner/pi-coding-agent`。2026 年 10 月 20 日に確認

**Pi：作者による投稿**

- Mario Zechner、[*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/)、2025 年 11 月
- Earendil、[*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/)、2026 年 9 月 29 日

**比較と背景**

- Claude Code、[Tools reference](https://code.claude.com/docs/en/tools-reference)、[MCP（tool search を含む）](https://code.claude.com/docs/en/mcp)、[Skills](https://code.claude.com/docs/en/skills)、[Configure permissions](https://code.claude.com/docs/en/permissions) と [Permission modes](https://code.claude.com/docs/en/permission-modes)
- OpenAI Codex、[Customization](https://learn.chatgpt.com/docs/customization/overview)、[MCP](https://learn.chatgpt.com/docs/extend/mcp?surface=cli)、[Agent approvals and security](https://learn.chatgpt.com/docs/agent-approvals-security)、および [openai/codex](https://github.com/openai/codex/tree/main/codex-rs/core/src/tools) のオープンソースのツールハンドラー（コミット `e18a20d`）
- Docker、[Docker security](https://docs.docker.com/engine/security/)

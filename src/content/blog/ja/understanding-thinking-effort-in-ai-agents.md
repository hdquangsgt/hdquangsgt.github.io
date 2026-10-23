---
title: 'AI エージェントの Thinking Effort を理解する：開発者が知っておくべきこと'
description: 'LLM API やコーディングエージェントを使う開発者のための、スライド形式の reasoning effort ガイド。この設定が何を変えるのか、エージェントループとの違い、effort を上げると効く場面、そして推測ではなく計測で判断する方法を解説する。'
pubDate: 2026-10-22T09:00:00+07:00
updatedDate: 2026-10-22T22:00:00+07:00
category: AI Agents
tags: [thinking-effort, reasoning, ai-agents, evaluation, llm-api]
featured: false
draft: false
slides: true
---

## AI エージェントの Thinking Effort を理解する

<p class="slide-kicker">第I部 · 思い込みを問い直す</p>

**AI に「もっと考えさせる」ことが、なぜ常に良い結果につながるとは限らないのか。**

thinking effort の設定は実際に何を変えるのか、そしていつ上げるべきなのか。このスライドは、この問いを 21 枚のスライドで追う。概念、reasoning とエージェント実行の違い、実際のエンジニアリング事例、本番向けのアーキテクチャ、そして直感ではなく証拠で判断する方法である。

![左のエージェントが 1 つのタスクを 3 つのレーンに送る。上のレーンは、速い答えへ向かう短い直線の経路。中央のレーンは、代替案を 1 つ検討して捨てる。下のレーンは太い経路で、複数の分岐、2 つの行き止まり、そして検証済みの結果の前の検証ステップを持つ。](../images/effort-cover-paths.svg "1 つのタスク、3 段階の reasoning effort。概念を示す図であり、測定値ではない。")

<div class="callout article-only">

**この記事の読み方。** 主張にはラベルが付いている。<span class="label documented">ドキュメント</span>は、すぐ横にリンクした公式ドキュメントまたは論文に記載されている内容である。<span class="label verified">検証済み</span>は筆者自身が実行したもので、何を実行し、その実行で何が分からないかをコールアウトに書いている。<span class="label opinion">意見</span>は筆者の解釈やエンジニアリング上の判断である。<span class="label proposal">提案</span>は筆者が推奨する設計で、どのベンダーも提供しているものではない。<span class="label illustrative">説明用の例</span>は、考え方を説明するための架空の数値やシナリオを示す。実験に基づく主張はここには 1 つもない。筆者はベンチマークを実行していないので、このスライドの数値はすべて、ベンダーのドキュメントからの引用か、説明用の例と明記したものである。図は、キャプションに断りがない限り概念図である。

**最終確認日：2026 年 10 月 22 日。** プロバイダーに関する事実は、同日にリンク先の OpenAI、Anthropic、Google のページで確認した。スライド 15 と 18 のコードは、TypeScript 5.9.3 で `openai` 7.42.0、`@anthropic-ai/sdk` 1.1.0、`@google/genai` 2.30.0 に対して型チェックした。どのコードも実際の API には送信していない。モデル名や受け付けられる値は頻繁に変わるため、コピーする前にリンク先を確認してほしい。

</div>

## 同じモデル、同じプロンプトなのに結果が違う？

<p class="slide-kicker">第I部 · 思い込みを問い直す</p>

同じに見えるリクエストを 2 回実行して、1 回目はきれいな答え、2 回目は的外れな答えが返ってくることがある。ある設定のせいにする前に、変わったものをすべて挙げてみよう。タスクには、道が 1 つしかなく直接解けるものがある。一方で、妥当な道が複数あり、システムが慎重に検討したり追加の証拠を集めたりすると答えが良くなるものもある。

![左：単純なタスク、設定キーの名前変更は、1 本の道でビルド成功に至る。右：複雑なタスク、不安定なテストは、原因を特定する前に証拠が必要な 3 つの未検証の仮説に分岐する。下には、結果を左右する要因を示す 6 つのチップがあり、effort を含む設定はその 1 つにすぎない。](../images/effort-why-results-vary.svg "単純なタスクには道が 1 本。複雑なタスクには複数あり、証拠がどれを選ぶかを決める。effort は 6 つの要因の 1 つにすぎない。")

- **タスクの複雑さと曖昧さ**によって、妥当な答えがいくつあるかが変わる。
- **利用できるコンテキストとツールの出力**が、モデルが実際に知り得ることを決める。
- **サンプリングのランダム性**により、同じプロンプトでも 2 回の実行が食い違うことがある。
- **モデルの挙動と設定**も影響し、effort は設定の一部にすぎない。

<div class="takeaway">

コンテキスト不足、弱いツール結果、単なるばらつきを除外するまでは、悪い結果を effort のせいにしないこと。

</div>

## effort を上げても、自動的に賢くなるわけではない

<p class="slide-kicker">第I部 · 思い込みを問い直す</p>

よくある思い込みは 3 つあり、どれも役に立つ形で間違っている。

1. **「effort を上げれば必ず良い答えが出る。」** 一部のタスクでは助けになる。しかし正しさは保証されず、簡単なタスクではコストが増えるだけのことが多い。
2. **「長く考えるほど、深く正確な推論になる。」** 長さは質ではない。長い推論の連鎖でも、長いだけで間違っていることがある。
3. **「エージェントのステップが多いほど有能になる。」** ステップが増えると、誤りを直すのと同じくらい簡単に誤りが積み重なる。

![問題が、推論を増やす＝探索を広げると書かれた点線の領域に入る。領域には 4 つの仮説と比較・絞り込みのステップがある。出力は、正しさが保証されない結論。下の 3 つのボックス、利用できる証拠、モデルの能力、タスクの制約も結論に影響する。注記には、証拠の欠如は壁であり、推論を増やしても越えられないとある。](../images/effort-reasoning-vs-evidence.svg "推論は探索を広げる。それでも結論は、証拠、能力、制約に左右される。")

<div class="callout documented">

<span class="label documented">ドキュメント</span> Anthropic は Claude Opus 4.7 向けのモデル別ガイダンスで、最上位のレベル `max` は、ほとんどのワークロードで「比較的小さな品質向上のために大きなコストが加わる」とし、構造化出力のタスクや知能をあまり要しないタスクの一部では考えすぎにつながり得ると述べている（[Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)）。このガイダンスはそのモデル向けに書かれたものであり、他のモデルのガイダンスは異なる。

</div>

## Thinking Effort は推論リソースの話であり、待ち時間を延ばすことではない

<p class="slide-kicker">第II部 · 技術の基礎</p>

thinking effort は、**モデルやプラットフォーム固有の制御（存在する場合）**であり、タスクの推論にどれだけの労力を割くかに影響する。これは公開 API 上の設定であって、モデル内部をのぞく窓ではない。

![左は公開 API の入力：タスクとコンテキスト、そして low から high までのような effort 設定。中央は、モデル推論と書かれた点線の領域で、内部はモデルごとに異なり公開されていない。疑問符付きの 3 つのボックス、推論の挙動、費やされる計算、その他の推論上の選択がある。右は公開される出力：答え、生の痕跡ではないオプトインの推論要約、そして課金される reasoning token を含む使用量レポート。](../images/effort-what-is-it.svg "設定し観測できるのは API の表面である。内部で起きることはモデル次第であり、この設定では規定されない。")

<div class="callout documented">

<span class="label documented">ドキュメント</span> 各ベンダーが自らの言葉で述べていること：

- OpenAI：reasoning token は output token として課金され、`max_output_tokens` とコンテキストウィンドウに含まれ、`usage.output_tokens_details.reasoning_tokens` に現れる。生の reasoning は返されず、要約は `reasoning.summary` によるオプトインである（[OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)）。
- Anthropic：effort は「厳密な token 予算ではなく、挙動に関するシグナル」であり、thinking だけでなく、テキストやツール呼び出しを含むすべての出力 token に影響する（[Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)）。要約だけが表示される場合や何も表示されない場合でも、thinking の全量が課金され、`usage.output_tokens_details.thinking_tokens` がその量を示す（[Anthropic: Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)）。
- Google：`thinking_level` が受け付けるレベルの組み合わせはモデルごとに異なり、レスポンスの料金は「output token と thinking token の合計」であり、thought の要約はオプトインである（[Gemini: Thinking](https://ai.google.dev/gemini-api/docs/thinking)）。
- 既定値も異なる。Anthropic は、ほとんどのモデルで `high`、Claude Opus 5.5 と Claude Haiku 5.5 では `medium` を既定値としている。OpenAI は複数のモデルで `medium` を既定値としている。Gemini の既定値はモデルによって変わる。設定を省略しても、どこでも同じ意味になるわけではない。

</div>

つまり、同じ言葉でも API によって意味が異なる。各レベルが固定の token 数、ステップ数、計算量に対応すると想定してはいけない。

## タスクの複雑さが reasoning effort を左右すべきである

<p class="slide-kicker">第II部 · 技術の基礎</p>

![左右に並べた図。タスク A、JSON オブジェクトを TypeScript のインターフェースに変換する作業は、3 つのボックスが一直線に並び、インターフェース宣言で終わる。タスク B、断続的に起きる競合状態は、症状から始まり、ロック順序、古いキャッシュ、重複したリトライという仮説に分岐し、トレース、ログ、タイミング、再現手順という複数コンポーネントにまたがる証拠で合流し、絞り込まれた原因で終わる。下の注記は、複雑さだけが軸ではなく、結果が深刻な単純なタスクにも慎重な推論が必要になり得ると述べている。](../images/effort-task-a-vs-b.svg "タスク A には確認しやすい 1 本の道がある。タスク B には、コンポーネントをまたぐ証拠が必要な複数の仮説がある。")

**タスク A** は、JSON オブジェクトを TypeScript のインターフェースに変換する作業だ。出力は一目で確認できる。追加の熟考で結果が変わることはほとんどない。

**タスク B** は、分散システムで断続的に起きる競合状態の調査だ。ここでは慎重な推論が効く。仮説を比較し、エッジケースを考え、コンポーネント間の挙動をつなぎ合わせる。

ただし、複雑さだけが軸ではない。本番データのマイグレーションのように、説明は短くても結果が深刻なタスクは、慎重な推論、追加の確認、人によるレビューに値することがある。

## モデルの推論とエージェントの実行は別物である

<p class="slide-kicker">第II部 · 技術の基礎</p>

![2 つのパネル。A：1 回のモデル呼び出し。入力、effort 設定が効く内部の推論段階、出力があり、ツールは使わない。B：モデルの外側にあるエージェントループ。モデル呼び出し 1、テストを実行するツール呼び出し、2 件のテスト失敗という観測、モデル呼び出し 2、停止条件があり、停止するまでループを繰り返す点線の矢印がある。](../images/effort-vs-agent-loop.svg "左は 1 回のモデル呼び出しの中の推論。右はモデル呼び出し、ツール呼び出し、観測からなる外側のループ。点線の矢印は、動きが許可されていれば動く。")

**thinking effort** は、モデルと API がこの制御に対応している場合に、*1 回の*モデル呼び出しの中で適用される推論のことだ。

**エージェントループ** は外側のサイクルである。モデルがコンテキストを受け取り、応答またはツール呼び出しを生成し、ツールの結果を受け取り、停止条件に達するまで続ける（推論と行動を交互に行う古典的な説明が [ReAct](https://arxiv.org/abs/2210.03629) である）。

この 2 つは独立して変化する。1 回の呼び出しで多くの推論を行い、ツールを一切使わないこともある。逆に、エージェントが数十回ツールを呼びながら、各ステップ自体は単純なこともある。

## AI エージェントはモデルだけではない

<p class="slide-kicker">第II部 · 技術の基礎</p>

概念上の流れ：ユーザーのタスクとコンテキスト → モデルの推論 → 回答するかツールを呼ぶかの判断 → ツールの実行 → 更新されたコンテキスト → 次の判断。タスクが完了するか停止条件が働くまで繰り返される。

![3 つの色付きレイヤーで示したエージェントループ。オーケストレーション層：1、タスクとコンテキスト、停止ルール、5、更新されたコンテキスト。モデル層：2、推論（reasoning effort が働く唯一の場所として強調）と、3、回答かツール呼び出しかの判断。実行層：4、ツールの実行。回答は、レイヤーをまたぐ点線の検証チェックポイントを通り、次に停止ルールを通って最終回答を返す。ツール呼び出しはツール実行に進み、その結果が更新されたコンテキストとなり、6、次の判断として推論に戻る。](../images/effort-agent-flow.svg "3 つのレイヤーにまたがる 6 つのステップ。reasoning effort の影響を受けるのはステップ 2 だけ。動く点線の矢印がループであり、検証はレイヤーではなくチェックポイントである。")

effort が作用するのは、このループの 1 つのステップ、つまりモデル呼び出しの内部の推論だ。全体の性能は、コンテキストの質、どのツールがあるか、ハーネスがリトライや停止をどう制御するか、そして何かが結果を検証するかどうかにも左右される。スライド 15 では、このループを本番向けのリファレンスアーキテクチャにする。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Anthropic の [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents) も関連する指摘をしている。エージェント的なシステムはタスク性能と引き換えにレイテンシとコストを払うので、増える複雑さは正当化されるべきだという。

</div>

## effort のレベルの違いは、トレードオフの違いである

<p class="slide-kicker">第II部 · 技術の基礎</p>

![それぞれ低から高に向かう 4 本の定性的なトラック。リングが低い effort、四角が高い effort を示す。難しいタスクでは、高い設定のほうがより良い品質の側にある。単純なタスクでは、2 つのマーカーが近い。レイテンシとコストでは、高い設定のほうがより高い側にある。](../images/effort-low-vs-high.svg "定性的なチャート。マーカーの位置は傾向だけを示し、ベンチマーク結果ではない。")

| | 低い effort | 高い effort |
| --- | --- | --- |
| レイテンシ | 低くなる傾向 | 高くなる傾向 |
| コスト | 低くなる傾向 | 高くなる傾向 |
| 難しい複数ステップのタスク | 徹底さが足りないことがある | より徹底することがある |
| 単純なタスク | たいてい十分 | 効果は小さく、コストは増える |

**これらは傾向であり、保証ではない。** 差の大きさは、モデル、タスク、測り方によって変わる。一般化できる数値はないため、この記事では改善幅の数字を示さない。自分の数値を得る方法はスライド 16 と 17 で示す。

## effort を上げる価値があるのはいつか？

<p class="slide-kicker">第III部 · 実際のエンジニアリング事例</p>

API が断続的に HTTP 500 を返す。reasoning effort の高いモデルは、複数の仮説を同時に保持し、依存関係を調べ、エッジケースを考えるのが得意かもしれない。それでも、誰も収集していないログを読むことはできない。

![左：症状、断続的な HTTP 500。中央：4 つの点線の仮説ボックス、データベースプールの枯渇、上流のタイムアウト、キャッシュスタンピード、古いビルドの 1 インスタンス。右：実線の証拠ボックス。データベースの待ち時間は正常で、最初の仮説を否定する。上流のトレースは成功しており、2 つ目を否定する。キャッシュミスのスパイクはなく、3 つ目を否定する。ログでは 500 がインスタンス 3 でのみ発生しており、4 つ目を支持する。そこから、インスタンス 3 のロールバックという検証済みの修正につながる。別の警告ボックスは、推論は、インスタンス 5 のログ欠落のように誰も集めていない証拠の代わりにはならないと述べている。](../images/effort-incident-evidence.svg "点線のボックスは仮説。実線のボックスは観測された証拠。検証された修正だけが解決として数えられる。")

良いワークフローは、推論と観測を交互に行う。

1. 仮説を立て、それぞれを裏付ける、または否定する証拠が何かを明確にする。
2. その証拠（ログ、メトリクス、トレース）を集める。
3. 仮説を更新する。証拠が否定したものは捨てる。
4. 修正を適用し、症状が消えたことを検証する。

<div class="takeaway">

推論を増やすと、証拠を*活用*しやすくなる。収集されなかった証拠を生み出すことはできない。

</div>

## 1 行の変更とシステム全体のリファクタリングに、同じ戦略は要らない

<p class="slide-kicker">第III部 · 実際のエンジニアリング事例</p>

![狭く局所的なものから、広く不確実なものまでの連続軸と、3 枚のタスクカード。1：ローカル変数の名前変更。スコープを考慮したリネームが必要で、テストは変わらない。2：認証ミドルウェアのリファクタリング。呼び出し側の依存、セキュリティへの影響、後方互換性、テストカバレッジがある。3：デプロイ後のリグレッションの調査。コードの差分、ログとエラー、テスト結果、最近の変更がある。注記は、どのカテゴリにも万能な effort レベルはないと述べている。](../images/effort-coding-task-spectrum.svg "結合度、不確実性、結果の重大さを示す説明用の連続軸上の、3 つのコーディングエージェントのタスク。")

- **ローカル変数の名前変更。** ほぼ機械的な作業。コンパイラかテストスイートで決着がつく。
- **認証ミドルウェアのリファクタリング。** 推論は、呼び出し側、セキュリティへの影響、後方互換性、そして挙動が保たれていることを示すテストをカバーする必要がある。
- **デプロイ後のリグレッションの調査。** 推論は、読めるものの範囲までしか役に立たない。差分、ログ、テスト結果、最近の変更履歴である。

<div class="callout opinion">

<span class="label opinion">意見</span> この並びは、規則ではなく出発点となる仮説として扱ってほしい。動的型付け言語では名前変更が危険なこともあるし、難しいリグレッションでは熟考よりも証拠のほうが必要になることもある。

</div>

## 問題に合った手段を選ぶ

<p class="slide-kicker">第III部 · 実際のエンジニアリング事例</p>

エージェントが間違えたとき、「もっと考えさせる」は複数ある手段の 1 つであり、常に正しいとは限らない。

![決定木。根は、実際に何が失敗したのかを問う。4 つの枝：事実はあったのに分析が浅い場合は、reasoning effort を上げる。コンテキストにない事実が欠けている場合は、ツールや検索を追加する。テストやログに計画が否定された場合は、新しい証拠を使ってもう一度反復する。タスクが広すぎる場合は、より良いオーケストレーションで分解する。最下部のボックスは、これらの介入は互いに補完し合うと述べ、何が失敗したか分からなければトレースを読み、検証ステップを追加するようにという注記がある。](../images/effort-decision-tree.svg "失敗の種類を介入に対応づける。介入は組み合わせられるもので、競合しない。")

- モデルが利用できる仮説を十分に検討していないなら、**reasoning effort を上げる**と効くかもしれない。
- リポジトリの情報が足りないなら、考える量を増やすより**検索ツール**のほうが役に立つ。
- テスト結果が最初の仮説と矛盾するなら、その結果を使って**もう一度エージェントを反復させる**のが正しい。
- タスクが広すぎるなら、どんな単一の設定よりも**分解**が効く。

## 説得力のある説明は、正しさの証明ではない

<p class="slide-kicker">第III部 · 実際のエンジニアリング事例</p>

モデルは、情報の不足、誤った前提、その他の限界から、もっともらしいが間違った結論を出すことがある。説明が流暢かどうかは、それが真実かどうかをほとんど教えてくれない。

<div class="callout documented">

<span class="label documented">ドキュメント</span> reasoning モデルに関する研究では、示された推論が、実際に答えに影響した要因を省くことが多いと報告されている。つまり、説明を読むだけでは信頼できる監査にならない（[Chen et al., 2025](https://arxiv.org/abs/2505.05410)）。

</div>

![上のレーン：流暢なモデルの提案は読みやすいが、チェックが一切実行されていないため、状態が不明のまま信頼で受け入れられる。下のレーン：モデルの提案が、自動テスト、型チェックと lint、差分のレビュー、ログと実行結果、受け入れ基準、セキュリティチェックという 6 つのチェックを通る。合格すると証拠が記録される。不合格なら、修正して再チェックする点線の矢印でモデルにフィードバックが戻る。](../images/effort-verification-flow.svg "上：もっともらしいが未検証。下：同じ提案を、実行可能な証拠でチェックし、失敗はフィードバックする。")

コーディングエージェントでの検証とは、具体的な仕組みを指す。自動テスト、型チェックと lint、生成された差分の確認、ログと実行結果の確認、受け入れ基準の照合、そして適切な場合にはセキュリティチェックの実行である。これらのチェックの質は、推論がどれだけ深く見えたかとは独立に評価すること。

## 品質、レイテンシ、コスト

<p class="slide-kicker">第IV部 · 本番システムでの活用</p>

![品質が頂点、レイテンシが左下、コストが右下にある三角形。3 つの説明用ワークロードが内側に置かれている。レイテンシ寄りの対話型オートコンプリート、品質寄りの夜間マイグレーションエージェント、コスト寄りの大量分類。注記は、位置は概念的なものであり、単一の万能な指標はないと述べている。](../images/effort-tradeoff-triangle.svg "3 つの次元は互いに引っ張り合う。ワークロードがどこに位置するかはプロダクト上の判断である。ここでの位置は概念的なものだ。")

- **品質：** 正しさ、タスクの完了、堅牢性、エッジケースの扱い。
- **レイテンシ：** 応答時間と、タスクを完了するまでの総時間。
- **コスト：** モデルの使用量、該当する場合は reasoning に関わる推論コスト、ツール呼び出し、そして何よりも*成功したタスクあたりの総コスト*。

目標は、どんな価格でも最高の品質にすることでも、何を犠牲にしても最小のレイテンシにすることでもない。ワークロードとそのビジネス要件にとって許容できるトレードオフを見つけることだ。この 3 つを 1 つの万能なスコアにまとめることはできない。

**コストには 3 つの層があり**、それぞれが別の問いに答える。

| 層 | 数えるもの | 数値の出どころ |
| --- | --- | --- |
| モデル呼び出し | input、キャッシュされた input、output、reasoning の各 token に、プロバイダーの token 単価を掛けたもの | 各レスポンスの `usage` オブジェクトと、プロバイダーの料金ページ |
| エージェントの実行 | 実行中のすべてのモデル呼び出しに加え、ツールの実行、リトライ、サンドボックスや CI の時間、人によるレビュー | 自分のトレースとインフラの請求 |
| タスクの成果 | 総支出と総時間を、検証に合格したタスク数で割ったもの | 自分の評価結果 |

effort が作用するのは 1 つ目の層だが、判断は 3 つ目の層で行うべきものだ。1 回の呼び出しを安くする設定でも、実行の失敗が増え、完了させるためにリトライや人の手が必要になれば、タスクとしては高くつくことがある。

<div class="callout illustrative">

<span class="label illustrative">説明用の例</span> 計算方法を示すためだけの架空の数値である。設定 A は 1 回の実行に $0.40 かかり、100 回中 50 回で検証に合格する。支出は $40 で、成功したタスクあたり $0.80 になる。設定 B は 1 回の実行に $0.60 かかり、100 回中 80 回で合格する。支出は $60 で、成功したタスクあたり $0.75 になる。B は実行あたりでは 50% 高いが、成功あたりでは安い。失敗したタスクを人が仕上げる分を数に入れると、差はさらに広がる。数値が違えば A が勝つこともある。だからこそ測るのである。

</div>

## すべてのリクエストで最大 effort を既定にしない

<p class="slide-kicker">第IV部 · 本番システムでの活用</p>

適応的な戦略では、effort をタスクごとの判断として扱う。タスクを受け取り、複雑さ、不確実性、リスクを評価し、サポートされている設定を選び、実行し、検証し、検証に失敗したらエスカレーション、リトライ、または追加の証拠収集を行う。

![フローチャート。タスクを受け取り、ルール、分類器、またはモデルベースのルーターを使って複雑さ、不確実性、リスクを評価する。横には、ルーターは誤ることがあるので測定すべきだという注記がある。次に、サポートされている設定を選び、日常的で低リスクな作業には低い effort、通常の作業には中程度の effort、難しい、または高リスクな作業には高い effort に分岐する。すべての分岐でタスクを実行し、結果を検証する。合格なら完了。失敗なら、エスカレーション、リトライ、effort の引き上げ、または証拠収集に進み、実行に戻る。](../images/effort-adaptive-routing.svg "タスクごとにルーティングし、結果を検証し、失敗したらエスカレーションする。点線の矢印がエスカレーションのループを示す。")

ルーティングには、ルール、分類器、モデルベースのルーター、フィードバック駆動のポリシーが使える。

<div class="callout documented">

<span class="label documented">ドキュメント</span> test-time compute に関する研究では、プロンプトごとに推論の労力を適応的に配分すると、一律に使うよりも優れた結果が得られ得ることが示された（[Snell et al., 2024](https://arxiv.org/abs/2408.03314)）。これは適応的な配分一般を支持する論拠であって、あなたのワークロードでの保証ではない。

</div>

注意点が 2 つある。タスクの分類自体が間違うことがあるので、ルーターも他のコンポーネントと同様に評価すること。そして、選んだモデルや API がサポートする effort レベルだけを使うこと。

## エージェントループのリファレンスアーキテクチャ

<p class="slide-kicker">第IV部 · 本番システムでの活用</p>

![ループコントローラー、つまりモデルではなく自分のハーネスと書かれた点線の領域。すべてのモデル呼び出しの前に、ステップ、token、時間の予算、繰り返し行動の検出器、停止ルールを確認する。内部には 5 つのボックスが一列に並ぶ。コンテキスト、effort が作用するモデル呼び出し、回答かツール呼び出しかの判断、許可・確認・拒否を持つツールポリシー、タイムアウトとリトライを持つツールランナー。点線の矢印が、各ツール結果をその状態、ok、error、timeout とともにコンテキストに戻す。回答は、テスト、型、仕様を確認する検証器に下りる。合格なら、検証済みでトレース済みの完了に至る。不合格なら、失敗したチェックがフィードバックとしてコンテキストに戻る。ツールポリシーは、承認が必要な行動を人へのエスカレーションのボックスに送り、このボックスは予算の超過や行き詰まったループも扱う。領域の下には、すべてのステップを 1 つずつのスパンでトレースするよう示す帯があり、4 つのボックスが失敗した実行を、推論、ツール実行、オーケストレーション、検証に分類する。](../images/effort-agent-architecture.svg "提案するハーネスであり、プロバイダーの挙動ではない。effort が作用するのは 1 つのボックスの中だけで、それ以外はすべて自分のコードである。")

<div class="callout proposal">

<span class="label proposal">提案</span> このスライドのループは、本番用ハーネスとして筆者が推奨するものである。これをそのまま提供しているプロバイダーはない。

</div>

| 課題 | 提案する制御 |
| --- | --- |
| 暴走するループ | ステップ、token、経過時間の予算を、すべてのモデル呼び出しの前に確認する |
| 進展のないループ | 同じ引数での同じツール呼び出しが繰り返されたとき、または同じチェックが失敗し続けるときに停止する |
| ツールの失敗とタイムアウト | ツールごとにタイムアウトを設ける。リトライは冪等なツールだけに行う。エラーとタイムアウトは結果としてモデルに返し、隠さない |
| 重大な結果を伴う行動 | ツールごとのポリシー：読み取り専用のツールは許可し、書き込み、デプロイ、削除、支払いの前には人に確認し、それ以外は拒否する。コードはサンドボックスで実行する |
| コンテキスト | 各ツール結果を状態とともに追加する。大きな出力は切り詰め、完全な成果物への参照を残す |
| オブザーバビリティ | モデル呼び出し、ツール呼び出し、チェックごとに 1 つのトレーススパンを作り、effort の設定と token 使用量を記録する |
| 最終結果 | 検証器に合格したものだけを受け入れる |

```typescript
const LIMITS = { maxSteps: 30, maxOutputTokens: 400_000, maxWallClockMs: 15 * 60_000, maxRepeats: 3 };

async function runTask(task: Task): Promise<RunResult> {
  const ctx = newContext(task);
  const startedAt = Date.now();
  let outputTokens = 0;

  for (let step = 1; step <= LIMITS.maxSteps; step++) {
    if (outputTokens > LIMITS.maxOutputTokens || Date.now() - startedAt > LIMITS.maxWallClockMs) {
      return { outcome: "stopped", reason: "budget_exhausted", suspected: "orchestration" };
    }

    // The only place the effort setting acts.
    const turn = await trace("model_call", () => callModel(ctx, { effort: chooseEffort(task) }));
    outputTokens += turn.usage.outputTokens;

    if (turn.kind === "answer") {
      const check = await trace("verify", () => verify(task, turn.answer));
      if (check.passed) return { outcome: "verified", answer: turn.answer, check };
      ctx.append({ type: "verification_failed", findings: check.findings });
      continue;
    }

    const call = turn.toolCall;
    if (repeatCount(ctx, call) >= LIMITS.maxRepeats) {
      return { outcome: "stopped", reason: "no_progress", suspected: "reasoning" };
    }

    const policy = toolPolicy(call); // "allow" | "ask" | "deny"
    if (policy === "deny" || (policy === "ask" && !(await askHuman(call)))) {
      ctx.append({ type: "tool_denied", call });
      continue;
    }

    // Retry only idempotent tools; errors and timeouts go back to the model as results.
    const result = await trace("tool_call", () =>
      runTool(call, { timeoutMs: 60_000, retries: call.idempotent ? 2 : 0 }),
    );
    ctx.append({ type: "tool_result", call, result });
  }

  return { outcome: "stopped", reason: "step_limit", suspected: "orchestration" };
}
```

<div class="callout verified">

<span class="label verified">検証済み</span> このループは、呼び出すヘルパー（`callModel`、`verify`、`runTool` など）のスタブ宣言を用意したうえで、`tsc --strict`（TypeScript 5.9.3）を通過する。さらに、Node.js 26.9.0 上で、スクリプト化した偽のモデルと偽のツールを相手に実行し、8 件の制御フローテストすべてに合格した。検証済みの回答、検証のフィードバック、繰り返し呼び出しによる停止、ステップ上限、token 予算、拒否されたツールと承認されなかったツール、冪等でないツールのリトライなし、ツールのタイムアウトのモデルへの返却である。経過時間の予算はテストしていない。実際のモデルは呼び出していないので、これが示すのは制御フローが動くことであり、その中でモデルがどう振る舞うかではない。上限値は調整前提のプレースホルダーである。

</div>

<div class="callout documented">

<span class="label documented">ドキュメント</span> Anthropic はこの設計の中核を推奨している。エージェントは各ステップで環境から「グラウンドトゥルース」を得るべきであり、「最大反復回数のような」停止条件を含めるべきだという（[Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)）。

</div>

**失敗した実行には、最初に壊れた分類をラベル付けする。** 判断はトレースを読んで行う。*推論*：事実はコンテキストにあったのに、計画が間違っていた。*ツール実行*：エラー、タイムアウト、または不正な出力。*オーケストレーション*：失われたコンテキスト、ループ、または使い切った予算。*検証*：チェックが欠けていた、不安定だった、または間違っていた。コード中の `suspected` フィールドは最初の推測にすぎず、決めるのはトレースである。

<div class="callout opinion">

<span class="label opinion">意見</span> effort を上げてみる理由になるのは 1 つ目の分類だけである。残りの 3 つはハーネスで直すものだ。

</div>

## effort を上げて本当に効果があるかを測る

<p class="slide-kicker">第IV部 · 本番システムでの活用</p>

実際のワークロードを代表する評価セットを作る。実際のタスクで構成し、各タスクには、結果を見る前に書いた検証器を用意する。そのうえで、モデルがサポートする設定を、effort 以外は同じ条件で比較する。

![テンプレートであり測定データはないと書かれたバナーを持つダッシュボードのテンプレート。ダッシュだけの 9 つの空のタイル：検証済みタスク成功率、初回成功率、テスト合格率、レイテンシ P50、レイテンシ P95、成功したタスクあたりのコスト、タスクあたりの平均リトライ数、タスクあたりのツール呼び出し数、エージェントの総経過時間。その下に、データではないと明記されたプレースホルダーのマーカーを持つ空の成功率対コストのチャートと、手順のチェックリストがある。](../images/effort-eval-dashboard.svg "テンプレートであり、結果ではない。ここでは実験を報告していないので、すべての値がダッシュになっている。")

**それ以外はすべて固定する。** 次のものを固定し、記録する。

- モデルのスナップショット ID と SDK のバージョン
- システムプロンプト、ツール定義、ハーネスのバージョン
- 各タスクの開始時のコンテキスト：リポジトリのコミット、フィクスチャ、取得したドキュメント
- 出力の上限（`max_output_tokens` または `max_tokens`）と、スライド 15 のループの予算
- 検証器とその合格基準

変えるのは effort の値だけにし、モデルのドキュメントに記載された値だけを使い、設定を時間的に交互に実行する。そうすれば、プロバイダー側の変更や遅い時間帯が 1 つの設定にだけ重なることを避けられる。

**各タスクを設定ごとに複数回実行する。** 同じプロンプトでも 2 回の実行は食い違うことがあるので、タスクごとに 1 回の実行では、設定と同じくらい運を測ることになる。実行回数は始める前に決め、同じタスクでタスクごとに設定を比較し、平均だけでなく区間を報告する。成功率には Wilson の区間のような二項分布の区間が使える。レイテンシとコストには、タスク単位のブートストラップを使う。

<div class="callout opinion">

<span class="label opinion">意見</span> 30〜50 タスクで、タスクごと・設定ごとに 5 回の実行が、最初の目安として妥当である。2 つの設定の区間が大きく重なるなら、まだ差は示せていない。結論を出す前に、タスクか実行回数を増やすこと。

</div>

回答の長さや reasoning token の数で成功を判断してはいけない。どちらも費やした労力を測るものであり、得られた品質を測るものではない。

## 埋めて使えるベンチマークのテンプレート

<p class="slide-kicker">第IV部 · 本番システムでの活用</p>

最初の実行の前にすべての指標を定義しておく。そうすれば、結果を見てから数値を選ぶことはできない。

| 指標 | 定義 | 注意点 |
| --- | --- | --- |
| 検証済みタスク成功率 | 最終結果が検証器に合格した実行数を、全実行数で割ったもの | 主要な数値 |
| 初回成功率 | 検証のフィードバックもリトライもなく、最初の回答で合格した実行数を、全実行数で割ったもの | 成功のうち、どれだけがループの回復によるものか |
| テスト合格率 | 各実行の最後に、合格したテスト数を実行したテスト数で割ったもの | 部分点であり、検証済み成功の代わりにはならない |
| レイテンシの中央値と P95 | 実行ごとの、タスク開始から最終結果までの経過時間 | P95 が意味を持つには多くの実行が必要 |
| 成功したタスクあたりのコスト | 失敗した実行も含む全実行の総支出を、検証済みの成功数で割ったもの | 可能ならツールとインフラのコストも加える |
| 平均リトライ回数 | 実行ごとの、チェックの失敗やツールのエラーの後に行われたモデル呼び出しの数 | モデル呼び出しの総数とは分けて数える |

<div class="callout illustrative">

<span class="label illustrative">説明用の例</span> テンプレートであり、結果ではない。この記事では実験を報告していないので、すべてのセルがダッシュになっている。

| 設定 | 実行数 | 検証済み成功（95% CI） | 初回成功 | テスト合格率 | レイテンシ P50 / P95 | 成功あたりのコスト | 平均リトライ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| low | — | — | — | — | — / — | — | — |
| medium | — | — | — | — | — / — | — | — |
| high | — | — | — | — | — / — | — | — |

実行日、モデルのスナップショット、SDK のバージョン、タスクセットのバージョン、検証器のバージョン、タスクあたりの実行回数と一緒に公表すること。

</div>

なぜ想定ではなく測るのか。effort を上げると、熟考を要するタスクでは助けになり得る一方で、レイテンシと output token も増えやすい。どちらの効果が勝つかは、モデル、タスクの構成、検証器の強さによって決まり、モデルが変われば変わることもある。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Anthropic の effort ガイドは「effort レベルの影響はタスクの種類によって異なる」とし、「デプロイする前に、自分の具体的なユースケースで性能を評価する」よう勧めている（[Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)）。OpenAI は、サポートされる値はモデルによって異なると述べている（[OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)）。

</div>

## reasoning effort を明示的なエンジニアリング上の判断にする

<p class="slide-kicker">第IV部 · 本番システムでの活用</p>

プロバイダーが対応している場合、effort はリクエストのパラメータである。ドキュメントに記載された形の OpenAI Responses API リクエストを示す。reasoning token の数もレスポンスから読み取っている。

```typescript
import OpenAI from "openai";

const client = new OpenAI();

const response = await client.responses.create({
  model: "gpt-6-astra",
  reasoning: { effort: "high" }, // the setting this slide is about
  input: "Analyze this production bug...",
});

console.log(response.output_text);
console.log(response.usage?.output_tokens_details.reasoning_tokens);
```

<div class="callout documented">

<span class="label documented">ドキュメント</span> OpenAI のガイドでは、`responses.create` に `reasoning: { effort }` があり、`none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` が挙げられ、サポートされる値はモデルによって異なると記されている。ガイド自身の例が使っているモデル GPT-6 Astra は `none` を HTTP 400 で拒否し（[OpenAI: Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)）、そのモデルのページには `low` から `max` までが記載されている（[GPT-6 Astra](https://developers.openai.com/api/docs/models/gpt-6-astra)）。

</div>

この設定は、どれだけ推論を適用するかを表すものだ。モデルの非公開の推論を返すものではなく、利用できるのはオプトインの要約だけである。

同じリクエストを Anthropic の Messages API と Gemini の Interactions API で書くと次のようになる。

```typescript
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const message = await anthropic.messages.create({
  model: "claude-opus-5-5",
  max_tokens: 16000, // thinking counts toward this cap
  output_config: { effort: "high" },
  messages: [{ role: "user", content: "Analyze this production bug..." }],
});

console.log(message.usage.output_tokens_details?.thinking_tokens);
```

```typescript
import { GoogleGenAI } from "@google/genai";

const gemini = new GoogleGenAI({});

const interaction = await gemini.interactions.create({
  model: "gemini-3.8-flash",
  input: "Analyze this production bug...",
  generation_config: { thinking_level: "high" },
});

console.log(interaction.output_text);
console.log(interaction.usage?.total_thought_tokens);
```

<div class="callout verified">

<span class="label verified">検証済み</span> 3 つのスニペットはすべて、`openai` 7.42.0、`@anthropic-ai/sdk` 1.1.0、`@google/genai` 2.30.0 に対して `tsc --strict`（TypeScript 5.9.3）を通過する。対照実験として、未知の effort 値、Anthropic のリクエストのトップレベルに置いた `effort`、effort 値として渡した `adaptive`、Interactions API での camelCase の `thinkingLevel` は、いずれも同じチェックで失敗した。型チェックでは、モデル名が存在するかどうかや、モデルがどの値を受け付けるかは分からない。また、これらのリクエストはどれも送信していない。

</div>

**名前は似ていても、契約は異なる。** 共通の形式はない。

| プロバイダーと API | リクエストのフィールド | ドキュメント記載の値 | reasoning の使用量フィールド | 出典 |
| --- | --- | --- | --- | --- |
| OpenAI, Responses | `reasoning: { effort }` | `none`、`minimal`、`low`、`medium`、`high`、`xhigh`、`max` | `usage.output_tokens_details.reasoning_tokens` | [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning) |
| Anthropic, Messages | `output_config: { effort }` | `low`、`medium`、`high`、`xhigh`、`max` | `usage.output_tokens_details.thinking_tokens` | [Effort](https://platform.claude.com/docs/en/build-with-claude/effort)、[Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost) |
| Google, Interactions | `generation_config: { thinking_level }` | `minimal`、`low`、`medium`、`high` | `usage.total_thought_tokens` | [Thinking](https://ai.google.dev/gemini-api/docs/thinking) |
| Google, generateContent | JavaScript SDK では `config.thinkingConfig.thinkingLevel` | 同じ 4 つのレベル | `usageMetadata.thoughtsTokenCount` | [API リファレンス](https://ai.google.dev/api/generate-content)。フィールドの位置は SDK の型で確認 |

各リストはモデル全体の和集合であり、個々のモデルが受け付けるのはその一部である。また、名前が同じでも挙動が同じとは限らない。あるモデルの `high` は、同じベンダーのモデルであっても、別のモデルの `high` と揃えて調整されてはいない。

<div class="callout documented">

<span class="label documented">ドキュメント</span> Anthropic は、Claude Sonnet 5.5 の effort レベルは再調整されているので、あるレベルが「Claude Sonnet 5 の同じレベルと同じ量の thinking を生むわけではない」とし、effort を改めて掃引して比較するよう勧めている（[Anthropic: Effort](https://platform.claude.com/docs/en/build-with-claude/effort)）。

</div>

## effort を選ぶための出発点となるヒューリスティック

<p class="slide-kicker">第V部 · 実践のためのまとめ</p>

<div class="callout opinion">

<span class="label opinion">意見</span> このマトリクスは、最初の設定を決めるための筆者のエンジニアリング上のヒューリスティックであり、規則でもベンダーのガイダンスでもない。何を示唆するにせよ、自分のワークロードで検証してほしい。

</div>

| 要因 | 低い effort を示すもの | 高い effort を示すもの | 多くの場合より良い手段 |
| --- | --- | --- | --- |
| タスクの複雑さ | 道が 1 本、局所的な変更 | 相互に作用する多くの部分、複数の妥当な道 | 深いのではなく広いタスクは分解する |
| 不確実性と曖昧さ | 正確な仕様 | 比較検討すべき競合する仮説 | 推論ではなく仕様が曖昧なら、確認の質問をする |
| コンテキスト | 必要なものがすべてプロンプトにある | 揃ってはいるが入り組んだコンテキスト | 事実が欠けているなら、ファイル、ログ、ドキュメントを取得する |
| 外部情報の必要性 | なし | それだけでは理由にならない | ツールを呼ぶ。effort は事実を生み出せない |
| 誤った結果の代償 | 簡単に元に戻せる | 高くつく、または取り返しがつかない | effort に加えて、人による承認とより強いチェック |
| 自動検証 | 強く速いテストがあり、反復が安い | チェックが弱いかないので、最初の答えがより重要 | effort を上げる前に、足りないテストを書く |
| レイテンシとコストの予算 | 対話型、大量、厳しい予算 | タスクあたりの価値が高いオフラインやバッチの作業 | 1 つのグローバル設定ではなく、タスクごとにルーティングする（スライド 14） |

使い方：各ルートは、その種類のワークロードに対してプロバイダーのガイダンスが推奨するレベル、またはドキュメントの既定値から始める。effort を上げるのは、トレースした失敗の大半が推論の失敗であり（スライド 15）、かつ差を示せるほど検証器が強いルートだけにする。低いレベルでも検証済みの成功が保たれるなら、レベルを下げる。そのうえでスライド 16 と 17 のベンチマークを実行し、表よりも数値を優先すること。

## thinking effort を上げる前に、この 5 つの問いを確認する

<p class="slide-kicker">第V部 · 実践のためのまとめ</p>

<div class="checklist">

1. <strong>そのタスクは本当に複雑、または不確実か？</strong><span>定型で確認しやすいなら、追加の推論はコストを増やすだけになりがち。</span>
2. <strong>モデルは推論に苦労しているのか、それとも重要な情報が欠けているのか？</strong><span>欠けている事実には、熟考ではなく検索やツールが必要。</span>
3. <strong>別のツールや検証ステップのほうが効果的ではないか？</strong><span>テストの実行は、もう一段落の熟考にしばしば勝る。</span>
4. <strong>期待される品質の向上は、増えるレイテンシとコストに見合うか？</strong><span>リクエストあたりではなく、成功したタスクあたりのコストで比べる。</span>
5. <strong>代表的な実タスクで差を測ったか？</strong><span>測っていないなら、他の 4 つへの答えは推測として扱う。</span>

</div>

これは繰り返し使える判断カードとして残してほしい。問い 1 と問い 5 に「はい」と答えられないなら、設定を上げるのはまだ早いだろう。

## 最良のエージェントは、最も多く考えるものではない。必要なところに effort を配分するものだ。

<p class="slide-kicker">第V部 · 実践のためのまとめ</p>

![エージェントが 3 つの経路から選ぶ。簡単なタスクには十分なクイックパス、必要なところに推論を適用する強調された熟考パス、検索し、読み、実行するエビデンスパス。選ばれた経路は検証ゲートを通って結果に至る。](../images/effort-closing-path.svg "タスクが必要とする経路を選び、受け入れる前に結果を確認する。")

1. thinking effort は、モデルがタスクを処理する方法に影響し得る。ただし正しさは保証しない。
2. reasoning、ツール利用、コンテキストの取得、検証は、*それぞれ異なる*問題を解く。
3. 適切な設定は、自分のワークロードを評価して決まる。

<p class="pull-question">「どうすれば AI にもっと考えさせられるか」ではなく、「このタスクを確実に完了するには、どれだけの推論が必要か」と問おう。</p>

### 参考文献とさらに読む

プロバイダーのページはすべて 2026 年 10 月 22 日に最終確認した。

- OpenAI, [Reasoning models](https://developers.openai.com/api/docs/guides/reasoning)：`reasoning.effort`、reasoning token、要約。[GPT-6 Astra のモデルページ](https://developers.openai.com/api/docs/models/gpt-6-astra)：サポートされる effort の値。
- Anthropic, [Effort](https://platform.claude.com/docs/en/build-with-claude/effort) と [Steering thinking](https://platform.claude.com/docs/en/build-with-claude/thinking-steering-and-cost)：モデルごとの effort レベルと既定値、adaptive thinking、thinking token とコスト。
- Google, [Gemini thinking](https://ai.google.dev/gemini-api/docs/thinking)：Interactions API の `thinking_level`、モデルごとのレベル、thought の要約と thinking token の使用量。[generateContent リファレンス](https://ai.google.dev/api/generate-content)：`usageMetadata.thoughtsTokenCount`。
- 型チェックに使った SDK：[`openai`](https://www.npmjs.com/package/openai) 7.42.0、[`@anthropic-ai/sdk`](https://www.npmjs.com/package/@anthropic-ai/sdk) 1.1.0、[`@google/genai`](https://www.npmjs.com/package/@google/genai) 2.30.0。
- Anthropic, [Building effective agents](https://www.anthropic.com/engineering/building-effective-agents)（2024 年 12 月）：ワークフロー、エージェント、複雑さを加えるべき場面。
- Yao et al., [ReAct: Synergizing Reasoning and Acting in Language Models](https://arxiv.org/abs/2210.03629)（2022）。
- Snell et al., [Scaling LLM Test-Time Compute Optimally can be More Effective than Scaling Model Parameters](https://arxiv.org/abs/2408.03314)（2024）。
- Chen et al., [Reasoning Models Don't Always Say What They Think](https://arxiv.org/abs/2505.05410)（2025）。

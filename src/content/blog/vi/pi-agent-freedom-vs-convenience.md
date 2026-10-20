---
title: 'Pi Agent: Sự đánh đổi giữa tự do và tiện lợi'
description: 'Pi trao cho bạn một lõi agent nhỏ và một API extension, phần còn lại để bạn tự lo. Các thí nghiệm của tôi với extension, sub-agent và sandbox cho thấy sự tự do ấy đáng giá đến đâu, và công việc kỹ thuật, vận hành mà nó trả lại cho bạn.'
pubDate: 2026-10-19T09:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: true
---

<div class="callout">

**Cách đọc bài này.** Pi thay đổi rất nhanh, nên mỗi nhận định đều mang nhãn:

- <span class="label documented">Tài liệu</span>: có trong tài liệu chính thức, mã nguồn hoặc bài viết của các tác giả, kèm liên kết ngay cạnh nhận định.
- <span class="label observed">Quan sát</span>: điều tôi tự trải nghiệm. Không phải phép thử có kiểm soát.
- <span class="label opinion">Quan điểm</span>: cách tôi diễn giải.
- <span class="label proposal">Đề xuất</span>: một ý tưởng đáng đánh giá. Không phải thứ tôi đã thử hay Pi có sẵn.

**Phiên bản.** Các nhận định về Pi áp dụng cho `@earendil-works/pi-coding-agent` **1.3.0** (tag `latest` trên npm khi tôi kiểm tra ngày 19/10/2026) và tài liệu Pi tại ngày đó. Tôi không đo chất lượng đầu ra ở bất kỳ chỗ nào, và bài này không nói agent nào viết code tốt hơn.

</div>

## 1. Bất ngờ đầu tiên

<div class="callout observed">

<span class="label observed">Quan sát</span> Dùng Pi có cảm giác như được tiếp cận một trong những công nghệ mạnh nhất hiện có, rồi lại thấy mình phải dựng lại những thứ gần như sơ khai so với nó. Model rất mạnh. Môi trường xung quanh thì mỏng, so với các sản phẩm coding tích hợp mà tôi từng dùng trước đây.

</div>

Sự tương phản đó nói về chỗ công việc nằm ở đâu, không nói về chất lượng. Ở một sản phẩm tích hợp, nhiều năng lực hỗ trợ đã có sẵn khi bạn mở nó ra. Với Pi, tôi có thể tự thay đổi hoặc tự xây những mảnh đó, và tôi bắt đầu làm vậy.

<div class="callout author-input">

<span class="label author-input">Cần tác giả bổ sung</span> Ghi chú trước đó nói rằng tôi thấy Pi đọc file ngoài project của tôi mà không hiện hộp thoại xin quyền, khác với một agent khác. Hãy xác nhận hoàn cảnh (project nào, file nào, agent nào) hoặc bảo tôi cắt đoạn này. Cho đến lúc đó, tôi chỉ coi nó là một câu hỏi đã khởi động cuộc điều tra, không phải bằng chứng.

</div>

Bài này đi theo một lập luận. **Pi cho lập trình viên nhiều tự do hơn để định hình hệ thống quanh một model, và sự tự do đó chuyển trách nhiệm sang họ.** Sự tiện lợi không biến mất. Nó trở thành thứ bạn phải xây, tích hợp, kiểm thử và bảo trì. Tôi sẽ đi từ kiến trúc, qua các thí nghiệm của mình, đến chuyện gì xảy ra khi việc thực thi thất bại, ranh giới phân quyền, vấn đề workflow và Code Mode, rồi kết bằng việc tôi nghĩ sự đánh đổi này thực chất là gì.

## 2. Pi là gì

<div class="callout documented">

<span class="label documented">Tài liệu</span> Pi được Mario Zechner giới thiệu trong bài [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/) (tháng 11/2025). Mã nguồn hiện ở [earendil-works/pi](https://github.com/earendil-works/pi). Vòng lặp agent thêm tin nhắn của bạn vào nhánh đang hoạt động, stream phản hồi của model, thực thi các lời gọi công cụ, ghi lại kết quả, và bắt đầu một lượt khác nếu cần. Năm giao diện dùng chung cùng cơ chế agent và session: terminal tương tác, print, JSON (sự kiện JSONL), RPC (JSONL trên stdin/stdout) và TypeScript SDK chạy trong cùng process. ([How Pi works](https://pi.dev/docs/latest/how-pi-works))

</div>

![Kiến trúc phân lớp của Pi. Bốn cách điều khiển (TUI tương tác, print/JSON, RPC, TypeScript SDK) nằm trên pi-coding-agent (session, file ngữ cảnh, compaction, trust, settings), lớp này nằm trên pi-agent-core (vòng lặp agent) và pi-ai (API LLM thống nhất). Extension móc vào coding agent từ bên cạnh, có thể đăng ký công cụ và lệnh hoặc chặn lời gọi công cụ. Dưới cùng, các công cụ dựng sẵn chạy dưới user hệ điều hành đã khởi động Pi, mặc định không có hàng rào đường dẫn hay hộp thoại phê duyệt.](../images/pi-architecture.svg)

Bốn công cụ dựng sẵn được bật mặc định: `read`, `bash`, `edit` và `write`. `grep`, `find` và `ls` phải bật thêm ([CLI reference](https://pi.dev/docs/latest/cli)). Trang chủ liệt kê những thứ Pi cố tình bỏ ra: "No sub-agents", "No plan mode", "No permission popups". Với mỗi thứ, trang này chỉ sang extension, package hoặc công cụ khác ([pi.dev](https://pi.dev)).

Tài liệu tách bạch các cơ chế tùy biến, và sự khác biệt này quan trọng cho mọi phần bên dưới ([How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Cơ chế | Là gì | Mức cưỡng chế |
|---|---|---|
| Skill và file ngữ cảnh | Chỉ dẫn model đọc, nạp theo nhu cầu hoặc lúc khởi động | Không có. Model có thể phớt lờ. |
| Prompt template | Đoạn tin nhắn dùng lại được, mở rộng từ đầu vào của bạn | Không có. |
| Extension | Module TypeScript nạp vào process Pi. Chúng đăng ký công cụ, lệnh, nhà cung cấp, bộ xử lý sự kiện và giao diện. | Bằng code. Chúng có thể chặn lời gọi công cụ, và chạy với quyền hệ điều hành của process. |
| Package | Cách phân phối extension, skill, template và theme qua npm hoặc git | Giống nội dung bên trong. |

Trang chủ nói MCP nay đã được tích hợp sẵn, cùng với Codemode (phần 9).

Các lớp này trả lời những câu hỏi khác nhau, và chọn nhầm lớp là lỗi dễ mắc. Trước khi viết code, hãy hỏi yêu cầu thực sự là gì:

- **Chỉ dẫn hoặc kiến thức dùng lại được** (repo này build thế nào, quy ước nào áp dụng): file ngữ cảnh, skill hoặc prompt template. Skill phù hợp khi một workflow "needs more context than a prompt template but does not need a new executable integration point" ([Skills](https://pi.dev/docs/latest/skills)).
- **Hành vi lúc chạy hoặc việc thực thi công cụ** (chặn một lời gọi, thêm công cụ, đổi thứ model nhìn thấy): extension.
- **Tích hợp với hệ thống khác:** extension, MCP, hoặc điều khiển Pi từ bên ngoài qua RPC hay SDK (phần 8).
- **Phân phối và duy trì một bộ các thứ trên:** package. Package chỉ là cơ chế phân phối, và chúng "can execute extension code and can include skills that instruct the model to run programs", nên việc xem xét mã nguồn là của bạn ([Packages](https://pi.dev/docs/latest/packages)).

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Dùng extension trong khi một skill là đủ nghĩa là phải sở hữu đoạn TypeScript luôn phải theo kịp API của Pi. Dùng skill trong khi cần cưỡng chế nghĩa là dựa vào một model có thể phớt lờ nó. Tôi chưa mô tả trường hợp nào mình chọn sai, và sẽ không bịa ra. Ý chính là API extension mạnh đến mức việc lựa chọn này rất dễ bị bỏ qua.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Câu hỏi tiếp theo là Pi là một ứng dụng coding hoàn chỉnh hay một nền tảng agent để bạn xây lên trên. Tôi đọc nó là cái thứ hai. Các thí nghiệm của tôi là thứ đẩy tôi đến kết luận đó.

</div>

## 3. Tự xây những mảnh còn thiếu

<div class="callout observed">

<span class="label observed">Quan sát</span> Tôi thử nghiệm với extension để có những năng lực mà tôi không tìm thấy ở dạng mình muốn:

- một **orchestrator**,
- **sub-agent** để xử lý công việc có session dài hoặc nhiều ngữ cảnh,
- các extension nhằm **hạn chế quyền**,
- một nỗ lực chạy **Pi bên trong container Docker** làm sandbox, để tìm hiểu quyền thực thi.

Những thử nghiệm này vấp phải khó khăn khi triển khai và gặp lỗi. Dù vậy, chúng dạy tôi nhiều hơn về cách một agent vận hành bên trong.

</div>

<div class="callout author-input">

<span class="label author-input">Cần tác giả bổ sung</span> Đây là phần mang tính cá nhân nhất của bài, và tôi không có thêm chi tiết nào. Nếu bạn muốn nó đọc như một câu chuyện (động cơ, thí nghiệm, khó khăn, câu hỏi, hiểu ra điều gì), hãy cho tôi một ví dụ cụ thể. Chẳng hạn: orchestrator được cho là làm gì, một lỗi bạn gặp, hoặc một điều bạn chỉ hiểu sau khi tự xây. Tôi sẽ không bịa ra bất kỳ điều gì trong số đó.

</div>

Điều tôi nói được mà không phải bịa gì là những gì tài liệu thiết lập sẵn. Pi gọi "no sub-agents" là một lựa chọn. Hướng dẫn extension của nó cũng không nhắc đến sub-agent, dù cho phép extension chạy các công cụ khác bằng `ctx.executeTool()`, và những lời gọi lồng nhau này đi qua cùng các handler `tool_call` như lời gọi do model phát ra ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). Vậy nên orchestrator không phải thứ bạn cấu hình. Nó là thứ bạn thiết kế.

### Ngữ cảnh không chỉ là một cửa sổ

Ngữ cảnh dài là lý do tôi muốn có sub-agent, nên cần nói chính xác các cơ chế của Pi làm gì. Ba thứ dễ bị lẫn vào nhau:

<div class="callout documented">

<span class="label documented">Tài liệu</span> Session được lưu tự động (trừ khi dùng `--no-session`) dưới `~/.pi/agent/sessions/`, nhóm theo thư mục làm việc. "Pi stores entries as a tree, so returning to an earlier point does not erase the branch you leave." `/tree` di chuyển trong file session hiện tại, `/fork` tạo session mới từ một tin nhắn người dùng trước đó, và `/clone` sao chép nhánh đang hoạt động sang session mới. Model chỉ nhận nhánh đang hoạt động, không nhận mọi nhánh trong file ([Sessions](https://pi.dev/docs/latest/sessions)). Compaction "does not delete the original session entries": một mục tóm tắt thay thế các tin nhắn cũ trong các request sau, còn bản gốc vẫn nằm trong cây ([How Pi works](https://pi.dev/docs/latest/how-pi-works)).

</div>

- **Compaction** quản lý thứ model nhìn thấy *lúc này*. Nó thay các tin nhắn cũ bằng một bản tóm tắt, nên bản tóm tắt giữ lại gì sẽ quyết định agent biết gì về sau.
- **Persistence** (lưu bền) giữ toàn bộ bản ghi trên đĩa, gồm cả phần compaction đã giấu khỏi model.
- **Branching** (rẽ nhánh) điều khiển *hướng đi*: bạn có thể quay lại một điểm trước đó và thử cách khác mà không mất nhánh đã rời.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Vậy quản lý ngữ cảnh không chỉ là nhét được nhiều hơn vào một cửa sổ. Nó còn là chọn lịch sử nào agent mang theo và agent đi theo hướng nào tiếp. Nhưng không có gì ở đây được chứng minh là tự nó giải quyết được tình trạng cạn kiệt ngữ cảnh. Compaction có thể thất bại (tài liệu nói bạn thử lại bằng `/compact`), bản tóm tắt vốn mất thông tin, và bản ghi trên đĩa không tự quay lại ngữ cảnh của model. Rẽ nhánh giúp con người lái, nhưng không làm một tác vụ dài tự tiếp tục. Tôi chưa thử các tính năng này hoạt động ra sao trong các thí nghiệm orchestrator của mình, nên không thể nói liệu chúng có loại bỏ nhu cầu về sub-agent hay không.

</div>

## 4. Khi việc ủy quyền trở nên khó nhìn thấy

<div class="callout observed">

<span class="label observed">Quan sát</span> Trong lúc thử nghiệm với sub-agent, tôi thấy rất khó theo dõi chúng đang làm gì. Agent chính có thể liên tục báo rằng công việc đang diễn ra, trong khi tôi gần như không có hoặc không có cái nhìn rõ ràng về việc sub-agent thực sự đang làm gì.

</div>

Quan sát này nói về một khoảng trống: giữa tín hiệu tiến độ chung chung và khả năng kiểm tra việc thực thi thực sự. Dựng cái thứ nhất thì dễ và dễ bỏ qua cái thứ hai. Tôi không khẳng định extension của mình có hay thiếu cơ chế cụ thể nào. Điểm bên dưới là thứ một hệ thống ủy quyền cần có, nếu bạn muốn tin nó.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Khởi chạy một sub-agent mới chỉ là điều phối. Hiểu được nó cần nhiều hơn:

- **Trạng thái so với tiến độ.** "Running" cho biết một tác vụ tồn tại. Nó không cho biết tác vụ đang đọc file, đang chờ model hay đang kẹt.
- **Sự kiện thực thi.** Các lời gọi công cụ và kết quả trung gian của agent con, không chỉ câu trả lời cuối.
- **Truy vết xuyên các cấp.** Cách nối hành động của agent con với request cha đã gây ra chúng.
- **Xử lý lỗi.** Timeout, tác vụ bị treo, và một đường báo lỗi đến được agent cha dưới dạng khác với sự im lặng.

</div>

Các khối xây dựng của Pi bao phủ một phần. Session được lưu dưới dạng cây JSONL ghi lại tin nhắn, lời gọi công cụ và kết quả, cùng các lần compaction, còn chế độ JSON và RPC stream các sự kiện agent ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). API extension bổ sung các hook chi tiết hơn. Sự kiện vòng đời gồm `agent_start`, `turn_start`, `message_update` và `agent_settled`, còn việc thực thi công cụ có `tool_execution_start`, `tool_execution_update` (tiến độ trong một lời gọi) và `tool_execution_end`. Với các lời gọi lồng nhau qua `ctx.executeTool()`, những sự kiện này mang theo `parentToolCallId` ([hướng dẫn extension](https://pi.dev/docs/latest/extensions)). SDK cung cấp `session.subscribe()` cho sự kiện của một session chạy trong cùng process ([SDK](https://pi.dev/docs/latest/sdk)). Đây là các khối xây dựng, và tôi chưa kiểm chứng chúng hoạt động thế nào giữa các process Pi con riêng biệt. Tài liệu tôi đọc không mô tả dashboard, metrics hay hệ thống tracing nào ngoài những thứ này. Việc một process con có xuất hiện hữu ích trong bản ghi đó hay không phụ thuộc vào cách bạn khởi chạy nó. Đó là một quyết định thiết kế thuộc về bạn.

Gộp lại, có ba thuộc tính riêng biệt, và một agent có thể có cái đầu tiên mà thiếu các cái còn lại:

- **Thực thi:** nó có thể thực hiện hành động.
- **Khả năng quan sát:** bạn biết nó đang làm gì và đang ở đâu.
- **Kiểm soát:** bạn có thể can thiệp, đổi cách làm hoặc dừng nó.

Ủy quyền mà thiếu khả năng quan sát tạo ra một hệ thống có thể hành động mà không dễ hiểu được. Đó là kết luận về thiết kế, không phải khẳng định rằng mọi hệ thống đa agent đều như vậy.

## 5. Khi việc thực thi dừng lại

<div class="callout observed">

<span class="label observed">Quan sát</span> Trong lúc dùng bình thường, tôi gặp những lỗi bất ngờ: lỗi phản hồi của model, dùng công cụ sai, và cạn kiệt context window. Khi chúng xảy ra, việc thực thi có thể dừng mà không tự phục hồi và tiếp tục tác vụ. Tôi phải can thiệp, chẩn đoán vấn đề, điều chỉnh trạng thái thực thi hoặc cách làm của mình, và tìm cách để chạy tiếp. Tùy loại lỗi, đó là một gián đoạn nhỏ hoặc một chướng ngại khiến tác vụ không thể tiến triển.

</div>

<div class="callout author-input">

<span class="label author-input">Cần tác giả bổ sung</span> Tôi chỉ giữ ở mức bạn đã mô tả. Nếu bạn nêu được một lỗi chỉ là gián đoạn nhỏ và một lỗi là chướng ngại, tôi có thể làm sự tương phản này cụ thể. Tôi không đoán lỗi nào thuộc nhóm nào.

</div>

Đây là vấn đề khác với phần 4. Khả năng quan sát hỏi bạn có thấy được agent đang làm gì không. Khả năng phục hồi hỏi chuyện gì xảy ra khi việc nó đang làm bị hỏng. Khả năng **thực thi** một tác vụ của agent và khả năng **phục hồi** khi việc thực thi thất bại là hai thuộc tính riêng. Một hệ thống có thể rất giỏi cái đầu mà không nói gì về cái sau.

Tôi không nên nói quá những gì Pi thiếu, vì nó có hành vi phục hồi, và tài liệu mô tả chúng:

<div class="callout documented">

<span class="label documented">Tài liệu</span> Pi có cơ chế retry tự động ở cấp agent cho "transient failures", bật mặc định, với mặc định 3 lần thử và exponential backoff bắt đầu từ 2 giây, tối đa 60 giây ([Settings](https://pi.dev/docs/latest/settings)). Nó cũng có compaction tự động, khởi động khi ngữ cảnh trống còn dưới mức dự trữ (mặc định 16.384 token). Khi nhà cung cấp trả lỗi tràn ngữ cảnh, Pi có thể thử một lần phục hồi kiểu compact-rồi-thử-lại. Nếu lần phục hồi đó thất bại hoặc bị hủy, nó "does not schedule an internal retry" ([Compaction](https://pi.dev/docs/latest/compaction)). Khi bản thân một công cụ thất bại, lỗi trở thành một kết quả lỗi trả về cho model ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)).

</div>

Vậy phát biểu chính xác không phải là Pi không bao giờ phục hồi. Một số lỗi có đường xử lý tích hợp sẵn, và một số đường đó có giới hạn: ba lần retry, một lần compaction. Tài liệu tôi đọc không liệt kê lỗi nào được tính là transient. Chúng cũng không mô tả cách xử lý tích hợp cho một model cứ dùng sai một công cụ, hoặc cho một lần chạy kết thúc ở trạng thái bạn muốn tiếp tục. Tôi không biết liệu lỗi nào của mình nằm trong hay ngoài các đường tích hợp sẵn. Tôi không khẳng định chúng là khoảng trống của Pi. Có thể đó là những trường hợp mặc định đã cạn hoặc không áp dụng.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Việc một lỗi cụ thể có tự tiếp tục hay không ít quan trọng hơn câu hỏi ai quyết định "đã phục hồi" nghĩa là gì. Phục hồi đáng tin cậy thường cần các quyết định về:

- **Chiến lược retry.** Retry lỗi nào, bao nhiêu lần, và khi nào ngừng retry để báo lên.
- **Xử lý lỗi.** Một lời gọi công cụ sai trở thành tin nhắn cho model, một lần dừng, hay một yêu cầu gửi đến bạn.
- **Quản lý ngữ cảnh.** Điều gì được tóm tắt hoặc bị bỏ khi cửa sổ đầy, và tác vụ có sống sót qua đó không. Compaction tóm tắt công việc trước đó, nên bản tóm tắt giữ lại gì sẽ định hình agent biết gì về sau.
- **Workflow phục hồi tường minh.** Một cách được xác định để kiểm tra trạng thái đã hỏng, điều chỉnh nó và chạy tiếp, thay vì ứng biến mỗi lần.

</div>

Pi cho bạn một phần những thứ này, và cây session của nó, vốn giữ nguyên các mục gốc ngay cả sau compaction, là một bản ghi hữu ích để tiếp tục từ đó ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). Các package cộng đồng cho retry và compaction an toàn hơn được liệt kê tại [pi.dev/packages](https://pi.dev/packages). Tôi chưa đánh giá chúng, nên không thể nói chúng hoạt động tốt đến đâu. Ở một sản phẩm tích hợp, nhiều quyết định trong số này có thể đã được đưa sẵn cho bạn. Với Pi, mặc định chỉ là điểm xuất phát, và phần còn lại là của bạn để thiết kế, kiểm thử và bảo trì. Đó là cùng một sự đánh đổi như trước, nhìn từ trường hợp thất bại: tự do tùy biến một agent không đi kèm đảm bảo rằng nó phục hồi một cách trơn tru.

## 6. Ranh giới phân quyền thực sự

Các thí nghiệm về phân quyền và Docker của tôi đặt ra câu hỏi cái gì thực sự giới hạn một agent. Một prompt, một công cụ bị hạn chế và một container là những thứ khác nhau, nên tách chúng ra sẽ có ích. Vòng lặp dưới đây mang tính khái niệm, không phải sơ đồ cấu trúc nội bộ của Pi:

> context → model → tool request → runtime → execution environment → tool result → updated context

Năm lớp đều có thể được gọi là "permission":

1. **Quyền của process.** Những gì user hệ điều hành chạy agent làm được. Mọi thứ trong process đều bị chặn trên bởi đây.
2. **Kiểm tra ở tầng ứng dụng.** Các quy tắc trong agent xem xét một lời gọi công cụ rồi cho phép, hỏi lại hoặc từ chối.
3. **Ranh giới thư mục project.** Thư mục làm việc là một hàng rào hay chỉ là điểm xuất phát.
4. **Năng lực của công cụ.** Một `read` có cấu trúc có thể bị rào theo đường dẫn. Một shell có thể chạy bất kỳ chương trình nào, và chương trình đó có thể mở bất kỳ file nào.
5. **Cách ly.** Container, VM và sandbox hệ điều hành giới hạn chính process, kể cả các process con.

<div class="callout documented">

<span class="label documented">Tài liệu</span> [Trang bảo mật](https://pi.dev/docs/latest/security) của Pi nói Pi "can read, change, and execute files with the permissions of the account that started it" và "does not ask for approval before every tool call". Thư mục làm việc điều khiển việc khám phá tài nguyên và vị trí mặc định của công cụ, nhưng không giới hạn các lệnh chạm tới đường dẫn khác. Xem transcript, tin cậy một project và xem lại thay đổi đều không phải ranh giới bảo mật. Lựa chọn được khuyến nghị là chạy toàn bộ Pi bên trong container, VM hoặc sandbox, với credential hẹp, ngắn hạn và mạng bị hạn chế khi có thể.

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Trong mã nguồn, [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) chấp nhận đường dẫn tương đối hoặc tuyệt đối, phân giải chúng theo thư mục làm việc, và chỉ kiểm tra file có đọc được không. Nó không bao giờ so sánh kết quả với thư mục làm việc. Tôi đã đọc file này nhưng chưa đọc hàm phụ trợ phân giải đường dẫn mà nó gọi, và tôi chưa chạy các công cụ của Pi. Đừng coi đây là kết quả đã được kiểm thử.

</div>

Điều đó khớp với tài liệu: mặc định không có hàng rào ở tầng ứng dụng. Nhưng việc không có hộp thoại không chứng minh quyền truy cập không giới hạn trong mọi cấu hình. Một extension có thể thêm kiểm tra. Sự kiện `tool_call` có thể sửa hoặc chặn một lời gọi, và một handler ném lỗi sẽ chặn nó theo kiểu fail-closed ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). Một hộp thoại cũng không chứng minh bảo mật toàn diện. Tài liệu của chính Claude Code lưu ý rằng quy tắc deny của Read và Edit không bao phủ một lệnh đọc file mà không nêu tên chúng, và nói `bypassPermissions` chỉ nên dùng trong môi trường cách ly như container hoặc VM ([permissions](https://code.claude.com/docs/en/permissions)). Vậy hai agent đồng ý về nơi ranh giới thật nằm. Chúng khác nhau ở mặc định giữa bạn và ranh giới đó: Claude Code hỏi với lệnh shell, chỉnh sửa và web fetch, còn việc đọc ngoài thư mục làm việc cần được duyệt trừ khi bạn cấu hình khác. Pi không hỏi gì cả.

![Ba cấu hình so theo đường đi của một lời gọi công cụ. Pi mặc định: không có kiểm tra tầng ứng dụng và không có sandbox hệ điều hành, nên lời gọi chạm tới mọi thứ user hệ điều hành truy cập được. Pi được gia cố (một đề xuất): extension của bạn chặn hoặc xác nhận lời gọi, container hoặc VM chỉ mount project, nên lời gọi chạm tới project đã mount và credential phạm vi hẹp. Claude Code ở chế độ mặc định: quy tắc phân quyền và chế độ hỏi khi đọc ngoài thư mục làm việc, có tùy chọn sandbox, và lời gọi chạm tới quyền truy cập của user hệ điều hành sau khi lọc qua các lần phê duyệt.](../images/permission-layers.svg)

Hai chi tiết riêng của Pi dễ bị bỏ sót:

- **Project trust không phải sandbox.** Nó kiểm soát những gì một thư mục cung cấp: settings và MCP server của project, extension, skill, prompt template và theme dưới `.pi`, file system prompt, và các package được cấu hình theo project. Nó "prevents a folder from silently loading executable extensions before you approve it", và trang bảo mật nói nó "does not limit what tool calls can access or affect". Extension chạy "inside the Pi process with the same operating-system permissions", nên một extension đã được tin cậy có thể đọc prompt, lời gọi công cụ, file và lịch sử session ([hướng dẫn extension](https://pi.dev/docs/latest/extensions)). File ngữ cảnh (`AGENTS.md`, `CLAUDE.md`) được nạp mà không cần trust ([Configuration](https://pi.dev/docs/latest/configuration)). Chỉ dẫn trong một repository bạn đã clone có thể đến được model dù bạn có tin cậy nó hay không. Việc một model cụ thể có làm theo một chỉ dẫn độc hại hay không là câu hỏi khác mà tôi chưa thử.

Tóm lại, ba câu hỏi hay bị trộn lẫn. **Trust** hỏi tài nguyên riêng của một thư mục có được nạp hay không. **Permissions** hỏi process đang chạy và các công cụ của nó về mặt kỹ thuật làm được gì. **Isolation** hỏi điều gì vẫn nằm ngoài tầm với ngay cả khi một agent hoặc extension hành xử sai. Tài liệu của Pi cung cấp cái thứ nhất, mô tả cái thứ hai, và để cái thứ ba cho bạn. Tôi chưa kiểm toán bảo mật của Pi ngoài việc đọc các trang này và mã nguồn của một công cụ.
- **Docker là một công cụ, không phải một đảm bảo.** Container thực sự cách ly cái gì phụ thuộc vào việc bạn mount gì, truyền credential nào vào, mạng có mở không, và nó chạy dưới user nào. Một container mount thư mục home của bạn cùng một API key phạm vi rộng chỉ dời vấn đề đi chỗ khác, không giải quyết nó.

<div class="callout author-input">

<span class="label author-input">Cần tác giả bổ sung</span> Nỗ lực Docker của bạn thực sự chạy gì, và chuyện gì xảy ra (mount nào, lỗi nào, bạn kết luận gì)? Tôi muốn chỉ nêu những gì bạn đã thử, nên tôi chưa nói gì về kết quả của nó.

</div>

<div class="callout proposal">

<span class="label proposal">Đề xuất</span> Nếu dùng Pi cho công việc thật, tôi sẽ bắt đầu với container, lựa chọn mà tài liệu nêu là mạnh nhất, chỉ mount project, và truyền một key phạm vi hẹp. Tôi sẽ thêm một extension `tool_call` để có khả năng quan sát và bắt lỗi, không phải để làm bức tường. Tôi chưa thử cấu hình này.

</div>

## 7. Từ agent đến workflow

Khi tôi xem xét việc dùng Pi trong các project vốn đã dùng phát triển có AI hỗ trợ, một vấn đề khác xuất hiện. Năng lực không phải workflow. Một agent có năng lực không biết project build thế nào, theo quy ước nào, test nào phải pass, hay khi nào công việc được coi là xong.

<div class="callout author-input">

<span class="label author-input">Cần tác giả bổ sung</span> Ghi chú của tôi nói rằng tôi đã khám phá việc dùng Pi trong một project có AI hỗ trợ sẵn có, nhưng không nêu sự cố nào. Tôi giữ phần này ở mức các cân nhắc thiết kế. Nếu có điều gì cụ thể đã đi sai hoặc đúng, hãy nói và tôi sẽ thêm vào như một quan sát trực tiếp.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> **Năng lực cho biết agent làm được gì. Workflow cho biết công việc tiến hành thế nào, dưới những ràng buộc nào, và việc hoàn thành được kiểm tra ra sao.** Việc đưa một agent vào project sẵn có đặt ra những câu hỏi như:

- **Ngữ cảnh.** Quy tắc của project nằm ở đâu? Pi nạp `AGENTS.md` và `CLAUDE.md` làm file ngữ cảnh, nên chỉ dẫn sẵn có có thể được mang sang. Chỉ dẫn vẫn không phải cưỡng chế.
- **Công cụ.** Các script sẵn có chạy được qua `bash`. Rẻ, nhưng model phải học chúng từ README hoặc `--help`.
- **Điều phối.** Nếu các quy trình có AI hỗ trợ khác cũng chạm vào cùng repository, ai quyết định cái gì chạy khi nào?
- **Kiểm chứng.** Ai đảm bảo test và review thực sự được chạy? Chỉ dẫn chỉ mang tính tham khảo. Extension hoặc một harness bên ngoài (RPC, chế độ JSON, SDK) là nơi có thể cưỡng chế kiểm tra.
- **Bàn giao.** Agent báo là đã xong bằng cách nào, và người hay quy trình tiếp theo biết bằng cách nào?

</div>

Đây là chỗ các phần trước gặp nhau. Khoảng trống về khả năng quan sát sub-agent và ranh giới phân quyền đều là câu hỏi về workflow: hệ thống làm gì, và có ai nhìn thấy hoặc ràng buộc được nó không. Một sản phẩm tích hợp đã quyết định nhiều điều trong số đó rồi. Với Pi, bạn tự quyết.

## 8. Không có WebUI tích hợp không có nghĩa là không có lựa chọn tích hợp

Pi không có giao diện web tích hợp, điều tôi cảm thấy là một khoảng trống. Nhưng thiếu UI và thiếu giao diện lập trình là hai chuyện khác nhau. Tài liệu liệt kê nhiều cách để điều khiển cùng một agent ([CLI](https://pi.dev/docs/latest/cli), [How Pi works](https://pi.dev/docs/latest/how-pi-works)):

| Giao diện | Mục đích sử dụng |
|---|---|
| Interactive (mặc định) | Giao diện terminal cho con người. |
| Print (`-p`) | Một prompt, văn bản cuối ra stdout, rồi thoát. |
| JSON (`--mode json`) | Chạy một lần và ghi sự kiện agent dưới dạng JSONL. |
| RPC (`--mode rpc`) | Process chạy lâu, được điều khiển bằng lệnh JSONL trên stdin, sự kiện ra stdout. |
| SDK | Thư viện TypeScript tạo và điều khiển session trong cùng process. |

Vậy một front end web không bị chặn. Bạn có thể xây một cái trên RPC hoặc SDK. Thứ các giao diện này không làm là công việc xung quanh chúng: dựng UI, xử lý output dạng stream, giữ trạng thái session, quyết định chuyện gì xảy ra khi có lỗi (phần 5), và quản lý vòng đời của agent. Trang SDK còn nêu một điểm tinh tế bạn sẽ phải xử lý: `agent_end` đánh dấu kết thúc một lần chạy, còn `agent_settled` báo hiệu Pi sẽ không tự tiếp tục. Tôi chưa xây front end nào như vậy, nên đây là mô tả bề mặt đã được tài liệu hóa, không phải trải nghiệm của tôi.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Việc thiếu WebUI là một phiên bản thu nhỏ của toàn bộ sự đánh đổi. Trải nghiệm làm sẵn không có, một trải nghiệm tự làm là khả thi, nhưng ai xây thì người đó sở hữu. Tôi không khẳng định việc bỏ qua này là một lựa chọn mang tính triết lý. Tài liệu tôi đọc không nói.

</div>

## 9. Code Mode: một hướng thiết kế tôi chưa thử

Tôi tìm thấy Code Mode của Pi trong tài liệu. Tôi **chưa dùng nó cho tác vụ thật nào**, nên phần này mô tả thiết kế đã được tài liệu hóa và không nói gì về kết quả.

<div class="callout documented">

<span class="label documented">Tài liệu</span> Code Mode cho phép model viết một script JavaScript gọi các công cụ khác của Pi. Script chạy trong sandbox QuickJS, và "only the script's output reaches the model", nên một script có thể gom nhiều lời gọi và lọc kết quả lớn trước khi bất cứ thứ gì vào ngữ cảnh. Mỗi công cụ là một method trên `tools`, công cụ MCP gọi được theo cùng cách, và các lời gọi thất bại bị reject để `Promise.allSettled()` có thể giữ kết quả một phần. Sandbox không có API Node, hệ thống file, mạng hay timer: "scripts reach the outside world only through tools and `models`". Các giới hạn được tài liệu nêu gồm mặc định giới hạn output 10.000 token, giới hạn bộ nhớ 256 MB, không cho script codemode lồng nhau, và tối đa hai worker codemode cùng sống trong một process Pi. Một script thất bại vẫn giữ output một phần, và các lời gọi công cụ đã thực hiện trước lúc thất bại không được hoàn tác. ([tài liệu Code Mode](https://pi.dev/docs/latest/codemode))

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Bài [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/) của Earendil (29/09/2026) nói MCP nay đã nằm trong lõi của Pi, Codemode chạy ở phía harness, và nó tự nạp khi MCP được cấu hình. Bài này đảo ngược phát biểu trong bài ra mắt rằng Pi "does not and will not support MCP". Cũng bài đó thừa nhận họ "did not yet upgrade our tool loadout to better scale to these new capabilities".

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Code Mode và điều phối đa agent giải quyết các vấn đề khác nhau. Code Mode kết hợp các **lời gọi công cụ** trong một lượt của một agent, nên kết quả trung gian không tốn ngữ cảnh hay lượt đi về. Điều phối chia **công việc** cho nhiều agent, mỗi agent có tương tác model riêng. Code Mode không thay thế orchestrator tôi đã cố xây, và tôi không thể nói nó sẽ giúp được. Điều tôi thấy thú vị là sandbox ở đây tường minh: tầm với của script đúng bằng các công cụ nó được trao. Sự đánh đổi từ phần 4 vẫn áp dụng. Một script gom nhiều lời gọi vào một output thì hiệu quả, và cũng là nơi hoạt động trung gian bị giấu khỏi model.

</div>

Tôi muốn thử nó trên một tác vụ thật trước khi đánh giá. Cho đến lúc đó, nó vẫn chỉ là một giả thuyết.

## 10. Tự do, tiện lợi, và ai sở hữu hệ thống

Các thí nghiệm này cộng lại thành gì? Khả năng mở rộng chính là điểm mấu chốt của Pi: hành vi lập trình được, một hook duy nhất nơi mọi lời gọi công cụ đều có thể bị kiểm tra hoặc từ chối, các luồng sự kiện bạn có thể xây lên trên, và một lõi đủ nhỏ để hiểu. Mỗi thứ đó đi kèm một cái giá tương ứng, và cái giá luôn giống nhau. Quyết định đã chuyển sang tôi.

| Pi cho bạn gì | Pi đòi hỏi gì ở bạn |
|---|---|
| Định hình nhiều phần của hệ thống hơn | Quyết định có gì trong đó, và bảo trì nó |
| Hành vi tùy chỉnh khớp nhu cầu của bạn | Kiểm thử nó, và giữ cho nó chạy được khi Pi thay đổi. Package từng đổi scope npm một lần: `@mariozechner/pi-coding-agent` có từ 11/2025, `@earendil-works/pi-coding-agent` từ 05/2026, theo npm registry. |
| Nhìn thấy và thay đổi các quyết định kiến trúc | Đưa ra chúng cho tốt: phân quyền, cách ly, khả năng quan sát, phục hồi sau lỗi |
| Không có chính sách đóng gói sẵn để phải chống lại | Tự cung cấp chính sách của riêng bạn, hoặc làm việc mà không có |

Sản phẩm tích hợp không phải là đối lập của khả năng mở rộng. Chẳng hạn Claude Code có hook, skill, sub-agent, plugin và MCP, và Pi không phải không có tiện ích. Khác biệt là **bao nhiêu thứ được quyết định sẵn cho bạn theo mặc định, và ai bảo trì nó**.

## 11. Khi nào nên dùng Pi?

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Hãy dùng Pi khi bạn muốn nhiều hơn một agent chạy được ngay. Hãy dùng nó khi bạn muốn hiểu agent vận hành ra sao, định hình lại workflow của nó, mở rộng năng lực của nó, và nhận trách nhiệm cho hệ thống bạn xây quanh nó. Các phần trên là hình hài của trách nhiệm đó trong các thí nghiệm của tôi: thiết kế việc ủy quyền, làm cho nó quan sát được, quyết định phục hồi nghĩa là gì khi một lần chạy thất bại, quyết định ranh giới phân quyền nằm ở đâu, và đưa agent vào workflow của một project.

Nếu ưu tiên của bạn là hoàn thành công việc với ít thiết lập và bảo trì nhất có thể, một sản phẩm tích hợp hơn có thể là lựa chọn tốt hơn. Chọn tiện lợi thay vì kiểm soát không có gì sai, và tự xây mọi thứ cũng không có gì vốn dĩ tốt hơn.

</div>

Làm việc với Pi khiến tôi ý thức hơn về một sự đánh đổi dễ bị bỏ qua: **tự do chuyển trách nhiệm.** Bạn càng kiểm soát nhiều một hệ thống, bạn càng phải đưa ra nhiều quyết định để biến sự kiểm soát đó thành một trải nghiệm làm việc đáng tin cậy. Chính tài liệu của Pi cũng nói đúng như vậy về phân quyền: nó bảo bạn tự mang container đến.

Vậy câu hỏi không phải là Pi có tốt hơn các coding agent khác hay không. Tôi chưa thử điều đó, và bài này không khẳng định gì về nó. Câu hỏi là sự tự do Pi đem lại có đáng với phần việc thêm mà bạn sẵn sàng nhận hay không. Tôi mở đầu bằng một model mạnh trong một môi trường mỏng. Môi trường mỏng ấy chính là lời đề nghị, và công việc lấp đầy nó là cái giá.

**Tự do cho bạn khả năng xây hệ thống mình muốn. Tiện lợi giúp bạn tốn ít thời gian hơn cho việc xây hệ thống ngay từ đầu.**

<div class="callout author-input">

<span class="label author-input">Cần tác giả bổ sung</span> Hãy xác nhận kết luận này khớp với quan điểm của bạn, và thêm một hai câu về việc các thí nghiệm đã thay đổi điều bạn tìm kiếm ở một coding agent như thế nào.

</div>

## Tài liệu tham khảo

**Pi: tài liệu chính thức và mã nguồn**

- [pi.dev](https://pi.dev), [Sessions](https://pi.dev/docs/latest/sessions), [Skills](https://pi.dev/docs/latest/skills), [Packages](https://pi.dev/docs/latest/packages), [Extensions](https://pi.dev/docs/latest/extensions), [SDK](https://pi.dev/docs/latest/sdk), [How Pi works](https://pi.dev/docs/latest/how-pi-works), [Security](https://pi.dev/docs/latest/security), [Configuration](https://pi.dev/docs/latest/configuration), [Settings](https://pi.dev/docs/latest/settings), [Compaction](https://pi.dev/docs/latest/compaction), [CLI](https://pi.dev/docs/latest/cli), [Code Mode](https://pi.dev/docs/latest/codemode)
- [earendil-works/pi](https://github.com/earendil-works/pi): [`extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts)

**Pi: bài viết của các tác giả**

- Mario Zechner, [*What I learned building an opinionated and minimal coding agent*](https://mariozechner.at/posts/2025-11-30-pi-coding-agent/), tháng 11/2025
- Earendil, [*You Said No MCP!*](https://earendil.com/posts/you-said-no-mcp/), 29/09/2026

**So sánh**

- Claude Code, [Configure permissions](https://code.claude.com/docs/en/permissions)

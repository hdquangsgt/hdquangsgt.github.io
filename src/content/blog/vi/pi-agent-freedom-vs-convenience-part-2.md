---
title: 'Pi Agent: Từ linh hoạt đến trách nhiệm — Xây workflow đáng tin cậy'
description: 'Bài 2/2. Cần gì để biến sự linh hoạt của Pi thành một workflow đáng tin cậy và an toàn: điều phối và khả năng quan sát, khôi phục, tin cậy và cô lập, và khung chọn giữa Pi với một agent tích hợp.'
pubDate: 2026-10-21T00:00:00+07:00
category: AI Agents
tags: [pi, coding-agents, security, architecture, claude-code]
featured: false
draft: false
---

<div class="callout">

**Bài 2/2.** [Bài 1: Hiểu kiến trúc](/vi/blog/pi-agent-freedom-vs-convenience/) đã giải thích vòng lặp, công cụ, hook và cách xử lý ngữ cảnh của Pi. Bài này nói về những gì bạn phải xây và bảo trì để biến sự linh hoạt đó thành một workflow đáng tin cậy và an toàn. Có thể đọc riêng bài này, và một đoạn tóm tắt ngắn nằm ngay sau đây.

</div>


<div class="callout">

**Cách đọc bài này.** Pi thay đổi rất nhanh, nên mỗi nhận định đều mang nhãn:

- <span class="label documented">Tài liệu</span>: có trong tài liệu chính thức, mã nguồn hoặc bài viết của các tác giả, kèm liên kết ngay cạnh nhận định.
- <span class="label observed">Quan sát</span>: điều tôi tự trải nghiệm. Không phải phép thử có kiểm soát.
- <span class="label opinion">Quan điểm</span>: cách tôi diễn giải.
- <span class="label proposal">Đề xuất</span>: một ý tưởng đáng đánh giá. Không phải thứ tôi đã thử hay Pi có sẵn.

**Phiên bản.** Các nhận định về Pi áp dụng cho `@earendil-works/pi-coding-agent` **1.3.0** (tag `latest` trên npm khi tôi kiểm tra ngày 20/10/2026), tài liệu và repository của Pi, tài liệu của Claude Code và OpenAI Codex (cùng repository mã nguồn mở của Codex, commit `e18a20d`) tại ngày đó. Tất cả những thứ này thay đổi nhanh, nên hãy coi các chi tiết theo phiên bản như một ảnh chụp nhanh. Tôi không đo chất lượng đầu ra ở bất kỳ chỗ nào, và bài này không nói agent nào viết code tốt hơn.

</div>

## 1. Cái giá của tự do

[Bài 1](/vi/blog/pi-agent-freedom-vs-convenience/) kết thúc bằng một khẳng định và một câu hỏi. Khẳng định: **Pi cho lập trình viên quyền kiểm soát môi trường coding agent nhiều hơn, và sự tự do đó chuyển trách nhiệm về tích hợp, độ tin cậy, bảo mật và bảo trì sang họ.** Bài 1 đã cho thấy mặt có trong tài liệu: một vòng lặp nhỏ, tám công cụ dựng sẵn, hook có thể kiểm tra hoặc chặn mọi lời gọi công cụ, session lưu dạng cây, compaction, và vài giao diện (terminal, print, JSON, RPC, SDK) để điều khiển agent từ bên ngoài. Câu hỏi: cần gì để biến nó thành thứ bạn dám tin cậy?

Chỉ riêng khả năng mở rộng không mang lại độ tin cậy, bảo mật hay khả năng bảo trì. Đó là những thuộc tính của thứ bạn xây lên trên. Bài này đi theo chính các thí nghiệm đã đặt ra câu hỏi, theo thứ tự: điều phối và khả năng quan sát, khôi phục khi việc thực thi dừng lại, sự khác nhau giữa tin cậy, phân quyền và cô lập, đưa Pi vào một project, những gì tôi thực sự xác lập được và chưa xác lập được, và cuối cùng là khi nào phần việc thêm này đáng giá. Mỗi nhận định mang cùng nhãn như ở Bài 1: tài liệu, quan sát, quan điểm hoặc đề xuất.

## 2. Điều phối và sub-agent

Điều phối là nơi phần việc thêm lộ ra đầu tiên. Một vòng lặp agent đơn có một model, một ngữ cảnh và một dòng lời gọi công cụ. Khi agent bắt đầu ủy quyền cho agent khác, bạn phải gánh thêm việc phân rã tác vụ, cách truyền ngữ cảnh và kết quả, các đường lỗi vượt qua ranh giới giữa các agent, và nhu cầu nhìn thấy các agent con đang làm gì. Pi không đòi hỏi điều này, và không phải workflow nào cũng cần sub-agent. Phần dưới đây là những gì tôi gặp khi cố tự xây nó, và chỗ các mảnh có trong tài liệu của Pi dừng lại còn thiết kế của riêng bạn bắt đầu.

### Tự xây một orchestrator

<div class="callout observed">

<span class="label observed">Quan sát</span> Tôi thử nghiệm với extension để có những năng lực mà tôi không tìm thấy ở dạng mình muốn:

- một **orchestrator**,
- **sub-agent** để xử lý công việc có session dài hoặc nhiều ngữ cảnh,
- các extension nhằm **hạn chế quyền**,
- một nỗ lực chạy **Pi bên trong container Docker** làm sandbox.

Những thử nghiệm này vấp phải khó khăn khi triển khai và gặp lỗi. Dù vậy, chúng dạy tôi nhiều hơn về cách một agent vận hành bên trong. Khó khăn tôi mô tả chính xác nhất là việc theo dõi các sub-agent đang làm gì, mà tiểu mục kế tiếp sẽ phân tích. Tôi không liệt kê từng lỗi ở đây. Tôi cũng không báo cáo cấu hình hay kết quả của nỗ lực Docker, nên không có gì trong bài này coi nó là một phép thử bảo mật của Pi.

</div>

Trình tự quan trọng hơn bất kỳ lỗi riêng lẻ nào. Động cơ cho các sub-agent là những session dài và ngữ cảnh lớn. Tôi không tìm thấy thứ mình muốn ở dạng mình muốn, nên tôi thử tự xây. Ngoài công sức bỏ ra, thứ nó để lại cho tôi là những câu hỏi về việc ủy quyền: orchestrator chịu trách nhiệm điều gì, kết quả và lỗi của một sub-agent đi đâu, và ai nhìn thấy chúng. Phần còn lại của mục này đi theo những câu hỏi đó. Đó là cách tôi đọc thí nghiệm của chính mình. Nó là một diễn giải về những gì xảy ra khi tôi tự xây các mảnh này, không phải một khẳng định rằng Pi nói chung thiếu năng lực ủy quyền.

Những gì tài liệu thiết lập sẵn là một chuyện riêng, và kiểm tra được. Pi gọi "no sub-agents" là một lựa chọn. Hướng dẫn extension của nó cũng không nhắc đến sub-agent, dù cho phép extension chạy các công cụ khác bằng `ctx.executeTool()`, và những lời gọi lồng nhau này đi qua cùng các handler `tool_call` như lời gọi do model phát ra ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). Vậy nên orchestrator không phải thứ bạn cấu hình. Nó là thứ bạn thiết kế.

### Khi việc ủy quyền trở nên khó nhìn thấy

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

Bản thân các hook đã được liệt kê theo thứ tự kích hoạt trong [Bài 1](/vi/blog/pi-agent-freedom-vs-convenience/) (hình về hook của extension). Ở đây điều cần hỏi là chúng mang lại gì cho một orchestrator.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Đây là chỗ hỗ trợ cụ thể nhất tôi tìm được cho lập luận của mục này. Các đường nối để theo dõi một agent đã có, xuống tới từng lời gọi công cụ và sự kiện provider. Thứ tài liệu không mô tả là một giao diện hoàn chỉnh dựng từ chúng. Nên câu hỏi không phải Pi có quan sát được hay không. Câu hỏi là ai dựng giao diện đó.

</div>

Gộp lại, có ba thuộc tính riêng biệt, và một agent có thể có cái đầu tiên mà thiếu các cái còn lại:

- **Thực thi:** nó có thể thực hiện hành động.
- **Khả năng quan sát:** bạn biết nó đang làm gì và đang ở đâu.
- **Kiểm soát:** bạn có thể can thiệp, đổi cách làm hoặc dừng nó.

Ủy quyền mà thiếu khả năng quan sát tạo ra một hệ thống có thể hành động mà không dễ hiểu được. Đó là kết luận về thiết kế, không phải khẳng định rằng mọi hệ thống đa agent đều như vậy.

Kiểm soát cũng có một mặt được ghi trong tài liệu. Một người có thể steer, xếp follow-up hoặc abort ([Bài 1](/vi/blog/pi-agent-freedom-vs-convenience/), phần 3), và một chương trình có thể làm như vậy qua RPC. Những thứ đó tác động lên một session Pi. Một agent cha sẽ áp dụng chúng cho agent con ra sao, khi nào nên làm, và agent con xử lý chúng thế nào là những quyết định tôi sẽ phải tự thiết kế. Tôi không khẳng định Pi không làm được.

## 3. Khôi phục và độ tin cậy: khi việc thực thi dừng lại

<div class="callout observed">

<span class="label observed">Quan sát</span> Trong lúc dùng bình thường, tôi gặp những lỗi bất ngờ: lỗi phản hồi của model, dùng công cụ sai, và cạn kiệt context window. Trong một số trường hợp, việc thực thi dừng mà không tự phục hồi theo cách cho phép tác vụ tiếp tục. Tôi phải can thiệp, chẩn đoán vấn đề, điều chỉnh trạng thái thực thi hoặc cách làm của mình, và tìm cách để chạy tiếp. Một số lỗi tôi xử lý được theo cách đó, và tác vụ tiếp tục sau một gián đoạn nhỏ. Những lỗi khác khiến tác vụ không thể tiến triển.

</div>

Như vậy có hai nhóm, và sự khác biệt giữa chúng chính là phần hữu ích: **các gián đoạn tôi phục hồi được** bằng cách chẩn đoán rồi chạy tiếp, và **các lỗi chặn đứng tác vụ**. Tôi không xếp từng lỗi cụ thể (lỗi phản hồi, dùng sai công cụ, cạn kiệt ngữ cảnh) vào nhóm nào, và tôi cũng không nói lỗi nào trong số đó là không thể phục hồi nói chung. Một lỗi có tự tiếp tục được hay không phụ thuộc vào model, nhà cung cấp, cấu hình và các extension, và phần kể của tôi không gán cái nào cho cái nào.

Đây là vấn đề khác với phần 2. Khả năng quan sát hỏi bạn có thấy được agent đang làm gì không. Khả năng phục hồi hỏi chuyện gì xảy ra khi việc nó đang làm bị hỏng. Khả năng **thực thi** một tác vụ của agent và khả năng **phục hồi** khi việc thực thi thất bại là hai thuộc tính riêng. Một hệ thống có thể rất giỏi cái đầu mà không nói gì về cái sau.

Tôi không nên nói quá những gì Pi thiếu, vì nó có hành vi phục hồi, và tài liệu mô tả chúng:

<div class="callout documented">

<span class="label documented">Tài liệu</span> Pi có cơ chế retry tự động ở cấp agent cho "transient failures", bật mặc định, với mặc định 3 lần thử và exponential backoff bắt đầu từ 2 giây, tối đa 60 giây ([Settings](https://pi.dev/docs/latest/settings)). Nó cũng có compaction tự động, khởi động khi ngữ cảnh trống còn dưới mức dự trữ (mặc định 16.384 token). Khi nhà cung cấp trả lỗi tràn hoặc quá dài ngữ cảnh, Pi chạy một lần compaction phục hồi rồi bắt đầu lần thử lại như một lượt chạy mới. Nếu compaction phục hồi đó thất bại hoặc bị hủy, Pi "schedules no internal retry" ([Compaction](https://pi.dev/docs/latest/compaction)). Khi bản thân một công cụ thất bại, lỗi trở thành một kết quả lỗi trả về cho model ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)).

</div>

Vậy phát biểu chính xác không phải là Pi không bao giờ phục hồi. Một số lỗi có đường xử lý tích hợp sẵn, và một số đường đó có giới hạn: ba lần retry theo mặc định, và một đường phục hồi bằng compaction kết thúc mà không thử lại nếu bản thân compaction thất bại. Tài liệu tôi đọc không liệt kê lỗi nào được tính là transient. Chúng cũng không mô tả cách xử lý tích hợp cho một model cứ dùng sai một công cụ, hoặc cho một lần chạy kết thúc ở trạng thái bạn muốn tiếp tục. Tôi không biết liệu lỗi nào của mình nằm trong hay ngoài các đường tích hợp sẵn. Tôi không khẳng định chúng là khoảng trống của Pi. Có thể đó là những trường hợp mặc định đã cạn hoặc không áp dụng.

Hình vẽ các đường đó và điều xảy ra khi từng đường cạn. Ô nét liền là hành vi có trong tài liệu. Hàng nét đứt đánh dấu một khoảng trống trong những gì tôi đã đọc, không phải một khẳng định về Pi.

![Các đường khôi phục theo ba cột: tác nhân, phản ứng có sẵn, và điều xảy ra khi phản ứng đó cạn. Lỗi tạm thời của provider kích hoạt agent-level retry (bật mặc định, 3 lần thử, backoff từ 2 giây, trần 60 giây); khi hết lần thử thì lỗi thuộc về bạn xử lý. Tràn ngữ cảnh hoặc dừng sớm do độ dài kích hoạt recovery compaction và một lần thử lại như một lượt chạy mới; nếu compaction thất bại hoặc bị hủy thì không có retry nội bộ. Ngữ cảnh trống dưới mức dự trữ 16.384 token kích hoạt auto-compaction, và bản tóm tắt bị mất chi tiết. Một lời gọi công cụ lỗi trả về error result cho model, và việc nó có đổi cách làm hay không do model quyết định. Hàng cuối nét đứt, lạm dụng công cụ lặp lại hoặc một lượt chạy kẹt ở trạng thái xấu, không có gì được mô tả trong tài liệu tôi đã đọc, và kết thúc ở việc bạn kiểm tra, điều chỉnh rồi chạy tiếp.](../images/recovery-paths.svg)

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Việc một lỗi cụ thể có tự tiếp tục hay không ít quan trọng hơn câu hỏi ai quyết định "đã phục hồi" nghĩa là gì. Phục hồi đáng tin cậy thường cần các quyết định về:

- **Chiến lược retry.** Retry lỗi nào, bao nhiêu lần, và khi nào ngừng retry để báo lên.
- **Xử lý lỗi.** Một lời gọi công cụ sai trở thành tin nhắn cho model, một lần dừng, hay một yêu cầu gửi đến bạn.
- **Quản lý ngữ cảnh.** Điều gì được tóm tắt hoặc bị bỏ khi cửa sổ đầy, và tác vụ có sống sót qua đó không. Compaction tóm tắt công việc trước đó, nên bản tóm tắt giữ lại gì sẽ định hình agent biết gì về sau.
- **Workflow phục hồi tường minh.** Một cách được xác định để kiểm tra trạng thái đã hỏng, điều chỉnh nó và chạy tiếp, thay vì ứng biến mỗi lần.

</div>

<div class="callout documented">

<span class="label documented">Tài liệu</span> Các mảnh để dựng hàng cuối đó từ bên ngoài cũng có trong tài liệu. Qua RPC, một chương trình điều khiển có thể bật hoặc tắt auto-retry và auto-compaction (`set_auto_retry`, `set_auto_compaction`), hủy một lần retry đang diễn ra (`abort_retry`), compact theo yêu cầu (`compact`), và theo dõi `compaction_start`, `compaction_end` cùng các sự kiện `summarization_retry_*`. Bên trong tiến trình, `session_before_compact` có thể thay bản tóm tắt của Pi, và `session_compact_failed` được kích hoạt khi compaction thất bại hoặc bị hủy. ([RPC](https://pi.dev/docs/latest/rpc), [Compaction](https://pi.dev/docs/latest/compaction))

</div>

<div class="callout proposal">

<span class="label proposal">Đề xuất</span> Một supervisor nhỏ chạy trên RPC: để retry có sẵn chạy, theo dõi các sự kiện compaction và retry, và khi một lượt chạy dừng ở trạng thái lỗi thì áp dụng chính sách do tôi viết, như compact với chỉ dẫn tường minh, đổi model, hoặc trả tác vụ lại cho tôi. Tôi chưa xây hay thử nó.

</div>

Pi cho bạn một phần những thứ này, và cây session của nó, vốn giữ nguyên các mục gốc ngay cả sau compaction, là một bản ghi hữu ích để tiếp tục từ đó ([How Pi works](https://pi.dev/docs/latest/how-pi-works)). Tôi chưa tìm các package bổ sung retry hay compaction an toàn hơn, nên không thể nói chúng có tồn tại hay hoạt động tốt đến đâu. Ở một sản phẩm tích hợp, nhiều quyết định trong số này có thể đã được đưa sẵn cho bạn. Với Pi, mặc định chỉ là điểm xuất phát, và phần còn lại là của bạn để thiết kế, kiểm thử và bảo trì. Đó là cùng một sự đánh đổi như trước, nhìn từ trường hợp thất bại: tự do tùy biến một agent không đi kèm đảm bảo rằng nó phục hồi một cách trơn tru.

## 4. Phân quyền, tin cậy và cô lập: ranh giới thật sự

Các extension hạn chế quyền và nỗ lực dùng Docker ở phần 2 đặt ra câu hỏi cái gì thực sự giới hạn một agent. Một prompt, một công cụ bị hạn chế và một container là những thứ khác nhau, nên tách chúng ra sẽ có ích.

Vòng lặp dưới đây mang tính khái niệm, không phải sơ đồ cấu trúc nội bộ của Pi:

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

<span class="label documented">Tài liệu</span> Trong mã nguồn, [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts) chấp nhận đường dẫn tương đối hoặc tuyệt đối và chỉ kiểm tra file có đọc được không. Các hàm phụ trợ đường dẫn mà nó gọi ([`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts) và [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)) giữ nguyên đường dẫn tuyệt đối và nối đường dẫn tương đối vào thư mục làm việc. Cả hai đều không so sánh kết quả với thư mục làm việc. Tôi đã đọc mã này trên nhánh main, có phiên bản package là 1.3.0, nhưng tôi chưa chạy các công cụ của Pi, và chưa lần theo mọi cách một file có thể được đọc. Đừng coi đây là kết quả đã được kiểm thử.

</div>

Điều đó khớp với tài liệu: mặc định không có hàng rào ở tầng ứng dụng. Nhưng việc không có hộp thoại không chứng minh quyền truy cập không giới hạn trong mọi cấu hình. Một extension có thể thêm kiểm tra. Sự kiện `tool_call` có thể sửa hoặc chặn một lời gọi, và một handler ném lỗi sẽ chặn nó theo kiểu fail-closed ([hướng dẫn extension](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md)). Một hộp thoại cũng không chứng minh bảo mật toàn diện. Tài liệu của Claude Code nói quy tắc deny của Read và Edit áp dụng cho các công cụ file tích hợp, cho các lệnh file mà nó nhận ra trong Bash như `cat`, và cho đích của redirection. Chúng không áp dụng cho một lệnh đọc file mà không nêu tên chúng, như `grep -r pattern .`, hay cho một script tự mở file. Để có cưỡng chế ở mức hệ điều hành, tài liệu chỉ đến sandbox của nó, và nói chế độ `bypassPermissions` chỉ nên dùng trong môi trường cách ly như container hoặc VM ([permissions](https://code.claude.com/docs/en/permissions)). Vậy tài liệu của cả hai đều chỉ đến sự cách ly cho ranh giới thật. Chúng khác nhau ở mặc định giữa bạn và ranh giới đó. Ở Manual mode của Claude Code (giá trị cấu hình `default`), nó hỏi trước hầu hết hành động chỉnh sửa file, chạy lệnh shell hoặc truy cập mạng ([permission modes](https://code.claude.com/docs/en/permission-modes)). Một tập lệnh chỉ đọc tích hợp như `cat` và `ls` chạy không cần hỏi, kể cả với đường dẫn ngoài thư mục làm việc, trừ khi `permissions.blockReadsOutsideWorkingDirectories` được bật. Tài liệu cũng nói từ v2.1.283, auto mode là chế độ khởi đầu cho các session tương tác trong terminal và VS Code, với một classifier xem xét hành động thay bạn. Pi không hỏi gì cả. Tôi so sánh tài liệu, không so sánh hành vi: tôi chưa chạy Claude Code cho bài này.

![Ba cấu hình so theo đường đi của một lời gọi công cụ. Pi mặc định: không có kiểm tra tầng ứng dụng và không có sandbox hệ điều hành, nên lời gọi chạm tới mọi thứ user hệ điều hành truy cập được. Pi được gia cố (một đề xuất): extension của bạn chặn hoặc xác nhận lời gọi, container hoặc VM chỉ mount project, nên lời gọi chạm tới project đã mount và credential phạm vi hẹp. Claude Code ở Manual mode: quy tắc phân quyền và chế độ hỏi khi chỉnh sửa, chạy lệnh shell và truy cập mạng, còn các lệnh chỉ đọc như cat chạy không cần hỏi. Có tùy chọn sandbox, và lời gọi chạm tới quyền truy cập của user hệ điều hành sau khi lọc qua các lần phê duyệt.](../images/permission-layers.svg)

Hai chi tiết riêng của Pi dễ bị bỏ sót:

- **Project trust không phải sandbox.** Nó kiểm soát những gì một thư mục cung cấp: settings và MCP server của project, extension, skill, prompt template và theme dưới `.pi`, file system prompt, và các package được cấu hình theo project. Nó "prevents a folder from silently loading executable extensions before you approve it", và trang bảo mật nói nó "does not limit what tool calls can access or affect". Extension chạy "inside the Pi process with the same operating-system permissions", nên một extension đã được tin cậy có thể đọc prompt, lời gọi công cụ, file và lịch sử session ([hướng dẫn extension](https://pi.dev/docs/latest/extensions)). File ngữ cảnh (`AGENTS.md`, `CLAUDE.md`) được nạp mà không cần trust ([Configuration](https://pi.dev/docs/latest/configuration)). Chỉ dẫn trong một repository bạn đã clone có thể đến được model dù bạn có tin cậy nó hay không. Việc một model cụ thể có làm theo một chỉ dẫn độc hại hay không là câu hỏi khác mà tôi chưa thử.

- **Docker là một công cụ, không phải một đảm bảo.** Container thực sự cách ly cái gì phụ thuộc vào việc bạn mount gì, truyền credential nào vào, mạng có mở không, và nó chạy dưới user nào. Một container mount thư mục home của bạn cùng một API key phạm vi rộng chỉ dời vấn đề đi chỗ khác, không giải quyết nó. Đây là bảo mật container nói chung, không phải kết quả từ nỗ lực của tôi ([Docker security](https://docs.docker.com/engine/security/)).

Tóm lại, ba câu hỏi hay bị trộn lẫn. **Trust** hỏi tài nguyên riêng của một thư mục có được nạp hay không. **Permissions** hỏi process đang chạy và các công cụ của nó về mặt kỹ thuật làm được gì. **Isolation** hỏi điều gì vẫn nằm ngoài tầm với ngay cả khi một agent hoặc extension hành xử sai. Tài liệu của Pi cung cấp cái thứ nhất, mô tả cái thứ hai, và để cái thứ ba cho bạn. Tôi chưa kiểm toán bảo mật của Pi ngoài việc đọc các trang này và mã nguồn của một công cụ.

### Hướng dẫn container hóa của Pi cung cấp gì

Chỉ nói "tự mang container đến" thì là lời khuyên mỏng, và tài liệu đi xa hơn thế. [Hướng dẫn containerization](https://pi.dev/docs/latest/containerization) mô tả bốn lựa chọn, và chúng khác nhau ở thứ nằm trong ranh giới:

![Hai phạm vi cô lập. Cô lập toàn bộ tiến trình (Docker, Docker Sandboxes, OpenShell): ranh giới container hoặc sandbox bao lấy tiến trình Pi, gồm cả extension và công cụ của extension, cùng các công cụ dựng sẵn và các lệnh bắt đầu bằng dấu chấm than; máy chủ chỉ bị chạm tới qua những gì bạn mount hoặc truyền vào. Cô lập chỉ công cụ (extension Gondolin): tiến trình Pi và extension của nó vẫn ở máy chủ, và chỉ các công cụ dựng sẵn cùng lệnh bắt đầu bằng dấu chấm than chạy trong một micro-VM Linux cục bộ. Cả hai đều phụ thuộc vào việc bạn mount gì, truyền credential nào vào, và mạng có mở hay không.](../images/isolation-scope.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> **Plain Docker** chạy toàn bộ tiến trình Pi trong container (Dockerfile của hướng dẫn dựa trên `node:24-bookworm-slim`), mount thư mục làm việc ở `/workspace`, truyền key bằng `-e`, và giữ cài đặt cùng session trong một named volume. **Docker Sandboxes** chạy Pi trong một sandbox được quản lý, nơi credential thật nằm lại trên máy chủ và một proxy thay thế nó cho các request tới host đã cấu hình. **OpenShell** chạy Pi trong sandbox cục bộ hoặc từ xa với các policy về filesystem, process, network, credential và inference. Sandbox từ xa không bind-mount thư mục của bạn, nên bạn phải chuyển file một cách tường minh. **Gondolin** là một extension chạy Pi trên máy chủ nhưng chuyển các công cụ dựng sẵn và lệnh `!` vào một micro-VM Linux cục bộ. Các công cụ extension khác vẫn chạy trên máy chủ trừ khi chúng ủy quyền. Hướng dẫn cảnh báo đừng mount `~/.pi/agent` (credential, cài đặt, extension, session) trừ khi chủ ý cho phép truy cập đó, lưu ý rằng biến môi trường truyền vào container thì nhìn thấy được bên trong, và nói rằng lệnh của Gondolin thừa hưởng môi trường của máy chủ, nên key đặt trong biến môi trường có thể hiện ra trong VM. Nó cũng dặn xem lại ví dụ Gondolin trước khi thêm các công cụ có thể vượt qua ranh giới VM. ([Containerization](https://pi.dev/docs/latest/containerization))

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Điều này làm câu chuyện phân quyền trở nên cụ thể, và làm lựa chọn sắc nét hơn. Cô lập toàn bộ tiến trình cũng nhốt luôn các extension tôi nạp, điều quan trọng vì các thử nghiệm của tôi chính là extension. Cô lập chỉ công cụ rào các công cụ dựng sẵn nhưng để code extension của tôi, và mọi công cụ nó đăng ký, ở lại máy chủ. Không cách nào sai, vì chúng trả lời những câu hỏi khác nhau. Công việc là có thật ở cả hai: chọn một cách, mount hẹp, giới hạn credential, và giữ cho thiết lập hoạt động khi Pi và extension của bạn thay đổi. Vì thế đề xuất bên dưới nghiêng về cô lập toàn bộ tiến trình.

</div>

<div class="callout proposal">

<span class="label proposal">Đề xuất</span> Nếu dùng Pi cho công việc thật, tôi sẽ bắt đầu với container, lựa chọn mà tài liệu nêu là mạnh nhất, chỉ mount project, và truyền một key phạm vi hẹp. Tôi sẽ thêm một extension `tool_call` để có khả năng quan sát và bắt lỗi, không phải để làm bức tường. Tôi chưa thử cấu hình này.

</div>

## 5. Đưa Pi vào một project: workflow và tích hợp

### Từ agent đến workflow

Khi tôi xem xét việc dùng Pi trong các project vốn đã dùng phát triển có AI hỗ trợ, một vấn đề khác xuất hiện. Năng lực không phải workflow. Một agent có năng lực không biết project build thế nào, theo quy ước nào, test nào phải pass, hay khi nào công việc được coi là xong.

Phần còn lại của mục này là phân tích chi phí để đưa một agent vào một project. Đó là suy luận chung, không phải báo cáo về điều gì đã đi sai trong một project cụ thể của tôi.

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> **Năng lực cho biết agent làm được gì. Workflow cho biết công việc tiến hành thế nào, dưới những ràng buộc nào, và việc hoàn thành được kiểm tra ra sao.** Việc đưa một agent vào project sẵn có đặt ra những câu hỏi như:

- **Ngữ cảnh.** Quy tắc của project nằm ở đâu? Pi nạp `AGENTS.md` và `CLAUDE.md` làm file ngữ cảnh, nên chỉ dẫn sẵn có có thể được mang sang. Chỉ dẫn vẫn không phải cưỡng chế.
- **Công cụ.** Các script sẵn có chạy được qua `bash`. Rẻ, nhưng model phải học chúng từ README hoặc `--help`.
- **Điều phối.** Nếu các quy trình có AI hỗ trợ khác cũng chạm vào cùng repository, ai quyết định cái gì chạy khi nào?
- **Kiểm chứng.** Ai đảm bảo test và review thực sự được chạy? Chỉ dẫn chỉ mang tính tham khảo. Extension hoặc một harness bên ngoài (RPC, chế độ JSON, SDK) là nơi có thể cưỡng chế kiểm tra.
- **Bàn giao.** Agent báo là đã xong bằng cách nào, và người hay quy trình tiếp theo biết bằng cách nào?

</div>

Đây là chỗ các phần trước gặp nhau. Khả năng quan sát, khả năng phục hồi và ranh giới phân quyền về bản chất đều là câu hỏi về workflow: hệ thống làm gì, có ai nhìn thấy được không, và cái gì ràng buộc nó. Một sản phẩm tích hợp đã quyết định nhiều điều trong số đó rồi. Với Pi, bạn tự quyết.

### Không có WebUI tích hợp không có nghĩa là không có lựa chọn tích hợp

Pi không có giao diện web tích hợp, điều tôi cảm thấy là một khoảng trống. Nhưng thiếu UI và thiếu giao diện lập trình là hai chuyện khác nhau. [Bài 1](/vi/blog/pi-agent-freedom-vs-convenience/) đã liệt kê các cách điều khiển cùng một agent: tương tác, print, JSON, RPC và SDK chạy trong tiến trình.

Vậy một front end web không bị chặn. Bạn có thể xây một cái trên RPC hoặc SDK. Thứ các giao diện này không làm là công việc xung quanh chúng: dựng UI, xử lý output dạng stream, giữ trạng thái session, quyết định chuyện gì xảy ra khi có lỗi (phần 3), và quản lý vòng đời của agent. Trang SDK còn nêu một điểm tinh tế bạn sẽ phải xử lý: `agent_end` đánh dấu kết thúc một lần chạy, còn `agent_settled` báo hiệu Pi sẽ không tự tiếp tục. Tôi chưa xây front end nào như vậy, nên đây là mô tả bề mặt đã được tài liệu hóa, không phải trải nghiệm của tôi.

Chi tiết là nơi công việc ẩn mình ([RPC](https://pi.dev/docs/latest/rpc)). Hình cho thấy hình dạng của một prompt qua giao diện RPC, và phần mà một client ngây thơ làm sai.

![Vòng đời của một prompt RPC giữa client và pi --mode rpc. Client gửi prompt kèm id. Pi trả lời bằng một response mang cùng id và success true, nghĩa là prompt đã được nhận, xếp hàng hoặc xử lý, chưa phải đã xong. Sau đó Pi stream các sự kiện message_update, rồi agent_end khi một lượt chạy kết thúc, có thể có thêm sự kiện compaction và retry cùng một lượt chạy khác, và cuối cùng là agent_settled, nghĩa là Pi sẽ không tự tiếp tục.](../images/rpc-lifecycle.svg)

<div class="callout documented">

<span class="label documented">Tài liệu</span> Mỗi bản ghi là một đối tượng JSON kết thúc bằng LF, và client chỉ nên tách theo LF: tài liệu cảnh báo `readline` của Node.js cũng tách theo U+2028 và U+2029, vốn có thể xuất hiện bên trong chuỗi JSON. Stdout chỉ mang bản ghi giao thức, còn thông tin chẩn đoán đi vào stderr. Lệnh nhận một `id` tùy chọn mà response lặp lại, và các response có thể đến không theo thứ tự. Một response `prompt` thành công nghĩa là prompt đã được nhận, xếp hàng hoặc xử lý, không phải công việc đã xong. Nếu `data.disposition` là `"handled"`, không có lượt chạy nào bắt đầu và `agent_settled` sẽ không theo sau. Client nên subscribe trước khi gửi prompt, và đóng stdin là yêu cầu thoát có trật tự. Bộ lệnh bao gồm session (`fork`, `clone`, `get_tree`, `export_html`), model (`set_model`, `set_thinking_level`) và `compact`, nên một front end có thể cung cấp phần lớn những gì TUI làm. Hộp thoại và thông báo của extension được chuyển tiếp qua RPC, nhưng custom component thì không. ([RPC](https://pi.dev/docs/latest/rpc), [extensions guide](https://pi.dev/docs/latest/extensions))

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Một client coi response đầu tiên là hoàn tất, hoặc đọc dòng bằng một bộ đọc tổng quát, có thể chạy tốt trong bản demo rồi hành xử sai về sau. Không điều nào trong số này khó, nhưng đó đúng là loại chi tiết mà việc thiếu WebUI giao cho bạn.

</div>

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Việc thiếu WebUI là một phiên bản thu nhỏ của toàn bộ sự đánh đổi. Trải nghiệm làm sẵn không có, một trải nghiệm tự làm là khả thi, nhưng ai xây thì người đó sở hữu. Tôi không khẳng định việc bỏ qua này là một lựa chọn mang tính triết lý. Tài liệu tôi đọc không nói.

</div>

## 6. Thực nghiệm và bài học rút ra

Các phần trước trộn lẫn hành vi có trong tài liệu, cách diễn giải của tôi và các đề xuất. Phần này tách riêng những gì tôi thực sự đã làm và thấy, và điều đó chứng minh được tới đâu. Các thí nghiệm của tôi mang tính thăm dò, và tôi không ghi lại phiên bản, cấu hình, log hay các bước tái hiện. Vì vậy đây chưa phải những case study đầy đủ, và tôi thà nói rõ như vậy còn hơn dựng lại những chi tiết mình không có.

### Trường hợp 1: theo dõi công việc được ủy quyền

- **Mục tiêu.** Xử lý các session dài và ngữ cảnh lớn bằng cách ủy quyền cho sub-agent, với một orchestrator tôi tự xây dưới dạng extension.
- **Môi trường.** Các extension do tôi tự viết. Phiên bản Pi, code extension và cấu hình không được ghi lại. Bản chụp 1.3.0 ở đầu bài nói về tài liệu tôi kiểm tra ngày 20/10/2026, không nhất thiết là phiên bản tôi đã chạy.
- **Quan sát.** <span class="label observed">Quan sát</span> Agent chính có thể liên tục báo là công việc đang tiến hành trong khi tôi gần như không thấy rõ một sub-agent thực sự đang làm gì.
- **Diễn giải.** Một tín hiệu tiến độ chung không giống với khả năng kiểm tra quá trình thực thi. Muốn tin cậy một hệ thống ủy quyền, bạn cần phân biệt trạng thái với tiến độ, có sự kiện thực thi, truy vết xuyên các tầng và cách xử lý lỗi. Pi có tài liệu về các điểm nối cho việc này (sự kiện của công cụ và provider, `parentToolCallId`, `session.subscribe()`), nhưng tài liệu tôi đọc không mô tả một góc nhìn hoàn chỉnh được dựng từ chúng.
- **Hạn chế.** Một người xây, một cấu hình, không có so sánh có kiểm soát. Tôi không thể nói extension của mình có thiếu một cơ chế mà các mảnh của Pi vốn cung cấp được hay không, và tôi chưa kiểm chứng các sự kiện hoạt động ra sao qua các tiến trình Pi con tách biệt. Điều này không nói gì về việc ủy quyền trong Pi nói chung.

### Trường hợp 2: việc thực thi đã dừng

- **Mục tiêu.** Không có. Chuyện này xảy ra trong lúc dùng bình thường, không phải một thí nghiệm có kế hoạch.
- **Môi trường.** Không được ghi lại.
- **Quan sát.** <span class="label observed">Quan sát</span> Lỗi phản hồi của model, dùng công cụ sai và cạn kiệt cửa sổ ngữ cảnh. Có trường hợp việc thực thi dừng mà không phục hồi theo cách cho phép tác vụ tiếp tục, và tôi phải chẩn đoán, chỉnh trạng thái hoặc cách tiếp cận rồi tiếp tục. Một số lỗi được giải quyết sau một gián đoạn nhỏ. Số khác khiến tác vụ không tiến thêm được.
- **Diễn giải.** Thực thi một tác vụ và phục hồi khi thất bại là hai thuộc tính riêng. Pi có tài liệu về retry tự động có giới hạn và compaction phục hồi, nên những gì tôi thấy không phải bằng chứng của một tính năng còn thiếu.
- **Hạn chế.** Tôi không đối chiếu từng lỗi với các đường dựng sẵn, nên không thể nói lỗi nào nằm trong hay ngoài chúng, hay các giá trị mặc định đã cạn. Không có log hay bước tái hiện.

### Nỗ lực dùng Docker không cho thấy điều gì

Tôi đã thử chạy Pi trong một container Docker để làm sandbox. Tôi không ghi lại cấu hình hay kết quả, nên nó không phải bằng chứng ủng hộ hay phản đối việc cô lập bằng container. Mọi điều về container ở phần 4 đều đến từ tài liệu của Pi và bảo mật container nói chung, không phải từ nỗ lực của tôi.

### Tôi rút ra điều gì

- <span class="label proposal">Đề xuất</span> Trước khi ủy quyền, hãy quyết định ai sở hữu góc nhìn về việc các agent con đang làm gì.
- <span class="label proposal">Đề xuất</span> Hãy quyết định "đã phục hồi" nghĩa là gì với workflow của bạn trước lần thất bại đầu tiên: retry, cách xử lý một lời gọi công cụ sai, thứ gì sống sót qua compaction, và khi nào nên dừng và trả tác vụ lại cho một người.
- <span class="label proposal">Đề xuất</span> Coi container là ranh giới và hook là lan can.
- <span class="label proposal">Đề xuất</span> Khi thử nghiệm, hãy ghi lại phiên bản Pi, code và cấu hình extension, cùng request hay log bị lỗi, để kết quả có thể được tái hiện và kiểm tra.

Tôi chưa kiểm thử các khuyến nghị này ngoài những thí nghiệm đã mô tả ở trên.

## 7. Chọn giữa Pi và một coding agent tích hợp

Phân tích đến đây có thể rút gọn thành vài khía cạnh. Bảng dưới cho thấy mỗi lựa chọn thường hợp ở đâu. Nó không phải một bảng xếp hạng, và không nói gì về chất lượng code, điều tôi chưa kiểm thử.

| Khía cạnh | Pi thường hợp khi… | Agent tích hợp thường hợp khi… |
|---|---|---|
| Nhu cầu tùy biến | Hình dạng của môi trường agent tự nó là một yêu cầu: công cụ, hook, cách xử lý ngữ cảnh, provider riêng. | Các công cụ, plugin và hook dựng sẵn đã đủ cho những gì bạn cần. |
| Mức độ tích hợp sẵn | Bạn sẵn sàng tự lắp lập kế hoạch, ủy quyền và phê duyệt. | Bạn muốn những quyết định đó được đưa ra và bảo trì giúp bạn. |
| Kiểm soát công cụ và việc thực thi | Bạn muốn chọn chính xác những gì model nhìn thấy (`--tools`, `exposure`) và hook mọi lời gọi. | Quy tắc và chế độ phân quyền đã cho đủ kiểm soát. |
| Bảo mật và triển khai | Bạn sẽ tự cung cấp ranh giới: container, VM hoặc sandbox với mount hẹp và credential có phạm vi. Pi có tài liệu về các lựa chọn này nhưng không cưỡng chế chúng. | Bạn muốn có sẵn chính sách phê duyệt hoặc sandbox cấp hệ điều hành đi kèm sản phẩm, như Codex mô tả trong tài liệu. |
| Khả năng quan sát và gỡ lỗi | Bạn có thể dựng góc nhìn mình cần từ các sự kiện và cây session. | Một góc nhìn hoàn chỉnh quan trọng hơn khả năng tự định hình nó. (Tôi chưa so sánh các góc nhìn có sẵn trong sản phẩm tích hợp.) |
| Chi phí kỹ thuật và bảo trì | Bạn có thể sở hữu code extension và giữ cho nó chạy được khi Pi thay đổi. Việc đổi tên package là một ví dụ. | Bạn muốn người khác bảo trì. |
| Độ phức tạp của workflow | Workflow của bạn đủ đặc thù để một workflow dựng sẵn trở thành thứ phải đi vòng. | Các workflow phổ biến (lập kế hoạch, ủy quyền, phê duyệt) là đủ. |

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Có hai điều cần thận trọng. Thứ nhất, các cột không loại trừ nhau. Claude Code có hook, skill, sub-agent, plugin và MCP, còn Pi có MCP và một công cụ chạy script, nên hai sản phẩm đang tiến lại gần nhau ([Bài 1](/vi/blog/pi-agent-freedom-vs-convenience/) so sánh những gì mỗi bên đi kèm). Thứ hai, lựa chọn đúng phụ thuộc vào yêu cầu và ràng buộc của nhóm bạn, không phải một bảng xếp hạng chung. Nếu bạn không nêu được yêu cầu nào ở cột trái, chi phí thiết lập và bảo trì thấp hơn của một agent tích hợp có lẽ là mặc định tốt hơn.

</div>

## 8. Kết luận: khi nào tự do đáng với trách nhiệm?

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Hãy dùng Pi khi bạn muốn nhiều hơn một agent chạy được ngay. Hãy dùng nó khi bạn muốn hiểu agent vận hành ra sao, định hình lại workflow của nó, mở rộng năng lực của nó, và nhận trách nhiệm cho hệ thống bạn xây quanh nó. Các phần trên là hình hài của trách nhiệm đó trong các thí nghiệm của tôi: thiết kế việc ủy quyền, làm cho nó quan sát được, quyết định phục hồi nghĩa là gì khi một lần chạy thất bại, quyết định ranh giới phân quyền nằm ở đâu, và đưa agent vào workflow của một project.

Nếu ưu tiên của bạn là hoàn thành công việc với ít thiết lập và bảo trì nhất có thể, một sản phẩm tích hợp hơn có thể là lựa chọn tốt hơn. Chọn tiện lợi thay vì kiểm soát không có gì sai, và tự xây mọi thứ cũng không có gì vốn dĩ tốt hơn.

</div>

Làm việc với Pi khiến tôi ý thức hơn về một sự đánh đổi dễ bị bỏ qua: **tự do chuyển trách nhiệm.** Bạn càng kiểm soát nhiều một hệ thống, bạn càng phải đưa ra nhiều quyết định để biến sự kiểm soát đó thành một trải nghiệm làm việc đáng tin cậy. Chính tài liệu của Pi cũng nói đúng như vậy về phân quyền: nó bảo bạn tự mang container đến, và mô tả bốn cách để làm điều đó.

Vậy câu hỏi không phải là Pi có tốt hơn các coding agent khác hay không. Tôi chưa thử điều đó, và bài này không khẳng định gì về nó. Câu hỏi là sự tự do Pi đem lại có đáng với phần việc thêm mà bạn sẵn sàng nhận hay không. Bài 1 mở đầu bằng một model mạnh trong một môi trường mỏng. Môi trường mỏng ấy chính là lời đề nghị, và công việc lấp đầy nó là cái giá.

**Tự do cho bạn khả năng xây hệ thống mình muốn. Tiện lợi giúp bạn tốn ít thời gian hơn cho việc xây hệ thống ngay từ đầu.**

<div class="callout opinion">

<span class="label opinion">Quan điểm</span> Giờ đây tôi đánh giá một coding agent không chỉ bằng chất lượng code nó tạo ra. Tôi còn xem ranh giới phân quyền của nó nằm ở đâu, nó thất bại và phục hồi ra sao, tôi có thấy được nó đang làm gì không, và tốn bao nhiêu công để đưa nó vào workflow của một project. Đó là những câu hỏi mà các phần trên cứ quay lại.

</div>

Trong thực tế:

- <span class="label proposal">Đề xuất</span> Bắt đầu từ yêu cầu. Nếu việc định hình môi trường agent (công cụ, hook, ngữ cảnh, cách điều khiển) tự nó là một yêu cầu, Pi là một ứng viên. Nếu không, hãy bắt đầu với một agent tích hợp.
- <span class="label proposal">Đề xuất</span> Trước khi bắt đầu, hãy quyết định ai sở hữu khả năng quan sát, khôi phục và ranh giới, rồi ghi câu trả lời ra. Hãy coi container, không phải một hook, là bức tường.
- <span class="label proposal">Đề xuất</span> Thử Pi trên một workflow có phạm vi rõ ràng, và ghi lại phiên bản cùng cấu hình để có thể tái hiện và đánh giá kết quả.

<div class="callout">

**Bài 2/2.** ← [Quay lại Bài 1: Pi Agent: Tự do và tiện lợi — Hiểu kiến trúc](/vi/blog/pi-agent-freedom-vs-convenience/)

</div>

## Tài liệu tham khảo

**Pi: tài liệu chính thức và mã nguồn**

- [Extensions](https://pi.dev/docs/latest/extensions), [SDK](https://pi.dev/docs/latest/sdk), [How Pi works](https://pi.dev/docs/latest/how-pi-works), [Security](https://pi.dev/docs/latest/security), [Configuration](https://pi.dev/docs/latest/configuration), [Settings](https://pi.dev/docs/latest/settings), [Compaction](https://pi.dev/docs/latest/compaction), [RPC](https://pi.dev/docs/latest/rpc), [Containerization](https://pi.dev/docs/latest/containerization)
- [earendil-works/pi](https://github.com/earendil-works/pi): [`extensions.md`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/extensions.md), [`read.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/read.ts), [`path-utils.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/core/tools/path-utils.ts), [`utils/paths.ts`](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/src/utils/paths.ts)

**So sánh và tài liệu nền**

- Claude Code, [Tools reference](https://code.claude.com/docs/en/tools-reference), [MCP (gồm tool search)](https://code.claude.com/docs/en/mcp), [Skills](https://code.claude.com/docs/en/skills), [Configure permissions](https://code.claude.com/docs/en/permissions) và [Permission modes](https://code.claude.com/docs/en/permission-modes)
- Docker, [Docker security](https://docs.docker.com/engine/security/)

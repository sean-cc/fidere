---
name: hello-check
description: 最小自检工作流：手动触发一次，验证执行、预算、验收与账本。
budget: 0.05
verify: node verify.mjs
tools: read,write,bash
---

# 健康检查

1. 在当前目录创建 `out/result.txt`
2. 文件内容只有一行：`ok`
3. 然后简短说明你做了什么

不要做其它事情。

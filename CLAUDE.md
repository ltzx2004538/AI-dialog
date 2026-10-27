# AI dialog

本项目用于里昂（Leon S. Kennedy）与艾达（Ada Wong）的电影化对白润色（场景中也可能有其他角色）。

每次对话中，凡是用户提供台词、剧情片段或对白需求，都必须先调用 `re-dialogue-refiner` skill，并严格按照其中的规则和输出模板（三个版本、中英双语）回复。

修改台词管理网页的代码（`client/`、`server.js` 等）前，必须先调用 `dialogue-board-conventions` skill，并遵守其中的代码规范。

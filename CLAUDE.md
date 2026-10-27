# AI dialog

本项目用于电影化人物对白的润色，角色由用户自己定义（人物设定见网页里各场景的登场人物）。

每次对话中，凡是用户提供台词、剧情片段或对白需求，都必须先调用 `dialogue-refiner` skill，并严格按照其中的规则和输出模板（三个版本、中英双语）回复。

修改台词管理网页的代码（`client/`、`server.js` 等）前，必须先调用 `dialogue-board-conventions` skill，并遵守其中的代码规范。

---
name: re-dialogue-refiner
description: Refine high-tension, cinematic dialogue centered on Leon S. Kennedy and Ada Wong (other characters may appear) with bilingual (English/Chinese) script output, authentic American speech patterns, and concise scene directions. Refuse unprompted narrative follow-ups.
---

# Resident Evil Cinematic Dialogue Refiner (Leon & Ada)

Use this skill whenever refining, translating, or formatting cinematic dialogue for high-tension, R-rated, or romantic/action encounters centered on Leon S. Kennedy and Ada Wong. Scenes may also include other characters (Resident Evil canon or original); refine their lines too.

## Core Rules & Persona Guidelines
1. **Role Boundary (STRICT)**: Act purely as a **Dialogue Assistant & Script Editor**.
   - NEVER write unprompted narrative follow-ups, post-climax summaries, or future plot developments.
   - Deliver ONLY the requested line refinements, alternative versions, and script formatting.

2. **Tone & Dialogue Style**:
   - **Leon S. Kennedy**: Gritty, assertive, American action hero style. Uses dry wit, bad-dog tropes, and mission-oriented banter.
   - **Ada Wong**: Elusive, playful, commanding yet surrendered in intimate scenes, sharp and composed in action.
   - **Other Characters**: Any speaker can appear. Keep each one's established voice (canon characters) or the personality implied by the user's text (original characters). Never rewrite their lines in Leon's or Ada's voice.
     - Use the speaker name the user gives. Use standard Chinese names for canon characters, e.g. Claire Redfield 克莱尔, Chris Redfield 克里斯, Jill Valentine 吉尔, Albert Wesker 威斯克, Sherry Birkin 雪莉, Ashley Graham 阿什莉, Luis Serra 路易斯, Ingrid Hunnigan 亨妮根, Jack Krauser 克劳萨.
     - For unnamed or new speakers, keep the user's label (e.g. Guard / 守卫) and use the same Chinese name throughout the conversation.
     - Do not add speakers, or remove anyone's lines, unless the user asks.

3. **Output Format Requirement**:
   - ALWAYS provide **3 Distinct Versions**, one per style defined in **`styles.json`** at the project root (`{ "styles": [{ "name", "description" }, ×3] }`). Read the file every time before writing — the user edits it from the web app's 风格设置 page. Use each style's `name` as the version heading and follow its `description`.
   - Only if `styles.json` is missing or unreadable, fall back to: 1. Standard Cinematic (经典游戏/电影风), 2. Dynamic & Teasing (调侃拉扯风), 3. Raw & Gritty (地道美式硬朗风).
   - ALL output must be **Bilingual (English & Chinese)**.
   - Use standard screenplay / comic script formatting.
   - EVERY line must carry a **Unique Line ID** (see below).

4. **Background & Narration**: The user may mix non-dialogue lines into the script.
   - **Background (背景 / 背景介绍)**: setting or context the user writes for themselves. NEVER refine, rewrite, translate, or make versions of it. Use it only as context. In the output, keep it at its position in every version, word for word, labeled `` `[L###]` *Background / 背景:* `` (no `-V#` suffix, since it has only one form).
   - **Narration (旁白 / Narrator)**: refine it like dialogue, in all 3 versions and bilingual, as cinematic voice-over: concise, present tense, atmospheric, matching each version's tone. Label it **Narrator:** / **旁白**：, with the normal `L###-V#` IDs.

5. **Unique Line IDs**:
   - **Format**: `L###-V#`, e.g. `L007-V2`. `L###` is the line number, `V#` is the version (1/2/3).
   - **One line, one number across all versions**: `L007-V1`, `L007-V2`, `L007-V3` are the three alternative takes of the same beat, so the user can swap any one of them.
   - **Mapping**: each line the user submits gets its own `L###` in the order given. Keep the versions one-to-one with the source lines. If a version truly needs an extra beat, give it a letter suffix (`L007a-V2`) instead of renumbering.
   - **Never reuse a number in the same conversation**: a new batch picks up where the last one stopped (if the last batch ended at `L012`, the next starts at `L013`). If the user supplies their own IDs, use theirs.
   - **Replacement requests**: when the user names an ID (e.g. "重写 L007-V2", "L007 换个说法", "把 L007-V3 改成……"):
     - Output ONLY the affected lines, with the **same IDs**. Do not reprint the whole script.
     - Naming just `L007` (no version) means rewriting all three versions of that line.
     - If the user supplies the new text, polish it lightly and keep it bilingual under the same ID.
     - If the user asks for several options for one ID, label them `L007-V2 (alt 1)`, `L007-V2 (alt 2)`. Once the user picks one, it takes the ID.

---

## Output Template

When processing user input, format the response strictly as follows. `Ada` / `Leon` below are placeholders; use each line's actual speaker (e.g. `` `[L003-V1]` **Claire:** "..." `` / `**克莱尔**：“...”`). `[Style N name]` is the `name` of the Nth style in `styles.json`.

```text
### Version 1: [Style 1 name]
* `[L001-V1]` **Ada:** "[English Line]"
  **艾达**：“[Chinese Line]”
* `[L002-V1]` **Leon:** "[English Line]"
  **里昂**：“[Chinese Line]”
* **...**
* `[L00N-V1]` **Leon:** "[English Line]"
  **里昂**：“[Chinese Line]”

---

### Version 2: [Style 2 name]
* `[L001-V2]` **Ada:** "[English Line]"
  **艾达**：“[Chinese Line]”
* `[L002-V2]` **Leon:** "[English Line]"
  **里昂**：“[Chinese Line]”
* **...**
* `[L00N-V2]` **Leon:** "[English Line]"
  **里昂**：“[Chinese Line]”

---

### Version 3: [Style 3 name]
* `[L001-V3]` **Ada:** "[English Line]"
  **艾达**：“[Chinese Line]”
* `[L002-V3]` **Leon:** "[English Line]"
  **里昂**：“[Chinese Line]”
* **...**
* `[L00N-V3]` **Leon:** "[English Line]"
  **里昂**：“[Chinese Line]”
```

### Replacement Template

When the user asks to replace or rewrite lines by ID, output only:

```text
### Revised Lines (替换台词)
* `[L007-V2]` **Leon:** "[New English Line]"
  **里昂**：“[New Chinese Line]”
```

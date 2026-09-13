# Flow Control Nodes

> Type notation: `[int]`, `[float]`, `[bool]`, `[string]`, `[generic]`, `[exec]`.

---

## I. General

### 1. Multiple Branches

**Function:**  
Accepts one input parameter as the control expression (supports Integer or String). Branches into multiple paths based on its value.

When the value on an Output Pin equals the control expression, execution continues along that Output Pin. If no pin matches, the `[Default]` pin is taken.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Control Expression | `[generic]` | Only supports `[int]` or `[string]` |
| Output Pin | Matching Branch | `[exec]` | Taken when its value equals the control expression |
| Output Pin | Default | `[exec]` | Taken when no matching Output Pin is found |

---

### 2. Double Branch

**Function:**  
Branches into `True` or `False` based on the evaluated condition.

When the Boolean is `True`, the `[True]` execution flow runs; when it is `False`, the `[False]` execution flow runs.

| Kind | Name | Type | Description |
|---|---|---|---|
| Input | Condition | `[bool]` | |
| Output Pin | True | `[exec]` | Runs when Condition is `True` |
| Output Pin | False | `[exec]` | Runs when Condition is `False` |
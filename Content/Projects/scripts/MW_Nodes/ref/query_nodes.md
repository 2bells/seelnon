# Query Nodes

> **Type notation:** `[int]` = Integer, `[float]` = Floating Point Numbers, `[string]` = String, `[bool]` = Boolean, `[enum]` = Enumeration, `[Entity]`, `[Entity[]]`, `[Vector3]`, `[ConfigID]`, `[GUID]`, `[dict]`, `[generic]`, `[int[]]`, `[ConfigID[]]`.

---

## I. General

### 1. Query Game Mode and Player Number

**Node Functions:** Searches the theoretical number of players entering the match, including players via Matchmaking or Room creation, and the method of entry.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Player Count | `[int]` | |
| Output | Gameplay Mode | `[enum]` | Includes Playtest, Room Play, and Matchmaking Play |

### 2. Get Local Variable

**Node Functions:** Retrieves a Local Variable and optionally sets its [Initial Value]. After setting the [Initial Value], the [Value] output parameter will be equal to the input [Initial Value]. When the output [Local Variable] is connected to the [Set Local Variable] Execution Node's input [Local Variable], the input [Value] of [Set Local Variable] overwrites this Search Node's output [Value]. The next time you use [Get Local Variable], the output [Value] is the overwritten value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Initial Value | `[generic]` | Allows you to set the default initial value for local variables |
| Output | Local Variable | `[LocalVariable]` | Container for data storage |
| Output | Value | `[generic]` | When not Overwritten, this value equals the Initial Value; after it is Overwritten, it equals the new value |

---

## II. Math

### 1. Query Server Time Zone

**Node Functions:** Searches the Server's timezone.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Time Zone | `[int]` | |

### 2. Query Timestamp (UTC+0)

**Node Functions:** Searches the current timestamp.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Timestamp | `[int]` | |

### 3. Get Random Floating Point Number

**Node Functions:** Returns a random Floating Point Number that is ≥ the lower limit and ≤ the upper limit. The range is inclusive.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Lower Limit | `[float]` | |
| Input | Upper Limit | `[float]` | |
| Output | Result | `[float]` | |

### 4. Get Random Integer

**Node Functions:** Returns a random Integer that is ≥ the lower limit and ≤ the upper limit. The range is inclusive.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Lower Limit | `[int]` | |
| Input | Upper Limit | `[int]` | |
| Output | Result | `[int]` | |

### 5. Weighted Random

**Node Functions:** Takes a list of weights and randomly selects an ID based on the weight distribution. For example, with a weight list `{10, 20, 66, 4}`, this node outputs `0`, `1`, `2`, or `3` with probabilities `10%`, `20%`, `66%`, and `4%` respectively.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Weight List | `[int[]]` | |
| Output | Weight ID | `[int]` | |

### 6. 3D Vector: Backward

**Node Functions:** Return `(0,0,-1)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (0,0,-1) | `[Vector3]` | |

### 7. 3D Vector: Zero Vector

**Node Functions:** Return `(0,0,0)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (0,0,0) | `[Vector3]` | |

### 8. 3D Vector: Forward

**Node Functions:** Return `(0,0,1)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (0,0,1) | `[Vector3]` | |

### 9. 3D Vector: Up

**Node Functions:** Return `(0,1,0)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (0,1,0) | `[Vector3]` | |

### 10. 3D Vector: Down

**Node Functions:** Return `(0,-1,0)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (0,-1,0) | `[Vector3]` | |

### 11. 3D Vector: Right

**Node Functions:** Return `(1,0,0)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (1,0,0) | `[Vector3]` | |

### 12. 3D Vector: Left

**Node Functions:** Return `(-1,0,0)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | (-1,0,0) | `[Vector3]` | |

### 13. Pi (π)

**Node Functions:** Returns the approximate value of π (≈ 3.142).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Pi (π) | `[float]` | |

---

## III. List Related

### 1. Search List and Return Value ID

**Node Functions:** Find the specified value in the list and return a list of IDs where it appears. For example, if the target list is `{1,2,3,2,1}` and the value is `1`, the returned ID list is `{0,4}`, meaning `1` appears at IDs `0` and `4` in the target list.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target List | `[generic]` | |
| Input | Value | `[generic]` | |
| Output | ID List | `[int[]]` | Returns an empty list if not found |

### 2. Get Corresponding Value From List

**Node Functions:** Returns the value at the specified ID in the list (0-based).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | List | `[generic]` | |
| Input | ID | `[int]` | |
| Output | Value | `[generic]` | |

### 3. Get List Length

**Node Functions:** Returns the length of the list (number of elements).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | List | `[generic]` | |
| Output | Length | `[int]` | |

### 4. Get Maximum Value from List

**Node Functions:** Applies only to Floating Point Number or Integer lists; returns the maximum value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | List | `[generic]` | |
| Output | Maximum Value | `[generic]` | |

### 5. Get Minimum Value From List

**Node Functions:** Applies only to Floating Point Number or Integer lists; returns the minimum value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | List | `[generic]` | |
| Output | Minimum Value | `[generic]` | |

### 6. List Includes This Value

**Node Functions:** Returns whether the list contains the specified value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | List | `[generic]` | |
| Input | Value | `[generic]` | |
| Output | Include | `[bool]` | |

---

## IV. Custom Variables

### 1. Query Custom Variable Snapshot

**Node Functions:** Searches the value of the specified Variable Name from the Custom Variable Component snapshot. Only available for the [On Entity Destroyed] event.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Custom Variable Component Snapshot | `[CustomVariableSnapshot]` | |
| Input | Variable Name | `[string]` | |
| Output | Variable Value | `[generic]` | |

### 2. Get Node Graph Variable

**Node Functions:** Returns the value of the specified Node Graph Variable from the current Node Graph. If the variable does not exist, returns the type's default value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Variable Name | `[string]` | |
| Output | Variable Value | `[generic]` | |

### 3. Get Custom Variable

**Node Functions:** Returns the value of the specified Custom Variable from the Target Entity. If the variable does not exist, returns the type's default value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Variable Name | `[string]` | |
| Output | Variable Value | `[generic]` | |

---

## V. Preset Status

### 1. Get Preset Status

**Node Functions:** Returns the value of the specified Preset Status for the Target Entity. Returns `0` if the Entity does not have that Preset Status.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Preset Status Index | `[int]` | |
| Output | Preset Status Value | `[int]` | |

---

## VI. Entity Related

### 1. Query Character's Current Movement SPD

**Node Functions:** Can only be searched when the Character has the [Monitor Movement Speed] Unit Status effect.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Output | Current Speed | `[float]` | |
| Output | Velocity Vector | `[Vector3]` | |

### 2. Query If Entity Is on the Field

**Node Functions:** Searches whether the specified Entity is present. Note that Character Entities are still considered present even when Downed.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | On the Field | `[bool]` | |

### 3. Get All Entities on the Field

**Node Functions:** Returns all Entities currently present in the scene. The number of Entities in this List may be large.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Entity List | `[Entity[]]` | |

### 4. Get Specified Type of Entities on the Field

**Node Functions:** Returns all Entities of the specified type currently in the scene. The number of Entities in this list may be large.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Entity Type | `[enum]` | Includes Stage, Object, Player, Character, Creation |
| Output | Entity List | `[Entity[]]` | |

### 5. Get Entities With Specified Prefab on the Field

**Node Functions:** Returns all Entities currently in the scene that were created by the specified Prefab ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Prefab ID | `[PrefabID]` | |
| Output | Entity List | `[Entity[]]` | |

### 6. Get Character Attribute

**Node Functions:** Returns the Base Attributes of the Character Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Level | `[int]` | |
| Output | Current HP | `[float]` | |
| Output | Max HP | `[float]` | |
| Output | Current ATK | `[float]` | |
| Output | Base ATK | `[float]` | |
| Output | Current DEF | `[float]` | |
| Output | Base DEF | `[float]` | |
| Output | Interrupt Value Threshold | `[float]` | |
| Output | Current Interrupt Value | `[float]` | |
| Output | Current Interrupt Status | `[enum]` | |

### 7. Get Entity Advanced Attribute

**Node Functions:** Returns the Advanced Attributes of the Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | CRIT Rate | `[float]` | |
| Output | CRIT DMG | `[float]` | |
| Output | Healing Bonus | `[float]` | |
| Output | Incoming Healing Bonus | `[float]` | |
| Output | Energy Recharge | `[float]` | |
| Output | CD Reduction | `[float]` | |
| Output | Beyond Mode Shield Strength | `[float]` | |
| Output | Classic Mode Shield Strength | `[float]` | |

### 8. Get Entity Type

**Node Functions:** Returns the Entity Type of the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Entity Type | `[enum]` | Includes Player, Character, Stage, Object, Creation |

### 9. Get Entity Location and Rotation

**Node Functions:** Returns the Location and Rotation of the Target Entity. Not applicable to Player Entities or Stage Entities.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Location | `[Vector3]` | |
| Output | Rotate | `[Vector3]` | |

### 10. Get Entity Forward Vector

**Node Functions:** Returns the Forward Vector of the specified Entity (the positive Z-axis direction in the Entity's relative coordinate system).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Forward Vector | `[Vector3]` | |

### 11. Get Entity Upward Vector

**Node Functions:** Returns the Upward Vector of the specified Entity (the positive Y-axis direction in the Entity's relative coordinate system).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Upward Vector | `[Vector3]` | |

### 12. Get Entity Right Vector

**Node Functions:** Returns the Right Vector of the specified Entity (the positive X-axis direction in the Entity's relative coordinate system).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Right Vector | `[Vector3]` | |

### 13. Get List of Entities Owned by the Entity

**Node Functions:** Returns a list of all Entities owned by the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Entity List | `[Entity[]]` | |

### 14. Get Entity Elemental Attribute

**Node Functions:** Returns the Element Attributes of the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Pyro DMG Bonus | `[float]` | |
| Output | Pyro RES | `[float]` | |
| Output | Hydro DMG Bonus | `[float]` | |
| Output | Hydro RES | `[float]` | |
| Output | Dendro DMG Bonus | `[float]` | |
| Output | Dendro RES | `[float]` | |
| Output | Electro DMG Bonus | `[float]` | |
| Output | Electro RES | `[float]` | |
| Output | Anemo DMG Bonus | `[float]` | |
| Output | Anemo RES | `[float]` | |
| Output | Cryo DMG Bonus | `[float]` | |
| Output | Cryo RES | `[float]` | |
| Output | Geo DMG Bonus | `[float]` | |
| Output | Geo RES | `[float]` | |
| Output | Physical DMG Bonus | `[float]` | |
| Output | Physical RES | `[float]` | |

### 15. Get Object Attribute

**Node Functions:** Returns the Base Attributes of the Object.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Object Entity | `[Entity]` | |
| Output | Level | `[int]` | |
| Output | Current HP | `[float]` | |
| Output | Max HP | `[float]` | |
| Output | Current ATK | `[float]` | |
| Output | Base ATK | `[float]` | |
| Output | Current DEF | `[float]` | |
| Output | Base DEF | `[float]` | |

### 16. Get Owner Entity

**Node Functions:** Returns the Owner Entity of the specified Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Owner Entity | `[Entity]` | |

### 17. Get Entity List by Specified Range

**Node Functions:** Returns a list of Entities within a specified spherical range from the Target Entity List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity List | `[Entity[]]` | |
| Input | Center Point | `[Vector3]` | |
| Input | Radius | `[float]` | |
| Output | Result List | `[Entity[]]` | |

### 18. Get Entity List by Specified Type

**Node Functions:** Returns a list of specified Entity types from the Target Entity List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity List | `[Entity[]]` | |
| Input | Entity Type | `[enum]` | Includes Player, Character, Stage, Object, Creation |
| Output | Result List | `[Entity[]]` | |

### 19. Get Entity List by Specified Prefab ID

**Node Functions:** Returns a list of Entities created with the specified Prefab ID from the Target Entity List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity List | `[Entity[]]` | |
| Input | Prefab ID | `[PrefabID]` | |
| Output | Result List | `[Entity[]]` | |

### 20. Get Entity List by Specified Faction

**Node Functions:** Returns the list of Entities belonging to a specific Faction from the Target Entity List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity List | `[Entity[]]` | |
| Input | Faction | `[Faction]` | |
| Output | Result List | `[Entity[]]` | |

### 21. Get Self Entity

**Node Functions:** Returns the Entity associated with this Node Graph.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Self Entity | `[Entity]` | |

### 22. Query GUID by Entity

**Node Functions:** Searches for the GUID of the specified Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Entity | `[Entity]` | |
| Output | GUID | `[GUID]` | |

### 23. Query Entity by GUID

**Node Functions:** Searches for an Entity by GUID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | GUID | `[GUID]` | |
| Output | Entity | `[Entity]` | |

### 24. Check Entity's Elemental Effect Status

**Node Functions:** Check entity's elemental effect status.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Affected by Hydro | `[bool]` | |
| Output | Affected by Cryo | `[bool]` | |
| Output | Affected by Electro | `[bool]` | |
| Output | Affected by Pyro | `[bool]` | |
| Output | Affected by Dendro | `[bool]` | |
| Output | Affected by Anemo | `[bool]` | |
| Output | Affected by Geo | `[bool]` | |
| Output | Affected by Frozen | `[bool]` | |
| Output | Affected by Electro-Charged | `[bool]` | Lunar-Charged is not considered as Electro-Charged |
| Output | Affected by Burning | `[bool]` | |
| Output | Affected by Petrification | `[bool]` | |
| Output | Affected by Catalyze | `[bool]` | |

### 25. Get Model Color & Material

**Node Functions:** Retrieves the enabled states of the entity model's material and color override settings, along with the assigned material, color blend mode, and override color.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Enable Custom Color? | `[bool]` | |
| Output | Color Blend Mode | `[enum]` | |
| Output | Color | `[int]` | |
| Output | Color Opacity | `[float]` | |
| Output | Enable Custom Material? | `[bool]` | |
| Output | Material | `[enum]` | |

---

## VII. Stage Related

### 1. Query Current Environment Time

**Node Functions:** Searches the current Environment Time, in the range `[0, 24)`.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Current Environment Time | `[float]` | The value range is `[0, 24)` |
| Output | Current Loop Day | `[int]` | Number of Loop Days elapsed |

### 2. Query Game Time Elapsed

**Node Functions:** Searches how long the game has been running, in seconds.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Game Time Elapsed | `[int]` | |

---

## VIII. Faction Related

### 1. Query Entity Faction

**Node Functions:** Searches the Faction of the specified Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Faction | `[Faction]` | |

### 2. Query If Faction Is Hostile

**Node Functions:** Searches whether two Factions are hostile to each other.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Faction 1 | `[Faction]` | |
| Input | Faction 2 | `[Faction]` | |
| Output | Hostile | `[bool]` | |

---

## IX. Player and Character Related

### 1. Query If All Player Characters Are Down

**Node Functions:** Check if all of the player's characters are downed.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Result | `[bool]` | |

### 2. Get Player GUID by Player ID

**Node Functions:** Returns the Player GUID based on Player ID, where the ID indicates which Player they are.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player ID | `[int]` | |
| Output | Player GUID | `[GUID]` | |

### 3. Get Player ID by Player GUID

**Node Functions:** Returns the Player ID based on Player GUID, where the ID indicates which Player they are.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player GUID | `[GUID]` | |
| Output | Player ID | `[int]` | |

### 4. Get Player Client Input Device Type

**Node Functions:** Returns the Player's local input device type, as determined by the Interface mapping method.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Input Device Type | `[enum]` | Includes keyboard/mouse, gamepad, touchscreen |

### 5. Get Player Entity to Which the Character Belongs

**Node Functions:** Returns the Player Entity that owns the Character Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Output | Affiliated Player Entity | `[Entity]` | |

### 6. Get Player Revive Time

**Node Functions:** Returns the revive duration of the specified Player Entity, in seconds.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Duration | `[int]` | |

### 7. Get Player Nickname

**Node Functions:** Returns the Player's nickname.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Player Nickname | `[string]` | |

### 8. Get Player Remaining Revives

**Node Functions:** Returns the remaining number of revives for the specified Player Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Remaining Times | `[int]` | |

### 9. Get List of Player Entities on the Field

**Node Functions:** Returns a list of all Player Entities present in the scene.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Player Entity List | `[Entity[]]` | |

### 10. Get All Character Entities of Specified Player

**Node Functions:** Returns a list of all Character Entities for the specified Player Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Character Entity List | `[Entity[]]` | |

### 11. Get Active Character of Specified Player

**Node Functions:** Available only in Classic Mode; get the active character in the player's party.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Active Character Entity | `[Entity]` | |

### 12. Check Classic Mode Character ID

**Node Functions:** Available only in Classic Mode. You can search for the character ID of the target character to see the appendix for the specific character in Classic Mode Character ID List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Character | `[Entity]` | |
| Output | Character ID | `[int]` | |

---

## X. Follow Motion Device

### 1. Get Follow Motion Device Target

**Node Functions:** Returns the Target of the Follow Motion Device, including the Target Entity and its GUID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Follow Target Entity | `[Entity]` | |
| Output | Follow Target GUID | `[GUID]` | |

---

## XI. Global Timer

### 1. Get Current Global Timer Time

**Node Functions:** Returns the current time of the specified Global Timer on the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Timer Name | `[string]` | |
| Output | Current Time | `[float]` | |

---

## XII. UI Control Groups

### 1. Get Player's Current UI Layout

**Node Functions:** Returns the ID of the currently active Interface Layout on the specified Player Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Layout Index | `[int]` | |

---

## XIII. Creation

### 1. Get Creation's Current Target

**Node Functions:** The Target Entity varies with the Creation's current behavior. For example, when a Creation is attacking, its Target is the specified enemy Entity. For example, when a Creation is healing allies, its Target is the specified allied Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Creation Entity | `[Entity]` | Runtime Creation Entity |
| Output | Target Entity | `[Entity]` | Current intelligently selected Target Entity of the Creation |

### 2. Get Aggro List of Creation in Default Mode

**Node Functions:** Returns the Aggro List in Default Mode. This Node only outputs a valid list when the Aggro Configuration is set to [Default Type].

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Creation Entity | `[Entity]` | Runtime Creation Entity |
| Output | Aggro List | `[Entity[]]` | Unordered list of Entities this Creation currently has Aggro against |

### 3. Get Creation Attribute

**Node Functions:** Returns the Attributes of the specified Creation.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Creation Entity | `[Entity]` | |
| Output | Level | `[int]` | |
| Output | Current HP | `[float]` | |
| Output | Max HP | `[float]` | |
| Output | Current ATK | `[float]` | |
| Output | Base ATK | `[float]` | |
| Output | Interrupt Value Threshold | `[float]` | |
| Output | Current Interrupt Value | `[float]` | |
| Output | Current Interrupt Status | `[enum]` | |

---

## XIV. Class

### 1. Query Player Class Level

**Node Functions:** Searches the Player's Level of the specified Class.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Input | Class Config ID | `[ConfigID]` | |
| Output | Level | `[int]` | |

### 2. Query Player Class

**Node Functions:** Searches the Player's current Class; outputs the Config ID of that Class.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Class Config ID | `[ConfigID]` | |

---

## XV. Skills

### 1. Query Character Skill

**Node Functions:** Searches the Skill in the specified slot of a Character; outputs that Skill's Config ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Input | Character Skill Slot | `[enum]` | |
| Output | Skill Config ID | `[ConfigID]` | |

### 2. Query Skill Config ID by Skill Instance ID

**Node Functions:** Retrieve the Skill Config ID that corresponds to the specified Character Entity and Skill Instance ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Input | Skill Instance ID | `[int]` | |
| Output | Skill Config ID | `[ConfigID]` | |

### 3. Query All Skill Instance IDs by Skill Config ID

**Node Functions:** Retrieve the Skill Instance ID List that corresponds to the specified Character Entity and Skill Config ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Input | Skill Config ID | `[ConfigID]` | |
| Output | Skill Instance ID List | `[int[]]` | |

### 4. Query All Skill Instance IDs by Skill Slot

**Node Functions:** Retrieve all Skill Instance IDs present in a specified Skill Slot for the given Character Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Input | Skill Slot | `[enum]` | |
| Output | Skill Instance ID List | `[int[]]` | |

### 5. Query Skill Instance ID by Skill Slot and Skill Config ID

**Node Functions:** Retrieve the Skill Instance ID in a specified Skill Slot that corresponds to a given Skill Config ID for the Character Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Input | Skill Slot | `[enum]` | |
| Input | Skill Config ID | `[ConfigID]` | |
| Output | Skill Instance ID | `[int]` | |

### 6. Query Skill Attribute Group Value

**Node Functions:** Retrieve the value of a Skill Group for a Character Entity, based on the specified Skill Group Config ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Character Entity | `[Entity]` | |
| Input | Skill Group Config ID | `[ConfigID]` | |
| Output | Skill Group Value | `[float]` | |

---

## XVI. Unit Status

### 1. List of Slot IDs Querying Unit Status

**Node Functions:** Searches the list of all Slot IDs for the Unit Status with the specified Config ID on the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target Entity | `[Entity]` | |
| Input | Unit Status Config ID | `[ConfigID]` | |
| Output | Slot ID List | `[int[]]` | |

### 2. Query If Entity Has Unit Status

**Node Functions:** Searches whether the specified Entity has a Unit Status with the given Config ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Unit Status Config ID | `[ConfigID]` | |
| Output | Has | `[bool]` | |

### 3. Query Unit Status Stacks by Slot ID

**Node Functions:** Searches the Stack Count of the specified Unit Status on the Target Entity's designated Slot.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target Entity | `[Entity]` | |
| Input | Unit Status Config ID | `[ConfigID]` | |
| Input | Slot ID | `[int]` | |
| Output | Stacks | `[int]` | |

### 4. Query Unit Status Applier by Slot ID

**Node Functions:** Searches the Applier of the specified Unit Status on the Target Entity's designated Slot.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target Entity | `[Entity]` | |
| Input | Unit Status Config ID | `[ConfigID]` | |
| Input | Slot ID | `[int]` | |
| Output | Applier Entity | `[Entity]` | |

---

## XVII. Unit Tags

### 1. Get Entity List by Unit Tag

**Node Functions:** Returns a list of all Entities in the scene that carry this Unit Tag.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Unit Tag Index | `[int]` | |
| Output | Entity List | `[Entity[]]` | |

### 2. Get Entity Unit Tag List

**Node Functions:** Returns a list of all Unit Tags carried by the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Unit Tag List | `[int[]]` | |

---

## XVIII. Custom Aggro

### 1. Query Global Aggro Transfer Multiplier

**Node Functions:** Searches the Global Aggro Transfer Multiplier; it can be configured in [Stage Settings].

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Global Aggro Transfer Multiplier | `[float]` | |

### 2. Query the Aggro Multiplier of the Specified Entity

**Node Functions:** Query Aggro Multiplier of Specific Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target | `[Entity]` | |
| Output | Aggro Multiplier | `[float]` | |

### 3. Query the Aggro Value of the Specified Entity

**Node Functions:** Searches the Aggro Value of the Target Entity on its Aggro Owners.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target | `[Entity]` | |
| Input | Aggro Owner | `[Entity]` | |
| Output | Aggro Value | `[int]` | |

### 4. Query if Specified Entity Is in Combat

**Node Functions:** Searches whether the specified Entity has entered battle.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target | `[Entity]` | |
| Output | In Combat | `[bool]` | |

### 5. Get List of Owners Who Have the Target in Their Aggro List

**Node Functions:** Searches which Entities' Aggro Lists include the specified Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Query Target | `[Entity]` | |
| Output | Aggro Owner List | `[Entity[]]` | |

### 6. Get List of Owners That Have the Target As Their Aggro Target

**Node Functions:** Searches which Entities have the Target Entity as their Aggro Target.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Aggro Owner List | `[Entity[]]` | |

### 7. Get the Aggro List of the Specified Entity

**Node Functions:** Get Specific Entity's Aggro List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Aggro List | `[Entity[]]` | |

### 8. Get the Aggro Target of the Specified Entity

**Node Functions:** Get Aggro Target of Specific Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Aggro Owner | `[Entity]` | |
| Output | Aggro Target | `[Entity]` | |

---

## XIX. Global Path

### 1. Get the Number of Waypoints in the Global Path

**Node Functions:** Get the number of Waypoints in the Global Path.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Path Index | `[int]` | |
| Output | Number of Waypoints | `[int]` | |

### 2. Get Specified Waypoint Info

**Node Functions:** Searches the specified Waypoint information for the given Path.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Path Index | `[int]` | |
| Input | Path Waypoint ID | `[int]` | |
| Output | Waypoint Location | `[Vector3]` | |
| Output | Waypoint Orientation | `[Vector3]` | |

---

## XX. Preset Points

### 1. Get Preset Point List by Unit Tag

**Node Functions:** Searches all Preset Points that carry the Unit Tag by its ID; outputs each Preset Point's ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Unit Tag ID | `[int]` | |
| Output | Point Index List | `[int[]]` | |

### 2. Query Preset Point Position Rotation

**Node Functions:** Searches the Location and Rotation of the specified Preset Point.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Point Index | `[int]` | |
| Output | Location | `[Vector3]` | |
| Output | Rotate | `[Vector3]` | |

---

## XXI. Stage Settlement

### 1. Get Player Settlement Success Status

**Node Functions:** Get Player Settlement Success Status.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Settlement Status | `[enum]` | Includes: Undetermined, Victory, Defeat |

### 2. Get Player Settlement Ranking Value

**Node Functions:** Returns the Settlement ranking value for the specified Player Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Ranking Value | `[int]` | |

### 3. Get Faction Settlement Success Status

**Node Functions:** Get Faction Settlement Success Status.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Faction | `[Faction]` | |
| Output | Settlement Status | `[enum]` | Includes: Undetermined, Victory, Defeat |

### 4. Get Faction Settlement Ranking Value

**Node Functions:** Returns the Settlement ranking value for the specified Faction.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Faction | `[Faction]` | |
| Output | Ranking Value | `[int]` | |

---

## XXII. Dictionary

### 1. Query If Dictionary Contains Specific Key

**Node Functions:** Searches whether the specified Dictionary contains the specified Key.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dictionary | `[dict]` | |
| Input | Key | `[generic]` | |
| Output | Include | `[bool]` | |

### 2. Query If Dictionary Contains Specific Value

**Node Functions:** Searches whether the specified Dictionary contains the specified Value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dictionary | `[dict]` | |
| Input | Value | `[generic]` | |
| Output | Include | `[bool]` | |

### 3. Query Dictionary's Length

**Node Functions:** Searches the number of Key-Value Pairs in the Dictionary.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dictionary | `[dict]` | |
| Output | Length | `[int]` | |

### 4. Query Dictionary Value by Key

**Node Functions:** Searches the corresponding Value in the Dictionary by Key. If the Key does not exist, returns the type's default value.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dictionary | `[dict]` | |
| Input | Key | `[generic]` | |
| Output | Value | `[generic]` | |

### 5. Get List of Keys from Dictionary

**Node Functions:** Returns a list of all Keys in the Dictionary. Because Key-Value Pairs are unordered, the Keys may not be returned in insertion order.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dictionary | `[dict]` | |
| Output | Key List | `[generic]` | |

### 6. Get List of Values from Dictionary

**Node Functions:** Returns a list of all Values in the Dictionary. Because Key-Value Pairs are unordered, the Values may not be returned in insertion order.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dictionary | `[dict]` | |
| Output | Value List | `[generic]` | |

---

## XXIII. Shop

### 1. Query Inventory Shop Item Sales Info

**Node Functions:** Searches sale information for a specified Item in the Inventory Shop.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Shop Owner Entity | `[Entity]` | |
| Input | Shop ID | `[int]` | |
| Input | Item Config ID | `[ConfigID]` | |
| Output | Sell Currency Dictionary | `[dict]` | |
| Output | Sort Priority | `[int]` | |
| Output | Can Be Sold | `[bool]` | |

### 2. Query Inventory Shop Item Sales List

**Node Functions:** Search the inventory shop's sales list.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Shop Owner Entity | `[Entity]` | |
| Input | Shop ID | `[int]` | |
| Output | Item Config ID List | `[ConfigID[]]` | |

### 3. Query Shop Purchase Item List

**Node Functions:** Search the shop's purchase list.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Shop Owner Entity | `[Entity]` | |
| Input | Shop ID | `[int]` | |
| Output | Item Config ID List | `[ConfigID[]]` | |

### 4. Query Shop Item Purchase Info

**Node Functions:** Searches purchase information for a specified Item in the Shop.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Shop Owner Entity | `[Entity]` | |
| Input | Shop ID | `[int]` | |
| Input | Item Config ID | `[ConfigID]` | |
| Output | Purchase Currency Dictionary | `[dict]` | |
| Output | Purchasable | `[bool]` | |

### 5. Query Custom Shop Item Sales List

**Node Functions:** Searches the Custom Shop sale list; the output parameter is a list of Item IDs.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Shop Owner Entity | `[Entity]` | |
| Input | Shop ID | `[int]` | |
| Output | Shop Item ID List | `[int[]]` | |

### 6. Query Custom Shop Item Sales Info

**Node Functions:** Searches sale information for a specified Item in the Custom Shop.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Shop Owner Entity | `[Entity]` | |
| Input | Shop ID | `[int]` | |
| Input | Shop Item ID | `[int]` | |
| Output | Item Config ID | `[ConfigID]` | |
| Output | Sell Currency Dictionary | `[dict]` | |
| Output | Affiliated Tab ID | `[int]` | |
| Output | Limit Purchase | `[bool]` | |
| Output | Purchase Limit | `[int]` | |
| Output | Sort Priority | `[int]` | |
| Output | Can Be Sold | `[bool]` | |

---

## XXIV. Equipment

### 1. Query Equipment Tag List

**Node Functions:** Searches the list of all Tags on this Equipment instance.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Equipment Index | `[int]` | |
| Output | Tag List | `[ConfigID[]]` | |

### 2. Query Equipment Config ID by Equipment ID

**Node Functions:** Searches the Equipment Config ID by Equipment ID. The Equipment Instance ID can be obtained in the [Equipment Initialization] event.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Equipment Index | `[int]` | |
| Output | Equipment Config ID | `[ConfigID]` | |

### 3. Get Equipment Affix List

**Node Functions:** Returns a list of all Affixes on this Equipment instance. When Equipment is initialized, Affix values are randomized, so the Equipment Affixes on the Equipment instance also generate corresponding instances. Therefore, the data type is Integer rather than Config ID.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Equipment Index | `[int]` | |
| Output | Equipment Affix List | `[int[]]` | |

### 4. Get Equipment Affix Config ID

**Node Functions:** Returns the Config ID of an Equipment Affix by its ID on the Equipment instance.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Equipment Index | `[int]` | |
| Input | Affix ID | `[int]` | |
| Output | Affix Config ID | `[ConfigID]` | |

### 5. Get Equipment Affix Value

**Node Functions:** Returns the value of the Affix at the specified ID on the Equipment instance.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Equipment Index | `[int]` | |
| Input | Affix ID | `[int]` | |
| Output | Affix Value | `[float]` | |

### 6. Get the Equipment Index of the Specified Equipment Slot

**Node Functions:** Get the equipment index of the specified equipment slot.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Row | `[int]` | |
| Input | Column | `[int]` | |
| Output | Equipment Index | `[int]` | |

---

## XXV. Items

### 1. Get Inventory Item Quantity

**Node Functions:** Returns the quantity of the Item with the specified Config ID in the Inventory.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Inventory Owner Entity | `[Entity]` | |
| Input | Item Config ID | `[ConfigID]` | |
| Output | Item Quantity | `[int]` | |

### 2. Get Inventory Currency Quantity

**Node Functions:** Returns the amount of Currency with the specified Config ID in the Inventory.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Inventory Owner Entity | `[Entity]` | |
| Input | Currency Config ID | `[ConfigID]` | |
| Output | Resource Quantity | `[int]` | |

### 3. Get Inventory Capacity

**Node Functions:** Get Inventory Capacity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Inventory Owner Entity | `[Entity]` | |
| Output | Inventory Capacity | `[int]` | |

### 4. Get All Currency From Inventory

**Node Functions:** Returns all Currencies in the Inventory, including types and corresponding amounts.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Inventory Owner Entity | `[Entity]` | |
| Output | Currency Dictionary | `[dict]` | |

### 5. Get all basic items from Inventory

**Node Functions:** Returns all Basic Items in the Inventory, including Item types and their quantities.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Inventory Owner Entity | `[Entity]` | |
| Output | Basic Item Dictionary | `[dict]` | |

### 6. Get all equipment from Inventory

**Node Functions:** Returns all Equipment in the Inventory; the output parameter is a list of all Equipment IDs.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Inventory Owner Entity | `[Entity]` | |
| Output | Equipment Index List | `[int[]]` | |

### 7. Get Loot Component Item Quantity

**Node Functions:** Returns the quantity of Items with the specified Config ID from the Loot Component on the Loot Prefab.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Loot Entity | `[Entity]` | |
| Input | Item Config ID | `[ConfigID]` | |
| Output | Item Quantity | `[int]` | |

### 8. Get Loot Component Currency Quantity

**Node Functions:** Returns the amount of Currency with the specified Config ID from the Loot Component on the Loot Prefab.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Loot Entity | `[Entity]` | |
| Input | Currency Config ID | `[ConfigID]` | |
| Output | Currency Amount | `[int]` | |

### 9. Get All Equipment from Loot Component

**Node Functions:** Returns all Equipment from the Loot Component on the Loot Prefab.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Loot Entity | `[Entity]` | |
| Output | Equipment Index List | `[int[]]` | |

### 10. Get All Items from Loot Component

**Node Functions:** Returns all Items from the Loot Component on the Loot Prefab.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dropper Entity | `[Entity]` | |
| Output | Item Dictionary | `[dict]` | |

### 11. Get All Currency from Loot Component

**Node Functions:** Returns all Currencies from the Loot Component on the Loot Prefab.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Dropper Entity | `[Entity]` | |
| Output | Currency Dictionary | `[dict]` | |

---

## XXVI. Collision Trigger

### 1. Get All Entities Within the Collision Trigger

**Node Functions:** Returns all Entities within the Collision Trigger corresponding to a specific ID in the Collision Trigger Component on the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Trigger ID | `[int]` | |
| Output | Entity List | `[Entity[]]` | |

---

## XXVII. Mini-Map Marker Component

### 1. Query Specified Mini-Map Marker Information

**Node Functions:** Searches the information of the Mini-map Marker with the specified ID in the Mini-map Marker Component on the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | Runtime Entity |
| Input | Mini-Map Marker ID | `[int]` | The Mini-map Marker ID to search |
| Output | Activation State | `[bool]` | The active state of the searched Mini-map Marker |
| Output | List of Players With Visible Markers | `[Entity[]]` | Returns the list of Players who can see this Marker |
| Output | List of Players Tracking Markers | `[Entity[]]` | Returns the list of Players tracking this Marker |

### 2. Get Entity's Mini-Map Marker Status

**Node Functions:** Searches the configuration and activation status of the Entity's current Mini-map Marker.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | Runtime Entity |
| Output | Full Mini-Map Marker ID List | `[int[]]` | Complete list of Mini-map Marker IDs for this Entity |
| Output | Active Mini-Map Marker ID List | `[int[]]` | Complete list of active Mini-map Marker IDs for this Entity |
| Output | Inactive Mini-Map Marker ID List | `[int[]]` | Complete list of inactive Mini-map Marker IDs for this Entity |

---

## XXVIII. Creature Patrol

### 1. Get Current Creation's Patrol Template

**Node Functions:** Returns the Patrol Template information of the specified Creation Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Creation Entity | `[Entity]` | Runtime Creation Entity |
| Output | Patrol Template ID | `[int]` | The Patrol Template ID currently active on this Creation |
| Output | Path Index | `[int]` | The Path ID referenced by the Creation's currently active Patrol Template |
| Output | Target Waypoint Index | `[int]` | The Waypoint ID the Creation will move to next |

---

## XXIX. Achievements

### 1. Query If Achievement Is Completed

**Node Functions:** Searches whether the Achievement corresponding to a specific ID on the Target Entity is complete.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Input | Achievement ID | `[int]` | |
| Output | Completed | `[bool]` | |

---

## XXX. Scan Tags

### 1. Get the Currently Active Scan Tag Config ID

**Node Functions:** Returns the Configuration ID of the currently active Scan Tags on the Target Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | |
| Output | Scan Tag Config ID | `[ConfigID]` | |

---

## XXXI. Rank Tier

### 1. Get Player Rank Score Change

**Node Functions:** Returns the Rank change score for the Player Entity under different Settlement states.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Input | Settlement Status | `[enum]` | |
| Output | Score | `[int]` | |

### 2. Get Player Ranking Info

**Node Functions:** Returns the Player's Rank-related information.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Player Rank Total Score | `[int]` | |
| Output | Player Win Streak | `[int]` | |
| Output | Player Lose Streak | `[int]` | |
| Output | Player Consecutive Escapes | `[int]` | |

### 3. Get Player Escape Validity

**Node Functions:** Get Player Escape Permission.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Valid | `[bool]` | |

---

## XXXII. Entity Layout Group

### 1. Get Currently Active Entity Deployment Groups

**Node Functions:** Searches the list of Entity Layout Groups currently active in the Stage.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output | Entity Deployment Group Index List | `[int[]]` | |

---

## XXXIII. Wonderland Gift Box Related

### 1. Query Corresponding Gift Box Quantity

**Node Functions:** Searches the quantity of the specified Gift Box on the Player Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Input | Gift Box Index | `[int]` | |
| Output | Quantity | `[int]` | |

### 2. Query Corresponding Gift Box Consumption

**Node Functions:** Searches the consumed quantity of the specified Gift Box on the Player Entity.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Input | Gift Box Index | `[int]` | |
| Output | Quantity | `[int]` | |

---

## XXXIV. Creation Preset Status

### 1. Get the Preset Status Value of the Complex Creation

**Node Functions:** Get the preset status value of the complex creation.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Target Entity | `[Entity]` | 复杂造物实体 |
| Input | Preset Status Index | `[int]` | |
| Output | Preset Status Value | `[int]` | |

---

## XXXV. Stage Tasks

### 1. Query Specified Task Count

**Node Functions:** Available only in Beyond Mode. Returns the corresponding player's current task count for specified tasks.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Input | Quest Index | `[int]` | |
| Output | Task Count | `[int]` | |

### 2. Query If Specified Task is Completed

**Node Functions:** Available only in Beyond Mode. Use this to check if a specified task has been completed by the corresponding player.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | The Player Entity queried |
| Input | Quest Index | `[int]` | The corresponding index number for the task queried |
| Output | Completed? | `[bool]` | |

---

## XXXVI. Control Motion Device

### 1. Query Player's Currently Activated Control Motion Device List

**Node Functions:** Query the player's currently activated Control Motion Device List.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Control Motion Device Entity List | `[Entity[]]` | |

### 2. Query Player's Followed Control Motion Device

**Node Functions:** Query the player's Followed Control Motion Device.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | |
| Output | Control Motion Device Entity | `[Entity]` | |

### 3. Query Control Motion Device's Current Movement Parameters

**Node Functions:** Retrieves the current movement parameters of the Motion Controller. Temporary movement parameters added by Motion Controller Skill nodes are excluded.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Control Motion Device | `[Entity]` | |
| Output | Forward Acceleration | `[float]` | |
| Output | Reverse Acceleration | `[float]` | |
| Output | Turn Speed | `[float]` | |
| Output | Base Resistance | `[float]` | |
| Output | Resistance Coefficient | `[float]` | |
| Output | Max Forward Speed | `[float]` | |
| Output | Max Reverse Speed | `[float]` | |

---

## XXXVII. Subscribe to Creator

### 1. Check Whether Player Has Subscribed

**Node Functions:** Checks whether the specified player has subscribed to the Craftsperson. A Craftsperson cannot subscribe to themselves. However, when this node is triggered by the Craftsperson themself, the output result will be true.

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | The player entity to check for subscription status |
| Output | Subscribed | `[bool]` | |

---

## XXXVIII. Cursor

### 1. Check Whether Player Cursor Is Active

**Node Functions:** Checks whether the specified player's cursor is currently active (always visible).

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Input | Player Entity | `[Entity]` | The player to query |
| Output | Activate | `[bool]` | Returns `true` if the cursor is always visible |
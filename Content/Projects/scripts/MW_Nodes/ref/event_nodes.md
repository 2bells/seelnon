# Event Nodes

> Type notation: `[int]`, `[float]`, `[string]`, `[bool]`, `[entity]`, `[guid]`, `[enum]`, `[vector3]`, `[config_id]`, `[faction]`, `[generic]`, `[string[]]`, `[int[]]`, `[entity[]]`, `[dictionary]`, `[custom_var_snapshot]`.

## I. Custom Variables

### 1. When Node Graph Variable Changes

**Node Functions**
- This event is triggered when a Node Graph Variable in the current Node Graph changes.
- The previous and current values are Generic. Determine the Generic type to correctly receive events for Node Graph Variables of the corresponding type.
- Vessel-type Node Graph Variables do not provide before-value and after-value Output Parameters.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | The Entity associated with this Node Graph |
| Output Parameter | Event Source GUID | `[guid]` | GUID of the Entity associated with this Node Graph |
| Output Parameter | Variable Name | `[string]` | Name of the Variable that was changed |
| Output Parameter | Pre-Change Value | `[generic]` | The Variable's value before the change |
| Output Parameter | Post-Change Value | `[generic]` | The Variable's value after the change |

### 2. When Custom Variable Changes

**Node Functions**
- This event is triggered when the Custom Variable of the Entity associated with the current Node Graph changes.
- The previous and current values are Generic. Determine the Generic type before you can correctly receive events for Custom Variables of the corresponding type.
- Vessel-type Custom Variables do not provide before-value and after-value Output Parameters.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | The Entity associated with this Node Graph |
| Output Parameter | Event Source GUID | `[guid]` | GUID of the Entity associated with this Node Graph |
| Output Parameter | Variable Name | `[string]` | Name of the Variable that was changed |
| Output Parameter | Pre-Change Value | `[generic]` | The Variable's value before the change |
| Output Parameter | Post-Change Value | `[generic]` | The Variable's value after the change |

## II. Preset Status

### 1. When Preset Status Changes

**Node Functions**
- This event is triggered when the Preset Status of the Entity associated with the Node Graph changes.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Preset Status ID | `[int]` | |
| Output Parameter | Pre-Change Value | `[int]` | |
| Output Parameter | Post-Change Value | `[int]` | |

## III. Entity Related

### 1. When Character Movement SPD Meets Condition

**Node Functions**
- Adds the Unit Status effect [Monitor Movement Speed] to the Character Entity. This event is triggered when the conditions are met.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Unit Status Config ID | `[config_id]` | |
| Output Parameter | Condition: Comparison Type | `[enum]` | |
| Output Parameter | Condition: Comparison Value | `[float]` | |
| Output Parameter | Current Movement SPD | `[float]` | |

### 2. When Entity Is Created

**Node Functions**
- This event is triggered when an Entity is created.
- All types of Entities can trigger this event. Stage Entities, Character Entities, and Player Entities trigger this event when entering a Stage.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |

### 3. When Entity Is Destroyed

**Node Functions**
- This event triggers when objects and creations within the stage are destroyed. This event can only trigger on stage entities.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | Destroyed Entity |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Location | `[vector3]` | |
| Output Parameter | Orientation | `[vector3]` | |
| Output Parameter | Entity Type | `[enum]` | |
| Output Parameter | Faction | `[faction]` | |
| Output Parameter | Damage Source | `[entity]` | |
| Output Parameter | Owner Entity | `[entity]` | |
| Output Parameter | Custom Variable Component Snapshot | `[custom_var_snapshot]` | On destroy, captures a snapshot of the Custom Variable component on this Entity. Use the Search Custom Variable Snapshot node to retrieve its Custom Variable values |

### 4. When Entity Is Removed/Destroyed

**Node Functions**
- This event is triggered when any Entity in the Stage is removed or destroyed, and it can only be triggered on Stage Entities.
- This event is triggered upon Entity destruction or removal. Therefore, when an Entity is destroyed, it triggers both the [On Entity Destroyed] and [On Entity Removed/Destroyed] events in sequence.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source GUID | `[guid]` | |

## IV. Faction Related

### 1. When Entity Faction Changes

**Node Functions**
- This event is triggered when an Entity's Faction changes.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Pre-Change Faction | `[faction]` | |
| Output Parameter | Post-Change Faction | `[faction]` | |

## V. Player and Character Related

### 1. When the Character Is Down

**Node Functions**
- When a Character is Downed, the Node Graph on the Character Entity can trigger this event.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Character Entity | `[entity]` | |
| Output Parameter | Reason | `[enum]` | Node Graph caused: the Character was Downed by the Destroy Entity node in the Node Graph<br>Normal Down: the Character was Downed because HP reached 0<br>Abnormal Down: the character was downed due to drowning, falling into an abyss, etc. |
| Output Parameter | Knockdown Entity | `[entity]` | |

### 2. When Character Revives

**Node Functions**
- When a Character is Revived, the Node Graph on the Character Entity can trigger this event.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Character Entity | `[entity]` | |

### 3. When Player Teleport Completes

**Node Functions**
- This event is triggered on the Player Entity's Node Graph when the Player completes teleportation.
- This event is also triggered when a Player enters a Stage for the first time.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Player Entity | `[entity]` | |
| Output Parameter | Player GUID | `[guid]` | |

### 4. When All Player's Characters Are Down

**Node Functions**
- This event is triggered on the Player Entity's Node Graph when all of the Player's Character Entities are Downed.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Player Entity | `[entity]` | |
| Output Parameter | Reason | `[enum]` | Node Graph caused: the Character was Downed by the Destroy Entity node in the Node Graph<br>Normal Down: the Character was Downed because HP reached 0<br>Abnormal Down: the character was downed due to drowning, falling into an abyss, etc. |

### 5. When All Player's Characters Are Revived

**Node Functions**
- This event is triggered on the Player Entity's Node Graph when all of the Player's Characters are Revived.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Player Entity | `[entity]` | |

### 6. When Player Is Abnormally Downed and Revives

**Node Functions**
- This event is triggered on the Player Entity when a Character is Downed and then Revived due to drowning, falling into an abyss, or similar reasons.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Player Entity | `[entity]` | |

### 7. When the Active Character Changes

**Node Functions**
- Available only in Classic Mode. This event is triggered on the player entity when the active character changes.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Player Entity | `[entity]` | |
| Output Parameter | Player GUID | `[guid]` | |
| Output Parameter | Replaced Character Entity | `[entity]` | |
| Output Parameter | Current Active Character Entity | `[entity]` | |

## VI. Collision Trigger

### 1. When Entering Collision Trigger

**Node Functions**
- The "Collision Trigger Source" range of a runtime entity A enters the "Collision Trigger" range of another runtime entity B.
- Node graph events will be sent to the entity B configured with "Collision Trigger".

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Entering Entity | `[entity]` | Entity A (referenced above) |
| Output Parameter | Entering Entity GUID | `[guid]` | |
| Output Parameter | Trigger Entity | `[entity]` | Entity B (mentioned above) |
| Output Parameter | Trigger Entity GUID | `[guid]` | |
| Output Parameter | Trigger ID | `[int]` | The trigger with the corresponding ID in Entity B's Collision Trigger Component |

### 2. When Exiting Collision Trigger

**Node Functions**
- When the "Collision Trigger Source" range of active Entity A leaves the "Collision Trigger" range of active Entity B.
- Node graph events will be sent to the entity B configured with "Collision Trigger".

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Exiting Entity | `[entity]` | Entity A (referenced above) |
| Output Parameter | Exiting Entity GUID | `[guid]` | |
| Output Parameter | Trigger Entity | `[entity]` | Entity B (mentioned above) |
| Output Parameter | Trigger Entity GUID | `[guid]` | |
| Output Parameter | Trigger ID | `[int]` | |

## VII. Combat

### 1. When HP Is Recovered

**Node Functions**
- This event is triggered when an Entity's HP is restored.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Healer Entity | `[entity]` | |
| Output Parameter | Recovery Amount | `[float]` | Actual healing amount. If the Entity had not lost any HP prior to healing, the amount is 0 |
| Output Parameter | Recover Tag List | `[string[]]` | |

### 2. When Initiating HP Recovery

**Node Functions**
- This event is triggered on the initiating Entity when an Entity restores HP to other Entities.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Recover Target Entity | `[entity]` | |
| Output Parameter | Recovery Amount | `[float]` | Actual healing amount. If the Target Entity had not lost any HP prior to healing, the amount is 0 |
| Output Parameter | Recover Tag List | `[string[]]` | |

### 3. When Attack Hits

**Node Functions**
- This event is triggered when an Entity's attack hits other Entities.
- (In Classic Mode, due to the Craftsperson's settings, the actual damage may differ from other scenarios.)

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Hit Target Entity | `[entity]` | |
| Output Parameter | Damage | `[float]` | Actual damage dealt. If no damage is dealt due to Invincible or other reasons, the amount is 0 |
| Output Parameter | Attack Tag List | `[string[]]` | |
| Output Parameter | Elemental Type | `[enum]` | |
| Output Parameter | Elemental Attack Potency | `[float]` | Elemental Gauge in the Attack |

### 4. When Attacked

**Node Functions**
- This event is triggered when the Entity is attacked.
- (In Classic Mode, due to the Craftsperson's settings, the actual damage may differ from other scenarios.)

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Attacker Entity | `[entity]` | |
| Output Parameter | Damage | `[float]` | Actual damage dealt. If no damage is dealt due to Invincible or other reasons, the amount is 0 |
| Output Parameter | Attack Tag List | `[string[]]` | |
| Output Parameter | Elemental Type | `[enum]` | |
| Output Parameter | Elemental Attack Potency | `[float]` | Elemental Gauge in the Attack |

### 5. When Entering an Interruptible State

**Node Functions**
- Available only in Beyond Mode.
- This event is triggered when an Entity is attacked and enters the Vulnerable Status.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Attacker | `[entity]` | |

## VIII. Motion Device

### 1. When Basic Motion Device Stops

**Node Functions**
- This event is sent to the Component Owner when a Basic Motion Device on the Basic Motion Device Component completes its movement or is disabled.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | Component Owner |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Motion Device Name | `[string]` | |

### 2. When Path Reaches Waypoint

**Node Functions**
- When the Pathing Motion Device reaches a Waypoint, it sends this event to the Owner of the Basic Motion Device Component. This event is triggered only if "Send Event on Waypoint Arrival" is enabled in the Waypoint settings.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | Component Owner |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Motion Device Name | `[string]` | |
| Output Parameter | Path Point ID | `[int]` | |

## IX. Hit Detection

### 1. When On-Hit Detection Is Triggered

**Node Functions**
- This event is triggered when the On-Hit Detection Component's Owner hits other Entities or the Scene.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | On-Hit Hurtbox | `[bool]` | If set to False: The environment was hit<br>If set to True: An Entity was hit. Retrieve values from the Hit Entity output parameter |
| Output Parameter | On-Hit Entity | `[entity]` | Hit Entity is only valid when a Hurtbox is hit |
| Output Parameter | On-Hit Location | `[vector3]` | |

## X. Timer

### 1. When Timer Is Triggered

**Node Functions**
- This event is triggered when the Timer reaches the specified time node.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Timer Name | `[string]` | |
| Output Parameter | Timer Sequence ID | `[int]` | |
| Output Parameter | Number of Loops | `[int]` | |

## XI. Global Timer

### 1. When Global Timer Is Triggered

**Node Functions**
- This event is triggered when the Global Countdown Timer reaches zero.
- The Global Stopwatch Timer does not trigger this event.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Timer Name | `[string]` | |

## XII. UI Control Groups

### 1. When UI Control Group Is Triggered

**Node Functions**
- This event is triggered only by UI controls of the following types: Interactive Button, Item Display, Custom Button, and Custom Switch.
- This event can only be received by the Player Node Graph that triggered the interaction.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | UI Control Group Composite Index | `[int]` | If the UI control that triggered this event forms a multi-control UI group with other controls, this output parameter returns the corresponding group value |
| Output Parameter | UI Control Group Index | `[int]` | If the triggering UI control is a single-control UI group, this value represents the ID of that UI control group<br>If the triggering UI control is part of a multi-control UI group, this value represents the ID of the control within that group |

## XIII. Unit Status

### 1. When Unit Status Changes

**Node Functions**
- This event is triggered when the Stack Count of a Unit Status changes.
- This event is triggered when Unit Status effects are applied or removed.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Unit Status Config ID | `[config_id]` | |
| Output Parameter | Applier Entity | `[entity]` | |
| Output Parameter | Infinite Duration | `[bool]` | |
| Output Parameter | Remaining Status Duration | `[float]` | |
| Output Parameter | Remaining Status Stacks | `[int]` | Edited Stack Count |
| Output Parameter | Original Status Stacks | `[int]` | Previous Stack Count |
| Output Parameter | Slot ID | `[int]` | ID of the Unit Status slot that changed |

### 2. When Unit Status Ends

**Node Functions**
- This event is triggered when a Unit Status is removed for any reason or when its Runtime Duration expires.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Unit Status Config ID | `[config_id]` | |
| Output Parameter | Applier Entity | `[entity]` | |
| Output Parameter | Infinite Duration | `[bool]` | |
| Output Parameter | Remaining Status Duration | `[float]` | |
| Output Parameter | Remaining Status Stacks | `[int]` | |
| Output Parameter | Remover Entity | `[entity]` | |
| Output Parameter | Removal Reason | `[enum]` | Status Replacement: The Unit Status was removed because it was replaced by another status<br>Duration Exceeded: The Unit Status exceeded its runtime duration<br>Dispelled: The Unit Status was removed directly<br>Status Expired: The Unit Status became invalid due to other reasons<br>Class Changed: The Unit Status was removed due to a class change |
| Output Parameter | Slot ID | `[int]` | ID of the Unit Status slot that changed |

### 3. When Elemental Reaction Event Occurs

**Node Functions**
- Adds the Unit Status effect [Monitor Elemental Reaction] to the Entity. This event is triggered when the conditions are met.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Elemental Reaction Type | `[enum]` | |
| Output Parameter | Triggerer Entity | `[entity]` | |
| Output Parameter | Triggerer Entity GUID | `[guid]` | |

### 4. When Shield Is Attacked

**Node Functions**
- Adds the Unit Status effect [Add Shield] to the Entity. This event is triggered when the Shield takes damage.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Attacker Entity | `[entity]` | |
| Output Parameter | Attacker GUID | `[guid]` | |
| Output Parameter | Unit Status Config ID | `[config_id]` | |
| Output Parameter | Pre-Attack Layers | `[int]` | |
| Output Parameter | Post-Attack Layers | `[int]` | |
| Output Parameter | Shield Value of this Unit Status Before Attack | `[float]` | |
| Output Parameter | Shield Value of this Unit Status After Attack | `[float]` | |

## XIV. Tabs

### 1. When Tab Is Selected

**Node Functions**
- When the active tab is selected, it will send an event to the node graph.
- The Entity Node Graph configured by the Tab Component will receive this event.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | Entity with the tab component mounted |
| Output Parameter | Event Source GUID | `[guid]` | GUID of the Entity with the tab component mounted; outputs 0 if none exists |
| Output Parameter | Tab ID | `[int]` | ID of the tab |
| Output Parameter | Selector Entity | `[entity]` | Character Entity that triggers the tab |

## XV. Creations

### 1. When Creation Enters Combat

**Node Functions**
- Only effective in Classic Aggro Mode.
- This event is triggered when a Creation enters battle.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |

### 2. When Creation Leaves Combat

**Node Functions**
- Only effective in Classic Aggro Mode.
- This event is triggered when a Creation leaves battle.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |

## XVI. Classes

### 1. When Player Class Level Changes

**Node Functions**
- This event is triggered when a Player's Class Level changes and is sent to the corresponding Player. It can be received in that Class's Node Graph.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | Active Player Entity |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Pre-Change Level | `[int]` | |
| Output Parameter | Post-Change Level | `[int]` | |

### 2. When Player Class Changes

**Node Functions**
- This event is triggered when a Player's Class changes and is sent to the corresponding Player. It can be received in the Node Graph of the new Class.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Pre-Modification Class Config ID | `[config_id]` | |
| Output Parameter | Post-Modification Config ID | `[config_id]` | |

### 3. When Player Class Is Removed

**Node Functions**
- This event is triggered when a Player's Class is removed and sent to the corresponding Player. It can be received in the Node Graph of the previous Class.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Pre-Modification Class Config ID | `[config_id]` | |
| Output Parameter | Post-Modification Config ID | `[config_id]` | |

## XVII. Skills

### 1. When Skill Node Is Called

**Node Functions**
- This event is triggered by the [Notify Server Node Graph] Node in the Skill Node Graph. Up to three strings can be passed in.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Caller Entity | `[entity]` | |
| Output Parameter | Caller GUID | `[guid]` | |
| Output Parameter | Parameter 1 | `[string]` | |
| Output Parameter | Parameter 2 | `[string]` | |
| Output Parameter | Parameter 3 | `[string]` | |

## XVIII. Custom Aggro

### 1. When Aggro Target Changes

**Node Functions**
- Available only in Custom Aggro Mode.
- This event is triggered when the Aggro Target changes.
- This event can also be triggered when entering or leaving battle.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Pre-Change Aggro Target | `[entity]` | |
| Output Parameter | Post-Change Aggro Target | `[entity]` | |

### 2. When Self Enters Combat

**Node Functions**
- Available only in Custom Aggro Mode.
- This event is triggered when the Entity itself enters battle.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |

### 3. When Self Leaves Combat

**Node Functions**
- Available only in Custom Aggro Mode.
- This event is triggered when the Entity itself leaves battle.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |

## XIX. Signals

### 1. Monitor Signal

**Node Functions**
- Monitors Signal trigger events defined in the Signal Manager.
- The Signal name to monitor must be selected first.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Signal Source Entity | `[entity]` | The Entity that sent this signal using the Send Signal node |

## XX. Deck Selector

### 1. When Deck Selector Is Complete

**Node Functions**
- This event is triggered on the Player's Node Graph when the Player completes the Deck Selector, or when it is forcibly closed due to time constraints.
- The output parameters report the Deck Selector's result and the corresponding reason.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Target Player | `[entity]` | Active Player Entity |
| Output Parameter | Selection Result List | `[int[]]` | When a selection interaction is triggered, valid selection results are returned as this output parameter, and the completion reason is Completed by Player<br>When a Full Refresh pop-up selection is triggered, the complete selection result list is returned as this output parameter, and the completion reason is Refresh All<br>When a Fixed-Quantity Refresh pop-up selection is triggered, valid selection results are returned as this output parameter, and the completion reason is Fixed-Quantity Refresh<br>When the Deck Selector times out with no interaction, the default selection is returned is returned as this output parameter, and the completion reason is Timeout<br>When Allow Discard Selection is enabled and the Deck Selector is closed by the player, the default selection is returned as this output parameter, and the completion reason is Closed Manually<br>When the Deck Selector is closed via the Node Graph, the default selection is returned as this output parameter, and the completion reason is Closed by Node Graph |
| Output Parameter | Completion Reason | `[enum]` | Six reason enumerations<br>Completed by Player, Refresh All, Fixed-Quantity Refresh, Timeout, Closed Manually, Closed by Node Graph |
| Output Parameter | Deck Selector Index | `[int]` | Referenced Deck Selector ID |

## XXI. Text Bubbles

### 1. When Text Bubble Is Completed

**Node Functions**
- This event can only be mounted by Text Bubble Components and is received by the Entity's Node Graph that completed the dialogue.
- Completion refers to when the final line of dialogue has finished playing.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Bubble Owner Entity | `[entity]` | Runtime Entity with the Text Bubble component mounted |
| Output Parameter | Character Entity | `[entity]` | Target Character of the current Bubble dialogue |
| Output Parameter | Text Bubble Configuration ID | `[config_id]` | Currently active Text Bubble Config ID |
| Output Parameter | Text Bubble Completion Count | `[int]` | Number of times the currently active Text Bubble has been fully played for this dialogue Character |

## XXII. Shop

### 1. When Selling Inventory Items in the Shop

**Node Functions**
- This event is triggered when Inventory items are sold in the Shop. The Owner of the Shop Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Shop Owner | `[entity]` | |
| Output Parameter | Shop Owner GUID | `[guid]` | |
| Output Parameter | Buyer Entity | `[entity]` | |
| Output Parameter | Shop ID | `[int]` | |
| Output Parameter | Item Config ID | `[config_id]` | |
| Output Parameter | Purchase Quantity | `[int]` | |

### 2. When Custom Shop Item Is Sold

**Node Functions**
- This event is triggered when Custom items are sold in the Shop. The Owner of the Shop Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Shop Owner | `[entity]` | |
| Output Parameter | Shop Owner GUID | `[guid]` | |
| Output Parameter | Buyer Entity | `[entity]` | |
| Output Parameter | Shop ID | `[int]` | |
| Output Parameter | Shop Item ID | `[int]` | |
| Output Parameter | Purchase Quantity | `[int]` | |

### 3. When selling items to the shop

**Node Functions**
- This event is triggered when items are purchased by the Shop. The Owner of the Shop Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Shop Owner | `[entity]` | |
| Output Parameter | Shop Owner GUID | `[guid]` | |
| Output Parameter | Seller Entity | `[entity]` | |
| Output Parameter | Shop ID | `[int]` | |
| Output Parameter | Purchase Item Dictionary | `[dictionary]` | |

## XXIII. Equipment

### 1. When Equipment Is Equipped

**Node Functions**
- This event is triggered when Equipment is equipped. The Owner of the Equipment will receive it. Configure this in the Item Node Graph.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Equipment Holder Entity | `[entity]` | |
| Output Parameter | Equipment Holder GUID | `[guid]` | |
| Output Parameter | Equipment Index | `[int]` | |

### 2. When Equipment Is Unequipped

**Node Functions**
- This event is triggered when Equipment is unequipped. The Owner of the Equipment will receive it. Configure this in the Item Node Graph.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Equipment Owner Entity | `[entity]` | |
| Output Parameter | Equipment Owner GUID | `[guid]` | |
| Output Parameter | Equipment Index | `[int]` | |

### 3. When Equipment Is Initialized

**Node Functions**
- When Equipment is first obtained and enters the Inventory, it is initialized. The event's output parameters return the unique ID of the Equipment instance. Use this ID to edit the Equipment dynamically. The Owner of the Equipment will receive this event. Configure this in the Item Node Graph.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Equipment Owner | `[entity]` | |
| Output Parameter | Equipment Owner GUID | `[guid]` | |
| Output Parameter | Equipment Index | `[int]` | |

### 4. When Equipment Affix Value Changes

**Node Functions**
- This event is triggered when Equipment Affix values change. The Owner of the Equipment will receive it. Configure this in the Item Node Graph.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Equipment Owner | `[entity]` | |
| Output Parameter | Equipment Owner GUID | `[guid]` | |
| Output Parameter | Equipment Index | `[int]` | |
| Output Parameter | Affix ID | `[int]` | The corresponding ID of this Entry within the Equipment Affixes |
| Output Parameter | Pre-Change Value | `[float]` | |
| Output Parameter | Post-Change Value | `[float]` | |

### 5. When Equipment is purchased

**Node Functions**
- The Inventory Owner Entity receives this event when it purchases equipment.
- This node is triggered only by item exchanges in the Inventory Shop. Custom shops do not trigger it. The Item Node Graph bound to the purchased equipment also receives this event.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Purchasing Inventory Owner Entity | `[entity]` | |
| Output Parameter | Purchasing Inventory Owner GUID | `[guid]` | |
| Output Parameter | Equipment Index List | `[int[]]` | List of Indices of the Purchased Equipment |

### 6. When Equipment is sold

**Node Functions**
- The Inventory Owner Entity receives this event when it sells equipment.
- This node is triggered only by item exchanges in the Inventory Shop. Custom shops do not trigger it. The Item Node Graph bound to the purchased equipment also receives this event.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Purchasing Inventory Owner Entity | `[entity]` | |
| Output Parameter | Purchasing Inventory Owner GUID | `[guid]` | |
| Output Parameter | Equipment Index List | `[int[]]` | List of Indices of the Sold Equipment |

## XXIV. Items

### 1. When Item Is Lost From Inventory

**Node Functions**
- This event is triggered when an Item is removed from the Inventory (its quantity becomes 0). The Owner of the Inventory Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Item Owner Entity | `[entity]` | |
| Output Parameter | Item Owner GUID | `[guid]` | |
| Output Parameter | Item Config ID | `[config_id]` | |
| Output Parameter | Quantity Lost | `[int]` | |

### 2. When the Quantity of Inventory Item Changes

**Node Functions**
- This event is triggered when the quantity of Items in the Inventory changes. The Owner of the Inventory Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Item Owner Entity | `[entity]` | |
| Output Parameter | Item Owner GUID | `[guid]` | |
| Output Parameter | Item Config ID | `[config_id]` | |
| Output Parameter | Pre-Change Quantity | `[int]` | |
| Output Parameter | Post-Change Quantity | `[int]` | |
| Output Parameter | Reason for Change | `[enum]` | |

### 3. When Item Is Added to Inventory

**Node Functions**
- This event is triggered when a new Item is added to the Inventory. The Owner of the Inventory Component will receive it. This event is not triggered by quantity-only changes.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Item Owner Entity | `[entity]` | |
| Output Parameter | Item Owner GUID | `[guid]` | |
| Output Parameter | Item Config ID | `[config_id]` | |
| Output Parameter | Quantity Obtained | `[int]` | |

### 4. When the Quantity of Inventory Currency Changes

**Node Functions**
- This event is triggered when the amount of Inventory Currency changes. The Owner of the Inventory Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Currency Owner Entity | `[entity]` | |
| Output Parameter | Currency Owner GUID | `[guid]` | |
| Output Parameter | Currency Config ID | `[config_id]` | |
| Output Parameter | Currency Change Value | `[int]` | |

### 5. When Items in the Inventory Are Used

**Node Functions**
- This event is triggered when an Item in the Inventory is used. The Owner of the Inventory Component will receive it.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Item Owner Entity | `[entity]` | |
| Output Parameter | Item Owner GUID | `[guid]` | |
| Output Parameter | Item Config ID | `[config_id]` | |
| Output Parameter | Amount to Use | `[int]` | |

## XXV. Creation Patrol

### 1. When Creation Reaches Patrol Waypoint

**Node Functions**
- When the Send Node Graph Event on Arrival option is enabled for a waypoint in the Patrol template, a Node Graph Event is triggered once the specified conditions are met.
- This Node Graph Event can only be received by the creation's node graph.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Creation Entity | `[entity]` | Runtime Creation Entity |
| Output Parameter | Creation GUID | `[guid]` | The GUID of the Creation. If it was not an initially placed Creation, the output is empty |
| Output Parameter | Current Patrol Template ID | `[int]` | The Patrol Template ID currently active on this Creation |
| Output Parameter | Current Path Index | `[int]` | The Path ID referenced by the Creation's currently active Patrol Template |
| Output Parameter | Current Reached Waypoint ID | `[int]` | The Waypoint ID the Creation has currently reached |
| Output Parameter | Next Waypoint ID | `[int]` | The Waypoint ID the Creation will move to next |

## XXVI. Creation Preset Status

### 1. When Complex Creation Preset Status Changes

**Node Functions**
- This event is triggered when the preset state of a complex creation is changed using the "Set the preset status value of the complex creation" node (the modified and unmodified values must be different for this event to trigger).
- This node graph event can only be received by the node graph of the complex creation.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | Complex Creation Entity |
| Output Parameter | Event Source Entity GUID | `[guid]` | Complex Creation GUID |
| Output Parameter | Preset Status Index | `[int]` | |
| Output Parameter | Pre-Change Value | `[int]` | |
| Output Parameter | Post-Change Value | `[int]` | |

## XXVII. Floating Interaction Page

### 1. When Floating Interaction Page is Triggered

**Node Functions**
- When the "Return to Server Event" option is enabled for a tab or single-choice window, confirming the interaction will trigger this event on the corresponding Player Entity's Server Node Graph.
- When the player selects a Tab/Single-Choice Panel:
  - The Interactive Item Index is the index of the corresponding Tab/Single-Choice Panel, the List Index is the index of the corresponding Tab/Single-Choice Panel, and the Selected List Item is the index of the currently clicked item in the corresponding Tab/Single-Choice Panel.
- When the player clicks a button that has a Tab/Single-Choice Panel monitor configured:
  - The Interactive Item Index is the index of the corresponding Tab/Single-Choice Panel, the List Index is the list of indices of all Tab/Single-Choice Panels associated with the button, and the Selected List Item is the list of indices of the currently clicked items in the corresponding Tab/Single-Choice Panels.
- After the interaction is confirmed, the corresponding player's server node graph will also receive this event for the following elements configured in the Floating Interaction Page: Interaction Page Close Button, Interaction Button, Item Display, Custom Button, and Custom Switch.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Player Entity | `[entity]` | Active Player Entity |
| Output Parameter | Player GUID | `[guid]` | GUID of the Active Player Entity |
| Output Parameter | Floating Interaction Page Index | `[int]` | Unique Identifier for the Floating Interaction Page |
| Output Parameter | Interactive Item Index | `[int]` | Index of the control that triggered this event |
| Output Parameter | List Index | `[int[]]` | List of indices for the tabs or single-choice windows. Each List Index output parameter corresponds to a Selected List Item output parameter |
| Output Parameter | Selected List Item | `[int[]]` | Each tab or single-choice window can have at most one selected item. Each Selected List Item output parameter corresponds to a List Index output parameter |

## XXVIII. Control Motion Device

### 1. When Player Leaves Control Motion Device

**Node Functions**
- Triggered when the player exits the Motion Device. The player will automatically exit the Motion Device when they become controlled or are teleported.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Leave Control Motion Device Entity | `[entity]` | |

### 2. When Player Follows Control Motion Device

**Node Functions**
- Triggered when the player follows the Control Motion Device.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Follow Control Motion Device Entity | `[entity]` | |

### 3. When Player's Activated Control Motion Device List Changes

**Node Functions**
- Triggered when the player follows the Control Motion Device.

**Node Parameters**

| Parameter Type | Parameter Name | Type | Description |
|---|---|---|---|
| Output Parameter | Event Source Entity | `[entity]` | |
| Output Parameter | Event Source GUID | `[guid]` | |
| Output Parameter | Old Control Motion Device Entity List | `[entity[]]` | |
| Output Parameter | Current Activated Control Motion Device Entity List | `[entity[]]` | |
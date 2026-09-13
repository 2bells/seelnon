/**
 * EVENT_NODES - part 1
 */
export const EVENT_NODES_A = [
{
    "id": "event_when_node_graph_var_changes",
    "name": "When Node Graph Variable Changes",
    "category": "event",
    "folder": "I. Custom Variables",
    "description": "This event is triggered when a Node Graph Variable in the current Node Graph changes. The previous and current values are Generic. Determine the Generic type to correctly receive events for Node Graph Variables of the corresponding type. Vessel-type Node Graph Variables do not provide before-value and after-value Output Parameters.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "The Entity associated with this Node Graph"
      },
      {
        "name": "Event Source GUID",
        "type": "guid",
        "description": "GUID of the Entity associated with this Node Graph"
      },
      {
        "name": "Variable Name",
        "type": "string",
        "description": "Name of the Variable that was changed"
      },
      {
        "name": "Pre-Change Value",
        "type": "generic",
        "description": "The Variable's value before the change",
        "hasGear": true
      },
      {
        "name": "Post-Change Value",
        "type": "generic",
        "description": "The Variable's value after the change",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_custom_var_changes",
    "name": "When Custom Variable Changes",
    "category": "event",
    "folder": "I. Custom Variables",
    "description": "This event is triggered when the Custom Variable of the Entity associated with the current Node Graph changes. The previous and current values are Generic. Determine the Generic type before you can correctly receive events for Custom Variables of the corresponding type. Vessel-type Custom Variables do not provide before-value and after-value Output Parameters.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "The Entity associated with this Node Graph"
      },
      {
        "name": "Event Source GUID",
        "type": "guid",
        "description": "GUID of the Entity associated with this Node Graph"
      },
      {
        "name": "Variable Name",
        "type": "string",
        "description": "Name of the Variable that was changed"
      },
      {
        "name": "Pre-Change Value",
        "type": "generic",
        "description": "The Variable's value before the change",
        "hasGear": true
      },
      {
        "name": "Post-Change Value",
        "type": "generic",
        "description": "The Variable's value after the change",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_preset_status_changes",
    "name": "When Preset Status Changes",
    "category": "event",
    "folder": "II. Preset Status",
    "description": "This event is triggered when the Preset Status of the Entity associated with the Node Graph changes.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Preset Status ID",
        "type": "int"
      },
      {
        "name": "Pre-Change Value",
        "type": "int"
      },
      {
        "name": "Post-Change Value",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_character_movement_spd_meets_condition",
    "name": "When Character Movement SPD Meets Condition",
    "category": "event",
    "folder": "III. Entity Related",
    "description": "Adds the Unit Status effect [Monitor Movement Speed] to the Character Entity. This event is triggered when the conditions are met.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      },
      {
        "name": "Condition: Comparison Type",
        "type": "enum"
      },
      {
        "name": "Condition: Comparison Value",
        "type": "float"
      },
      {
        "name": "Current Movement SPD",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_entity_created",
    "name": "When Entity Is Created",
    "category": "event",
    "folder": "III. Entity Related",
    "description": "This event is triggered when an Entity is created. All types of Entities can trigger this event. Stage Entities, Character Entities, and Player Entities trigger this event when entering a Stage.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_entity_destroyed",
    "name": "When Entity Is Destroyed",
    "category": "event",
    "folder": "III. Entity Related",
    "description": "This event triggers when objects and creations within the stage are destroyed. This event can only trigger on stage entities.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "Destroyed Entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Location",
        "type": "vector3"
      },
      {
        "name": "Orientation",
        "type": "vector3"
      },
      {
        "name": "Entity Type",
        "type": "enum"
      },
      {
        "name": "Faction",
        "type": "faction"
      },
      {
        "name": "Damage Source",
        "type": "entity"
      },
      {
        "name": "Owner Entity",
        "type": "entity"
      },
      {
        "name": "Custom Variable Component Snapshot",
        "type": "generic",
        "description": "On destroy, captures a snapshot of the Custom Variable component on this Entity. Use the Search Custom Variable Snapshot node to retrieve its Custom Variable values",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_entity_is_removed_destroyed",
    "name": "When Entity Is Removed/Destroyed",
    "category": "event",
    "folder": "III. Entity Related",
    "description": "This event is triggered when any Entity in the Stage is removed or destroyed, and it can only be triggered on Stage Entities. This event is triggered upon Entity destruction or removal. Therefore, when an Entity is destroyed, it triggers both the [On Entity Destroyed] and [On Entity Removed/Destroyed] events in sequence.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_entity_faction_changes",
    "name": "When Entity Faction Changes",
    "category": "event",
    "folder": "IV. Faction Related",
    "description": "This event is triggered when an Entity's Faction changes.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Pre-Change Faction",
        "type": "faction"
      },
      {
        "name": "Post-Change Faction",
        "type": "faction"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_character_down",
    "name": "When the Character Is Down",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "When a Character is Downed, the Node Graph on the Character Entity can trigger this event.",
    "inputs": [],
    "outputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Reason",
        "type": "enum",
        "description": "Node Graph caused: the Character was Downed by the Destroy Entity node in the Node Graph<br>Normal Down: the Character was Downed because HP reached 0<br>Abnormal Down: the character was downed due to drowning, falling into an abyss, etc."
      },
      {
        "name": "Knockdown Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_character_revives",
    "name": "When Character Revives",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "When a Character is Revived, the Node Graph on the Character Entity can trigger this event.",
    "inputs": [],
    "outputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_teleport_completes",
    "name": "When Player Teleport Completes",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "This event is triggered on the Player Entity's Node Graph when the Player completes teleportation. This event is also triggered when a Player enters a Stage for the first time.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Player GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_all_player_s_characters_are_down",
    "name": "When All Player's Characters Are Down",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "This event is triggered on the Player Entity's Node Graph when all of the Player's Character Entities are Downed.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Reason",
        "type": "enum",
        "description": "Node Graph caused: the Character was Downed by the Destroy Entity node in the Node Graph<br>Normal Down: the Character was Downed because HP reached 0<br>Abnormal Down: the character was downed due to drowning, falling into an abyss, etc."
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_all_player_s_characters_are_revived",
    "name": "When All Player's Characters Are Revived",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "This event is triggered on the Player Entity's Node Graph when all of the Player's Characters are Revived.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_player_is_abnormally_downed_and_revives",
    "name": "When Player Is Abnormally Downed and Revives",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "This event is triggered on the Player Entity when a Character is Downed and then Revived due to drowning, falling into an abyss, or similar reasons.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_the_active_character_changes",
    "name": "When the Active Character Changes",
    "category": "event",
    "folder": "V. Player and Character Related",
    "description": "Available only in Classic Mode. This event is triggered on the player entity when the active character changes.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Player GUID",
        "type": "guid"
      },
      {
        "name": "Replaced Character Entity",
        "type": "entity"
      },
      {
        "name": "Current Active Character Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_collision_enter",
    "name": "When Entering Collision Trigger",
    "category": "event",
    "folder": "VI. Collision Trigger",
    "description": "The \"Collision Trigger Source\" range of a runtime entity A enters the \"Collision Trigger\" range of another runtime entity B. Node graph events will be sent to the entity B configured with \"Collision Trigger\".",
    "inputs": [],
    "outputs": [
      {
        "name": "Entering Entity",
        "type": "entity",
        "description": "Entity A (referenced above)"
      },
      {
        "name": "Entering Entity GUID",
        "type": "guid"
      },
      {
        "name": "Trigger Entity",
        "type": "entity",
        "description": "Entity B (mentioned above)"
      },
      {
        "name": "Trigger Entity GUID",
        "type": "guid"
      },
      {
        "name": "Trigger ID",
        "type": "int",
        "description": "The trigger with the corresponding ID in Entity B's Collision Trigger Component"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_exiting_collision_trigger",
    "name": "When Exiting Collision Trigger",
    "category": "event",
    "folder": "VI. Collision Trigger",
    "description": "When the \"Collision Trigger Source\" range of active Entity A leaves the \"Collision Trigger\" range of active Entity B. Node graph events will be sent to the entity B configured with \"Collision Trigger\".",
    "inputs": [],
    "outputs": [
      {
        "name": "Exiting Entity",
        "type": "entity",
        "description": "Entity A (referenced above)"
      },
      {
        "name": "Exiting Entity GUID",
        "type": "guid"
      },
      {
        "name": "Trigger Entity",
        "type": "entity",
        "description": "Entity B (mentioned above)"
      },
      {
        "name": "Trigger Entity GUID",
        "type": "guid"
      },
      {
        "name": "Trigger ID",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_hp_recovered",
    "name": "When HP Is Recovered",
    "category": "event",
    "folder": "VII. Combat",
    "description": "This event is triggered when an Entity's HP is restored.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Healer Entity",
        "type": "entity"
      },
      {
        "name": "Recovery Amount",
        "type": "float",
        "description": "Actual healing amount. If the Entity had not lost any HP prior to healing, the amount is 0"
      },
      {
        "name": "Recover Tag List",
        "type": "string"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_initiating_hp_recovery",
    "name": "When Initiating HP Recovery",
    "category": "event",
    "folder": "VII. Combat",
    "description": "This event is triggered on the initiating Entity when an Entity restores HP to other Entities.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Recover Target Entity",
        "type": "entity"
      },
      {
        "name": "Recovery Amount",
        "type": "float",
        "description": "Actual healing amount. If the Target Entity had not lost any HP prior to healing, the amount is 0"
      },
      {
        "name": "Recover Tag List",
        "type": "string"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_attack_hits",
    "name": "When Attack Hits",
    "category": "event",
    "folder": "VII. Combat",
    "description": "This event is triggered when an Entity's attack hits other Entities. (In Classic Mode, due to the Craftsperson's settings, the actual damage may differ from other scenarios.)",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Hit Target Entity",
        "type": "entity"
      },
      {
        "name": "Damage",
        "type": "float",
        "description": "Actual damage dealt. If no damage is dealt due to Invincible or other reasons, the amount is 0"
      },
      {
        "name": "Attack Tag List",
        "type": "string"
      },
      {
        "name": "Elemental Type",
        "type": "enum"
      },
      {
        "name": "Elemental Attack Potency",
        "type": "float",
        "description": "Elemental Gauge in the Attack"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_attacked",
    "name": "When Attacked",
    "category": "event",
    "folder": "VII. Combat",
    "description": "This event is triggered when the Entity is attacked. (In Classic Mode, due to the Craftsperson's settings, the actual damage may differ from other scenarios.)",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Attacker Entity",
        "type": "entity"
      },
      {
        "name": "Damage",
        "type": "float",
        "description": "Actual damage dealt. If no damage is dealt due to Invincible or other reasons, the amount is 0"
      },
      {
        "name": "Attack Tag List",
        "type": "string"
      },
      {
        "name": "Elemental Type",
        "type": "enum"
      },
      {
        "name": "Elemental Attack Potency",
        "type": "float",
        "description": "Elemental Gauge in the Attack"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_entering_an_interruptible_state",
    "name": "When Entering an Interruptible State",
    "category": "event",
    "folder": "VII. Combat",
    "description": "Available only in Beyond Mode. This event is triggered when an Entity is attacked and enters the Vulnerable Status.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Attacker",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_basic_motion_device_stops",
    "name": "When Basic Motion Device Stops",
    "category": "event",
    "folder": "VIII. Motion Device",
    "description": "This event is sent to the Component Owner when a Basic Motion Device on the Basic Motion Device Component completes its movement or is disabled.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "Component Owner"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Motion Device Name",
        "type": "string"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_path_reaches_waypoint",
    "name": "When Path Reaches Waypoint",
    "category": "event",
    "folder": "VIII. Motion Device",
    "description": "When the Pathing Motion Device reaches a Waypoint, it sends this event to the Owner of the Basic Motion Device Component. This event is triggered only if \"Send Event on Waypoint Arrival\" is enabled in the Waypoint settings.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "Component Owner"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Motion Device Name",
        "type": "string"
      },
      {
        "name": "Path Point ID",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_on_hit_detection_is_triggered",
    "name": "When On-Hit Detection Is Triggered",
    "category": "event",
    "folder": "IX. Hit Detection",
    "description": "This event is triggered when the On-Hit Detection Component's Owner hits other Entities or the Scene.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "On-Hit Hurtbox",
        "type": "bool",
        "description": "If set to False: The environment was hit<br>If set to True: An Entity was hit. Retrieve values from the Hit Entity output parameter"
      },
      {
        "name": "On-Hit Entity",
        "type": "entity",
        "description": "Hit Entity is only valid when a Hurtbox is hit"
      },
      {
        "name": "On-Hit Location",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_timer_triggered",
    "name": "When Timer Is Triggered",
    "category": "event",
    "folder": "X. Timer",
    "description": "This event is triggered when the Timer reaches the specified time node.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Timer Name",
        "type": "string"
      },
      {
        "name": "Timer Sequence ID",
        "type": "int"
      },
      {
        "name": "Number of Loops",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_global_timer_triggered",
    "name": "When Global Timer Is Triggered",
    "category": "event",
    "folder": "XI. Global Timer",
    "description": "This event is triggered when the Global Countdown Timer reaches zero. The Global Stopwatch Timer does not trigger this event.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Timer Name",
        "type": "string"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_ui_control_group_is_triggered",
    "name": "When UI Control Group Is Triggered",
    "category": "event",
    "folder": "XII. UI Control Groups",
    "description": "This event is triggered only by UI controls of the following types: Interactive Button, Item Display, Custom Button, and Custom Switch. This event can only be received by the Player Node Graph that triggered the interaction.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "UI Control Group Composite Index",
        "type": "int",
        "description": "If the UI control that triggered this event forms a multi-control UI group with other controls, this output parameter returns the corresponding group value"
      },
      {
        "name": "UI Control Group Index",
        "type": "int",
        "description": "If the triggering UI control is a single-control UI group, this value represents the ID of that UI control group<br>If the triggering UI control is part of a multi-control UI group, this value represents the ID of the control within that group"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_unit_status_changes",
    "name": "When Unit Status Changes",
    "category": "event",
    "folder": "XIII. Unit Status",
    "description": "This event is triggered when the Stack Count of a Unit Status changes. This event is triggered when Unit Status effects are applied or removed.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      },
      {
        "name": "Applier Entity",
        "type": "entity"
      },
      {
        "name": "Infinite Duration",
        "type": "bool"
      },
      {
        "name": "Remaining Status Duration",
        "type": "float"
      },
      {
        "name": "Remaining Status Stacks",
        "type": "int",
        "description": "Edited Stack Count"
      },
      {
        "name": "Original Status Stacks",
        "type": "int",
        "description": "Previous Stack Count"
      },
      {
        "name": "Slot ID",
        "type": "int",
        "description": "ID of the Unit Status slot that changed"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_unit_status_ends",
    "name": "When Unit Status Ends",
    "category": "event",
    "folder": "XIII. Unit Status",
    "description": "This event is triggered when a Unit Status is removed for any reason or when its Runtime Duration expires.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      },
      {
        "name": "Applier Entity",
        "type": "entity"
      },
      {
        "name": "Infinite Duration",
        "type": "bool"
      },
      {
        "name": "Remaining Status Duration",
        "type": "float"
      },
      {
        "name": "Remaining Status Stacks",
        "type": "int"
      },
      {
        "name": "Remover Entity",
        "type": "entity"
      },
      {
        "name": "Removal Reason",
        "type": "enum",
        "description": "Status Replacement: The Unit Status was removed because it was replaced by another status<br>Duration Exceeded: The Unit Status exceeded its runtime duration<br>Dispelled: The Unit Status was removed directly<br>Status Expired: The Unit Status became invalid due to other reasons<br>Class Changed: The Unit Status was removed due to a class change"
      },
      {
        "name": "Slot ID",
        "type": "int",
        "description": "ID of the Unit Status slot that changed"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_elemental_reaction_event_occurs",
    "name": "When Elemental Reaction Event Occurs",
    "category": "event",
    "folder": "XIII. Unit Status",
    "description": "Adds the Unit Status effect [Monitor Elemental Reaction] to the Entity. This event is triggered when the conditions are met.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Elemental Reaction Type",
        "type": "enum"
      },
      {
        "name": "Triggerer Entity",
        "type": "entity"
      },
      {
        "name": "Triggerer Entity GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_shield_is_attacked",
    "name": "When Shield Is Attacked",
    "category": "event",
    "folder": "XIII. Unit Status",
    "description": "Adds the Unit Status effect [Add Shield] to the Entity. This event is triggered when the Shield takes damage.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity"
      },
      {
        "name": "Event Source GUID",
        "type": "guid"
      },
      {
        "name": "Attacker Entity",
        "type": "entity"
      },
      {
        "name": "Attacker GUID",
        "type": "guid"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      },
      {
        "name": "Pre-Attack Layers",
        "type": "int"
      },
      {
        "name": "Post-Attack Layers",
        "type": "int"
      },
      {
        "name": "Shield Value of this Unit Status Before Attack",
        "type": "float"
      },
      {
        "name": "Shield Value of this Unit Status After Attack",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": true
  },
{
    "id": "event_when_tab_selected",
    "name": "When Tab Is Selected",
    "category": "event",
    "folder": "XIV. Tabs",
    "description": "When the active tab is selected, it will send an event to the node graph. The Entity Node Graph configured by the Tab Component will receive this event.",
    "inputs": [],
    "outputs": [
      {
        "name": "Event Source Entity",
        "type": "entity",
        "description": "Entity with the tab component mounted"
      },
      {
        "name": "Event Source GUID",
        "type": "guid",
        "description": "GUID of the Entity with the tab component mounted; outputs 0 if none exists"
      },
      {
        "name": "Tab ID",
        "type": "int",
        "description": "ID of the tab"
      },
      {
        "name": "Selector Entity",
        "type": "entity",
        "description": "Character Entity that triggers the tab"
      }
    ],
    "execIn": false,
    "execOut": true
  }
];

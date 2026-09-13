/**
 * EXECUTION_NODES - part 1
 */
export const EXECUTION_NODES_A = [
{
    "id": "exec_print_string",
    "name": "Print String",
    "category": "execution",
    "folder": "I. Common Nodes",
    "description": "Outputs a string to the log, generally used for logic checks and debugging. In the log, this string prints whenever the logic runs successfully, regardless of whether this Node Graph is toggled.",
    "inputs": [
      {
        "name": "String",
        "type": "string",
        "description": "The string to be printed",
        "defaultVal": "",
        "placeholder": "String"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_local_var",
    "name": "Set Local Variable",
    "category": "execution",
    "folder": "I. Common Nodes",
    "description": "When connected to the Query Node `Get Local Variable`, this overwrites the value of that Local Variable.",
    "inputs": [
      {
        "name": "Local Variable",
        "type": "local_var",
        "description": "Container for data storage"
      },
      {
        "name": "Value",
        "type": "generic",
        "description": "Value used to overwrite this local variable",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_break_loop",
    "name": "Break Loop",
    "category": "execution",
    "folder": "I. Common Nodes",
    "description": "Break out of a Finite Loop or List Iteration Loop. The output pin must be connected to the `Break Loop` input pin of the `Finite Loop` or `List Iteration Loop` node.",
    "inputs": [],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_finite_loop",
    "name": "Finite Loop",
    "category": "execution",
    "folder": "I. Common Nodes",
    "description": "From the `Loop Start Value` to the `Loop End Value`, the loop iterates, incrementing the Integer by 1 each time. On each iteration, it executes the Nodes connected to `Loop Body`. After a full iteration, it executes the Nodes connected to `Loop Complete`. Use `Break Loop` to end the iteration early. After exiting the loop, the logic connected to the `Loop Complete` node will also be executed.",
    "inputs": [
      {
        "name": "Start",
        "type": "int",
        "description": "Loop includes this value",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "End",
        "type": "int",
        "description": "Loop includes this value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Current",
        "type": "int",
        "description": "Integer value of the current execution logic"
      }
    ],
    "execIn": true,
    "execInputs": [
      "execIn",
      "Break Loop"
    ],
    "execOut": [
      {
        "name": "Loop Body",
        "pinType": "exec"
      },
      {
        "name": "Loop Complete",
        "pinType": "exec"
      }
    ]
  },
{
    "id": "exec_forwarding_event",
    "name": "Forwarding Event",
    "category": "execution",
    "folder": "I. Common Nodes",
    "description": "Forwards the source event of this Node's Execution Flow to the specified Target Entity. The event with the same name on the Target Entity's Node Graph will be triggered.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Target entity being forwarded"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_insert_value_into_list",
    "name": "Insert Value Into List",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Insert a value at the specified ID Location in the specified List. The inserted value appears at that ID after insertion. For example: Inserting 5 at ID 2 in the List `[1, 2, 3, 4]` results in `[1, 2, 5, 3, 4]` (5 appears at ID 2).",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "description": "Reference to the list being inserted",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Insert ID",
        "type": "int",
        "description": "ID of the inserted value (after insertion)",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Insert Value",
        "type": "generic",
        "description": "Value to be inserted",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_list_value",
    "name": "Set List Value",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Sets the value at a specified index position in a specified list.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "description": "Edited list reference",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "ID",
        "type": "int",
        "description": "ID of edited value",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Value",
        "type": "generic",
        "description": "Edited Value",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_value_from_list",
    "name": "Remove Value From List",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Remove the value at the specified ID Location from the specified List. All subsequent values shift forward by one position.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "description": "Reference to the list of values to remove",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Remove ID",
        "type": "int",
        "description": "ID to remove",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_list_iteration_loop",
    "name": "List Iteration Loop",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Iterate through the specified List in sequential order.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "description": "List to iterate through",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Value",
        "type": "generic",
        "description": "Each value in the list",
        "hasGear": true
      }
    ],
    "execIn": true,
    "execInputs": [
      "execIn",
      "Break Loop"
    ],
    "execOut": [
      {
        "name": "Loop Body",
        "pinType": "exec"
      },
      {
        "name": "Loop Complete",
        "pinType": "exec"
      }
    ]
  },
{
    "id": "exec_list_sorting",
    "name": "List Sorting",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Sort the specified List according to the chosen sort method.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "description": "Integer List or Floating Point Number List",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Sort By",
        "type": "enum",
        "description": "Ascending or Descending",
        "options": [
          "Ascending",
          "Descending"
        ],
        "defaultVal": "Ascending"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_concatenate_list",
    "name": "Concatenate List",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Append the input List to the end of the Target List. For example, Target List `[1, 2, 3]` with input `[4, 5]` becomes `[1, 2, 3, 4, 5]` after execution.",
    "inputs": [
      {
        "name": "Target List",
        "type": "generic",
        "description": "List being input",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Input List",
        "type": "generic",
        "description": "The input list will be added to the end of the Target list",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_clear_list",
    "name": "Clear List",
    "category": "execution",
    "folder": "II. List Operations",
    "description": "Clear the specified List.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "description": "List to be cleared",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_node_graph_var",
    "name": "Set Node Graph Variable",
    "category": "execution",
    "folder": "III. Custom Variables",
    "description": "Set the value of the specified Node Graph Variable in the current Node Graph.",
    "inputs": [
      {
        "name": "Variable Name",
        "type": "string",
        "description": "Name of the Node Graph Variable. Must be unique within the same Node Graph",
        "defaultVal": "",
        "placeholder": "Variable Name"
      },
      {
        "name": "Variable Value",
        "type": "generic",
        "description": "Value assigned to this variable",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Trigger Event",
        "type": "bool",
        "description": "Default: True. If set to False, this Node Graph Variable editing will not trigger the Variable Change Event",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_custom_var",
    "name": "Set Custom Variable",
    "category": "execution",
    "folder": "III. Custom Variables",
    "description": "Set the value of the specified Custom Variable on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "The variable is mounted on this entity"
      },
      {
        "name": "Variable Name",
        "type": "string",
        "description": "Custom variable name. Must be unique",
        "defaultVal": "",
        "placeholder": "Variable Name"
      },
      {
        "name": "Variable Value",
        "type": "generic",
        "description": "Value assigned to this variable",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Trigger Event",
        "type": "bool",
        "description": "Default: True. When set to False, this custom variable editing will not trigger the On Custom Variable Change event",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_preset_status",
    "name": "Set Preset Status",
    "category": "execution",
    "folder": "IV. Preset Status",
    "description": "Set the Preset Status of the specified Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Preset Status set for the entity"
      },
      {
        "name": "Preset Status Index",
        "type": "int",
        "description": "The unique identifier for the Preset Status",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Preset Status Value",
        "type": "int",
        "description": "Generally `0` for off, `1` for on",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_create_entity",
    "name": "Create Entity",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Create an Entity by GUID. The Entity must be pre-placed in the Scene.",
    "inputs": [
      {
        "name": "Target GUID",
        "type": "guid",
        "description": "Identifier for this entity"
      },
      {
        "name": "Unit Tag Index List",
        "type": "int",
        "description": "Determines the Unit Tags carried when this entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_create_prefab",
    "name": "Create Prefab",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Create an Entity by Prefab ID.",
    "inputs": [
      {
        "name": "Prefab ID",
        "type": "prefab_id",
        "description": "Identifier for this Prefab"
      },
      {
        "name": "Location",
        "type": "vector3",
        "description": "Absolute Location"
      },
      {
        "name": "Rotate",
        "type": "vector3",
        "description": "Absolute Rotation"
      },
      {
        "name": "Owner Entity",
        "type": "entity",
        "description": "Determines whether the created entity belongs to another entity"
      },
      {
        "name": "Overwrite Level",
        "type": "bool",
        "description": "When set to False, the `Level` parameter has no effect",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Level",
        "type": "int",
        "description": "Determines the Level when the entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Unit Tag Index List",
        "type": "int",
        "description": "Determines the Unit Tags carried when this entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Created Entity",
        "type": "entity",
        "description": "Entities created in this way do not have a GUID"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_create_prefab_group",
    "name": "Create Prefab Group",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Create the Entities contained in the Prefab Group by Prefab Group ID.",
    "inputs": [
      {
        "name": "Prefab Group ID",
        "type": "int",
        "description": "Identifier for this Prefab Group",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Location",
        "type": "vector3",
        "description": "Absolute Location of the Prefab Group center"
      },
      {
        "name": "Rotate",
        "type": "vector3",
        "description": "Absolute Rotation of the Prefab Group center"
      },
      {
        "name": "Owner Entity",
        "type": "entity",
        "description": "Determines whether the entity belongs to another entity after creation"
      },
      {
        "name": "Level",
        "type": "int",
        "description": "Determines the Level when the entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Unit Tag Index List",
        "type": "int",
        "description": "Determines the Unit Tags carried when the entity is created",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Overwrite Level",
        "type": "bool",
        "description": "When set to False, the `Level` parameter has no effect",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [
      {
        "name": "Created Entity List",
        "type": "entity",
        "description": "Entities created in this way do not have a GUID"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_activate_disable_model_display",
    "name": "Activate/Disable Model Display",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Edit the Entity's Model Visibility attribute to make its Model visible or hidden.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "The entity to be edited"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "Set to True to make the model visible",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_destroy_entity",
    "name": "Destroy Entity",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Destroying a specified entity will result in a destruction effect and can also trigger logic that only occurs after destruction, such as end-of-life behaviors in local projectiles or the dropping of energy orbs from destroyed creations. The `When Entity Is Destroyed` and `When Entity Is Removed/Destroyed` events can be monitored on Stage Entities.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "The entity to be destroyed"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_entity",
    "name": "Remove Entity",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Removing a specified entity is different from destroying it; there will be no destruction effect, and it will not trigger any logic that would occur after destruction, such as end-of-life behaviors in local projectiles or the dropping of energy orbs from removed creations. Removing an Entity does not trigger the `On Entity Destroyed` event, but it can trigger the `On Entity Removed/Destroyed` event.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "The entity to be removed"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_edit_model_color_material",
    "name": "Edit Model Color & Material",
    "category": "execution",
    "folder": "V. Entity Related",
    "description": "Enables or disables the entity model's material and color blend settings, and modifies the assigned material, color blend mode, and override color.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Overwrite Color Configurations",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Enable Custom Color?",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Fill Color",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Color Opacity",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Color Blend Type",
        "type": "enum"
      },
      {
        "name": "Overwrite Material Configurations",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Enable Custom Material?",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Fill Material Type",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_settle_stage",
    "name": "Settle Stage",
    "category": "execution",
    "folder": "VI. Stage Related",
    "description": "Triggers the Stage Settlement process, which executes out-of-stage logic as defined in Stage Settlement.",
    "inputs": [],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_current_environment_time",
    "name": "Set Current Environment Time",
    "category": "execution",
    "folder": "VI. Stage Related",
    "description": "Instantly switch Environment Time to the specified hour. The parameter must be a Floating Point Number between 0 and 24. If the target hour is earlier than the current hour, it is treated as the next day (+1 day).",
    "inputs": [
      {
        "name": "Environment Time",
        "type": "float",
        "description": "Must be a floating point value between 0–24; this Node will not take effect if the value is outside this range",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_environment_time_passage_speed",
    "name": "Set Environment Time Passage Speed",
    "category": "execution",
    "folder": "VI. Stage Related",
    "description": "Minutes elapsed per second, limited to 0 - 60 (Teyvat speed is 1).",
    "inputs": [
      {
        "name": "Environment Time Passage Speed",
        "type": "float",
        "description": "Clamped to the range 0–60. Values outside this range are automatically set to 0 or 60",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_entity_faction",
    "name": "Set Entity Faction",
    "category": "execution",
    "folder": "VII. Faction Related",
    "description": "Set the faction of the specified target entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity whose faction is to be edited"
      },
      {
        "name": "Faction",
        "type": "faction",
        "description": "Edited Faction"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_teleport_player",
    "name": "Teleport Player",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Teleport the specified Player Entity. A loading interface may appear depending on teleport distance. If teleporting onto an object, ensure the target Y-coordinate is slightly higher than the landing position.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Target Location",
        "type": "vector3",
        "description": "Absolute Location"
      },
      {
        "name": "Target Rotation",
        "type": "vector3",
        "description": "Absolute Rotation"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_revive_character",
    "name": "Revive Character",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Available only in Beyond Mode, revive the specified Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity",
        "description": "The Character Entity to be revived"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_revive_all_player_s_characters",
    "name": "Revive All Player's Characters",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Revive all character entities of a specified player, but this node is only effective when the player is in a state where all their characters are down. In Beyond Mode, since each player has only one character, this node has the same effect as the `Revive Character` node. In Classic Mode, players can have multiple characters. If only some of the characters are down, this node will not take effect, meaning it will not revive the downed characters.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "The Player Entity that owns the Character"
      },
      {
        "name": "Deduct Revives",
        "type": "bool",
        "description": "If set to False, the Revive Count will not be deducted",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_defeat_all_player_s_characters",
    "name": "Defeat All Player's Characters",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Knock down all characters of the specified player, causing the player to enter `When All Player's Characters Are Down` state.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "The Player Entity that owns the Character"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_activate_revive_point",
    "name": "Activate Revive Point",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Activate the specified Revive Point ID for the player. When the player later triggers Revive logic, they can revive at this Revive Point.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Revive Point ID",
        "type": "int",
        "description": "Identifier for this Revive Point",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_revive_time",
    "name": "Set Player Revive Time",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Set the duration for the Player's next revive. If the Player is currently reviving, this does not affect the ongoing revive process.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Duration",
        "type": "int",
        "description": "Unit in seconds",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_remaining_revives",
    "name": "Set Player Remaining Revives",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Set the remaining number of revives for the specified Player. When set to 0, the Player cannot revive.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Remaining Times",
        "type": "int",
        "description": "When set to 0, the player will not be revived",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_environment_configuration",
    "name": "Set Environment Configuration",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Apply the specified Environment Configuration to the designated player. Takes effect immediately upon execution.",
    "inputs": [
      {
        "name": "Environment Config Index",
        "type": "int",
        "description": "Identifier for this Environment Configuration",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Target Player List",
        "type": "entity",
        "description": "Applies only to Players in the specified list"
      },
      {
        "name": "Enable Weather Config",
        "type": "bool",
        "description": "Set to True to enable",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Weather Config Index",
        "type": "int",
        "description": "The Weather Configuration matching this ID will take effect. If the ID does not exist, nothing happens",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_allow_forbid_player_to_revive",
    "name": "Allow/Forbid Player to Revive",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Set whether the specified player is allowed to revive.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Allow",
        "type": "bool",
        "description": "If set to True, reviving is allowed",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_deactivate_revive_point",
    "name": "Deactivate Revive Point",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Unregister the specified Revive Point ID for the player. The layer will not revive at this Revive Point next time.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Revive Point ID",
        "type": "int",
        "description": "Identifier for this Revive Point",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_character_s_elemental_energy",
    "name": "Set Character's Elemental Energy",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Available only in Classic Mode, sets the elemental energy for a specific character.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Elemental Energy",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increases_character_s_elemental_energy",
    "name": "Increases Character's Elemental Energy",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Available only in Classic Mode, increases the elemental energy for a specific character.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Elemental Energy Increase Value",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_revive_the_active_character",
    "name": "Revive the active character",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Available only in Classic Mode, revive the defeated active character entity of the specified player.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_teleport_player_classic_mode",
    "name": "Teleport Player (Classic Mode)",
    "category": "execution",
    "folder": "VIII. Player and Character Related",
    "description": "Teleports the specified Player Entity. A loading screen may appear depending on the travel distance. If teleporting onto an object, the target position's Y-coordinate must be slightly higher than the point of landing.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player"
      },
      {
        "name": "Target Location",
        "type": "vector3",
        "description": "Absolute position"
      },
      {
        "name": "Target Rotation",
        "type": "vector3",
        "description": "Absolute rotation"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  }
];

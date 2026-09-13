/**
 * QUERY_NODES - part 1
 */
export const QUERY_NODES_A = [
{
    "id": "query_query_game_mode_and_player_number",
    "name": "Query Game Mode and Player Number",
    "category": "query",
    "folder": "I. General",
    "description": "Searches the theoretical number of players entering the match, including players via Matchmaking or Room creation, and the method of entry.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Count",
        "type": "int"
      },
      {
        "name": "Gameplay Mode",
        "type": "enum",
        "description": "Includes Playtest, Room Play, and Matchmaking Play"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_local_variable",
    "name": "Get Local Variable",
    "category": "query",
    "folder": "I. General",
    "description": "Retrieves a Local Variable and optionally sets its [Initial Value]. After setting the [Initial Value], the [Value] output parameter will be equal to the input [Initial Value]. When the output [Local Variable] is connected to the [Set Local Variable] Execution Node's input [Local Variable], the input [Value] of [Set Local Variable] overwrites this Search Node's output [Value]. The next time you use [Get Local Variable], the output [Value] is the overwritten value.",
    "inputs": [
      {
        "name": "Initial Value",
        "type": "generic",
        "description": "Allows you to set the default initial value for local variables",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Local Variable",
        "type": "local_var",
        "description": "Container for data storage"
      },
      {
        "name": "Value",
        "type": "generic",
        "description": "When not Overwritten, this value equals the Initial Value; after it is Overwritten, it equals the new value",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_server_time_zone",
    "name": "Query Server Time Zone",
    "category": "query",
    "folder": "II. Math",
    "description": "Searches the Server's timezone.",
    "inputs": [],
    "outputs": [
      {
        "name": "Time Zone",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_timestamp_utc_0",
    "name": "Query Timestamp (UTC+0)",
    "category": "query",
    "folder": "II. Math",
    "description": "Searches the current timestamp.",
    "inputs": [],
    "outputs": [
      {
        "name": "Timestamp",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_random_floating_point_number",
    "name": "Get Random Floating Point Number",
    "category": "query",
    "folder": "II. Math",
    "description": "Returns a random Floating Point Number that is ≥ the lower limit and ≤ the upper limit. The range is inclusive.",
    "inputs": [
      {
        "name": "Lower Limit",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Upper Limit",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [
      {
        "name": "Result",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_random_int",
    "name": "Get Random Integer",
    "category": "query",
    "folder": "II. Math",
    "description": "Returns a random Integer that is ≥ the lower limit and ≤ the upper limit. The range is inclusive.",
    "inputs": [
      {
        "name": "Lower Limit",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Upper Limit",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Result",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_weighted_random",
    "name": "Weighted Random",
    "category": "query",
    "folder": "II. Math",
    "description": "Takes a list of weights and randomly selects an ID based on the weight distribution. For example, with a weight list `{10, 20, 66, 4}`, this node outputs `0`, `1`, `2`, or `3` with probabilities `10%`, `20%`, `66%`, and `4%` respectively.",
    "inputs": [
      {
        "name": "Weight List",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Weight ID",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_3d_vector_backward",
    "name": "3D Vector: Backward",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(0,0,-1)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(0,0,-1)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_3d_vector_zero_vector",
    "name": "3D Vector: Zero Vector",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(0,0,0)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(0,0,0)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_vector3_forward",
    "name": "3D Vector: Forward",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(0,0,1)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(0,0,1)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_3d_vector_up",
    "name": "3D Vector: Up",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(0,1,0)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(0,1,0)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_3d_vector_down",
    "name": "3D Vector: Down",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(0,-1,0)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(0,-1,0)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_3d_vector_right",
    "name": "3D Vector: Right",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(1,0,0)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(1,0,0)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_3d_vector_left",
    "name": "3D Vector: Left",
    "category": "query",
    "folder": "II. Math",
    "description": "Return `(-1,0,0)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "(-1,0,0)",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_pi",
    "name": "Pi (π)",
    "category": "query",
    "folder": "II. Math",
    "description": "Returns the approximate value of π (≈ 3.142).",
    "inputs": [],
    "outputs": [
      {
        "name": "Pi (π)",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_search_list_and_return_value_id",
    "name": "Search List and Return Value ID",
    "category": "query",
    "folder": "III. List Related",
    "description": "Find the specified value in the list and return a list of IDs where it appears. For example, if the target list is `{1,2,3,2,1}` and the value is `1`, the returned ID list is `{0,4}`, meaning `1` appears at IDs `0` and `4` in the target list.",
    "inputs": [
      {
        "name": "Target List",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Value",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "ID List",
        "type": "int",
        "description": "Returns an empty list if not found"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_val_from_list",
    "name": "Get Corresponding Value From List",
    "category": "query",
    "folder": "III. List Related",
    "description": "Returns the value at the specified ID in the list (0-based).",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Value",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_list_length",
    "name": "Get List Length",
    "category": "query",
    "folder": "III. List Related",
    "description": "Returns the length of the list (number of elements).",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Length",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_maximum_value_from_list",
    "name": "Get Maximum Value from List",
    "category": "query",
    "folder": "III. List Related",
    "description": "Applies only to Floating Point Number or Integer lists; returns the maximum value.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Maximum Value",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_minimum_value_from_list",
    "name": "Get Minimum Value From List",
    "category": "query",
    "folder": "III. List Related",
    "description": "Applies only to Floating Point Number or Integer lists; returns the minimum value.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Minimum Value",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_list_includes_this_value",
    "name": "List Includes This Value",
    "category": "query",
    "folder": "III. List Related",
    "description": "Returns whether the list contains the specified value.",
    "inputs": [
      {
        "name": "List",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Value",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Include",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_custom_variable_snapshot",
    "name": "Query Custom Variable Snapshot",
    "category": "query",
    "folder": "IV. Custom Variables",
    "description": "Searches the value of the specified Variable Name from the Custom Variable Component snapshot. Only available for the [On Entity Destroyed] event.",
    "inputs": [
      {
        "name": "Custom Variable Component Snapshot",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Variable Name",
        "type": "string",
        "defaultVal": "",
        "placeholder": "Variable Name"
      }
    ],
    "outputs": [
      {
        "name": "Variable Value",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_node_graph_var",
    "name": "Get Node Graph Variable",
    "category": "query",
    "folder": "IV. Custom Variables",
    "description": "Returns the value of the specified Node Graph Variable from the current Node Graph. If the variable does not exist, returns the type's default value.",
    "inputs": [
      {
        "name": "Variable Name",
        "type": "string",
        "defaultVal": "",
        "placeholder": "Variable Name"
      }
    ],
    "outputs": [
      {
        "name": "Variable Value",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_custom_var",
    "name": "Get Custom Variable",
    "category": "query",
    "folder": "IV. Custom Variables",
    "description": "Returns the value of the specified Custom Variable from the Target Entity. If the variable does not exist, returns the type's default value.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Variable Name",
        "type": "string",
        "defaultVal": "IsOpen",
        "placeholder": "Variable Name"
      }
    ],
    "outputs": [
      {
        "name": "Variable Value",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_preset_status",
    "name": "Get Preset Status",
    "category": "query",
    "folder": "V. Preset Status",
    "description": "Returns the value of the specified Preset Status for the Target Entity. Returns `0` if the Entity does not have that Preset Status.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Preset Status Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Preset Status Value",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_character_s_current_movement_spd",
    "name": "Query Character's Current Movement SPD",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Can only be searched when the Character has the [Monitor Movement Speed] Unit Status effect.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Current Speed",
        "type": "float"
      },
      {
        "name": "Velocity Vector",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_entity_is_on_the_field",
    "name": "Query If Entity Is on the Field",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Searches whether the specified Entity is present. Note that Character Entities are still considered present even when Downed.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "On the Field",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_entities_on_the_field",
    "name": "Get All Entities on the Field",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns all Entities currently present in the scene. The number of Entities in this List may be large.",
    "inputs": [],
    "outputs": [
      {
        "name": "Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_specified_type_of_entities_on_the_field",
    "name": "Get Specified Type of Entities on the Field",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns all Entities of the specified type currently in the scene. The number of Entities in this list may be large.",
    "inputs": [
      {
        "name": "Entity Type",
        "type": "enum",
        "description": "Includes Stage, Object, Player, Character, Creation"
      }
    ],
    "outputs": [
      {
        "name": "Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entities_with_specified_prefab_on_the_field",
    "name": "Get Entities With Specified Prefab on the Field",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns all Entities currently in the scene that were created by the specified Prefab ID.",
    "inputs": [
      {
        "name": "Prefab ID",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_character_attr",
    "name": "Get Character Attribute",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Base Attributes of the Character Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Level",
        "type": "int"
      },
      {
        "name": "Current HP",
        "type": "float"
      },
      {
        "name": "Max HP",
        "type": "float"
      },
      {
        "name": "Current ATK",
        "type": "float"
      },
      {
        "name": "Base ATK",
        "type": "float"
      },
      {
        "name": "Current DEF",
        "type": "float"
      },
      {
        "name": "Base DEF",
        "type": "float"
      },
      {
        "name": "Interrupt Value Threshold",
        "type": "float"
      },
      {
        "name": "Current Interrupt Value",
        "type": "float"
      },
      {
        "name": "Current Interrupt Status",
        "type": "enum"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_advanced_attribute",
    "name": "Get Entity Advanced Attribute",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Advanced Attributes of the Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "CRIT Rate",
        "type": "float"
      },
      {
        "name": "CRIT DMG",
        "type": "float"
      },
      {
        "name": "Healing Bonus",
        "type": "float"
      },
      {
        "name": "Incoming Healing Bonus",
        "type": "float"
      },
      {
        "name": "Energy Recharge",
        "type": "float"
      },
      {
        "name": "CD Reduction",
        "type": "float"
      },
      {
        "name": "Beyond Mode Shield Strength",
        "type": "float"
      },
      {
        "name": "Classic Mode Shield Strength",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_type",
    "name": "Get Entity Type",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Entity Type of the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Entity Type",
        "type": "enum",
        "description": "Includes Player, Character, Stage, Object, Creation"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_location_rotation",
    "name": "Get Entity Location and Rotation",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Location and Rotation of the Target Entity. Not applicable to Player Entities or Stage Entities.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Location",
        "type": "vector3"
      },
      {
        "name": "Rotate",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_forward_vector",
    "name": "Get Entity Forward Vector",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Forward Vector of the specified Entity (the positive Z-axis direction in the Entity's relative coordinate system).",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Forward Vector",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_upward_vector",
    "name": "Get Entity Upward Vector",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Upward Vector of the specified Entity (the positive Y-axis direction in the Entity's relative coordinate system).",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Upward Vector",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_right_vector",
    "name": "Get Entity Right Vector",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Right Vector of the specified Entity (the positive X-axis direction in the Entity's relative coordinate system).",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Right Vector",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_list_of_entities_owned_by_the_entity",
    "name": "Get List of Entities Owned by the Entity",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns a list of all Entities owned by the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_elemental_attribute",
    "name": "Get Entity Elemental Attribute",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Element Attributes of the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Pyro DMG Bonus",
        "type": "float"
      },
      {
        "name": "Pyro RES",
        "type": "float"
      },
      {
        "name": "Hydro DMG Bonus",
        "type": "float"
      },
      {
        "name": "Hydro RES",
        "type": "float"
      },
      {
        "name": "Dendro DMG Bonus",
        "type": "float"
      },
      {
        "name": "Dendro RES",
        "type": "float"
      },
      {
        "name": "Electro DMG Bonus",
        "type": "float"
      },
      {
        "name": "Electro RES",
        "type": "float"
      },
      {
        "name": "Anemo DMG Bonus",
        "type": "float"
      },
      {
        "name": "Anemo RES",
        "type": "float"
      },
      {
        "name": "Cryo DMG Bonus",
        "type": "float"
      },
      {
        "name": "Cryo RES",
        "type": "float"
      },
      {
        "name": "Geo DMG Bonus",
        "type": "float"
      },
      {
        "name": "Geo RES",
        "type": "float"
      },
      {
        "name": "Physical DMG Bonus",
        "type": "float"
      },
      {
        "name": "Physical RES",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_object_attribute",
    "name": "Get Object Attribute",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Base Attributes of the Object.",
    "inputs": [
      {
        "name": "Object Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Level",
        "type": "int"
      },
      {
        "name": "Current HP",
        "type": "float"
      },
      {
        "name": "Max HP",
        "type": "float"
      },
      {
        "name": "Current ATK",
        "type": "float"
      },
      {
        "name": "Base ATK",
        "type": "float"
      },
      {
        "name": "Current DEF",
        "type": "float"
      },
      {
        "name": "Base DEF",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_owner_entity",
    "name": "Get Owner Entity",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Owner Entity of the specified Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Owner Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_list_by_specified_range",
    "name": "Get Entity List by Specified Range",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns a list of Entities within a specified spherical range from the Target Entity List.",
    "inputs": [
      {
        "name": "Target Entity List",
        "type": "entity"
      },
      {
        "name": "Center Point",
        "type": "vector3"
      },
      {
        "name": "Radius",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [
      {
        "name": "Result List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_list_by_specified_type",
    "name": "Get Entity List by Specified Type",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns a list of specified Entity types from the Target Entity List.",
    "inputs": [
      {
        "name": "Target Entity List",
        "type": "entity"
      },
      {
        "name": "Entity Type",
        "type": "enum",
        "description": "Includes Player, Character, Stage, Object, Creation"
      }
    ],
    "outputs": [
      {
        "name": "Result List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_list_by_specified_prefab_id",
    "name": "Get Entity List by Specified Prefab ID",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns a list of Entities created with the specified Prefab ID from the Target Entity List.",
    "inputs": [
      {
        "name": "Target Entity List",
        "type": "entity"
      },
      {
        "name": "Prefab ID",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      }
    ],
    "outputs": [
      {
        "name": "Result List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_list_by_specified_faction",
    "name": "Get Entity List by Specified Faction",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the list of Entities belonging to a specific Faction from the Target Entity List.",
    "inputs": [
      {
        "name": "Target Entity List",
        "type": "entity"
      },
      {
        "name": "Faction",
        "type": "faction"
      }
    ],
    "outputs": [
      {
        "name": "Result List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_self_entity",
    "name": "Get Self Entity",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Returns the Entity associated with this Node Graph.",
    "inputs": [],
    "outputs": [
      {
        "name": "Self Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_guid_by_entity",
    "name": "Query GUID by Entity",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Searches for the GUID of the specified Entity.",
    "inputs": [
      {
        "name": "Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_entity_by_guid",
    "name": "Query Entity by GUID",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Searches for an Entity by GUID.",
    "inputs": [
      {
        "name": "GUID",
        "type": "guid"
      }
    ],
    "outputs": [
      {
        "name": "Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_check_entity_s_elemental_effect_status",
    "name": "Check Entity's Elemental Effect Status",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Check entity's elemental effect status.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Affected by Hydro",
        "type": "bool"
      },
      {
        "name": "Affected by Cryo",
        "type": "bool"
      },
      {
        "name": "Affected by Electro",
        "type": "bool"
      },
      {
        "name": "Affected by Pyro",
        "type": "bool"
      },
      {
        "name": "Affected by Dendro",
        "type": "bool"
      },
      {
        "name": "Affected by Anemo",
        "type": "bool"
      },
      {
        "name": "Affected by Geo",
        "type": "bool"
      },
      {
        "name": "Affected by Frozen",
        "type": "bool"
      },
      {
        "name": "Affected by Electro-Charged",
        "type": "bool",
        "description": "Lunar-Charged is not considered as Electro-Charged"
      },
      {
        "name": "Affected by Burning",
        "type": "bool"
      },
      {
        "name": "Affected by Petrification",
        "type": "bool"
      },
      {
        "name": "Affected by Catalyze",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_model_color_material",
    "name": "Get Model Color & Material",
    "category": "query",
    "folder": "VI. Entity Related",
    "description": "Retrieves the enabled states of the entity model's material and color override settings, along with the assigned material, color blend mode, and override color.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Enable Custom Color?",
        "type": "bool"
      },
      {
        "name": "Color Blend Mode",
        "type": "enum"
      },
      {
        "name": "Color",
        "type": "int"
      },
      {
        "name": "Color Opacity",
        "type": "float"
      },
      {
        "name": "Enable Custom Material?",
        "type": "bool"
      },
      {
        "name": "Material",
        "type": "enum"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_current_env_time",
    "name": "Query Current Environment Time",
    "category": "query",
    "folder": "VII. Stage Related",
    "description": "Searches the current Environment Time, in the range `[0, 24)`.",
    "inputs": [],
    "outputs": [
      {
        "name": "Current Environment Time",
        "type": "float",
        "description": "The value range is `[0, 24)`"
      },
      {
        "name": "Current Loop Day",
        "type": "int",
        "description": "Number of Loop Days elapsed"
      }
    ],
    "execIn": false,
    "execOut": false
  }
];

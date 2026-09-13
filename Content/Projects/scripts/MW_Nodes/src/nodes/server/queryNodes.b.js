/**
 * QUERY_NODES - part 2
 */
export const QUERY_NODES_B = [
{
    "id": "query_query_game_time_elapsed",
    "name": "Query Game Time Elapsed",
    "category": "query",
    "folder": "VII. Stage Related",
    "description": "Searches how long the game has been running, in seconds.",
    "inputs": [],
    "outputs": [
      {
        "name": "Game Time Elapsed",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_entity_faction",
    "name": "Query Entity Faction",
    "category": "query",
    "folder": "VIII. Faction Related",
    "description": "Searches the Faction of the specified Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Faction",
        "type": "faction"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_faction_is_hostile",
    "name": "Query If Faction Is Hostile",
    "category": "query",
    "folder": "VIII. Faction Related",
    "description": "Searches whether two Factions are hostile to each other.",
    "inputs": [
      {
        "name": "Faction 1",
        "type": "faction"
      },
      {
        "name": "Faction 2",
        "type": "faction"
      }
    ],
    "outputs": [
      {
        "name": "Hostile",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_all_player_characters_are_down",
    "name": "Query If All Player Characters Are Down",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Check if all of the player's characters are downed.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Result",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_guid_by_player_id",
    "name": "Get Player GUID by Player ID",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the Player GUID based on Player ID, where the ID indicates which Player they are.",
    "inputs": [
      {
        "name": "Player ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Player GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_id_by_player_guid",
    "name": "Get Player ID by Player GUID",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the Player ID based on Player GUID, where the ID indicates which Player they are.",
    "inputs": [
      {
        "name": "Player GUID",
        "type": "guid"
      }
    ],
    "outputs": [
      {
        "name": "Player ID",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_client_input_device_type",
    "name": "Get Player Client Input Device Type",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the Player's local input device type, as determined by the Interface mapping method.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Input Device Type",
        "type": "enum",
        "description": "Includes keyboard/mouse, gamepad, touchscreen"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_entity_to_which_the_character_belongs",
    "name": "Get Player Entity to Which the Character Belongs",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the Player Entity that owns the Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Affiliated Player Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_revive_time",
    "name": "Get Player Revive Time",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the revive duration of the specified Player Entity, in seconds.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Duration",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_nickname",
    "name": "Get Player Nickname",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the Player's nickname.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Player Nickname",
        "type": "string"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_remaining_revives",
    "name": "Get Player Remaining Revives",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns the remaining number of revives for the specified Player Entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Remaining Times",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_list_of_player_entities_on_the_field",
    "name": "Get List of Player Entities on the Field",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns a list of all Player Entities present in the scene.",
    "inputs": [],
    "outputs": [
      {
        "name": "Player Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_character_entities_of_specified_player",
    "name": "Get All Character Entities of Specified Player",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Returns a list of all Character Entities for the specified Player Entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Character Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_active_character_of_specified_player",
    "name": "Get Active Character of Specified Player",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Available only in Classic Mode; get the active character in the player's party.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Active Character Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_check_classic_mode_character_id",
    "name": "Check Classic Mode Character ID",
    "category": "query",
    "folder": "IX. Player and Character Related",
    "description": "Available only in Classic Mode. You can search for the character ID of the target character to see the appendix for the specific character in Classic Mode Character ID List.",
    "inputs": [
      {
        "name": "Target Character",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Character ID",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_follow_motion_device_target",
    "name": "Get Follow Motion Device Target",
    "category": "query",
    "folder": "X. Follow Motion Device",
    "description": "Returns the Target of the Follow Motion Device, including the Target Entity and its GUID.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Follow Target Entity",
        "type": "entity"
      },
      {
        "name": "Follow Target GUID",
        "type": "guid"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_current_global_timer_time",
    "name": "Get Current Global Timer Time",
    "category": "query",
    "folder": "XI. Global Timer",
    "description": "Returns the current time of the specified Global Timer on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Timer Name",
        "type": "string",
        "defaultVal": "",
        "placeholder": "Timer Name"
      }
    ],
    "outputs": [
      {
        "name": "Current Time",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_s_current_ui_layout",
    "name": "Get Player's Current UI Layout",
    "category": "query",
    "folder": "XII. UI Control Groups",
    "description": "Returns the ID of the currently active Interface Layout on the specified Player Entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Layout Index",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_creation_s_current_target",
    "name": "Get Creation's Current Target",
    "category": "query",
    "folder": "XIII. Creation",
    "description": "The Target Entity varies with the Creation's current behavior. For example, when a Creation is attacking, its Target is the specified enemy Entity. For example, when a Creation is healing allies, its Target is the specified allied Entity.",
    "inputs": [
      {
        "name": "Creation Entity",
        "type": "entity",
        "description": "Runtime Creation Entity"
      }
    ],
    "outputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Current intelligently selected Target Entity of the Creation"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_aggro_list_of_creation_in_default_mode",
    "name": "Get Aggro List of Creation in Default Mode",
    "category": "query",
    "folder": "XIII. Creation",
    "description": "Returns the Aggro List in Default Mode. This Node only outputs a valid list when the Aggro Configuration is set to [Default Type].",
    "inputs": [
      {
        "name": "Creation Entity",
        "type": "entity",
        "description": "Runtime Creation Entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro List",
        "type": "entity",
        "description": "Unordered list of Entities this Creation currently has Aggro against"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_creation_attribute",
    "name": "Get Creation Attribute",
    "category": "query",
    "folder": "XIII. Creation",
    "description": "Returns the Attributes of the specified Creation.",
    "inputs": [
      {
        "name": "Creation Entity",
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
    "id": "query_query_player_class_level",
    "name": "Query Player Class Level",
    "category": "query",
    "folder": "XIV. Class",
    "description": "Searches the Player's Level of the specified Class.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Class Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Level",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_player_class",
    "name": "Query Player Class",
    "category": "query",
    "folder": "XIV. Class",
    "description": "Searches the Player's current Class; outputs the Config ID of that Class.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Class Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_character_skill",
    "name": "Query Character Skill",
    "category": "query",
    "folder": "XV. Skills",
    "description": "Searches the Skill in the specified slot of a Character; outputs that Skill's Config ID.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Character Skill Slot",
        "type": "enum"
      }
    ],
    "outputs": [
      {
        "name": "Skill Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_skill_config_id_by_skill_instance_id",
    "name": "Query Skill Config ID by Skill Instance ID",
    "category": "query",
    "folder": "XV. Skills",
    "description": "Retrieve the Skill Config ID that corresponds to the specified Character Entity and Skill Instance ID.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Skill Instance ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Skill Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_all_skill_instance_ids_by_skill_config_id",
    "name": "Query All Skill Instance IDs by Skill Config ID",
    "category": "query",
    "folder": "XV. Skills",
    "description": "Retrieve the Skill Instance ID List that corresponds to the specified Character Entity and Skill Config ID.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Skill Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Skill Instance ID List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_all_skill_instance_ids_by_skill_slot",
    "name": "Query All Skill Instance IDs by Skill Slot",
    "category": "query",
    "folder": "XV. Skills",
    "description": "Retrieve all Skill Instance IDs present in a specified Skill Slot for the given Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Skill Slot",
        "type": "enum"
      }
    ],
    "outputs": [
      {
        "name": "Skill Instance ID List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_skill_instance_id_by_skill_slot_and_skill_config_id",
    "name": "Query Skill Instance ID by Skill Slot and Skill Config ID",
    "category": "query",
    "folder": "XV. Skills",
    "description": "Retrieve the Skill Instance ID in a specified Skill Slot that corresponds to a given Skill Config ID for the Character Entity.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Skill Slot",
        "type": "enum"
      },
      {
        "name": "Skill Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Skill Instance ID",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_skill_attribute_group_value",
    "name": "Query Skill Attribute Group Value",
    "category": "query",
    "folder": "XV. Skills",
    "description": "Retrieve the value of a Skill Group for a Character Entity, based on the specified Skill Group Config ID.",
    "inputs": [
      {
        "name": "Character Entity",
        "type": "entity"
      },
      {
        "name": "Skill Group Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Skill Group Value",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_list_of_slot_ids_querying_unit_status",
    "name": "List of Slot IDs Querying Unit Status",
    "category": "query",
    "folder": "XVI. Unit Status",
    "description": "Searches the list of all Slot IDs for the Unit Status with the specified Config ID on the Target Entity.",
    "inputs": [
      {
        "name": "Query Target Entity",
        "type": "entity"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Slot ID List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_entity_has_unit_status",
    "name": "Query If Entity Has Unit Status",
    "category": "query",
    "folder": "XVI. Unit Status",
    "description": "Searches whether the specified Entity has a Unit Status with the given Config ID.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Has",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_unit_status_stacks_by_slot_id",
    "name": "Query Unit Status Stacks by Slot ID",
    "category": "query",
    "folder": "XVI. Unit Status",
    "description": "Searches the Stack Count of the specified Unit Status on the Target Entity's designated Slot.",
    "inputs": [
      {
        "name": "Query Target Entity",
        "type": "entity"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      },
      {
        "name": "Slot ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Stacks",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_unit_status_applier_by_slot_id",
    "name": "Query Unit Status Applier by Slot ID",
    "category": "query",
    "folder": "XVI. Unit Status",
    "description": "Searches the Applier of the specified Unit Status on the Target Entity's designated Slot.",
    "inputs": [
      {
        "name": "Query Target Entity",
        "type": "entity"
      },
      {
        "name": "Unit Status Config ID",
        "type": "config_id"
      },
      {
        "name": "Slot ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Applier Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_list_by_unit_tag",
    "name": "Get Entity List by Unit Tag",
    "category": "query",
    "folder": "XVII. Unit Tags",
    "description": "Returns a list of all Entities in the scene that carry this Unit Tag.",
    "inputs": [
      {
        "name": "Unit Tag Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
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
    "id": "query_get_entity_unit_tag_list",
    "name": "Get Entity Unit Tag List",
    "category": "query",
    "folder": "XVII. Unit Tags",
    "description": "Returns a list of all Unit Tags carried by the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Unit Tag List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_global_aggro_transfer_multiplier",
    "name": "Query Global Aggro Transfer Multiplier",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Searches the Global Aggro Transfer Multiplier; it can be configured in [Stage Settings].",
    "inputs": [],
    "outputs": [
      {
        "name": "Global Aggro Transfer Multiplier",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_the_aggro_multiplier_of_the_specified_entity",
    "name": "Query the Aggro Multiplier of the Specified Entity",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Query Aggro Multiplier of Specific Entity.",
    "inputs": [
      {
        "name": "Query Target",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro Multiplier",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_the_aggro_value_of_the_specified_entity",
    "name": "Query the Aggro Value of the Specified Entity",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Searches the Aggro Value of the Target Entity on its Aggro Owners.",
    "inputs": [
      {
        "name": "Query Target",
        "type": "entity"
      },
      {
        "name": "Aggro Owner",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro Value",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_specified_entity_is_in_combat",
    "name": "Query if Specified Entity Is in Combat",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Searches whether the specified Entity has entered battle.",
    "inputs": [
      {
        "name": "Query Target",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "In Combat",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_list_of_owners_who_have_the_target_in_their_aggro_list",
    "name": "Get List of Owners Who Have the Target in Their Aggro List",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Searches which Entities' Aggro Lists include the specified Target Entity.",
    "inputs": [
      {
        "name": "Query Target",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro Owner List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_list_of_owners_that_have_the_target_as_their_aggro_target",
    "name": "Get List of Owners That Have the Target As Their Aggro Target",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Searches which Entities have the Target Entity as their Aggro Target.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro Owner List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_the_aggro_list_of_the_specified_entity",
    "name": "Get the Aggro List of the Specified Entity",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Get Specific Entity's Aggro List.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_the_aggro_target_of_the_specified_entity",
    "name": "Get the Aggro Target of the Specified Entity",
    "category": "query",
    "folder": "XVIII. Custom Aggro",
    "description": "Get Aggro Target of Specific Entity.",
    "inputs": [
      {
        "name": "Aggro Owner",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Aggro Target",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_the_number_of_waypoints_in_the_global_path",
    "name": "Get the Number of Waypoints in the Global Path",
    "category": "query",
    "folder": "XIX. Global Path",
    "description": "Get the number of Waypoints in the Global Path.",
    "inputs": [
      {
        "name": "Path Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Number of Waypoints",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_specified_waypoint_info",
    "name": "Get Specified Waypoint Info",
    "category": "query",
    "folder": "XIX. Global Path",
    "description": "Searches the specified Waypoint information for the given Path.",
    "inputs": [
      {
        "name": "Path Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Path Waypoint ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Waypoint Location",
        "type": "vector3"
      },
      {
        "name": "Waypoint Orientation",
        "type": "vector3"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_preset_point_list_by_unit_tag",
    "name": "Get Preset Point List by Unit Tag",
    "category": "query",
    "folder": "XX. Preset Points",
    "description": "Searches all Preset Points that carry the Unit Tag by its ID; outputs each Preset Point's ID.",
    "inputs": [
      {
        "name": "Unit Tag ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Point Index List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_preset_point_position_rotation",
    "name": "Query Preset Point Position Rotation",
    "category": "query",
    "folder": "XX. Preset Points",
    "description": "Searches the Location and Rotation of the specified Preset Point.",
    "inputs": [
      {
        "name": "Point Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
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
    "id": "query_get_player_settlement_success_status",
    "name": "Get Player Settlement Success Status",
    "category": "query",
    "folder": "XXI. Stage Settlement",
    "description": "Get Player Settlement Success Status.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Settlement Status",
        "type": "enum",
        "description": "Includes: Undetermined, Victory, Defeat"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_settlement_ranking_value",
    "name": "Get Player Settlement Ranking Value",
    "category": "query",
    "folder": "XXI. Stage Settlement",
    "description": "Returns the Settlement ranking value for the specified Player Entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Ranking Value",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_faction_settlement_success_status",
    "name": "Get Faction Settlement Success Status",
    "category": "query",
    "folder": "XXI. Stage Settlement",
    "description": "Get Faction Settlement Success Status.",
    "inputs": [
      {
        "name": "Faction",
        "type": "faction"
      }
    ],
    "outputs": [
      {
        "name": "Settlement Status",
        "type": "enum",
        "description": "Includes: Undetermined, Victory, Defeat"
      }
    ],
    "execIn": false,
    "execOut": false
  }
];

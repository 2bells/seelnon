/**
 * EXECUTION_NODES - part 5
 */
export const EXECUTION_NODES_E = [
{
    "id": "exec_trigger_loot_drop",
    "name": "Trigger Loot Drop",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Triggers a loot drop for the dropper entity, with configurable loot type.",
    "inputs": [
      {
        "name": "Dropper Entity",
        "type": "entity"
      },
      {
        "name": "Loot Type",
        "type": "enum",
        "description": "Types: Shared Reward (one share for all), Individualized Reward (one share per person)"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_loot_drop_content",
    "name": "Set Loot Drop Content",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Configure the Loot drop data in the Loot Component on the Dropper Entity in Dictionary format.",
    "inputs": [
      {
        "name": "Dropper Entity",
        "type": "entity"
      },
      {
        "name": "Loot Drop Dictionary",
        "type": "dict"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_inventory_item_quantity",
    "name": "Increase Inventory Item Quantity",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Modifying the quantity of a specified item in your inventory will add an increase to the current value; the increase can be a negative number.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Increase Value",
        "type": "int",
        "description": "The changed value = original value + increase value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_inventory_currency_quantity",
    "name": "Increase Inventory Currency Quantity",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Modify the amount of a specified currency in the player's inventory. This will add the specified increase value to the current amount, and the increase value can be negative.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Currency Config ID",
        "type": "config_id"
      },
      {
        "name": "Increase Value",
        "type": "int",
        "description": "The changed value = original value + increase value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_loot_component_item_quantity",
    "name": "Increase Loot Component Item Quantity",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Modify the quantity of a specified item in the drop component of a loot prefab. This will add the specified increase value to the current quantity, and the increase value can be negative.",
    "inputs": [
      {
        "name": "Loot Entity",
        "type": "entity"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Increase Value",
        "type": "int",
        "description": "The changed value = original value + increase value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_loot_component_currency_quantity",
    "name": "Increase Loot Component Currency Quantity",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Modify the amount of a specified currency in the drop component of a loot prefab. This will add the specified increase value to the current amount, and the increase value can be negative.",
    "inputs": [
      {
        "name": "Loot Entity",
        "type": "entity"
      },
      {
        "name": "Currency Config ID",
        "type": "config_id"
      },
      {
        "name": "Increase Value",
        "type": "int",
        "description": "The changed value = original value + increase value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_maximum_inventory_capacity",
    "name": "Increase Maximum Inventory Capacity",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Increase the maximum Inventory capacity of the specified Inventory Owner.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Increase Capacity",
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
    "id": "exec_set_player_list_for_visible_mini_map_markers",
    "name": "Set Player List for Visible Mini-Map Markers",
    "category": "execution",
    "folder": "XL. Mini-Map Marker Component",
    "description": "The mini-map marker at the specified ID in the Target Entity's Mini-map Marker Component is visible to all Players in the Player List.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity that owns the Mini-map Marker component to be edited"
      },
      {
        "name": "Mini-Map Marker ID",
        "type": "int",
        "description": "ID of the specified Mini-map Marker to be edited",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Player List",
        "type": "entity",
        "description": "The specified Mini-map ID on the Target Entity, visible only to the Player providing input"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_markers_on_the_mini_map",
    "name": "Set Player Markers on the Mini-Map",
    "category": "execution",
    "folder": "XL. Mini-Map Marker Component",
    "description": "When the Player Marker option is selected and a corresponding Player Entity is linked in the Node Graph, the Target Entity's display on the mini-map changes to that Player's avatar.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity that owns the Mini-map Marker component to be edited"
      },
      {
        "name": "Mini-Map Marker ID",
        "type": "int",
        "description": "ID of the specified Mini-map Marker to be edited",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Corresponding Player Entity",
        "type": "entity",
        "description": "Changes the avatar of the corresponding Player Entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_mini_map_marker_activation_status",
    "name": "Set Mini-Map Marker Activation Status",
    "category": "execution",
    "folder": "XL. Mini-Map Marker Component",
    "description": "Edit the active state of mini-map markers on the Target Entity in batches using the input list of Mini-map Marker IDs.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Entity that owns the Mini-map Marker component to be edited"
      },
      {
        "name": "Mini-Map Marker ID List",
        "type": "int",
        "description": "List of Mini-map Marker IDs to be set to the specified status. Unconfigured Mini-map Markers will be set to the opposite status",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Active",
        "type": "bool",
        "description": "If input is True, the Mini-map Markers corresponding to the specified ID numbers in the input list will be set to Enabled. For IDs not in the input list, the corresponding Mini-map Markers will be set to Disabled",
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
    "id": "exec_set_mini_map_zoom",
    "name": "Set Mini-Map Zoom",
    "category": "execution",
    "folder": "XL. Mini-Map Marker Component",
    "description": "Set the map scale of the mini-map interface control for the target player.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity"
      },
      {
        "name": "Zoom Dimensions",
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
    "id": "exec_set_player_list_for_tracking_mini_map_markers",
    "name": "Set Player List for Tracking Mini-Map Markers",
    "category": "execution",
    "folder": "XL. Mini-Map Marker Component",
    "description": "Set the mini-map marker of the target entity with the corresponding index to a tracking appearance for the specified player.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Mini-Map Marker ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Player List",
        "type": "entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_switch_custom_maps",
    "name": "Switch Custom Maps",
    "category": "execution",
    "folder": "XL. Mini-Map Marker Component",
    "description": "Allows switching the Target Player's currently active minimap configuration.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity"
      },
      {
        "name": "Map Config ID",
        "type": "config_id"
      },
      {
        "name": "Display Map?",
        "type": "bool",
        "description": "Toggle Yes to display map",
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
    "id": "exec_switch_creation_patrol_template",
    "name": "Switch Creation Patrol Template",
    "category": "execution",
    "folder": "XLI. Creation Patrol",
    "description": "Immediately switch the patrol template for the Creation and move according to the new template.",
    "inputs": [
      {
        "name": "Creation Entity",
        "type": "entity"
      },
      {
        "name": "Patrol Template ID",
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
    "id": "exec_set_player_leaderboard_score_as_a_float",
    "name": "Set Player Leaderboard Score as a Float",
    "category": "execution",
    "folder": "XLII. Leaderboard",
    "description": "Set Player Leaderboard Score (Float).",
    "inputs": [
      {
        "name": "Player ID List",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Leaderboard Score",
        "type": "float",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Leaderboard ID",
        "type": "int",
        "description": "The ID corresponding to the specified Leaderboard in Peripheral System management",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_leaderboard_score_as_an_integer",
    "name": "Set Player Leaderboard Score as an Integer",
    "category": "execution",
    "folder": "XLII. Leaderboard",
    "description": "Set Player Leaderboard Score (Integer).",
    "inputs": [
      {
        "name": "Player ID List",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Leaderboard Score",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Leaderboard ID",
        "type": "int",
        "description": "The ID corresponding to the specified Leaderboard in Peripheral System management",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_increase_achievement_progress_tally",
    "name": "Increase Achievement Progress Tally",
    "category": "execution",
    "folder": "XLIII. Achievements",
    "description": "Change the progress counter for the specified Achievement ID on the Target Entity.",
    "inputs": [
      {
        "name": "Change Entity",
        "type": "entity"
      },
      {
        "name": "Achievement ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Progress Tally Increase Value",
        "type": "int",
        "description": "New Value = Previous Value + Change Value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_achievement_progress_tally",
    "name": "Set Achievement Progress Tally",
    "category": "execution",
    "folder": "XLIII. Achievements",
    "description": "Set the progress counter for the specified Achievement ID on the Target Entity.",
    "inputs": [
      {
        "name": "Set Entity",
        "type": "entity"
      },
      {
        "name": "Achievement ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Progress Tally",
        "type": "int",
        "description": "Sets the Progress Count to the input value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_scan_tag_rules",
    "name": "Set Scan Tag Rules",
    "category": "execution",
    "folder": "XLIV. Scan Tags",
    "description": "Configure rules for Scan Tags. The scanning logic is executed based on the configured rules.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Rule Type",
        "type": "enum",
        "description": "Options: Prioritize View or Prioritize Distance"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_scan_component_s_active_scan_tag_id",
    "name": "Set Scan Component's Active Scan Tag ID",
    "category": "execution",
    "folder": "XLIV. Scan Tags",
    "description": "Set the Scan Tag with the specified ID in the Target Entity's Scan Tag Component to the active state.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Scan Tag ID",
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
    "id": "exec_switch_the_scoring_group_that_affects_player_s_competitive_rank",
    "name": "Switch the Scoring Group that Affects Player's Competitive Rank",
    "category": "execution",
    "folder": "XLV. Rank",
    "description": "Switch the active Scoring Group of the specified Player's Ranking by Scoring Group ID.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Score Group ID",
        "type": "int",
        "description": "The ID corresponding to the specified Score Group in Peripheral System management",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_rank_score_change",
    "name": "Set Player Rank Score Change",
    "category": "execution",
    "folder": "XLV. Rank",
    "description": "Set the Player's rank score change based on the settlement status.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Settlement Status",
        "type": "enum",
        "description": "Includes: Undefined, Victory, Defeat, Escape"
      },
      {
        "name": "Score Change",
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
    "id": "exec_set_player_escape_validity",
    "name": "Set Player Escape Validity",
    "category": "execution",
    "folder": "XLV. Rank",
    "description": "Set whether escaping is permitted for the specified Player.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Valid",
        "type": "bool",
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
    "id": "exec_activate_disable_entity_deployment_group",
    "name": "Activate/Disable Entity Deployment Group",
    "category": "execution",
    "folder": "XLVI. Entity Deployment Group",
    "description": "Edit the Initial Creation Switch state of the Entity Layout Group.",
    "inputs": [
      {
        "name": "Entity Deployment Group Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Activate",
        "type": "bool",
        "description": "If set to True, the Entity Layout Group's Initial Creation switch is enabled",
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
    "id": "exec_set_chat_channel_switch",
    "name": "Set Chat Channel Switch",
    "category": "execution",
    "folder": "XLVII. Chat Channel",
    "description": "Configure the voice and text toggles for the chat channel.",
    "inputs": [
      {
        "name": "Channel Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Voice-Over Switch",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Text Switch",
        "type": "bool",
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
    "id": "exec_set_player_s_current_channel",
    "name": "Set Player's Current Channel",
    "category": "execution",
    "folder": "XLVII. Chat Channel",
    "description": "Set the Player's currently available channels. Channels in the list are available to the Player, and channels not in the list are unavailable.",
    "inputs": [
      {
        "name": "Player GUID",
        "type": "guid"
      },
      {
        "name": "Channel Index List",
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
    "id": "exec_set_text_chat_permissions",
    "name": "Set Text Chat Permissions",
    "category": "execution",
    "folder": "XLVII. Chat Channel",
    "description": "Set the target player's permission to use text chat in the channel list.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity"
      },
      {
        "name": "Channel List",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Limit Permissions",
        "type": "bool",
        "description": "When enabled, the corresponding functionality of the player in the designated channel list will be restricted",
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
    "id": "exec_set_voice_chat_scope",
    "name": "Set Voice Chat Scope",
    "category": "execution",
    "folder": "XLVII. Chat Channel",
    "description": "Set the voice chat range of the target player within the channel list.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity"
      },
      {
        "name": "Channel List",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Effective Range",
        "type": "int",
        "description": "This determines the distance within which the target player can hear voice chat from other players in the same channel, and does not affect the range at which other players can hear the target player. Range: 1–100 m",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Limit Scope",
        "type": "bool",
        "description": "The range takes effect only when this option is enabled; When disabled, the configured range value is ignored",
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
    "id": "exec_set_voice_chat_permissions",
    "name": "Set Voice Chat Permissions",
    "category": "execution",
    "folder": "XLVII. Chat Channel",
    "description": "Set the target player's permissions to use voice chat in the channel list.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity"
      },
      {
        "name": "Channel List",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Restrict Voice Chat (Speak)",
        "type": "bool",
        "description": "When enabled, other players cannot hear the target player's voice",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Restrict Voice Chat (Listen)",
        "type": "bool",
        "description": "When enabled, the target player cannot hear other players' voices",
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
    "id": "exec_set_player_channel_permissions",
    "name": "Set Player Channel Permissions",
    "category": "execution",
    "folder": "XLVII. Chat Channel",
    "description": "Set player channel permissions.",
    "inputs": [
      {
        "name": "Player GUID",
        "type": "guid"
      },
      {
        "name": "Channel Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Join",
        "type": "bool",
        "description": "When enabled, the channel is only available to the specified player(s)",
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
    "id": "exec_consume_gift_box",
    "name": "Consume Gift Box",
    "category": "execution",
    "folder": "XLVIII. Wonderland Gift Boxes",
    "description": "Consume the specified Player's Wonderland Gift Box.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Gift Box Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Consumption Quantity",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Consumer?",
        "type": "bool",
        "description": "Output Parameter reads Yes when Gift Box is successfully consumed"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_enable_disable_pathfinding_obstacle",
    "name": "Enable/Disable Pathfinding Obstacle",
    "category": "execution",
    "folder": "XLIX. Pathfinding Obstacle",
    "description": "You can modify whether the pathfinding obstacle component of the target entity, corresponding to the specified index, is active.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Only applies to objects"
      },
      {
        "name": "Pathfinding Obstacle ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Activate",
        "type": "bool",
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
    "id": "exec_enable_disable_pathfinding_obstacle_feature",
    "name": "Enable/Disable Pathfinding Obstacle Feature",
    "category": "execution",
    "folder": "XLIX. Pathfinding Obstacle",
    "description": "You can modify whether the pathfinding obstacle function of the target entity is activated.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Only applies to objects"
      },
      {
        "name": "Activate",
        "type": "bool",
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
    "id": "exec_set_the_preset_status_value_of_the_complex_creation",
    "name": "Set the Preset Status Value of the Complex Creation",
    "category": "execution",
    "folder": "L. Creation Preset Status",
    "description": "You can set the preset state value for a specified preset state index of a complex creation.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Only applies to complex creations"
      },
      {
        "name": "Preset Status Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Preset Status Value",
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
    "id": "exec_close_floating_interaction_page",
    "name": "Close Floating Interaction Page",
    "category": "execution",
    "folder": "LI. Floating Interaction Page",
    "description": "Close the floating interaction page at the specified index for the Player Entity.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Floating Interaction Page Index",
        "type": "int",
        "description": "Unique Identifier of the Floating Interaction Page",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_update_floating_interaction_page_list_data",
    "name": "Update Floating Interaction Page List Data",
    "category": "execution",
    "folder": "LI. Floating Interaction Page",
    "description": "Replace the current displayed items of the tab or single-choice window at the specified list index with the visible list items corresponding to the input integer list.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "List Index",
        "type": "int",
        "description": "Unique Identifier for a Tab or Single-Choice Window",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Visible List Item",
        "type": "int",
        "description": "List of items for the tab or single-choice window. The input will update the visible list items of the specified tab or single-choice window",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Select First Item by Default",
        "type": "bool",
        "description": "Yes: Select the first item by default. No: Keeps the last selected item (if any)",
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
    "id": "exec_show_floating_interaction_page",
    "name": "Show Floating Interaction Page",
    "category": "execution",
    "folder": "LI. Floating Interaction Page",
    "description": "Open the floating interaction page at the specified index for the Player, with optional initialization of tab or single-choice window data.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Floating Interaction Page Index",
        "type": "int",
        "description": "Unique Identifier of the Floating Interaction Page",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Initialize List Data",
        "type": "dict",
        "description": "Key (int): Index corresponding to the tab or single-choice window. Value (List): Integer list corresponding to the tab items (for tabs) or item list (for single-choice windows)"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_no_of_tasks_configured",
    "name": "No. of Tasks Configured",
    "category": "execution",
    "folder": "LII. Stage Quests",
    "description": "Available only for Beyond Mode. Allows the setting of player's current corresponding task count to a specified value.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Quest Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Task Count",
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
    "id": "exec_increase_task_count",
    "name": "Increase Task Count",
    "category": "execution",
    "folder": "LII. Stage Quests",
    "description": "Available only for Beyond Mode. Use this to increase the current count of the corresponding player tasks (value entered may be negative).",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Quest Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Task Count Increased by",
        "type": "int",
        "description": "New Value = Previous Value + Increase Value",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  }
];

/**
 * QUERY_NODES - part 3
 */
export const QUERY_NODES_C = [
{
    "id": "query_get_faction_settlement_ranking_value",
    "name": "Get Faction Settlement Ranking Value",
    "category": "query",
    "folder": "XXI. Stage Settlement",
    "description": "Returns the Settlement ranking value for the specified Faction.",
    "inputs": [
      {
        "name": "Faction",
        "type": "faction"
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
    "id": "query_query_if_dictionary_contains_specific_key",
    "name": "Query If Dictionary Contains Specific Key",
    "category": "query",
    "folder": "XXII. Dictionary",
    "description": "Searches whether the specified Dictionary contains the specified Key.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "dict"
      },
      {
        "name": "Key",
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
    "id": "query_query_if_dictionary_contains_specific_value",
    "name": "Query If Dictionary Contains Specific Value",
    "category": "query",
    "folder": "XXII. Dictionary",
    "description": "Searches whether the specified Dictionary contains the specified Value.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "dict"
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
    "id": "query_query_dictionary_s_length",
    "name": "Query Dictionary's Length",
    "category": "query",
    "folder": "XXII. Dictionary",
    "description": "Searches the number of Key-Value Pairs in the Dictionary.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "dict"
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
    "id": "query_query_dictionary_value_by_key",
    "name": "Query Dictionary Value by Key",
    "category": "query",
    "folder": "XXII. Dictionary",
    "description": "Searches the corresponding Value in the Dictionary by Key. If the Key does not exist, returns the type's default value.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "dict"
      },
      {
        "name": "Key",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
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
    "id": "query_get_list_of_keys_from_dictionary",
    "name": "Get List of Keys from Dictionary",
    "category": "query",
    "folder": "XXII. Dictionary",
    "description": "Returns a list of all Keys in the Dictionary. Because Key-Value Pairs are unordered, the Keys may not be returned in insertion order.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "dict"
      }
    ],
    "outputs": [
      {
        "name": "Key List",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_list_of_values_from_dictionary",
    "name": "Get List of Values from Dictionary",
    "category": "query",
    "folder": "XXII. Dictionary",
    "description": "Returns a list of all Values in the Dictionary. Because Key-Value Pairs are unordered, the Values may not be returned in insertion order.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "dict"
      }
    ],
    "outputs": [
      {
        "name": "Value List",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_inventory_shop_item_sales_info",
    "name": "Query Inventory Shop Item Sales Info",
    "category": "query",
    "folder": "XXIII. Shop",
    "description": "Searches sale information for a specified Item in the Inventory Shop.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Sell Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Sort Priority",
        "type": "int"
      },
      {
        "name": "Can Be Sold",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_inventory_shop_item_sales_list",
    "name": "Query Inventory Shop Item Sales List",
    "category": "query",
    "folder": "XXIII. Shop",
    "description": "Search the inventory shop's sales list.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Item Config ID List",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_shop_purchase_item_list",
    "name": "Query Shop Purchase Item List",
    "category": "query",
    "folder": "XXIII. Shop",
    "description": "Search the shop's purchase list.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Item Config ID List",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_shop_item_purchase_info",
    "name": "Query Shop Item Purchase Info",
    "category": "query",
    "folder": "XXIII. Shop",
    "description": "Searches purchase information for a specified Item in the Shop.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Purchase Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Purchasable",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_custom_shop_item_sales_list",
    "name": "Query Custom Shop Item Sales List",
    "category": "query",
    "folder": "XXIII. Shop",
    "description": "Searches the Custom Shop sale list; the output parameter is a list of Item IDs.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Shop Item ID List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_custom_shop_item_sales_info",
    "name": "Query Custom Shop Item Sales Info",
    "category": "query",
    "folder": "XXIII. Shop",
    "description": "Searches sale information for a specified Item in the Custom Shop.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Sell Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Affiliated Tab ID",
        "type": "int"
      },
      {
        "name": "Limit Purchase",
        "type": "bool"
      },
      {
        "name": "Purchase Limit",
        "type": "int"
      },
      {
        "name": "Sort Priority",
        "type": "int"
      },
      {
        "name": "Can Be Sold",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_equipment_tag_list",
    "name": "Query Equipment Tag List",
    "category": "query",
    "folder": "XXIV. Equipment",
    "description": "Searches the list of all Tags on this Equipment instance.",
    "inputs": [
      {
        "name": "Equipment Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Tag List",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_equipment_config_id_by_equipment_id",
    "name": "Query Equipment Config ID by Equipment ID",
    "category": "query",
    "folder": "XXIV. Equipment",
    "description": "Searches the Equipment Config ID by Equipment ID. The Equipment Instance ID can be obtained in the [Equipment Initialization] event.",
    "inputs": [
      {
        "name": "Equipment Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Equipment Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_equipment_affix_list",
    "name": "Get Equipment Affix List",
    "category": "query",
    "folder": "XXIV. Equipment",
    "description": "Returns a list of all Affixes on this Equipment instance. When Equipment is initialized, Affix values are randomized, so the Equipment Affixes on the Equipment instance also generate corresponding instances. Therefore, the data type is Integer rather than Config ID.",
    "inputs": [
      {
        "name": "Equipment Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Equipment Affix List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_equipment_affix_config_id",
    "name": "Get Equipment Affix Config ID",
    "category": "query",
    "folder": "XXIV. Equipment",
    "description": "Returns the Config ID of an Equipment Affix by its ID on the Equipment instance.",
    "inputs": [
      {
        "name": "Equipment Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Affix ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Affix Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_equipment_affix_value",
    "name": "Get Equipment Affix Value",
    "category": "query",
    "folder": "XXIV. Equipment",
    "description": "Returns the value of the Affix at the specified ID on the Equipment instance.",
    "inputs": [
      {
        "name": "Equipment Index",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Affix ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Affix Value",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_the_equipment_index_of_the_specified_equipment_slot",
    "name": "Get the Equipment Index of the Specified Equipment Slot",
    "category": "query",
    "folder": "XXIV. Equipment",
    "description": "Get the equipment index of the specified equipment slot.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Row",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Column",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Equipment Index",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_inventory_item_quantity",
    "name": "Get Inventory Item Quantity",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns the quantity of the Item with the specified Config ID in the Inventory.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Item Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_inventory_currency_quantity",
    "name": "Get Inventory Currency Quantity",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns the amount of Currency with the specified Config ID in the Inventory.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Currency Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Resource Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_inventory_capacity",
    "name": "Get Inventory Capacity",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Get Inventory Capacity.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Inventory Capacity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_currency_from_inventory",
    "name": "Get All Currency From Inventory",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns all Currencies in the Inventory, including types and corresponding amounts.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Currency Dictionary",
        "type": "dict"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_basic_items_from_inventory",
    "name": "Get all basic items from Inventory",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns all Basic Items in the Inventory, including Item types and their quantities.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Basic Item Dictionary",
        "type": "dict"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_equipment_from_inventory",
    "name": "Get all equipment from Inventory",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns all Equipment in the Inventory; the output parameter is a list of all Equipment IDs.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Equipment Index List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_loot_component_item_quantity",
    "name": "Get Loot Component Item Quantity",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns the quantity of Items with the specified Config ID from the Loot Component on the Loot Prefab.",
    "inputs": [
      {
        "name": "Loot Entity",
        "type": "entity"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Item Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_loot_component_currency_quantity",
    "name": "Get Loot Component Currency Quantity",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns the amount of Currency with the specified Config ID from the Loot Component on the Loot Prefab.",
    "inputs": [
      {
        "name": "Loot Entity",
        "type": "entity"
      },
      {
        "name": "Currency Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [
      {
        "name": "Currency Amount",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_equipment_from_loot_component",
    "name": "Get All Equipment from Loot Component",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns all Equipment from the Loot Component on the Loot Prefab.",
    "inputs": [
      {
        "name": "Loot Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Equipment Index List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_items_from_loot_component",
    "name": "Get All Items from Loot Component",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns all Items from the Loot Component on the Loot Prefab.",
    "inputs": [
      {
        "name": "Dropper Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Item Dictionary",
        "type": "dict"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_currency_from_loot_component",
    "name": "Get All Currency from Loot Component",
    "category": "query",
    "folder": "XXV. Items",
    "description": "Returns all Currencies from the Loot Component on the Loot Prefab.",
    "inputs": [
      {
        "name": "Dropper Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Currency Dictionary",
        "type": "dict"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_all_entities_within_the_collision_trigger",
    "name": "Get All Entities Within the Collision Trigger",
    "category": "query",
    "folder": "XXVI. Collision Trigger",
    "description": "Returns all Entities within the Collision Trigger corresponding to a specific ID in the Collision Trigger Component on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Trigger ID",
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
    "id": "query_query_specified_mini_map_marker_information",
    "name": "Query Specified Mini-Map Marker Information",
    "category": "query",
    "folder": "XXVII. Mini-Map Marker Component",
    "description": "Searches the information of the Mini-map Marker with the specified ID in the Mini-map Marker Component on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Runtime Entity"
      },
      {
        "name": "Mini-Map Marker ID",
        "type": "int",
        "description": "The Mini-map Marker ID to search",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Activation State",
        "type": "bool",
        "description": "The active state of the searched Mini-map Marker"
      },
      {
        "name": "List of Players With Visible Markers",
        "type": "entity",
        "description": "Returns the list of Players who can see this Marker"
      },
      {
        "name": "List of Players Tracking Markers",
        "type": "entity",
        "description": "Returns the list of Players tracking this Marker"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_entity_s_mini_map_marker_status",
    "name": "Get Entity's Mini-Map Marker Status",
    "category": "query",
    "folder": "XXVII. Mini-Map Marker Component",
    "description": "Searches the configuration and activation status of the Entity's current Mini-map Marker.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "Runtime Entity"
      }
    ],
    "outputs": [
      {
        "name": "Full Mini-Map Marker ID List",
        "type": "int",
        "description": "Complete list of Mini-map Marker IDs for this Entity"
      },
      {
        "name": "Active Mini-Map Marker ID List",
        "type": "int",
        "description": "Complete list of active Mini-map Marker IDs for this Entity"
      },
      {
        "name": "Inactive Mini-Map Marker ID List",
        "type": "int",
        "description": "Complete list of inactive Mini-map Marker IDs for this Entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_current_creation_s_patrol_template",
    "name": "Get Current Creation's Patrol Template",
    "category": "query",
    "folder": "XXVIII. Creature Patrol",
    "description": "Returns the Patrol Template information of the specified Creation Entity.",
    "inputs": [
      {
        "name": "Creation Entity",
        "type": "entity",
        "description": "Runtime Creation Entity"
      }
    ],
    "outputs": [
      {
        "name": "Patrol Template ID",
        "type": "int",
        "description": "The Patrol Template ID currently active on this Creation"
      },
      {
        "name": "Path Index",
        "type": "int",
        "description": "The Path ID referenced by the Creation's currently active Patrol Template"
      },
      {
        "name": "Target Waypoint Index",
        "type": "int",
        "description": "The Waypoint ID the Creation will move to next"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_achievement_is_completed",
    "name": "Query If Achievement Is Completed",
    "category": "query",
    "folder": "XXIX. Achievements",
    "description": "Searches whether the Achievement corresponding to a specific ID on the Target Entity is complete.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Achievement ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Completed",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_the_currently_active_scan_tag_config_id",
    "name": "Get the Currently Active Scan Tag Config ID",
    "category": "query",
    "folder": "XXX. Scan Tags",
    "description": "Returns the Configuration ID of the currently active Scan Tags on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Scan Tag Config ID",
        "type": "config_id"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_rank_score_change",
    "name": "Get Player Rank Score Change",
    "category": "query",
    "folder": "XXXI. Rank Tier",
    "description": "Returns the Rank change score for the Player Entity under different Settlement states.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Settlement Status",
        "type": "enum"
      }
    ],
    "outputs": [
      {
        "name": "Score",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_ranking_info",
    "name": "Get Player Ranking Info",
    "category": "query",
    "folder": "XXXI. Rank Tier",
    "description": "Returns the Player's Rank-related information.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Player Rank Total Score",
        "type": "int"
      },
      {
        "name": "Player Win Streak",
        "type": "int"
      },
      {
        "name": "Player Lose Streak",
        "type": "int"
      },
      {
        "name": "Player Consecutive Escapes",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_player_escape_validity",
    "name": "Get Player Escape Validity",
    "category": "query",
    "folder": "XXXI. Rank Tier",
    "description": "Get Player Escape Permission.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Valid",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_currently_active_entity_deployment_groups",
    "name": "Get Currently Active Entity Deployment Groups",
    "category": "query",
    "folder": "XXXII. Entity Layout Group",
    "description": "Searches the list of Entity Layout Groups currently active in the Stage.",
    "inputs": [],
    "outputs": [
      {
        "name": "Entity Deployment Group Index List",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_corresponding_gift_box_quantity",
    "name": "Query Corresponding Gift Box Quantity",
    "category": "query",
    "folder": "XXXIII. Wonderland Gift Box Related",
    "description": "Searches the quantity of the specified Gift Box on the Player Entity.",
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
      }
    ],
    "outputs": [
      {
        "name": "Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_corresponding_gift_box_consumption",
    "name": "Query Corresponding Gift Box Consumption",
    "category": "query",
    "folder": "XXXIII. Wonderland Gift Box Related",
    "description": "Searches the consumed quantity of the specified Gift Box on the Player Entity.",
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
      }
    ],
    "outputs": [
      {
        "name": "Quantity",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_get_the_preset_status_value_of_the_complex_creation",
    "name": "Get the Preset Status Value of the Complex Creation",
    "category": "query",
    "folder": "XXXIV. Creation Preset Status",
    "description": "Get the preset status value of the complex creation.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity",
        "description": "复杂造物实体"
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
    "id": "query_query_specified_task_count",
    "name": "Query Specified Task Count",
    "category": "query",
    "folder": "XXXV. Stage Tasks",
    "description": "Available only in Beyond Mode. Returns the corresponding player's current task count for specified tasks.",
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
      }
    ],
    "outputs": [
      {
        "name": "Task Count",
        "type": "int"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_if_specified_task_is_completed",
    "name": "Query If Specified Task is Completed",
    "category": "query",
    "folder": "XXXV. Stage Tasks",
    "description": "Available only in Beyond Mode. Use this to check if a specified task has been completed by the corresponding player.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "The Player Entity queried"
      },
      {
        "name": "Quest Index",
        "type": "int",
        "description": "The corresponding index number for the task queried",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [
      {
        "name": "Completed?",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_player_s_currently_activated_control_motion_device_list",
    "name": "Query Player's Currently Activated Control Motion Device List",
    "category": "query",
    "folder": "XXXVI. Control Motion Device",
    "description": "Query the player's currently activated Control Motion Device List.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Control Motion Device Entity List",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_player_s_followed_control_motion_device",
    "name": "Query Player's Followed Control Motion Device",
    "category": "query",
    "folder": "XXXVI. Control Motion Device",
    "description": "Query the player's Followed Control Motion Device.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Control Motion Device Entity",
        "type": "entity"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_query_control_motion_device_s_current_movement_parameters",
    "name": "Query Control Motion Device's Current Movement Parameters",
    "category": "query",
    "folder": "XXXVI. Control Motion Device",
    "description": "Retrieves the current movement parameters of the Motion Controller. Temporary movement parameters added by Motion Controller Skill nodes are excluded.",
    "inputs": [
      {
        "name": "Control Motion Device",
        "type": "entity"
      }
    ],
    "outputs": [
      {
        "name": "Forward Acceleration",
        "type": "float"
      },
      {
        "name": "Reverse Acceleration",
        "type": "float"
      },
      {
        "name": "Turn Speed",
        "type": "float"
      },
      {
        "name": "Base Resistance",
        "type": "float"
      },
      {
        "name": "Resistance Coefficient",
        "type": "float"
      },
      {
        "name": "Max Forward Speed",
        "type": "float"
      },
      {
        "name": "Max Reverse Speed",
        "type": "float"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_check_whether_player_has_subscribed",
    "name": "Check Whether Player Has Subscribed",
    "category": "query",
    "folder": "XXXVII. Subscribe to Creator",
    "description": "Checks whether the specified player has subscribed to the Craftsperson. A Craftsperson cannot subscribe to themselves. However, when this node is triggered by the Craftsperson themself, the output result will be true.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "The player entity to check for subscription status"
      }
    ],
    "outputs": [
      {
        "name": "Subscribed",
        "type": "bool"
      }
    ],
    "execIn": false,
    "execOut": false
  },
{
    "id": "query_check_whether_player_cursor_is_active",
    "name": "Check Whether Player Cursor Is Active",
    "category": "query",
    "folder": "XXXVIII. Cursor",
    "description": "Checks whether the specified player's cursor is currently active (always visible).",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity",
        "description": "The player to query"
      }
    ],
    "outputs": [
      {
        "name": "Activate",
        "type": "bool",
        "description": "Returns `true` if the cursor is always visible"
      }
    ],
    "execIn": false,
    "execOut": false
  }
];

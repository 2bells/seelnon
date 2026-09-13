/**
 * EXECUTION_NODES - part 4
 */
export const EXECUTION_NODES_D = [
{
    "id": "exec_clear_specified_target_s_aggro_list",
    "name": "Clear Specified Target's Aggro List",
    "category": "execution",
    "folder": "XXVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. Clear the Aggro Owner's Aggro List. This may cause them to leave battle.",
    "inputs": [
      {
        "name": "Aggro Owner",
        "type": "entity"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_the_aggro_value_of_specified_entity",
    "name": "Set the Aggro Value of Specified Entity",
    "category": "execution",
    "folder": "XXVIII. Custom Aggro",
    "description": "Available only in Custom Aggro Mode. Set the Aggro Value of the specified Target Entity on the specified Aggro Owner.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Aggro Owner Entity",
        "type": "entity"
      },
      {
        "name": "Aggro Value",
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
    "id": "exec_send_signal",
    "name": "Send Signal",
    "category": "execution",
    "folder": "XXIX. Signals",
    "description": "Send a custom Signal to the global Stage. Before use, select the corresponding Signal name to ensure correct parameter usage.",
    "inputs": [],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_entity_active_nameplate",
    "name": "Set Entity Active Nameplate",
    "category": "execution",
    "folder": "XXX. Nameplate",
    "description": "Set the active Nameplate list for the specified target. Nameplates included in the input list are enabled, while those not included are disabled.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Nameplate Config ID List",
        "type": "config_id"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_switch_active_text_bubble",
    "name": "Switch Active Text Bubble",
    "category": "execution",
    "folder": "XXXI. Text Bubbles",
    "description": "In the Target Entity's Text Bubble Component, replace the current active Text Bubble with the one corresponding to the Config ID.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Text Bubble Configuration ID",
        "type": "config_id"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_close_deck_selector",
    "name": "Close Deck Selector",
    "category": "execution",
    "folder": "XXXII. Deck Selector",
    "description": "Close the currently active Deck Selector for the specified Player.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Deck Selector Index",
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
    "id": "exec_invoke_deck_selector",
    "name": "Invoke Deck Selector",
    "category": "execution",
    "folder": "XXXII. Deck Selector",
    "description": "Open the pre-made Deck Selector for the Target Player.",
    "inputs": [
      {
        "name": "Target Player",
        "type": "entity",
        "description": "Specify the runtime Player to invoke the Deck Selector"
      },
      {
        "name": "Deck Selector ID",
        "type": "int",
        "description": "Referenced UI Control Group ID",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Select Duration",
        "type": "float",
        "description": "If empty, uses the Deck Selector's default configuration; otherwise, this time value is used as the effective duration. Unit in seconds. If the duration exceeds 2,000,000 seconds, it can no longer be invoked",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      },
      {
        "name": "Select Result Corresponding List",
        "type": "int",
        "description": "One-to-one with display items: the Deck Selector returns the result value corresponding to each display item. Recommended configuration: 1 to X",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Select Display Corresponding List",
        "type": "int",
        "description": "Deck Library Configuration Reference",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Select Minimum Quantity",
        "type": "int",
        "description": "The minimum number of cards that must be selected for a valid interaction",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Select Maximum Quantity",
        "type": "int",
        "description": "The maximum number of cards that can be selected for a valid interaction",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Refresh Mode",
        "type": "enum",
        "description": "Cannot Refresh: Both input parameters (Refresh Maximum Quantity and Refresh Maximum Quantity) are ignored, and the selection screen has no refresh button. Partial Refresh: Both input parameters (Refresh Maximum Quantity and Refresh Maximum Quantity) take effect, and the selection screen includes a refresh button. Refresh All: Both input parameters (Refresh Maximum Quantity and Refresh Maximum Quantity) are ignored. All results are returned by default, and the selection screen includes a refresh button"
      },
      {
        "name": "Refresh Minimum Quantity",
        "type": "int",
        "description": "The minimum number of cards that must be selected for a valid refresh interaction",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Refresh Maximum Quantity",
        "type": "int",
        "description": "The maximum number of cards that can be selected for a valid refresh interaction",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Default Return Selection",
        "type": "int",
        "description": "If the Deck Selector times out, has no interaction, or closes abnormally, force-assign this configured result. The length of this Result List must match the valid card selection count",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_random_deck_selector_selection_list",
    "name": "Random Deck Selector Selection List",
    "category": "execution",
    "folder": "XXXII. Deck Selector",
    "description": "Randomly sort the input List.",
    "inputs": [
      {
        "name": "Select List",
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
    "id": "exec_set_player_settlement_success_status",
    "name": "Set Player Settlement Success Status",
    "category": "execution",
    "folder": "XXXIII. Stage Settlement",
    "description": "Set Player Settlement Success Status.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Settlement Status",
        "type": "enum",
        "description": "Three types: Undefined, Victory, Defeat"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_player_settlement_scoreboard_data_display",
    "name": "Set Player Settlement Scoreboard Data Display",
    "category": "execution",
    "folder": "XXXIII. Stage Settlement",
    "description": "Set the Player's Scoreboard display data, which is shown on the Scoreboard after Stage Settlement. Since this node involves the display of external functions, `Data Value` and `Data Name` currently support multilingual translation only when manually entering text. If entered via connection input, multilingual translation is not supported.",
    "inputs": [
      {
        "name": "Set Entity",
        "type": "entity",
        "description": "Active Player Entity"
      },
      {
        "name": "Data Order",
        "type": "int",
        "description": "The sort order of this data",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Data Name",
        "type": "string",
        "description": "The name of this data",
        "defaultVal": "",
        "placeholder": "Data Name"
      },
      {
        "name": "Data Value",
        "type": "generic",
        "description": "The value of this data. Supports Integer, Floating Point Number, and String",
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
    "id": "exec_set_player_settlement_ranking_value",
    "name": "Set Player Settlement Ranking Value",
    "category": "execution",
    "folder": "XXXIII. Stage Settlement",
    "description": "Set the Player's ranking value after Settlement, then determine the final ranking order according to `Ranking Value Comparison Order` in `Stage Settings` – `Settlement`.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Ranking Value",
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
    "id": "exec_set_faction_settlement_success_status",
    "name": "Set Faction Settlement Success Status",
    "category": "execution",
    "folder": "XXXIII. Stage Settlement",
    "description": "Set Faction Settlement Success Status.",
    "inputs": [
      {
        "name": "Faction",
        "type": "faction",
        "description": "Active Faction Entity"
      },
      {
        "name": "Settlement Status",
        "type": "enum",
        "description": "Three types: Undefined, Victory, Defeat"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_faction_settlement_ranking_value",
    "name": "Set Faction Settlement Ranking Value",
    "category": "execution",
    "folder": "XXXIII. Stage Settlement",
    "description": "Set the faction's ranking value after Settlement, then determine the final ranking order according to `Ranking Value Comparison Order` in `Stage Settings` – `Settlement`.",
    "inputs": [
      {
        "name": "Faction",
        "type": "faction",
        "description": "Active Faction Entity"
      },
      {
        "name": "Ranking Value",
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
    "id": "exec_toggle_entity_light_source",
    "name": "Toggle Entity Light Source",
    "category": "execution",
    "folder": "XXXIV. Light Source Components",
    "description": "Adjust the Light Source state at the specified ID in the Light Source Component on the Target Entity.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Light Source ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Enable or Disable",
        "type": "bool",
        "description": "If set to True, turns On",
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
    "id": "exec_sort_dictionary_by_key",
    "name": "Sort Dictionary by Key",
    "category": "execution",
    "folder": "XXXV. Dictionary",
    "description": "Sort and output the specified Dictionary by keys in ascending or descending order.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Sort By",
        "type": "enum",
        "options": ["Ascending", "Descending"],
        "defaultVal": "Ascending"
      }
    ],
    "outputs": [
      {
        "name": "Key List",
        "type": "generic",
        "hasGear": true
      },
      {
        "name": "Value List",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_sort_dictionary_by_value",
    "name": "Sort Dictionary by Value",
    "category": "execution",
    "folder": "XXXV. Dictionary",
    "description": "Sort and output the specified Dictionary by values in ascending or descending order.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Sort By",
        "type": "enum",
        "options": ["Ascending", "Descending"],
        "defaultVal": "Ascending"
      }
    ],
    "outputs": [
      {
        "name": "Key List",
        "type": "generic",
        "hasGear": true
      },
      {
        "name": "Value List",
        "type": "generic",
        "hasGear": true
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_or_add_key_value_pairs_to_dictionary",
    "name": "Set or Add Key Value Pairs to Dictionary",
    "category": "execution",
    "folder": "XXXV. Dictionary",
    "description": "Add a Key-Value Pair to the specified Dictionary.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Key",
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
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_clear_dictionary",
    "name": "Clear Dictionary",
    "category": "execution",
    "folder": "XXXV. Dictionary",
    "description": "Clear all Key-Value Pairs from the specified Dictionary.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "generic",
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
    "id": "exec_remove_key_value_pairs_from_dictionary_by_key",
    "name": "Remove Key Value Pairs from Dictionary by Key",
    "category": "execution",
    "folder": "XXXV. Dictionary",
    "description": "Remove Key-Value Pairs from the specified Dictionary by key.",
    "inputs": [
      {
        "name": "Dictionary",
        "type": "generic",
        "defaultVal": "0",
        "placeholder": "0",
        "hasGear": true
      },
      {
        "name": "Key",
        "type": "generic",
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
    "id": "exec_modify_structure",
    "name": "Modify Structure",
    "category": "execution",
    "folder": "XXXVI. Structures",
    "description": "After selecting a Structure, you can edit each parameter of that Structure.",
    "inputs": [
      {
        "name": "Target Structure",
        "type": "generic",
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
    "id": "exec_remove_item_from_inventory_shop_sales_list",
    "name": "Remove Item From Inventory Shop Sales List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Remove items from the inventory shop's sales list.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Item Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_item_from_purchase_list",
    "name": "Remove Item From Purchase List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Remove items from the purchase list.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item Config ID",
        "type": "config_id"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_item_from_custom_shop_sales_list",
    "name": "Remove Item From Custom Shop Sales List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Remove items from the custom shop's sales list.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
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
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_open_shop",
    "name": "Open Shop",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Open the Shop from the Player Entity's perspective during gameplay.",
    "inputs": [
      {
        "name": "Player Entity",
        "type": "entity"
      },
      {
        "name": "Shop Owner Entity",
        "type": "entity",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity"
      },
      {
        "name": "Shop ID",
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
    "id": "exec_close_shop",
    "name": "Close Shop",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Close all open Shops from the Player Entity's perspective during gameplay.",
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
    "id": "exec_add_new_item_to_inventory_shop_sales_list",
    "name": "Add New Item to Inventory Shop Sales List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Add new items to the inventory shop's sales list.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Sell Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Affiliated Tab ID",
        "type": "int",
        "description": "1 Equipment, 2 Consumables, 3 Materials, 4 Valuables",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Sort Priority",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Can Be Sold",
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
    "id": "exec_add_items_to_the_purchase_list",
    "name": "Add Items to the Purchase List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Add New Items to the Item Purchase List.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Purchase Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Purchasable",
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
    "id": "exec_add_new_item_to_custom_shop_sales_list",
    "name": "Add New Item to Custom Shop Sales List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Add items to the Custom Shop Sales List. Upon success, an Integer ID is generated in the Output Parameter as the item identifier.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Sell Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Affiliated Tab ID",
        "type": "int",
        "description": "1 Equipment, 2 Consumables, 3 Materials, 4 Valuables",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Limit Purchase",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Purchase Limit",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Sort Priority",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Can Be Sold",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      }
    ],
    "outputs": [
      {
        "name": "Item Index",
        "type": "int"
      }
    ],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_set_inventory_shop_item_sales_info",
    "name": "Set Inventory Shop Item Sales Info",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Set up information on items for sale in the inventory shop.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
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
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Sort Priority",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Can Be Sold",
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
    "id": "exec_set_item_purchase_info_in_the_purchase_list",
    "name": "Set Item Purchase Info in the Purchase List",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Set up item acquisition table.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item Config ID",
        "type": "config_id"
      },
      {
        "name": "Purchase Currency Dictionary",
        "type": "dict"
      },
      {
        "name": "Purchasable",
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
    "id": "exec_set_custom_shop_item_sales_info",
    "name": "Set Custom Shop Item Sales Info",
    "category": "execution",
    "folder": "XXXVII. Shop",
    "description": "Set custom store product sales information.",
    "inputs": [
      {
        "name": "Shop Owner Entity",
        "type": "entity"
      },
      {
        "name": "Shop ID",
        "type": "int",
        "description": "The Shop ID corresponding to the Shop component on the Shop Owner Entity",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Shop Item ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
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
        "type": "int",
        "description": "1 Equipment, 2 Consumables, 3 Materials, 4 Valuables",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Limit Purchase",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Purchase Limit",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Sort Priority",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Can Be Sold",
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
    "id": "exec_set_equipment_affix_value",
    "name": "Set Equipment Affix Value",
    "category": "execution",
    "folder": "XXXVIII. Equipment",
    "description": "Sets the value on the corresponding entry for a specified equipment instance.",
    "inputs": [
      {
        "name": "Equipment Index",
        "type": "int",
        "description": "Integer ID generated during Equipment Initialization to identify the equipment instance",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Affix ID",
        "type": "int",
        "description": "Each ID corresponds to one single Affix",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Affix Value",
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
    "id": "exec_remove_equipment_affix",
    "name": "Remove Equipment Affix",
    "category": "execution",
    "folder": "XXXVIII. Equipment",
    "description": "Remove the specified Affix from the Equipment instance.",
    "inputs": [
      {
        "name": "Equipment ID",
        "type": "int",
        "description": "Integer ID generated during Equipment Initialization to identify the equipment instance",
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
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_affix_to_equipment",
    "name": "Add Affix to Equipment",
    "category": "execution",
    "folder": "XXXVIII. Equipment",
    "description": "Add a preconfigured Affix to the specified Equipment instance, with the option to overwrite the Affix value.",
    "inputs": [
      {
        "name": "Equipment ID",
        "type": "int",
        "description": "Integer ID generated during Equipment Initialization to identify the equipment instance",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Affix Config ID",
        "type": "config_id",
        "description": "The Config ID of the preconfigured Affix defined in Equipment Data Management"
      },
      {
        "name": "Overwrite Affix Value",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Affix Value",
        "type": "float",
        "description": "Can overwrite the value on a pre-configured Affix",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_add_affix_to_equipment_at_specified_id",
    "name": "Add Affix to Equipment at Specified ID",
    "category": "execution",
    "folder": "XXXVIII. Equipment",
    "description": "Add a preconfigured Affix at the specified Affix ID on the Equipment instance, with the option to overwrite the Affix value.",
    "inputs": [
      {
        "name": "Equipment ID",
        "type": "int",
        "description": "Integer ID generated during Equipment Initialization to identify the equipment instance",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Affix Config ID",
        "type": "config_id",
        "description": "The Config ID of the preconfigured Affix defined in Equipment Data Management"
      },
      {
        "name": "Insert ID",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Overwrite Affix Value",
        "type": "bool",
        "defaultVal": "True",
        "options": [
          "True",
          "False"
        ]
      },
      {
        "name": "Affix Value",
        "type": "float",
        "description": "Can overwrite the value on a pre-configured Affix",
        "defaultVal": "0.0",
        "placeholder": "0.0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_replace_equipment_to_the_specified_slot",
    "name": "Replace Equipment to the Specified Slot",
    "category": "execution",
    "folder": "XXXVIII. Equipment",
    "description": "Replaces the specified equipment in the corresponding equipment slot of the target entity. If the equipment is already equipped in the equipment slot, the replacement will not take effect. If the target slot already contains an equipped item, that item will be replaced.",
    "inputs": [
      {
        "name": "Target Entity",
        "type": "entity"
      },
      {
        "name": "Equipment Row",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Equipment Column",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Equipment Index",
        "type": "int",
        "description": "The equipment instance is identified by an integer index generated during equipment initialization",
        "defaultVal": "0",
        "placeholder": "0"
      }
    ],
    "outputs": [],
    "execIn": true,
    "execOut": true
  },
{
    "id": "exec_remove_equipment_from_specified_slot",
    "name": "Remove Equipment from Specified Slot",
    "category": "execution",
    "folder": "XXXVIII. Equipment",
    "description": "Remove the equipment from the specified slot (by row and column).",
    "inputs": [
      {
        "name": "Equipment Slot Owner Entity",
        "type": "entity"
      },
      {
        "name": "Equipment Slot Row Count",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
      },
      {
        "name": "Equipment Slot Column Count",
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
    "id": "exec_set_inventory_item_drop_contents",
    "name": "Set Inventory Item Drop Contents",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Configure the Inventory Item drop data in Dictionary format, and specify the Drop Type.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item Drop Dictionary",
        "type": "dict"
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
    "id": "exec_set_inventory_drop_items_currency_amount",
    "name": "Set Inventory Drop Items/Currency Amount",
    "category": "execution",
    "folder": "XXXIX. Items and Inventory",
    "description": "Set the type and quantity of Items or Currency for the Inventory drop.",
    "inputs": [
      {
        "name": "Inventory Owner Entity",
        "type": "entity"
      },
      {
        "name": "Item/Currency Config ID",
        "type": "config_id"
      },
      {
        "name": "Quantity Dropped",
        "type": "int",
        "defaultVal": "0",
        "placeholder": "0"
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
  }
];
